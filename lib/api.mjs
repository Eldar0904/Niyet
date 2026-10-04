import { timingSafeEqual } from 'node:crypto';
import { update } from './store.mjs';
import { hash, id, token, seal, unseal, today, monday, addDays, validDate, nextMonday, rateAt, calculateEntry, ranking } from './domain.mjs';

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
function configuration() {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32 || !/^\d{6,12}$/.test(process.env.ADMIN_PIN || '')) fail(503, 'Сервер баптаулары толық емес.');
}
function cookie(req, name) { return (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length + 1); }
function setCookie(res, req, name, value, age) {
  const secure = req.headers['x-forwarded-proto'] === 'https';
  const values = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...(Array.isArray(values) ? values : [values]), `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`]);
}
function session(state, req, kind) {
  const value = cookie(req, kind === 'admin' ? 'niyet_admin' : 'niyet_member');
  const s = value && state.sessions.find(s => s.tokenHash === hash(value) && s.kind === kind && s.expiresAt > Date.now());
  if (!s) return null;
  return kind === 'admin' ? s : state.members.find(m => m.id === s.memberId);
}
function requireAdmin(state, req) { if (!session(state, req, 'admin')) fail(401, 'Әкімші ретінде кір.'); }
function requireMember(state, req) { const member = session(state, req, 'member'); if (!member) fail(401, 'Тобыңа жеке шақыру сілтемесі арқылы кір.'); return member; }
function newSession(state, kind, memberId) {
  const raw = token(), age = kind === 'admin' ? 8 * 3600 : 120 * 86400;
  state.sessions.push({ tokenHash: hash(raw), kind, memberId, expiresAt: Date.now() + age * 1000 });
  state.sessions = state.sessions.filter(s => s.expiresAt > Date.now()); return { raw, age };
}
function text(value, max, label) { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, label); return value.trim(); }
function weekValue(url) { const v = url.searchParams.get('week') || monday(); if (!validDate(v) || monday(v) !== v || v > monday()) fail(400, 'Апта дұрыс таңдалмаған.'); return v; }
function rateLimit(state, req, bucket, max = 40) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || 'local';
  const key = hash(bucket + ':' + ip), now = Date.now(); let item = state.attempts[key];
  if (!item || item.until < now) item = state.attempts[key] = { count: 0, until: now + 15 * 60000 };
  if (item.count >= max) return false;
  item.count++;
  for (const [k, v] of Object.entries(state.attempts)) if (v.until < now) delete state.attempts[k];
  return true;
}
async function body(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 32768) fail(413, 'Жазба тым үлкен.'); }
  try { return raw ? JSON.parse(raw) : {}; } catch { fail(400, 'Сұрау дұрыс емес.'); }
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    configuration();
    const url = new URL(req.url, 'http://local'); const path = ('/' + (url.searchParams.get('route') || url.pathname.replace(/^\/api\/?/, ''))).replace(/\/$/, '') || '/';
    const method = req.method || 'GET';
    if (!['GET', 'POST', 'PUT'].includes(method)) fail(405, 'Бұл әрекет қолжетімсіз.');
    if (method !== 'GET') {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) fail(403, 'Сұрау қабылданбады.');
      if (!(req.headers['content-type'] || '').startsWith('application/json')) fail(415, 'JSON сұрауы қажет.');
    }
    const input = method === 'GET' ? {} : await body(req);
    const result = await update(async state => {
      if (path === '/session' && method === 'GET') {
        const member = session(state, req, 'member'), group = member && state.groups.find(g => g.id === member.groupId);
        return { today: today(), week: monday(), admin: Boolean(session(state, req, 'admin')), member: member ? { id: member.id, name: member.name } : null, group: group ? { id: group.id, name: group.name } : null };
      }
      if (path === '/invite' && method === 'GET') {
        const g = state.groups.find(g => g.inviteHash && g.inviteHash === hash(url.searchParams.get('token') || ''));
        if (!g) fail(404, 'Шақыру сілтемесі жарамсыз немесе жаңартылған.');
        return { name: g.name, existingMember: session(state, req, 'member')?.groupId === g.id };
      }
      if (path === '/join' && method === 'POST') {
        if (!rateLimit(state, req, 'join', 15)) return { _error: 429, message: 'Біраз уақыттан кейін қайталап көр.' };
        const g = state.groups.find(g => g.inviteHash && g.inviteHash === hash(input.token || ''));
        if (!g) fail(404, 'Шақыру сілтемесі жарамсыз.');
        const existing = session(state, req, 'member');
        if (existing?.groupId === g.id) return { joined: true };
        const name = text(input.name, 40, 'Атыңды енгіз (40 таңбаға дейін).');
        if (state.members.some(m => m.groupId === g.id && m.name.toLocaleLowerCase('kk') === name.toLocaleLowerCase('kk'))) fail(409, 'Бұл ат топта бар. Атыңа тегіңді немесе басқа белгі қос.');
        const member = { id: id(), groupId: g.id, name, joinedAt: Date.now() }; state.members.push(member);
        const s = newSession(state, 'member', member.id); setCookie(res, req, 'niyet_member', s.raw, s.age); return { joined: true };
      }
      if (path === '/tracker' && method === 'GET') {
        const m = requireMember(state, req), week = weekValue(url), end = addDays(week, 7), group = state.groups.find(g => g.id === m.groupId);
        const date = url.searchParams.get('date') || today();
        if (!validDate(date)) fail(400, 'Күн дұрыс емес.');
        return { today: today(), week, member: { id: m.id, name: m.name }, group: { name: group.name, memberCount: state.members.filter(x => x.groupId === group.id).length },
          activities: state.activities.filter(a => a.activeFrom <= date).map(a => ({ id: a.id, title: a.title, unit: a.unit, points: rateAt(a, date) })),
          entry: state.entries.find(e => e.memberId === m.id && e.date === date) || null,
          weekEntries: state.entries.filter(e => e.memberId === m.id && e.date >= week && e.date < end), ranking: ranking(state, m.groupId, week) };
      }
      if (path === '/entry' && method === 'PUT') {
        const m = requireMember(state, req), date = input.date;
        if (!validDate(date) || date < monday() || date > today()) fail(400, 'Тек осы аптаның өткен күндерін өзгертуге болады.');
        const old = state.entries.find(e => e.memberId === m.id && e.date === date);
        let entry; try { entry = calculateEntry(state, m, date, input.values, old); } catch (e) { fail(400, e.message); }
        const index = state.entries.findIndex(e => e.id === entry.id); if (index < 0) state.entries.push(entry); else state.entries[index] = entry;
        return { entry };
      }
      if (path === '/admin/login' && method === 'POST') {
        if (!rateLimit(state, req, 'pin', 5)) return { _error: 429, message: 'Тым көп әрекет. 15 минуттан кейін қайтала.' };
        const expected = Buffer.from(hash(process.env.AUTH_SECRET + ':' + process.env.ADMIN_PIN)), actual = Buffer.from(hash(process.env.AUTH_SECRET + ':' + String(input.pin || '')));
        if (!timingSafeEqual(expected, actual)) return { _error: 401, message: 'PIN дұрыс емес.' };
        const s = newSession(state, 'admin', null); setCookie(res, req, 'niyet_admin', s.raw, s.age); return { admin: true };
      }
      if (path === '/admin/logout' && method === 'POST') {
        const raw = cookie(req, 'niyet_admin'); state.sessions = state.sessions.filter(s => s.tokenHash !== hash(raw || ''));
        setCookie(res, req, 'niyet_admin', '', 0); return { loggedOut: true };
      }
      if (path.startsWith('/admin')) {
        requireAdmin(state, req);
        if (path === '/admin' && method === 'GET') {
          const week = weekValue(url);
          return { week, nextWeek: nextMonday(), groups: state.groups.map(g => ({ id: g.id, name: g.name, memberCount: state.members.filter(m => m.groupId === g.id).length, invite: g.inviteEncrypted ? unseal(g.inviteEncrypted) : null, ranking: ranking(state, g.id, week) })),
            activities: state.activities.map(a => ({ id: a.id, title: a.title, unit: a.unit, points: rateAt(a, today()), nextPoints: rateAt(a, nextMonday()) })) };
        }
        if (path === '/admin/invite' && method === 'POST') {
          const g = state.groups.find(g => g.id === input.groupId); if (!g) fail(404, 'Топ табылмады.');
          const raw = token(); g.inviteHash = hash(raw); g.inviteEncrypted = seal(raw); return { invite: raw };
        }
        if (path === '/admin/group' && method === 'PUT') {
          const g = state.groups.find(g => g.id === input.groupId); if (!g) fail(404, 'Топ табылмады.');
          g.name = text(input.name, 50, 'Топ атауын енгіз.'); return { updated: true };
        }
        if (path === '/admin/activity' && method === 'POST') {
          const title = text(input.title, 70, 'Атауды енгіз (70 таңбаға дейін).');
          if (!['pages', 'done'].includes(input.unit) || !Number.isInteger(input.points) || input.points < 0 || input.points > 100000) fail(400, 'Ұпай немесе өлшем дұрыс емес.');
          if (state.activities.some(a => a.title.toLocaleLowerCase('kk') === title.toLocaleLowerCase('kk'))) fail(409, 'Бұл атау бар.');
          state.activities.push({ id: id(), title, unit: input.unit, activeFrom: today(), rules: [{ from: today(), points: input.points }] }); return { added: true };
        }
        if (path === '/admin/rules' && method === 'PUT') {
          if (!input.rates || typeof input.rates !== 'object' || Array.isArray(input.rates)) fail(400, 'Ұпай ережелері дұрыс емес.');
          for (const a of state.activities) {
            const points = input.rates[a.id]; if (!Number.isInteger(points) || points < 0 || points > 100000) fail(400, 'Ұпай бүтін, теріс емес сан болуы керек.');
            if (rateAt(a, nextMonday()) !== points) { a.rules = a.rules.filter(r => r.from !== nextMonday()); a.rules.push({ from: nextMonday(), points }); }
          }
          return { effectiveFrom: nextMonday() };
        }
        if (path === '/admin/comment' && method === 'PUT') {
          const m = state.members.find(m => m.id === input.memberId && m.groupId === input.groupId);
          if (!m || !validDate(input.week) || monday(input.week) !== input.week || input.week > monday()) fail(400, 'Қатысушы немесе апта дұрыс емес.');
          if (typeof input.text !== 'string' || input.text.length > 500) fail(400, 'Пікір 500 таңбадан аспасын.');
          const old = state.comments.find(c => c.memberId === m.id && c.week === input.week);
          const comment = { groupId: m.groupId, memberId: m.id, week: input.week, text: input.text.trim(), updatedAt: Date.now() };
          if (old) Object.assign(old, comment); else state.comments.push(comment); return { saved: true };
        }
      }
      fail(404, 'Бет табылмады.');
    });
    if (result?._error) { res.statusCode = result._error; res.end(JSON.stringify({ error: result.message })); }
    else { res.statusCode = 200; res.end(JSON.stringify(result)); }
  } catch (error) {
    res.statusCode = error.status || 500;
    if (!error.status) console.error('Niyet API:', error.message);
    res.end(JSON.stringify({ error: error.status ? error.message : 'Сақтау мүмкін болмады. Қайта көріңіз.' }));
  }
}
