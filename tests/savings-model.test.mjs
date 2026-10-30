import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hours, load, solar, battery, car, withoutPlan, withPlan } from '../savings-model.mjs';

const runs = { withoutPlan, withPlan };
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('each hour balances: the grid supplies what the house, car and battery need beyond the sun', () => {
  for (const [name, run] of Object.entries(runs)) {
    run.rows.forEach((row, i) => {
      assert.ok(Math.abs(row.grid - (load[i] + row.car - solar[i] + row.battery)) < 1e-9, `${name} ${row.hour}:00`);
    });
  }
});

test('the battery stays within its range and power in both runs', () => {
  for (const [name, run] of Object.entries(runs)) {
    for (const row of run.rows) {
      assert.ok(row.stored >= battery.floor - 1e-9 && row.stored <= battery.capacity + 1e-9, `${name} ${row.hour}:00 stored ${row.stored}`);
      assert.ok(Math.abs(row.battery) <= battery.power + 1e-9, `${name} ${row.hour}:00 power ${row.battery}`);
    }
  }
});

test('the car gets the same energy in both runs, and the plan has it ready by 07:00', () => {
  const total = run => run.rows.reduce((sum, row) => sum + row.car, 0);
  assert.equal(total(withoutPlan), car.need);
  assert.equal(total(withPlan), car.need);
  const ready = hours.indexOf(car.readyBy);
  assert.equal(withPlan.rows.slice(ready).reduce((sum, row) => sum + row.car, 0), 0);
  for (const run of Object.values(runs)) assert.ok(run.rows.every(row => row.car <= car.power));
});

test('both runs end with the battery about equally full, so the saving is not borrowed from storage', () => {
  assert.ok(Math.abs(withPlan.stored - withoutPlan.stored) < 0.1);
  assert.ok(Math.abs(withPlan.stored / battery.capacity - 0.95) < 0.01, 'the fine print says about 95 % full');
});

test('the numbers on the page come from the model', () => {
  const saved = withoutPlan.cost - withPlan.cost;
  assert.match(page, new RegExp(`<span id="cost">${withoutPlan.cost.toFixed(2)}</span>`));
  assert.match(page, new RegExp(`<b id="avg">${(withoutPlan.cost / withoutPlan.bought).toFixed(2)}</b>`));
  assert.match(page, new RegExp(`Saves <b>${saved.toFixed(2)} kr</b>, ${Math.round((saved / withoutPlan.cost) * 100)} %`));
  assert.match(page, new RegExp(`a car that needs ${car.need} kWh by 0${car.readyBy}:00`));
});

test('the page says the example is simulated and not a measured result', () => {
  assert.match(page, /Example day · Simulated home/);
  assert.match(page, /It is not a measured result/);
});
