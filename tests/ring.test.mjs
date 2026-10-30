import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringFill, ringStrength, ringEase, ringSwell, ringLines, wavelength, waveSpeed, RingMotion } from '../ring.mjs';
import { moments, reading, figure, nodes, nextHours, hold } from '../demo-home.mjs';
import { hours, load, withPlan } from '../savings-model.mjs';

// The ring's rules, as the app's FlowRingTests hold them (srcfl/ftw-app 44efeac).
test('an arc lights at least a quarter of its quarter, more with power, and never all at rest', () => {
  assert.equal(ringFill(0), 0);
  assert.equal(ringFill(0.04), 0);
  assert.equal(ringFill(0.05), 0.25);
  assert.equal(ringFill(0.7), 0.25);
  assert.ok(ringFill(0.8) > 0.25);
  assert.ok(Math.abs(ringFill(1.8) - 0.513) < 0.001);
  assert.ok(Math.abs(ringFill(6) - 0.909) < 0.001);
  assert.ok(ringFill(22) <= 1);
  assert.equal(ringFill(-2.4), ringFill(2.4));
  assert.equal(ringFill(NaN), 0);
  assert.equal(ringFill(Infinity), 0);
});

test('strength grows with power and stops at full', () => {
  assert.equal(ringStrength(0), 0.65);
  assert.equal(ringStrength(5), 1);
  assert.equal(ringStrength(22), 1);
  assert.equal(ringStrength(-1), ringStrength(1));
  assert.ok(ringStrength(1) > 0.65 && ringStrength(1) < 1);
});

test('the arc is brightest over its middle third and has no hot ends', () => {
  assert.equal(ringEase(0, 0.14), 1);
  assert.equal(ringEase(0.3, 0.14), 1);
  assert.equal(ringEase(-0.3, 0.14), 1);
  assert.ok(Math.abs(ringEase(1, 0.14) - 0.14) < 1e-12);
  assert.ok(Math.abs(ringEase(-1, 0)) < 1e-12);
  let last = 1;
  for (let u = 0.3; u <= 1; u += 0.05) {
    const e = ringEase(u, 0.32);
    assert.ok(e <= last + 1e-12);
    last = e;
  }
});

test('a swell starts in the middle, runs out past both ends and fades', () => {
  const half = 60;
  assert.ok(Math.abs(ringSwell(0, 0, half) - 1) < 1e-12);
  const peak = k => {
    let best = 0;
    for (let s = 0; s <= 140; s += 0.5) if (ringSwell(s, k, half) > ringSwell(best, k, half)) best = s;
    return best;
  };
  assert.ok(peak(0.2) < peak(0.5));
  assert.ok(peak(0.5) < peak(0.9));
  assert.ok(peak(0.9) > half);
  assert.ok(ringSwell(peak(0.8), 0.8, half) < ringSwell(peak(0.3), 0.3, half));
  assert.equal(ringSwell(10, 0.4, half), ringSwell(-10, 0.4, half));
  assert.equal(ringSwell(0, 1.01, half), 0);
  assert.equal(ringSwell(0, -0.01, half), 0);
});

test('the lines sit a wavelength apart and run toward the home for power coming in', () => {
  const length = 36.75;
  for (const toward of [true, false]) {
    for (let phase = 0; phase < 3; phase += 0.07) {
      const ps = ringLines(phase, length, toward);
      assert.ok(ps.every(p => p >= 0 && p <= 1));
      ps.slice(1).forEach((b, i) => assert.ok(Math.abs(Math.abs(b - ps[i]) * length - wavelength) < 1e-9));
      assert.ok(ps.length === 2 || ps.length === 3);
    }
    const a = ringLines(0.2, length, toward)[0], b = ringLines(0.3, length, toward)[0];
    assert.ok(Math.abs((b - a) * length - (toward ? 1 : -1) * 0.1 * wavelength) < 1e-9);
    assert.deepEqual(ringLines(7.25, length, toward), ringLines(0.25, length, toward));
  }
  for (let phase = 0; phase < 1; phase += 0.05) assert.ok(ringLines(phase, 11.3, true).length <= 1);
  assert.deepEqual(ringLines(0.4, 0, true), []);
  assert.deepEqual(ringLines(NaN, length, true), []);
});

test('the lines run faster with more power, and a new reading sends one swell', () => {
  const at = (kw, n) => ({ id: 'grid', kw, towardHome: true, reading: n * 1000 });
  const slow = new RingMotion(at(0.3, 0), 0), fast = new RingMotion(at(6, 0), 0);
  let a, b;
  for (let t = 0; t <= 2; t += 1 / 60) { a = slow.step(at(0.3, 0), t, false); b = fast.step(at(6, 0), t, false); }
  assert.ok(b.phase > a.phase * 1.5);
  assert.ok(waveSpeed(6) > waveSpeed(0.3));
  const m = new RingMotion(at(2, 0), 0);
  assert.equal(m.step(at(2, 0), 0.5, false).swell, null);
  assert.equal(m.step(at(2, 1), 1, false).swell, 0);
  assert.ok(m.step(at(2, 1), 1.4, false).swell > 0.3);
  assert.equal(m.step(at(2, 1), 2.5, false).swell, null);
  assert.equal(new RingMotion(at(2, 0), 0).step(at(2, 1), 1, true).swell, null, 'no swell under Reduce Motion');
});

// The simulated home on the iPhone is the example day.
test('each moment is the example plan at its hour, and the home uses what it should', () => {
  for (const m of moments) {
    const row = withPlan.rows[hours.indexOf(m.hour)];
    assert.equal(m.battery, -row.battery);
    assert.equal(m.car, -row.car);
    assert.ok(Math.abs(m.solar + m.battery + m.grid + m.car - load[hours.indexOf(m.hour)]) < 1e-9, m.clock);
  }
});

test('every reading balances, and the grid holds at zero while the plan holds it there', () => {
  for (let n = 0; n < 120; n++) {
    const r = reading(n);
    assert.ok(Math.abs(r.solar + r.battery + r.grid + r.car - r.use) <= 0.042 + 1e-9, `second ${n}`);
    const m = moments.find(x => x.clock === r.clock);
    if (n % 10 < hold && m.grid === 0) assert.equal(r.grid, 0, `second ${n}`);
  }
});

test('the plan sentences say what the example plan does', () => {
  const row = h => withPlan.rows[hours.indexOf(h)];
  const most = hs => Math.max(...hs.map(h => row(h).price));
  const says = Object.fromEntries(moments.map(m => [m.clock, m.say]));
  assert.equal(row(3).battery, 3.6);
  assert.match(says['03:05'], new RegExp(`stores 3.6 kWh .* at ${row(3).price} öre`));
  assert.ok([7, 8].every(h => row(h).battery < 0) && row(9).battery > 0);
  assert.match(says['07:30'], new RegExp(`until 09:00, when power costs up to ${most([7, 8])} öre`));
  assert.ok([12, 13, 14, 15].every(h => row(h).battery > 0) && row(16).battery === 0 && row(17).battery < 0);
  assert.match(says['12:40'], new RegExp(`up to ${most([17, 18, 19, 20, 21, 22, 23])} öre`));
  assert.ok([18, 19, 20, 21, 22, 23].every(h => row(h).battery < 0) && row(0).battery === 0 && row(1).car > 0 && row(0).car === 0);
  assert.match(says['18:20'], new RegExp(`until 00:00, when power costs up to ${most([18, 19, 20, 21, 22, 23])} öre`));
});

test('figures step as the app rounds them, and each node says which way it runs', () => {
  assert.deepEqual(figure(0.03), ['0', 'W']);
  assert.deepEqual(figure(0.456), ['460', 'W']);
  assert.deepEqual(figure(-1.44), ['1.4', 'kW']);
  assert.deepEqual(figure(9.55), ['9.6', 'kW']);
  assert.deepEqual(figure(11.2), ['11', 'kW']);
  const night = Object.fromEntries(nodes(reading(0)).map(item => [item.id, item]));
  assert.equal(night.grid.towardHome, true);
  assert.equal(night.grid.word, 'Buying');
  assert.equal(night.battery.towardHome, false);
  assert.equal(night.battery.tone, 'stores');
  assert.match(night.battery.word, /^Charging · \d+ %$/);
  assert.equal(night.car.towardHome, false);
  const morning = Object.fromEntries(nodes(reading(10)).map(item => [item.id, item]));
  assert.equal(morning.battery.tone, 'gives');
  assert.equal(morning.battery.towardHome, true);
  assert.equal(morning.grid.word, 'Balanced');
  assert.equal(nextHours(22).length, 12);
  assert.deepEqual(nextHours(22).map(h => h.hour).slice(0, 4), [22, 23, 0, 1]);
});
