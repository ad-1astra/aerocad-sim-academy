/* Orbit Lab — Week 7 · Orbits and satellites
   Newton's cannonball, v = √(GM/r), higher = slower, geostationary orbit over Kampala, escape speed.
   Gravity is integrated step by step (velocity Verlet); 1 scene unit = 1,000 km. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  const V3 = THREE.Vector3;
  AC.boot({ game: 'orbit', week: 7, topic: 'Rockets, Orbits & Space', title: 'Orbit Lab', help: () => help() });

  const GM = 3.986e14, R = 6.371e6, U = 1e-6; // metres → scene units
  const DAY = 86164;
  const S = AC.scene({ fov: 50, near: 0.01, far: 5000, background: 0x02040a });
  const { scene, camera, renderer } = S;
  AC.lights(scene, { sky: 0x8aa0c0, ground: 0x101418, hemi: 0.35, sun: 1.3, dir: [30, 10, 25] });
  AC.starfield(scene, 3000, 2000, 1.5);

  const earthG = new THREE.Group();
  scene.add(earthG);
  const earth = AC.models.planet('earth', R * U, 96);
  earth.rotation.x = -Math.PI / 2; // poles on ±Z; the equator is the XY plane we fly in
  earthG.add(earth);
  // Kampala pin + Newton's "mountain" (as tall as the ISS orbit, like Newton's own drawing)
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff5a4f }));
  pin.position.set(0, R * U + 0.02, 0);
  earthG.add(pin);
  const kTag = S.tag('KAMPALA', 'var(--red)');
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.42, 24), AC.models.mat(0x8a7a62));
  mountain.position.set(0, R * U + 0.2, 0);
  scene.add(mountain);
  const cannon = new THREE.Group();
  AC.models.mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.22, 12), AC.models.mat(0x2a3038, { metalness: 0.6 }), 0, 0, 0, cannon).rotation.z = -Math.PI / 2;
  cannon.position.set(0.05, R * U + 0.43, 0);
  scene.add(cannon);

  // reference rings for the target heights
  function ringAt(alt, color, dashed) {
    const pts = [];
    for (let i = 0; i <= 360; i++) { const a = (i / 360) * Math.PI * 2; pts.push(new V3(Math.sin(a), Math.cos(a), 0).multiplyScalar((R + alt) * U)); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0.8 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }));
    if (dashed) l.computeLineDistances();
    l.visible = false;
    scene.add(l);
    return l;
  }
  const RINGS = { 400e3: ringAt(400e3, 0xff70d8, true), 2000e3: ringAt(2000e3, 0xff70d8, true), 20200e3: ringAt(20200e3, 0xff70d8, true), 35786e3: ringAt(35786e3, 0xff70d8, true) };

  // ---------------------------------------------------------------- satellites
  const sats = [];
  function makeSat(kind, alt, speed) {
    const g = kind === 'geo' ? AC.models.comsat() : kind === 'gps' ? AC.models.gpssat() : AC.models.cubesat();
    g.scale.setScalar(kind === 'cube' ? 0.12 : 0.09);
    scene.add(g);
    const N = 1500;
    const pos = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setDrawRange(0, 0);
    const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: kind === 'geo' ? 0x3fd0f0 : kind === 'gps' ? 0x4be38a : 0xffb547 }));
    trail.frustumCulled = false;
    scene.add(trail);
    const r0 = R + alt;
    const s = { g, trail, geo, pos, N, n: 0, acc: 0, P: new V3(0, r0, 0), V: new V3(speed, 0, 0), alive: true, t: 0, alt0: alt, v0: speed, kind, crossed: 0, lastAng: 0 };
    s.tag = S.tag('', 'var(--amber)');
    sats.push(s);
    return s;
  }
  function clearSats() {
    sats.forEach((s) => { scene.remove(s.g); scene.remove(s.trail); s.tag.el.remove(); s.tag.visible = false; });
    sats.length = 0;
    if (boom) { scene.remove(boom); boom = null; }
  }
  const acc = new V3(), tmp = new V3();
  function gravity(P, out) { const r = P.length(); return out.copy(P).multiplyScalar(-GM / (r * r * r)); }
  function stepSat(s, dt) {
    gravity(s.P, acc);
    s.V.addScaledVector(acc, dt * 0.5);
    s.P.addScaledVector(s.V, dt);
    gravity(s.P, acc);
    s.V.addScaledVector(acc, dt * 0.5);
    s.t += dt;
    const ang = Math.atan2(s.P.x, s.P.y);
    if (s.lastAng < 0 && ang >= 0 && s.t > 60) s.crossed++;
    s.lastAng = ang;
    if (s.P.length() < R) { s.alive = false; impact(s); }
  }
  function elements(s) {
    const r = s.P.length(), v2 = s.V.lengthSq();
    const eps = v2 / 2 - GM / r;
    const hz = s.P.x * s.V.y - s.P.y * s.V.x;
    const e = Math.sqrt(Math.max(0, 1 + (2 * eps * hz * hz) / (GM * GM)));
    const a = -GM / (2 * eps);
    return { eps, e, a, rp: a * (1 - e), ra: a * (1 + e), T: eps < 0 ? 2 * Math.PI * Math.sqrt((a * a * a) / GM) : Infinity };
  }
  let boom = null;
  function impact(s) {
    AC.audio.boom();
    boom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff8a2a }));
    boom.position.copy(s.P).multiplyScalar(U);
    scene.add(boom);
    const ground = Math.abs(Math.atan2(s.P.x, s.P.y)) * R;
    AC.fact('It fell back to Earth', 'The cannonball landed ' + AC.fmt(ground / 1000) + ' km away. Faster means it lands further away, until the ground curves away as fast as it falls.', { color: 'var(--amber)', tag: 'Shot result' });
  }
  function describe(s) {
    const el = elements(s);
    if (el.eps >= 0) return { kind: 'escape', text: 'ESCAPE: it will never come back' };
    if (el.rp < R) return { kind: 'fall', text: 'Falls back to Earth' };
    if (el.e < 0.02) return { kind: 'circle', text: 'CIRCULAR orbit · one lap = ' + fmtT(el.T) };
    return { kind: 'ellipse', text: 'Ellipse · lowest ' + AC.fmt((el.rp - R) / 1000) + ' km, highest ' + AC.fmt((el.ra - R) / 1000) + ' km' };
  }
  const fmtT = (t) => (t < 3 * 3600 ? AC.fmt(t / 60) + ' min' : AC.fmt(t / 3600, 1) + ' h');
  const vCirc = (alt) => Math.sqrt(GM / (R + alt));

  // ---------------------------------------------------------------- HUD + firing controls
  let hud = null, panel = null;
  const W = { warp: 300, earthRot: 0 };
  function buildHud(m) {
    if (hud) hud.el.remove();
    hud = AC.ui.hud();
    const alts = m.alts;
    panel = { alt: alts[0], speed: m.startSpeed, shots: 0 };
    if (alts.length > 1) {
      const seg = h('div', { class: 'ac-seg' });
      alts.forEach((a) => {
        const b = h('button', { type: 'button', class: a === panel.alt ? 'on' : '' }, a >= 1e6 ? AC.fmt(a / 1e3) + ' km' : AC.fmt(a / 1e3) + ' km');
        b.addEventListener('click', () => { panel.alt = a; [...seg.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); showRings(); AC.audio.click(); refreshMath(); });
        seg.appendChild(b);
      });
      hud.section('Launch height').add(seg);
    } else hud.section('Launch height').row('h0', 'Above the ground', AC.fmt(alts[0] / 1e3) + ' km');
    hud.section('Launch speed (sideways)');
    const inp = h('input', { type: 'number', id: 'spd', min: 0.5, max: 15, step: 0.01, value: panel.speed.toFixed(2), 'aria-label': 'Launch speed in km/s' });
    inp.addEventListener('change', () => { panel.speed = clamp(+inp.value || 0, 0.5, 15); inp.value = panel.speed.toFixed(2); });
    const minus = h('button', { type: 'button', title: 'Slower' }, '−');
    const plus = h('button', { type: 'button', title: 'Faster' }, '+');
    const nudge = (d) => { panel.speed = clamp(Math.round((panel.speed + d) * 100) / 100, 0.5, 15); inp.value = panel.speed.toFixed(2); AC.audio.click(); };
    minus.addEventListener('click', () => nudge(-0.05));
    plus.addEventListener('click', () => nudge(0.05));
    hud.add(h('div', { class: 'fire' }, minus, inp, plus));
    hud.add(h('div', { class: 'dim mono', style: { fontSize: '0.68rem', textAlign: 'center' } }, 'km/s · type a number or use − / + (0.05)'));
    const fireBtn = h('button', { class: 'ac-btn', type: 'button', style: { width: '100%', marginTop: '6px' } }, m.fireLabel || 'Fire!');
    fireBtn.addEventListener('click', () => fire(m));
    hud.add(fireBtn);
    if (m.showMath) hud.formula('math', '');
    hud.section(m.tableTitle || 'Shots');
    panel.list = h('div', { class: 'shots' });
    hud.add(panel.list);
    if (m.table) { panel.table = h('table', { class: 'otab' }); hud.add(panel.table); }
    function refreshMath() {
      if (!m.showMath) return;
      const r = R + panel.alt, v = vCirc(panel.alt);
      hud.setFormula('math', 'Circular orbit speed v = √(GM ÷ r)\nr = 6,371 km + ' + AC.fmt(panel.alt / 1e3) + ' km = ' + AC.fmt(r / 1e3) + ' km\nv = √(3.986×10¹⁴ ÷ ' + r.toExponential(3) + ')\n= ' + AC.fmt(v / 1000, 2) + ' km/s');
    }
    panel.refreshMath = refreshMath;
    refreshMath();
    showRings();
  }
  function showRings() {
    for (const k in RINGS) RINGS[k].visible = false;
    if (MR.current && MR.current.alts) MR.current.alts.forEach((a) => RINGS[a] && (RINGS[a].visible = true));
    const top = (R + panel.alt) * U;
    mountain.scale.set(1, (panel.alt * U + 0.02) / 0.42, 1);
    mountain.position.y = R * U + (panel.alt * U) / 2;
    mountain.visible = panel.alt <= 2000e3;
    cannon.position.y = top + 0.02;
    oc.dist = clamp(top * 3.4, 22, 160);
  }
  function addShotLine(text, cls) {
    const d = h('div', { style: { color: cls } }, text);
    panel.list.prepend(d);
    while (panel.list.children.length > 5) panel.list.lastChild.remove();
  }

  let lastShot = null;
  function fire(m) {
    if (m.kindFor) m.kind = m.kindFor(panel.alt); // GPS model for the highest orbit
    if (m.single) clearSats();
    if (m.maxSats && sats.length >= m.maxSats) { const s = sats.shift(); scene.remove(s.g); scene.remove(s.trail); s.tag.el.remove(); }
    if (boom) { scene.remove(boom); boom = null; }
    const s = makeSat(m.kind || 'cube', panel.alt, panel.speed * 1000);
    panel.shots++;
    lastShot = s;
    s.judged = false;
    AC.audio.boom();
    AC.ui.toast(AC.fmt(panel.speed, 2) + ' km/s', 'var(--cyan)');
    W.warp = m.warpFor ? m.warpFor(panel.alt) : 300;
  }

  // ---------------------------------------------------------------- missions
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 26, min: 8, max: 600, phi: 1.25, theta: 0.25 });
  function begin(m) {
    clearSats();
    W.earthRot = 0;
    buildHud(m);
  }
  const CTRL = ['Type a speed or use − / +', 'Press <b>Fire!</b>', 'Drag to look around, scroll to zoom', '<kbd>W</kbd> <kbd>S</kbd> time warp'];
  const missions = [
    {
      id: 'cannon', title: 'Newton\'s Cannon', alts: [400e3], startSpeed: 4, single: true, objective: 'Fire the cannonball into a CIRCULAR orbit',
      story: 'Isaac Newton imagined a cannon on a mountain so high it pokes out of the air. Fire slowly and the ball falls to the ground. Fire faster and it lands further away. Fire fast enough and the ground curves away as fast as the ball falls. Our mountain is 400 km tall, as high as the ISS.',
      learn: [
        { t: 'Falling sideways', p: 'An orbit is falling around the Earth while moving sideways fast enough.' },
        { t: 'Experiment', p: 'Start at 4 km/s, then try faster speeds. Watch where each shot lands.' },
        { t: 'Too fast?', p: 'Faster than a circle makes an ellipse. Much faster and it escapes for ever.' },
      ],
      controls: CTRL,
      proved: 'At 400 km a circular orbit needs about 7.67 km/s: that is v = √(GM ÷ r). One lap takes about 92 minutes, which is why astronauts on the ISS see about 16 sunrises a day.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Being in orbit means')),
      warpFor: () => 240,
      start(api) { begin(this); },
      update(dt, api) {
        const s = lastShot;
        if (!s) return api.progress(0, 'Shots: 0');
        const d = describe(s);
        api.progress(d.kind === 'circle' ? 1 : clamp(s.v0 / 7670, 0, 1) * 0.9, 'Shots: ' + panel.shots);
        if (!s.judged && (s.t > 600 || !s.alive)) {
          s.judged = true;
          addShotLine(AC.fmt(s.v0 / 1000, 2) + ' km/s → ' + d.text, d.kind === 'circle' ? 'var(--green)' : d.kind === 'fall' ? 'var(--amber)' : 'var(--cyan)');
          if (d.kind === 'ellipse') AC.fact('Too fast for a circle', 'The ball climbs higher on the far side of the Earth, then falls back to your mountain. That is an elliptical orbit.', { tag: 'Shot result' });
          if (d.kind === 'escape') AC.fact('Escape!', 'So fast that Earth\'s gravity can never pull it back. Slow down a lot for a circle.', { tag: 'Shot result' });
          if (d.kind === 'circle') { api.state.won = true; api.state.T = 0; }
        }
        if (api.state.won) {
          api.state.T += dt;
          if (api.state.T > 1.5) api.win(panel.shots <= 4 ? 3 : panel.shots <= 7 ? 2 : 1, 'Circular orbit at ' + AC.fmt(s.v0 / 1000, 2) + ' km/s after ' + panel.shots + ' shots. Exact answer: ' + AC.fmt(vCirc(400e3) / 1000, 2) + ' km/s.');
        }
      },
    },
    {
      id: 'higher', title: 'Higher = Slower', alts: [400e3, 2000e3, 20200e3], startSpeed: 7.67, showMath: true, table: true, tableTitle: 'Your satellites', maxSats: 6, objective: 'Put a satellite in a circular orbit at each of the 3 heights',
      story: 'Satellites at different heights need different speeds. Use the orbit formula: the HUD fills in the numbers for you. Launch a circular orbit at 400 km (where PearlAfricaSat-1 flew), 2,000 km and 20,200 km (GPS satellites). Then compare their speeds and lap times.',
      learn: [
        { t: 'Orbit speed', p: 'Gravity is weaker further out, so you need less speed to stay in a circle.', f: 'v = √(GM ÷ r)' },
        { t: 'r is from the centre', p: 'Add Earth\'s radius (6,371 km) to the height above the ground!' },
        { t: 'Lap time', p: 'Bigger circle and slower speed, so a much longer lap.', f: 'T = 2πr ÷ v' },
      ],
      controls: CTRL,
      proved: 'Higher orbits are SLOWER and take LONGER. At 400 km: 7.67 km/s and 92 minutes. GPS satellites at 20,200 km: 3.87 km/s and 12 hours. Your Week 7 Python program calculates exactly this.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('The formula for orbital velocity')),
      kindFor: (a) => (a > 10e6 ? 'gps' : 'cube'),
      warpFor: (a) => (a > 10e6 ? 3000 : a > 1e6 ? 500 : 240),
      start(api) { begin(this); api.state.done = {}; },
      update(dt, api) {
        const s = lastShot;
        if (s && !s.judged && s.t > 200) {
          s.judged = true;
          const d = describe(s);
          const el = elements(s);
          addShotLine(AC.fmt(s.alt0 / 1e3) + ' km · ' + AC.fmt(s.v0 / 1000, 2) + ' km/s → ' + d.text, d.kind === 'circle' ? 'var(--green)' : 'var(--amber)');
          if (d.kind === 'circle' && !api.state.done[s.alt0]) {
            api.state.done[s.alt0] = { v: s.v0, T: el.T };
            AC.audio.good();
            renderTable(api);
          }
        }
        const n = Object.keys(api.state.done).length;
        api.progress(n / 3, n + ' of 3 heights done');
        if (n === 3 && !api.state.fin) { api.state.fin = true; setTimeout(() => api.win(panel.shots <= 4 ? 3 : panel.shots <= 7 ? 2 : 1, 'Three circular orbits. The highest one is the slowest and takes the longest.'), 1500); }
      },
    },
    {
      id: 'geo', title: 'Stay Over Kampala', alts: [35786e3], startSpeed: 3.5, single: true, kind: 'geo', showMath: true, objective: 'Make a satellite that stays above Kampala all day',
      story: 'TV and weather satellites seem to hang still in the sky. The trick: orbit at exactly the right height so one lap takes one day, the same time the Earth takes to spin. Fire from 35,786 km and keep the satellite above the red Kampala pin.',
      learn: [
        { t: 'Geostationary', p: 'One lap in 23 h 56 min, moving east like the Earth turns.' },
        { t: 'The height', p: '35,786 km above the Equator. Only one height works!' },
        { t: 'The speed', p: 'Use the formula in the panel to find it.', f: 'v = √(GM ÷ r)' },
      ],
      controls: CTRL,
      proved: 'At 35,786 km a circular orbit takes one sidereal day, so the satellite turns with the Earth and stays above the same spot on the Equator. Uganda is on the Equator, so a geostationary satellite can sit right overhead.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Geostationary satellites orbit')),
      warpFor: () => 4000,
      start(api) { begin(this); },
      update(dt, api) {
        const s = lastShot;
        if (!s) return api.progress(0, 'Fire when ready');
        const el = elements(s);
        const drift = Math.abs(((Math.atan2(s.P.x, s.P.y) - -W.earthRot + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
        api.progress(clamp(1 - Math.abs(el.T - DAY) / DAY, 0, 1), 'Lap time ' + (isFinite(el.T) ? fmtT(el.T) : '∞') + ' · drift ' + AC.fmt(AC.deg(drift)) + '°');
        if (!s.judged && s.t > 3600 * 4) {
          s.judged = true;
          const ok = el.e < 0.03 && Math.abs(el.T - DAY) / DAY < 0.03;
          addShotLine(AC.fmt(s.v0 / 1000, 2) + ' km/s → ' + (ok ? 'GEOSTATIONARY' : describe(s).text), ok ? 'var(--green)' : 'var(--amber)');
          if (ok) { api.state.ok = true; api.state.T = 0; }
          else AC.fact(el.T < DAY ? 'Too fast' : 'Too slow', el.T < DAY ? 'Its lap is shorter than a day, so it runs ahead of Kampala.' : 'Its lap is longer than a day, so Kampala spins ahead of it.', { tag: 'Shot result', color: 'var(--amber)' });
        }
        if (api.state.ok) { api.state.T += dt; if (api.state.T > 3) api.win(panel.shots <= 3 ? 3 : panel.shots <= 6 ? 2 : 1, 'Geostationary at ' + AC.fmt(s.v0 / 1000, 2) + ' km/s. One lap = ' + fmtT(el.T) + '.'); }
      },
    },
    {
      id: 'escape', title: 'Escape Velocity', alts: [400e3], startSpeed: 8, single: true, objective: 'Launch so fast that Earth can never pull you back',
      story: 'To travel to the Moon or Mars you must escape Earth\'s gravity. From 400 km up, how fast do you need to go? Hint: it is about 1.41 times (√2) the circular orbit speed.',
      learn: [
        { t: 'Energy', p: 'Speed gives kinetic energy; gravity tries to take it back. Escape when you have enough.' },
        { t: 'The rule', p: 'Escape speed is √2 times orbit speed.', f: 'v_esc = √(2GM ÷ r)' },
        { t: 'Ellipses first', p: 'Below escape speed you get bigger and bigger ellipses that still come back.' },
      ],
      controls: CTRL,
      proved: 'At 400 km escape speed is about 10.85 km/s (√2 × 7.67). From the ground it is 11.2 km/s. The Apollo astronauts and every Mars probe needed at least this much.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('The ISS at 400 km')),
      warpFor: () => 600,
      start(api) { begin(this); },
      update(dt, api) {
        const s = lastShot;
        if (!s) return api.progress(0, 'Fire when ready');
        const el = elements(s);
        api.progress(clamp(s.v0 / 10850, 0, 1), el.eps >= 0 ? 'Escaping!' : 'Highest point ' + AC.fmt((el.ra - R) / 1000) + ' km');
        if (!s.judged && s.t > 300) {
          s.judged = true;
          addShotLine(AC.fmt(s.v0 / 1000, 2) + ' km/s → ' + describe(s).text, el.eps >= 0 ? 'var(--green)' : 'var(--cyan)');
          if (el.eps >= 0) { api.state.ok = true; api.state.T = 0; }
        }
        if (api.state.ok) { api.state.T += dt; if (api.state.T > 2) api.win(s.v0 < 11500 ? 3 : s.v0 < 13000 ? 2 : 1, 'Escaped at ' + AC.fmt(s.v0 / 1000, 2) + ' km/s. Exact escape speed here: ' + AC.fmt((Math.SQRT2 * vCirc(400e3)) / 1000, 2) + ' km/s.'); }
      },
    },
  ];
  missions.forEach((m) => { if (!m.kind && m.kindFor) m.kind = 'cube'; });
  function renderTable(api) {
    const t = panel.table;
    t.innerHTML = '';
    t.appendChild(h('tr', {}, h('th', {}, 'Height'), h('th', {}, 'Speed'), h('th', {}, 'Lap')));
    Object.keys(api.state.done).map(Number).sort((a, b) => a - b).forEach((a) => {
      const d = api.state.done[a];
      t.appendChild(h('tr', {}, h('td', {}, AC.fmt(a / 1e3) + ' km'), h('td', {}, AC.fmt(d.v / 1000, 2) + ' km/s'), h('td', {}, fmtT(d.T))));
    });
  }
  const MR = AC.missions({ game: 'orbit', week: 7, list: missions });

  AC.ui.tools([
    { label: 'Warp ×', title: 'Time warp (W / S)', onclick: (b) => { W.warp = W.warp >= 4000 ? 60 : W.warp * 4; b.textContent = 'Warp ×' + W.warp; } },
    { label: 'Clear', title: 'Remove all satellites', onclick: () => { clearSats(); lastShot = null; } },
  ]);
  AC.onKey('KeyW', () => (W.warp = Math.min(20000, W.warp * 2)));
  AC.onKey('KeyS', () => (W.warp = Math.max(30, W.warp / 2)));
  AC.ui.hint('Set a speed → <b>Fire!</b> · drag to rotate · scroll to zoom · <kbd>W</kbd><kbd>S</kbd> warp');
  function help() {
    AC.ui.card({ eyebrow: 'Week 7', title: 'Orbit Lab', body: ['Satellites and the Earth are drawn much bigger than real so you can see them. The physics is real: gravity pulls with GM ÷ r², calculated thousands of times per orbit.', AC.ui.learnGrid([{ t: 'Orange line', p: 'The path of a low satellite.' }, { t: 'Pink dashes', p: 'The target heights.' }, { t: 'Red pin', p: 'Kampala, on the Equator.' }])] });
  }

  S.onFrame((dt) => {
    if (dt > 0) {
      const total = dt * W.warp;
      W.earthRot -= (2 * Math.PI * total) / DAY;
      const n = Math.max(1, Math.ceil(total / 5));
      for (const s of sats) {
        if (!s.alive) continue;
        for (let i = 0; i < n && s.alive; i++) stepSat(s, total / n);
        s.acc += total;
        if (s.acc > Math.max(20, (2 * Math.PI * s.P.length()) / s.V.length() / 700) && s.n < s.N) {
          s.acc = 0;
          s.pos.set([s.P.x * U, s.P.y * U, 0], s.n * 3);
          s.n++;
          s.geo.setDrawRange(0, s.n);
          s.geo.attributes.position.needsUpdate = true;
          s.geo.computeBoundingSphere();
        } else if (s.n >= s.N) { s.pos.copyWithin(0, 3); s.pos.set([s.P.x * U, s.P.y * U, 0], (s.N - 1) * 3); s.geo.attributes.position.needsUpdate = true; }
      }
    }
    earthG.rotation.z = W.earthRot;
    pin.getWorldPosition(kTag.pos);
    kTag.pos.y += 0.1;
    for (const s of sats) {
      s.g.position.copy(s.P).multiplyScalar(U);
      s.g.lookAt(0, 0, 0);
      s.tag.visible = s.alive;
      s.tag.pos.copy(s.g.position).multiplyScalar(1.04);
      if (s.alive) s.tag.set(AC.fmt(s.V.length() / 1000, 2) + ' km/s · ' + AC.fmt((s.P.length() - R) / 1000) + ' km');
    }
    MR.update(dt);
    oc.update(dt);
  });
  S.start();
  MR.begin();
})();
