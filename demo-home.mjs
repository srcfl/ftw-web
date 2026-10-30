// The simulated home on the home page's iPhone: the example day in savings-model.mjs, at
// four moments, one reading a second. Positive kW comes into the home, negative leaves it.
// The grid covers whatever the rest leave, so every reading balances; while the plan holds
// the grid at zero, the battery follows the house instead, as FTW's control does.
import { hours, spot, fees, load, withPlan } from './savings-model.mjs';

const at = (h, key) => withPlan.rows[hours.indexOf(h)][key];

// The plan's own hours: its sun, battery, car and grid at 03, 07, 12 and 18.
const moment = (hour, clock, extra) => ({
  hour, clock,
  use: load[hours.indexOf(hour)],
  solar: at(hour, 'solar'),
  battery: -at(hour, 'battery'),
  grid: at(hour, 'grid'),
  car: -at(hour, 'car'),
  ...extra
});

export const moments = [
  moment(3, '03:05', { soc: 11, carSoc: 66, carWord: 'charging in the cheap hours',
    say: 'Battery stores 3.6 kWh in the night’s cheapest hour, at 126 öre. The car is ready by 07:00.' }),
  moment(7, '07:30', { soc: 17, carSoc: 80, carWord: 'ready',
    say: 'Battery gives power until 09:00, when power costs up to 235 öre. Then stores spare sun.' }),
  moment(12, '12:40', { soc: 42, carSoc: 80, carWord: 'ready',
    say: 'Battery stores spare sun until 16:00. Then gives power 17:00, when power costs up to 255 öre.' }),
  moment(18, '18:20', { soc: 34, carSoc: 51, carWord: 'waits for cheap hours',
    say: 'Battery gives power until 00:00, when power costs up to 255 öre. The car charges 01:00.' })
];

// Each moment holds for `hold` seconds, then the readings move to the next over `ramp`.
export const hold = 7;
export const ramp = 3;
const period = hold + ramp;

const idleKw = 0.042;
const quiet = kw => (Math.abs(kw) > idleKw ? kw : 0);

// A small, repeatable wobble per reading, so the figures live without random numbers.
const wobble = (n, k) => 1 + Math.sin(n * 12.9898 + k * 78.233) * 0.012;

// The reading at second n.
export function reading(n) {
  const i = Math.floor(n / period) % moments.length;
  const into = n % period;
  const a = moments[i], b = moments[(i + 1) % moments.length];
  const k = into < hold ? 0 : (into - hold) / ramp;
  const mix = key => a[key] + (b[key] - a[key]) * k;
  const use = mix('use') * wobble(n, 0);
  const solar = quiet(mix('solar') * wobble(n, 1));
  const car = quiet(mix('car') * wobble(n, 3));
  const held = Math.abs(mix('grid')) <= idleKw;
  const battery = quiet(held ? use - solar - car : mix('battery') * wobble(n, 2));
  const now = k < 0.5 ? a : b;
  return {
    n, use, solar, battery, car,
    grid: quiet(use - solar - battery - car),
    soc: Math.round(mix('soc')),
    carSoc: Math.round(mix('carSoc')),
    clock: now.clock,
    hour: now.hour,
    carWord: now.carWord,
    say: now.say
  };
}

// A figure as the app shows it: 10 W steps under 1 kW, 0.1 kW to 10 kW, whole kW past that.
export function figure(kw) {
  const w = Math.abs(kw) * 1000;
  if (w <= idleKw * 1000) return ['0', 'W'];
  if (w < 995) return [String(Math.round(w / 10) * 10), 'W'];
  if (w < 9950) return [(w / 1000).toFixed(1), 'kW'];
  return [String(Math.round(w / 1000)), 'kW'];
}

const flows = kw => Math.abs(kw) > idleKw;

// What each node says, and which way its light runs.
export function nodes(r) {
  return [
    { id: 'solar', kw: r.solar, towardHome: true, tone: 'solar', word: flows(r.solar) ? 'Making' : 'Resting' },
    { id: 'battery', kw: r.battery, towardHome: r.battery > 0, tone: r.battery > idleKw ? 'gives' : 'stores',
      word: `${flows(r.battery) ? (r.battery > 0 ? 'Giving power' : 'Charging') : 'Resting'} · ${r.soc} %` },
    { id: 'grid', kw: r.grid, towardHome: r.grid > 0, tone: 'grid', word: flows(r.grid) ? (r.grid > 0 ? 'Buying' : 'Selling') : 'Balanced' },
    { id: 'car', kw: r.car, towardHome: false, tone: 'car', word: `${flows(r.car) ? 'Charging' : 'Resting'} · ${r.carSoc} %` }
  ];
}

// The next twelve hours from the moment's hour: price in öre, the battery's plan.
export function nextHours(hour) {
  return Array.from({ length: 12 }, (_, k) => {
    const h = (hour + k) % 24;
    const row = withPlan.rows[hours.indexOf(h)];
    return { hour: h, price: spot[hours.indexOf(h)] + fees, battery: row.battery };
  });
}
