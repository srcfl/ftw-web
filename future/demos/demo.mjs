import { balance, scenarios, hourProfile, sinks, fieldLayout, polygonArea, polygonCenter, smoothCurve } from './model.mjs';

const $ = s => document.querySelector(s), ns = 'http://www.w3.org/2000/svg';
const configs = {
  'ring-flow': ['ring', 'Ring / Flow'], 'ftw-ahead': ['classic', 'FTW / Ahead'],
  'fluid-app': ['fluid', 'One living energy flow'], 'elastic-fields': ['fluid', 'Elastic energy fields'],
  'finger-flow': ['fluid', 'Take hold of the energy'], 'site-flow': ['fluid', 'One flow for the site'],
  'fused-fields': ['fluid', 'Connected colour fields']
};
const id = new URLSearchParams(location.search).get('concept') || 'fluid-app';
const [theme, title] = configs[id] || configs['fluid-app'];
$('#phone').classList.add(theme); $('#phone').dataset.concept=id; $('#demo-title').textContent = title;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const S = { hour: 14, target: balance(scenarios.sun), power: balance(scenarios.sun), route: 'now', running: !reduced.matches, phase: 0, goal: 80, detail: null, touch: null, pointer: null, strength: 0, visible: true };
const robot = { x: 190, y: 220, vx: 0, vy: 0, targetX: 190, targetY: 220, dragging: false };
const colors = { solar: '#ffd052', home: theme === 'ring' ? '#55cfe5' : '#b9c4d2', battery: theme === 'ring' ? '#ffb754' : '#78dcd7', car: '#b29be9', grid: '#e458a8' };
const names = { solar: 'Solar', home: 'Home', battery: 'Home battery', car: 'Car', grid: 'Grid connection' };
const fmt = n => Math.abs(n).toFixed(1);
const point = (event, element = $('#scene')) => { const r = element.getBoundingClientRect(); return { x: (event.clientX - r.left) / r.width * 400, y: (event.clientY - r.top) / r.height * 430 }; };
function svg(tag, attrs, parent) { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.append(e); return e; }
function path(points) { return points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z'; }
function animateTo(p, hour) {
  S.target = balance(p); S.hour = hour; S.detail && updateDetail(); updateTime(); wake();
}
function selectHour(hour) {
  S.hour = Math.max(0, Math.min(23, Math.round(hour)));
  animateTo(hourProfile(S.hour), S.hour);
  document.querySelectorAll('[data-scenario]').forEach(b => b.setAttribute('aria-pressed', 'false'));
}
function updateTime() {
  $('#time').textContent = String(S.hour).padStart(2, '0') + ':00';
  $('#time-caption').textContent = S.target.solar > 2 ? 'Solar powers the home' : S.target.grid > .1 ? 'Grid and stored energy supply the home' : S.target.battery > .1 ? 'The battery covers the home' : 'A balanced home';
  const x = S.hour / 23 * 400;
  $('#cursor').setAttribute('x1', x); $('#cursor').setAttribute('x2', x);
  $('#cursor-dot').setAttribute('cx', x); $('#cursor-dot').setAttribute('cy', 28);
  $('#timeline').setAttribute('aria-valuenow', S.hour);
  $('#timeline').setAttribute('aria-valuetext', `${S.hour}:00, ${$('#time-caption').textContent}`);
}
for (const key of ['solar', 'battery', 'car', 'home']) {
  const pts = Array.from({ length: 24 }, (_, h) => [h / 23 * 400, 67 - Math.abs(hourProfile(h)[key]) / 7 * 60]);
  svg('path', { d: smoothCurve(pts) + ' L400,70 L0,70 Z', fill: colors[key], opacity: key === 'solar' ? '.7' : '.4' }, $('#curves'));
}
const labels = {};
for (const key of Object.keys(names)) {
  const b = document.createElement('button'); b.className = 'scene-label'; b.dataset.device = key;
  b.innerHTML = `<span>${names[key]}</span><strong></strong><small></small>`;
  b.addEventListener('click', () => { if (!b.dataset.dragged) openDetail(key); });
  $('#labels').append(b); labels[key] = b;
}
const fieldPaths = [];
for (const key of ['grid', 'battery', 'home', 'car']) fieldPaths.push(svg('path', { fill: `url(#${key}-fill)`, filter: 'url(#soft-edge)' }, $('#fields')));
const connections = {};
for (const key of ['solar', 'battery', 'car', 'grid']) {
  const p = svg('path', { fill: 'none', stroke: colors[key], 'stroke-linecap': 'round', opacity: '.62' }, $('#streams'));
  const dots = Array.from({ length: 5 }, () => svg('circle', { r: 2.2, fill: colors[key] }, $('#particles')));
  connections[key] = { p, dots };
}
svg('circle', { cx: 200, cy: 212, r: 120, fill: 'none', stroke: '#293142', 'stroke-width': 16 }, $('#ring'));
const arcs = Array.from({ length: 4 }, (_, i) => svg('path', { fill: 'none', stroke: [colors.home, colors.battery, colors.car, colors.grid][i], 'stroke-width': 16, 'stroke-linecap': 'round' }, $('#ring')));
const routeFlow = svg('g', {id:'route-flow', display:'none'}, $('#energy'));
for (const key of ['car','home','battery','solar']) {
 const pts = Array.from({length:24},(_,h)=>[h/23*400,410-Math.abs(hourProfile(h)[key])/7*170]);
 svg('path',{d:smoothCurve(pts)+' L400,430 L0,430 Z',fill:colors[key],opacity:'.45'},routeFlow);
}
const routeCursor=svg('line',{y1:235,y2:430,stroke:'currentColor','stroke-opacity':'.35'},routeFlow);
const originPositions = { solar: [82, 66], battery: [318, 66], car: [318, 354], grid: [82, 354], home: [200, 210] };
const fluidPositions = { solar: [90, 35], home: [312, 100], car: [83, 249], battery: [296, 258], grid: [240, 373] };
function cubic(a, b, c, d, t) { const u = 1 - t; return [u*u*u*a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t*t*t*d[0], u*u*u*a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t*t*t*d[1]]; }
function drawStreams(p, elapsed) {
  const center = theme === 'fluid' ? [200, 180] : [200, 212];
  for (const key of Object.keys(connections)) {
    const value = key === 'grid' ? p.grid : p[key];
    const source = key === 'solar' || key === 'battery' && value > 0 || key === 'grid' && value > 0;
    const edge = (theme === 'fluid' ? { ...fluidPositions, solar: [130, -15], grid: [40, 425] } : originPositions)[key];
    const length = Math.hypot(edge[0]-center[0],edge[1]-center[1]) || 1;
    const hub = theme === 'fluid' ? center : [center[0]+(edge[0]-center[0])/length*58,center[1]+(edge[1]-center[1])/length*58];
    let a = source ? edge : hub, d = source ? hub : edge;
    let b = [a[0] * .6 + d[0] * .4, a[1]], c = [a[0] * .4 + d[0] * .6, d[1]];
    if (S.touch) {
      const mid = cubic(a, b, c, d, .5), dx = mid[0] - S.touch.x, dy = mid[1] - S.touch.y;
      const force = 35 * Math.exp(-(dx * dx + dy * dy) / 20000) * S.strength;
      const n = Math.hypot(dx, dy) || 1;
      b = [b[0] + dx / n * force, b[1] + dy / n * force]; c = [c[0] + dx / n * force, c[1] + dy / n * force];
    }
    const { p: line, dots } = connections[key], active = Math.abs(value) > .03;
    line.setAttribute('d', `M${a} C${b} ${c} ${d}`); line.setAttribute('stroke-width', Math.max(2, Math.abs(value) * (theme === 'fluid' ? 5 : 1.8)));
    line.setAttribute('opacity', active ? theme === 'fluid' ? '.26' : '.7' : '.08');
    dots.forEach((dot, i) => { const t = (elapsed * (.05 + Math.abs(value) * .017) + i / dots.length) % 1, xy = cubic(a,b,c,d,t); dot.setAttribute('cx',xy[0]);dot.setAttribute('cy',xy[1]);dot.setAttribute('opacity',active ? '.9' : '0'); });
  }
}
function drawRing(p) {
  let angle = -Math.PI / 2; const values = [p.home, Math.max(0,-p.battery),p.car,Math.max(0,-p.grid)], sum = values.reduce((a,b)=>a+b,0) || 1;
  values.forEach((value,i) => {
    const sweep = value / sum * Math.PI * 2, start = angle + .035, end = Math.max(start, angle + sweep - .035);
    const r = 120 + (S.touch ? 8 * Math.sin(S.phase) * S.strength : 0);
    const a = [200+Math.cos(start)*r,212+Math.sin(start)*r], b = [200+Math.cos(end)*r,212+Math.sin(end)*r];
    arcs[i].setAttribute('d', `M${a} A${r},${r} 0 ${end-start>Math.PI?1:0} 1 ${b}`); arcs[i].setAttribute('opacity',value>.01?'1':'0'); angle+=sweep;
  });
}
function labelValues(p, centers) {
  const pos = theme === 'fluid' ? { ...fluidPositions } : originPositions;
  if (centers && S.route === 'now') {
    ['car','home','battery','grid'].forEach((key,i) => { if (sinks(p)[i] > .15) pos[key] = [Math.max(58,Math.min(345,centers[i].x)),Math.max(90,Math.min(365,centers[i].y))]; });
  }
  for (const [key,el] of Object.entries(labels)) {
    const value = p[key], status = key === 'battery' ? value < -.04 ? 'Charging · 68%' : value > .04 ? 'Discharging · 68%' : 'Idle · 68%' : key === 'grid' ? value > .04 ? 'Importing' : value < -.04 ? 'Exporting' : 'Balanced' : key === 'car' ? value > .04 ? `${S.goal}% by 07:00` : 'Waiting · 62%' : key === 'solar' ? value > .04 ? 'Generating' : 'Sun is down' : 'Using now';
    el.style.left = pos[key][0]/4+'%'; el.style.top = pos[key][1]/4.3+'%';
    el.style.setProperty('--label-ink',theme==='fluid'?'#33322b':colors[key]);
    el.querySelector('strong').textContent = fmt(value)+' kW'; el.querySelector('small').textContent = status;
    el.setAttribute('aria-label', `${names[key]}, ${fmt(value)} kilowatts, ${status}. Open details.`);
  }
}
let last=0, raf=0;
function frame(now) {
  raf=0; const dt=Math.min(.04,last?(now-last)/1000:.016);last=now;
  if (S.running) S.phase+=dt;
  const alpha = reduced.matches ? 1 : 1-Math.exp(-dt*5);
  for(const k of ['solar','home','car','battery'])S.power[k]+=(S.target[k]-S.power[k])*alpha;
  S.power=balance(S.power);const p=S.power;
  S.strength+=(Number(S.pointer !== null)-S.strength)*Math.min(1,dt*9);
  let centers;
  if(theme==='fluid'){
    const g=fieldLayout(sinks(p),400,430,S.phase,S.touch?{...S.touch,strength:S.strength}:null);
    const [left,home,battery,rest]=g.polygons;
    [rest,battery,home,left].forEach((poly,i)=>fieldPaths[i].setAttribute('d',path(poly)));centers=g.centers;
    robot.targetX=Math.max(85,Math.min(315,g.seam(210)));robot.targetY=210;
  }else{robot.targetX=200;robot.targetY=215;}
  routeFlow.setAttribute('display',S.route==='now'?'none':'');routeCursor.setAttribute('x1',S.hour/23*400);routeCursor.setAttribute('x2',S.hour/23*400);
  $('#fields').setAttribute('display',theme==='fluid'&&S.route==='now'?'':'none');
  $('#ring').setAttribute('display',theme==='ring'&&S.route==='now'?'':'none');
  $('#streams').setAttribute('display',S.route==='now'?'':'none');$('#particles').setAttribute('display',S.route==='now'?'':'none');
  $('#sunwash').setAttribute('opacity',S.route==='now'?Math.min(1,p.solar/6):'.2');
  if(S.route==='now'){drawStreams(p,S.phase);if(theme==='ring')drawRing(p);labelValues(p,centers);}
  if(S.route!=='now'){robot.targetX=320;robot.targetY=110;}
  if(!robot.dragging){for(const [key,v,t] of [['x','vx',robot.targetX],['y','vy',robot.targetY]]){robot[v]+=(t-robot[key])*110*dt-robot[v]*18*dt;robot[key]+=robot[v]*dt;}}
  const scene=$('#scene').getBoundingClientRect(),x=robot.x/400*scene.width-43,y=robot.y/430*scene.height-43;
  $('#robot').style.transform=`translate(${x}px,${y}px) rotate(${Math.max(-12,Math.min(12,robot.vx*.025))}deg)`;
  $('#robot').hidden=theme!=='fluid';
  const blink=S.running&&Math.sin(S.phase*.55)>.997;
  $('.eyes').style.transform=`scaleY(${blink ? 0.08 : 1}) translateX(${S.touch?Math.max(-3,Math.min(3,(S.touch.x-robot.x)*.02)):0}px)`;
  const settling=Object.keys(S.target).some(k=>['solar','home','car','battery'].includes(k)&&Math.abs(S.target[k]-S.power[k])>.001)||Math.abs(robot.vx)+Math.abs(robot.vy)>.05||S.strength>.01;
  if(S.visible&&!document.hidden&&(S.running||settling))raf=requestAnimationFrame(frame);
}
function wake(){if(!raf&&S.visible&&!document.hidden){last=0;raf=requestAnimationFrame(frame);}}
function updateMotion(){ $('#motion').textContent=S.running?'Ⅱ':'▶';$('#motion').setAttribute('aria-label',S.running?'Pause motion':'Play motion');wake(); }
$('#motion').addEventListener('click',()=>{S.running=!S.running;updateMotion();});
document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.scenario;animateTo(scenarios[key],scenarios[key].hour);document.querySelectorAll('[data-scenario]').forEach(e=>e.setAttribute('aria-pressed',e===b));}));

for (const b of Object.values(labels)) {
 let start;
 b.addEventListener('pointerdown',e=>{start=point(e);delete b.dataset.dragged;S.pointer=e.pointerId;S.touch=start;b.setPointerCapture(e.pointerId);wake();});
 b.addEventListener('pointermove',e=>{if(S.pointer!==e.pointerId||!start)return;const at=point(e);if(Math.hypot(at.x-start.x,at.y-start.y)>6)b.dataset.dragged='1';S.touch=at;wake();});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>{S.pointer=null;start=null;setTimeout(()=>delete b.dataset.dragged,0);wake();});
}

const energy=$('#energy');
energy.addEventListener('pointerdown',e=>{S.pointer=e.pointerId;S.touch=point(e);energy.setPointerCapture(e.pointerId);wake();});
energy.addEventListener('pointermove',e=>{if(S.pointer===e.pointerId){S.touch=point(e);wake();}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])energy.addEventListener(type,()=>{S.pointer=null;wake();});
const robotButton=$('#robot');
robotButton.addEventListener('pointerdown',e=>{e.preventDefault();robot.dragging=true;S.pointer=e.pointerId;S.touch=point(e);robotButton.setPointerCapture(e.pointerId);wake();});
robotButton.addEventListener('pointermove',e=>{if(robot.dragging){S.touch=point(e);robot.x=Math.max(40,Math.min(360,S.touch.x));robot.y=Math.max(50,Math.min(375,S.touch.y));robot.vx=robot.vy=0;wake();}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])robotButton.addEventListener(type,()=>{robot.dragging=false;S.pointer=null;wake();});
robotButton.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();robot.x+=e.key==='ArrowLeft'?-25:e.key==='ArrowRight'?25:0;robot.y+=e.key==='ArrowUp'?-25:e.key==='ArrowDown'?25:0;S.touch={x:robot.x,y:robot.y};S.strength=.8;wake();});
const timeline=$('#timeline');
function scrub(e){const r=timeline.getBoundingClientRect();selectHour((e.clientX-r.left)/r.width*23);}
timeline.addEventListener('pointerdown',e=>{timeline.setPointerCapture(e.pointerId);scrub(e);});
timeline.addEventListener('pointermove',e=>{if(timeline.hasPointerCapture(e.pointerId))scrub(e);});
timeline.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();selectHour(e.key==='Home'?0:e.key==='End'?23:S.hour+(e.key==='ArrowRight'?1:-1));}});
function openDetail(key){S.detail=key;$('#detail').hidden=false;updateDetail();$('#back').focus();}
function updateDetail(){
  const key=S.detail;if(!key)return;const p=S.target,value=p[key];
  $('#detail-kicker').textContent='Example home';$('#detail-title').textContent=names[key];
  $('#detail-number').textContent=key==='car'?'62%':key==='battery'?'68%':fmt(value)+' kW';
  $('#detail-description').textContent=key==='solar'?'Warm light feeds the whole home. Solar only supplies energy.':key==='home'?'Household demand, separate from the car and home battery.':key==='grid'?value>.04?'Energy is entering the site through its single grid connection.':value<-.04?'Surplus energy leaves the site through its single grid connection.':'The home is balanced without grid power.':key==='battery'?value<0?`Charging from the shared energy flow at ${fmt(value)} kW.`:`Supplying the home at ${fmt(value)} kW.`:`Charging at ${fmt(value)} kW towards your departure goal.`;
  let extra='';
  if(key==='car')extra=`<div class="goal-summary">Ready by 07:00 · Goal <strong id="goal-value">${S.goal}%</strong></div><div class="goal-buttons" role="group" aria-label="Example car charge goal">${[60,80,100].map(n=>`<button type="button" data-goal="${n}" aria-pressed="${S.goal===n}">${n}%</button>`).join('')}</div><p class="detail-message" id="goal-message">Choose a goal to try the interaction.</p>`;
  else if(key==='battery')extra='<div class="stat-line"><span>Stored energy</span><strong>9.5 kWh</strong></div><div class="stat-line"><span>Capacity</span><strong>14 kWh</strong></div><div class="stat-line"><span>Evening reserve</span><strong>30%</strong></div>';
  else if(key==='grid')extra='<p class="detail-message">Example current per phase · Main fuse 16 A</p>'+[.46,.34,.2].map(weight=>Math.abs(value)*1000/230*weight).map((n,i)=>`<div class="phase"><span>L${i+1}</span><i style="width:${n/16*100}%"></i><span>${n.toFixed(1)} A</span></div>`).join('');
  else extra=`<div class="stat-line"><span>Today so far</span><strong>${key==='solar'?'28.4':'12.6'} kWh</strong></div><p class="detail-message">Tap Back, then drag across the graph to explore another hour.</p>`;
  $('#detail-extra').innerHTML=extra;$('#detail-extra').className='detail-extra';
}
$('#detail-extra').addEventListener('click',e=>{const b=e.target.closest('[data-goal]');if(!b)return;S.goal=Number(b.dataset.goal);updateDetail();$('#goal-message').textContent=`Example goal changed to ${S.goal}% by 07:00.`;$('#detail-extra').querySelector(`[data-goal="${S.goal}"]`).focus();wake();});
$('#back').addEventListener('click',()=>{const key=S.detail;S.detail=null;$('#detail').hidden=true;labels[key]?.focus();});
document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>{
  S.route=b.dataset.route;S.detail=null;$('#detail').hidden=true;$('#phone').classList.toggle('route-mode',S.route!=='now');
  $('.route-heading')?.remove();if(S.route!=='now'){const h=document.createElement('div');h.className='route-heading';h.innerHTML=S.route==='plan'?'<h2>Energy follows your day.</h2><p>Scrub the graph to see solar, stored energy and the car working together.</p>':'<h2>A day in balance.</h2><p>28.4 kWh from solar. Explore the example day below.</p>';$('#scene').append(h);}
  document.querySelectorAll('[data-route]').forEach(e=>e.setAttribute('aria-pressed',e===b));wake();
}));
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});
new IntersectionObserver(entries=>{S.visible=entries[0].isIntersecting;if(S.visible)wake();else{cancelAnimationFrame(raf);raf=0;}}).observe($('#phone'));
reduced.addEventListener('change',()=>{if(reduced.matches)S.running=false;updateMotion();});
updateTime();updateMotion();
