import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { concepts } from '../future/catalog.mjs';
import { families, demoIds, familyFor } from '../future/families.mjs';
import { scenarios, balance, hourProfile, mix, sinks, fieldLayout, polygonArea } from '../future/demos/model.mjs';

test('families partition the existing proposals without changing their vote identities', () => {
  const ids = families.flatMap(f => f.ids);
  assert.equal(ids.length, 45);
  assert.equal(new Set(ids).size, 45);
  assert.deepEqual([...ids].sort(), concepts.map(c => c.id).sort());
  for (const id of demoIds) assert.ok(familyFor(id));
  assert.deepEqual(concepts.map(c => c.code).sort(), Array.from({length:45},(_,i)=>`F${String(i+1).padStart(2,'0')}`));
});

test('every published image has English coverage and earlier Swedish films are replaced', () => {
  const manifest = JSON.parse(readFileSync(new URL('../future/artwork-localization.json', import.meta.url)));
  assert.equal(manifest.artworks.length, 43);
  for (const c of concepts) {
    for (const [i,m] of c.media.entries()) {
      assert.equal(m.language, 'en', `${c.id}, image ${i}`);
      assert.ok(existsSync(new URL('../future/'+m.src, import.meta.url)));
      assert.ok(existsSync(new URL('../future/'+m.thumb, import.meta.url)));
      if (m.src.startsWith('assets/en/')) assert.ok(manifest.artworks.some(a=>a.id===c.id&&a.index===i&&a.output===m.src));
    }
    if (c.video) assert.equal(c.id,'robot-b', 'Only the language-free character film remains');
  }
});

test('all scenarios, hours and transitions conserve energy through one signed grid connection', () => {
  const values = [...Object.values(scenarios).map(balance), ...Array.from({length:24},(_,h)=>hourProfile(h))];
  for (const a of values) for (const b of values) for (const t of [0,.25,.5,.75,1]) {
    const p=mix(a,b,t);
    assert.ok(p.solar>=0);
    assert.ok(p.home>=0&&p.car>=0);
    assert.ok(Math.abs(p.solar+p.battery+p.grid-p.home-p.car)<1e-9);
    assert.ok(Math.abs(sinks(p).reduce((a,b)=>a+b,0)-(p.solar+Math.max(0,p.battery)+Math.max(0,p.grid)))<1e-9);
  }
});

test('fluid areas stay proportional during motion, touch and zero-demand transitions', () => {
  const distributions = [[1.8,1.2,2.4,.6],[0,1.2,0,0],[2.4,1,0,0],[0,1.2,0,3],[.001,1.2,.001,.001]];
  for (const values of distributions) for (const time of [0,3,17,49]) for (const touch of [null,{x:20,y:50,dx:60,dy:40},{x:380,y:350,dx:-60,dy:-30}]) {
    const g=fieldLayout(values,400,430,time,touch), a=g.polygons.map(polygonArea);
    const actual=[a[0],a[1],a[2]-a[1],a[3]-a[2]].map(v=>v/g.area);
    actual.forEach((v,i)=>assert.ok(Math.abs(v-g.f[i])<.001,`area ${i}: ${v} vs ${g.f[i]}`));
    assert.ok(Math.abs(actual.reduce((a,b)=>a+b,0)-1)<1e-6);
    for(const center of g.centers) assert.ok(Number.isFinite(center.x)&&Number.isFinite(center.y));
  }
});

test('every fluid proposal and the new character/storage studies are playable', async () => {
  const {demoConfigs}=await import('../future/demos/variants.mjs');
  const fluid=families.find(f=>f.id==='fluid');
  for(const id of fluid.ids)assert.ok(demoIds.includes(id),id);
  assert.equal(demoIds.length,16);
  for(const [id,config] of Object.entries(demoConfigs))assert.equal(config.name,concepts.find(c=>c.id===id).name);
  assert.equal(demoConfigs['robot-b'].theme,'character');
  assert.equal(demoConfigs['study-08'].theme,'reservoir');
});

test('dragging every energy participant remains balanced through import/export reversals', async () => {
  const {allocateDrag}=await import('../future/demos/model.mjs');
  for(const scenario of Object.values(scenarios))for(const key of ['solar','home','car','battery','grid']) {
    const base=balance(scenario);
    for(const dx of [-1000,-120,0,120,1000])for(const dy of [-1000,-120,0,120,1000]) {
      const p=allocateDrag(base,key,dx,dy);
      assert.ok(Math.abs(p.solar+p.battery+p.grid-p.home-p.car)<1e-9);
      assert.ok(p.solar>=0&&p.car>=0&&p.home>0);
      assert.ok(p.battery>=-5&&p.battery<=5);
      assert.deepEqual(base,balance(scenario),'gestures must not mutate their starting snapshot');
    }
  }
  const base=balance(scenarios.sun);
  assert.ok(allocateDrag(base,'car',150,0).grid>0);
  assert.ok(base.grid<0);
});

test('two-axis material pulls preserve all field shares without gaps', () => {
  for(const values of [[2,1.2,2.4,.4],[0,1,0,0],[4,.4,0,2],[.2,1,5,.01]]) {
    for(const [x,y,dx,dy] of [[10,10,250,-250],[200,215,-250,250],[390,420,250,250],[200,215,0,-250]]) {
      const g=fieldLayout(values,400,430,12,{x,y,dx,dy}),a=g.polygons.map(polygonArea);
      const shares=[a[0],a[1],a[2]-a[1],a[3]-a[2]].map(v=>v/g.area);
      shares.forEach((v,i)=>assert.ok(Math.abs(v-g.f[i])<.001));
      assert.ok(Math.abs(shares.reduce((a,b)=>a+b,0)-1)<1e-6);
    }
  }
});

test('springs settle at different display rates and a release keeps momentum', async () => {
  const {springPoint,stepSpring}=await import('../future/demos/motion.mjs');
  for(const rate of [30,60,120]) {
    const point=springPoint();
    for(let i=0;i<rate;i++)stepSpring(point,{x:90,y:-55},1/rate,340,26);
    assert.ok(Math.abs(point.x-90)<.1&&Math.abs(point.y+55)<.1);
    point.vx=260;
    const atRelease=point.x;stepSpring(point,{x:0,y:0},1/rate,175,15);
    assert.ok(Number.isFinite(point.x)&&point.x!==atRelease);
    for(let i=0;i<rate*3;i++)stepSpring(point,{x:0,y:0},1/rate,175,15);
    assert.ok(Math.hypot(point.x,point.y)<.001&&Math.hypot(point.vx,point.vy)<.01);
  }
});

test('streams share the material deformation and reverse without changing path orientation', async () => {
  const {materialMap,sampleStream,pointAlong,mod}=await import('../future/demos/motion.mjs');
  const map=materialMap(400,430,{x:200,y:210,dx:80,dy:60});
  for(const p of [[0,0],[400,200],[100,430]])assert.ok(Math.hypot(...map(p).map((n,i)=>n-p[i]))<1e-8);
  const source=[100,0],end=[250,300];
  const straight=sampleStream(source,end),bent=sampleStream(source,end,map);
  assert.notDeepEqual(bent.points[18],straight.points[18]);
  assert.deepEqual(bent.points[18],map(straight.points[18]));
  const phase=.4,dt=1/60;
  const forward=pointAlong(bent,mod(phase+dt*.02)),back=pointAlong(bent,mod(phase-dt*.02));
  assert.ok(Math.hypot(forward[0]-back[0],forward[1]-back[1])<1);
});
