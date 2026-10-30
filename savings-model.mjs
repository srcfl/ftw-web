// The example day on the home page: one simulated home, made-up but typical prices.
// It compares the same home under ordinary self-consumption control with a plan,
// as FTW's vision asks. It is an illustration, not a measured result.

// 24 hours from 16:00, when the car comes home.
export const hours = [16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
// Spot price, öre/kWh. Buying adds tax and fees; selling earns the spot price.
export const spot = [85, 140, 165, 150, 115, 90, 75, 62, 50, 42, 38, 36, 38, 45, 72, 120, 145, 118, 88, 70, 58, 55, 62, 78];
export const fees = 90;
// The house's own use and the sun, kWh in each hour.
export const load = [0.9, 1.4, 1.6, 1.4, 1.2, 1.0, 0.8, 0.6, 0.5, 0.45, 0.45, 0.45, 0.5, 0.6, 1.1, 1.5, 1.2, 0.8, 0.7, 0.7, 0.8, 0.7, 0.7, 0.8];
export const solar = [0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.5, 1.3, 2.1, 2.6, 2.8, 2.5, 1.8, 1.0];
// A 10 kWh battery, 5 kW, kept above 1 kWh, 95 % each way. A car that needs 22 kWh by 07:00 on an 11 kW charger.
export const battery = { capacity: 10, floor: 1, power: 5, efficiency: 0.95, start: 3 };
export const car = { need: 22, power: 11, plugIn: 17, readyBy: 7 };

const at = h => hours.indexOf(h);

// Plug in and charge at once. The battery covers whatever the meter sees and stores spare sun.
const atPlugIn = hours.map((h, i) => (i === at(17) || i === at(18) ? 11 : 0));
const selfConsumption = (h, need) => -need;

// The plan: the car in the cheapest hours before 07:00, the battery held for the evening peak,
// topped up in the night's cheapest hour for the morning peak, then filled by the sun.
const planned = hours.map(h => ([1, 2, 3, 4].includes(h) ? 5.5 : 0));
const plan = (h, need) => {
  if (h === 16) return 0;
  if (h === 3) return 3.6;
  if (h >= 20 || h <= 5) return 0;
  return -need;
};

function run(carKWh, batteryRule) {
  const { capacity, floor, power, efficiency } = battery;
  let stored = battery.start;
  let cost = 0;
  let bought = 0;
  const rows = hours.map((h, i) => {
    const need = load[i] + carKWh[i] - solar[i];
    const want = batteryRule(h, need);
    const flow = want > 0
      ? Math.min(want, power, (capacity - stored) / efficiency)
      : -Math.min(-want, power, (stored - floor) * efficiency);
    stored += flow > 0 ? flow * efficiency : flow / efficiency;
    const grid = need + flow;
    const price = grid > 0 ? spot[i] + fees : spot[i];
    cost += (grid * price) / 100;
    if (grid > 0) bought += grid;
    return { hour: h, price: spot[i] + fees, grid, battery: flow, stored, car: carKWh[i], solar: solar[i] };
  });
  return { rows, cost, bought, stored };
}

export const withoutPlan = run(atPlugIn, selfConsumption);
export const withPlan = run(planned, plan);
