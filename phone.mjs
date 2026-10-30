// The iPhone app's Now screen, drawn live on the home page with the app's ring (ring.mjs)
// and the simulated home (demo-home.mjs), and the same flow at page scale behind it.
import { drawRing, ringFill, ringStrength, ringEase, waveSpeed, spots, HALF, Follow } from './ring.mjs';
import { reading, nodes, figure, nextHours } from './demo-home.mjs';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const colors = { solar: '#ffe14d', gives: '#ffb000', stores: '#18d9ff', grid: '#ff5fa8', car: '#b69cff' };
// The app's Now in points: the ring's middle, its radius and stroke, the home's circle.
const RING = { cx: 201, cy: 332, r: 84.5, th: 7, hub: 52.5 };
// The ring's canvases cover this band of the screen, in points.
const BAND = { top: 197, height: 270 };
const titles = { solar: 'Solar', battery: 'Battery', grid: 'Grid', car: 'Car' };

const icon = {
  solar: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.6" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7"/></g></svg>',
  battery: '<svg viewBox="0 0 28 24" aria-hidden="true"><rect x="1.5" y="6.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><rect class="soc" x="3.6" y="8.6" width="14" height="6.8" rx="1.4" fill="currentColor"/><path d="M25.5 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 1.5 4.5 13.6h6.6L9.8 22.5l9.7-12.3h-6.7z" fill="currentColor"/></svg>',
  car: '<svg viewBox="0 0 28 24" aria-hidden="true"><path d="M5.6 9.2 7.5 5.2A2.6 2.6 0 0 1 9.8 3.8h8.4a2.6 2.6 0 0 1 2.3 1.4l1.9 4 1.4.4a1.6 1.6 0 0 1 1.2 1.6v6.2a1.4 1.4 0 0 1-1.4 1.4h-.9v1.5a1.5 1.5 0 0 1-3 0v-1.5H8.3v1.5a1.5 1.5 0 0 1-3 0v-1.5h-.9A1.4 1.4 0 0 1 3 17.4v-6.2a1.6 1.6 0 0 1 1.2-1.6z" fill="currentColor"/><path d="m15.4 7.2-4 5.4h3l-.8 4.2 4-5.6h-3z" fill="#02060f"/></svg>',
  chevron: '<svg viewBox="0 0 12 20" aria-hidden="true"><path d="m2.5 2.5 7 7.5-7 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const tabs = [
  ['Now', '<path d="M14 1.5 4.5 13.6h6.6L9.8 22.5l9.7-12.3h-6.7z" fill="currentColor"/>'],
  ['Plan', '<rect x="3" y="4.5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 9.5h18" stroke="currentColor" stroke-width="2"/><g fill="currentColor"><circle cx="8" cy="13.2" r="1.2"/><circle cx="12" cy="13.2" r="1.2"/><circle cx="16" cy="13.2" r="1.2"/><circle cx="8" cy="17" r="1.2"/><circle cx="12" cy="17" r="1.2"/><circle cx="16" cy="17" r="1.2"/></g>'],
  ['History', '<g fill="currentColor"><rect x="3" y="11" width="5" height="10" rx="1.6"/><rect x="9.5" y="7" width="5" height="14" rx="1.6"/><rect x="16" y="3" width="5" height="18" rx="1.6"/></g>'],
  ['Home', '<path d="M12 2.8 2.2 11.2a1 1 0 0 0 .7 1.8H5v7.2A1.3 1.3 0 0 0 6.3 21.5h3.9v-5.8h3.6v5.8h3.9a1.3 1.3 0 0 0 1.3-1.3V13h2.1a1 1 0 0 0 .7-1.8z" fill="currentColor"/>']
];

const node = id => `
  <div class="now-node now-${id}" data-node="${id}">
    <p class="now-title">${id === 'battery' || id === 'car' ? `${titles[id]}${icon[id]}` : `${icon[id]}${titles[id]}`}</p>
    <p class="now-figure"><b>0</b><span>W</span></p>
    <p class="now-word"></p>
  </div>`;

const screen = `
  <div class="status" aria-hidden="true"><span class="clock">03:05</span>
    <svg class="bars" viewBox="0 0 18 12"><g fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></g></svg>
    <svg class="wifi" viewBox="0 0 17 12"><path d="M8.5 2.2c2.6 0 5 1 6.8 2.7l1.3-1.4A11.5 11.5 0 0 0 8.5.3 11.5 11.5 0 0 0 .4 3.5l1.3 1.4A9.6 9.6 0 0 1 8.5 2.2Zm0 3.8c1.6 0 3 .6 4.1 1.6l1.3-1.4a7.8 7.8 0 0 0-10.8 0l1.3 1.4C5.5 6.6 6.9 6 8.5 6Zm0 3.7c.6 0 1.1.2 1.5.6L8.5 12 7 10.3c.4-.4.9-.6 1.5-.6Z" fill="currentColor"/></svg>
    <svg class="cell" viewBox="0 0 28 13"><rect x="0.6" y="0.6" width="23.8" height="11.8" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.2"/><rect x="2.4" y="2.4" width="20.2" height="8.2" rx="2.2" fill="currentColor"/><path d="M26 4.4v4.2a2.2 2.2 0 0 0 0-4.2Z" fill="currentColor" fill-opacity=".45"/></svg>
  </div>
  <div class="now-head"><p class="now-site">Demo home</p><p class="now-state"><i></i>DEMO · SIMULATED HOME</p></div>
  <canvas class="ring-halo"></canvas><canvas class="ring-near"></canvas><canvas class="ring-core"></canvas>
  ${['solar', 'battery', 'grid', 'car'].map(node).join('')}
  <div class="now-hub"><b>0</b><span>W</span><span>Usage</span></div>
  <div class="now-plug">${icon.car}<p><b>Model Y · 80 % by 07:00 on weekdays</b><span class="now-plug-word"></span></p>${icon.chevron}</div>
  <div class="now-next">
    <p class="now-next-head"><span>NEXT 12 H ${icon.chevron}</span><span><b class="now-price">0</b> ÖRE NOW</span></p>
    <div class="now-lane"></div>
    <div class="now-bars"></div>
    <p class="now-axis"></p>
  </div>
  <p class="now-say"></p>
  <nav class="tabbar" aria-hidden="true">${tabs.map(([name, path], i) => `<span${i === 0 ? ' class="on"' : ''}><svg viewBox="0 0 24 24">${path}</svg>${name}</span>`).join('')}</nav>
  <span class="home-bar"></span>`;

// One clock for every phone and every flow behind them, so they show the same reading.
const t0 = performance.now();
const clockNow = () => (performance.now() - t0) / 1000;
const second = t => (still ? 0 : Math.floor(t));
const live = new Set();
let frame = 0;
function loop() {
  frame = 0;
  if (document.hidden || !live.size) return;
  const t = clockNow();
  for (const draw of live) draw(t);
  frame = requestAnimationFrame(loop);
}
const wake = () => { if (!frame) frame = requestAnimationFrame(loop); };
document.addEventListener('visibilitychange', wake);

// Draw only while on screen. Under Reduce Motion, draw once and hold still.
function whileSeen(element, draw) {
  const io = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      if (still) draw(0); else { live.add(draw); wake(); }
    } else live.delete(draw);
  });
  io.observe(element);
}

function sizeCanvas(canvas, width, height, scale) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * scale * dpr);
  canvas.height = Math.round(height * scale * dpr);
  return dpr * scale;
}

// Fill a `.now` slide with the Now screen and keep it live. Returns where its ring's
// middle is, for the flow behind the phone.
export function mountNow(slot) {
  slot.innerHTML = screen;
  slot.classList.add('now');
  const $ = s => slot.querySelector(s);
  const layers = { halo: $('.ring-halo'), near: $('.ring-near'), core: $('.ring-core') };
  const ctx = Object.fromEntries(Object.entries(layers).map(([k, c]) => [k, c.getContext('2d')]));
  const motions = new Map();
  let scale = 0, shown = -1, moment = '';

  const fit = () => {
    const pt = slot.clientWidth / 402;
    if (!pt) return;
    for (const [k, canvas] of Object.entries(layers)) {
      const s = sizeCanvas(canvas, 402, BAND.height, pt);
      ctx[k].setTransform(s, 0, 0, s, 0, -BAND.top * s);
    }
    scale = pt;
    paint(clockNow(), true);
  };

  const text = (n, r) => {
    for (const item of nodes(r)) {
      const box = slot.querySelector(`[data-node="${item.id}"]`);
      const [value, unit] = figure(item.kw);
      box.querySelector('b').textContent = value;
      box.querySelector('.now-figure span').textContent = unit;
      box.querySelector('.now-word').textContent = item.word;
      box.style.setProperty('--tone', colors[item.tone]);
      if (item.id === 'battery') box.querySelector('.soc').setAttribute('width', (14 * r.soc) / 100);
    }
    const [value, unit] = figure(r.use);
    $('.now-hub b').textContent = value;
    $('.now-hub span').textContent = unit;
    $('.now-plug-word').textContent = `${r.carSoc} % · ${r.carWord}`;
    if (r.clock === moment) return;
    moment = r.clock;
    $('.clock').textContent = r.clock;
    $('.now-say').textContent = r.say;
    const next = nextHours(r.hour);
    $('.now-price').textContent = next[0].price;
    const prices = next.map(h => h.price), low = Math.min(...prices), high = Math.max(...prices);
    const sorted = [...prices].sort((a, b) => a - b);
    const level = p => (p <= sorted[3] ? 0 : p <= sorted[7] ? 1 : 2);
    $('.now-bars').innerHTML = next.map(h => `<i class="l${level(h.price)}" style="height:${(16 + (84 * (h.price - low)) / (high - low || 1)).toFixed(1)}%"></i>`).join('');
    // The battery's plan as runs of storing and giving, like the app's lane.
    const runs = [];
    next.forEach((h, i) => {
      const kind = h.battery > 0.05 ? 'stores' : h.battery < -0.05 ? 'gives' : '';
      if (runs.length && runs.at(-1).kind === kind) runs.at(-1).to = i + 1; else runs.push({ kind, from: i, to: i + 1 });
    });
    $('.now-lane').innerHTML = runs.filter(run => run.kind).map(run => `<i class="${run.kind}" style="left:${(run.from / 12) * 100}%;width:calc(${((run.to - run.from) / 12) * 100}% - 3px)"></i>`).join('');
    $('.now-axis').innerHTML = next.map(h => `<span>${h.hour % 3 === 0 ? String(h.hour).padStart(2, '0') : ''}</span>`).join('');
  };

  const paint = (t, force) => {
    if (!scale) return;
    const n = second(t);
    const r = reading(n);
    if (n !== shown || force) { text(n, r); shown = n; }
    for (const c of Object.values(ctx)) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.restore(); }
    const ring = nodes(r).map(item => ({ id: item.id, kw: item.kw, towardHome: item.towardHome, color: colors[item.tone], reading: n * 1000 }));
    drawRing(ctx, RING, ring, motions, t, { still });
  };

  new ResizeObserver(fit).observe(slot);
  whileSeen(slot, paint);
  return slot;
}

// The ring's flow at page scale: thin arcs of light round the phone, one quarter per
// node, running in toward it for power coming into the home and out for power leaving,
// in the node's colour and with the same reading as the phone. Like the ring's own lines
// they keep their angle and span what the arc lights. Nothing runs under Reduce Motion.
export function mountFlow(section, phoneScreen) {
  if (still) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'page-flow';
  canvas.setAttribute('aria-hidden', 'true');
  section.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const gap = 120;
  const state = new Map();
  let box = null, last = 0;

  const fit = () => {
    const w = section.clientWidth, h = section.clientHeight;
    const s = sizeCanvas(canvas, w, h, 1);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const a = section.getBoundingClientRect(), b = phoneScreen.getBoundingClientRect();
    const pt = b.width / 402;
    const cx = b.left - a.left + RING.cx * pt, cy = b.top - a.top + RING.cy * pt;
    const far = Math.max(...[[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
    box = { w, h, cx, cy, from: b.width * 0.62, to: far };
  };

  const paint = t => {
    if (!box) return;
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    const { w, h, cx, cy, from, to } = box;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (const item of nodes(reading(second(t)))) {
      const flowing = Math.abs(item.kw) > 0.042;
      const s = state.get(item.id) ?? state.set(item.id, { on: new Follow(0), fill: new Follow(ringFill(item.kw)), phase: 0 }).get(item.id);
      s.on.step(flowing ? ringStrength(item.kw) : 0, dt, 0.6);
      s.fill.step(ringFill(item.kw), dt, 0.4);
      s.phase = (s.phase + (waveSpeed(item.kw) * 1.4 * dt) / gap) % 1000;
      if (s.on.value < 0.01) continue;
      const mid = (spots[item.id] * Math.PI) / 180, spread = (Math.max(9.5, HALF * s.fill.value) * Math.PI) / 180;
      const color = colors[item.tone];
      for (let d = (s.phase - Math.floor(s.phase)) * gap; d <= to - from; d += gap) {
        const rr = item.towardHome ? to - d : from + d;
        // Brightest near the phone, fading in by it and out toward the page's edges.
        const k = (rr - from) / (to - from);
        const a = 0.34 * s.on.value * Math.min(1, (rr - from) / 160) * (1 - 0.75 * k);
        if (a <= 0.004) continue;
        const g = ctx.createConicGradient(mid - spread, cx, cy);
        const share = (2 * spread) / (2 * Math.PI);
        for (let i = 0; i <= 12; i++) g.addColorStop((i / 12) * share, rgba(color, a * ringEase((i / 12) * 2 - 1, 0)));
        g.addColorStop(Math.min(1, share + 0.001), rgba(color, 0));
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, mid - spread, mid + spread);
        ctx.stroke();
      }
    }
  };

  new ResizeObserver(fit).observe(section);
  whileSeen(section, paint);
}

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(4)})`;
};
