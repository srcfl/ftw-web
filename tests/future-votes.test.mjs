import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import worker from '../_worker.js';
import { concepts } from '../future/catalog.mjs';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../future/schema.sql', import.meta.url), 'utf8'));
  const binding = {
    prepare(sql) {
      return { bind(...params) { return { async all() { return { results: db.prepare(sql).all(...params) }; } }; } };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.all()); db.exec('COMMIT'); return results; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    }
  };
  const env = { FUTURE_DB: binding, ASSETS: { fetch: () => new Response('static') } };
  const call = (method = 'GET', body, cookie = '', extra = {}) => worker.fetch(new Request('https://design.test/future/api/votes', {
    method,
    headers: { Cookie: cookie, Origin: 'https://design.test', 'Content-Type': 'application/json', ...extra },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
  }), env);
  return { db, env, call };
}
const cookie = response => response.headers.get('set-cookie').split(';')[0];

test('votes persist across visitors; a visitor can change and clear a vote', async () => {
  const { db, call } = fixture();
  const initial = await call();
  assert.equal(initial.status, 200);
  const a = cookie(initial);
  const b = cookie(await call());
  assert.notEqual(a, b);
  assert.match(initial.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
  const first = await call('POST', { id: 'community-ring', value: -1 }, a);
  assert.deepEqual((await first.json()).votes['community-ring'], { up: 0, down: 1, mine: -1 });
  await call('POST', { id: 'community-ring', value: 1 }, b);
  assert.deepEqual((await (await call('GET', undefined, a)).json()).votes['community-ring'], { up: 1, down: 1, mine: -1 });
  await call('POST', { id: 'community-ring', value: 1 }, a);
  await call('POST', { id: 'community-ring', value: 1 }, a);
  assert.deepEqual((await (await call('GET', undefined, b)).json()).votes['community-ring'], { up: 2, down: 0, mine: 1 });
  await call('POST', { id: 'community-ring', value: 0 }, a);
  assert.deepEqual((await (await call('GET', undefined, a)).json()).votes['community-ring'], { up: 1, down: 0, mine: 0 });
  db.close();
});

test('the vote endpoint rejects invalid IDs, values, JSON, large bodies and other origins', async () => {
  const { db, call } = fixture();
  const c = cookie(await call());
  for (const body of [{ id: 'not-a-design', value: 1 }, { id: 'robot-b', value: 3 }, { id: 'robot-b', value: '1' }, null, 'bad json', 'x'.repeat(600)]) {
    assert.equal((await call('POST', body, c)).status, 400);
  }
  assert.equal((await call('POST', { id: 'robot-b', value: 1 }, c, { Origin: 'https://other.test' })).status, 403);
  assert.equal((await call('POST', { id: 'robot-b', value: 1 }, c, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await call('DELETE')).status, 405);
  assert.equal(db.prepare('SELECT count(*) AS count FROM future_votes').get().count, 0);
  db.close();
});

test('current release and proposal votes coexist with archived votes across visitors', async () => {
  const { db, call } = fixture();
  const a = cookie(await call());
  const b = cookie(await call());
  await call('POST', { id: 'robot-b', value: 1 }, a);
  await call('POST', { id: 'ftw-050', value: 1 }, a);
  await call('POST', { id: 'v050-soft-orbit', value: -1 }, a);
  await call('POST', { id: 'v050-soft-orbit', value: 1 }, b);
  const snapshot = (await (await call('GET', undefined, b)).json()).votes;
  assert.deepEqual(snapshot['v050-soft-orbit'], { up: 1, down: 1, mine: 1 });
  assert.deepEqual(snapshot['ftw-050'], { up: 1, down: 0, mine: 0 });
  await call('POST', { id: 'v050-soft-orbit', value: 0 }, a);
  await call('POST', { id: 'ftw-050', value: -1 }, a);
  const result = (await (await call('GET', undefined, a)).json()).votes;
  assert.deepEqual(result['v050-soft-orbit'], { up: 1, down: 0, mine: 0 });
  assert.deepEqual(result['ftw-050'], { up: 0, down: 1, mine: -1 });
  assert.deepEqual(result['robot-b'], { up: 1, down: 0, mine: 1 });
  db.close();
});

test('unavailable storage reports failure; unrelated routes keep serving static files', async () => {
  const { db, env } = fixture();
  assert.equal((await worker.fetch(new Request('https://design.test/future/api/votes'), {})).status, 503);
  const response = await worker.fetch(new Request('https://design.test/'), env);
  assert.equal(await response.text(), 'static');
  db.close();
});

test('the catalog has unique stable IDs, named designs and complete local media', () => {
  assert.equal(new Set(concepts.map(c => c.id)).size, concepts.length);
  assert.equal(new Set(concepts.map(c => c.code)).size, concepts.length);
  for (const concept of concepts) {
    assert.ok(concept.name && concept.description);
    for (const media of concept.media) {
      assert.ok(existsSync(new URL('../future/' + media.src, import.meta.url)), media.src);
      assert.ok(existsSync(new URL('../future/' + media.thumb, import.meta.url)), media.thumb);
    }
    if (concept.video) assert.ok(existsSync(new URL('../future/' + concept.video, import.meta.url)), concept.video);
  }
});
