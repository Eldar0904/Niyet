import { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv } from 'node:crypto';

export const hash = value => createHash('sha256').update(String(value)).digest('hex');
export const id = () => randomUUID();
export const token = () => randomBytes(24).toString('base64url');
export function seal(value) {
  const key = createHash('sha256').update(process.env.AUTH_SECRET || '').digest();
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(x => x.toString('base64url')).join('.');
}
export function unseal(value) {
  const key = createHash('sha256').update(process.env.AUTH_SECRET || '').digest();
  const [iv, tag, data] = value.split('.').map(x => Buffer.from(x, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
export function today(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Qyzylorda', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(k => p.find(x => x.type === k).value).join('-');
}
export function addDays(date, n) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function monday(date = today()) { const d = new Date(date + 'T12:00:00Z'); return addDays(date, -((d.getUTCDay() + 6) % 7)); }
export function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value; }
export const nextMonday = () => addDays(monday(), 7);
const defaults = [
  ['quran', 'Құран', 'pages', 100], ['tafsir', 'Құран тәпсірі (RNK)', 'pages', 150], ['book', 'Кітап', 'pages', 80],
  ['tahajjud', 'Тәһәжжүд', 'done', 1000], ['duha', 'Дұха', 'done', 800], ['awabeen', 'Әууәбин', 'done', 600], ['fasting', 'Ораза', 'done', 1200]
];
export function initialState() {
  return { schema: 1, groups: ['Достар', 'Оқу тобы'].map(name => ({ id: id(), name, inviteHash: null, inviteEncrypted: null, createdAt: Date.now() })),
    activities: defaults.map(([id, title, unit, points]) => ({ id, title, unit, activeFrom: '2000-01-01', rules: [{ from: '2000-01-01', points }] })),
    members: [], sessions: [], entries: [], comments: [], attempts: {} };
}
export function rateAt(activity, date) {
  return activity.rules.filter(r => r.from <= date).sort((a, b) => b.from.localeCompare(a.from))[0]?.points || 0;
}
export function calculateEntry(state, member, date, values, oldEntry) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Оқылған беттер мен орындалған құлшылықты белгіле.');
  const items = [];
  for (const activity of state.activities.filter(a => a.activeFrom <= date)) {
    const quantity = Number(values[activity.id] || 0);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > (activity.unit === 'done' ? 1 : 10000)) throw new Error('Бет саны бүтін, теріс емес сан болуы керек.');
    const points = oldEntry?.items.find(i => i.activityId === activity.id)?.points ?? rateAt(activity, date);
    items.push({ activityId: activity.id, quantity, points, unit: activity.unit });
  }
  return { id: oldEntry?.id || id(), groupId: member.groupId, memberId: member.id, date, items, score: items.reduce((sum, i) => sum + i.quantity * i.points, 0), updatedAt: Date.now() };
}
export function ranking(state, groupId, week) {
  const end = addDays(week, 7);
  const result = state.members.filter(m => m.groupId === groupId).map(m => ({ id: m.id, name: m.name,
    score: state.entries.filter(e => e.groupId === groupId && e.memberId === m.id && e.date >= week && e.date < end).reduce((a, e) => a + e.score, 0),
    comment: state.comments.find(c => c.groupId === groupId && c.memberId === m.id && c.week === week)?.text || '' }));
  result.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'kk'));
  let previous = null, place = 0;
  return result.map((m, index) => { if (previous !== m.score) place = index + 1; previous = m.score; return { ...m, place }; });
}
