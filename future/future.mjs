import { concepts } from './catalog.mjs?v=fluid-3';
import { families, demoIds, familyFor, hasDemo, kindFor } from './families.mjs?v=fluid-3';

const $ = selector => document.querySelector(selector);
const byId = new Map(concepts.map(c => [c.id, c]));
const params = new URLSearchParams(location.search);
const state = { filter: families.some(f => f.id === params.get('family')) ? params.get('family') : 'all', interactive: params.get('interactive') === '1', search: '', sort: 'curated', votes: {}, ready: false, busy: false, active: null, media: 0, zoom: 1, revision: 0, selected: [] };
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const thumb = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10h4Zm0 0 5-8c2 0 3 1 2 4l-1 4h6a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7"/></svg>';
const down = thumb.replace('<svg ', '<svg style="transform:rotate(180deg)" ');

function voteButtons(c) {
  const v = state.votes[c.id] || { up: 0, down: 0, mine: 0 };
  return `<div class="votes" role="group" aria-label="Vote on ${escape(c.name)}">${[[1, 'up', 'Thumbs up', thumb], [-1, 'down', 'Thumbs down', down]].map(([value, key, label, icon]) => `<button type="button" class="vote" data-vote="${value}" data-id="${c.id}" aria-label="${label}: ${escape(c.name)}" aria-pressed="${v.mine === value}" ${!state.ready || state.busy ? 'disabled' : ''}>${icon}<span>${state.ready ? v[key] : '–'}</span></button>`).join('')}</div>`;
}
function updateUrl({ hash, compare = $('#comparison').open } = {}) {
  const url = new URL(location.href);
  url.searchParams.delete('family'); url.searchParams.delete('interactive'); url.searchParams.delete('compare'); url.searchParams.delete('play');
  if (state.filter !== 'all') url.searchParams.set('family', state.filter);
  if (state.interactive) url.searchParams.set('interactive', '1');
  if (compare && state.selected.length === 2) url.searchParams.set('compare', state.selected.join(','));
  if (state.active && state.media === 'demo') url.searchParams.set('play', '1');
  if (hash !== undefined) url.hash = hash;
  history.replaceState(null, '', url);
}
function visibleConcepts() {
  const filtered = concepts.filter(c => (state.filter === 'all' || familyFor(c.id)?.id === state.filter) && (!state.interactive || hasDemo(c.id)) && normalize(`${c.name} ${c.code} ${c.description} ${familyFor(c.id)?.name}`).includes(normalize(state.search)));
  if (state.sort === 'popular') filtered.sort((a, b) => (state.votes[b.id]?.up || 0) - (state.votes[a.id]?.up || 0));
  if (state.sort === 'mine') filtered.sort((a, b) => Math.abs(state.votes[b.id]?.mine || 0) - Math.abs(state.votes[a.id]?.mine || 0));
  return filtered;
}
function renderFilters() {
  $('#filters').innerHTML = [{ id: 'all', name: 'All designs', ids: concepts }, ...families].map(f => `<button type="button" data-filter="${f.id}" aria-pressed="${state.filter === f.id}">${escape(f.name)} <span>${f.ids.length}</span></button>`).join('');
  const f = families.find(f => f.id === state.filter);
  $('#family-title').textContent = f?.name || 'Explore the directions';
  $('#family-description').textContent = f?.description || 'Six families, from the familiar to the unexpected. Compare app directions, interaction ideas and character studies.';
  $('#interactive-only').checked = state.interactive;
}
function renderBoard() {
  const list = visibleConcepts();
  $('#board').innerHTML = list.map(c => `<article class="concept" id="card-${c.id}">
    <div class="card-top"><span>${c.code} / ${escape(familyFor(c.id).name)}</span><span>${escape(kindFor(c.id))}</span></div>
    <button type="button" class="image-button" data-open="${c.id}" aria-label="Open ${escape(c.name)}"><img src="/future/${c.media[0].thumb}" alt="${escape(c.name)}" width="${c.media[0].width}" height="${c.media[0].height}" loading="lazy" decoding="async">${hasDemo(c.id) ? '<span class="film playable">↗ Interactive</span>' : c.video ? '<span class="film">▶ Motion study</span>' : ''}<span class="expand" aria-hidden="true">⤢</span></button>
    <div class="card-copy"><h2><button type="button" class="title-button" data-open="${c.id}">${escape(c.name)}</button></h2><p>${escape(c.description)}</p></div>
    <div class="card-bottom"><div data-votes="${c.id}">${voteButtons(c)}</div><button type="button" class="open-link" data-open="${c.id}">${hasDemo(c.id) ? 'Try it ↗' : 'Explore ↗'}</button></div>
    <button type="button" class="compare-pick" data-select="${c.id}" aria-label="Compare: ${escape(c.name)}" aria-pressed="${state.selected.includes(c.id)}"><span aria-hidden="true">${state.selected.includes(c.id) ? '✓' : '+'}</span> Compare</button>
  </article>`).join('');
  $('#showing').textContent = `${list.length} of ${concepts.length} designs${state.interactive ? ' · Interactive only' : ''}`;
  $('#empty').hidden = list.length !== 0;
}
function renderVotes() {
  const focused = document.activeElement?.closest('[data-vote]');
  const restore = focused && { parent: focused.closest('[data-votes]'), id: focused.dataset.id, value: focused.dataset.vote };
  document.querySelectorAll('[data-votes]').forEach(el => { el.innerHTML = voteButtons(byId.get(el.dataset.votes)); });
  restore?.parent?.querySelector(`[data-vote="${restore.value}"]`)?.focus({ preventScroll: true });
  if (state.ready) {
    const total = Object.values(state.votes).reduce((sum, v) => sum + v.up + v.down, 0);
    $('#vote-status').classList.remove('error');
    $('#vote-status').textContent = `${total} ${total === 1 ? 'vote' : 'votes'} · No sign-in needed`;
  }
}
function notify(message) {
  $('#toast').textContent = message; $('#toast').hidden = false;
  clearTimeout(notify.timer); notify.timer = setTimeout(() => { $('#toast').hidden = true; }, 4000);
}
async function loadVotes() {
  if (state.busy) return;
  const revision = state.revision;
  try {
    const response = await fetch('/future/api/votes', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('votes_unavailable');
    const data = await response.json();
    if (state.busy || state.revision !== revision) return;
    state.votes = data.votes; state.ready = true; renderVotes();
  } catch {
    if (!state.ready) { $('#vote-status').textContent = 'Voting is unavailable right now. Trying again.'; $('#vote-status').classList.add('error'); }
  }
}
async function vote(id, value) {
  if (!state.ready || state.busy || !byId.has(id)) return;
  const selected = state.votes[id]?.mine || 0;
  state.busy = true; state.revision++; renderVotes();
  try {
    const response = await fetch('/future/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ id, value: selected === value ? 0 : value }) });
    if (!response.ok) throw new Error('vote_failed');
    state.votes = (await response.json()).votes;
    notify(selected === value ? 'Vote removed.' : 'Thanks! Your vote has been saved.');
  } catch { notify('Your vote could not be saved. Please try again.'); }
  finally {
    state.busy = false; renderVotes(); if (state.sort !== 'curated') renderBoard();
    const scope = $('#comparison').open ? $('#comparison') : $('#viewer').open ? $('#viewer') : document;
    scope.querySelector(`[data-id="${id}"][data-vote="${value}"]`)?.focus({ preventScroll: true });
  }
}
function showMedia(index, syncUrl = true) {
  const c = byId.get(state.active); if (!c) return;
  state.media = index;
  const stage = $('#media-stage'); stage.querySelector('video')?.pause();
  $('#viewer').classList.toggle('is-demo', index === 'demo');
  if (index === 'demo' && hasDemo(c.id)) {
    stage.innerHTML = `<iframe src="/future/demos/?concept=${c.id}" title="Interactive concept: ${escape(c.name)}" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"></iframe>`;
  } else if (index === c.media.length && c.video) {
    stage.innerHTML = `<video controls playsinline preload="metadata" poster="/future/${c.media[0].src}" aria-label="Motion study: ${escape(c.name)}"><source src="/future/${c.video}" type="video/mp4">Your browser cannot play this video.</video>`;
  } else {
    const m = c.media[index] || c.media[0];
    stage.innerHTML = `<img src="/future/${m.src}" alt="${escape(c.name + (m.caption ? ' · ' + m.caption : ''))}" width="${m.width}" height="${m.height}">`;
  }
  $('#media-options').innerHTML = (hasDemo(c.id) ? `<button class="media-option demo-option" type="button" data-media="demo" aria-pressed="${index === 'demo'}">↗ Try it</button>` : '') + (c.media.length > 1 || c.video || hasDemo(c.id) ? c.media.map((m, i) => `<button class="media-option" type="button" data-media="${i}" aria-pressed="${index === i}" aria-label="${escape(m.caption || 'Image ' + (i + 1))}"><img src="/future/${m.thumb}" alt="" width="60" height="50"></button>`).join('') + (c.video ? `<button class="media-option film-option" type="button" data-media="${c.media.length}" aria-pressed="${index === c.media.length}">▶ Video</button>` : '') : '');
  $('#viewer-note').textContent = index === 'demo' && c.id === 'robot-b' ? 'An interactive character study. Drag or flick the robot, try Float, Follow and Rest, or use the arrow keys to give it a nudge.' : index === 'demo' && c.id === 'study-08' ? 'An interactive storage study. Drag the battery level to fill or drain, then try solar and evening power. Example data only.' : index === 'demo' ? 'An interactive interpretation of this direction. Example data only. Try the scenarios, scrub the graph and tap a device. Drag a field to change the example balance. The surfaces and streams move together. Try the robot too; it follows you into the details.' : c.note;
  if (syncUrl) updateUrl();
}
let returnFocus, compareFocus;
function openConcept(id, update = true, play = hasDemo(id)) {
  const c = byId.get(id); if (!c) return;
  const fromComparison = $('#comparison').open;
  if (fromComparison) $('#comparison').close();
  const viewer = $('#viewer'); if (!viewer.open) returnFocus = fromComparison ? compareFocus : document.activeElement;
  state.active = id;
  $('#viewer-code').textContent = `${c.code} / FTW future`;
  $('#viewer-tag').textContent = `${familyFor(id).name} · ${kindFor(id)}`;
  $('#viewer-title').textContent = c.name; $('#viewer-description').textContent = c.description;
  $('#viewer-votes').dataset.votes = id; $('#viewer-votes').innerHTML = voteButtons(c);
  $('#viewer-compare').dataset.select = id;
  $('#viewer-compare').setAttribute('aria-pressed', state.selected.includes(id));
  $('#viewer-compare').textContent = state.selected.includes(id) ? 'Remove from comparison' : 'Add to comparison';
  showMedia(play && hasDemo(id) ? 'demo' : 0, false);
  if (!viewer.open) { viewer.showModal(); document.body.style.overflow = 'hidden'; }
  if (update) updateUrl({ hash: id, compare: false });
  $('#close-viewer').focus({ preventScroll: true });
}
function navigateConcept(direction) {
  const list = visibleConcepts(), index = list.findIndex(c => c.id === state.active);
  if (list.length) openConcept(list[(index + direction + list.length) % list.length].id);
}
function renderSelection() {
  document.querySelectorAll('[data-select]').forEach(b => { const selected = state.selected.includes(b.dataset.select); b.setAttribute('aria-pressed', selected); if (b.classList.contains('compare-pick')) b.innerHTML = `<span aria-hidden="true">${selected ? '✓' : '+'}</span> Compare`; else b.textContent = selected ? 'Remove from comparison' : 'Add to comparison'; });
  $('#compare-tray').hidden = !state.selected.length;
  $('#compare-names').textContent = state.selected.map(id => byId.get(id).name).join(' + ');
  $('#compare-count').textContent = `${state.selected.length}/2 selected`;
  $('#open-comparison').disabled = state.selected.length !== 2;
  $('#open-comparison').textContent = state.selected.length === 2 ? 'Compare designs ↗' : 'Choose one more';
}
function toggleSelection(id) {
  if (!byId.has(id)) return;
  if (state.selected.includes(id)) state.selected = state.selected.filter(x => x !== id);
  else if (state.selected.length < 2) state.selected.push(id);
  else { notify('Two designs are selected. Clear the selection to choose another pair.'); return; }
  renderSelection();
}
function openComparison(sync = true) {
  if (state.selected.length !== 2) return;
  compareFocus = document.activeElement;
  $('#comparison-grid').innerHTML = state.selected.map(id => { const c = byId.get(id); return `<article class="comparison-card"><p class="eyebrow">${c.code} / ${escape(familyFor(id).name)}</p><h3>${escape(c.name)}</h3><p>${escape(c.description)}</p><button class="comparison-image" type="button" data-open="${id}" aria-label="Explore ${escape(c.name)}"><img src="/future/${c.media[0].src}" alt="${escape(c.name)}" width="${c.media[0].width}" height="${c.media[0].height}"></button><div class="comparison-actions"><div data-votes="${id}">${voteButtons(c)}</div><button class="button" type="button" data-open="${id}">${hasDemo(id) ? 'Try it ↗' : 'Explore ↗'}</button></div></article>`; }).join('');
  if (!$('#comparison').open) $('#comparison').showModal();
  document.body.style.overflow = 'hidden'; if (sync) updateUrl({ hash: 'canvas', compare: true });
  $('#close-comparison').focus();
}
async function share(id = '', comparison = false) {
  const url = new URL(location.href); url.hash = id || 'canvas';
  if (!comparison) url.searchParams.delete('compare');
  if (!id) url.searchParams.delete('play');
  try {
    if (navigator.share) await navigator.share({ title: id ? byId.get(id).name + ' · FTW future' : comparison ? 'Compare two directions · FTW future' : 'The future of FTW', url: url.href });
    else { await navigator.clipboard.writeText(url.href); notify('Link copied.'); }
  } catch (error) { if (error.name !== 'AbortError') notify('Copy the browser address to share this view.'); }
}
document.addEventListener('click', event => {
  const voteButton = event.target.closest('[data-vote]'); if (voteButton) { void vote(voteButton.dataset.id, Number(voteButton.dataset.vote)); return; }
  const selection = event.target.closest('[data-select]'); if (selection) { toggleSelection(selection.dataset.select); return; }
  const open = event.target.closest('[data-open]'); if (open) { openConcept(open.dataset.open); return; }
  const filter = event.target.closest('[data-filter]');
  if (filter) { state.filter = filter.dataset.filter; renderFilters(); renderBoard(); updateUrl(); return; }
  const media = event.target.closest('[data-media]'); if (media) showMedia(media.dataset.media === 'demo' ? 'demo' : Number(media.dataset.media));
});
$('#interactive-only').addEventListener('change', e => { state.interactive = e.target.checked; renderBoard(); updateUrl(); });
$('#search').addEventListener('input', e => { state.search = e.target.value; renderBoard(); });
$('#sort').addEventListener('change', e => { state.sort = e.target.value; renderBoard(); });
$('#close-viewer').addEventListener('click', () => $('#viewer').close());
$('#previous').addEventListener('click', () => navigateConcept(-1)); $('#next').addEventListener('click', () => navigateConcept(1));
$('#viewer').addEventListener('click', e => { if (e.target === $('#viewer')) $('#viewer').close(); });
$('#viewer').addEventListener('close', () => {
  $('#media-stage video')?.pause(); $('#media-stage').replaceChildren(); state.active = null;
  delete $('#viewer-votes').dataset.votes;
  document.body.style.overflow = $('#comparison').open ? 'hidden' : ''; updateUrl({ hash: 'canvas' }); returnFocus?.focus({ preventScroll: true });
});
$('#viewer').addEventListener('keydown', e => {
  if (e.target.closest('video,iframe,input,select,button')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); navigateConcept(e.key === 'ArrowLeft' ? -1 : 1); }
});
$('#open-comparison').addEventListener('click', () => openComparison());
$('#clear-comparison').addEventListener('click', () => { state.selected = []; renderSelection(); updateUrl(); });
$('#close-comparison').addEventListener('click', () => $('#comparison').close());
$('#comparison').addEventListener('click', e => { if (e.target === $('#comparison')) $('#comparison').close(); });
$('#comparison').addEventListener('close', () => { document.body.style.overflow = $('#viewer').open ? 'hidden' : ''; updateUrl(); if (!$('#viewer').open) compareFocus?.focus({ preventScroll: true }); });
$('.share-board').addEventListener('click', () => { void share(); });
$('#share-concept').addEventListener('click', () => { void share(state.active); });
$('#share-comparison').addEventListener('click', () => { void share('', true); });
function zoom(delta) {
  state.zoom = Math.max(.7, Math.min(1.6, Math.round((state.zoom + delta) * 10) / 10));
  document.documentElement.style.setProperty('--card-width', `${360 * state.zoom}px`);
  $('#zoom-label').textContent = `${Math.round(state.zoom * 100)} %`; $('#zoom-out').disabled = state.zoom <= .7; $('#zoom-in').disabled = state.zoom >= 1.6;
}
$('#zoom-out').addEventListener('click', () => zoom(-.1)); $('#zoom-in').addEventListener('click', () => zoom(.1));
function openHash() {
  const id = location.hash.slice(1);
  if (byId.has(id)) openConcept(id, false, new URLSearchParams(location.search).get('play') === '1' || hasDemo(id));
  else if ($('#viewer').open) $('#viewer').close();
}
window.addEventListener('hashchange', openHash);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void loadVotes(); else $('#media-stage video')?.pause(); });
$('#proposal-count').textContent = concepts.length;
$('#interactive-count').textContent = demoIds.length;
renderFilters(); renderBoard(); renderSelection();
const comparisonIds = [...new Set((params.get('compare') || '').split(','))].filter(id => byId.has(id));
if (comparisonIds.length === 2) { state.selected = comparisonIds; renderSelection(); openComparison(false); } else openHash();
void loadVotes(); setInterval(() => { if (!document.hidden) void loadVotes(); }, 30000);
