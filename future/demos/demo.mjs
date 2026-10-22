import { balance, scenarios, hourProfile, sinks, fieldLayout, hitField, allocateDrag, storedLevel, smoothCurve } from './model.mjs?v=fluid-3';
import { clamp, mod, springPoint, stepSpring, sampleStream, pointAlong } from './motion.mjs?v=fluid-3';
import { demoConfigs } from './variants.mjs?v=fluid-3';

const $ = selector => document.querySelector(selector);
const ns = 'http://www.w3.org/2000/svg';
const requested = new URLSearchParams(location.search).get('concept');
const id = Object.hasOwn(demoConfigs, requested) ? requested : 'fluid-app';
const config = demoConfigs[id];
const { theme } = config;
const fluid = theme === 'fluid';
const character = theme === 'character';
const reservoir = theme === 'reservoir';
const soft = fluid || character || reservoir;
const withRobot = soft || config.robot;
const phone = $('#phone');
phone.classList.add(theme);
phone.classList.toggle('soft', soft);
phone.dataset.concept = id;
phone.dataset.palette = config.palette || 'cream';
$('#demo-title').textContent = config.name;
const initial=balance(config.power||scenarios.sun);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const S = {
  hour:14, clock:14, target:{...initial}, power:{...initial}, baseline:{...initial},
  route:'now', running:!reduced.matches, phase:0, goal:80, detail:null,
  visible:true, painted:false, pointer:null, gesture:null, look:null, cycle:false, mood:'float',
  level:storedLevel(14), levelTarget:storedLevel(14), edited:false,
  grab:springPoint(), anchor:springPoint(200,215), robot:springPoint(190,145), nudge:{x:0,y:0}, layout:null
};
const colors = { solar:'#ffd052', home:theme==='ring'?'#55cfe5':'#b7c3ce', battery:theme==='ring'?'#ffb754':'#78dcd7', car:'#b29be9', grid:'#e458a8' };
const names = { solar:'Solar', home:'Home', battery:'Home battery', car:'Car', grid:'Grid connection' };
const format = n => Math.abs(n).toFixed(1);
const geometry = { width:400, height:430, left:0, top:120 };
let last=0, raf=0, labelTime=0;
const originPositions = { solar:[82,66], battery:[318,66], car:[318,354], grid:[82,354], home:[200,212] };
const fluidPositions = { solar:[80,35], home:[312,100], car:[83,249], battery:[296,302], grid:[80,374] };
const reservoirPositions = { solar:[72,48], battery:[220,60], home:[65,200], car:[65,305], grid:[320,374] };
const labelBodies = Object.fromEntries(Object.entries(fluidPositions).map(([key,p])=>[key,springPoint(...p)]));

function svg(tag, attrs, parent) {
  const element=document.createElementNS(ns,tag);
  for(const [key,value] of Object.entries(attrs))element.setAttribute(key,value);
  parent?.append(element);
  return element;
}
function polygonPath(points) {
  if(!points.length)return '';
  return points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')+' Z';
}
function point(event, element=$('#scene')) {
  const rect=element.getBoundingClientRect();
  return {x:(event.clientX-rect.left)/rect.width*400,y:(event.clientY-rect.top)/rect.height*430};
}
function measure() {
  const scene=$('#scene').getBoundingClientRect(), root=phone.getBoundingClientRect();
  Object.assign(geometry,{width:scene.width,height:scene.height,left:scene.left-root.left,top:scene.top-root.top});
  wake();
}
new ResizeObserver(measure).observe($('#scene'));

function animateTo(power, hour, manual=true) {
  S.target=balance(power); S.baseline={...S.target}; S.hour=hour; S.clock=hour;
  S.levelTarget=storedLevel(hour);
  if(manual)stopCycle();
  S.edited=false; updateTime(); updateHint();
  if(S.detail)updateDetail();
  wake();
}
function selectHour(hour) {
  const h=clamp(Math.round(hour),0,23);
  animateTo(hourProfile(h),h);
  document.querySelectorAll('[data-scenario]').forEach(button=>button.setAttribute('aria-pressed','false'));
}
function updateTime() {
  $('#time').textContent=String(Math.floor(S.hour)).padStart(2,'0')+':00';
  $('#time-caption').textContent=S.edited?'Your example flow':S.target.solar>2?'Solar powers the home':S.target.grid>.1?'Grid and stored energy supply the home':S.target.battery>.1?'The battery covers the home':'A balanced home';
  const x=S.hour/23*400;
  $('#cursor').setAttribute('x1',x); $('#cursor').setAttribute('x2',x);
  $('#cursor-dot').setAttribute('cx',x);
  $('#timeline').setAttribute('aria-valuenow',Math.round(S.hour));
  $('#timeline').setAttribute('aria-valuetext',`${Math.round(S.hour)}:00, ${$('#time-caption').textContent}`);
}
for(const key of ['solar','battery','car','home']) {
  const points=Array.from({length:24},(_,hour)=>[hour/23*400,67-Math.abs(hourProfile(hour)[key])/7*60]);
  svg('path',{d:smoothCurve(points)+' L400,70 L0,70 Z',fill:colors[key],opacity:key==='solar'?'.7':'.4'},$('#curves'));
}
const labels={};
for(const key of Object.keys(names)) {
  const button=document.createElement('button');
  button.className='scene-label'; button.dataset.device=key;
  button.innerHTML=`<span>${names[key]}</span><strong></strong><small></small>`;
  button.addEventListener('click',event=>{if(event.detail===0||!button.dataset.dragged)openDetail(key);delete button.dataset.dragged;});
  button.addEventListener('keydown',event=>{
    if(character||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault(); stopCycle();
    const dx=event.key==='ArrowLeft'?-20:event.key==='ArrowRight'?20:0;
    const dy=event.key==='ArrowUp'?-20:event.key==='ArrowDown'?20:0;
    S.target=allocateDrag(S.target,key,dx,dy); S.edited=true;
    const position=labelBodies[key]; S.anchor.x=position.x; S.anchor.y=position.y;
    S.grab.vx+=dx*10; S.grab.vy+=dy*10;
    updateHint(); updateTime(); wake();
  });
  $('#labels').append(button); labels[key]=button;
}
const fieldPaths=['grid','battery','home','car'].map(key=>svg('path',{fill:`url(#${key}-fill)`,filter:'url(#soft-edge)'},$('#fields')));
const edge=svg('path',{fill:'none',stroke:'#fff','stroke-width':3,'stroke-opacity':'.14','pointer-events':'none'},$('#field-edges'));
const connections={};
for(const key of Object.keys(names)) {
  const path=svg('path',{fill:'none',stroke:colors[key],'stroke-linecap':'round','stroke-linejoin':'round'},$('#streams'));
  const dots=Array.from({length:7},(_,i)=>svg('circle',{r:i===0?3:2,fill:colors[key]},$('#particles')));
  connections[key]={path,dots,phase:0};
}
svg('circle',{cx:200,cy:212,r:120,fill:'none',stroke:'#293142','stroke-width':16},$('#ring'));
const arcs=[colors.home,colors.battery,colors.car,colors.grid].map(color=>svg('path',{fill:'none',stroke:color,'stroke-width':16,'stroke-linecap':'round'},$('#ring')));
const routeFlow=svg('g',{display:'none'},$('#energy'));
for(const key of ['car','home','battery','solar']) {
  const points=Array.from({length:24},(_,h)=>[h/23*400,410-Math.abs(hourProfile(h)[key])/7*165]);
  svg('path',{d:smoothCurve(points)+' L400,430 L0,430 Z',fill:colors[key],opacity:'.4'},routeFlow);
}
const routeCursor=svg('line',{y1:235,y2:430,stroke:'currentColor','stroke-opacity':'.3'},routeFlow);
const vessel=svg('g',{},$('#reservoir'));
svg('rect',{x:129,y:94,width:151,height:278,rx:48,fill:'#ffffff36',stroke:'#90836c55','stroke-width':1.5},vessel);
svg('rect',{x:137,y:102,width:135,height:262,rx:41,fill:'#c8c0a226'},vessel);
svg('path',{d:'M147,137 Q143,113 164,111',fill:'none',stroke:'#fff','stroke-width':5,'stroke-linecap':'round',opacity:'.5'},vessel);
const fill=svg('path',{fill:'url(#stored-fill)','clip-path':'url(#vessel-clip)'},vessel);
const fillEdge=svg('path',{fill:'none',stroke:'#fff4bd','stroke-width':3,opacity:'.7','clip-path':'url(#vessel-clip)'},vessel);
svg('text',{x:204,y:395,'text-anchor':'middle',fill:'currentColor','font-size':11,opacity:'.5'},vessel).textContent='14 kWh home battery';

const tools=$('#study-tools');
if(config.tools==='battery') {
  tools.innerHTML='<button type="button" data-tool="fill">Fill from solar</button><button type="button" data-tool="drain">Power the home</button>';
} else if(config.tools==='priority') {
  tools.innerHTML='<button type="button" data-tool="car">Car first</button><button type="button" data-tool="store">Store first</button>';
} else if(config.cycle) {
  tools.innerHTML='<button type="button" id="cycle-day" aria-pressed="false">Play a day</button><span>Or drag the graph below</span>';
} else if(character) {
  tools.innerHTML='<button type="button" data-mood="float" aria-pressed="true">Float</button><button type="button" data-mood="follow" aria-pressed="false">Follow</button><button type="button" data-mood="rest" aria-pressed="false">Rest</button>';
}
tools.hidden=!tools.childElementCount;
if(character) {
  $('#scenarios').hidden=true; $('#timeline-section').hidden=true; $('#app-nav').hidden=true;
  $('#character-caption').hidden=false;
  phone.style.setProperty('--robot-size','146px');
}
$('#robot').hidden=!withRobot;
if(config.close)phone.classList.add('closer');
function updateHint() {
  $('#touch-hint').textContent=character?'Drag, flick or give the robot a nudge.':reservoir?'Drag the level to fill or drain.':S.gesture?.kind==='robot'?'Let go and feel it settle.':S.edited?'Example changed. Drag another field.':'Drag a field. The energy follows.';
  $('#reset-example').hidden=character||!S.edited;
  $('#cycle-day')?.setAttribute('aria-pressed',S.cycle);
  if($('#cycle-day'))$('#cycle-day').textContent=S.cycle?'Pause the day':'Play a day';
}
function stopCycle() { S.cycle=false; updateHint(); }
$('#study-tools').addEventListener('click',event=>{
  const button=event.target.closest('button'); if(!button)return;
  if(button.id==='cycle-day') {
    S.cycle=!S.cycle; if(S.cycle){S.running=true;updateMotion();} updateHint(); wake(); return;
  }
  if(button.dataset.mood) {
    S.mood=button.dataset.mood;
    document.querySelectorAll('[data-mood]').forEach(b=>b.setAttribute('aria-pressed',b===button));
    wake(); return;
  }
  if(button.dataset.tool==='fill')animateTo(scenarios.sun,16);
  if(button.dataset.tool==='drain')animateTo(scenarios.evening,22);
  if(button.dataset.tool==='car') {
    S.target=balance({...S.target,car:4,battery:-.6}); S.edited=true;
  }
  if(button.dataset.tool==='store') {
    S.target=balance({...S.target,car:.4,battery:-3.6}); S.edited=true;
  }
  updateTime(); updateHint(); wake();
});
$('#reset-example').addEventListener('click',()=>animateTo(S.baseline,S.hour));

function layoutLabels(power, layout, dt) {
  const positions=Object.fromEntries(Object.entries(reservoir?reservoirPositions:fluid?fluidPositions:originPositions).map(([key,p])=>[key,[...p]]));
  if(fluid&&layout) {
    ['car','home','battery','grid'].forEach((key,i)=>{
      if(sinks(power)[i]>.12)positions[key]=[clamp(layout.centers[i].x,65,332),clamp(layout.centers[i].y,90,360)];
    });
    // Keep text readable as very small regions grow or disappear.
    const keys=['home','battery','car','grid'];
    for(let pass=0;pass<3;pass++)for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++) {
      const a=positions[keys[i]],b=positions[keys[j]],dx=b[0]-a[0],dy=b[1]-a[1];
      if(Math.abs(dx)<112&&Math.abs(dy)<83) {
        const push=(83-Math.abs(dy))*.52,sign=dy>=0?1:-1;
        a[1]=clamp(a[1]-push*sign,90,363); b[1]=clamp(b[1]+push*sign,90,363);
      }
    }
  }
  for(const [key,element] of Object.entries(labels)) {
    const target={x:positions[key][0],y:positions[key][1]},body=labelBodies[key];
    if(reduced.matches||!soft||!S.painted){body.x=target.x;body.y=target.y;}else stepSpring(body,target,dt,145,24);
    element.style.left=body.x/4+'%'; element.style.top=body.y/4.3+'%';
    element.style.setProperty('--label-ink',soft?'var(--soft-ink)':colors[key]);
  }
  return positions;
}
function labelValues(power) {
  for(const [key,element] of Object.entries(labels)) {
    const value=power[key];
    const status=key==='battery'?`${value<-.04?'Charging':value>.04?'Discharging':'Idle'} · ${Math.round(S.level)}%`:key==='grid'?value>.04?'Importing':value<-.04?'Exporting':'Balanced':key==='car'?value>.04?`${S.goal}% by 07:00`:'Waiting · 62%':key==='solar'?value>.04?'Generating':'Sun is down':'Using now';
    const text=reservoir&&key==='battery'?Math.round(S.level)+'%':format(value)+' kW';
    if(element.querySelector('strong').textContent!==text)element.querySelector('strong').textContent=text;
    if(element.querySelector('small').textContent!==status)element.querySelector('small').textContent=status;
    const label=`${names[key]}, ${format(value)} kilowatts, ${status}. Drag or use arrow keys to change the example. Press Enter for details.`;
    if(element.getAttribute('aria-label')!==label)element.setAttribute('aria-label',label);
  }
}
function streamGeometry(power, layout) {
  let hub=[200,212], destinations={...originPositions}, map=p=>p;
  if(fluid&&layout) {
    const y=clamp(layout.baseJunction[1],135,290);
    hub=[layout.baseSeam(y),y]; map=layout.map;
    destinations={solar:[100,-10],grid:[52,430],home:fluidPositions.home,battery:fluidPositions.battery,car:fluidPositions.car};
    ['car','home','battery'].forEach((key,i)=>{
      const weight=key==='home'?1:clamp(sinks(power)[i]/.6,0,1);
      const center=layout.baseCenters[i],fallback=destinations[key];
      destinations[key]=[fallback[0]+(center.x-fallback[0])*weight,fallback[1]+(center.y-fallback[1])*weight];
    });
  } else if(reservoir) {
    hub=[200,220];destinations={...reservoirPositions,battery:[204,360-S.level*2.5],solar:[74,10],grid:[328,430]};
    map=layout?.map||map;
  }
  return {hub,destinations,map};
}
function drawStreams(power,layout,dt) {
  const {hub,destinations,map}=streamGeometry(power,layout);
  for(const [key,connection] of Object.entries(connections)) {
    let start=hub,end=destinations[key];
    if(!soft) {
      const length=Math.hypot(end[0]-hub[0],end[1]-hub[1])||1;
      start=[hub[0]+(end[0]-hub[0])/length*58,hub[1]+(end[1]-hub[1])/length*58];
    }
    const stream=sampleStream(start,end,map,soft?16*Math.sin(S.phase*.2):0);
    connection.path.setAttribute('d',smoothCurve(stream.points));
    const value=power[key];
    // Fixed curve orientation; signed phase reverses particles in place.
    const outward=key==='home'||key==='car'?value:-value;
    if(S.running)connection.phase=mod(connection.phase+dt*outward*.035);
    const activity=clamp(Math.abs(value)/.3,0,1);
    connection.path.setAttribute('stroke-width',Math.max(.8,Math.abs(value)*(soft?2.8:2.1)));
    connection.path.setAttribute('opacity',.02+activity*(soft ? .16 : .58));
    connection.dots.forEach((dot,i)=>{
      const p=pointAlong(stream,connection.phase+i/connection.dots.length);
      dot.setAttribute('cx',p[0]);dot.setAttribute('cy',p[1]);
      dot.setAttribute('opacity',activity*.85);
    });
  }
}
function drawRing(power) {
  let angle=-Math.PI/2;
  const values=[power.home,Math.max(0,-power.battery),power.car,Math.max(0,-power.grid)];
  const sum=values.reduce((a,b)=>a+b,0)||1;
  values.forEach((value,i)=>{
    const sweep=value/sum*Math.PI*2,start=angle+.035,end=Math.max(start,angle+sweep-.035);
    const r=120+S.grab.x*.06;
    const a=[200+Math.cos(start)*r,212+Math.sin(start)*r],b=[200+Math.cos(end)*r,212+Math.sin(end)*r];
    arcs[i].setAttribute('d',`M${a} A${r},${r} 0 ${end-start>Math.PI?1:0} 1 ${b}`);
    arcs[i].setAttribute('opacity',value>.01?'1':'0');angle+=sweep;
  });
}
function drawReservoir(layout) {
  const y=360-S.level*2.5;
  const wave=Array.from({length:25},(_,i)=>layout.map([125+i*160/24,y+5*Math.sin(i/24*Math.PI*2+S.phase*1.1)]));
  const line=smoothCurve(wave);
  fill.setAttribute('d',line+' L285,375 L125,375 Z');fillEdge.setAttribute('d',line);
}
function drawRobot(layout,dt) {
  if(!withRobot)return;
  let target={x:200,y:130};
  if(fluid&&layout)target={x:clamp(layout.robotAnchor[0],74,326),y:layout.robotAnchor[1]};
  if(reservoir)target={x:321,y:145};
  if(character)target={x:200+Math.sin(S.phase*.4)*23,y:205+Math.cos(S.phase*.55)*12};
  if(character&&S.mood==='rest')target={x:200,y:270};
  if(character&&S.mood==='follow'&&S.look)target={x:clamp(S.look.x,65,335),y:clamp(S.look.y,70,350)};
  if(S.route!=='now')target={x:320,y:100};
  if(S.detail)target={x:320,y:22};
  target={x:clamp(target.x+S.nudge.x,40,360),y:clamp(target.y+S.nudge.y,25,385)};
  const held=S.gesture?.kind==='robot';
  if(held)target=S.gesture.robotTarget;
  if(reduced.matches||!S.painted){S.robot.x=target.x;S.robot.y=target.y;S.robot.vx=S.robot.vy=0;}
  else stepSpring(S.robot,target,dt,held?980:145,held?48:17);
  const size=character?146:88;
  const x=geometry.left+S.robot.x/400*geometry.width-size/2;
  const y=geometry.top+S.robot.y/430*geometry.height-size/2;
  const tilt=clamp(S.robot.vx*.027,-17,17)+(S.running?Math.sin(S.phase*.8)*1.5:0);
  const stretch=held?clamp(Math.hypot(S.robot.vx,S.robot.vy)*.00008,0,.045):0;
  $('#robot').style.transform=`translate3d(${x}px,${y}px,0) rotate(${tilt}deg) scale(${1-stretch},${1+stretch})`;
  const blink=S.mood==='rest'||S.running&&Math.sin(S.phase*.55)>.998;
  const look=S.look?clamp((S.look.x-S.robot.x)*.025,-3,3):0;
  $('.eyes').style.transform=`translateX(${look}px) scaleY(${blink ? .09 : 1})`;
}
function frame(now) {
  raf=0;
  const dt=Math.min(.05,last?(now-last)/1000:1/60);last=now;
  if(S.running)S.phase+=dt;
  if(S.cycle&&S.running) {
    S.clock=mod(S.clock+dt*.65,24);S.hour=Math.min(23,S.clock);
    S.target=hourProfile(S.hour);S.baseline={...S.target};S.levelTarget=storedLevel(S.clock);updateTime();
    document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed','false'));
  }
  const alpha=reduced.matches?1:1-Math.exp(-dt*7);
  for(const key of ['solar','home','car','battery'])S.power[key]+=(S.target[key]-S.power[key])*alpha;
  S.power=balance(S.power);S.level+=(S.levelTarget-S.level)*alpha;
  const gesture=S.gesture;
  const target=gesture&&gesture.kind!=='time'?{x:gesture.initial.x+gesture.dx*(config.elastic||1),y:gesture.initial.y+gesture.dy*(config.elastic||1)}:{x:0,y:0};
  if(reduced.matches){S.grab.x=target.x;S.grab.y=target.y;S.grab.vx=S.grab.vy=0;}
  else stepSpring(S.grab,target,dt,gesture?340:175,gesture?26:15);
  if(gesture)stepSpring(S.anchor,gesture.anchor,dt,240,27);
  const grab={x:S.anchor.x,y:S.anchor.y,dx:S.grab.x,dy:S.grab.y};
  let layout;
  if(soft) {
    layout=fieldLayout(sinks(S.power),400,430,S.phase,grab);S.layout=layout;
    if(fluid||character) {
      const [car,home,battery,rest]=layout.polygons;
      [rest,battery,home,car].forEach((polygon,i)=>fieldPaths[i].setAttribute('d',polygonPath(polygon)));
      edge.setAttribute('d',smoothCurve(car.slice(1,-1)));
    }
    if(reservoir)drawReservoir(layout);
  }
  const overview=S.route==='now';
  $('#fields').setAttribute('display',(fluid||character)&&overview?'':'none');
  $('#field-edges').setAttribute('display',fluid&&overview?'':'none');
  $('#ring').setAttribute('display',theme==='ring'&&overview?'':'none');
  $('#reservoir').setAttribute('display',reservoir&&overview?'':'none');
  $('#streams').setAttribute('display',overview&&!character?'':'none');
  $('#particles').setAttribute('display',overview&&!character?'':'none');
  $('#sunwash').setAttribute('opacity',overview?Math.min(.85,S.power.solar/7):'.12');
  $('#sunwash').setAttribute('rx',210+S.power.solar*16);
  $('#touch-glow').setAttribute('cx',S.anchor.x+S.grab.x*.5);
  $('#touch-glow').setAttribute('cy',S.anchor.y+S.grab.y*.5);
  $('#touch-glow').setAttribute('opacity',Math.min(.5,Math.hypot(S.grab.x,S.grab.y)/150));
  if(config.palette==='night')phone.classList.toggle('night',S.power.solar<1.5);
  routeFlow.setAttribute('display',overview?'none':'');
  routeCursor.setAttribute('x1',S.hour/23*400);routeCursor.setAttribute('x2',S.hour/23*400);
  if(overview&&!character) {
    layoutLabels(S.power,layout,dt);drawStreams(S.power,layout,dt);
    if(theme==='ring')drawRing(S.power);
    labelTime+=dt;
    if(labelTime>.075){labelTime=0;labelValues(S.power);}
  }
  drawRobot(layout,dt);
  S.painted=true;phone.dataset.painted='true';
  const moving=Math.abs(S.grab.x)+Math.abs(S.grab.y)+Math.abs(S.grab.vx)+Math.abs(S.grab.vy)>.025||
    Math.abs(S.robot.vx)+Math.abs(S.robot.vy)>.05||Math.abs(S.levelTarget-S.level)>.01||
    ['solar','home','car','battery'].some(key=>Math.abs(S.target[key]-S.power[key])>.001);
  if(S.visible&&!document.hidden&&(S.running||moving||S.gesture))raf=requestAnimationFrame(frame);
}
function wake() { if(!raf&&S.visible&&!document.hidden){last=0;raf=requestAnimationFrame(frame);} }
function updateMotion() {
  $('#motion').textContent=S.running?'Ⅱ':'▶';
  $('#motion').setAttribute('aria-label',S.running?'Pause motion':'Play motion');wake();
}
$('#motion').addEventListener('click',()=>{S.running=!S.running;if(!S.running)stopCycle();updateMotion();});
function chooseScenario(button) {
  const scenario=scenarios[button.dataset.scenario];animateTo(scenario,scenario.hour);
  document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',b===button));
}
document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>chooseScenario(b)));

function begin(event, kind, element) {
  if(event.button!==0||S.pointer!==null)return;
  const at=point(event);stopCycle();
  S.pointer=event.pointerId;S.look=at;S.nudge={x:0,y:0};
  const key=kind==='field'?(S.route!=='now'?'time':reservoir?'battery':S.layout?hitField(S.layout,[at.x,at.y]):'car'):kind;
  S.gesture={kind:key,anchor:at,initial:{x:S.grab.x,y:S.grab.y},base:{...S.target},dx:0,dy:0,element,moved:false,
    robotOffset:{x:S.robot.x-at.x,y:S.robot.y-at.y},robotTarget:{x:S.robot.x,y:S.robot.y}};
  if(Math.hypot(S.grab.x,S.grab.y)<.3){S.anchor.x=at.x;S.anchor.y=at.y;}
  delete element.dataset.dragged;
  element.setPointerCapture(event.pointerId);phone.classList.add('is-grabbing');
  if(key==='time')selectHour(at.x/400*23);
  updateHint();wake();
}
function move(event) {
  const at=point(event);S.look=at;
  const g=S.gesture;
  if(!g||S.pointer!==event.pointerId){if(character)wake();return;}
  g.dx=at.x-g.anchor.x;g.dy=at.y-g.anchor.y;
  if(Math.hypot(g.dx,g.dy)>5){g.moved=true;g.element.dataset.dragged='1';}
  if(g.kind==='robot')g.robotTarget={x:clamp(at.x+g.robotOffset.x,38,362),y:clamp(at.y+g.robotOffset.y,25,385)};
  else if(g.kind==='time')selectHour(at.x/400*23);
  else if(g.moved&&!character) {
    S.target=allocateDrag(g.base,g.kind,g.dx,g.dy);S.edited=true;
    if(reservoir&&g.kind==='battery')S.levelTarget=clamp((360-at.y)/250*100,0,100);
    updateTime();updateHint();
  }
  wake();
}
function end(event,cancelled=false) {
  if(S.pointer!==event.pointerId)return;
  const g=S.gesture;
  if(cancelled&&g&&g.kind!=='robot'&&g.kind!=='time'){S.target=g.base;S.edited=false;updateTime();}
  S.pointer=null;S.gesture=null;phone.classList.remove('is-grabbing');updateHint();wake();
}
function wireDrag(element,kind) {
  element.addEventListener('pointerdown',event=>begin(event,kind,element));
  element.addEventListener('pointermove',move);
  element.addEventListener('pointerup',event=>end(event));
  element.addEventListener('pointercancel',event=>end(event,true));
  element.addEventListener('lostpointercapture',event=>end(event,true));
}
wireDrag($('#energy'),'field');
for(const [key,element] of Object.entries(labels))wireDrag(element,key);
wireDrag($('#robot'),'robot');
$('#robot').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();
  const dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;
  const dy=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0;
  if(reduced.matches){S.nudge.x+=dx*22;S.nudge.y+=dy*22;}else{S.robot.vx+=dx*430;S.robot.vy+=dy*430;}
  S.anchor.x=S.robot.x;S.anchor.y=S.robot.y;S.grab.vx+=dx*170;S.grab.vy+=dy*170;
  S.look={x:S.robot.x+dx*60,y:S.robot.y+dy*60};wake();
});
const timeline=$('#timeline');
function scrub(event) {const rect=timeline.getBoundingClientRect();selectHour((event.clientX-rect.left)/rect.width*23);}
timeline.addEventListener('pointerdown',event=>{timeline.setPointerCapture(event.pointerId);scrub(event);});
timeline.addEventListener('pointermove',event=>{if(timeline.hasPointerCapture(event.pointerId))scrub(event);});
timeline.addEventListener('keydown',event=>{
  if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
    event.preventDefault();selectHour(event.key==='Home'?0:event.key==='End'?23:S.hour+(event.key==='ArrowRight'?1:-1));
  }
});
function openDetail(key) {
  S.detail=key;$('#detail').hidden=false;phone.classList.add('detail-open');updateDetail();$('#back').focus();wake();
}
function updateDetail() {
  const key=S.detail;if(!key)return;
  const value=S.target[key];
  $('#detail-title').textContent=names[key];
  $('#detail-number').textContent=key==='car'?'62%':key==='battery'?Math.round(S.level)+'%':format(value)+' kW';
  $('#detail-description').textContent=key==='solar'?'Warm light feeds the whole home. Solar only supplies energy.':key==='home'?'Household demand, separate from the car and home battery.':key==='grid'?value>.04?'Energy enters the site through its single grid connection.':value<-.04?'Surplus energy leaves through the same grid connection.':'The home is balanced without grid power.':key==='battery'?value<0?`Charging at ${format(value)} kW.`:`Supplying the home at ${format(value)} kW.`:value<.04?'The car is waiting; its example goal is already met.':`Charging at ${format(value)} kW towards your departure goal.`;
  let extra;
  if(key==='car')extra=`<div class="goal-summary">Ready by 07:00 · Goal <strong>${S.goal}%</strong></div><div class="goal-buttons" role="group" aria-label="Example car charge goal">${[60,80,100].map(n=>`<button type="button" data-goal="${n}" aria-pressed="${S.goal===n}">${n}%</button>`).join('')}</div><p class="detail-message" id="goal-message">Choose a goal to try the interaction.</p>`;
  else if(key==='battery')extra=`<div class="stat-line"><span>Stored energy</span><strong>${(S.level*.14).toFixed(1)} kWh</strong></div><div class="stat-line"><span>Capacity</span><strong>14 kWh</strong></div><div class="stat-line"><span>Evening reserve</span><strong>30%</strong></div>`;
  else if(key==='grid')extra='<p class="detail-message">Example current per phase · Main fuse 16 A</p>'+[.46,.34,.2].map(weight=>Math.abs(value)*1000/230*weight).map((n,i)=>`<div class="phase"><span>L${i+1}</span><i style="width:${n/16*100}%"></i><span>${n.toFixed(1)} A</span></div>`).join('');
  else extra='<p class="detail-message">Go back, then drag a field or scrub the graph to try another example.</p>';
  $('#detail-extra').innerHTML=extra;$('#detail-extra').className='detail-extra';
}
$('#detail-extra').addEventListener('click',event=>{
  const button=event.target.closest('[data-goal]');if(!button)return;
  S.goal=Number(button.dataset.goal);S.target=balance({...S.target,car:S.goal<=62?0:S.goal===80?1.8:3.6});S.edited=true;updateTime();updateHint();updateDetail();$('#goal-message').textContent=`Example goal changed to ${S.goal}% by 07:00.`;
  $('#detail-extra').querySelector(`[data-goal="${S.goal}"]`).focus();labelValues(S.power);wake();
});
$('#back').addEventListener('click',()=>{
  const key=S.detail;S.detail=null;$('#detail').hidden=true;phone.classList.remove('detail-open');labels[key]?.focus();wake();
});
document.querySelectorAll('[data-route]').forEach(button=>button.addEventListener('click',()=>{
  S.route=button.dataset.route;S.nudge={x:0,y:0};S.detail=null;$('#detail').hidden=true;phone.classList.remove('detail-open');
  phone.classList.toggle('route-mode',S.route!=='now');$('.route-heading')?.remove();
  if(S.route!=='now') {
    const heading=document.createElement('div');heading.className='route-heading';
    heading.innerHTML=S.route==='plan'?'<h2>Energy follows your day.</h2><p>Drag the graph to explore the home, stored energy and car.</p>':'<h2>A day in balance.</h2><p>Follow the example day in the graph below.</p>';
    $('#scene').append(heading);
  }
  document.querySelectorAll('[data-route]').forEach(b=>b.setAttribute('aria-pressed',b===button));wake();
}));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(S.pointer!==null)end({pointerId:S.pointer},true);
    cancelAnimationFrame(raf);raf=0;
  }else wake();
});
new IntersectionObserver(entries=>{
  S.visible=entries[0].isIntersecting;
  if(S.visible)wake();else{cancelAnimationFrame(raf);raf=0;}
}).observe(phone);
reduced.addEventListener('change',()=>{if(reduced.matches){S.running=false;stopCycle();}updateMotion();});
labelValues(S.power);updateTime();updateHint();measure();updateMotion();
phone.dataset.ready='true';
document.querySelectorAll('[data-scenario],#motion').forEach(button=>button.disabled=false);
