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
  for (const values of distributions) for (const time of [0,3,17,49]) for (const touch of [null,{x:20,y:50,strength:1},{x:380,y:350,strength:1}]) {
    const g=fieldLayout(values,400,430,time,touch), a=g.polygons.map(polygonArea);
    const actual=[a[0],a[1],a[2]-a[1],a[3]-a[2]].map(v=>v/g.area);
    actual.forEach((v,i)=>assert.ok(Math.abs(v-g.f[i])<.001,`area ${i}: ${v} vs ${g.f[i]}`));
    assert.ok(Math.abs(actual.reduce((a,b)=>a+b,0)-1)<1e-6);
    for(const center of g.centers) assert.ok(Number.isFinite(center.x)&&Number.isFinite(center.y));
  }
});
