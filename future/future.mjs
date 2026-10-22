import { concepts } from './catalog.mjs';

const $ = (selector) => document.querySelector(selector);
const byId = new Map(concepts.map(c => [c.id, c]));
const state = { filter: 'all', search: '', sort: 'curated', votes: {}, ready: false, busy: false, active: null, media: 0, zoom: 1, revision: 0 };
const labels = { today: 'Close to today', flow: 'Flows & motion', robot: 'With a robot', community: 'From you', ring: 'Ring concepts' };
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const thumb = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10h4Zm0 0 5-8c2 0 3 1 2 4l-1 4h6a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7"/></svg>';
const down = thumb.replace('<svg ', '<svg style="transform:rotate(180deg)" ');

function voteButtons(c) {
  const v = state.votes[c.id] || { up: 0, down: 0, mine: 0 };
  return `<div class="votes" role="group" aria-label="Vote on ${escape(c.name)}">${[[1, 'up', 'Thumbs up', thumb], [-1, 'down', 'Thumbs down', down]].map(([value, key, label, icon]) => `<button type="button" class="vote" data-vote="${value}" data-id="${c.id}" aria-label="${label}: ${escape(c.name)}" aria-pressed="${v.mine === value}" ${!state.ready || state.busy ? 'disabled' : ''}>${icon}<span>${state.ready ? v[key] : '–'}</span></button>`).join('')}</div>`;
}

function visibleConcepts() {
  const filtered = concepts.filter(c => (state.filter === 'all' || c.tags.includes(state.filter)) && normalize(`${c.name} ${c.code} ${c.description}`).includes(normalize(state.search)));
  if (state.sort === 'popular') filtered.sort((a, b) => (state.votes[b.id]?.up || 0) - (state.votes[a.id]?.up || 0));
  if (state.sort === 'mine') filtered.sort((a, b) => Math.abs(state.votes[b.id]?.mine || 0) - Math.abs(state.votes[a.id]?.mine || 0));
  return filtered;
}

function renderBoard() {
  const list = visibleConcepts();
  $('#board').innerHTML = list.map(c => `<article class="concept" id="card-${c.id}">
    <div class="card-top"><span>${c.code}</span><span>${escape(labels[c.tags.includes('flow') ? 'flow' : c.tags[0]])}</span></div>
    <button type="button" class="image-button" data-open="${c.id}" aria-label="Open ${escape(c.name)}"><img src="/future/${c.media[0].thumb}" alt="${escape(c.name)}" width="${c.media[0].width}" height="${c.media[0].height}" loading="lazy" decoding="async">${c.video ? '<span class="film">▶ Motion study</span>' : ''}<span class="expand" aria-hidden="true">⤢</span></button>
    <div class="card-copy"><h2><button type="button" class="title-button" data-open="${c.id}">${escape(c.name)}</button></h2><p>${escape(c.description)}</p></div>
    <div class="card-bottom"><div data-votes="${c.id}">${voteButtons(c)}</div><button type="button" class="open-link" data-open="${c.id}">${c.media.length > 1 ? `${c.media.length} images · ` : ''}Open ↗</button></div>
  </article>`).join('');
  $('#showing').textContent = `${list.length} of ${concepts.length} designs`;
  $('#empty').hidden = list.length !== 0;
}

function renderVotes() {
  document.querySelectorAll('[data-votes]').forEach(el => { el.innerHTML = voteButtons(byId.get(el.dataset.votes)); });
  if (state.active) $('#viewer-votes').innerHTML = voteButtons(byId.get(state.active));
  if (state.ready) {
    const total = Object.values(state.votes).reduce((sum, v) => sum + v.up + v.down, 0);
    $('#vote-status').classList.remove('error');
    $('#vote-status').textContent = `${total} ${total === 1 ? 'vote' : 'votes'} · No sign-in needed`;
  }
}

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { $('#toast').hidden = true; }, 4000);
}

async function loadVotes() {
  if (state.busy) return;
  const revision = state.revision;
  try {
    const response = await fetch('/future/api/votes', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('votes_unavailable');
    const data = await response.json();
    if (state.busy || state.revision !== revision) return;
    state.votes = data.votes;
    state.ready = true;
    renderVotes();
  } catch {
    if (!state.ready) {
      $('#vote-status').textContent = 'Voting is unavailable right now. Trying again.';
      $('#vote-status').classList.add('error');
    }
  }
}

async function vote(id, value) {
  if (!state.ready || state.busy || !byId.has(id)) return;
  const selected = state.votes[id]?.mine || 0;
  state.busy = true;
  state.revision++;
  renderVotes();
  try {
    const response = await fetch('/future/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ id, value: selected === value ? 0 : value }) });
    if (!response.ok) throw new Error('vote_failed');
    state.votes = (await response.json()).votes;
    notify(selected === value ? 'Vote removed.' : 'Thanks! Your vote has been saved.');
  } catch {
    notify('Your vote could not be saved. Please try again.');
  } finally {
    state.busy = false;
    renderVotes();
    if (state.sort !== 'curated') renderBoard();
    const scope = $('#viewer').open ? $('#viewer') : document;
    scope.querySelector(`[data-id="${id}"][data-vote="${value}"]`)?.focus({ preventScroll: true });
  }
}

function showMedia(index) {
  const c = byId.get(state.active);
  if (!c) return;
  state.media = index;
  const stage = $('#media-stage');
  stage.querySelector('video')?.pause();
  if (index === c.media.length && c.video) {
    stage.innerHTML = `<video controls playsinline preload="metadata" poster="/future/${c.media[0].src}" aria-label="Motion study: ${escape(c.name)}"><source src="/future/${c.video}" type="video/mp4">Your browser cannot play this video.</video>`;
  } else {
    const m = c.media[index];
    stage.innerHTML = `<img src="/future/${m.src}" alt="${escape(c.name + (m.caption ? ' · ' + m.caption : ''))}" width="${m.width}" height="${m.height}">`;
  }
  $('#media-options').innerHTML = c.media.length > 1 || c.video ? c.media.map((m, i) => `<button class="media-option" type="button" data-media="${i}" aria-pressed="${index === i}" aria-label="${escape(m.caption || 'Image ' + (i + 1))}"><img src="/future/${m.thumb}" alt="" width="60" height="50"></button>`).join('') + (c.video ? `<button class="media-option film-option" type="button" data-media="${c.media.length}" aria-pressed="${index === c.media.length}">▶ Video</button>` : '') : '';
}

let returnFocus;
function openConcept(id, updateUrl = true) {
  const c = byId.get(id);
  if (!c) return;
  const viewer = $('#viewer');
  if (!viewer.open) returnFocus = document.activeElement;
  state.active = id;
  $('#viewer-code').textContent = `${c.code} / FTW future`;
  $('#viewer-tag').textContent = labels[c.tags.includes('flow') ? 'flow' : c.tags[0]];
  $('#viewer-title').textContent = c.name;
  $('#viewer-description').textContent = c.description;
  $('#viewer-note').textContent = c.note;
  $('#viewer-votes').innerHTML = voteButtons(c);
  showMedia(0);
  if (!viewer.open) { viewer.showModal(); document.body.style.overflow = 'hidden'; }
  if (updateUrl) history.replaceState(null, '', `#${id}`);
  $('#close-viewer').focus({ preventScroll: true });
}

function closeViewer() {
  $('#viewer').close();
}

function navigateConcept(direction) {
  const list = visibleConcepts();
  const index = list.findIndex(c => c.id === state.active);
  if (!list.length) return;
  openConcept(list[(index + direction + list.length) % list.length].id);
}

async function share(id = '') {
  const url = new URL('/future/', location.origin);
  if (id) url.hash = id;
  try {
    if (navigator.share) await navigator.share({ title: id ? byId.get(id).name + ' · FTW future' : 'The future of FTW', url: url.href });
    else { await navigator.clipboard.writeText(url.href); notify('Link copied.'); }
  } catch (error) {
    if (error.name !== 'AbortError') notify('Copy the browser address to share this design.');
  }
}

document.addEventListener('click', event => {
  const voteButton = event.target.closest('[data-vote]');
  if (voteButton) { void vote(voteButton.dataset.id, Number(voteButton.dataset.vote)); return; }
  const open = event.target.closest('[data-open]');
  if (open) openConcept(open.dataset.open);
  const filter = event.target.closest('[data-filter]');
  if (filter) {
    state.filter = filter.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', button === filter));
    renderBoard();
  }
  const media = event.target.closest('[data-media]');
  if (media) showMedia(Number(media.dataset.media));
});
$('#search').addEventListener('input', event => { state.search = event.target.value; renderBoard(); });
$('#sort').addEventListener('change', event => { state.sort = event.target.value; renderBoard(); });
$('#close-viewer').addEventListener('click', closeViewer);
$('#previous').addEventListener('click', () => navigateConcept(-1));
$('#next').addEventListener('click', () => navigateConcept(1));
$('#viewer').addEventListener('click', event => { if (event.target === $('#viewer')) closeViewer(); });
$('#viewer').addEventListener('close', () => {
  $('#media-stage video')?.pause();
  state.active = null;
  document.body.style.overflow = '';
  history.replaceState(null, '', '#canvas');
  returnFocus?.focus({ preventScroll: true });
});
$('#viewer').addEventListener('keydown', event => {
  if (event.target.closest('video')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); navigateConcept(event.key === 'ArrowLeft' ? -1 : 1); }
});
$('.share-board').addEventListener('click', () => { void share(); });
$('#share-concept').addEventListener('click', () => { void share(state.active); });
function zoom(delta) {
  state.zoom = Math.max(.7, Math.min(1.6, Math.round((state.zoom + delta) * 10) / 10));
  document.documentElement.style.setProperty('--card-width', `${360 * state.zoom}px`);
  $('#zoom-label').textContent = `${Math.round(state.zoom * 100)} %`;
  $('#zoom-out').disabled = state.zoom <= .7;
  $('#zoom-in').disabled = state.zoom >= 1.6;
}
$('#zoom-out').addEventListener('click', () => zoom(-.1));
$('#zoom-in').addEventListener('click', () => zoom(.1));
function openHash() {
  const id = location.hash.slice(1);
  if (byId.has(id)) openConcept(id, false);
  else if ($('#viewer').open) closeViewer();
}
window.addEventListener('hashchange', openHash);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void loadVotes(); else $('#media-stage video')?.pause(); });
$('#proposal-count').textContent = concepts.length;
$('#all-count').textContent = concepts.length;
renderBoard();
openHash();
void loadVotes();
setInterval(() => { if (!document.hidden) void loadVotes(); }, 30000);
