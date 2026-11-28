import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = path => existsSync(new URL(`../${path}`, import.meta.url));
const line = 'curl -fsSL https://ftw.energy/install.sh | bash -s -- --fresh-host';
const startPages = ['start.html', 'sv/start.html'];

// The rules in _redirects: "source destination [code]", one per line.
const redirects = read('_redirects').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  .map(l => { const [source, destination, code = '302'] = l.split(/\s+/); return { source, destination, code: Number(code) }; });

// The page a site path serves on Cloudflare Pages, or null: "/" is index.html, "/x/" is
// x/index.html, and "/x" is x.html or the file x itself.
function served(path) {
  const clean = decodeURIComponent(path).replace(/^\//, '');
  if (clean === '' || clean.endsWith('/')) return exists(`${clean}index.html`) ? `${clean}index.html` : null;
  if (exists(`${clean}.html`)) return `${clean}.html`;
  return exists(clean) ? clean : null;
}
const ids = page => new Set([...read(page).matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));

test('both start pages show the one install line once, with a Copy button for it', () => {
  for (const page of startPages) {
    const html = read(page);
    const code = html.match(/<code id="install-line">([\s\S]*?)<\/code>/);
    assert.ok(code, `${page} has the install line`);
    assert.equal(code[1].replace(/<[^>]+>/g, ''), line, page);
    assert.equal(html.match(/id="install-line"/g).length, 1, page);
    assert.match(html, /<button type="button" class="copy" data-copy="#install-line" hidden>/, page);
  }
});

test('the start pages give the four ways, the needs and the phone, by the ids the home page links', () => {
  for (const page of startPages) {
    for (const id of ['need', 'home-assistant', 'linux', 'box', 'assistant', 'phone']) assert.ok(ids(page).has(id), `${page} has #${id}`);
  }
  const routes = read('index.html').match(/<nav class="wrap routes"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(routes, 'the home page has its row of ways to start');
  const links = [...routes[1].matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.equal(links.length, 4);
  for (const link of links) assert.match(link, /^\/start#/, 'every way in the row leads to the start page');
});

test('the Home Assistant button on the start pages adds the srcfl/home-assistant-addons repository', () => {
  for (const page of startPages) {
    const links = [...read(page).matchAll(/href="(https:\/\/my\.home-assistant\.io\/[^"]+)"/g)].map(m => new URL(m[1].replaceAll('&amp;', '&')));
    assert.equal(links.length, 1, page);
    assert.equal(links[0].pathname, '/redirect/supervisor_add_addon_repository/');
    assert.equal(links[0].searchParams.get('repository_url'), 'https://github.com/srcfl/home-assistant-addons');
    assert.match(read(page), /<strong>FTW \(beta\)<\/strong>/, `${page} names the app as its store does`);
  }
});

test('every page that gives the MCP address gives the home page\'s', () => {
  const address = read('index.html').match(/<code id="mcp-url">([^<]+)<\/code>/)[1];
  for (const page of [...startPages, 'chatgpt.html', 'sv/chatgpt.html']) {
    assert.equal(read(page).match(/<code id="mcp-url">([^<]+)<\/code>/)?.[1], address, page);
  }
});

test('the home page and both start pages state the same count of drivers confirmed on hardware', () => {
  const counts = ['index.html', ...startPages].map(page => {
    const found = [...read(page).matchAll(/<span data-catalog>(\d+) (?:of|av) (\d+)<\/span>/g)].map(m => `${m[1]}/${m[2]}`);
    assert.equal(found.length, 1, `${page} states the count once`);
    return found[0];
  });
  assert.equal(new Set(counts).size, 1, `counts differ: ${counts.join(', ')}`);
  const [confirmed, all] = counts[0].split('/').map(Number);
  assert.ok(confirmed > 0 && confirmed <= all);
});

test('the ChatGPT pages describe the public tools as they are', () => {
  assert.doesNotMatch(read('chatgpt.html'), /development installation|remote setup writes/);
  assert.doesNotMatch(read('sv/chatgpt.html'), /utvecklingsinstallation|rätt att spara installationens inställningar/);
  assert.match(read('chatgpt.html'), /separate setup grant/);
  assert.match(read('sv/chatgpt.html'), /separat behörighet för installation/);
});

test('the assistant steps hold on boxes shipped today, and follow the assistants\' own help pages', () => {
  for (const page of [...startPages, 'chatgpt.html', 'sv/chatgpt.html']) {
    const html = read(page);
    // Settings → Access works on every current box; the first-page choice comes with the next beta.
    assert.ok(html.indexOf('Settings → Access') < html.indexOf('Set up with ChatGPT or Claude instead'), `${page} leads with Settings → Access`);
    assert.match(html, /(next beta|nästa beta)/, `${page} says when the first-page choice arrives`);
    assert.match(html, /Add custom MCP server/, page);
  }
  for (const page of [...startPages, 'chatgpt.html', 'sv/chatgpt.html', 'index.html']) {
    assert.doesNotMatch(read(page), /developer mode|client ID empty|klient-id tomt/, `${page} uses the old steps`);
  }
  for (const page of [...startPages, 'index.html']) assert.match(read(page), /Customize → Connectors/, page);
});

test('/claude sends a 302 to the assistant way on the start page', () => {
  const rule = redirects.find(r => r.source === '/claude');
  assert.ok(rule, '_redirects has a rule for /claude');
  assert.equal(rule.destination, '/start#assistant');
  assert.equal(rule.code, 302);
  assert.ok(ids('start.html').has('assistant'));
});

test('unknown paths get the 404 page, and robots.txt is a static file', () => {
  const page = read('404.html');
  assert.match(page, /<meta name="robots" content="noindex">/);
  assert.match(page, /href="\/"/);
  assert.match(page, /href="\/start"/);
  // Assets must load from any depth, so the 404 page links only absolute paths.
  for (const [, ref] of page.matchAll(/(?:href|src)="([^"]+)"/g)) assert.match(ref, /^(\/|https:|#)/, ref);
  assert.match(read('robots.txt'), /^User-agent: \*$/m);
  const { include } = JSON.parse(read('_routes.json'));
  for (const path of ['/404.html', '/robots.txt', '/start', '/sv/start']) {
    assert.ok(!include.some(glob => new RegExp(`^${glob.replaceAll('*', '.*')}$`).test(path)), `${path} stays static`);
    assert.ok(!redirects.some(r => r.source === path), `no redirect hides ${path}`);
  }
});

test('every internal link on the site\'s pages reaches a page, and its #part exists there', () => {
  const pages = [...readdirSync(new URL('..', import.meta.url)).filter(f => f.endsWith('.html')),
    ...readdirSync(new URL('../sv', import.meta.url)).filter(f => f.endsWith('.html')).map(f => `sv/${f}`)];
  const broken = [];
  for (const page of pages) {
    for (const [, raw] of read(page).matchAll(/(?:href|src)="([^"]+)"/g)) {
      const ref = raw.replaceAll('&amp;', '&');
      if (!ref.startsWith('/') && !ref.startsWith('#')) continue;
      if (ref.startsWith('//')) continue;
      const [path, hash] = ref.split('#');
      const pathOnly = path.split('?')[0];
      const target = pathOnly === '' ? page : served(pathOnly);
      if (!target) {
        if (!redirects.some(r => r.source === pathOnly)) broken.push(`${page}: ${ref}`);
        continue;
      }
      if (hash && target.endsWith('.html') && !ids(target).has(hash)) broken.push(`${page}: ${ref} (no #${hash})`);
    }
  }
  assert.deepEqual(broken, []);
});

test('every Copy button names an element on its page', () => {
  for (const page of [...startPages, 'chatgpt.html', 'sv/chatgpt.html', 'index.html']) {
    const html = read(page);
    for (const [, target] of html.matchAll(/data-copy="#([^"]+)"/g)) assert.ok(ids(page).has(target), `${page}: #${target}`);
    if (page !== 'index.html' && html.includes('class="copy"')) assert.match(html, /<script src="\/copy\.js\?v=\d+" defer><\/script>/, `${page} loads copy.js`);
  }
});
