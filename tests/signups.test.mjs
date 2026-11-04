import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';

function fixture({ bound = true, fails = null } = {}) {
  // Stands in for Utskick's subscribe() on the UTSKICK service binding: one row per list, as Utskick keeps them.
  // `calls` keeps every argument the site sent; `fails` makes it throw as Utskick does, e.g. 'rate_limited'.
  const lists = new Map();
  const calls = [];
  const utskick = {
    async subscribe(signup) {
      calls.push(signup);
      if (fails) throw new Error(fails);
      const { email, list, country, consent } = signup;
      const key = `${email} ${list}`;
      lists.set(key, { email, list, country: country ?? lists.get(key)?.country ?? null, consent });
      return { ok: true };
    }
  };
  const env = { ASSETS: { fetch: () => new Response('static') }, ...(bound ? { UTSKICK: utskick } : {}) };
  const call = (body, { method = 'POST', origin = 'https://ftw.test', type = 'application/json', ip } = {}) => worker.fetch(new Request('https://ftw.test/api/signup', {
    method,
    headers: { Origin: origin, 'Content-Type': type, ...(ip ? { 'CF-Connecting-IP': ip } : {}) },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
  }), env);
  const rows = () => [...lists.values()].sort((a, b) => a.list.localeCompare(b.list) || a.email.localeCompare(b.email));
  return { call, rows, calls };
}

test('a sign-up stores a normalized address on its list with the consent it was given', async () => {
  const { call, rows } = fixture();
  const response = await call({ email: '  Fredrik@Example.COM ', list: 'gateway', country: 'SE' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(rows(), [{ email: 'fredrik@example.com', list: 'ftw-box', country: 'SE', consent: 'gateway-2026-10-30' }]);
});

test('the same address can join both lists, and joining again neither duplicates nor reveals it', async () => {
  const { call, rows } = fixture();
  await call({ email: 'a@example.com', list: 'news' });
  await call({ email: 'a@example.com', list: 'gateway', country: 'NO' });
  const again = await call({ email: 'A@example.com', list: 'gateway' });
  assert.deepEqual(await again.json(), { ok: true });
  assert.deepEqual(rows(), [
    { email: 'a@example.com', list: 'ftw-box', country: 'NO', consent: 'gateway-2026-10-30' },
    { email: 'a@example.com', list: 'ftw-news', country: null, consent: 'news-2026-10-30' }
  ]);
});

test('Utskick gets the site as source and the visitor\'s IP address, so it limits sign-ups per visitor', async () => {
  const { call, calls } = fixture();
  await call({ email: 'a@example.com', list: 'news', country: 'FI' }, { ip: '203.0.113.7' });
  await call({ email: 'b@example.com', list: 'gateway' });
  assert.deepEqual(calls, [
    { email: 'a@example.com', list: 'ftw-news', country: 'FI', consent: 'news-2026-10-30', source: 'ftw-web', ip: '203.0.113.7' },
    // Without the header (never the case behind Cloudflare), Utskick limits the whole site instead.
    { email: 'b@example.com', list: 'ftw-box', country: null, consent: 'gateway-2026-10-30', source: 'ftw-web', ip: null }
  ]);
});

test('when Utskick refuses or fails, the endpoint says sign-up is unavailable and claims nothing', async () => {
  for (const code of ['rate_limited', 'invalid_consent']) {
    const { call, rows } = fixture({ fails: code });
    const response = await call({ email: 'a@example.com', list: 'news' }, { ip: '203.0.113.7' });
    assert.equal(response.status, 503, code);
    assert.deepEqual(await response.json(), { error: 'signup_unavailable' });
    assert.deepEqual(rows(), []);
  }
});

test('bad input is refused and stores nothing', async () => {
  const { call, rows } = fixture();
  const cases = [
    [{ email: 'not-an-address', list: 'news' }, 'invalid_email'],
    [{ email: `${'a'.repeat(250)}@example.com`, list: 'news' }, 'invalid_email'],
    [{ email: 'a@example.com', list: 'everything' }, 'invalid_list'],
    [{ email: 'a@example.com', list: 'toString' }, 'invalid_list'],
    [{ email: 'a@example.com', list: 'gateway', country: 'Narnia' }, 'invalid_country'],
    ['{', 'invalid_body'],
    [JSON.stringify({ email: 'a@example.com', list: 'news', pad: 'x'.repeat(1100) }), 'invalid_body']
  ];
  for (const [body, error] of cases) {
    const response = await call(body);
    assert.equal(response.status, 400, error);
    assert.equal((await response.json()).error, error);
  }
  assert.deepEqual(rows(), []);
});

test('only same-origin JSON posts are accepted', async () => {
  const { call, rows } = fixture();
  assert.equal((await call(null, { method: 'GET' })).status, 405);
  assert.equal((await call({ email: 'a@example.com', list: 'news' }, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await call('email=a@example.com&list=news', { type: 'application/x-www-form-urlencoded' })).status, 415);
  assert.deepEqual(rows(), []);
});

test('a filled hidden field looks accepted but stores nothing', async () => {
  const { call, rows } = fixture();
  const response = await call({ email: 'bot@example.com', list: 'news', website: 'https://spam.test' });
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(rows(), []);
});

test('without the Utskick binding the endpoint says sign-up is unavailable and claims nothing', async () => {
  const { call } = fixture({ bound: false });
  const response = await call({ email: 'a@example.com', list: 'news' });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'signup_unavailable' });
});

test('other paths still reach the static site', async () => {
  const env = { ASSETS: { fetch: () => new Response('static') } };
  const response = await worker.fetch(new Request('https://ftw.test/api/other'), env);
  assert.equal(await response.text(), 'static');
});
