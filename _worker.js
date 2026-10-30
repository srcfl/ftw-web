import { concepts } from './future/catalog.mjs';

const ids = new Set(concepts.map(c => c.id));
const cookieName = 'ftw_future_voter';
const countsSQL = `SELECT concept_id, SUM(value = 1) AS up, SUM(value = -1) AS down,
  SUM(CASE WHEN voter_id = ? THEN value ELSE 0 END) AS mine
  FROM future_votes GROUP BY concept_id`;

function json(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}

function voter(request) {
  const value = request.headers.get('Cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value) ? value : null;
}

function responseVotes(rows) {
  const votes = Object.fromEntries(concepts.map(c => [c.id, { up: 0, down: 0, mine: 0 }]));
  for (const row of rows) {
    if (ids.has(row.concept_id)) votes[row.concept_id] = { up: row.up, down: row.down, mine: row.mine };
  }
  return { votes };
}

async function boundedJSON(request, limit = 512) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_body');
  const chunks = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new Error('body_too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

// The consent each list records. privacy.html describes both.
const lists = { news: 'news-2026-10-30', gateway: 'gateway-2026-10-30' };
const countries = new Set(['SE', 'NO', 'DK', 'FI', 'DE', 'NL', 'EU', 'XX']);
const emailPattern = /^[^\s@<>()\[\],;:"]+@[^\s@<>()\[\],;:"]+\.[^\s@<>()\[\],;:"]{2,}$/;

const listNames = { news: 'newsletter', gateway: 'FTW box waitlist' };

// Tells the team about a new address on a list, through a Slack or Discord incoming webhook
// (each reads its own field). The notice names the list, the country and the totals,
// never the address, so the address stays in D1 as the privacy notice says.
async function notify(env, list, country) {
  const { results } = await env.SIGNUPS_DB.prepare('SELECT list, COUNT(*) AS n FROM signups GROUP BY list').all();
  const totals = Object.fromEntries(results.map(row => [row.list, row.n]));
  const text = `New sign-up: ${listNames[list]}${country ? ` (${country})` : ''} · Waitlist ${totals.gateway ?? 0} · Newsletter ${totals.news ?? 0}`;
  const response = await fetch(env.SIGNUP_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, content: text })
  });
  if (!response.ok) throw new Error(`webhook_${response.status}`);
}

async function signup(request, env, url, ctx) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  if (request.headers.get('Origin') !== url.origin) return json({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: 'invalid_content_type' }, 415);
  let body;
  try { body = await boundedJSON(request, 1024); }
  catch { return json({ error: 'invalid_body' }, 400); }
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const country = typeof body?.country === 'string' && body.country ? body.country : null;
  if (!Object.hasOwn(lists, body?.list ?? '')) return json({ error: 'invalid_list' }, 400);
  if (email.length > 254 || !emailPattern.test(email)) return json({ error: 'invalid_email' }, 400);
  if (country !== null && !countries.has(country)) return json({ error: 'invalid_country' }, 400);
  // A filled hidden field means a form-filling bot. Answer as if it worked and store nothing.
  if (body.website) return json({ ok: true });
  if (!env.SIGNUPS_DB) return json({ error: 'signup_unavailable' }, 503);
  let added;
  try {
    const insert = await env.SIGNUPS_DB.prepare('INSERT INTO signups (email, list, country, consent) VALUES (?, ?, ?, ?) ON CONFLICT(email, list) DO NOTHING')
      .bind(email, body.list, country, lists[body.list]).run();
    added = insert.meta.changes > 0;
    if (!added) {
      await env.SIGNUPS_DB.prepare('UPDATE signups SET country = COALESCE(?, country), consent = ? WHERE email = ? AND list = ?')
        .bind(country, lists[body.list], email, body.list).run();
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'signup_failed', name: error.name }));
    return json({ error: 'signup_unavailable' }, 503);
  }
  // Only a new address is news. The notice goes out after the answer, so a slow or
  // failing webhook never holds up or breaks the form.
  if (added && env.SIGNUP_WEBHOOK_URL) {
    const notice = notify(env, body.list, country)
      .catch(error => console.error(JSON.stringify({ event: 'signup_notice_failed', message: error.message })));
    if (ctx?.waitUntil) ctx.waitUntil(notice); else await notice;
  }
  // The same answer for a new and a known address, so the form does not reveal who signed up.
  return json({ ok: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.replace(/\/$/, '') === '/api/signup') return signup(request, env, url, ctx);
    if (url.pathname.replace(/\/$/, '') !== '/future/api/votes') return env.ASSETS.fetch(request);
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
    if (!env.FUTURE_DB) return json({ error: 'voting_unavailable' }, 503);
    const existingVoter = voter(request);
    const voterId = existingVoter || crypto.randomUUID();
    const headers = existingVoter ? {} : { 'Set-Cookie': `${cookieName}=${voterId}; Path=/future; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000` };
    try {
      const counts = env.FUTURE_DB.prepare(countsSQL).bind(voterId);
      if (request.method === 'GET') {
        const result = await counts.all();
        return json(responseVotes(result.results), 200, headers);
      }
      if (request.headers.get('Origin') !== url.origin) return json({ error: 'origin_not_allowed' }, 403);
      if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: 'invalid_content_type' }, 415);
      let body;
      try { body = await boundedJSON(request); }
      catch { return json({ error: 'invalid_body' }, 400); }
      if (!body || !ids.has(body.id) || ![-1, 0, 1].includes(body.value)) return json({ error: 'invalid_vote' }, 400);
      const write = body.value === 0
        ? env.FUTURE_DB.prepare('DELETE FROM future_votes WHERE voter_id = ? AND concept_id = ?').bind(voterId, body.id)
        : env.FUTURE_DB.prepare(`INSERT INTO future_votes (voter_id, concept_id, value) VALUES (?, ?, ?)
          ON CONFLICT(voter_id, concept_id) DO UPDATE SET value = excluded.value`).bind(voterId, body.id, body.value);
      const results = await env.FUTURE_DB.batch([write, counts]);
      return json(responseVotes(results[1].results), 200, headers);
    } catch (error) {
      console.error(JSON.stringify({ event: 'future_votes_failed', name: error.name }));
      return json({ error: 'voting_unavailable' }, 503);
    }
  }
};
