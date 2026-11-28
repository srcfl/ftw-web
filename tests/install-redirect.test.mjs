import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import worker from '../_worker.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const installer = 'https://raw.githubusercontent.com/srcfl/ftw/master/scripts/install.sh';
const line = 'curl -fsSL https://ftw.energy/install.sh | bash -s -- --fresh-host';

// The rules in _redirects, as Cloudflare Pages reads them: one per line, "source destination [code]".
function rules() {
  return read('_redirects').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => {
    const [source, destination, code = '302', ...rest] = l.split(/\s+/);
    assert.equal(rest.length, 0, `one rule per line: ${l}`);
    return { source, destination, code: Number(code) };
  });
}

// A _routes.json pattern as a RegExp; "*" matches any characters, slashes included.
const pattern = glob => new RegExp(`^${glob.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);

test('/install.sh sends a 302 to the installer on FTW\'s default branch', () => {
  const rule = rules().find(r => r.source === '/install.sh');
  assert.ok(rule, '_redirects has a rule for /install.sh');
  assert.equal(rule.destination, installer);
  assert.equal(rule.code, 302);
});

test('_worker.js never takes a redirected path, so Pages applies the rule', async () => {
  // Pages skips _redirects for requests that run Functions. _routes.json decides which ones do.
  const { include, exclude } = JSON.parse(read('_routes.json'));
  for (const { source } of rules()) {
    const runsWorker = include.some(g => pattern(g).test(source)) && !exclude.some(g => pattern(g).test(source));
    assert.equal(runsWorker, false, `${source} must stay out of _routes.json "include"`);
    assert.equal(existsSync(new URL(`..${source}`, import.meta.url)), false, `no static file may sit at ${source}`);
  }
  // If the worker ever saw the path, it would hand it to static assets rather than answer itself.
  let handed = null;
  const response = await worker.fetch(new Request('https://ftw.test/install.sh'), { ASSETS: { fetch: request => { handed = new URL(request.url).pathname; return new Response('static'); } } });
  assert.equal(handed, '/install.sh');
  assert.equal(await response.text(), 'static');
});

test('the home page shows the one install line once, and Copy copies exactly that line', () => {
  const page = read('index.html');
  const code = page.match(/<code id="install-line">([\s\S]*?)<\/code>/);
  assert.ok(code, 'the page has the install line');
  assert.equal(code[1].replace(/<[^>]+>/g, ''), line);
  assert.equal(page.match(/id="install-line"/g).length, 1);
  assert.match(page, /<button type="button" class="copy" data-copy="#install-line">Copy<\/button>/);
});

test('the Home Assistant button adds the srcfl/home-assistant-addons repository', () => {
  const page = read('index.html');
  const link = [...page.matchAll(/href="(https:\/\/my\.home-assistant\.io\/[^"]+)"/g)].map(m => new URL(m[1].replaceAll('&amp;', '&')));
  assert.equal(link.length, 1);
  assert.equal(link[0].pathname, '/redirect/supervisor_add_addon_repository/');
  assert.equal(link[0].searchParams.get('repository_url'), 'https://github.com/srcfl/home-assistant-addons');
});

test('the site names the Home Assistant app FTW (beta), as its store does', () => {
  const ha = read('index.html').match(/<article id="home-assistant">([\s\S]*?)<\/article>/);
  assert.ok(ha, 'the page has the Home Assistant path');
  assert.match(ha[1], /<strong>FTW \(beta\)<\/strong>/);
  assert.match(ha[1], /opens inside Home Assistant/);
  for (const page of ['index.html', 'support.html', 'sv/support.html']) {
    assert.doesNotMatch(read(page), /0\.x beta/, `${page} still uses the old app name`);
  }
  for (const page of ['support.html', 'sv/support.html']) {
    assert.match(read(page), /<strong>FTW \(beta\)<\/strong> (in|i) Home Assistant/, `${page} names the app`);
  }
});

test('the Linux path links the short first-install page', () => {
  const linux = read('index.html').match(/<article id="linux">([\s\S]*?)<\/article>/);
  assert.ok(linux, 'the page has the Linux path');
  assert.match(linux[1], /<a href="https:\/\/github\.com\/srcfl\/ftw\/blob\/master\/docs\/install\.md">Step by step<\/a>/);
});

test('the waitlist row asks for a country, optional, from the list the worker accepts', () => {
  const form = read('index.html').match(/<form class="signup[^"]*" data-list="gateway"[\s\S]*?<\/form>/)[0];
  const select = form.match(/<select id="gw-country" name="country">([\s\S]*?)<\/select>/);
  assert.ok(select, 'the waitlist has a country select');
  assert.doesNotMatch(select[0], /required/);
  assert.match(form, /<label[^>]* for="gw-country">/);
  const values = [...select[1].matchAll(/<option value="(\w*)">/g)].map(m => m[1]);
  assert.equal(values[0], '', 'the first choice sends no country');
  const accepted = read('_worker.js').match(/const countries = new Set\(\[([^\]]*)\]\)/)[1].match(/'(\w+)'/g).map(v => v.slice(1, -1));
  assert.deepEqual(values.slice(1).sort(), accepted.sort());
});

test('each sign-up form still has the fields home.js reads', () => {
  const page = read('index.html');
  const forms = [...page.matchAll(/<form class="signup[^"]*" data-list="(\w+)"[\s\S]*?<\/form>/g)];
  assert.deepEqual(forms.map(f => f[1]).sort(), ['gateway', 'news']);
  for (const [form] of forms) {
    assert.match(form, /name="email"/);
    assert.match(form, /name="website"/);
    assert.match(form, /class="form-status"/);
  }
});
