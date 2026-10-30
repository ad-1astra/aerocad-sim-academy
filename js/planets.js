/* Planet Hopper — the Solar System: order, gravity and weight, free fall without air, landing on other worlds. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  const V3 = THREE.Vector3;
  AC.boot({ game: 'planets', week: 7, topic: 'Planets & gravity', title: 'Planet Hopper', help: () => help() });

  const S = AC.scene({ fov: 50, near: 0.05, far: 3000, background: 0x02040a });
  const { scene, camera, renderer } = S;
  const lights = AC.lights(scene, { sky: 0x9fb3d0, ground: 0x111111, hemi: 0.35, sun: 0.4, dir: [0, 10, 0] });
  const sunLight = new THREE.PointLight(0xfff1d0, 2.2, 0, 0);
  scene.add(sunLight);
  const stars = AC.starfield(scene, 3000, 1500, 1.5);

  // real data: g (m/s²), radius (km), day, year, moons, air
  const P = [
    { id: 'mercury', name: 'Mercury', g: 3.7, r: 2440, day: '59 Earth days', year: '88 days', moons: '0', air: 'none', size: 0.5, dist: 10, period: 88, sky: 0x05060a, ground: 0x8c8378, rho: 0, fact: 'Closest to the Sun: about 430 °C by day and −180 °C at night, because there is no air to hold the heat.' },
    { id: 'venus', name: 'Venus', g: 8.87, r: 6052, day: '243 Earth days', year: '225 days', moons: '0', air: 'very thick CO₂', size: 0.9, dist: 14, period: 225, sky: 0xc89a52, ground: 0xb08850, rho: 65, fact: 'The hottest planet (about 465 °C) because its thick carbon dioxide air traps heat. Its day is longer than its year!' },
    { id: 'earth', name: 'Earth', g: 9.81, r: 6371, day: '24 hours', year: '365 days', moons: '1', air: 'nitrogen + oxygen', size: 1, dist: 18, period: 365, sky: 0x7fb8e8, ground: 0x6b8f45, rho: 1.225, fact: 'The only planet we know with liquid water oceans and life. Uganda sits right on its Equator.' },
    { id: 'mars', name: 'Mars', g: 3.71, r: 3390, day: '24.6 hours', year: '687 days', moons: '2', air: 'very thin CO₂', size: 0.7, dist: 23, period: 687, sky: 0xc9a27a, ground: 0xa8552e, rho: 0.02, fact: 'Red because of rusty iron in its dust. Home of Olympus Mons, a volcano about 2.5 times taller than Mount Everest.' },
    { id: 'jupiter', name: 'Jupiter', g: 24.79, r: 69911, day: '9.9 hours', year: '11.9 years', moons: 'over 90', air: 'hydrogen + helium', size: 2.8, dist: 33, period: 4333, sky: 0xc9a37a, ground: 0xb08860, rho: 0.16, fact: 'The biggest planet: over 1,300 Earths would fit inside. The Great Red Spot is a storm wider than the Earth.' },
    { id: 'saturn', name: 'Saturn', g: 10.44, r: 58232, day: '10.7 hours', year: '29.5 years', moons: 'over 140', air: 'hydrogen + helium', size: 2.4, dist: 44, period: 10759, sky: 0xd8c08a, ground: 0xc8b07a, rho: 0.19, fact: 'Its rings are made of billions of pieces of ice and rock. Saturn is so light it would float in a giant bath.' },
    { id: 'uranus', name: 'Uranus', g: 8.69, r: 25362, day: '17.2 hours', year: '84 years', moons: '28', air: 'hydrogen, helium, methane', size: 1.6, dist: 54, period: 30687, sky: 0x9fd6dc, ground: 0x8fc6cc, rho: 0.42, fact: 'It spins on its side, tipped over by about 98°, probably after a giant crash long ago.' },
    { id: 'neptune', name: 'Neptune', g: 11.15, r: 24622, day: '16.1 hours', year: '165 years', moons: '16', air: 'hydrogen, helium, methane', size: 1.55, dist: 63, period: 60190, sky: 0x3a5cc0, ground: 0x3050a8, rho: 0.45, fact: 'The windiest planet: storms reach about 2,000 km/h. It has gone round the Sun only once since it was discovered in 1846.' },
  ];
  const MOON = { id: 'moon', name: 'the Moon', g: 1.62, sky: 0x02040a, ground: 0x9a9a9a, rho: 0 };

  // ---------------------------------------------------------------- orrery
  const orrery = new THREE.Group();
  scene.add(orrery);
  const sun = AC.models.planet('sun', 4, 40);
  orrery.add(sun);
  const pickables = [];
  P.forEach((p, i) => {
    const pivot = new THREE.Group();
    pivot.rotation.y = i * 1.7;
    orrery.add(pivot);
    const body = AC.models.planet(p.id, p.size, 40);
    body.position.x = p.dist;
    pivot.add(body);
    p.pivot = pivot;
    p.body = body;
    body.userData.ball.userData.planet = p;
    pickables.push(body.userData.ball);
    const ringPts = [];
    for (let k = 0; k <= 128; k++) { const a = (k / 128) * Math.PI * 2; ringPts.push(new V3(Math.cos(a) * p.dist, 0, Math.sin(a) * p.dist)); }
    orrery.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: 0x264061 })));
    p.tag = S.tag(p.name, 'var(--dim)');
    p.tag.visible = false;
  });
  const timeTag = h('div', { class: 'ac-panel mono', style: { position: 'absolute', zIndex: 14, left: '50%', transform: 'translateX(-50%)', bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', padding: '4px 10px', fontSize: '0.75rem', color: 'var(--dim)' } }, '');
  AC.root().appendChild(timeTag);

  // ---------------------------------------------------------------- surface scene
  const surface = new THREE.Group();
  surface.visible = false;
  scene.add(surface);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
  const groundTex = AC.canvasTex(256, 256, (g, w, hh) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, hh); for (let i = 0; i < 3000; i++) { const c = 200 + Math.random() * 55; g.fillStyle = `rgb(${c},${c},${c})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * hh, Math.random() * 3, 0, 7); g.fill(); } }, [40, 40]);
  groundMat.map = groundTex;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMat);
  ground.rotation.x = -Math.PI / 2;
  surface.add(ground);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), groundMat, 120);
  { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3(); for (let i = 0; i < 120; i++) { const r = AC.rand(8, 120), a = AC.rand(0, 7); const sc = AC.rand(0.2, 1.4); s.set(sc, sc * 0.6, sc); p.set(Math.cos(a) * r, 0, Math.sin(a) * r); q.setFromEuler(new THREE.Euler(AC.rand(0, 3), AC.rand(0, 3), 0)); m4.compose(p, q, s); rocks.setMatrixAt(i, m4); } }
  surface.add(rocks);
  const astro = AC.models.astronaut();
  surface.add(astro);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
  surface.add(star);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 2.4), new THREE.MeshBasicMaterial({ color: 0x9fdcf0, transparent: true, opacity: 0.35 }));
  surface.add(roof);
  const hTag = S.tag('', 'var(--amber)');
  hTag.visible = false;
  function setWorld(w) {
    scene.background = new THREE.Color(w.sky);
    groundMat.color.set(w.ground);
    lights.hemi.intensity = 0.9;
    lights.sun.intensity = 0.9;
    stars.visible = w.rho < 0.05;
  }

  // ---------------------------------------------------------------- HUD + choices
  let hud = null, choice = null;
  function newHud() { if (hud) hud.el.remove(); hud = AC.ui.hud(); return hud; }
  function choices(title, sub, opts, onPick, cls) {
    if (choice) choice.remove();
    const q = h('div', { class: 'q' }, h('small', {}, sub), title);
    const box = h('div', { class: 'opts' });
    opts.forEach((o) => {
      const b = h('button', { type: 'button', class: cls ? cls(o) : '' }, o.label, o.note ? h('small', {}, o.note) : null);
      b.addEventListener('click', () => onPick(o, b, box));
      box.appendChild(b);
    });
    choice = h('div', { class: 'choices ac-panel' }, q, box);
    AC.root().appendChild(choice);
    return choice;
  }
  function clearChoice() { if (choice) choice.remove(); choice = null; }

  // ---------------------------------------------------------------- picking planets with a click (not a drag)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let downAt = null, onPlanetClick = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6 || !onPlanetClick) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // forgiving hit test: nearest planet to the click ray
    let best = null, bd = Infinity;
    for (const p of P) {
      const wp = p.body.getWorldPosition(new V3());
      const d = ray.ray.distanceToPoint(wp) - p.size;
      if (d < bd) { bd = d; best = p; }
    }
    if (best && bd < 2.5) onPlanetClick(best);
  });

  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 95, min: 10, max: 300, phi: 0.9, theta: 0.3 });
  let mode = 'orrery', orreryTime = 0;

  // ---------------------------------------------------------------- mission 2: gravity jump
  const JUMP_V = 3.0; // m/s push-off, the same everywhere
  let jump = null;
  function startJump(world, target, onEnd) {
    jump = { world, t: 0, hmax: (JUMP_V * JUMP_V) / (2 * world.g), T: (2 * JUMP_V) / world.g, target, onEnd, ended: false };
    AC.audio.whoosh();
  }
  function stepJump(dt) {
    if (!jump) return;
    jump.t += dt;
    const t = Math.min(jump.t, jump.T);
    let y = JUMP_V * t - 0.5 * jump.world.g * t * t;
    let hitRoof = false;
    if (jump.target && y > jump.target.roof) { y = jump.target.roof; hitRoof = true; }
    if (hitRoof && !jump.bumped) { jump.bumped = true; AC.audio.bad(); }
    jump.peak = Math.max(jump.peak || 0, y);
    astro.position.y = Math.max(0, y);
    hTag.visible = true;
    hTag.pos.set(0.6, astro.position.y + 1.9, 0);
    hTag.set('height ' + AC.fmt(astro.position.y, 2) + ' m');
    if (jump.t >= jump.T + 0.4 && !jump.ended) { jump.ended = true; const j = jump; jump = null; astro.position.y = 0; j.onEnd && j.onEnd(j); }
  }

  // ---------------------------------------------------------------- mission 3: hammer & feather
  const hammer = new THREE.Group();
  AC.models.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), AC.models.mat(0x6b4a2a), 0, 0, 0, hammer);
  AC.models.mesh(new THREE.BoxGeometry(0.16, 0.07, 0.07), AC.models.mat(0x8a949c, { metalness: 0.7 }), 0, 0.17, 0, hammer);
  const feather = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 6), AC.models.mat(0xf6f2ea));
  feather.scale.set(0.25, 1, 0.08);
  surface.add(hammer, feather);
  hammer.visible = feather.visible = false;
  let drop = null;
  function startDrop(world, onEnd) {
    const vt = world.rho > 0 ? 0.5 * Math.sqrt(1.225 / world.rho) * Math.sqrt(world.g / 9.81) : Infinity; // feather terminal speed
    drop = { world, t: 0, yh: 1.6, yf: 1.6, vh: 0, vf: 0, vt, onEnd, th: null, tf: null };
    hammer.visible = feather.visible = true;
  }
  function stepDrop(dt) {
    if (!drop) return;
    const d = drop, g = d.world.g;
    const n = 20;
    for (let i = 0; i < n; i++) {
      const s = dt / n;
      if (d.th == null) { d.vh += g * s; d.yh -= d.vh * s; if (d.yh <= 0) { d.yh = 0; d.th = d.t; } }
      if (d.tf == null) {
        const drag = isFinite(d.vt) ? g * (d.vf / d.vt) * (d.vf / d.vt) : 0;
        d.vf += (g - drag) * s; d.yf -= d.vf * s;
        if (d.yf <= 0) { d.yf = 0; d.tf = d.t; }
      }
      d.t += s;
    }
    hammer.position.set(0.9, d.yh + 0.18, 0.5);
    feather.position.set(1.4, d.yf + 0.12, 0.5);
    feather.rotation.z = isFinite(d.vt) && d.tf == null ? Math.sin(d.t * 6) * 0.5 : 0;
    if (d.th != null && d.tf != null && !d.done) { d.done = true; setTimeout(() => { const x = drop; if (!x) return; drop = null; x.onEnd && x.onEnd(x); }, 600); }
    if (d.t > 25 && !d.done) { d.done = true; d.tf = d.tf || d.t; setTimeout(() => { const x = drop; if (!x) return; drop = null; x.onEnd && x.onEnd(x); }, 300); }
  }

  // ---------------------------------------------------------------- mission 4: lander
  const lander = AC.models.lander();
  lander.scale.setScalar(0.8);
  surface.add(lander);
  lander.visible = false;
  const flame = AC.models.flame(0.5, 3.5);
  flame.position.y = 0.2;
  lander.add(flame);
  const lpad = AC.models.pad('H', 0x4be38a, 5);
  surface.add(lpad);
  lpad.visible = false;
  const LD = { dry: 4000, fuel0: 1500, T: 25000, ve: 3000 };
  let L = null;
  function startLander(world) {
    L = { world, x: -45, y: 130, vx: 4, vy: -6, tilt: 0, fuel: LD.fuel0, thr: 0, landed: false, crashed: false };
    lander.visible = lpad.visible = true;
    lpad.position.set(0, 0, 0);
  }
  const LS = AC.touch.stick('l', 'THRUST', { springY: true });
  const RS = AC.touch.stick('r', 'TILT');
  function stepLander(dt) {
    if (!L || L.landed || L.crashed) return;
    const m = LD.dry + L.fuel;
    const want = AC.key('KeyW', 'ArrowUp', 'Space') || LS.y > 0.3 ? 1 : 0;
    L.thr = L.fuel > 0 ? want : 0;
    L.tilt = clamp(L.tilt + AC.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight'], RS.x) * AC.rad(40) * dt, -AC.rad(30), AC.rad(30));
    const T = LD.T * L.thr;
    L.fuel = Math.max(0, L.fuel - (T / LD.ve) * dt);
    L.vx += (T * Math.sin(L.tilt)) / m * dt;
    L.vy += ((T * Math.cos(L.tilt)) / m - L.world.g) * dt;
    L.x += L.vx * dt;
    L.y += L.vy * dt;
    if (L.y <= 0) {
      L.y = 0;
      const soft = Math.abs(L.vy) < 2 && Math.abs(L.vx) < 1.2 && Math.abs(L.tilt) < AC.rad(12);
      if (soft) L.landed = true; else L.crashed = true;
      L.onPad = Math.abs(L.x) < 5;
      L.touch = { vy: Math.abs(L.vy), vx: Math.abs(L.vx) };
      L.vx = L.vy = 0;
      L.crashed ? AC.audio.boom() : AC.audio.good();
    }
  }

  // ---------------------------------------------------------------- missions
  function toOrrery() {
    mode = 'orrery';
    orrery.visible = true; surface.visible = false;
    scene.background = new THREE.Color(0x02040a);
    stars.visible = true;
    lights.hemi.intensity = 0.35; lights.sun.intensity = 0.4;
    oc.target.set(0, 0, 0); oc.dist = 95; oc.phi = 0.9; oc.min = 10; oc.max = 300;
    P.forEach((p) => (p.tag.visible = false));
    timeTag.hidden = false;
  }
  function toSurface(world, cam) {
    mode = 'surface';
    orrery.visible = false; surface.visible = true;
    timeTag.hidden = true;
    setWorld(world);
    astro.visible = true; star.visible = roof.visible = false;
    hammer.visible = feather.visible = lander.visible = lpad.visible = false;
    astro.position.set(0, 0, 0);
    oc.target.set(cam.tx || 0, cam.ty || 1, 0); oc.dist = cam.d || 6; oc.phi = 1.35; oc.theta = cam.th || 0.2; oc.min = 2; oc.max = 300;
  }
  // timers from a mission that is no longer running must do nothing
  let token = 0;
  const later = (fn, ms) => { const t = token; setTimeout(() => { if (t === token) fn(); }, ms); };
  function cleanup() { token++; clearChoice(); jump = null; drop = null; L = null; onPlanetClick = null; hTag.visible = false; }

  const missions = [
    {
      id: 'order', title: 'Planet Order', objective: 'Click the planets in order, starting nearest the Sun',
      story: 'Here is the Solar System (sizes and distances squashed so it fits on screen). Click the planets in order, starting with the one closest to the Sun. Each one you find tells you its secrets.',
      learn: [
        { t: 'Remember it', p: 'My Very Excellent Mother Just Served Us Nachos.', f: 'Me · Ve · E · Ma · J · S · U · N' },
        { t: 'Rocky inner planets', p: 'Mercury, Venus, Earth and Mars are small and rocky.' },
        { t: 'Giant outer planets', p: 'Jupiter, Saturn, Uranus and Neptune are huge balls of gas and ice.' },
      ],
      controls: ['Click a planet', 'Drag to rotate, scroll to zoom'],
      proved: 'The four rocky planets are close to the Sun; the four giants are far out. The further out a planet is, the slower it moves and the longer its year: Mercury takes 88 days, Neptune 165 years. Watch them go round!',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Planets further from the Sun')),
      start(api) {
        cleanup(); toOrrery();
        api.state.next = 0; api.state.wrong = 0;
        newHud().section('Found so far');
        api.state.card = h('div', { class: 'pcard' });
        hud.add(api.state.card);
        onPlanetClick = (p) => {
          const want = P[api.state.next];
          if (!want) return;
          if (p === want) {
            AC.audio.good();
            p.tag.visible = true;
            p.tag.el.style.color = 'var(--green)';
            api.state.card.append(h('span', {}, (api.state.next + 1) + '. ' + p.name), h('span', {}, 'g = ' + p.g + ' m/s²'));
            AC.fact(p.name, p.fact + ' Gravity ' + p.g + ' m/s², year ' + p.year + ', day ' + p.day + ', moons ' + p.moons + '.', { tag: 'Planet ' + (api.state.next + 1), ms: 8000 });
            api.state.next++;
            api.progress(api.state.next / 8, api.state.next + ' of 8 found');
            if (api.state.next === 8) later(() => api.win(api.state.wrong <= 1 ? 3 : api.state.wrong <= 3 ? 2 : 1, 'All 8 planets in order with ' + api.state.wrong + ' wrong click' + (api.state.wrong === 1 ? '' : 's') + '.'), 900);
          } else if (!p.tag.visible) {
            api.state.wrong++;
            AC.audio.bad();
            AC.ui.toast('That is ' + p.name, 'var(--amber)');
          }
        };
      },
      update(dt, api) { api.objective('Find planet ' + Math.min(8, api.state.next + 1) + ' from the Sun'); },
    },
    {
      id: 'jump', title: 'Gravity Jump', objective: 'Reach each star without bumping the glass roof',
      story: 'Your astronaut always jumps with the same push (3 m/s). How high that goes depends on the planet\'s gravity. Pick the world that lets you touch the gold star but not bang your helmet on the glass roof.',
      learn: [
        { t: 'Jump height', p: 'Weaker gravity means higher jumps.', f: 'height = v² ÷ (2 × g)' },
        { t: 'Mass vs weight', p: 'Your mass (kg) is the same everywhere. Your weight changes.', f: 'Weight = m × g' },
        { t: 'Gas giants', p: 'Jupiter and friends have no solid ground. Imagine a floating platform at the cloud tops.' },
      ],
      controls: ['Pick a planet, then watch the jump'],
      proved: 'The same push gives very different jumps: 0.46 m on Earth, 2.8 m on the Moon, 0.18 m on Jupiter. Your mass never changed, only the pull of gravity: weight = m × g.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('You travel from Earth to Mars')),
      start(api) {
        cleanup();
        toSurface(P[2], { ty: 1.4, d: 6.5 });
        api.state.round = 0; api.state.wrong = 0;
        newHud().section('Your weight').row('mass', 'Mass', '50 kg');
        hud.formula('w', 'Weight = m × g');
        hud.section('Jump physics').formula('jh', 'h = v² ÷ 2g');
        jumpRound(api);
      },
      update(dt) { stepJump(dt); star.rotation.y += dt * 2; },
    },
    {
      id: 'drop', title: 'Hammer & Feather', objective: 'Predict which lands first on 4 worlds',
      story: 'In 1971 astronaut David Scott dropped a hammer and a falcon feather on the Moon. Predict what happens on each world, then watch.',
      learn: [
        { t: 'Gravity pulls all', p: 'Without air, everything falls with the same acceleration g, heavy or light.' },
        { t: 'Air resistance', p: 'Air pushes back on the light, fluffy feather much more than on the hammer.' },
        { t: 'Different air', p: 'The Moon has none. Mars has a very thin atmosphere. Earth\'s air is thick.' },
      ],
      controls: ['Choose an answer, then watch the drop'],
      proved: 'Gravity gives every object the same acceleration. Only air resistance makes a feather slow. That is why the Moon has no need for parachutes, and why Mars landers need huge ones (thin air).',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('A hammer and a feather')),
      start(api) {
        cleanup();
        api.state.round = 0; api.state.score = 0;
        newHud().section('Drop test').row('tH', 'Hammer lands').row('tF', 'Feather lands');
        dropRound(api);
      },
      update(dt) { stepDrop(dt); },
    },
    {
      id: 'lander', title: 'Moon & Mars Lander', objective: 'Land softly on the green pad, first on the Moon, then on Mars',
      story: 'This lander has a 25 kN engine. On the Moon that is plenty. On Mars gravity is 2.3 times stronger, so the same engine only just beats weight. Land gently (slower than 2 m/s) on the pad on both worlds.',
      learn: [
        { t: 'Thrust vs weight again', p: 'Same rule as your Week 4 drone: you can only hover if thrust ≥ weight.', f: 'T/W = T ÷ (m × g)' },
        { t: 'Moon', p: 'g = 1.62 m/s². T/W ≈ 2.8: easy to hover.' },
        { t: 'Mars', p: 'g = 3.71 m/s². T/W ≈ 1.2: brake early or you will hit hard!' },
      ],
      controls: ['<kbd>W</kbd> / <kbd>Space</kbd> fire engine', '<kbd>A</kbd> <kbd>D</kbd> tilt left / right'],
      proved: 'The same engine behaves very differently under different gravity. On Earth this lander\'s T/W would be only 0.46, so it could not even hover. That is why the Apollo lunar module could only ever fly on the Moon.',
      tip: 'Burn early and in bursts. Tilt slightly to stop sideways drift, then level out before touchdown.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Gravity on the Moon')),
      start(api) {
        cleanup();
        api.state.world = 0;
        newHud().section('Lander').row('alt', 'Height').row('vy', 'Falling speed').row('vx', 'Sideways speed').row('tw', 'Thrust ÷ weight').row('fuel', 'Fuel').meter('fuelm');
        hud.formula('twf', '');
        landerRound(api);
      },
      update(dt, api) {
        stepLander(dt);
        if (!L) return;
        lander.position.set(L.x, L.y, 0);
        lander.rotation.z = -L.tilt;
        flame.visible = L.thr > 0;
        flame.scale.setScalar(0.8 + Math.random() * 0.3);
        oc.target.set(L.x * 0.6, Math.max(2, L.y * 0.6), 0);
        oc.dist = clamp(18 + L.y * 0.9, 18, 140);
        const m = LD.dry + L.fuel, tw = LD.T / (m * L.world.g);
        hud.set('alt', AC.fmt(L.y, 1) + ' m');
        hud.set('vy', AC.fmt(-L.vy, 1) + ' m/s', -L.vy > 2 ? 'warn' : '');
        hud.set('vx', AC.fmt(L.vx, 1) + ' m/s', Math.abs(L.vx) > 1.2 ? 'warn' : '');
        hud.set('tw', AC.fmt(tw, 2), tw < 1 ? 'bad' : tw < 1.5 ? 'warn' : '');
        hud.set('fuel', AC.fmt(L.fuel) + ' kg');
        hud.setMeter('fuelm', L.fuel / LD.fuel0, L.fuel < 300 ? 'var(--amber)' : 'var(--green)');
        hud.setFormula('twf', 'T/W = 25,000 ÷ (' + AC.fmt(m) + ' × ' + L.world.g + ')\n= ' + AC.fmt(tw, 2) + (tw < 1 ? '  (cannot hover yet!)' : ''));
        api.progress(api.state.world / 2 + (1 - clamp(L.y / 130, 0, 1)) / 2 * 0.5, (api.state.world === 0 ? 'Moon' : 'Mars') + ' landing');
        if ((L.landed || L.crashed) && !L.judged) {
          L.judged = true;
          if (L.crashed) return later(() => api.fail('Crashed on ' + L.world.name + ' at ' + AC.fmt(L.touch.vy, 1) + ' m/s down and ' + AC.fmt(L.touch.vx, 1) + ' m/s sideways. Touch down slower than 2 m/s, upright.'), 900);
          if (!L.onPad) return later(() => api.fail('Safe landing, but ' + AC.fmt(Math.abs(L.x)) + ' m from the pad. Use A and D to steer.'), 900);
          api.state.scores = (api.state.scores || []).concat(L.touch.vy);
          AC.ui.toast('THE EAGLE HAS LANDED', 'var(--green)');
          api.state.world++;
          if (api.state.world >= 2) later(() => { const worst = Math.max(...api.state.scores); api.win(worst < 1 ? 3 : worst < 1.5 ? 2 : 1, 'Landed on the Moon and Mars. Hardest touchdown: ' + AC.fmt(worst, 2) + ' m/s.'); }, 1200);
          else later(() => landerRound(api), 1500);
        }
      },
    },
  ];

  // jump rounds: target height, roof at 1.35 × target
  const JUMPS = [{ h: 2.6 }, { h: 1.1 }, { h: 0.16 }, { h: 0.44 }];
  function jumpRound(api) {
    const r = JUMPS[api.state.round];
    const target = { h: r.h, roof: r.h * 1.35 };
    star.visible = roof.visible = true;
    star.position.set(0, r.h + 1.8, 0);
    roof.position.set(0, target.roof + 1.95, 0);
    const worlds = [P[2], MOON, P[3], P[4], P[1]];
    choices('Touch the star at ' + AC.fmt(r.h, 2) + ' m (roof at ' + AC.fmt(target.roof, 2) + ' m)', 'Jump ' + (api.state.round + 1) + ' of 4 · same 3 m/s push', worlds.map((w) => ({ label: w.name[0].toUpperCase() + w.name.slice(1), note: 'g = ' + w.g, w })), (o, b, box) => {
      if (jump) return;
      [...box.children].forEach((c) => (c.disabled = true));
      toSurface(o.w, { ty: 1.4 + r.h / 2, d: 6.5 + r.h * 1.6 });
      star.visible = roof.visible = true;
      hud.set('mass', '50 kg');
      hud.setFormula('w', 'Weight = 50 × ' + o.w.g + ' = ' + AC.fmt(50 * o.w.g) + ' N');
      hud.setFormula('jh', 'h = 3² ÷ (2 × ' + o.w.g + ') = ' + AC.fmt(9 / (2 * o.w.g), 2) + ' m');
      startJump(o.w, target, (j) => {
        const reached = j.peak >= r.h - 0.02, bumped = !!j.bumped;
        const ok = reached && !bumped;
        b.classList.add(ok ? 'right' : 'wrong');
        if (ok) { AC.audio.good(); AC.ui.toast('STAR!', 'var(--amber)'); }
        else { api.state.wrong++; AC.fact(bumped ? 'Ouch, the roof!' : 'Not high enough', 'On ' + o.w.name + ' the jump goes ' + AC.fmt(j.hmax, 2) + ' m. ' + (bumped ? 'Pick somewhere with a bit more gravity.' : 'Pick somewhere with weaker gravity.'), { color: 'var(--amber)', tag: 'Jump result' }); }
        if (ok) {
          api.state.round++;
          api.progress(api.state.round / 4, 'Stars ' + api.state.round + ' of 4');
          if (api.state.round >= 4) later(() => api.win(api.state.wrong <= 1 ? 3 : api.state.wrong <= 3 ? 2 : 1, 'All four stars with ' + api.state.wrong + ' miss' + (api.state.wrong === 1 ? '' : 'es') + '.'), 900);
          else later(() => jumpRound(api), 1100);
        } else later(() => [...box.children].forEach((c) => { if (!c.classList.contains('wrong')) c.disabled = false; }), 400);
      });
    });
  }
  const DROPS = [P[2], MOON, P[3], P[4]];
  function dropRound(api) {
    const w = DROPS[api.state.round];
    toSurface(w, { ty: 1.0, d: 4.2, th: 0.1, tx: 1.1 });
    astro.position.set(-0.3, 0, 0);
    hammer.visible = feather.visible = true;
    hammer.position.set(0.9, 1.78, 0.5);
    feather.position.set(1.4, 1.72, 0.5);
    hud.set('tH', '--'); hud.set('tF', '--');
    const truth = (x) => (Math.abs(x.th - x.tf) < 0.05 ? 'same' : x.th < x.tf ? 'hammer' : 'feather');
    choices('On ' + w.name + ' (' + (w.rho ? 'air: ' + (w.air || 'yes') : 'no air') + '), which lands first?', 'Drop ' + (api.state.round + 1) + ' of 4', [{ label: 'Hammer first', id: 'hammer' }, { label: 'Feather first', id: 'feather' }, { label: 'Same time', id: 'same' }], (o, b, box) => {
      if (drop) return;
      [...box.children].forEach((c) => (c.disabled = true));
      startDrop(w, (x) => {
        hud.set('tH', AC.fmt(x.th, 2) + ' s');
        hud.set('tF', AC.fmt(x.tf, 2) + ' s');
        const ans = truth(x);
        const ok = o.id === ans;
        b.classList.add(ok ? 'right' : 'wrong');
        [...box.children].find((c) => c.textContent.toLowerCase().startsWith(ans === 'same' ? 'same' : ans)).classList.add('right');
        ok ? (api.state.score++, AC.audio.good()) : AC.audio.bad();
        AC.fact(w.name[0].toUpperCase() + w.name.slice(1), ans === 'same' ? 'No air, so no air resistance: both fall with g = ' + w.g + ' m/s² and land together.' : 'Air resistance slows the feather much more than the hammer.', { tag: 'Drop result', color: ok ? 'var(--green)' : 'var(--amber)' });
        api.state.round++;
        api.progress(api.state.round / 4, 'Correct ' + api.state.score + ' of ' + api.state.round);
        later(() => {
          if (api.state.round >= 4) api.win(api.state.score === 4 ? 3 : api.state.score >= 3 ? 2 : 1, api.state.score + ' of 4 predictions right.');
          else dropRound(api);
        }, 1800);
      });
    });
  }
  function landerRound(api) {
    const w = api.state.world === 0 ? MOON : P[3];
    toSurface(w, { ty: 20, d: 120, th: 0 });
    astro.visible = false;
    startLander(w);
    clearChoice();
    AC.fact(api.state.world === 0 ? 'Landing on the Moon' : 'Now Mars', api.state.world === 0 ? 'Gravity is weak here. Tap the engine to slow your fall.' : 'Gravity is 2.3 times stronger than on the Moon. Start braking early!', { tag: 'Round ' + (api.state.world + 1) });
  }

  const MR = AC.missions({ game: 'planets', week: 7, list: missions });
  AC.ui.hint('Drag to rotate · scroll to zoom');
  function help() {
    AC.ui.card({ eyebrow: 'Planets', title: 'Planet Hopper', body: ['Sizes and distances in the orbit view are squashed so everything fits. All the gravity numbers, years and days are real.', AC.ui.learnGrid([{ t: 'Orbit view', p: 'Planets move at their real relative speeds.' }, { t: 'Surface', p: 'Gravity, jumps and falls use real g values.' }])] });
  }

  S.onFrame((dt) => {
    if (mode === 'orrery') {
      orreryTime += dt * 20; // 20 Earth days per second
      P.forEach((p) => {
        p.pivot.rotation.y = (orreryTime / p.period) * Math.PI * 2 + P.indexOf(p) * 1.7;
        p.body.rotation.y += dt * 0.5;
        if (p.tag.visible) { p.body.getWorldPosition(p.tag.pos); p.tag.pos.y += p.size + 0.8; }
      });
      sun.rotation.y += dt * 0.05;
      timeTag.textContent = '1 second = 20 Earth days · Earth years passed: ' + AC.fmt(orreryTime / 365, 1);
    }
    MR.update(dt);
    oc.update(dt);
  });
  toOrrery();
  S.start();
  MR.begin();
})();
