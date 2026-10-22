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

async function boundedJSON(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_body');
  const chunks = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 512) { await reader.cancel(); throw new Error('body_too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
