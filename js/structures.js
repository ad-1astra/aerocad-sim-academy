/* Strong & Light — Week 5 · Structures, materials & manufacturing
   Bending stress in a drone arm (σ = 6FL ÷ bh²), factor of safety and stiffness, triangulated trusses,
   density and specific strength, 3D-print orientation. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  const V3 = THREE.Vector3;
  AC.boot({ game: 'struct', week: 5, topic: 'Structures & Materials', title: 'Strong & Light', help: () => help() });
  const S = AC.scene({ fov: 45, near: 0.05, far: 800, background: 0x1b2433, shadows: true });
  const { scene, camera, renderer } = S;
  AC.lights(scene, { sky: 0xdfe8f5, ground: 0x30343a, hemi: 0.9, sun: 0.8, dir: [10, 30, 20], shadows: true, shadowSize: 20 });
  const mat = AC.models.mat, mesh = AC.models.mesh;
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 30, min: 6, max: 90, phi: 1.2, theta: 0.3 });

  // workshop floor + bench
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: 0x4a525c }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const bench = new THREE.Group();
  mesh(new THREE.BoxGeometry(30, 1, 14), mat(0x8a6a48), 4, 9.5, 0, bench).receiveShadow = true;
  for (const [x, z] of [[-10, 6], [18, 6], [-10, -6], [18, -6]]) mesh(new THREE.BoxGeometry(0.8, 9, 0.8), mat(0x3a4552), x, 4.5, z, bench);
  scene.add(bench);

  // ---------------------------------------------------------------- mission 1: drone arm test rig (1 unit = 10 mm)
  const MATS = [
    { id: 'pla', name: 'PLA (3D print)', rho: 1.24, sig: 50, E: 3500, col: 0xf59a23 },
    { id: 'balsa', name: 'Balsa wood', rho: 0.16, sig: 10, E: 3000, col: 0xe8d29a },
    { id: 'al', name: 'Aluminium 2024', rho: 2.78, sig: 324, E: 73000, col: 0xc9d1d9 },
    { id: 'cf', name: 'Carbon fibre', rho: 1.6, sig: 600, E: 70000, col: 0x2a2f36 },
    { id: 'steel', name: 'Steel', rho: 7.85, sig: 250, E: 200000, col: 0x8a949c },
  ];
  const WIDTHS = [6, 8, 10, 12, 16], THICK = [3, 4, 5, 6, 8];
  const L = 125, F = 6; // mm, N (one motor's thrust, from the Week 5 handout)
  const rig = new THREE.Group();
  rig.position.set(-4, 10, 0);
  scene.add(rig);
  mesh(new THREE.BoxGeometry(3, 4, 4), mat(0x3a4552), -1.5, 0, 0, rig); // clamp block
  const SEG = 50;
  let armMesh = null, motor = null;
  const arm = { w: 10, t: 4, m: MATS[0], load: 0, broken: false, testing: 0 };
  function evalArm(a = arm) {
    const I = (a.w * Math.pow(a.t, 3)) / 12;
    const sigma = (6 * F * L) / (a.w * a.t * a.t); // = M·c/I at the root, MPa
    const fos = a.m.sig / sigma;
    const defl = (F * Math.pow(L, 3)) / (3 * a.m.E * I); // mm
    const mass = (a.m.rho * a.w * a.t * L) / 1000; // g
    return { I, sigma, fos, defl, mass, ok: fos >= 2 && defl <= 5 };
  }
  const BEST = (() => { let b = Infinity; for (const m of MATS) for (const w of WIDTHS) for (const t of THICK) { const r = evalArm({ w, t, m }); if (r.ok) b = Math.min(b, r.mass); } return b; })();
  function buildArm() {
    if (armMesh) rig.remove(armMesh);
    if (motor) rig.remove(motor);
    const geo = new THREE.BoxGeometry(L / 10, arm.t / 10, arm.w / 10, SEG, 1, 1);
    geo.translate(L / 20, 0, 0);
    geo.userData.base = geo.attributes.position.array.slice();
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    armMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.6 }));
    armMesh.castShadow = true;
    rig.add(armMesh);
    motor = new THREE.Group();
    mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.6, 20), mat(0x9aa7b4, { metalness: 0.7 }), 0, 1.0, 0, motor);
    mesh(new THREE.BoxGeometry(10, 0.12, 0.8), mat(0x39c6e8), 0, 1.9, 0, motor);
    rig.add(motor);
    arm.broken = false;
    deformArm(0);
  }
  const cTmp = new THREE.Color();
  function deformArm(loadFrac) {
    const r = evalArm();
    const geo = armMesh.geometry, pos = geo.attributes.position, base = geo.userData.base, col = geo.attributes.color;
    const Lu = L / 10;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const xm = (x / Lu) * L;
      // cantilever with a tip load: y(x) = F x² (3L − x) / (6EI), lifted by thrust
      const y = (loadFrac * F * xm * xm * (3 * L - xm)) / (6 * arm.m.E * r.I) / 10;
      pos.setY(i, base[i * 3 + 1] + y);
      const s = (loadFrac * 6 * F * (L - xm)) / (arm.w * arm.t * arm.t) / arm.m.sig; // stress ÷ strength
      cTmp.setRGB(0.29, 0.89, 0.54).lerp(cTmp.clone().setRGB(1, 0.71, 0.28), clamp(s * 2, 0, 1));
      if (s > 0.5) cTmp.lerp(new THREE.Color(1, 0.35, 0.31), clamp((s - 0.5) * 2, 0, 1));
      col.setXYZ(i, cTmp.r, cTmp.g, cTmp.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
    const tipY = (loadFrac * F * L * L * (2 * L)) / (6 * arm.m.E * r.I) / 10;
    motor.position.set(Lu - 1.2, arm.t / 20 + tipY, 0);
    loadArrow.set(new V3(-4 + Lu - 1.2, 10 + tipY + 3.2, 0), new V3(0, loadFrac * F, 0), 0.6);
  }
  const loadArrow = new AC.Arrow(scene, 0x3fd0f0, { width: 0.18 });
  const thrTag = S.tag('', 'var(--cyan)');
  thrTag.visible = false;

  // ---------------------------------------------------------------- mission 2: truss tower (position-based physics)
  const tower = new THREE.Group();
  scene.add(tower);
  const BAYS = 3, BW = 6, BH = 6;
  let T = null;
  function buildTower() {
    tower.clear();
    const nodes = [];
    for (let k = 0; k <= BAYS; k++) for (let s = 0; s < 2; s++) nodes.push({ p: new V3(s * BW - BW / 2, k * BH + 0.5, 0), v: new V3(), pin: k === 0 });
    const bars = [];
    const id = (k, s) => k * 2 + s;
    for (let k = 0; k <= BAYS; k++) { if (k > 0) bars.push([id(k, 0), id(k, 1)]); }
    for (let k = 0; k < BAYS; k++) { bars.push([id(k, 0), id(k + 1, 0)]); bars.push([id(k, 1), id(k + 1, 1)]); }
    T = { nodes, bars, braces: new Array(BAYS).fill(false), id, meshes: [], running: 0, tests: 0 };
    nodes.forEach((n) => { n.home = n.p.clone(); const m = mesh(new THREE.SphereGeometry(0.45, 14, 10), mat(n.pin ? 0x3a4552 : 0xffb547), 0, 0, 0, tower); n.mesh = m; });
    mesh(new THREE.BoxGeometry(BW + 6, 0.6, 3), mat(0x3a4552), 0, 0.2, 0, tower);
    // clickable bay panels
    T.panels = [];
    for (let k = 0; k < BAYS; k++) {
      const pnl = new THREE.Mesh(new THREE.PlaneGeometry(BW - 1, BH - 1), new THREE.MeshBasicMaterial({ color: 0x3fd0f0, transparent: true, opacity: 0.08, side: THREE.DoubleSide }));
      pnl.position.set(0, k * BH + BH / 2 + 0.5, 0);
      pnl.userData.bay = k;
      tower.add(pnl);
      T.panels.push(pnl);
    }
    rebuildBars();
    tower.visible = false;
  }
  function allBars() {
    const b = T.bars.slice();
    T.braces.forEach((on, k) => { if (on) b.push([T.id(k, 0), T.id(k + 1, 1)]); });
    return b.map(([a, c]) => ({ a, c, len: T.nodes[a].home.distanceTo(T.nodes[c].home), brace: false }));
  }
  function rebuildBars() {
    T.meshes.forEach((m) => tower.remove(m));
    T.meshes = [];
    T.cons = allBars();
    T.cons.forEach((b) => {
      const isBrace = Math.abs(T.nodes[b.a].home.x - T.nodes[b.c].home.x) > 0.1 && Math.abs(T.nodes[b.a].home.y - T.nodes[b.c].home.y) > 0.1;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1, 8), mat(isBrace ? 0x4be38a : 0xc9d1d9));
      m.castShadow = true;
      tower.add(m);
      b.m = m;
      T.meshes.push(m);
    });
    layoutBars();
  }
  const up = new V3(0, 1, 0);
  function layoutBars() {
    T.nodes.forEach((n) => n.mesh.position.copy(n.p));
    T.cons.forEach((b) => {
      const a = T.nodes[b.a].p, c = T.nodes[b.c].p;
      const d = c.clone().sub(a);
      b.m.position.copy(a).addScaledVector(d, 0.5);
      b.m.scale.set(1, d.length(), 1);
      b.m.quaternion.setFromUnitVectors(up, d.normalize());
    });
  }
  function stepTower(dt) {
    if (!T || T.running <= 0) return;
    const n = 12, s = dt / n;
    const top = T.nodes[T.id(BAYS, 0)];
    for (let it = 0; it < n; it++) {
      // position-based dynamics: predict, then push bars back to their lengths
      T.nodes.forEach((nd) => {
        if (nd.pin) return;
        nd.prev = nd.p.clone();
        nd.v.multiplyScalar(0.98);
        nd.v.y -= 0.6 * s;
        if (nd === top) nd.v.x += 14 * s; // wind gust pushing the top sideways
        nd.p.addScaledVector(nd.v, s);
      });
      for (let k = 0; k < 12; k++) T.cons.forEach((b) => {
        const A = T.nodes[b.a], C = T.nodes[b.c];
        const d = C.p.clone().sub(A.p), len = d.length(), diff = (len - b.len) / len;
        const wa = A.pin ? 0 : 1, wc = C.pin ? 0 : 1;
        if (!wa && !wc) return;
        const corr = d.multiplyScalar(diff / (wa + wc));
        if (wa) A.p.addScaledVector(corr, 1);
        if (wc) C.p.addScaledVector(corr, -1);
      });
      T.nodes.forEach((nd) => {
        if (nd.pin) return;
        if (nd.p.y < 0.5) nd.p.y = 0.5;
        nd.v.copy(nd.p).sub(nd.prev).divideScalar(s);
      });
    }
    T.running -= dt;
    layoutBars();
    T.sway = Math.abs(top.p.x - top.home.x);
    if (T.running <= 0) finishTower();
  }
  let towerApi = null;
  function testTower() {
    if (T.running > 0) return;
    T.nodes.forEach((n) => { n.p.copy(n.home); n.v.set(0, 0, 0); n.prev = null; });
    T.running = 3;
    T.tests++;
    AC.audio.whoosh();
  }
  function finishTower() {
    const braced = T.braces.filter(Boolean).length;
    const ok = T.sway < 1.2;
    AC.fact(ok ? 'Rigid!' : 'It folded', ok ? 'Every square is split into triangles. A triangle cannot change shape unless a bar changes length, so the tower stays put. Sway: ' + AC.fmt(T.sway, 1) + ' units.' : 'A square of pin-jointed bars squashes into a parallelogram. Brace every bay with a diagonal.', { color: ok ? 'var(--green)' : 'var(--amber)', tag: 'Wind test' });
    ok ? AC.audio.good() : AC.audio.bad();
    if (ok && towerApi) setTimeout(() => towerApi && towerApi.win(braced === BAYS && T.tests <= 2 ? 3 : T.tests <= 4 ? 2 : 1, 'Rigid with ' + braced + ' diagonal braces after ' + T.tests + ' test' + (T.tests > 1 ? 's' : '') + '.'), 900);
  }

  // ---------------------------------------------------------------- mission 3: density blocks (100 g each)
  const blocks = new THREE.Group();
  scene.add(blocks);
  MATS.forEach((m, i) => {
    const side = Math.cbrt(100 / m.rho) / 2; // cm → scene units (½ scale)
    const b = mesh(new THREE.BoxGeometry(side, side, side), mat(m.col, m.id === 'al' || m.id === 'steel' ? { metalness: 0.7, roughness: 0.3 } : {}), -8 + i * 5.2, 10 + side / 2, 0, blocks);
    b.castShadow = true;
    const t = AC.textSprite(m.name.split(' ')[0] + ' · 100 g', { color: '#e9f0f7', size: 0.9 });
    t.position.set(-8 + i * 5.2, 10 + side + 1.2, 0);
    blocks.add(t);
  });
  const QROUNDS = [
    { q: 'Each block weighs 100 g. Why is the balsa block so big?', a: ['Balsa has a very low density', 'Balsa is stronger', 'It was cut wrong', 'Balsa is a metal'], c: 0, x: 'Density = mass ÷ volume. Same mass with low density needs a big volume: balsa 0.16 g/cm³, steel 7.85 g/cm³.' },
    { q: 'You must 3D-print a drone arm. How should it lie on the printer bed?', a: ['Flat, so the layers run along the arm', 'Standing upright', 'Upside down', 'It makes no difference'], c: 0, x: 'Prints are weakest between layers. Upright, the bending load would peel the layers apart at the root.' },
    { q: 'Which material for an airliner\'s skin?', a: ['Aluminium 2024', 'Balsa wood', 'PLA', 'Steel'], c: 0, x: 'Aluminium alloys are light, strong and easy to rivet. Modern jets like the Boeing 787 also use carbon fibre.' },
    { q: 'Parts right next to a hot jet engine should be made of…', a: ['Titanium', 'PLA (softens at 60 °C)', 'Balsa', 'Rubber'], c: 0, x: 'Titanium stays strong when hot. PLA would soften at about 60 °C.' },
    { q: 'Strong AND light: which number do aerospace engineers compare?', a: ['Specific strength = strength ÷ density', 'Colour', 'Price only', 'Melting point only'], c: 0, x: 'Carbon fibre: 600 MPa ÷ 1.6 = 375. Steel: 250 ÷ 7.85 = 32. Carbon fibre wins by more than 10 times.' },
  ];

  // ---------------------------------------------------------------- panels
  let hud = null, panel = null;
  function newHud() { if (hud) hud.el.remove(); hud = AC.ui.hud(); return hud; }
  function clearPanel() { if (panel) panel.remove(); panel = null; }
  function showScene(which) {
    rig.visible = which === 'arm';
    loadArrow.hide();
    tower.visible = which === 'tower';
    blocks.visible = which === 'blocks';
    bench.visible = which !== 'tower';
    if (which === 'arm') { oc.target.set(2, 10, 0); oc.dist = 26; oc.phi = 1.3; oc.theta = 0.15; }
    if (which === 'tower') { oc.target.set(0, 10, 0); oc.dist = 40; oc.phi = 1.35; oc.theta = 0; }
    if (which === 'blocks') { oc.target.set(2, 12, 0); oc.dist = 30; oc.phi = 1.3; oc.theta = 0; }
  }
  function armPanel(api) {
    clearPanel();
    const row = (label, opts, get, set) => {
      const box = h('div', { class: 'opts five' });
      opts.forEach((o) => {
        const b = h('button', { type: 'button', class: get() === o.v ? 'on' : '' }, o.label, o.note ? h('small', {}, o.note) : null);
        b.addEventListener('click', () => { if (arm.testing > 0) return; set(o.v); [...box.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); AC.audio.click(); buildArm(); refreshArm(); });
        box.appendChild(b);
      });
      return h('div', { class: 'row2' }, h('span', {}, label), box);
    };
    const test = h('button', { class: 'ac-btn', type: 'button' }, 'Load test: 6 N at the tip');
    test.addEventListener('click', () => { if (arm.testing > 0) return; buildArm(); arm.testing = 2.2; api.state.tests = (api.state.tests || 0) + 1; AC.audio.whoosh(); });
    panel = h('div', { class: 'opt-panel ac-panel' },
      row('Material', MATS.map((m) => ({ v: m, label: m.name, note: m.rho + ' g/cm³' })), () => arm.m, (v) => (arm.m = v)),
      row('Width b', WIDTHS.map((w) => ({ v: w, label: w + ' mm' })), () => arm.w, (v) => (arm.w = v)),
      row('Thickness h', THICK.map((t) => ({ v: t, label: t + ' mm' })), () => arm.t, (v) => (arm.t = v)),
      h('div', { class: 'ac-actions' }, test));
    AC.root().appendChild(panel);
  }
  function refreshArm() {
    const r = evalArm();
    hud.set('mat', arm.m.name);
    hud.set('sec', arm.w + ' × ' + arm.t + ' mm = ' + arm.w * arm.t + ' mm²');
    hud.set('mass', AC.fmt(r.mass, 2) + ' g');
    hud.setFormula('sig', 'Bending stress at the root\nσ = 6 F L ÷ (b h²)\n= 6 × 6 × 125 ÷ (' + arm.w + ' × ' + arm.t + '²)\n= ' + AC.fmt(r.sigma, 1) + ' MPa');
    hud.set('str', arm.m.sig + ' MPa');
    hud.set('fos', AC.fmt(r.fos, 2), r.fos < 1 ? 'bad' : r.fos < 2 ? 'warn' : '');
    hud.set('defl', AC.fmt(r.defl, 1) + ' mm', r.defl > 5 ? 'warn' : '');
    hud.setFormula('direct', 'Direct stress (pulling only): σ = F ÷ A = 6 ÷ ' + arm.w * arm.t + ' = ' + AC.fmt(F / (arm.w * arm.t), 2) + ' MPa. Bending is ' + AC.fmt(r.sigma / (F / (arm.w * arm.t))) + '× bigger!');
  }

  const missions = [
    {
      id: 'arm', title: 'Arm Test', objective: 'Design the lightest arm with factor of safety ≥ 2 that bends less than 5 mm',
      story: 'Each motor pushes up with 6 N at the end of a 125 mm arm. The arm is clamped at the frame, so it bends, and bending stress is biggest at the root. Choose a material and cross-section, then load-test it.',
      learn: [
        { t: 'Stress', p: 'Force spread over area. Bending makes far more stress than pulling.', f: 'σ = F ÷ A · bending σ = 6FL ÷ bh²' },
        { t: 'Factor of safety', p: 'Material strength ÷ actual stress. Aim for at least 2.', f: 'FoS = strength ÷ σ' },
        { t: 'Strong AND light', p: 'Lighter arms mean longer flights. Also stiff: the prop wobbles if the tip bends more than 5 mm.' },
      ],
      controls: ['Pick material, width and thickness', 'Press <b>Load test</b>', 'Drag to look around'],
      proved: 'Thickness matters most because bending stress depends on h²: doubling the thickness cuts stress to a quarter. Specific strength and stiffness decide the winner, which is why model aircraft use balsa and carbon fibre.',
      tip: 'Red at the root means high stress. Try a thicker section or a stronger material, then look at the mass.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Where does a drone arm usually break')),
      start(api) {
        cleanup(); showScene('arm');
        arm.w = 10; arm.t = 4; arm.m = MATS[0];
        newHud().section('Arm').row('mat', 'Material').row('sec', 'Cross-section').row('mass', 'Mass (125 mm)');
        hud.section('Stress').formula('sig', '').row('str', 'Material strength').row('fos', 'Factor of safety').row('defl', 'Tip bends');
        hud.formula('direct', '');
        buildArm(); refreshArm(); armPanel(api);
        thrTag.visible = true;
      },
      update(dt, api) {
        if (arm.testing > 0) {
          arm.testing -= dt;
          const r = evalArm();
          const lf = clamp(1 - (arm.testing - 0.6) / 1.6, 0, 1);
          if (r.fos < 1 && lf * (1 / r.fos) >= 1 && !arm.broken) {
            arm.broken = true;
            AC.audio.boom();
            AC.ui.toast('SNAP!', 'var(--red)');
          }
          if (arm.broken) { armMesh.rotation.z = AC.damp(armMesh.rotation.z, -0.9, 6, dt); motor.position.y -= dt * 6; }
          else deformArm(lf);
          if (arm.testing <= 0) {
            const msg = r.fos < 1 ? 'The arm broke at the root: stress ' + AC.fmt(r.sigma) + ' MPa is more than the material\'s ' + arm.m.sig + ' MPa.' : r.fos < 2 ? 'It held, but FoS ' + AC.fmt(r.fos, 2) + ' is below 2. One hard landing and it could crack.' : r.defl > 5 ? 'Strong enough, but the tip bends ' + AC.fmt(r.defl, 1) + ' mm: too floppy, the prop would wobble.' : 'PASS: FoS ' + AC.fmt(r.fos, 2) + ', bends ' + AC.fmt(r.defl, 1) + ' mm, mass ' + AC.fmt(r.mass, 2) + ' g.';
            AC.fact('Load test result', msg, { color: r.ok ? 'var(--green)' : 'var(--amber)', tag: 'Test ' + api.state.tests });
            if (r.ok) {
              api.state.passes = (api.state.passes || 0) + 1;
              const ratio = r.mass / BEST;
              if (ratio <= 1.15) api.win(3, 'The lightest possible design: ' + AC.fmt(r.mass, 2) + ' g of ' + arm.m.name.toLowerCase() + '.');
              else if (api.state.passes >= 3 || ratio <= 1.6) api.win(ratio <= 1.6 ? 2 : 1, 'Your arm passes at ' + AC.fmt(r.mass, 2) + ' g. The lightest passing arm weighs ' + AC.fmt(BEST, 2) + ' g. Can you find it?');
              else AC.fact('It passes, but it is heavy', 'Can you find a lighter arm that still passes? Mass ' + AC.fmt(r.mass, 2) + ' g.', { tag: 'Engineer challenge' });
            }
          }
        }
        thrTag.pos.set(-4 + L / 10 - 1.2, 15.5, 0);
        thrTag.set('THRUST 6 N');
        api.progress(clamp(evalArm().fos / 2, 0, 1), 'FoS ' + AC.fmt(evalArm().fos, 2));
      },
    },
    {
      id: 'truss', title: 'Triangle Power', objective: 'Brace the tower so the wind cannot fold it',
      story: 'This is a landing-gear tower made of bars joined with pins. Squares are weak: with pin joints they fold into a parallelogram. Click a bay to add a diagonal brace, then run the wind test. Use as few braces as you can.',
      learn: [
        { t: 'Triangles are rigid', p: 'A triangle cannot change shape without changing a side length.' },
        { t: 'Trusses', p: 'Triangulated frames give rigidity with very little material: cranes, bridges, wing ribs.' },
        { t: 'Real aircraft', p: 'Wings use spars, ribs and skin; the skin acts like millions of tiny diagonals.' },
      ],
      controls: ['Click a bay to add or remove a diagonal', 'Press <b>Wind test</b>'],
      proved: 'Each square bay needs one diagonal to become two triangles. With every bay braced, the tower carries the wind load with almost no sway. Trusses are strong for very little mass.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Why are triangles used')),
      start(api) {
        cleanup(); showScene('tower');
        buildTower(); tower.visible = true; towerApi = api;
        newHud().section('Tower').row('br', 'Diagonal braces', '0 of 3 bays').row('sway', 'Top sway', '--');
        hud.formula('tri', 'A pin-jointed square has 4 bars and can still move. Add 1 diagonal = 2 triangles = rigid.');
        clearPanel();
        const go = h('button', { class: 'ac-btn', type: 'button' }, 'Wind test');
        go.addEventListener('click', testTower);
        const reset = h('button', { class: 'ac-btn ghost', type: 'button' }, 'Reset tower');
        reset.addEventListener('click', () => { T.nodes.forEach((n) => { n.p.copy(n.home); n.v.set(0, 0, 0); }); T.running = 0; layoutBars(); });
        panel = h('div', { class: 'opt-panel ac-panel' }, h('div', { class: 'q' }, h('small', {}, 'Click the blue bays in the 3D view to brace them'), 'Make the tower rigid'), h('div', { class: 'ac-actions' }, reset, go));
        AC.root().appendChild(panel);
      },
      update(dt, api) {
        stepTower(dt);
        hud.set('br', T.braces.filter(Boolean).length + ' of 3 bays');
        hud.set('sway', T.sway != null ? AC.fmt(T.sway, 2) + ' units' : '--', T.sway > 1.2 ? 'bad' : '');
        api.progress(T.braces.filter(Boolean).length / 3, 'Tests: ' + T.tests);
      },
    },
    {
      id: 'materials', title: 'Material Match', objective: 'Answer 5 materials questions using the 100 g blocks',
      story: 'Every block on the bench has the same mass: 100 g. Their sizes show their density. Use them to answer five engineering questions.',
      learn: [
        { t: 'Density', p: 'How much mass is packed into each cm³.', f: 'ρ = m ÷ V' },
        { t: 'Specific strength', p: 'Strength ÷ density. The aerospace engineer\'s favourite number.' },
        { t: '3D printing', p: 'The slicer builds parts in layers. Layers are the weak direction.' },
      ],
      controls: ['Click an answer', 'Drag to look around'],
      proved: 'Aerospace structures are a fight for the best strength-to-weight ratio. Aluminium and carbon fibre for skins and frames, titanium near hot engines, PLA for quick prototypes, printed flat so the layers carry the load.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Why is carbon fibre used')),
      start(api) {
        cleanup(); showScene('blocks');
        newHud().section('Densities (g/cm³)');
        MATS.forEach((m) => hud.row(m.id, m.name, String(m.rho)));
        hud.section('Strength ÷ density');
        MATS.forEach((m) => hud.row(m.id + 's', m.name, AC.fmt(m.sig / m.rho)));
        api.state.k = 0; api.state.right = 0;
        matRound(api);
      },
      update(dt) { blocks.children.forEach((c) => { if (c.isMesh) c.rotation.y += dt * 0.3; }); },
    },
  ];
  function matRound(api) {
    clearPanel();
    const r = AC.shuffleQ(QROUNDS[api.state.k]);
    const box = h('div', { class: 'opts' });
    let done = false;
    r.a.forEach((txt, i) => {
      const b = h('button', { type: 'button' }, txt);
      b.addEventListener('click', () => {
        if (done) return;
        done = true;
        const ok = i === r.c;
        b.classList.add(ok ? 'right' : 'wrong');
        box.children[r.c].classList.add('right');
        ok ? (api.state.right++, AC.audio.good()) : AC.audio.bad();
        AC.fact(ok ? 'Correct' : 'Not quite', r.x, { tag: 'Round ' + (api.state.k + 1), color: ok ? 'var(--green)' : 'var(--amber)' });
        api.state.k++;
        api.progress(api.state.k / QROUNDS.length, api.state.right + ' correct');
        const tok = api.state;
        setTimeout(() => { if (tok !== api.state) return; if (api.state.k >= QROUNDS.length) api.win(api.state.right === 5 ? 3 : api.state.right >= 4 ? 2 : 1, api.state.right + ' of 5 correct.'); else matRound(api); }, 1600);
      });
      box.appendChild(b);
    });
    panel = h('div', { class: 'opt-panel ac-panel' }, h('div', { class: 'q' }, h('small', {}, 'Question ' + (api.state.k + 1) + ' of ' + QROUNDS.length), r.q), box);
    AC.root().appendChild(panel);
  }
  function cleanup() { clearPanel(); towerApi = null; thrTag.visible = false; arm.testing = 0; if (T) T.running = 0; }
  const MR = AC.missions({ game: 'struct', week: 5, list: missions });

  // click a bay to toggle its brace
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || !tower.visible || !T || T.running > 0) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(T.panels)[0];
    if (!hit) return;
    const k = hit.object.userData.bay;
    T.braces[k] = !T.braces[k];
    T.nodes.forEach((n) => { n.p.copy(n.home); n.v.set(0, 0, 0); });
    rebuildBars();
    AC.audio.click();
  });
  function help() { AC.ui.card({ eyebrow: 'Week 5', title: 'Strong & Light', body: ['Three workshop experiments about strength, stiffness and weight. Colours on the arm show stress: green is low, orange is medium, red is close to breaking.'] }); }
  AC.ui.hint('Drag to look around · scroll to zoom');
  S.onFrame((dt) => { MR.update(dt); oc.update(dt); });
  buildTower();
  S.start();
  MR.begin();
})();
