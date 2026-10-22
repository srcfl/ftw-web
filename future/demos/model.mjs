import { clamp, materialMap, pointInPolygon } from './motion.mjs?v=fluid-3';

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
export function fieldLayout(values, w, h, time = 0, grab = null) {
  const total = values.reduce((a,b)=>a+b,0) || 1;
  const f = values.map(v=>v/total), area=w*h;
  const map = materialMap(w,h,grab);
  function seamAt(c,y) {
    const amplitude=Math.min(c,w-c)*.32;
    return c-amplitude*Math.cos(2*Math.PI*y/h+time*.16);
  }
  function shapes(c) {
    const left=[[0,0]], rest=[[seamAt(c,0),0],[w,0],[w,h]];
    for(let i=0;i<=64;i++)left.push([seamAt(c,h*i/64),h*i/64]);
    left.push([0,h]);
    for(let i=64;i>=0;i--)rest.push([seamAt(c,h*i/64),h*i/64]);
    return {left,rest};
  }
  let lo=0,hi=w,c=w*f[0];
  if(f[0]>.000001&&f[0]<.999999) {
    for(let i=0;i<15;i++) {
      c=(lo+hi)/2;
      if(polygonArea(shapes(c).left.map(map))<f[0]*area)lo=c;else hi=c;
    }
  }
  const base=shapes(c), left=base.left.map(map), rest=base.rest.map(map);
  function prefix(level) {
    if(level<=0)return {base:[],p:[],level:0};
    if(level>=1)return {base:base.rest,p:rest,level:1};
    const cross=[];
    for(let i=0;i<=48;i++) {
      const u=i/48, y=h*(level+.1*Math.sin(Math.PI*u)*Math.sin(Math.PI*level)*Math.cos(time*.15));
      cross.push([seamAt(c,y)+(w-seamAt(c,y))*u,y]);
    }
    const points=[[seamAt(c,0),0],[w,0],...cross.slice().reverse()];
    for(let i=48;i>=0;i--) {const y=h*level*i/48;points.push([seamAt(c,y),y]);}
    return {base:points,p:points.map(map),level};
  }
  function solve(amount) {
    const remaining=polygonArea(rest)/area;
    if(amount<.000001)return prefix(0);
    if(amount>=remaining-.00003)return prefix(1);
    let lo=0,hi=1,r;
    for(let i=0;i<15;i++) {
      r=prefix((lo+hi)/2);
      if(polygonArea(r.p)<amount*area)lo=r.level;else hi=r.level;
    }
    return r;
  }
  const a=solve(f[1]),b=solve(f[1]+f[2]);
  const polygons=[left,a.p,b.p,rest], basePolygons=[base.left,a.base,b.base,base.rest];
  function regionCenters(polys) {
    const centers=polys.map(polygonCenter),areas=polys.map(polygonArea);
    const difference=(big,small)=> {
      const remaining=areas[big]-areas[small];
      return remaining>.1?{x:(centers[big].x*areas[big]-centers[small].x*areas[small])/remaining,y:(centers[big].y*areas[big]-centers[small].y*areas[small])/remaining}:centers[big];
    };
    return [centers[0],centers[1],difference(2,1),difference(3,2)];
  }
  const baseJunction=[seamAt(c,h*a.level),h*a.level];
  return { f,area,baseSeam:y=>seamAt(c,y),polygons,centers:regionCenters(polygons),baseCenters:regionCenters(basePolygons),map,baseJunction,robotAnchor:map([seamAt(c,h*.28),h*.28]) };
}

export function hitField(layout, point) {
  if(pointInPolygon(point,layout.polygons[0]))return 'car';
  if(pointInPolygon(point,layout.polygons[1]))return 'home';
  if(pointInPolygon(point,layout.polygons[2]))return 'battery';
  return 'grid';
}

// A gesture edits only this example. Grid power is always derived from the
// rest of the home, so changing a surface cannot invent or lose energy.
export function allocateDrag(base, key, dx, dy) {
  const next={...base};
  if(key==='car')next.car=clamp(base.car+dx*.018-dy*.006,0,7.4);
  if(key==='home')next.home=clamp(base.home-dx*.008+dy*.012,.4,4.5);
  if(key==='solar')next.solar=clamp(base.solar+dy*.022,0,9);
  if(key==='battery')next.battery=clamp(base.battery+dy*.024+dx*.008,-5,5);
  if(key==='grid') {
    const requested=base.grid+dy*.026;
    next.battery=clamp(base.home+base.car-base.solar-requested,-5,5);
  }
  return balance(next);
}

export function storedLevel(hour) {
  const anchors=[[0,68],[6,36],[10,42],[16,88],[22,40],[24,35]];
  for(let i=1;i<anchors.length;i++)if(hour<=anchors[i][0]) {
    const [a,b]=[anchors[i-1],anchors[i]],t=clamp((hour-a[0])/(b[0]-a[0]),0,1);
    return a[1]+(b[1]-a[1])*(t*t*(3-2*t));
  }
  return 35;
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
