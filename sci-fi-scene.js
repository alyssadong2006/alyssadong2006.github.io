import * as THREE from './vendor/three.module.js';
import { createCatConstellation } from './cat-constellation.js';
import { createCoreExplosion } from './core-explosion.js';

/* Orbital energy-core scene. Host: #cosmos. Status: documentElement.dataset.webgl = ready | unavailable */
const root = document.documentElement;
const host = document.getElementById('cosmos');
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileMQ = window.matchMedia('(max-width: 800px)');

function init() {
  if (!host) { root.dataset.webgl = 'unavailable'; return; }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { root.dataset.webgl = 'unavailable'; return; }
  const gl = renderer.getContext();
  if (!gl) { root.dataset.webgl = 'unavailable'; return; }

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  host.appendChild(canvas);
  renderer.setClearColor(0x100c13, 1); // archive default; stage mode switches to transparent in layout()

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(0x100c13, 0.018);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const world = new THREE.Group();   // positioned to land at screen anchor
  const sway = new THREE.Group();    // parallax / scroll rotation
  scene.add(world); world.add(sway);
  const planetG = new THREE.Group(), instG = new THREE.Group(), constG = new THREE.Group();
  sway.add(planetG, instG, constG);

  const U = { uTime: { value: 0 }, uPulse: { value: 0 }, uScan: { value: 0 }, uScanOn: { value: 0 } };
  const lowEnd = mobileMQ.matches || (navigator.hardwareConcurrency || 8) <= 4;
  const q = mobileMQ.matches ? 0.45 : lowEnd ? 0.65 : 1;
  const R = 1.65;
  const peach = new THREE.Color('#ffc9b0'), lav = new THREE.Color('#b9a4ff'), rose = new THREE.Color('#ff8fb1');

  /* ---------- Core ---------- */
  const noise = `
    vec3 h3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return -1.+2.*fract(sin(p)*43758.5453);}
    float gn(vec3 p){vec3 i=floor(p),f=fract(p);vec3 u=f*f*(3.-2.*f);
      return mix(mix(mix(dot(h3(i),f),dot(h3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),mix(dot(h3(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(h3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
                 mix(mix(dot(h3(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(h3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),mix(dot(h3(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(h3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);}
    float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*gn(p);p=p*2.03+7.1;a*=.5;}return s;}`;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(R, Math.round(96 * Math.max(q, 0.6)), Math.round(64 * Math.max(q, 0.6))),
    new THREE.ShaderMaterial({
      uniforms: { ...U },
      vertexShader: `varying vec3 vN;varying vec3 vP;varying vec3 vW;
        void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vW=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uTime;uniform float uPulse;uniform float uScan;uniform float uScanOn;varying vec3 vN;varying vec3 vP;varying vec3 vW;
        ${noise}
        void main(){
          vec3 n=normalize(vN),v=normalize(vW);
          vec3 p=normalize(vP)*1.6;
          vec3 w=vec3(fbm(p+uTime*.03),fbm(p+5.2-uTime*.025),fbm(p+9.7));
          float f=fbm(p*1.4+w*1.3+vec3(0.,uTime*.04,0.));
          float bands=sin(vP.y*3.2+f*5.0)*.5+.5;
          float fr=pow(1.-max(dot(n,v),0.),2.6);
          // pearlescent iridescence
          float ph=f*2.2+fr*3.0+bands*.8+uTime*.02;
          vec3 irid=.5+.5*cos(6.2832*(vec3(0.,.33,.67)*.55+ph));
          vec3 peach=vec3(1.,.80,.69),lav=vec3(.72,.64,1.),rose=vec3(1.,.56,.69);
          vec3 base=mix(lav,peach,smoothstep(-.4,.5,f+bands*.25));
          base=mix(base,rose,smoothstep(.2,.6,f)*.45);
          base=mix(base,irid,.22);
          vec3 L=normalize(vec3(-.5,.6,.7));
          float d=max(dot(n,L),0.);
          vec3 H=normalize(L+v);
          float spec=pow(max(dot(n,H),0.),70.);
          // glowing energy veins
          float vein=smoothstep(.04,0.,abs(fbm(p*2.3+w*.8+uTime*.02)))*(.5+.5*sin(uTime*.8+f*9.));
          vec3 col=base*(.22+.85*d)+spec*vec3(1.,.93,.9)*.9;
          col+=vein*mix(peach,rose,.4)*(.55+uPulse*1.1);
          col+=fr*mix(lav,peach,.4+.4*sin(uTime*.2))*1.25;
          col+=base*.12*(1.+uPulse);
          col*=.85;
          if(uScanOn>.001){
            float y=vP.y/1.65;
            float yc=1.-2.*uScan;
            float dy=y-yc;
            float beam=exp(-dy*dy*900.);
            float halo=exp(-dy*dy*60.)*.28;
            // technical lat/long grid, revealed near the beam
            float lat=abs(fract(y*9.)-.5), lon=abs(fract(atan(vP.z,vP.x)*1.9099)-.5);
            float grid=max(smoothstep(.47,.5,lat),smoothstep(.47,.5,lon)*.8);
            float fine=smoothstep(.43,.5,abs(fract(y*45.)-.5))*.25;
            float reveal=exp(-dy*dy*10.)*(.35+.65*smoothstep(0.,.9,1.-uScan*.4));
            float edge=.35+.65*fr;
            vec3 pink=vec3(1.,.36,.66);
            col+=pink*(beam*1.9+halo)*uScanOn;
            col+=vec3(1.,.82,.9)*beam*beam*.7*uScanOn;
            col+=mix(vec3(.72,.64,1.),pink,.5)*(grid*.55+fine)*reveal*edge*uScanOn;
            col*=1.-.12*smoothstep(0.,.8,y-yc)*uScanOn;
          }
          gl_FragColor=vec4(col,1.);
        }`
    })
  );
  planetG.add(core);

  // fresnel atmosphere
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 48, 32), new THREE.ShaderMaterial({
    uniforms: { ...U }, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float uPulse;varying vec3 vN;varying vec3 vV;void main(){
      float a=pow(max(dot(-vN,vV),0.),2.2);
      vec3 c=mix(vec3(.72,.62,1.),vec3(1.,.78,.66),a);
      gl_FragColor=vec4(c*a*(.9+uPulse*.8),a*.8);}`
  }));
  planetG.add(atmo);

  // soft glow sprite
  const gc = document.createElement('canvas'); gc.width = gc.height = 256;
  const g2 = gc.getContext('2d'), gr = g2.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.35)');
  gr.addColorStop(.6, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(gc);
  const mkGlow = (color, scale, op) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(scale); return s;
  };
  const glowA = mkGlow(0xb59cff, R * 6.5, 0.38), glowB = mkGlow(0xffb89a, R * 3.6, 0.3);
  glowA.position.z = -0.5; glowB.position.z = -0.3;
  planetG.add(glowA, glowB);

  /* ---------- Rings ---------- */
  const rings = [];
  const ringMat = (c1, c2, inner, outer, seed) => new THREE.ShaderMaterial({
    uniforms: { ...U, uC1: { value: c1 }, uC2: { value: c2 }, uSeed: { value: seed }, uIn: { value: inner }, uOut: { value: outer } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uTime,uPulse,uSeed,uIn,uOut;uniform vec3 uC1,uC2;varying vec2 vP;
      float h(float x){return fract(sin(x*127.1+uSeed*31.7)*43758.5453);}
      void main(){
        float r=length(vP);float t=(r-uIn)/(uOut-uIn);
        float ang=atan(vP.y,vP.x);
        float grooves=0.;
        for(int i=0;i<6;i++){float c=h(float(i)+1.);grooves+=smoothstep(.03,0.,abs(t-c))*(.4+.6*h(float(i)+9.));}
        float body=smoothstep(0.,.08,t)*smoothstep(1.,.85,t);
        float flow=.55+.45*sin(ang*3.+uTime*(.6+uSeed*.1)+uSeed*5.);
        float head=pow(.5+.5*sin(ang*1.-uTime*(.7+uSeed*.15)+uSeed*3.),6.);
        float a=(grooves*.7+body*.12)*flow+head*smoothstep(.0,.5,1.-abs(t-.5)*2.)*.9;
        a*=.8+uPulse*1.6;
        vec3 c=mix(uC1,uC2,t+head*.4);
        gl_FragColor=vec4(c*a,a);
      }`
  });
  const ringDefs = [
    { in: 2.15, out: 2.45, tilt: [1.15, 0.2, 0.35], c: [lav, peach], spd: 0.05 },
    { in: 2.7, out: 2.76, tilt: [1.0, -0.3, -0.5], c: [peach, rose], spd: -0.035 },
    { in: 3.05, out: 3.55, tilt: [1.35, 0.1, 0.9], c: [rose, lav], spd: 0.025 },
    { in: 3.95, out: 4.0, tilt: [0.82, 0.5, -0.2], c: [lav, lav], spd: -0.02 },
  ];
  ringDefs.forEach((d, i) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(d.in, d.out, 220, 1), ringMat(d.c[0], d.c[1], d.in, d.out, i + 1));
    const pivot = new THREE.Group();
    pivot.rotation.set(d.tilt[0], d.tilt[1], d.tilt[2]);
    pivot.add(m); planetG.add(pivot);
    rings.push({ pivot, mesh: m, spd: d.spd });
  });

  /* ---------- Flowing particles along tilted orbits ---------- */
  function makeFlow(count) {
    const geo = new THREE.BufferGeometry();
    const a = { r: [], sp: [], ph: [], tl: [], sz: [], cm: [], ec: [] };
    const tilts = ringDefs.map(d => d.tilt);
    for (let i = 0; i < count; i++) {
      const lane = i % tilts.length, t = tilts[lane];
      a.r.push(2.1 + lane * 0.62 + (Math.random() - 0.5) * 0.5 + (Math.random() < 0.15 ? Math.random() * 1.2 : 0));
      a.sp.push((0.12 + Math.random() * 0.22) / (1 + lane * 0.25) * (lane % 2 ? -1 : 1));
      a.ph.push(Math.random() * 6.2832);
      a.tl.push(t[0] + (Math.random() - .5) * .08, t[1] + (Math.random() - .5) * .08, t[2] + (Math.random() - .5) * .08);
      a.sz.push(0.6 + Math.pow(Math.random(), 3) * 2.2);
      a.cm.push(Math.random());
      a.ec.push(0.92 + Math.random() * 0.1);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aR', new THREE.Float32BufferAttribute(a.r, 1));
    geo.setAttribute('aSp', new THREE.Float32BufferAttribute(a.sp, 1));
    geo.setAttribute('aPh', new THREE.Float32BufferAttribute(a.ph, 1));
    geo.setAttribute('aTl', new THREE.Float32BufferAttribute(a.tl, 3));
    geo.setAttribute('aSz', new THREE.Float32BufferAttribute(a.sz, 1));
    geo.setAttribute('aCm', new THREE.Float32BufferAttribute(a.cm, 1));
    geo.setAttribute('aEc', new THREE.Float32BufferAttribute(a.ec, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
    return geo;
  }
  const flowMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uScale: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime,uScale,uPulse;attribute float aR,aSp,aPh,aSz,aCm,aEc;attribute vec3 aTl;varying float vC;varying float vA;
      mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
      mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
      mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
      void main(){
        float a=aPh+uTime*aSp+uPulse*.08*sin(aPh);
        vec3 p=vec3(cos(a)*aR,sin(a)*aR*aEc,0.)*(1.+uPulse*.03);
        p=rz(aTl.z)*ry(aTl.y)*rx(aTl.x)*p;
        vC=aCm;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        vA=.5+.5*sin(a*3.+aPh*5.);
        gl_PointSize=aSz*uScale*(1.+uPulse*.6)*(14./-mv.z);
        gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying float vC;varying float vA;void main(){
      float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;
      float k=pow(1.-d,2.2);
      vec3 c=mix(vec3(.75,.65,1.),vec3(1.,.8,.68),vC);
      gl_FragColor=vec4(c*k*(.5+.8*vA),k*(.4+.6*vA));}`
  });
  const flow = new THREE.Points(makeFlow(Math.round(2600 * q)), flowMat);
  flow.frustumCulled = false;
  planetG.add(flow);

  /* ---------- Satellites ---------- */
  const sats = [];
  const satGeo = new THREE.IcosahedronGeometry(1, 1);
  const satMat = new THREE.MeshStandardMaterial({ color: 0xe8d6ff, metalness: 0.9, roughness: 0.25, emissive: 0x6a4a8a, emissiveIntensity: 0.6 });
  [[0, 0.07, 2.45, 0.45], [1, 0.05, 2.9, 1.9], [2, 0.09, 3.3, 3.6], [3, 0.06, 4.0, 5.0], [1, 0.04, 2.73, 4.2]].forEach(([ri, size, rad, ph], i) => {
    const m = new THREE.Mesh(satGeo, satMat); m.scale.setScalar(size);
    const g = mkGlow(i % 2 ? 0xffb89a : 0xb59cff, size * 14, 0.7);
    const pivot = new THREE.Group(); pivot.rotation.copy(rings[ri].pivot.rotation);
    const holder = new THREE.Group(); holder.add(m, g); pivot.add(holder); planetG.add(pivot);
    sats.push({ holder, rad, ph, spd: (i % 2 ? -1 : 1) * (0.28 - i * 0.03) });
  });
  scene.add(new THREE.AmbientLight(0x8a6fb0, 0.7));
  const key = new THREE.PointLight(0xffd0b8, 25, 0, 2); key.position.set(-3, 3, 5); scene.add(key);

  /* ---------- Background dust ---------- */
  const dustN = Math.round(900 * q), dp = new Float32Array(dustN * 3), ds = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    const r = 10 + Math.random() * 40, th = Math.random() * 6.2832, ph = Math.acos(2 * Math.random() - 1);
    dp[i * 3] = r * Math.sin(ph) * Math.cos(th); dp[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7; dp[i * 3 + 2] = -Math.abs(r * Math.cos(ph)) - 4;
    ds[i] = 0.5 + Math.random() * 1.5;
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dg.setAttribute('aSz', new THREE.BufferAttribute(ds, 1));
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({
    uniforms: { ...U, uScale: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uScale,uTime;attribute float aSz;varying float vT;void main(){vT=.5+.5*sin(uTime*.6+position.x*3.+position.y);
      vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSz*uScale*(30./-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying float vT;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float k=(1.-d)*(.25+.4*vT);gl_FragColor=vec4(vec3(.85,.78,1.)*k,k);}`
  }));
  scene.add(dust);


  /* ---------- Holographic observatory instrument ---------- */
  const ptsMats = [];
  const mkPts = (size0) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { ...U, uScale: { value: 1 }, uOp: { value: 1 }, uK: { value: size0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uScale,uTime,uK,uPulse;attribute float aSz;attribute vec3 aCol;varying vec3 vC;varying float vT;
        void main(){vT=.65+.35*sin(uTime*1.3+position.x*5.+position.y*3.+position.z*2.);vC=aCol;
        vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSz*uScale*(uK/-mv.z)*(1.+uPulse*.35);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uOp;varying vec3 vC;varying float vT;void main(){
        float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;
        float k=pow(1.-d,2.)*.75+pow(1.-d,10.)*.9;
        gl_FragColor=vec4(vC*k*vT*uOp,k*vT*uOp);}`
    });
    ptsMats.push(m); return m;
  };
  const mkPtsGeo = (pos, sz, col) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos instanceof Float32Array ? pos : new Float32Array(pos), 3));
    g.setAttribute('aSz', new THREE.BufferAttribute(new Float32Array(sz), 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(col), 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
    return g;
  };
  const instMats = [];   // { m, base } scaled by instrument opacity
  const instDefs = [
    { r: 2.95, ticks: 90, major: 5, tilt: [1.22, 0.15, 0.1], spd: 0.06, col: lav, nodes: [0.6, 3.4], panels: [1.9] },
    { r: 3.75, ticks: 120, major: 10, tilt: [0.95, -0.35, -0.3], spd: -0.04, col: rose, nodes: [1.4, 4.4, 5.3], panels: [3.1, 5.9] },
    { r: 4.4, ticks: 144, major: 12, tilt: [1.4, 0.3, 0.7], spd: 0.025, col: peach, nodes: [2.5], panels: [0.2, 4.1] },
  ];
  const instSpin = [];
  const white = new THREE.Color('#fff2f6');
  instDefs.forEach((d, di) => {
    const P = [], C = [];
    const seg = (a, b, c) => { P.push(a[0], a[1], 0, b[0], b[1], 0); C.push(c.r, c.g, c.b, c.r, c.g, c.b); };
    const at = (rad, a) => [Math.cos(a) * rad, Math.sin(a) * rad];
    const dim = d.col.clone().lerp(white, 0.25);
    // ticks
    for (let i = 0; i < d.ticks; i++) {
      const a = i / d.ticks * Math.PI * 2, mj = i % d.major === 0;
      seg(at(d.r - (mj ? 0.11 : 0.04), a), at(d.r + (mj ? 0.11 : 0.04), a), mj ? white : dim);
    }
    // radially segmented arc band (gaps between segments)
    const nSeg = 24, sub = 6;
    for (let s2 = 0; s2 < nSeg; s2++) {
      const a0 = s2 / nSeg * Math.PI * 2, span = Math.PI * 2 / nSeg * (0.62 + 0.25 * ((s2 * 7 + di) % 3) / 2);
      for (let k = 0; k < sub; k++) {
        const o = d.r + 0.17 + (s2 % 2 ? 0.035 : 0);
        seg(at(o, a0 + span * k / sub), at(o, a0 + span * (k + 1) / sub), d.col);
      }
    }
    // panels (quad + outline) and nodes
    const PP = [], PC = [];
    d.panels.forEach(a => {
      const rr = d.r - 0.38, hw = 0.2, hh = 0.075;
      const cx = Math.cos(a) * rr, cy = Math.sin(a) * rr, tx = -Math.sin(a), ty = Math.cos(a), nx = Math.cos(a), ny = Math.sin(a);
      const c4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [cx + tx * hw * u + nx * hh * v, cy + ty * hw * u + ny * hh * v]);
      for (let k = 0; k < 4; k++) seg(c4[k], c4[(k + 1) % 4], white);
      seg(at(rr + hh, a), at(d.r - 0.12, a), dim);
      [0, 1, 2, 0, 2, 3].forEach(i => { PP.push(c4[i][0], c4[i][1], 0); PC.push(d.col.r, d.col.g, d.col.b); });
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3));
    const lm = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    instMats.push({ m: lm, base: 0.5 });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PP), 3));
    pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(PC), 3));
    const pm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
    instMats.push({ m: pm, base: 0.12 });
    const np = [], ns = [], nc = [];
    d.nodes.forEach(a => { const p = at(d.r + 0.17, a); np.push(p[0], p[1], 0); ns.push(1.1); nc.push(1, 0.88, 0.92); });
    const pivot = new THREE.Group(), spin = new THREE.Group();
    pivot.rotation.set(d.tilt[0], d.tilt[1], d.tilt[2]);
    spin.add(new THREE.LineSegments(lg, lm), new THREE.Mesh(pg, pm), new THREE.Points(mkPtsGeo(np, ns, nc), mkPts(40)));
    pivot.add(spin); instG.add(pivot);
    instSpin.push({ spin, spd: d.spd });
  });

  /* ---------- Seated cat: discrete stars joined by straight constellation lines ---------- */
  const cat = createCatConstellation();
  const { shape: catShape, stars: starBase, bright, interior, links: catLinks } = cat;
  const alIndex = cat.alIndex ?? catLinks[0][0]; // AL-0527 shoulder star
  const mapContour = [...starBase, starBase[0]];
  const starPos = new Float32Array(starBase.length * 3), starSz = [], starCol = [];
  starBase.forEach((_, i) => {
    const b = bright.has(i), c = b ? white : white.clone().lerp(rose, 0.18);
    starSz.push(i === alIndex ? 5.4 : b ? 4.1 : 2.7 + (i % 3) * 0.2); starCol.push(c.r, c.g, c.b);
  });
  const starGeo = mkPtsGeo(starPos, starSz, starCol);
  const starMat = mkPts(95);
  const lineArr = new Float32Array(mapContour.length * 3);
  const cLineGeo = new THREE.BufferGeometry();
  cLineGeo.setAttribute('position', new THREE.BufferAttribute(lineArr, 3));
  cLineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
  const cLineMat = new THREE.LineBasicMaterial({ color: 0xf3c1da, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const catFillMat = new THREE.MeshBasicMaterial({ color: 0xe9a8ce, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
  const catFill = new THREE.Mesh(new THREE.ShapeGeometry(catShape, 40), catFillMat);
  catFill.position.z = -0.08;
  const fillPos = new Float32Array(interior.flat());
  const fillMat = mkPts(55);
  const fillGeo = mkPtsGeo(fillPos, interior.map((_, i) => 0.6 + (i % 4) * 0.15), interior.flatMap((_, i) => i % 2 ? [1, .72, .84] : [.8, .72, 1]));
  const linkArray = new Float32Array(catLinks.flatMap(([a, b]) => [...starBase[a], ...starBase[b]]));
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.BufferAttribute(linkArray, 3));
  const linkMat = new THREE.LineBasicMaterial({ color: 0xf3c1da, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  constG.add(catFill, new THREE.Line(cLineGeo, cLineMat), new THREE.LineSegments(linkGeo, linkMat), new THREE.Points(starGeo, starMat), new THREE.Points(fillGeo, fillMat));
  function moveStars(t) {
    const breath = 1 + Math.sin(t * 0.35) * 0.002;
    starBase.forEach((p, i) => { starPos.set([p[0] * breath, p[1] * breath, p[2]], i * 3); });
    mapContour.forEach((p, i) => { lineArr.set([p[0] * breath, p[1] * breath, p[2]], i * 3); });
    catLinks.forEach(([a, b], i) => {
      for (let k = 0; k < 3; k++) { linkArray[i * 6 + k] = starPos[a * 3 + k]; linkArray[i * 6 + 3 + k] = starPos[b * 3 + k]; }
    });
    linkGeo.attributes.position.needsUpdate = true;
    catFill.scale.setScalar(breath);
    starGeo.attributes.position.needsUpdate = true;
    cLineGeo.attributes.position.needsUpdate = true;
  }
  moveStars(0);

  const coreBurst = createCoreExplosion(sway, { mobile: mobileMQ.matches });
  let burstTick = 0;
  root.dataset.coreState = 'stable';

  /* ---------- Mode state ---------- */
  let modeTarget = root.dataset.sceneMode === 'constellation' ? 1 : 0, modeT = modeTarget; // preserve a mode selected while booting
  root.dataset.sceneMode = modeTarget === 1 ? 'constellation' : 'planet';
  function applyMode() {
    const e = modeT * modeT * (3 - 2 * modeT);
    const reform = coreBurst.active ? THREE.MathUtils.smoothstep(coreBurst.progress, 0.66, 1) : 1;
    planetG.scale.setScalar(Math.max(0.001, (1 - e) * reform));
    planetG.visible = e < 0.999 && reform > 0.001;
    instG.scale.setScalar(1 + 0.08 * e);
    constG.scale.setScalar(0.4 + 0.6 * e);
    constG.visible = e > 0.002;
    const io = (1 - e) * reform; // Let the silhouette and shockwave stand alone.
    instMats.forEach(o => { o.m.opacity = o.base * io; });
    ptsMats.forEach(m => { if (m !== starMat && m !== fillMat) m.uniforms.uOp.value = io; });
    starMat.uniforms.uOp.value = e;
    fillMat.uniforms.uOp.value = 0.3 * e;
    catFillMat.opacity = 0.009 * e;
    cLineMat.opacity = 0.48 * e;
    linkMat.opacity = 0.22 * e;
    constG.position.y = -0.15 * e;
  }
  applyMode();

  /* ---------- AL-0527 map marker (DOM, projected from the shoulder star) ---------- */
  const markerStage = document.querySelector('.planet-model-stage');
  let marker = null, tagEl = null, leaderEl = null, markerState = '';
  let tagW = 112, tagH = 34, lastMk = '';
  if (markerStage) {
    marker = document.createElement('div');
    marker.className = 'al-map-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.dataset.state = 'hidden';
    marker.innerHTML = '<span class="al-halo"></span><span class="al-beacon"></span><i class="al-leader"></i><span class="al-tag"><b>AL-0527</b><small>GUIDING LIGHT</small></span>';
    leaderEl = marker.querySelector('.al-leader'); tagEl = marker.querySelector('.al-tag');
    markerStage.appendChild(marker);
  }
  const mkV = new THREE.Vector3();
  function setMarkerState(s) { if (marker && markerState !== s) { markerState = s; marker.dataset.state = s; } }
  function measureMarker() {
    if (!tagEl) return;
    tagW = tagEl.offsetWidth || tagW; tagH = tagEl.offsetHeight || tagH; lastMk = '';
  }
  function updateMarker() {
    if (!marker) return;
    const live = stageOn && !lost && !coreFullscreen && !coreBurst.active && modeTarget === 1 && modeT >= 0.999;
    if (!live) { setMarkerState('hidden'); return; }
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    mkV.set(starPos[alIndex * 3], starPos[alIndex * 3 + 1], starPos[alIndex * 3 + 2]);
    constG.localToWorld(mkV); mkV.project(camera);
    const x = (mkV.x + 1) / 2 * w, y = (1 - mkV.y) / 2 * h, m = 8;
    if (!(mkV.z > -1 && mkV.z < 1) || x < m || x > w - m || y < m || y > h - m) { setMarkerState('hidden'); return; }
    // Prefer up-right; flip when the label would leave the stage.
    const ox = 30, oy = 26;
    let dx = x + ox + tagW <= w - 6 ? 1 : -1;
    if (dx < 0 && x - ox - tagW < 6) dx = x < w / 2 ? 1 : -1;
    let dy = y - oy - tagH / 2 >= 6 ? -1 : 1;
    if (dy > 0 && y + oy + tagH / 2 > h - 6 && y - oy - tagH / 2 >= 6) dy = -1;
    const ex = dx * ox, ey = dy * oy;
    let ty = ey - tagH / 2;
    ty = Math.min(Math.max(ty, 6 - y), h - 6 - tagH - y);
    const len = Math.hypot(ex, ey), ang = Math.atan2(ey, ex) * 180 / Math.PI;
    const key = `${x.toFixed(1)},${y.toFixed(1)},${dx},${dy},${ty.toFixed(1)}`;
    if (key !== lastMk) {
      lastMk = key;
      marker.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      leaderEl.style.width = `${len.toFixed(1)}px`;
      leaderEl.style.transform = `rotate(${ang.toFixed(1)}deg)`;
      tagEl.style.transform = `translate(${dx > 0 ? ex : ex - tagW}px,${ty.toFixed(1)}px)`;
      tagEl.dataset.side = dx > 0 ? 'r' : 'l';
    }
    setMarkerState('visible');
  }

  /* ---------- Pose broadcast (background follows via portfolio:pose) ---------- */
  let poseSent = null;
  function emitPose(force) {
    const yaw = sway.rotation.y, pitch = sway.rotation.x, zoom = zoomLevel;
    if (!force && poseSent && Math.abs(yaw - poseSent.yaw) < 0.001 && Math.abs(pitch - poseSent.pitch) < 0.001 && Math.abs(zoom - poseSent.zoom) < 0.001) return;
    poseSent = { yaw, pitch, zoom };
    root.dataset.poseYaw = yaw.toFixed(4); root.dataset.posePitch = pitch.toFixed(4);
    window.dispatchEvent(new CustomEvent('portfolio:pose', { detail: { yaw, pitch, zoom } }));
  }

  /* ---------- Layout / state ---------- */
  let stageOn = false, onscreen = true, w = 1, h = 1, dpr = 1, scrollT = 0, scrollS = 0, px = 0, py = 0, sx = 0, sy = 0;
  let paused = document.body.classList.contains('motion-paused'), hidden = document.hidden, lost = false, warming = true, raf = 0, last = 0, time = 0, pulse = 0, scanOn = false, scanT = 0;
  let orbitYaw = 0, orbitPitch = 0, viewYaw = 0, viewPitch = 0;
  const ZOOM_MIN = 0.6, ZOOM_MAX = 2, ZOOM_STEP = 1.2;
  let zoomLevel = 1, viewZoom = 1;
  const roundZoom = v => Math.round(THREE.MathUtils.clamp(v, ZOOM_MIN, ZOOM_MAX) * 1000) / 1000;
  function setCameraZoom(v) {
    viewZoom = v;
    if (camera.zoom !== v) { camera.zoom = v; camera.updateProjectionMatrix(); }
  }
  function emitZoom() {
    const locked = coreBurst.active;
    root.dataset.zoom = String(zoomLevel);
    window.dispatchEvent(new CustomEvent('portfolio:zoomstate', { detail: {
      zoom: zoomLevel, min: ZOOM_MIN, max: ZOOM_MAX, available: !lost && !warming, locked,
      canZoomIn: !lost && !warming && !locked && zoomLevel < ZOOM_MAX - 0.0005,
      canZoomOut: !lost && !warming && !locked && zoomLevel > ZOOM_MIN + 0.0005
    } }));
  }
  let dragId = null, dragX = 0, dragY = 0, orbitRaf = 0;
  const reduced = () => reduceMQ.matches;
  const dist = 11;

  function layout() {
    const rect = host.getBoundingClientRect();
    w = Math.max(1, rect.width || window.innerWidth); h = Math.max(1, rect.height || window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const stage = document.querySelector('.planet-model-stage');
    const sr = stage && stage.getBoundingClientRect();
    stageOn = !!(sr && sr.width > 20 && sr.height > 20);
    // stage-local canvas: transparent over the page, no fog tint; archive: opaque + fog
    renderer.setClearColor(0x100c13, stageOn ? 0 : 1);
    scene.fog = stageOn ? null : fog;
    glowA.scale.setScalar(R * (stageOn ? 4.6 : 6.5));
    const small = stageOn ? mobileMQ.matches : w <= 800;
    // wide screens: fit by height; narrow: fit by width
    camera.fov = small ? 46 : 38;
    camera.zoom = viewZoom; // renderer resizing keeps the chosen level
    camera.updateProjectionMatrix();
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist, vw = vh * camera.aspect;
    if (stageOn) {
      // anchor to the stage centre (host-relative NDC), fit instrument outer radius (4.5) to stage
      const cx = ((sr.left + sr.width / 2 - rect.left) / w) * 2 - 1, cy = 1 - ((sr.top + sr.height / 2 - rect.top) / h) * 2;
      world.position.set(cx * vw / 2, cy * vh / 2, 0);
      const upx = vh / h; // world units per CSS px at z=0
      const fit = Math.min((sr.width / 2) * upx / 4.5, (sr.height / 2) * upx / 3.6) * 0.96;
      world.scale.setScalar(Math.min(1.15, Math.max(0.12, fit)));
    } else {
      const ax = small ? 0 : 0.44, ay = small ? -0.66 : 0.34; // Leave room below the desktop planet for its observation report.
      world.position.set(ax * vw / 2, ay * vh / 2, 0);
      const fit = small ? Math.min(1, (vw * 0.78) / 9) : Math.min(1.15, Math.max(0.6, (vw * 0.5) / 9.5, 0.0) * 1.0);
      world.scale.setScalar(small ? Math.max(0.5, fit * 0.85) : Math.min(1.05, fit));
    }
    const s = h / 900;
    const ps = Math.max(stageOn ? 0.75 : 0.6, s) * dpr;
    flowMat.uniforms.uScale.value = dust.material.uniforms.uScale.value = ps;
    ptsMats.forEach(m => { m.uniforms.uScale.value = ps; });
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    measureMarker();
    if (!animating()) draw();
  }

  const SCAN_DUR = 1.8;
  function setScanUniforms() {
    if (!scanOn) { U.uScan.value = 0; U.uScanOn.value = 0; return; }
    const p = Math.min(1, scanT / SCAN_DUR);
    U.uScan.value = p;
    U.uScanOn.value = Math.min(1, p / 0.08) * Math.min(1, (1 - p) / 0.08);
  }
  function clearScan() { scanOn = false; scanT = 0; setScanUniforms(); }

  function recoverCore() {
    coreBurst.reset();
    root.dataset.coreState = 'stable';
    applyMode();
    restoreCoreCanvas();
    emitZoom();
    window.dispatchEvent(new CustomEvent('portfolio:reformed'));
  }

  function update(dt) {
    time += dt;
    const wasExploding = coreBurst.active;
    const burstNow = performance.now();
    coreBurst.update(wasExploding ? Math.max(0, (burstNow - burstTick) / 1000) : 0);
    burstTick = burstNow;
    if (wasExploding) {
      applyMode();
      if (!coreBurst.active) recoverCore();
    }
    if (scanOn) { scanT += dt; if (scanT >= SCAN_DUR) clearScan(); else setScanUniforms(); }
    pulse *= Math.exp(-dt * 1.8);
    U.uTime.value = time; U.uPulse.value = pulse;
    const k = 1 - Math.exp(-dt * 3);
    scrollS += (scrollT - scrollS) * k; sx += (px - sx) * k; sy += (py - sy) * k;
    const orbitK = 1 - Math.exp(-dt * 12);
    viewYaw += (orbitYaw - viewYaw) * orbitK;
    viewPitch += (orbitPitch - viewPitch) * orbitK;
    const zt = coreBurst.active ? 1 : zoomLevel;
    if (viewZoom !== zt) setCameraZoom(Math.abs(zt - viewZoom) < 0.002 ? zt : viewZoom + (zt - viewZoom) * orbitK);
    if (modeT !== modeTarget) { modeT += Math.sign(modeTarget - modeT) * Math.min(Math.abs(modeTarget - modeT), dt / 1.0); applyMode(); }
    applyPose();
    moveStars(time);
    instSpin.forEach(r => { r.spin.rotation.z += r.spd * dt; });
    core.rotation.y = time * 0.04;
    rings.forEach(r => { r.mesh.rotation.z += r.spd * dt; });
    sats.forEach(s => {
      const a = s.ph + time * s.spd;
      s.holder.position.set(Math.cos(a) * s.rad, Math.sin(a) * s.rad, 0);
    });
    dust.rotation.y = time * 0.004;
  }
  function applyPose() {
    const sk = stageOn ? 0.25 : 1; // stage-anchored: no scroll chase
    sway.rotation.y = viewYaw + sx * 0.18 + scrollS * 0.9 * sk;
    sway.rotation.x = viewPitch - sy * 0.12 + scrollS * 0.25 * sk;
    sway.position.y = scrollS * 0.6 * sk;
    sway.scale.setScalar(1 + pulse * 0.035);
    const ce = modeT * modeT * (3 - 2 * modeT);
    constG.rotation.y = sx * 0.35 * ce; constG.rotation.x = -sy * 0.22 * ce;
    camera.position.set(sx * 0.35, -sy * 0.2, dist - scrollS * 2.2 * sk);
    camera.lookAt(0, 0, 0);
    dust.position.z = scrollS * 1.5;
    emitPose(false);
  }
  function draw() { if (warming) return; updateMarker(); renderer.render(scene, camera); }
  const booting = () => ['loading', 'revealing'].includes(root.dataset.bootState);
  const transitioning = () => ['covering', 'revealing'].includes(root.dataset.pixelTransition);
  const animating = () => !warming && !booting() && !transitioning() && !paused && !hidden && !lost && !reduced() && onscreen;

  function frame(t) {
    raf = 0;
    if (!animating()) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    update(dt); draw();
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    if (animating()) { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    else { if (coreBurst.active) recoverCore(); if (scanOn) clearScan(); if (raf) { cancelAnimationFrame(raf); raf = 0; } if (!lost) staticFrame(); }
  }
  function staticFrame() {
    if (lost) return;
    modeT = modeTarget; applyMode();
    viewYaw = orbitYaw; viewPitch = orbitPitch;
    setCameraZoom(coreBurst.active ? 1 : zoomLevel);
    if (reduced()) { scrollS = scrollT; sx = px; sy = py; }
    applyPose();
    U.uTime.value = time; U.uPulse.value = pulse; draw();
  }

  /* ---------- Events ---------- */
  const readScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    scrollT = Math.min(1, Math.max(0, window.scrollY / max));
    if (!animating() && onscreen && !document.hidden) staticFrame();
  };
  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('pointermove', e => {
    px = (e.clientX / window.innerWidth - 0.5) * 2; py = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('resize', layout);
  window.addEventListener('portfolio:mode', e => {
    const m = e.detail && e.detail.mode;
    if (m !== 'planet' && m !== 'constellation') return;
    if (coreBurst.active) recoverCore();
    modeTarget = m === 'constellation' ? 1 : 0;
    root.dataset.sceneMode = m;
    if (!animating()) staticFrame();
  });
  const stageEl = document.querySelector('.planet-model-stage');
  const originalHostParent = host.parentElement;
  const originalHostNext = host.nextSibling;
  let coreFullscreen = false;
  function expandCoreCanvas() {
    if (!stageEl || coreFullscreen) return;
    coreFullscreen = true;
    host.classList.add('core-fullscreen');
    document.body.appendChild(host);
    layout();
  }
  function restoreCoreCanvas() {
    if (!coreFullscreen) return;
    coreFullscreen = false;
    host.classList.remove('core-fullscreen');
    originalHostParent.insertBefore(host, originalHostNext?.parentNode === originalHostParent ? originalHostNext : null);
    layout();
  }
  // Mouse/pen capture keeps dragging smooth beyond the pane. Touch is left to
  // native scrolling; keyboard arrows provide the same deliberate rotation.
  function renderManualPose() {
    if (orbitRaf || animating() || hidden || lost || !onscreen) return;
    orbitRaf = requestAnimationFrame(() => {
      orbitRaf = 0;
      if (!hidden && !lost && onscreen && !animating()) staticFrame();
    });
  }
  function setZoom(v) {
    const next = roundZoom(v);
    if (next === zoomLevel) return;
    zoomLevel = next; emitZoom(); renderManualPose();
  }
  // detail: { direction: 1|-1|'in'|'out' } or { value: absolute level }. Ignored during the core explosion.
  window.addEventListener('portfolio:zoom', e => {
    const d = e.detail || {};
    if (coreBurst.active || lost) return;
    if (typeof d.value === 'number' && isFinite(d.value)) { setZoom(d.value); return; }
    const dir = d.direction === 'in' || d.direction > 0 ? 1 : d.direction === 'out' || d.direction < 0 ? -1 : 0;
    if (dir) setZoom(zoomLevel * (dir > 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
  });
  function resetOrbit() {
    orbitYaw = 0; orbitPitch = 0; px = py = sx = sy = 0;
    if (zoomLevel !== 1) { zoomLevel = 1; emitZoom(); }
    renderManualPose();
  }
  function endDrag(event) {
    if (dragId === null || (event?.pointerId !== undefined && event.pointerId !== dragId)) return;
    const id = dragId;
    dragId = null;
    stageEl?.classList.remove('is-dragging');
    if (stageEl?.hasPointerCapture(id)) stageEl.releasePointerCapture(id);
  }
  if (stageEl) {
    stageEl.addEventListener('pointerdown', event => {
      if (event.target.closest?.('button') || event.pointerType === 'touch' || event.button !== 0 || hidden || lost) return;
      event.preventDefault();
      dragId = event.pointerId; dragX = event.clientX; dragY = event.clientY;
      stageEl.setPointerCapture(dragId);
      stageEl.classList.add('is-dragging');
      stageEl.focus({ preventScroll: true });
    });
    stageEl.addEventListener('pointermove', event => {
      if (event.pointerId !== dragId) return;
      orbitYaw += (event.clientX - dragX) * 0.008;
      orbitPitch = THREE.MathUtils.clamp(orbitPitch + (event.clientY - dragY) * 0.006, -1.05, 1.05);
      dragX = event.clientX; dragY = event.clientY;
      renderManualPose();
    });
    stageEl.addEventListener('pointerup', endDrag);
    stageEl.addEventListener('pointercancel', endDrag);
    stageEl.addEventListener('lostpointercapture', endDrag);
    stageEl.addEventListener('keydown', event => {
      if (event.target.closest?.('button')) return;
      if (!event.altKey && !event.metaKey && !event.ctrlKey) {
        const z = event.key === '+' || event.key === '=' ? 'in' : event.key === '-' || event.key === '_' ? 'out' : null;
        if (z) { event.preventDefault(); window.dispatchEvent(new CustomEvent('portfolio:zoom', { detail: { direction: z } })); return; }
      }
      if (event.key === 'Home') { event.preventDefault(); resetOrbit(); return; }
      const directions = { ArrowLeft: [-0.18, 0], ArrowRight: [0.18, 0], ArrowUp: [0, -0.14], ArrowDown: [0, 0.14] };
      const delta = directions[event.key];
      if (!delta || event.altKey || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      orbitYaw += delta[0]; orbitPitch = THREE.MathUtils.clamp(orbitPitch + delta[1], -1.05, 1.05);
      renderManualPose();
    });
    window.addEventListener('blur', () => endDrag());
  }
  window.addEventListener('portfolio:reset', resetOrbit);
  if (stageEl && typeof IntersectionObserver === 'function') {
    new IntersectionObserver(entries => {
      const on = entries[entries.length - 1].isIntersecting;
      if (on !== onscreen) { onscreen = on; sync(); }
    }, { rootMargin: '80px' }).observe(stageEl);
  }
  if (typeof ResizeObserver === 'function') {
    let roRaf = 0;
    const ro = new ResizeObserver(() => { if (roRaf) return; roRaf = requestAnimationFrame(() => { roRaf = 0; layout(); }); });
    const hero = document.querySelector('.hero'), stg = document.querySelector('.planet-model-stage');
    if (hero) ro.observe(hero);
    if (stg) ro.observe(stg);
  }
  window.addEventListener('portfolio:motion', e => { paused = !!(e.detail && e.detail.paused); sync(); });
  window.addEventListener('portfolio:booted', sync);
  window.addEventListener('portfolio:transition-start', () => { cancelAnimationFrame(raf); raf = 0; });
  window.addEventListener('portfolio:transition-idle', () => { if (!warming) sync(); });
  window.addEventListener('portfolio:pulse', () => { pulse = 1; if (!animating()) { U.uPulse.value = 1; staticFrame(); } });
  window.addEventListener('portfolio:explode', () => {
    if (!animating()) { recoverCore(); return; }
    modeTarget = modeT = 0;
    root.dataset.sceneMode = 'planet';
    setCameraZoom(1); // keep the expanding burst unclipped; level restores after reform
    clearScan(); pulse = 0; U.uPulse.value = 0;
    expandCoreCanvas();
    coreBurst.trigger(); burstTick = performance.now();
    root.dataset.coreState = 'exploding';
    applyMode();
    emitZoom();
  });
  window.addEventListener('portfolio:scan', e => {
    const on = !!(e.detail && e.detail.active);
    if (on && coreBurst.active) recoverCore();
    if (on && animating()) { scanOn = true; scanT = 0; setScanUniforms(); }
    else if (scanOn || U.uScanOn.value) { clearScan(); if (!animating() && !lost) staticFrame(); }
  });
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; sync(); });
  const onRM = () => sync();
  reduceMQ.addEventListener ? reduceMQ.addEventListener('change', onRM) : reduceMQ.addListener(onRM);
  const onMQ = () => layout();
  mobileMQ.addEventListener ? mobileMQ.addEventListener('change', onMQ) : mobileMQ.addListener(onMQ);

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); lost = true;
    if (coreBurst.active) recoverCore();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    root.dataset.webgl = 'unavailable'; setMarkerState('hidden'); emitZoom();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; warming = false; layout(); staticFrame(); root.dataset.webgl = 'ready'; sync(); emitZoom();
  });

  if (stageEl) {   // initial visibility from rect (avoid RAF for an invisible stage)
    const r = stageEl.getBoundingClientRect();
    onscreen = r.width > 0 && r.height > 0 && r.bottom > -80 && r.top < window.innerHeight + 80 && r.right > -80 && r.left < window.innerWidth + 80;
  }
  layout(); readScroll();
  if (reduced()) { time = 4; }
  root.dataset.webgl = 'loading';
  emitZoom(); emitPose(true);
  // Compile programs asynchronously before the scanner reveals the viewport.
  const prepared = renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve();
  prepared.then(() => {
    if (lost) return;
    warming = false;
    staticFrame(); // upload textures/geometry and submit a complete first frame
    requestAnimationFrame(() => {
      if (lost) return;
      root.dataset.webgl = 'ready';
      if (!booting()) sync();
      emitZoom();
      window.dispatchEvent(new Event('portfolio:scene-ready'));
    });
  }).catch(err => { console.warn('[scene warmup]', err); root.dataset.webgl = 'unavailable'; lost = true; emitZoom(); });
}

function startScene() {
  try { init(); } catch (err) { console.error('[sci-fi-scene]', err); root.dataset.webgl = 'unavailable'; }
}
// Never compete with the incoming pixel wipe. Still prewarm behind the first-entry scanner.
function queueScene() {
  const stage = document.querySelector('.planet-model-stage');
  if (stage && 'IntersectionObserver' in window) {
    const box = stage.getBoundingClientRect();
    if (box.bottom < -80 || box.top > innerHeight + 80) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); requestAnimationFrame(startScene); }
      }, { rootMargin: '80px' });
      observer.observe(stage);
      return;
    }
  }
  requestAnimationFrame(() => {
    if (window.requestIdleCallback) requestIdleCallback(startScene, { timeout: 80 }); else setTimeout(startScene, 0);
  });
}
if (['covering', 'revealing'].includes(root.dataset.pixelTransition)) {
  window.addEventListener('portfolio:transition-idle', queueScene, { once: true });
} else { queueScene(); }
