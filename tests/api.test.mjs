import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import handler from '../lib/api.mjs';
import { today, monday, nextMonday, initialState, calculateEntry, rateAt } from '../lib/domain.mjs';

function client() {
  let cookie = '';
  return async (path, method = 'GET', body) => {
    const headers = {};
    const req = { url: '/api/' + path, method, headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) }, body, socket: { remoteAddress: '127.0.0.1' } };
    const res = { statusCode: 200, headers, setHeader(name, value) { headers[name] = value; }, getHeader(name) { return headers[name]; }, end(value) { this.body = value; } };
    await handler(req, res);
    const setCookie = headers['Set-Cookie'];
    if (setCookie) cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie).split(';')[0];
    return { status: res.statusCode, data: JSON.parse(res.body) };
  };
}

test('private groups, server scoring, repeat saves and admin rules', async t => {
  process.env.AUTH_SECRET = 'test-only-secret-abcdefghijklmnopqrstuvwxyz';
  process.env.ADMIN_PIN = '123456';
  const folder = await mkdtemp(join(tmpdir(), 'niyet-test-'));
  process.env.NIYET_DATA_DIR = folder;
  t.after(() => rm(folder, { recursive: true, force: true }));

  const anon = client(), owner = client(), a = client(), b = client();
  assert.equal((await anon('admin')).status, 401);
  assert.equal((await anon('tracker')).status, 401);
  assert.equal((await owner('admin/login', 'POST', { pin: '000000' })).status, 401);
  assert.equal((await owner('admin/login', 'POST', { pin: '123456' })).status, 200);

  const dashboard = (await owner('admin')).data;
  assert.equal(dashboard.groups.length, 2);
  const [g1, g2] = dashboard.groups;
  const i1 = (await owner('admin/invite', 'POST', { groupId: g1.id })).data.invite;
  const i2 = (await owner('admin/invite', 'POST', { groupId: g2.id })).data.invite;
  assert.deepEqual(Object.keys((await anon('invite?token=' + i1)).data).sort(), ['existingMember', 'name']);
  await a('join', 'POST', { token: i1, name: 'Айдос' });
  await b('join', 'POST', { token: i2, name: 'Әли' });

  const values = { quran: 3, tafsir: 2, book: 6, tahajjud: 1, duha: 1, awabeen: 1, fasting: 1 };
  const save = await a('entry', 'PUT', { date: today(), values, score: 999999 });
  assert.equal(save.data.entry.score, 4680);
  const repeat = await a('entry', 'PUT', { date: today(), values });
  assert.equal(repeat.data.entry.id, save.data.entry.id);
  const view = (await a('tracker')).data;
  assert.equal(view.weekEntries.length, 1);
  assert.equal(view.ranking.length, 1);
  assert.equal(view.ranking[0].name, 'Айдос');
  assert.equal(view.ranking[0].score, 4680);
  assert.equal((await b('tracker')).data.ranking[0].score, 0);
  assert.equal((await a('admin')).status, 401);
  assert.equal((await a('entry', 'PUT', { date: today(), values: { quran: -1 } })).status, 400);
  assert.equal((await a('entry', 'PUT', { date: today(), values: { duha: 2 } })).status, 400);

  const rates = Object.fromEntries(dashboard.activities.map(x => [x.id, x.points]));
  rates.quran = 200;
  assert.equal((await owner('admin/rules', 'PUT', { rates })).data.effectiveFrom, nextMonday());
  assert.equal((await a('tracker')).data.activities.find(x => x.id === 'quran').points, 100);
  assert.equal((await owner('admin')).data.activities.find(x => x.id === 'quran').nextPoints, 200);
  await owner('admin/comment', 'PUT', { groupId: g1.id, memberId: view.member.id, week: monday(), text: 'Жарайсың!' });
  assert.equal((await a('tracker')).data.ranking[0].comment, 'Жарайсың!');
  assert.equal((await b('tracker')).data.ranking[0].comment, '');
  await owner('admin/invite', 'POST', { groupId: g1.id });
  assert.equal((await anon('invite?token=' + i1)).status, 404);
  assert.equal((await a('tracker')).status, 200);
});

test('historical score snapshots and future rules', () => {
  const state = initialState(), activity = state.activities[0];
  activity.rules.push({ from: nextMonday(), points: 200 });
  assert.equal(rateAt(activity, today()), 100);
  assert.equal(rateAt(activity, nextMonday()), 200);
  const member = { id: 'm', groupId: 'g' }, entry = calculateEntry(state, member, today(), { quran: 2 });
  activity.rules = [{ from: '2000-01-01', points: 900 }];
  assert.equal(calculateEntry(state, member, today(), { quran: 3 }, entry).score, 300);
});
