// The ring on the iPhone app's Now screen, J ("steady flow", srcfl/ftw-app 44efeac),
// for the browser. The rules are the app's (FTWKit Flow.swift: ringFill, ringStrength,
// ringEase, ringSwell, ringLines); the drawing follows FlowDiagram.swift. Each node owns
// the quarter that faces it. Its arc lights from the quarter's middle out, longer with
// more power, and each reading sends one swell along it. Thin lines of light run all the
// time between the arc and the home's circle: in toward the home for power coming into
// it, out for power leaving it.

// At or below this a node is at rest: the box's FLOW_IDLE_W.
export const idleW = 42;
// Points from one line of light to the next.
export const wavelength = 15;
// Each quarter's middle, in canvas degrees (0 is right, clockwise).
export const spots = { solar: 225, battery: 315, grid: 135, car: 45 };
// A quarter is 90° less the gap between quarters, each side of its middle.
export const HALF = (90 - 14) / 2;

const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

// How much of its quarter an arc lights: none at rest, at least a quarter, half at
// 1.8 kW, nine tenths at 6 kW.
export function ringFill(kw) {
  const a = Math.abs(kw);
  if (!Number.isFinite(a) || a * 1000 <= idleW) return 0;
  return Math.min(1, Math.max(0.25, 1 - Math.exp(-a / 2.5)));
}

// How strong an arc's swell and its lines are: 0.65 at a trickle, full from about 4.7 kW.
export function ringStrength(kw) {
  const a = Math.abs(kw);
  if (!Number.isFinite(a)) return 0.65;
  return 0.65 + 0.35 * Math.min(1, Math.log10(1 + 4 * a) / 1.3);
}

// Brightness along an arc or a line, u from -1 to 1: full over the middle third,
// easing to `end` at the ends. No hot ends.
export function ringEase(u, end) {
  const x = clamp((Math.abs(u) - 0.3) / 0.7);
  return 1 - (1 - end) * x * x * (3 - 2 * x);
}

// A reading's swell, s points from the arc's middle, k of the way through it, on an
// arc `half` points each side of its middle. It starts in the middle and runs out past
// both ends as it fades.
export function ringSwell(s, k, half) {
  if (!(k >= 0 && k <= 1)) return 0;
  const sigma = Math.max(12, 0.32 * half);
  const at = (1 - (1 - k) * (1 - k)) * (half + sigma);
  const d = Math.abs(s) - at;
  return Math.pow(1 - k, 1.3) * Math.exp(-(d * d) / (2 * sigma * sigma));
}

// A swell lasts 0.95 of the time since the reading before, from 0.48 s to 1.5 s.
export function ringSwellDuration(gap) {
  return Math.min(1.5, 0.95 * Math.max(0.5, Number.isFinite(gap) ? gap : 1));
}

// How fast the light runs, in points a second: faster with power, never racing.
export function waveSpeed(kw) {
  return 16 + 22 * Math.log10(1 + 4 * Math.abs(kw));
}

// Where the lines sit on a way `length` points long, as shares from the arc (0) to the
// home's circle (1). As `phase` grows they move toward the home for power coming in.
export function ringLines(phase, length, towardHome) {
  if (!(length > 0) || !Number.isFinite(phase)) return [];
  const out = [];
  for (let s = (phase - Math.floor(phase)) * wavelength; s <= length; s += wavelength) {
    out.push(towardHome ? s / length : 1 - s / length);
  }
  return out;
}

// A value that follows its target as a critically damped spring: it never overshoots.
export class Follow {
  constructor(value) { this.value = value; this.velocity = 0; }
  step(target, dt, tau) {
    if (!(dt > 0)) return;
    if (!(tau > 0)) return this.snap(target);
    const w = 1 / tau, e = this.value - target, k = Math.exp(-w * dt), a = this.velocity + w * e;
    this.value = target + (e + a * dt) * k;
    this.velocity = (this.velocity - w * a * dt) * k;
  }
  snap(target) { this.value = target; this.velocity = 0; }
}

const TAU = 0.4;

// One arc over time: how much of its quarter it lights, how fast its lines run, whether
// it rests, and the swell each new reading sends along it.
export class RingMotion {
  constructor(node, t) {
    this.fill = new Follow(ringFill(node.kw));
    this.speed = new Follow(waveSpeed(node.kw));
    this.rest = new Follow(flowing(node) ? 0 : 1);
    this.phase = 0;
    this.last = t;
    this.reading = node.reading;
    this.swell = null;
  }

  step(node, t, still) {
    const dt = Math.max(0, t - this.last);
    this.last = Math.max(this.last, t);
    const rest = flowing(node) ? 0 : 1;
    if (still) {
      this.fill.snap(ringFill(node.kw));
      this.speed.snap(waveSpeed(node.kw));
      this.rest.snap(rest);
    } else {
      this.fill.step(ringFill(node.kw), dt, TAU);
      this.speed.step(waveSpeed(node.kw), dt, TAU);
      this.rest.step(rest, dt, TAU / 2);
      this.phase = (this.phase + (this.speed.value * dt) / wavelength) % 1000;
    }
    if (node.reading !== this.reading) {
      // A reading that came while nothing was drawn sends no swell.
      if (this.reading != null && flowing(node) && !still && dt <= 0.5) {
        this.swell = { start: t, duration: ringSwellDuration((node.reading - this.reading) / 1000) };
      }
      this.reading = node.reading;
    }
    let k = null;
    if (this.swell) {
      const p = (t - this.swell.start) / this.swell.duration;
      if (still || p > 1) this.swell = null; else k = Math.max(0, p);
    }
    return { fill: clamp(this.fill.value), phase: this.phase, on: 1 - clamp(this.rest.value), swell: k };
  }
}

function flowing(node) { return Math.abs(node.kw) * 1000 > idleW; }

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a).toFixed(4)})`;
};
const rad = deg => (deg * Math.PI) / 180;

// The ring's three layers, cleared by the caller: a wide halo and a near glow, each
// blurred once by CSS, and the cores over them. `ring` is { cx, cy, r, th, hub } in points; `nodes` carry
// { id, kw, towardHome, color, reading }.
export function drawRing(layers, ring, nodes, motions, t, { still = false, ink = '#eef3ff', ink2 = '#9aa5b8' } = {}) {
  const { cx, cy, r, th, hub } = ring;
  const { halo, near, core } = layers;

  // A soft arc at radius rr: `color` at alpha(u, s) along it, u from -1 to 1 and s points
  // from its middle, on a conic gradient that starts half a stroke early, so each round
  // cap takes the colour of the end it closes.
  const soft = (ctx, lo, hi, rr, width, color, alpha) => {
    const span = hi - lo;
    if (span <= 0.2) return;
    const perDeg = (rr * Math.PI) / 180, lead = width / 2 / perDeg;
    const g = ctx.createConicGradient(rad(lo - lead), cx, cy);
    const at = deg => rgba(color, alpha(span > 0 ? (deg / span) * 2 - 1 : 0, Math.abs(deg - span / 2) * perDeg));
    g.addColorStop(0, at(0));
    const step = Math.max(0.5, Math.min(span / 8, 6 / perDeg));
    for (let d = 0; d < span; d += step) g.addColorStop((d + lead) / 360, at(d));
    g.addColorStop(Math.min(1, (span + lead) / 360), at(span));
    g.addColorStop(1, at(span));
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, rad(lo), rad(hi));
    ctx.stroke();
  };

  // Each node's quarter, the track its arc lights, and the home's circle.
  core.lineCap = 'round';
  core.lineWidth = th;
  core.strokeStyle = rgba(ink, 0.13);
  for (const node of nodes) {
    core.beginPath();
    core.arc(cx, cy, r, rad(spots[node.id] - HALF), rad(spots[node.id] + HALF));
    core.stroke();
  }
  core.lineWidth = 1;
  core.strokeStyle = rgba(ink, 0.16);
  core.beginPath();
  core.arc(cx, cy, hub, 0, Math.PI * 2);
  core.stroke();

  const outer = r - th / 2 - 4, inner = hub + 4;
  for (const node of nodes) {
    const motion = motions.get(node.id) ?? motions.set(node.id, new RingMotion(node, t)).get(node.id);
    const f = motion.step(node, t, still);
    if (f.on <= 0.01 || f.fill <= 0) continue;
    const mid = spots[node.id], lo = mid - HALF * f.fill, hi = mid + HALF * f.fill;
    const half = (((hi - lo) / 2) * r * Math.PI) / 180;
    const strength = ringStrength(node.kw);
    const swell = s => (f.swell == null ? 0 : ringSwell(s, f.swell, half));
    const base = still ? 0.9 : 0.7;
    soft(halo, lo, hi, r, th * 1.6, node.color, (u, s) => 0.9 * f.on * ringEase(u, 0) * (0.5 + 0.6 * strength * swell(s)));
    soft(near, lo, hi, r, th * 1.1, node.color, (u, s) => 0.65 * f.on * ringEase(u, 0) * (0.5 + 0.6 * strength * swell(s)));
    soft(core, lo, hi, r, th, node.color, (u, s) => f.on * ringEase(u, 0.14) * (base + (1 - base) * swell(s)));
    if (still) {
      if (Math.abs(node.kw) * 1000 > idleW) chevron(core, ring, mid, (outer + inner) / 2, node.towardHome, rgba(ink2, f.on));
      continue;
    }
    // The lines keep their angle, so they narrow near the home, and fade in and out at
    // the ends of the way.
    const spread = Math.max(8, (hi - lo) / 2);
    for (const toHome of ringLines(f.phase, outer - inner, node.towardHome)) {
      const rr = outer + (inner - outer) * toHome, hs = spread * (1 - 0.4 * toHome);
      const a = 0.6 * strength * Math.pow(Math.sin(Math.PI * toHome), 1.2) * f.on;
      soft(core, mid - hs, mid + hs, rr, th * 0.4, node.color, u => a * ringEase(u, 0));
      soft(near, mid - hs, mid + hs, rr, th * 0.8, node.color, u => 0.75 * a * ringEase(u, 0));
    }
  }
}

// Under Reduce Motion a still chevron on the way shows which way the power flows.
function chevron(ctx, ring, angle, radius, inward, color) {
  const a = rad(angle), dir = inward ? -1 : 1;
  const x = ring.cx + radius * Math.cos(a), y = ring.cy + radius * Math.sin(a);
  const ux = Math.cos(a) * dir, uy = Math.sin(a) * dir, size = Math.max(6, ring.th * 0.6 + 3);
  ctx.lineWidth = 1.75;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - ux * size - uy * size, y - uy * size + ux * size);
  ctx.lineTo(x + ux * size * 0.6, y + uy * size * 0.6);
  ctx.lineTo(x - ux * size + uy * size, y - uy * size - ux * size);
  ctx.stroke();
}
