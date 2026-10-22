export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const mod = (n, size = 1) => ((n % size) + size) % size;

export function springPoint(x = 0, y = 0) {
  return { x, y, vx: 0, vy: 0 };
}

// Small fixed steps keep a fast finger and a slow display equally stable.
export function stepSpring(body, target, elapsed, stiffness = 190, damping = 21) {
  const steps = Math.max(1, Math.ceil(Math.min(elapsed, .08) * 120));
  const dt = Math.min(elapsed, .08) / steps;
  for (let i = 0; i < steps; i++) {
    for (const axis of ['x', 'y']) {
      const velocity = axis === 'x' ? 'vx' : 'vy';
      body[velocity] += ((target[axis] - body[axis]) * stiffness - body[velocity] * damping) * dt;
      body[axis] += body[velocity] * dt;
    }
  }
  return body;
}

// Every surface and stream uses this map. The boundary stays fixed; the
// interior follows the grabbed material, with a broad, smooth falloff.
export function materialMap(width, height, grab = null) {
  if (!grab) return p => [...p];
  const length = Math.hypot(grab.dx || 0, grab.dy || 0);
  const scale = length > 92 ? 92 / length : 1;
  const dx = (grab.dx || 0) * scale, dy = (grab.dy || 0) * scale;
  const radius = 190;
  return ([x, y]) => {
    const edge = Math.sin(Math.PI * x / width) * Math.sin(Math.PI * y / height);
    const falloff = Math.exp(-((x - grab.x) ** 2 + (y - grab.y) ** 2) / (2 * radius ** 2));
    const influence = edge * falloff;
    return [x + dx * influence, y + dy * influence];
  };
}

export function cubic(a, b, c, d, t) {
  const u = 1 - t;
  return [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0], u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]];
}

export function sampleStream(a, d, map = p => p, bend = 0) {
  const b = [a[0] * .55 + d[0] * .45 + bend, a[1]];
  const c = [a[0] * .45 + d[0] * .55 - bend, d[1]];
  const points = Array.from({ length: 37 }, (_, i) => map(cubic(a, b, c, d, i / 36)));
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i-1] + Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  return { points, distances, length: distances.at(-1) };
}

export function pointAlong(stream, progress) {
  const distance = mod(progress) * stream.length;
  let i = 1;
  while (i < stream.distances.length - 1 && stream.distances[i] < distance) i++;
  const fraction = (distance - stream.distances[i-1]) / (stream.distances[i] - stream.distances[i-1] || 1);
  const a = stream.points[i-1], b = stream.points[i];
  return [a[0] + (b[0]-a[0])*fraction, a[1] + (b[1]-a[1])*fraction];
}

export function pointInPolygon([x,y], polygon) {
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [ax,ay]=polygon[i], [bx,by]=polygon[j];
    if ((ay>y)!==(by>y) && x < (bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
  }
  return inside;
}
