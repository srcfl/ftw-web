import { hours, withoutPlan, withPlan } from '/savings-model.mjs';
import { mountNow, mountFlow } from '/phone.mjs';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const el = (tag, className, style) => Object.assign(document.createElement(tag), className ? { className } : {}, style ? { style } : {});

// Run a callback once an element is on screen.
function whenSeen(element, callback, threshold = 0.35) {
  if (!element) return;
  if (!('IntersectionObserver' in window)) return callback();
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); callback(); }
  }, { threshold });
  observer.observe(element);
}

// The receipt and the example conversation play once they are on screen.
$$('.receipt, .transcript').forEach(element => whenSeen(element, () => element.classList.add('in'), 0.3));

// The app's Now, drawn live in the hero, with its flow running behind the phone.
const heroScreen = $('.hero [data-now]');
if (heroScreen) {
  mountNow(heroScreen);
  mountFlow($('.hero'), heroScreen);
}

/* The example day */
const runs = { without: withoutPlan, with: withPlan };
const stories = {
  without: 'The car charges as soon as it plugs in, at the day’s peak. The battery runs empty early in the evening and waits for the sun.',
  with: 'The car charges from 01:00 to 05:00, the cheapest hours. The battery covers the house all evening, tops up at 03:00 and covers the morning.'
};
const chart = $('#day-chart');
if (chart) {
  const maxPrice = Math.max(...withoutPlan.rows.map(row => row.price));
  const maxBuy = Math.max(...Object.values(runs).flatMap(run => run.rows.map(row => row.grid)));
  const plotWrap = el('div', 'plot-wrap');
  const plot = el('div', 'plot');
  plotWrap.append(el('span'), plot);
  const columns = hours.map((hour, i) => {
    const column = el('div', 'col');
    const price = el('span', 'price');
    price.style.setProperty('--h', `${(withoutPlan.rows[i].price / maxPrice) * 100}%`);
    const buy = el('span', 'buy');
    buy.style.setProperty('--d', `${i * 18}ms`);
    const tag = el('span', 'tag');
    column.append(price, buy, tag);
    plot.append(column);
    return { buy, tag };
  });
  const lanes = el('div', 'lanes');
  const lane = name => {
    const row = el('div', 'lane');
    row.append(Object.assign(el('span'), { textContent: name }));
    const cells = hours.map((hour, i) => { const cell = el('i'); cell.style.setProperty('--d', `${i * 18}ms`); row.append(cell); return cell; });
    lanes.append(row);
    return cells;
  };
  const carCells = lane('Car');
  const batteryCells = lane('Battery');
  const sunCells = lane('Sun');
  const axis = el('div', 'axis');
  axis.append(el('span'));
  hours.forEach((hour, i) => axis.append(Object.assign(el('span'), { textContent: i % 4 === 0 ? String(hour).padStart(2, '0') : '' })));
  chart.append(plotWrap, lanes, axis);

  sunCells.forEach((cell, i) => {
    const sun = withoutPlan.rows[i].solar;
    cell.style.setProperty('--c', 'var(--solar)');
    cell.style.setProperty('--o', sun ? 0.25 + 0.75 * (sun / 2.8) : 0);
    if (!sun) cell.classList.add('off');
  });

  const cost = $('#cost'), avg = $('#avg'), saved = $('#saved'), story = $('#story');
  const shown = { cost: withoutPlan.cost, avg: withoutPlan.cost / withoutPlan.bought };
  let tween = 0;
  function count(to) {
    const from = { ...shown };
    const start = performance.now();
    cancelAnimationFrame(tween);
    const step = now => {
      const t = still ? 1 : Math.min(1, (now - start) / 900);
      const e = 1 - Math.pow(1 - t, 3);
      shown.cost = from.cost + (to.cost - from.cost) * e;
      shown.avg = from.avg + (to.avg - from.avg) * e;
      cost.textContent = shown.cost.toFixed(2);
      avg.textContent = shown.avg.toFixed(2);
      if (t < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  }

  function show(mode) {
    const run = runs[mode];
    run.rows.forEach((row, i) => {
      const bought = Math.max(0, row.grid);
      const height = `${(bought / maxBuy) * 100}%`;
      columns[i].buy.style.setProperty('--h', height);
      columns[i].tag.style.setProperty('--h', height);
      columns[i].tag.textContent = bought >= 3 ? `${bought.toFixed(0)} kWh` : '';
      carCells[i].style.setProperty('--c', 'var(--car)');
      carCells[i].style.setProperty('--o', row.car ? 0.35 + 0.65 * (row.car / 11) : 0);
      carCells[i].classList.toggle('off', !row.car);
      const flow = row.battery;
      batteryCells[i].style.setProperty('--c', flow > 0 ? 'var(--stores)' : 'var(--gives)');
      batteryCells[i].style.setProperty('--o', Math.abs(flow) > 0.05 ? 0.4 + 0.6 * Math.min(1, Math.abs(flow) / 3.6) : 0);
      batteryCells[i].classList.toggle('off', Math.abs(flow) <= 0.05);
    });
    count({ cost: run.cost, avg: run.cost / run.bought });
    saved.hidden = mode !== 'with';
    story.textContent = stories[mode];
    $$('.toggle button').forEach(button => button.setAttribute('aria-checked', String(button.dataset.mode === mode)));
  }

  let touched = false;
  $$('.toggle button').forEach(button => button.addEventListener('click', () => { touched = true; show(button.dataset.mode); }));
  $('.toggle').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const next = $('.toggle button[aria-checked="false"]');
    touched = true;
    show(next.dataset.mode);
    next.focus();
  });
  show('without');
  // Once on screen, show the plan after a moment, unless the reader got there first.
  whenSeen(chart, () => setTimeout(() => { if (!touched) show('with'); }, still ? 0 : 1400), 0.5);
}

// The example day's prices as the app's eight block levels.
const glyphs = $('#price-glyphs');
if (glyphs) {
  const prices = withoutPlan.rows.map(row => row.price);
  const low = Math.min(...prices), high = Math.max(...prices);
  glyphs.textContent = prices.map(price => '▁▂▃▄▅▆▇█'[Math.round(((price - low) / (high - low)) * 7)]).join('');
}

/* The plan dial: the example day, drawn the way the app draws it */
const dial = $('#dial');
if (dial) {
  const ns = 'http://www.w3.org/2000/svg';
  // Colours and faces go through style, so the panel's custom properties apply in every browser.
  const styled = new Set(['stroke', 'fill', 'font-family']);
  const svg = (tag, attrs) => {
    const node = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) styled.has(k) ? node.style.setProperty(k, v) : node.setAttribute(k, v);
    return node;
  };
  const center = 120, rim = 104;
  // Midnight at the bottom, noon at the top.
  const angle = hour => ((hour / 24) * 360 + 180) * (Math.PI / 180);
  const point = (hour, radius) => [center + radius * Math.sin(angle(hour)), center - radius * Math.cos(angle(hour))];
  const prices = withPlan.rows.map(row => row.price);
  const low = Math.min(...prices), high = Math.max(...prices);
  const ticks = svg('g', {});
  for (let q = 0; q < 96; q++) {
    const i = Math.floor(q / 4);
    const row = withPlan.rows[i];
    const hour = (hours[i] + (q % 4) / 4) % 24;
    const level = Math.round(((row.price - low) / (high - low)) * 7);
    const [x1, y1] = point(hour, rim);
    const [x2, y2] = point(hour, rim - 8 - level * 3.2);
    const colour = row.battery > 0.05 ? 'var(--stores)' : row.battery < -0.05 ? 'var(--ink)' : 'var(--ink3)';
    ticks.append(svg('line', { x1, y1, x2, y2, stroke: colour, 'stroke-width': 2.2, 'stroke-linecap': 'round', class: 'tick' }));
  }
  const arc = (from, to, radius) => {
    const [x1, y1] = point(from, radius), [x2, y2] = point(to, radius);
    const sweep = ((to - from + 24) % 24) / 24 * 360;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  // The example's sun runs from 07:00 to 17:00.
  const sun = svg('path', { d: arc(7, 17, rim + 9), fill: 'none', stroke: 'var(--solar)', 'stroke-width': 2, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round', opacity: 0.9 });
  const carRun = svg('path', { d: arc(1, 5, 52), fill: 'none', stroke: 'var(--car)', 'stroke-width': 3, 'stroke-dasharray': '0.1 7', 'stroke-linecap': 'round' });
  const [gx, gy] = point(7, 52);
  const goal = svg('circle', { cx: gx, cy: gy, r: 4, fill: 'var(--car)' });
  const hand = svg('g', { class: 'hand' });
  hand.append(svg('line', { x1: center, y1: center - 40, x2: center, y2: center - rim - 4, stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
  const time = svg('text', { x: center, y: center - 2, 'text-anchor': 'middle', fill: 'var(--ink)', 'font-size': 26, 'font-weight': 700, 'font-family': 'var(--sans)' });
  const detail = svg('text', { x: center, y: center + 18, 'text-anchor': 'middle', fill: 'var(--ink3)', 'font-size': 10, 'font-family': 'var(--mono)', 'letter-spacing': '.06em' });
  dial.append(ticks, sun, carRun, goal, hand, time, detail);

  // The hand steps a quarter hour every 250 ms, one turn in 24 seconds; the middle names the quarter under it.
  let turned = 0;
  const quarterAt = step => {
    const q = step % 96;
    const clock = q / 4;
    const row = withPlan.rows[hours.indexOf(Math.floor(clock))];
    const action = row.car ? 'CAR CHARGES' : row.battery > 0.05 ? 'STORES' : row.battery < -0.05 ? 'GIVES' : 'WAITS';
    hand.style.transform = `rotate(${180 + step * 3.75}deg)`;
    time.textContent = `${String(Math.floor(clock)).padStart(2, '0')}:${String((q % 4) * 15).padStart(2, '0')}`;
    detail.textContent = `${(row.price / 100).toFixed(2)} KR · ${action}`;
  };
  // Start at 03:00, the quarter the example conversation asks about.
  quarterAt(turned = 12);
  if (!still) whenSeen(dial, () => setInterval(() => quarterAt(++turned), 250), 0.3);
}

/* Assistant tabs */
const tabs = $$('.tabs [role="tab"]');
function select(tab, focus) {
  tabs.forEach(other => {
    const on = other === tab;
    other.setAttribute('aria-selected', String(on));
    other.tabIndex = on ? 0 : -1;
    $(`#${other.getAttribute('aria-controls')}`).hidden = !on;
  });
  if (focus) tab.focus();
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => select(tab));
  tab.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step) { event.preventDefault(); select(tabs[(i + step + tabs.length) % tabs.length], true); }
  });
});
$$('[data-assistant]').forEach(link => link.addEventListener('click', () => {
  const tab = $(`#tab-${link.dataset.assistant}`);
  if (tab) select(tab);
}));

$$('.copy').forEach(button => button.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($(button.dataset.copy).textContent);
    button.textContent = 'Copied';
    button.classList.add('done');
  } catch {
    button.textContent = 'Select it';
  }
  setTimeout(() => { button.textContent = 'Copy'; button.classList.remove('done'); }, 1800);
}));

/* The app tour: Now drawn live, then the app's own screens, one at a time */
const tour = $('#tour');
if (tour) {
  const slides = $$('.slide', tour);
  const steps = $$('.tour-steps button');
  const seconds = 5;
  let current = 0, timer = 0, seen = false;
  steps[0].parentElement.parentElement.style.setProperty('--slide', `${seconds}s`);
  mountNow($('[data-now]', tour));
  mountFlow($('#app'), $('.screen', tour));
  function go(n) {
    current = n;
    slides.forEach(slide => slide.classList.toggle('is-on', Number(slide.dataset.slide) === n));
    steps.forEach(step => step.setAttribute('aria-pressed', String(Number(step.dataset.slide) === n)));
    clearTimeout(timer);
    if (seen && !still) timer = setTimeout(() => go((current + 1) % slides.length), seconds * 1000);
  }
  steps.forEach(step => step.addEventListener('click', () => go(Number(step.dataset.slide))));
  whenSeen(tour, () => { seen = true; go(0); }, 0.4);
}

/* Waitlist and news sign-up */
const words = {
  gateway: 'You’re on the list. We’ll email you when orders open.',
  news: 'Thanks. The next FTW news will reach you by email.'
};
$$('form.signup').forEach(form => form.addEventListener('submit', async event => {
  event.preventDefault();
  const status = $('.form-status', form);
  const email = form.elements.email;
  status.className = 'form-status';
  if (!email.value.trim() || !email.checkValidity()) {
    status.textContent = 'Check the email address.';
    status.classList.add('err');
    email.focus();
    return;
  }
  const button = $('button[type="submit"]', form);
  button.disabled = true;
  // Sourceful's braille indicator while the request runs; it holds still under Reduce Motion.
  const frames = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
  let frame = 0;
  status.textContent = `${frames[0]} Sending`;
  const spin = still ? 0 : setInterval(() => { status.textContent = `${frames[++frame % frames.length]} Sending`; }, 80);
  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list: form.dataset.list, email: email.value, country: form.elements.country?.value || '', website: form.elements.website.value })
    });
    if (response.ok) {
      status.textContent = words[form.dataset.list];
      status.classList.add('ok');
      form.classList.add('done');
      return;
    }
    const { error } = await response.json().catch(() => ({}));
    status.textContent = error === 'invalid_email'
      ? 'Check the email address.'
      : 'Sign-up is closed right now. Join the Discord, or email support@sourceful.energy.';
    status.classList.add('err');
  } catch {
    status.textContent = 'Could not reach FTW. Check your connection and try again.';
    status.classList.add('err');
  } finally {
    clearInterval(spin);
    button.disabled = false;
  }
}));
