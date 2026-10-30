/* Launch Pad — Week 7 · Rockets, orbits & space systems
   2D launch physics around a round, spinning Earth: thrust, mass flow (rocket equation),
   exponential atmosphere (density halves every 5.5 km), drag, staging, gravity turn, orbit check. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  const V3 = THREE.Vector3;

  AC.boot({ game: 'rocket', week: 7, topic: 'Rockets, Orbits & Space', title: 'Launch Pad', help: () => help() });

  const S = AC.scene({ fov: 55, near: 0.5, far: 3e8, logDepth: true, background: 0x8fc4ea });
  const { scene, camera, renderer } = S;
  const GM = 3.986e14, R = 6.371e6, g0 = 9.81, OMEGA = 7.292e-5;
  const PAD_TOP = 4;
  const SKY = new THREE.Color(0x8fc4ea), SPACE = new THREE.Color(0x02040a);

  const lights = AC.lights(scene, { sky: 0xdfefff, ground: 0x6b6250, hemi: 0.75, sun: 1.1, dir: [0.6, 1, 0.8] });
  const stars = AC.starfield(scene, 3000, 1e8, 1.6);
  stars.material.transparent = true;

  // ---------------------------------------------------------------- Earth (rotates), inertial overlay (does not)
  const earthG = new THREE.Group();
  scene.add(earthG);
  const earth = AC.models.planet('earth', R, 160);
  earth.rotation.x = -Math.PI / 2; // poles on ±Z, the equator is our 2D flight plane
  if (earth.userData.clouds) earth.userData.clouds.scale.setScalar(1.0016 / 1.012);
  earth.children[2] && earth.children[2].scale.setScalar(1.016 / 1.06);
  earthG.add(earth);
  const inertialG = new THREE.Group();
  scene.add(inertialG);

  // launch site: savanna disc, pad, tower (on top of Earth at +Y)
  const site = new THREE.Group();
  site.position.set(0, R, 0);
  earthG.add(site);
  const savTex = AC.canvasTex(256, 256, (g, w, hh) => {
    g.fillStyle = '#7f8f4a'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 4000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(60,80,30,0.35)' : 'rgba(170,150,90,0.3)'; g.fillRect(Math.random() * w, Math.random() * hh, 3, 3); }
  }, [400, 400]);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40000, 64), new THREE.MeshLambertMaterial({ map: savTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.2;
  site.add(ground);
  const mat = AC.models.mat, mesh = AC.models.mesh;
  mesh(new THREE.CylinderGeometry(18, 20, PAD_TOP, 32), mat(0x8d949c), 0, PAD_TOP / 2, 0, site);
  const tower = new THREE.Group();
  for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.6, 80, 0.6), mat(0xd8332a), 14 + (i % 2) * 5, 40 + PAD_TOP, (i < 2 ? -1 : 1) * 2.5, tower);
  for (let y = 6; y < 84; y += 6) mesh(new THREE.BoxGeometry(5.6, 0.4, 5.6), mat(0xb02a22), 16.5, y + PAD_TOP, 0, tower);
  for (const y of [20, 45, 70]) mesh(new THREE.BoxGeometry(10, 0.8, 1.2), mat(0x8d949c), 9, y + PAD_TOP, 0, tower);
  site.add(tower);
  for (let i = 0; i < 6; i++) { const t = mesh(new THREE.CylinderGeometry(6, 6, 14, 20), mat(0xf2f5f8), -60 - i * 16, 7, 40, site); }
  const vab = mesh(new THREE.BoxGeometry(60, 70, 50), mat(0xdfe5ea), -200, 35, -160, site);
  const flagSign = AC.textSprite('KAMPALA SPACE PORT · 0.3° N', { color: '#e9f0f7', bg: 'rgba(29,79,145,0.9)', size: 8 });
  flagSign.position.set(-200, 80, -130);
  site.add(flagSign);

  // atmosphere layer circles in the flight plane
  const LAYERS = [
    { h: 12e3, name: '12 km · top of troposphere', color: 0x9fd0ff },
    { h: 50e3, name: '50 km · top of stratosphere', color: 0x7fb4ff },
    { h: 80e3, name: '80 km · top of mesosphere', color: 0x6f8fff },
    { h: 100e3, name: '100 km · KÁRMÁN LINE (space)', color: 0xff70d8 },
  ];
  const rocketTag = S.tag('ROCKET', 'var(--amber)');
  rocketTag.visible = false;
  const layerTags = [];
  LAYERS.forEach((L) => {
    const pts = [];
    for (let i = 0; i <= 1440; i++) { const a = (i / 1440) * Math.PI * 2; pts.push(new V3(Math.sin(a) * (R + L.h), Math.cos(a) * (R + L.h), 0)); }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: L.color, transparent: true, opacity: 0.7 }));
    inertialG.add(line);
    const t = S.tag(L.name, L.h === 100e3 ? 'var(--magenta)' : 'var(--cyan)');
    t.visible = false;
    layerTags.push({ t, L });
  });

  // trajectory + predicted orbit
  const TRAJ_N = 4000;
  const trajPos = new Float32Array(TRAJ_N * 3);
  const trajGeo = new THREE.BufferGeometry();
  trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPos, 3));
  trajGeo.setDrawRange(0, 0);
  const traj = new THREE.Line(trajGeo, new THREE.LineBasicMaterial({ color: 0xffb547 }));
  traj.frustumCulled = false;
  inertialG.add(traj);
  const ORB_N = 361;
  const orbPos = new Float32Array(ORB_N * 3);
  const orbGeo = new THREE.BufferGeometry();
  orbGeo.setAttribute('position', new THREE.BufferAttribute(orbPos, 3));
  const orbLine = new THREE.Line(orbGeo, new THREE.LineDashedMaterial({ color: 0x4be38a, dashSize: 60000, gapSize: 40000 }));
  orbLine.frustumCulled = false;
  orbLine.visible = false;
  inertialG.add(orbLine);

  // ---------------------------------------------------------------- parts catalogue
  const TANKS = { S: { fuel: 20, len: 10, label: 'Small', note: '20 t fuel' }, M: { fuel: 60, len: 22, label: 'Medium', note: '60 t fuel' }, L: { fuel: 120, len: 34, label: 'Large', note: '120 t fuel' }, XL: { fuel: 200, len: 48, label: 'X-Large', note: '200 t fuel' } };
  const ENG1 = { name: 'Mbale-1', T: 800e3, isp: 300, m: 500 };   // first-stage engine (sea level)
  const ENG2 = { name: 'Jinja-V', T: 900e3, isp: 345, m: 600 };   // vacuum upper-stage engine
  const FAIRING = 2000;
  const SITES = { eq: { lat: 0.3, name: 'Kampala (0.3° N)' }, n60: { lat: 60, name: '60° N' } };
  const cfg = { t1: 'L', n1: 1, t2: null, site: 'eq' };

  // ---------------------------------------------------------------- rocket model
  let rocket = null, rocketParts = null;
  function buildModel() {
    if (rocket) scene.remove(rocket);
    rocket = new THREE.Group();
    const s1 = AC.models.rocketStage({ r: 1.8, len: TANKS[cfg.t1].len, color: 0xf2f5f8, band: 0x1d4f91, fins: true, engines: cfg.n1, bell: 1.6 });
    rocket.add(s1);
    const f1 = AC.models.flame(cfg.n1 > 1 ? 2.4 : 1.4, 22);
    f1.position.y = -1.6;
    s1.add(f1);
    let top = TANKS[cfg.t1].len;
    let s2 = null, f2 = null;
    if (cfg.t2) {
      s2 = AC.models.rocketStage({ r: 1.8, len: TANKS[cfg.t2].len * 0.5, color: 0xe9eef3, band: 0xd8332a, fins: false, engines: 1, bell: 2.4 });
      s2.position.y = top + 0.6;
      rocket.add(s2);
      f2 = AC.models.flame(1.6, 30);
      f2.position.y = -2.4;
      s2.add(f2);
      top += TANKS[cfg.t2].len * 0.5 + 0.6;
    }
    const fair = AC.models.fairing(1.8, 9, 0xf2f5f8);
    fair.position.y = top;
    rocket.add(fair);
    const sat = AC.models.cubesat();
    sat.scale.setScalar(1.2);
    sat.position.y = top + 1.5;
    sat.visible = false;
    rocket.add(sat);
    f1.visible = false;
    if (f2) f2.visible = false;
    rocketParts = { s1, s2, f1, f2, fair, sat, height: top + 9 };
    scene.add(rocket);
    rocket.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  }

  // ---------------------------------------------------------------- flight state
  const F = { P: new V3(), V: new V3(), t: 0, stages: [], si: 0, payload: 1000, fairing: true, phase: 'build', pitch: 0, auto: true, warp: 1, autoWarp: true, lat: 0.3, maxQ: 0, q: 0, events: new Set(), ignT: 0, rot: 0, apo: 0, peri: 0, eps: 0, launches: 0, mecO: false, maxAlt: 0, emptyT: 0 };
  const up = new V3(), east = new V3(), dir = new V3(), force = new V3(), tmp = new V3(), air = new V3();
  const omegaEff = () => OMEGA * Math.cos(AC.rad(F.lat));
  const padR = () => R + PAD_TOP + 1.6;
  // earthG.rotation.z = rot (negative = the site moves east, towards +X)
  function siteDir(rot) { return new V3(Math.sin(-rot), Math.cos(-rot), 0); }

  function resetFlight(payload) {
    F.payload = payload;
    F.lat = SITES[cfg.site].lat;
    F.stages = [{ fuel: TANKS[cfg.t1].fuel * 1000, fuel0: TANKS[cfg.t1].fuel * 1000, dry: TANKS[cfg.t1].fuel * 80 + cfg.n1 * ENG1.m, T: cfg.n1 * ENG1.T, ve: ENG1.isp * g0, name: 'Stage 1' }];
    if (cfg.t2) F.stages.push({ fuel: TANKS[cfg.t2].fuel * 1000, fuel0: TANKS[cfg.t2].fuel * 1000, dry: TANKS[cfg.t2].fuel * 80 + ENG2.m, T: ENG2.T, ve: ENG2.isp * g0, name: 'Stage 2' });
    F.si = 0; F.fairing = true; F.t = 0; F.rot = 0; F.pitch = 0; F.auto = true; F.warp = 1; F.autoWarp = true;
    F.maxQ = 0; F.q = 0; F.events = new Set(); F.ignT = 0; F.mecO = false; F.maxAlt = 0; F.emptyT = 0;
    F.P.copy(siteDir(0)).multiplyScalar(padR());
    F.V.set(omegaEff() * padR(), 0, 0);
    F.hgt = padR() - R; F.vr = 0; F.vh = omegaEff() * padR(); F.T = 0; F.m = 1; F.rho = 1.225;
    F.phase = 'build';
    earthG.rotation.z = 0;
    trajGeo.setDrawRange(0, 0);
    trajN = 0;
    orbLine.visible = false;
    debris.forEach((d) => scene.remove(d.g));
    debris.length = 0;
    buildModel();
  }
  const mass = () => F.stages.slice(F.si).reduce((s, q) => s + q.fuel + q.dry, 0) + F.payload + (F.fairing ? FAIRING : 0);
  const stage = () => F.stages[F.si];
  const thrustOn = () => F.phase === 'flight' && !F.mecO && stage() && stage().fuel > 0;

  function guidance(hgt, vr) {
    if (!F.auto) return F.pitch;
    if (mission().vertical) return 0;
    if (F.si > 0) return 90 - clamp(-vr * 0.12, 0, 45); // upper stage: fly sideways, nose up if sinking
    return 88 * Math.pow(clamp((hgt - 800) / 95000, 0, 1), 0.5); // gravity turn
  }

  function step(dt) {
    const r = F.P.length(), hgt = r - R;
    up.copy(F.P).divideScalar(r);
    east.set(up.y, -up.x, 0);
    const vr = F.V.dot(up), vh = F.V.dot(east);
    const manual = AC.axis(['ArrowLeft'], ['ArrowRight'], RS.x);
    if (Math.abs(manual) > 0.1) { F.auto = false; F.pitch = clamp(F.pitch + manual * 12 * dt, -20, 120); }
    else F.pitch = guidance(hgt, vr);
    const p = AC.rad(F.pitch);
    dir.copy(up).multiplyScalar(Math.cos(p)).addScaledVector(east, Math.sin(p));
    const m = mass();
    let T = 0;
    const st = stage();
    if (thrustOn()) {
      T = st.T;
      st.fuel = Math.max(0, st.fuel - (T / st.ve) * dt);
    }
    // air moves with the spinning Earth
    air.copy(east).multiplyScalar(omegaEff() * r);
    tmp.copy(F.V).sub(air);
    const vrel = tmp.length();
    const rho = hgt < 150e3 ? 1.225 * Math.exp(-Math.max(0, hgt) / 7940) : 0;
    F.q = 0.5 * rho * vrel * vrel;
    F.rho = rho;
    const D = F.q * 0.5 * 10.2;
    force.copy(dir).multiplyScalar(T);
    if (vrel > 0.01) force.addScaledVector(tmp, -D / vrel);
    force.addScaledVector(F.P, (-GM * m) / (r * r * r));
    F.T = T; F.D = D; F.m = m;
    // sitting on the pad (rotating with the Earth)
    if (r <= padR() + 0.5 && force.dot(up) <= 0 && vr <= 0.5) {
      F.P.copy(siteDir(F.rot)).multiplyScalar(padR());
      F.V.copy(east).multiplyScalar(omegaEff() * padR());
      F.onPad = true;
    } else {
      F.onPad = false;
      F.V.addScaledVector(force, dt / m);
      F.P.addScaledVector(F.V, dt);
    }
    F.t += dt;
    F.rot = -omegaEff() * F.t;
    if (r < R - 50 && F.t > 5) crashed();
    F.vr = vr; F.vh = vh; F.hgt = hgt;
    F.maxAlt = Math.max(F.maxAlt, hgt);
  }

  function orbitElements() {
    const r = F.P.length();
    const v2 = F.V.lengthSq();
    const eps = v2 / 2 - GM / r;
    const hz = F.P.x * F.V.y - F.P.y * F.V.x;
    const e = Math.sqrt(Math.max(0, 1 + (2 * eps * hz * hz) / (GM * GM)));
    const a = -GM / (2 * eps);
    F.eps = eps; F.e = e; F.a = a; F.hz = hz;
    F.peri = eps < 0 ? a * (1 - e) - R : -R;
    F.apo = eps < 0 ? a * (1 + e) - R : Infinity;
    F.vCirc = Math.sqrt(GM / r);
  }
  function drawOrbit() {
    if (F.eps >= 0 || F.hgt < 40e3) { orbLine.visible = false; return; }
    const { a, e } = F;
    const r = F.P, v = F.V;
    const rl = r.length();
    const rv = r.dot(v);
    const ex = ((v.lengthSq() - GM / rl) * r.x - rv * v.x) / GM, ey = ((v.lengthSq() - GM / rl) * r.y - rv * v.y) / GM;
    const w = Math.atan2(ey, ex);
    const dirSign = F.hz >= 0 ? 1 : -1;
    for (let i = 0; i < ORB_N; i++) {
      const nu = (i / (ORB_N - 1)) * Math.PI * 2;
      const rr = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
      const ang = w + dirSign * nu;
      orbPos.set([rr * Math.cos(ang), rr * Math.sin(ang), 0], i * 3);
    }
    orbGeo.attributes.position.needsUpdate = true;
    orbLine.computeLineDistances();
    orbLine.visible = true;
  }

  let trajN = 0, trajT = 0;
  function recordTraj(dt) {
    trajT += dt;
    if (trajT < 1 || trajN >= TRAJ_N) return;
    trajT = 0;
    trajPos.set([F.P.x, F.P.y, 0], trajN * 3);
    trajN++;
    trajGeo.setDrawRange(0, trajN);
    trajGeo.attributes.position.needsUpdate = true;
    trajGeo.computeBoundingSphere();
  }

  // ---------------------------------------------------------------- staging, fairing, debris, smoke
  const debris = [];
  function addDebris(obj, kick) {
    const wp = new V3(), wq = new THREE.Quaternion();
    obj.getWorldPosition(wp);
    obj.getWorldQuaternion(wq);
    const g = new THREE.Group();
    obj.parent.remove(obj);
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    g.add(obj);
    g.quaternion.copy(wq);
    scene.add(g);
    const P = F.P.clone().add(wp);
    const V = F.V.clone().add(kick || new V3());
    debris.push({ g, P, V, t: 0, spin: new V3(AC.rand(-0.3, 0.3), 0, AC.rand(-0.3, 0.3)) });
  }
  function doStage() {
    if (F.si >= F.stages.length - 1 || F.phase !== 'flight') return;
    const old = F.stages[F.si];
    F.si++;
    rocketParts.f1.visible = false;
    addDebris(rocketParts.s1, tmp.copy(dir).multiplyScalar(-8));
    // shift the remaining rocket down so its base sits at the origin again
    const shift = rocketParts.s2.position.y;
    rocket.children.forEach((c) => (c.position.y -= shift));
    AC.audio.whoosh();
    AC.ui.toast('STAGE SEPARATION', 'var(--amber)');
    once('stage', 'Staging', 'You just dropped ' + AC.fmt(old.dry / 1000, 1) + ' t of empty tank and engines. Less mass to push means each kilogram of fuel now adds more speed (rocket equation).');
  }
  function dropFairing() {
    if (!F.fairing) return;
    F.fairing = false;
    const fa = rocketParts.fair;
    addDebris(fa, tmp.copy(east).multiplyScalar(6));
    once('fair', 'Fairing jettisoned', 'Above 110 km there is almost no air, so the nose cone that protected the satellite is just dead weight. Drop it!');
  }
  function stepDebris(dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      const r = d.P.length();
      d.V.addScaledVector(d.P, (-GM / (r * r * r)) * dt);
      d.P.addScaledVector(d.V, dt);
      d.t += dt;
      d.g.rotation.x += d.spin.x * dt;
      d.g.rotation.z += d.spin.z * dt;
      if (r < R || d.t > 400) { scene.remove(d.g); debris.splice(i, 1); }
    }
  }
  // smoke puffs at the pad
  const smokeTex = AC.canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(240,240,240,0.9)'); gr.addColorStop(1, 'rgba(240,240,240,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const smoke = [];
  for (let i = 0; i < 90; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false;
    site.add(s);
    smoke.push({ s, t: 99, v: new V3() });
  }
  let smokeI = 0, smokeAcc = 0;
  function stepSmoke(dt) {
    if (F.phase === 'flight' && thrustOn() && F.hgt < 400) {
      smokeAcc += dt * 40;
      while (smokeAcc > 1) {
        smokeAcc--;
        const p = smoke[smokeI++ % smoke.length];
        p.t = 0;
        const a = Math.random() * Math.PI * 2;
        p.v.set(Math.cos(a) * AC.rand(10, 30), AC.rand(1, 6), Math.sin(a) * AC.rand(10, 30));
        p.s.position.set(0, PAD_TOP + 2, 0);
        p.s.visible = true;
      }
    }
    for (const p of smoke) {
      if (p.t > 8) { p.s.visible = false; continue; }
      p.t += dt;
      p.s.position.addScaledVector(p.v, dt);
      p.v.multiplyScalar(Math.exp(-0.5 * dt));
      const sc = 8 + p.t * 9;
      p.s.scale.set(sc, sc, 1);
      p.s.material.opacity = 0.8 * (1 - p.t / 8);
    }
  }

  // ---------------------------------------------------------------- input
  const RS = AC.touch.stick('r', 'PITCH ←/→');
  AC.touch.button('STAGE', () => doStage());
  function setWarp(w, manual) { F.warp = w; if (manual) F.autoWarp = false; warpBtn && (warpBtn.textContent = 'Warp ×' + w); }

  // ---------------------------------------------------------------- HUD
  let hud = null, builder = null, warpBtn = null;
  function flightHud() {
    if (hud) hud.el.remove();
    hud = AC.ui.hud();
    hud.section('Flight').row('t', 'Mission time').row('alt', 'Altitude').row('spd', 'Speed').row('vh', 'Sideways speed').row('vr', 'Vertical speed').row('pitch', 'Pitch').row('layer', 'Layer');
    hud.section('Rocket').row('stg', 'Stage').meter('fuel').row('mass', 'Mass').row('thr', 'Thrust').row('tw', 'Thrust ÷ weight').row('q', 'Dynamic pressure').row('rho', 'Air density');
    hud.formula('dv', '');
    hud.section('Orbit').row('vc', 'Orbit speed here').row('apo', 'Highest point').row('peri', 'Lowest point');
    hud.formula('orb', 'v = √(GM ÷ r)');
  }
  function layerName(hgt) { return hgt < 12e3 ? 'Troposphere' : hgt < 50e3 ? 'Stratosphere' : hgt < 80e3 ? 'Mesosphere' : hgt < 100e3 ? 'Thermosphere' : 'SPACE'; }
  function hudUpdate() {
    if (!hud || F.phase === 'build') return;
    const v = F.V.length() - (F.onPad ? F.V.length() : 0);
    hud.set('t', 'T+' + AC.fmt(F.t, 0) + ' s');
    hud.set('alt', F.hgt < 10000 ? AC.fmt(Math.max(0, F.hgt - PAD_TOP - 1.6)) + ' m' : AC.fmt(F.hgt / 1000, 1) + ' km');
    hud.set('spd', AC.fmt(F.V.length() / 1000, 2) + ' km/s', 'cyan');
    hud.set('vh', AC.fmt(F.vh / 1000, 2) + ' km/s');
    hud.set('vr', AC.fmt(F.vr) + ' m/s');
    hud.set('pitch', AC.fmt(F.pitch) + '°' + (F.auto ? ' auto' : ' manual'));
    hud.set('layer', layerName(F.hgt), F.hgt >= 100e3 ? 'mag' : 'cyan');
    const st = stage();
    hud.set('stg', (st ? st.name : '-') + ' of ' + F.stages.length + (F.mecO ? ' · engine off' : ''));
    hud.setMeter('fuel', st ? st.fuel / st.fuel0 : 0, st && st.fuel / st.fuel0 < 0.15 ? 'var(--amber)' : 'var(--green)');
    hud.set('mass', AC.fmt(F.m / 1000, 1) + ' t');
    hud.set('thr', AC.fmt(F.T / 1000) + ' kN');
    const tw = F.T / (F.m * g0);
    hud.set('tw', AC.fmt(tw, 2), F.T && tw < 1 ? 'bad' : '');
    hud.set('q', AC.fmt(F.q / 1000, 1) + ' kPa' + (F.maxQ > 0 && F.q < F.maxQ * 0.98 && F.events.has('maxq') ? '' : ''));
    hud.set('rho', F.rho > 1e-4 ? AC.fmt(F.rho, 4) + ' kg/m³' : '≈ 0 (vacuum)');
    if (st) {
      const m0 = F.m, mf = F.m - st.fuel;
      hud.setFormula('dv', 'Δv left in this stage = vₑ × ln(m₀ ÷ m_f)\n= ' + AC.fmt(st.ve) + ' × ln(' + AC.fmt(m0 / 1000, 1) + ' ÷ ' + AC.fmt(mf / 1000, 1) + ')\n= ' + AC.fmt((st.ve * Math.log(m0 / mf)) / 1000, 2) + ' km/s');
    }
    hud.set('vc', AC.fmt(F.vCirc / 1000, 2) + ' km/s', 'mag');
    hud.set('apo', F.eps < 0 ? AC.fmt(F.apo / 1000) + ' km' : 'escaping!', 'cyan');
    hud.set('peri', F.peri > 0 ? AC.fmt(F.peri / 1000) + ' km' : 'falls back to Earth', F.peri > 140e3 ? '' : 'warn');
    hud.setFormula('orb', 'Orbit speed here = √(GM ÷ r)\n= √(3.986×10¹⁴ ÷ ' + AC.fmt(F.P.length() / 1000) + ' km)\n= ' + AC.fmt(F.vCirc / 1000, 2) + ' km/s · you: ' + AC.fmt(F.vh / 1000, 2));
  }

  // ---------------------------------------------------------------- builder
  function evalBuild(payload) {
    const st1fuel = TANKS[cfg.t1].fuel * 1000, st1dry = TANKS[cfg.t1].fuel * 80 + cfg.n1 * ENG1.m;
    let up2 = payload;
    let dv2 = 0, tw2 = 0;
    if (cfg.t2) {
      const f2 = TANKS[cfg.t2].fuel * 1000, d2 = TANKS[cfg.t2].fuel * 80 + ENG2.m;
      const m02 = f2 + d2 + payload;
      dv2 = ENG2.isp * g0 * Math.log(m02 / (d2 + payload));
      tw2 = ENG2.T / (m02 * g0);
      up2 = m02;
    }
    const m01 = st1fuel + st1dry + up2 + FAIRING;
    const dv1 = ENG1.isp * g0 * Math.log(m01 / (m01 - st1fuel));
    const tw1 = (cfg.n1 * ENG1.T) / (m01 * g0);
    return { m01, dv1, dv2, tw1, tw2, dv: dv1 + dv2, boost: 465 * Math.cos(AC.rad(SITES[cfg.site].lat)) };
  }
  function buildBuilder() {
    if (builder) builder.remove();
    const M = mission();
    const calc = h('div', { class: 'calc' });
    const checks = h('div', { class: 'checks' });
    function seg(label, options, get, set, disabled) {
      const wrap = h('div', { class: 'ac-seg' });
      options.forEach((o) => {
        const b = h('button', { type: 'button', class: get() === o.v ? 'on' : '', disabled: disabled ? true : null }, o.label, o.note ? h('small', {}, o.note) : null);
        b.addEventListener('click', () => { set(o.v); [...wrap.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); AC.audio.click(); refresh(); });
        wrap.appendChild(b);
      });
      return h('div', { class: 'grp' }, h('div', {}, label), wrap);
    }
    const tankOpts = Object.keys(TANKS).map((k) => ({ v: k, label: TANKS[k].label, note: TANKS[k].note }));
    const launchBtn = h('button', { class: 'ac-btn', type: 'button' }, 'Launch');
    launchBtn.addEventListener('click', launch);
    function refresh() {
      resetFlight(M.payload);
      const r = evalBuild(M.payload);
      calc.innerHTML = '';
      const row = (k, v, hl) => calc.append(h('span', {}, k), h('span', { class: hl ? 'hl' : '' }, v));
      row('Lift-off mass', AC.fmt(r.m01 / 1000, 1) + ' t');
      row('Lift-off thrust', AC.fmt((cfg.n1 * ENG1.T) / 1000) + ' kN');
      row('T/W = thrust ÷ (m × g)', AC.fmt(r.tw1, 2), true);
      row('Stage 1 Δv', AC.fmt(r.dv1 / 1000, 2) + ' km/s');
      if (cfg.t2) { row('Stage 2 Δv', AC.fmt(r.dv2 / 1000, 2) + ' km/s'); row('Stage 2 T/W', AC.fmt(r.tw2, 2)); }
      row('Total Δv', AC.fmt(r.dv / 1000, 2) + ' km/s', true);
      row('Free boost from Earth\'s spin', '+' + AC.fmt(r.boost) + ' m/s');
      checks.innerHTML = '';
      const ck = (cls, txt) => checks.append(h('div', { class: cls }, (cls === 'ok' ? '✓ ' : cls === 'no' ? '✗ ' : '! ') + txt));
      ck(r.tw1 > 1 ? 'ok' : 'no', r.tw1 > 1 ? 'Thrust beats weight: it will lift off' : 'Thrust is less than weight: it cannot lift off');
      if (M.needDv) ck(r.dv + r.boost >= M.needDv ? 'ok' : 'no', 'Δv needed for this mission ≈ ' + AC.fmt(M.needDv / 1000, 1) + ' km/s');
      if (cfg.t2 && r.tw2 < 0.6) ck('mid', 'Stage 2 is very weak (T/W ' + AC.fmt(r.tw2, 2) + '): it may fall back before it gets fast enough');
      launchBtn.disabled = false;
      camFrame();
    }
    const s2Opts = [{ v: null, label: 'None', note: 'one stage' }].concat(Object.keys(TANKS).slice(0, 3).map((k) => ({ v: k, label: TANKS[k].label, note: TANKS[k].note + ' + Jinja-V' })));
    builder = h('div', { class: 'builder ac-panel' },
      h('div', { class: 'mono', style: { fontSize: '0.68rem', color: 'var(--magenta)', letterSpacing: '0.12em' } }, 'VEHICLE ASSEMBLY · PAYLOAD ' + AC.fmt(M.payload / 1000, 1) + ' t'),
      h('h2', {}, 'Build your rocket'),
      seg('Stage 1 tank', tankOpts, () => cfg.t1, (v) => (cfg.t1 = v)),
      seg('Stage 1 engines (Mbale-1, 800 kN each)', [1, 3, 5, 7, 9].map((n) => ({ v: n, label: '× ' + n })), () => cfg.n1, (v) => (cfg.n1 = v)),
      M.allowStage2 ? seg('Stage 2 (Jinja-V vacuum engine, 900 kN)', s2Opts, () => cfg.t2, (v) => (cfg.t2 = v)) : h('p', { class: 'dim', style: { fontSize: '0.8rem' } }, 'Stage 2 unlocks in mission 3.'),
      M.allowSite ? seg('Launch site', [{ v: 'eq', label: 'Kampala', note: '0.3° N · +465 m/s' }, { v: 'n60', label: '60° N', note: '+233 m/s' }], () => cfg.site, (v) => (cfg.site = v)) : null,
      calc, checks, h('div', { class: 'ac-actions' }, launchBtn));
    AC.root().appendChild(builder);
    if (!M.allowStage2) cfg.t2 = null;
    if (!M.allowSite) cfg.site = 'eq';
    refresh();
  }
  function camFrame() {
    if (!rocketParts) return;
    oc.target.set(0, rocketParts.height * 0.5, 0);
    oc.dist = rocketParts.height * 2.4;
    oc.phi = 1.35;
    oc.theta = 0.35;
  }

  // ---------------------------------------------------------------- launch sequence
  let countdown = null;
  function launch() {
    if (builder) { builder.remove(); builder = null; }
    document.body.classList.add('flying');
    F.launches++;
    flightHud();
    const el = h('div', { class: 'countdown' }, '3');
    AC.root().appendChild(el);
    countdown = { el, t: 3 };
    AC.audio.tone(660, 0.12, 'square', 0.1);
  }
  function ignite() {
    F.phase = 'flight';
    F.ignT = 0;
    F.V.set(omegaEff() * padR(), 0, 0); // the pad already moves east with the spinning Earth
    AC.audio.boom();
    once('n3', 'Newton\'s 3rd law', 'The engines throw hot gas down very fast. The gas pushes the rocket up just as hard. Rockets carry their own oxidiser, so this works in space too.');
  }
  function crashed() {
    if (F.phase === 'over') return;
    F.phase = 'over';
    AC.audio.boom();
    if (!MR.current || MR.done) return;
    MR.api.fail('The rocket fell back to Earth. Highest point: ' + AC.fmt(F.maxAlt / 1000, 1) + ' km.');
  }

  // ---------------------------------------------------------------- camera
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 120, min: 15, max: 6e7, phi: 1.35, theta: 0.35, minPhi: 0.05, maxPhi: Math.PI - 0.05 });
  let mapView = false;
  function cameraUpdate(dt) {
    if (F.phase === 'build') { oc.update(dt); return; }
    const hgt = Math.max(0, F.hgt || 0);
    const want = mapView ? 2.4e7 : clamp(140 + hgt * 0.35, 140, 3e6);
    if (!oc.userActive) {
      oc.dist = Math.exp(AC.damp(Math.log(oc.dist), Math.log(want), 1.5, dt || 0.016));
      oc.theta = AC.damp(oc.theta, mapView ? 0 : hgt > 3000 ? 0 : 0.35, 0.8, dt || 0.016);
      oc.phi = AC.damp(oc.phi, Math.PI / 2, 0.8, dt || 0.016);
    }
    if (mapView) oc.target.copy(F.P).negate().multiplyScalar(1); else oc.target.set(0, 0, 0);
    oc.update(dt);
  }

  // ---------------------------------------------------------------- teaching
  const seen = new Set();
  function once(key, title, text, opts) { if (!seen.has(key)) { seen.add(key); AC.fact(title, text, opts); } }
  function events() {
    const hgt = F.hgt;
    if (F.phase !== 'flight') return;
    if (!F.onPad) once('lift', 'Lift-off!', 'Thrust is bigger than weight (T/W > 1), so the net force is upward and the rocket accelerates (F = ma).');
    if (F.q > F.maxQ) F.maxQ = F.q;
    else if (F.maxQ > 5000 && F.q < F.maxQ * 0.9 && !F.events.has('maxq')) {
      F.events.add('maxq');
      AC.fact('Max Q passed', 'Dynamic pressure ½ρv² peaked at ' + AC.fmt(F.maxQ / 1000, 1) + ' kPa. The air is thinning faster than you are speeding up, so the stress on the rocket now drops.', { tag: 'Measured' });
    }
    for (const L of LAYERS) {
      if (hgt > L.h && !F.events.has(L.h)) {
        F.events.add(L.h);
        const msg = {
          12e3: ['Leaving the troposphere', 'All the weather and every airliner are below you now. Air density is about ' + AC.fmt(1.225 * Math.exp(-12e3 / 7940), 2) + ' kg/m³, a quarter of sea level.'],
          50e3: ['Leaving the stratosphere', 'You passed the ozone layer. Air density halves roughly every 5.5 km, so there is almost no air left.'],
          80e3: ['Leaving the mesosphere', 'This is where meteors burn up. Wings and jet engines could never work up here, but rockets carry their own oxidiser.'],
          100e3: ['KÁRMÁN LINE: you are in SPACE', '100 km is a common edge of space. The sky is black. But being in space is not the same as being in orbit!'],
        }[L.h];
        AC.fact(msg[0], msg[1], { color: L.h === 100e3 ? 'var(--magenta)' : 'var(--cyan)', tag: 'Altitude ' + L.h / 1000 + ' km' });
        if (L.h === 100e3) AC.audio.win();
      }
    }
    if (hgt > 110e3 && F.fairing) dropFairing();
  }

  // ---------------------------------------------------------------- missions
  function mission() { return MR.current || missions[0]; }
  const CTRL = ['Choose parts in the builder, then <b>Launch</b>', '<kbd>Space</kbd> stage', '<kbd>←</kbd> <kbd>→</kbd> steer (turns off autopilot)', '<kbd>W</kbd> <kbd>S</kbd> time warp', '<kbd>M</kbd> map view'];
  const missions = [
    {
      id: 'hop', title: 'Hop to 10 km', payload: 1000, vertical: true, objective: 'Build a rocket that can lift off and reach 10 km',
      story: 'Your first rocket carries a 1-tonne weather probe. To leave the pad, the engines must push harder than the whole rocket weighs. Check T/W in the builder before you launch.',
      learn: [
        { t: 'Newton\'s 3rd law', p: 'Engines push gas down; the gas pushes the rocket up.' },
        { t: 'Thrust-to-weight', p: 'T/W must be more than 1 to lift off. Weight = mass × 9.81.', f: 'T/W = T ÷ (m × g)' },
        { t: 'Fuel is heavy', p: 'A bigger tank holds more fuel but makes the rocket heavier. More engines add thrust.' },
      ],
      controls: CTRL,
      proved: 'A rocket lifts off only when thrust is bigger than weight (T/W > 1). As it burns fuel it gets lighter, so the same thrust gives more and more acceleration.',
      tip: 'Look at the T/W number in the builder. Add engines or use a smaller tank until T/W is above 1.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Rockets work in the vacuum')),
      start(api) { cfg.t1 = 'L'; cfg.n1 = 1; cfg.t2 = null; begin(api); },
      update(dt, api) {
        api.progress(Math.max(0, F.hgt) / 10e3, F.phase === 'build' ? 'Build your rocket' : 'Altitude ' + AC.fmt(Math.max(0, F.hgt) / 1000, 1) + ' km');
        if (F.phase === 'flight' && F.onPad && F.ignT > 6) return api.fail('The engines fired for 6 seconds but the rocket never left the pad. T/W was ' + AC.fmt(F.T / (F.m * g0), 2) + ', which is less than 1.');
        if (F.hgt >= 10e3) api.win(F.launches === 1 ? 3 : F.launches === 2 ? 2 : 1, 'You reached 10 km on launch ' + F.launches + '. Lift-off T/W was ' + AC.fmt(evalBuild(1000).tw1, 2) + '.');
      },
    },
    {
      id: 'karman', title: 'Edge of Space', payload: 1000, vertical: true, objective: 'Reach the Kármán line (100 km)',
      story: 'Fly straight up through the atmosphere\'s layers to the edge of space at 100 km. Engineers never waste fuel: the smaller the rocket that makes it, the more stars you earn.',
      learn: [
        { t: 'Thinning air', p: 'Air density halves roughly every 5.5 km. By 50 km there is almost none.' },
        { t: 'Max Q', p: 'Drag stress ½ρv² peaks low down, while the air is still thick and you are speeding up.' },
        { t: 'The rocket equation', p: 'How much speed a stage can add depends on exhaust speed and mass ratio.', f: 'Δv = vₑ × ln(m₀ ÷ m_f)' },
      ],
      controls: CTRL,
      proved: 'Even a small rocket can reach space because Δv grows with the mass ratio. But reaching 100 km is easy compared with orbit: you went UP, and orbit needs about 7.8 km/s SIDEWAYS.',
      tip: 'If you fall short, use a bigger tank or more engines and keep T/W comfortably above 1.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('The Kármán line')),
      start(api) { cfg.t1 = 'M'; cfg.n1 = 3; cfg.t2 = null; begin(api); },
      update(dt, api) {
        api.progress(Math.max(0, F.hgt) / 100e3, F.phase === 'build' ? 'Build your rocket' : layerName(F.hgt));
        if (F.phase === 'flight' && F.onPad && F.ignT > 6) return api.fail('T/W below 1: the rocket never left the pad.');
        if (F.hgt >= 100e3) api.win(cfg.t1 === 'S' ? 3 : cfg.t1 === 'M' ? 2 : 1, 'Space reached with the ' + TANKS[cfg.t1].label.toLowerCase() + ' tank. ' + (cfg.t1 === 'S' ? 'Smallest possible rocket!' : 'Try a smaller tank for more stars.'));
        if (F.phase === 'flight' && F.vr < 0 && F.hgt < F.maxAlt - 2000 && F.maxAlt < 100e3) api.fail('The rocket ran out of speed at ' + AC.fmt(F.maxAlt / 1000, 1) + ' km and is falling back.');
      },
    },
    {
      id: 'orbit', title: 'Why Stages?', payload: 2000, allowStage2: true, allowSite: true, needDv: 9400, objective: 'Put PearlAfricaSat-1 into orbit (lowest point above 140 km)',
      story: 'Carry Uganda\'s CubeSat, PearlAfricaSat-1 (in a 2 t dispenser), into orbit. Orbit needs about 9.4 km/s of Δv: 7.8 km/s of sideways speed plus what you lose to gravity and drag. Can one stage do it?',
      learn: [
        { t: 'Orbit = falling sideways', p: 'Go fast enough sideways and the ground curves away as fast as you fall.', f: 'v = √(GM ÷ r) ≈ 7.8 km/s' },
        { t: 'Why stages?', p: 'Dropping empty tanks and engines means the rest of the fuel only pushes what is left.' },
        { t: 'Equator boost', p: 'The Earth\'s surface at Kampala already moves east at about 465 m/s. Launch east and keep it!' },
      ],
      controls: CTRL,
      proved: 'One stage cannot carry its own empty tank fast enough; the rocket equation has diminishing returns. Staging throws away dead mass so the next engine pushes a lighter rocket. Your satellite is now falling around the Earth, about 16 times a day.',
      tip: 'Add a Stage 2. Try a Large stage 1 tank with 7 or 9 engines, and a Medium stage 2. Keep the total Δv above 9.4 km/s.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Why do rockets use stages')),
      start(api) { cfg.t1 = 'XL'; cfg.n1 = 9; cfg.t2 = null; cfg.site = 'eq'; begin(api); },
      update(dt, api) {
        if (F.phase === 'build') return api.progress(0, 'Build your rocket');
        orbitElements();
        const prog = clamp(F.vh / F.vCirc, 0, 1);
        api.progress(prog, 'Sideways speed ' + AC.fmt(F.vh / 1000, 2) + ' of ' + AC.fmt(F.vCirc / 1000, 2) + ' km/s');
        if (F.phase === 'flight' && F.onPad && F.ignT > 6) return api.fail('T/W below 1: the rocket never left the pad.');
        if (!F.mecO && F.eps < 0 && F.peri > 150e3) {
          F.mecO = true;
          rocketParts.f1.visible = false;
          if (rocketParts.f2) rocketParts.f2.visible = false;
          AC.ui.toast('ORBIT!', 'var(--green)');
          rocketParts.sat.visible = true;
          api.state.orbitT = 0;
          const st = stage();
          api.state.left = st ? st.fuel : 0;
        }
        if (F.mecO) {
          api.state.orbitT += dt;
          rocketParts.sat.position.y += dt * 1.2;
          rocketParts.sat.rotation.y += dt;
          if (api.state.orbitT > 4) api.win(F.launches === 1 ? 3 : F.launches === 2 ? 2 : 1, 'PearlAfricaSat-1 is in orbit: lowest point ' + AC.fmt(F.peri / 1000) + ' km, highest ' + AC.fmt(F.apo / 1000) + ' km. Fuel left: ' + AC.fmt(api.state.left / 1000, 1) + ' t.');
          return;
        }
        const st = stage();
        const out = !st || (st.fuel <= 0 && F.si === F.stages.length - 1);
        if (out && F.phase === 'flight') {
          F.emptyT += dt;
          if (F.emptyT > 3) api.fail('Out of fuel at ' + AC.fmt(F.vh / 1000, 2) + ' km/s sideways. Orbit needs ' + AC.fmt(F.vCirc / 1000, 2) + ' km/s. ' + (F.peri > 0 ? 'Your lowest point is only ' + AC.fmt(F.peri / 1000) + ' km.' : 'Without more speed it falls back to Earth.'));
        }
      },
    },
  ];
  function begin(api) {
    document.body.classList.remove('flying');
    if (hud) { hud.el.remove(); hud = null; }
    if (countdown) { countdown.el.remove(); countdown = null; }
    mapView = false;
    resetFlight(mission().payload);
    buildBuilder();
  }
  const MR = AC.missions({ game: 'rocket', week: 7, list: missions });

  // ---------------------------------------------------------------- tools
  AC.ui.tools([
    { label: 'Stage', title: 'Separate the stage (Space)', onclick: doStage },
    { label: 'Map view', title: 'Zoom out to see the orbit (M)', onclick: () => (mapView = !mapView) },
    { label: 'Warp ×1', title: 'Time warp (W / S)', onclick: () => setWarp(F.warp === 1 ? 5 : F.warp === 5 ? 20 : 1, true) },
    { label: 'Rebuild', title: 'Back to the builder (R)', onclick: () => MR.api.restart() },
  ]);
  warpBtn = [...document.querySelectorAll('.ac-tools button')].find((b) => b.textContent.startsWith('Warp'));
  AC.onKey('Space', doStage);
  AC.onKey('KeyM', () => (mapView = !mapView));
  AC.onKey('KeyW', () => setWarp(F.warp === 1 ? 5 : 20, true));
  AC.onKey('KeyS', () => setWarp(F.warp === 20 ? 5 : 1, true));
  AC.onKey('KeyR', () => MR.api.restart());
  AC.ui.hint('Build → Launch · <kbd>Space</kbd> stage · <kbd>←</kbd><kbd>→</kbd> steer · <kbd>W</kbd><kbd>S</kbd> warp · <kbd>M</kbd> map');
  function help() {
    AC.ui.card({
      eyebrow: 'Week 7', title: 'Launch Pad',
      body: [
        'Build a rocket from tanks and engines, check the numbers, then launch. The autopilot flies a gravity turn: straight up through the thick air, then over towards the east to build sideways speed.',
        AC.ui.learnGrid([
          { t: 'Time warp', p: 'W / S or the Warp button: ×1, ×5, ×20.' },
          { t: 'Staging', p: 'Space drops an empty stage. It happens automatically if you forget.' },
          { t: 'Map view', p: 'M zooms out to show your path (orange) and predicted orbit (green dashes).' },
        ]),
      ],
    });
  }

  // ---------------------------------------------------------------- loop
  S.onFrame((dt, t, real) => {
    if (countdown && !AC.paused) {
      countdown.t -= real;
      const n = Math.ceil(countdown.t);
      if (countdown.el.textContent !== String(n) && n > 0) { countdown.el.textContent = n; AC.audio.tone(660, 0.12, 'square', 0.1); }
      if (countdown.t <= 0) { countdown.el.remove(); countdown = null; ignite(); }
    }
    if (dt > 0 && F.phase === 'flight') {
      if (F.autoWarp && F.warp === 1 && F.hgt > 3000) setWarp(5);
      const total = dt * F.warp;
      const n = Math.max(1, Math.ceil(total / 0.04));
      for (let i = 0; i < n; i++) {
        step(total / n);
        stepDebris(total / n);
        if (F.phase !== 'flight') break;
        const st = stage();
        if (st && st.fuel <= 0 && F.si < F.stages.length - 1) { F.emptyT += total / n; if (F.emptyT > 1.5) { F.emptyT = 0; doStage(); } }
      }
      F.ignT += dt;
      recordTraj(total);
      events();
    }
    orbitElements();
    if (F.phase === 'flight' && F.hgt > 40e3) drawOrbit();
    MR.update(dt);
    // render frame: rocket at origin, the world moves around it
    earthG.position.copy(F.P).negate();
    inertialG.position.copy(F.P).negate();
    earthG.rotation.z = F.rot;
    debris.forEach((d) => d.g.position.copy(d.P).sub(F.P));
    if (rocket) {
      const r = F.P.length();
      up.copy(F.P).divideScalar(r);
      east.set(up.y, -up.x, 0);
      const p = AC.rad(F.pitch);
      dir.copy(up).multiplyScalar(Math.cos(p)).addScaledVector(east, Math.sin(p));
      rocket.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
      const on = thrustOn() && F.phase === 'flight';
      const fl = F.si === 0 ? rocketParts.f1 : rocketParts.f2;
      rocketParts.f1.visible = on && F.si === 0;
      if (rocketParts.f2) rocketParts.f2.visible = on && F.si === 1;
      if (fl && on) {
        const thin = clamp(1 - (F.rho || 0) / 1.225, 0, 1);
        fl.scale.set(1 + thin * 2.5, 1 + thin * 1.5 + Math.random() * 0.1, 1 + thin * 2.5);
      }
    }
    stepSmoke(dt * (F.warp || 1));
    const hgt = Math.max(0, F.hgt || 0);
    scene.background.copy(SKY).lerp(SPACE, clamp(hgt / 60000, 0, 1));
    stars.material.opacity = clamp((hgt - 25000) / 40000, 0, 1);
    stars.position.copy(camera.position);
    site.visible = hgt < 200e3;
    // layer labels sit on their circles just ahead of the rocket
    const showTags = F.phase === 'flight' && (oc.dist > 30000 || mapView);
    const ang = Math.atan2(F.P.x, F.P.y) + (mapView ? 0.05 : 0.002 + oc.dist / 4e7);
    layerTags.forEach(({ t, L }) => {
      t.visible = showTags;
      t.pos.set(Math.sin(ang) * (R + L.h), Math.cos(ang) * (R + L.h), 0).sub(F.P);
    });
    rocketTag.visible = F.phase !== 'build' && oc.dist > 3000;
    rocketTag.pos.set(0, 0, 0);
    if (rocketTag.visible) rocketTag.set(F.mecO ? 'PearlAfricaSat-1' : 'ROCKET · ' + AC.fmt(Math.max(0, F.hgt) / 1000) + ' km');
    hudUpdate();
    cameraUpdate(dt);
    lights.sun.position.set(0.6, 1, 0.8);
  });
  S.start();
  MR.begin();
})();
