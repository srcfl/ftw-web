// Example site powers: battery and grid are positive into the site.
export const scenarios = {
  sun: { solar: 6, home: 1.2, car: 1.8, battery: -2.4, hour: 14 },
  evening: { solar: 0, home: 1.2, car: 0, battery: 1.2, hour: 20 },
  night: { solar: 0, home: 1, car: 2.4, battery: 2, hour: 2 }
};
export function balance(p) {
  return { ...p, grid: p.home + p.car - p.solar - p.battery };
}
export function hourProfile(hour) {
  const solar = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI)) * 6;
  const home = 0.8 + (hour > 6 && hour < 23 ? 0.4 : 0.2);
  const car = hour < 6 ? 2.4 : hour >= 11 && hour < 16 ? 1.8 : 0;
  const battery = solar > 3 ? -2.4 : hour >= 17 && hour <= 22 ? Math.min(2, home) : hour < 6 ? 2 : 0;
  return balance({ solar, home, car, battery, hour });
}
export function mix(a, b, t) {
  const p = {};
  for (const key of ['solar', 'home', 'car', 'battery']) p[key] = a[key] + (b[key] - a[key]) * t;
  return balance(p);
}
export function sinks(p) {
  return [p.car, p.home, Math.max(0, -p.battery), Math.max(0, -p.grid)];
}
export function polygonArea(points) {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) a += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  return Math.abs(a / 2);
}
export function polygonCenter(points) {
  let a = 0, x = 0, y = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const q = points[j][0] * points[i][1] - points[i][0] * points[j][1];
    a += q; x += (points[j][0] + points[i][0]) * q; y += (points[j][1] + points[i][1]) * q;
  }
  return Math.abs(a) > 1e-6 ? { x: x / (3 * a), y: y / (3 * a) } : { x: 0, y: 0 };
}
export function fieldLayout(values, w, h, time = 0, touch = null) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const f = values.map(v => v / total), area = w * h, c = f[0] * w;
  const amp = Math.min(c, w - c) * 0.36;
  const waves = Array.from({ length: 97 }, (_, i) => {
    const y = h * i / 96;
    return -amp * Math.cos(2 * Math.PI * y / h + time * 0.12) +
      (touch ? amp * 0.8 * touch.strength * Math.exp(-Math.pow((y - touch.y) / 95, 2)) * ((touch.x - c) / w) : 0);
  });
  const mean = (waves.reduce((a, b) => a + b, 0) - (waves[0] + waves[96]) / 2) / 96;
  const seam = y => {
    const u = Math.max(0, Math.min(96, y / h * 96)), i = Math.min(95, Math.floor(u));
    return c + waves[i] * (1 - (u - i)) + waves[i + 1] * (u - i) - mean;
  };
  const left = [[0, 0]];
  for (let i = 0; i <= 96; i++) left.push([seam(h * i / 96), h * i / 96]);
  left.push([0, h]);
  const rest = [[seam(0), 0], [w, 0], [w, h]];
  for (let i = 96; i >= 0; i--) rest.push([seam(h * i / 96), h * i / 96]);
  function prefix(b) {
    const cross = [];
    for (let i = 0; i <= 64; i++) {
      const u = i / 64, y = h * (b + 0.07 * Math.sin(Math.PI * u) * Math.sin(Math.PI * b) * Math.cos(time * 0.09));
      cross.push([seam(y) + (w - seam(y)) * u, y]);
    }
    const p = [[seam(0), 0], [w, 0], ...cross.slice().reverse()];
    for (let i = 48; i >= 0; i--) { const y = h * b * i / 48; p.push([seam(y), y]); }
    return { p, cross };
  }
  function solve(amount) {
    let lo = 0, hi = 1, r;
    for (let i = 0; i < 20; i++) { const b = (lo + hi) / 2; r = prefix(b); if (polygonArea(r.p) < amount * area) lo = b; else hi = b; }
    return r;
  }
  const a = solve(f[1]), b = solve(f[1] + f[2]);
  // Prefix shapes share their boundary exactly; draw rest, battery, home, car.
  const polygons = [left, a.p, b.p, rest];
  const centers = polygons.map(polygonCenter), areas = polygons.map(polygonArea);
  const difference = (big, small) => {
    const remaining = areas[big] - areas[small];
    return remaining > .01 ? {
      x: (centers[big].x * areas[big] - centers[small].x * areas[small]) / remaining,
      y: (centers[big].y * areas[big] - centers[small].y * areas[small]) / remaining
    } : centers[big];
  };
  return { f, area, seam, polygons, centers: [centers[0], centers[1], difference(2, 1), difference(3, 2)] };
}
export function smoothCurve(points) {
  if (!points.length) return '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    d += ` Q${a[0]},${a[1]} ${(a[0] + b[0]) / 2},${(a[1] + b[1]) / 2}`;
  }
  const last = points.at(-1); return d + ` T${last[0]},${last[1]}`;
}
