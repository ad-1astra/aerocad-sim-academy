/* Stability Hangar — Week 3 · Stability & Control
   Principle of moments on a balance pivot, CG of a drone, static margin in a wind tunnel,
   control-surface drill and ICAO navigation lights at night. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  const V3 = THREE.Vector3;

  AC.boot({ game: 'stab', week: 3, topic: 'Stability & Control', title: 'Stability Hangar', help: () => help() });

  const S = AC.scene({ fov: 50, near: 0.01, far: 6000, background: 0x1b2433 });
  const { scene, camera, renderer } = S;
  const lights = AC.lights(scene, { sky: 0xdfe8f5, ground: 0x30343a, hemi: 0.95, sun: 0.7, dir: [20, 60, 40] });
  const mat = AC.models.mat;
  const mesh = AC.models.mesh;

  // ---------------------------------------------------------------- hangar room + workbench
  const room = new THREE.Group();
  scene.add(room);
  const floorTex = AC.canvasTex(256, 256, (g, w, hh) => {
    g.fillStyle = '#59606a'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(Math.random() * w, Math.random() * hh, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.strokeRect(0, 0, w, hh);
    g.fillStyle = '#ffb547'; g.fillRect(0, hh / 2 - 3, w, 6);
  }, [12, 12]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(60, 16, 60), new THREE.MeshLambertMaterial({ color: 0x2b3542, side: THREE.BackSide }));
  walls.position.y = 8;
  room.add(walls);
  const sign = AC.textSprite('AeRoCAD STABILITY HANGAR', { color: '#e9f0f7', bg: 'rgba(232,48,42,0.9)', size: 1.2 });
  sign.position.set(0, 9, -29);
  room.add(sign);
  for (let i = -2; i <= 2; i++) { const l = mesh(new THREE.BoxGeometry(6, 0.15, 0.6), new THREE.MeshBasicMaterial({ color: 0xf4f7fb }), i * 10, 15.8, 0, room); l.castShadow = false; }
  const TABLE_Y = 0.9;
  const bench = new THREE.Group();
  mesh(new THREE.BoxGeometry(1.6, 0.05, 0.8), mat(0x8a6a48), 0, TABLE_Y - 0.025, 0, bench);
  for (const [x, z] of [[0.75, 0.35], [-0.75, 0.35], [0.75, -0.35], [-0.75, -0.35]]) mesh(new THREE.BoxGeometry(0.05, TABLE_Y - 0.05, 0.05), mat(0x3a4552), x, (TABLE_Y - 0.05) / 2, z, bench);
  const fulcrum = mesh(new THREE.ConeGeometry(0.025, 0.06, 4), mat(0xffb547), 0, TABLE_Y + 0.03, 0, bench);
  fulcrum.rotation.y = Math.PI / 4;
  room.add(bench);

  // ---------------------------------------------------------------- balance rigs (metres; items in mm along the beam)
  const PIVOT_Y = TABLE_Y + 0.06;
  const rulerTex = (from, to) => AC.canvasTex(2048, 64, (g, w, hh) => {
    g.fillStyle = '#f2e6c4'; g.fillRect(0, 0, w, hh);
    g.fillStyle = '#20262e'; g.font = 'bold 22px "B612 Mono", monospace'; g.textAlign = 'center';
    for (let mm = from; mm <= to; mm += 5) {
      const x = ((mm - from) / (to - from)) * (w - 40) + 20;
      const big = mm % 20 === 0;
      g.fillRect(x - 1, 0, 2, big ? 26 : mm % 10 === 0 ? 18 : 10);
      if (big) g.fillText(String(mm), x, 52);
    }
  });
  function buildRig(kind) {
    const rig = new THREE.Group();
    rig.position.set(0, PIVOT_Y, 0);
    rig.visible = false;
    scene.add(rig);
    let model;
    if (kind === 'plane') {
      const s = 0.0229;
      model = AC.models.plane();
      model.traverse((o) => { if (o.isMesh && o.position.y < -0.5) o.visible = false; });
      model.userData.disc.visible = false;
      model.scale.setScalar(s);
      model.rotation.y = -Math.PI / 2;
      model.position.set(-0.08 + 3.9 * s, 0.62 * s + 0.002, 0);
      const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.2 + 0.004, 0.012, 0.002), new THREE.MeshBasicMaterial({ map: rulerTex(0, 200) }));
      ruler.position.set(-0.08 + 0.1, 0.004, 0.035);
      rig.add(ruler);
    } else {
      model = AC.models.quad({ arm: 0.225 });
      model.userData.batt.visible = false;
      model.userData.cam.visible = false;
      model.rotation.y = -Math.PI / 2;
      model.position.set(0, 0.02, 0);
      model.userData.props.forEach((p) => (p.children[0].visible = true));
      const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.2 + 0.004, 0.012, 0.002), new THREE.MeshBasicMaterial({ map: rulerTex(-100, 100) }));
      ruler.position.set(0, 0.002, 0.06);
      ruler.rotation.y = Math.PI; // + mm (front) on the left, like the nose
      rig.add(ruler);
    }
    rig.add(model);
    const cg = mesh(new THREE.SphereGeometry(0.006, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff70d8, depthTest: false }), 0, 0.01, 0, rig);
    cg.renderOrder = 30;
    return { rig, model, cg, tilt: 0, kind };
  }
  const planeRig = buildRig('plane');
  const droneRig = buildRig('drone');

  function partMesh(p) {
    const g = new THREE.Group();
    if (p.kind === 'battery') { mesh(new THREE.BoxGeometry(0.032, 0.014, 0.022), mat(0x2b4d8c), 0, 0.007, 0, g); mesh(new THREE.BoxGeometry(0.033, 0.004, 0.006), mat(0xd8332a), 0, 0.014, 0, g); }
    else if (p.kind === 'camera') { mesh(new THREE.BoxGeometry(0.016, 0.014, 0.016), mat(0x111111), 0, 0.007, 0, g); const l = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.004, 12), mat(0x3a7bd5), -0.009, 0.008, 0, g); l.rotation.z = Math.PI / 2; }
    else { mesh(new THREE.TorusGeometry(0.006, 0.0015, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffb547, depthTest: false }), 0, 0.012, 0, g).renderOrder = 25; }
    const label = AC.textSprite(p.name + ' ' + p.g + ' g', { color: '#e9f0f7', size: 0.012, depthTest: false });
    label.position.y = 0.032;
    label.renderOrder = 31;
    g.add(label);
    return g;
  }
  const weightArrows = [0, 1, 2].map(() => new AC.Arrow(scene, 0xffb547, { width: 0.0012 }));
  const pivotArrow = new AC.Arrow(scene, 0x4be38a, { width: 0.0012 });
  let balance = null; // active balance experiment

  function startBalance(rigObj, parts, pivotMM, mmToX, api, opts) {
    endBalance();
    rigObj.rig.visible = true;
    rigObj.tilt = 0;
    const meshes = parts.map((p) => { const m = partMesh(p); rigObj.rig.add(m); return m; });
    balance = { rigObj, parts, pivotMM, mmToX, meshes, api, hold: 0, opts };
    // HUD
    newHud();
    const p0 = parts.find((p) => p.movable);
    const out = h('output', {}, p0.x + ' mm');
    const slider = h('input', { type: 'range', id: 'mv', min: opts.min, max: opts.max, step: opts.step, value: p0.x });
    slider.addEventListener('input', () => { p0.x = +slider.value; out.textContent = p0.x + ' mm'; AC.audio.click(); });
    hud.section('Move the ' + p0.name.toLowerCase()).add(h('div', { class: 'ac-field' }, h('label', { for: 'mv' }, 'Position from ' + opts.ref, out), slider));
    hud.section('Moments table');
    balance.table = h('table', { class: 'mtab' });
    hud.add(balance.table);
    hud.formula('cg', '');
    hud.section('Turning effects about the pivot');
    hud.row('acw', opts.sideA).row('cw', opts.sideB);
    hud.formula('bal', '');
  }
  function endBalance() {
    if (!balance) return;
    balance.meshes.forEach((m) => m.parent.remove(m));
    balance.rigObj.rig.visible = false;
    weightArrows.forEach((a) => a.hide());
    pivotArrow.hide();
    balance = null;
  }
  function updateBalance(dt) {
    const B = balance;
    if (!B) return;
    const { parts, pivotMM, mmToX, rigObj } = B;
    let m = 0, mx = 0, A = 0, C = 0;
    parts.forEach((p, i) => {
      m += p.g; mx += p.g * p.x;
      const arm = p.x - pivotMM;
      if (B.opts.frontPositive ? arm > 0 : arm < 0) A += p.g * Math.abs(arm); else C += p.g * Math.abs(arm);
      B.meshes[i].position.set(mmToX(p.x), p.y || 0.03, 0);
    });
    const xcg = mx / m;
    const net = (B.opts.frontPositive ? -1 : 1) * (mx - m * pivotMM); // positive = right side (tail / rear) heavier
    const target = -0.2 * Math.tanh(net / 3000);
    rigObj.tilt = AC.damp(rigObj.tilt, target, 4, dt);
    rigObj.rig.rotation.z = rigObj.tilt;
    rigObj.cg.position.set(mmToX(xcg), 0.012, 0);
    // weight arrows and pivot reaction
    rigObj.rig.updateMatrixWorld(true);
    parts.forEach((p, i) => {
      const wp = B.meshes[i].getWorldPosition(new V3());
      weightArrows[i].set(wp, new V3(0, -p.g, 0), 0.00012);
    });
    pivotArrow.set(new V3(0, PIVOT_Y - 0.075, 0.0), new V3(0, m, 0), 0.00009);
    // table
    B.table.innerHTML = '';
    B.table.appendChild(h('tr', {}, h('th', {}, 'Part'), h('th', {}, 'm (g)'), h('th', {}, 'x (mm)'), h('th', {}, 'm·x')));
    parts.forEach((p) => B.table.appendChild(h('tr', {}, h('td', {}, p.name), h('td', {}, p.g), h('td', {}, AC.fmt(p.x)), h('td', {}, AC.fmt(p.g * p.x)))));
    B.table.appendChild(h('tr', { class: 'tot' }, h('td', {}, 'Total'), h('td', {}, m), h('td', {}, ''), h('td', {}, AC.fmt(mx))));
    hud.setFormula('cg', 'x_CG = Σ(m·x) ÷ Σm\n= ' + AC.fmt(mx) + ' ÷ ' + m + '\n= ' + AC.fmt(xcg, 1) + ' mm');
    hud.set('acw', AC.fmt(A) + ' g·mm', 'cyan');
    hud.set('cw', AC.fmt(C) + ' g·mm', 'cyan');
    const ok = Math.abs(xcg - B.opts.target) <= B.opts.tol;
    hud.setFormula('bal', ok ? 'Balanced: the two turning effects are equal' : A > C ? B.opts.sideA + ' wins: it tips that way' : B.opts.sideB + ' wins: it tips that way');
    B.hold = ok ? B.hold + dt : 0;
    B.api.progress(B.hold / 1.5, ok ? 'Balanced: hold it' : 'CG at ' + AC.fmt(xcg, 1) + ' mm');
    if (B.hold >= 1.5) {
      const moves = B.api.state.moves || 0;
      B.api.win(B.api.t < 40 ? 3 : B.api.t < 90 ? 2 : 1, 'CG = ' + AC.fmt(xcg, 1) + ' mm, right above the pivot.');
    }
  }

  // ---------------------------------------------------------------- wind tunnel (static margin)
  const tunnel = new THREE.Group();
  tunnel.visible = false;
  scene.add(tunnel);
  const tunnelWalls = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 50), new THREE.MeshLambertMaterial({ color: 0x223044, side: THREE.BackSide }));
  tunnelWalls.position.y = 5;
  tunnel.add(tunnelWalls);
  const sting = mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.7, 10), mat(0x9aa7b4, { metalness: 0.6 }), 0, 2.35, 0, tunnel);
  const pitchG = new THREE.Group();
  tunnel.add(pitchG);
  const tunnelPlane = AC.models.plane();
  tunnelPlane.traverse((o) => { if (o.isMesh && o.position.y < -0.5) o.visible = false; });
  pitchG.add(tunnelPlane);
  // streamlines: short line segments flowing nose → tail
  const SL = 420;
  const slPos = new Float32Array(SL * 6);
  const slSeed = [];
  for (let i = 0; i < SL; i++) slSeed.push([AC.rand(-10, 10), AC.rand(0.5, 9.5), AC.rand(-25, 25)]);
  const slGeo = new THREE.BufferGeometry();
  slGeo.setAttribute('position', new THREE.BufferAttribute(slPos, 3));
  const streams = new THREE.LineSegments(slGeo, new THREE.LineBasicMaterial({ color: 0x9fdcf0, transparent: true, opacity: 0.55 }));
  tunnel.add(streams);
  const cgTag = S.tag('CG', 'var(--magenta)');
  const npTag = S.tag('NP', 'var(--green)');
  cgTag.visible = npTag.visible = false;
  const LE_Z = 1.3, CHORD = 1.5, NP_PCT = 40;
  const tun = { cg: 50, theta: 0, omega: 0, running: 0, trace: [], tests: 0, result: null };
  const cgMark = mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff70d8, depthTest: false }), 0, 0, 0, pitchG);
  cgMark.renderOrder = 30;
  const npMark = mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshBasicMaterial({ color: 0x4be38a, depthTest: false }), 0, 0, 0, pitchG);
  npMark.renderOrder = 30;
  function layoutTunnel() {
    const zcg = LE_Z - (tun.cg / 100) * CHORD;
    pitchG.position.set(0, 4.7, 0);
    tunnelPlane.position.set(0, -0.7, -zcg);
    cgMark.position.set(0.8, 0, 0);
    npMark.position.set(0.8, 0, LE_Z - (NP_PCT / 100) * CHORD - zcg);
  }
  function tunnelStep(dt, t) {
    for (let i = 0; i < SL; i++) {
      const s = slSeed[i];
      let z = ((s[2] - t * 22) % 50 + 75) % 50 - 25;
      slPos.set([s[0], s[1], z, s[0], s[1], z - 1.2], i * 6);
    }
    slGeo.attributes.position.needsUpdate = true;
    if (tun.running > 0) {
      const SM = (NP_PCT - tun.cg) / 100;
      const w0 = 3, n = 8;
      for (let k = 0; k < n; k++) {
        const d = dt / n;
        const acc = -w0 * w0 * (SM / 0.1) * tun.theta - 2 * 0.18 * w0 * tun.omega;
        tun.omega += acc * d;
        tun.theta = clamp(tun.theta + tun.omega * d, -AC.rad(75), AC.rad(75));
      }
      tun.running -= dt;
      tun.trace.push([5 - tun.running, AC.deg(tun.theta)]);
      if (tun.running <= 0) finishGust();
    }
    pitchG.rotation.x = -tun.theta;
    const wpos = new V3();
    cgMark.getWorldPosition(wpos); cgTag.pos.copy(wpos).add(new V3(0, 0.5, 0));
    npMark.getWorldPosition(wpos); npTag.pos.copy(wpos).add(new V3(0, -0.5, 0));
  }
  let tunApi = null, gustGraph = null;
  function startGust() {
    if (tun.running > 0) return;
    tun.theta = AC.rad(10); tun.omega = 0; tun.running = 5; tun.trace = [[0, 10]];
    tun.tests++;
    AC.audio.whoosh();
  }
  function finishGust() {
    const SM = NP_PCT - tun.cg;
    const end = Math.abs(AC.deg(tun.theta));
    let verdict, ok = false;
    if (SM < 0) verdict = 'UNSTABLE: the CG is behind the neutral point, so the gust made it flip over.';
    else if (SM < 3) verdict = 'NEUTRAL: it stayed nose-up and did not come back by itself.';
    else if (SM > 15) verdict = 'TOO STABLE: it snapped back, but with this much margin the elevator cannot raise the nose on take-off. Sluggish!';
    else { verdict = 'STABLE: it returned to level by itself, and the elevator can still rotate it.'; ok = true; }
    tun.result = verdict;
    AC.fact('Gust test: static margin ' + SM + '%', verdict, { color: ok ? 'var(--green)' : 'var(--amber)', tag: 'Test result' });
    ok ? AC.audio.good() : AC.audio.bad();
    if (ok && tunApi) setTimeout(() => tunApi && tunApi.win(tun.tests <= 2 ? 3 : tun.tests <= 4 ? 2 : 1, 'Static margin ' + SM + '% of chord, found in ' + tun.tests + ' test' + (tun.tests > 1 ? 's' : '') + '.'), 900);
    if (end < 1 && SM >= 0) tun.theta = 0;
  }

  // ---------------------------------------------------------------- display aircraft (control surfaces)
  const display = new THREE.Group();
  display.visible = false;
  scene.add(display);
  const stand = mesh(new THREE.CylinderGeometry(0.12, 0.6, 1.8, 12), mat(0x3a4552), 0, 0.9, 0, display);
  const motionG = new THREE.Group();
  motionG.position.y = 2.6;
  display.add(motionG);
  const dPlane = AC.models.plane();
  dPlane.traverse((o) => { if (o.isMesh && o.position.y < -0.5) o.visible = false; });
  motionG.add(dPlane);
  const dpu = dPlane.userData;
  const ACTIONS = [
    { id: 'ailL', label: 'Ailerons: left UP, right DOWN', motion: 'Roll LEFT', set: (k) => { dpu.ailL.rotation.x = 0.45 * k; dpu.ailR.rotation.x = -0.45 * k; }, rot: ['z', -1] },
    { id: 'ailR', label: 'Ailerons: right UP, left DOWN', motion: 'Roll RIGHT', set: (k) => { dpu.ailR.rotation.x = 0.45 * k; dpu.ailL.rotation.x = -0.45 * k; }, rot: ['z', 1] },
    { id: 'elUp', label: 'Elevator UP', motion: 'Pitch UP (nose up)', set: (k) => (dpu.elev.rotation.x = 0.45 * k), rot: ['x', -1] },
    { id: 'elDn', label: 'Elevator DOWN', motion: 'Pitch DOWN (nose down)', set: (k) => (dpu.elev.rotation.x = -0.45 * k), rot: ['x', 1] },
    { id: 'rdL', label: 'Rudder LEFT', motion: 'Yaw LEFT', set: (k) => (dpu.rudder.rotation.y = -0.5 * k), rot: ['y', 1] },
    { id: 'rdR', label: 'Rudder RIGHT', motion: 'Yaw RIGHT', set: (k) => (dpu.rudder.rotation.y = 0.5 * k), rot: ['y', -1] },
  ];
  let anim = null;
  function playAction(a, withMotion) {
    anim = { a, t: 0, withMotion };
  }
  function animStep(dt) {
    if (!anim) return;
    anim.t += dt;
    const t = anim.t;
    const k = t < 0.3 ? t / 0.3 : t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / 0.4);
    ACTIONS.forEach((x) => x.set(0));
    anim.a.set(k);
    motionG.rotation.set(0, 0, 0);
    if (anim.withMotion) {
      const m = t < 0.3 ? 0 : t < 1.6 ? (t - 0.3) / 1.3 : Math.max(0, 1 - (t - 1.6) / 0.6);
      motionG.rotation[anim.a.rot[0]] = anim.a.rot[1] * AC.rad(25) * m;
    }
    if (t > 2.3) { ACTIONS.forEach((x) => x.set(0)); motionG.rotation.set(0, 0, 0); anim = null; }
  }

  // ---------------------------------------------------------------- night watch (navigation lights)
  const night = new THREE.Group();
  night.visible = false;
  scene.add(night);
  const stars = AC.starfield(night, 1800, 4000, 1.4);
  const nGround = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshBasicMaterial({ color: 0x05080d }));
  nGround.rotation.x = -Math.PI / 2;
  night.add(nGround);
  for (let i = 0; i < 40; i++) { const l = mesh(new THREE.SphereGeometry(0.6, 6, 4), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd27a : 0x9fd0ff }), AC.rand(-1500, 1500), 0.5, AC.rand(300, 3000), night); }
  const glowTex = AC.canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const nightPlane = new THREE.Group();
  night.add(nightPlane);
  const navSprite = (color, size) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending }));
    s.scale.set(size, size, 1);
    nightPlane.add(s);
    return s;
  };
  // positions match the real plane model: +X = port (left) wing tip
  const NAV = {
    red: navSprite(0xff2a2a, 0.035), green: navSprite(0x22ff66, 0.035), white: navSprite(0xffffff, 0.03), strobe: navSprite(0xffffff, 0.05),
  };
  NAV.red.position.set(5.55, 0.7, 0.55); NAV.green.position.set(-5.55, 0.7, 0.55); NAV.white.position.set(0, 0.25, -4.85); NAV.strobe.position.set(0, 1.65, -4.55);
  const ghost = AC.models.plane();
  ghost.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: 0x0c121b }); });
  nightPlane.add(ghost);
  const SCEN = [
    { id: 'to', label: 'Coming towards you' },
    { id: 'away', label: 'Flying away from you' },
    { id: 'lr', label: 'Crossing from your left to your right' },
    { id: 'rl', label: 'Crossing from your right to your left' },
  ];
  const nw = { round: 0, score: 0, cur: null, t: 0, vel: new V3(), answered: false };
  function navVisibility() {
    // ICAO sectors: red/green visible from dead ahead to 110° on their side, white tail light from behind
    const fwd = new V3(0, 0, 1).applyQuaternion(nightPlane.quaternion);
    const left = new V3(1, 0, 0).applyQuaternion(nightPlane.quaternion);
    const toViewer = camera.position.clone().sub(nightPlane.position).normalize();
    const ang = AC.deg(Math.acos(clamp(fwd.dot(toViewer), -1, 1)));
    const side = left.dot(toViewer);
    NAV.red.visible = ang <= 110 && side > -0.05;
    NAV.green.visible = ang <= 110 && side < 0.05;
    NAV.white.visible = ang >= 110;
    NAV.strobe.visible = Math.sin(performance.now() / 110) > 0.88;
  }
  function nightRound() {
    const sc = SCEN[Math.floor(Math.random() * SCEN.length)];
    nw.cur = sc; nw.t = 0; nw.answered = false;
    const alt = AC.rand(140, 260), off = AC.rand(-120, 120);
    // the viewer looks along +Z, so screen-right is world −X
    const yaw = { to: Math.PI, away: 0, lr: -Math.PI / 2, rl: Math.PI / 2 }[sc.id];
    const start = { to: new V3(off, alt, 1100), away: new V3(off, alt, 380), lr: new V3(260, alt, AC.rand(600, 900)), rl: new V3(-260, alt, AC.rand(600, 900)) }[sc.id];
    nightPlane.position.copy(start);
    nightPlane.rotation.set(0, yaw, 0);
    nw.vel.set(0, 0, 55).applyAxisAngle(new V3(0, 1, 0), yaw);
    nwPanel.q.innerHTML = '';
    nwPanel.q.append(h('small', {}, 'Aircraft ' + (nw.round + 1) + ' of 8'), 'Which way is this aircraft flying?');
    [...nwPanel.opts.children].forEach((b) => { b.classList.remove('right', 'wrong'); b.disabled = false; });
  }
  let nwPanel = null, nwApi = null;
  function buildNight(api) {
    nwApi = api;
    nw.round = 0; nw.score = 0;
    const q = h('div', { class: 'q' });
    const opts = h('div', { class: 'opts two' });
    SCEN.forEach((sc) => {
      const b = h('button', { type: 'button' }, sc.label);
      b.addEventListener('click', () => answerNight(sc, b));
      opts.appendChild(b);
    });
    nwPanel = { el: h('div', { class: 'choices ac-panel' }, q, opts), q, opts };
    AC.root().appendChild(nwPanel.el);
    nightRound();
  }
  function answerNight(sc, btn) {
    if (nw.answered) return;
    nw.answered = true;
    const ok = sc.id === nw.cur.id;
    btn.classList.add(ok ? 'right' : 'wrong');
    [...nwPanel.opts.children][SCEN.indexOf(nw.cur)].classList.add('right');
    if (ok) { nw.score++; AC.audio.good(); } else AC.audio.bad();
    const why = { to: 'Red on your RIGHT and green on your LEFT means it is facing you.', away: 'Only the white tail light shows when it flies away.', lr: 'You can only see its GREEN (starboard, right-wing) light, so its right side faces you: it is flying to your right.', rl: 'You can only see its RED (port, left-wing) light, so its left side faces you: it is flying to your left.' }[nw.cur.id];
    AC.fact(ok ? 'Correct' : 'It was: ' + nw.cur.label, why, { color: ok ? 'var(--green)' : 'var(--amber)', tag: 'Night watch', ms: 6000 });
    nw.round++;
    nwApi.progress(nw.round / 8, 'Score ' + nw.score + ' / ' + nw.round);
    setTimeout(() => {
      if (!nwPanel) return;
      if (nw.round >= 8) {
        if (nw.score >= 5) nwApi.win(nw.score === 8 ? 3 : nw.score >= 6 ? 2 : 1, 'You identified ' + nw.score + ' of 8 aircraft from their lights alone.');
        else nwApi.fail('Only ' + nw.score + ' of 8 correct. Remember: red = left (port), green = right (starboard), white = tail.');
      } else nightRound();
    }, 1700);
  }
  function endNight() { if (nwPanel) nwPanel.el.remove(); nwPanel = null; nwApi = null; }

  // ---------------------------------------------------------------- HUD + cameras
  let hud = null;
  function newHud() {
    if (hud) hud.el.remove();
    hud = AC.ui.hud();
    return hud;
  }
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 0.5, min: 0.15, max: 60, phi: 1.35, theta: 0 });
  let scenePreset = 'bench';
  function setScene(kind) {
    scenePreset = kind;
    room.visible = kind === 'bench' || kind === 'display';
    bench.visible = kind === 'bench';
    tunnel.visible = kind === 'tunnel';
    display.visible = kind === 'display';
    night.visible = kind === 'night';
    scene.background = new THREE.Color(kind === 'night' ? 0x03060d : 0x1b2433);
    lights.hemi.intensity = kind === 'night' ? 0.05 : 0.95;
    lights.sun.intensity = kind === 'night' ? 0 : 0.7;
    cgTag.visible = npTag.visible = kind === 'tunnel';
    oc.enabled = kind !== 'night';
    if (kind === 'bench') { oc.target.set(0, PIVOT_Y + 0.02, 0); oc.dist = 0.42; oc.phi = 1.38; oc.theta = 0; oc.min = 0.15; oc.max = 3; }
    if (kind === 'tunnel') { oc.target.set(0, 4.7, 0); oc.dist = 16; oc.phi = 1.45; oc.theta = Math.PI / 2; oc.min = 6; oc.max = 22; }
    if (kind === 'display') { oc.target.set(0, 2.6, 0); oc.dist = 17; oc.phi = 1.2; oc.theta = Math.PI + 0.7; oc.min = 8; oc.max = 40; }
  }

  // ---------------------------------------------------------------- control drill
  let drill = null;
  function buildDrill(api) {
    drill = { round: 0, wrong: 0, api, answered: false };
    const q = h('div', { class: 'q' });
    const opts = h('div', { class: 'opts' });
    drill.el = h('div', { class: 'choices ac-panel' }, q, opts);
    drill.q = q; drill.opts = opts;
    AC.root().appendChild(drill.el);
    drillRound();
  }
  function drillRound() {
    const typeA = drill.round % 2 === 0;
    const a = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    drill.cur = a; drill.typeA = typeA; drill.answered = false;
    drill.q.innerHTML = '';
    drill.opts.innerHTML = '';
    if (typeA) {
      drill.q.append(h('small', {}, 'Round ' + (drill.round + 1) + ' of 10 · pick the control'), 'Make the aircraft ' + a.motion.toUpperCase());
      ACTIONS.forEach((x) => { const b = h('button', { type: 'button' }, x.label); b.addEventListener('click', () => answerDrill(x === a, b, x)); drill.opts.appendChild(b); });
    } else {
      drill.q.append(h('small', {}, 'Round ' + (drill.round + 1) + ' of 10 · watch the surfaces'), 'What will the aircraft do?');
      ACTIONS.forEach((x) => { const b = h('button', { type: 'button' }, x.motion); b.addEventListener('click', () => answerDrill(x === a, b, x)); drill.opts.appendChild(b); });
      playAction(a, false);
      drill.replay = setInterval(() => { if (!drill || drill.answered) return; if (!anim) playAction(a, false); }, 2600);
    }
  }
  function answerDrill(ok, btn) {
    if (drill.answered) return;
    drill.answered = true;
    clearInterval(drill.replay);
    btn.classList.add(ok ? 'right' : 'wrong');
    const idx = ACTIONS.indexOf(drill.cur);
    drill.opts.children[idx].classList.add('right');
    if (!ok) drill.wrong++;
    ok ? AC.audio.good() : AC.audio.bad();
    playAction(drill.cur, true);
    const why = drill.cur.id.startsWith('ail') ? 'Ailerons move in opposite directions. The wing with the aileron DOWN gets more lift and rises.' : drill.cur.id.startsWith('el') ? 'The elevator on the tailplane changes the tail\'s lift. Tail pushed down = nose up.' : 'The rudder on the fin pushes the tail sideways, so the nose swings the other way.';
    if (!ok) AC.fact('Answer: ' + drill.cur.label + ' → ' + drill.cur.motion, why, { color: 'var(--amber)', tag: 'Control surfaces', ms: 6000 });
    drill.round++;
    drill.api.progress(drill.round / 10, 'Mistakes: ' + drill.wrong);
    setTimeout(() => {
      if (!drill) return;
      if (drill.round >= 10) drill.api.win(drill.wrong <= 1 ? 3 : drill.wrong <= 3 ? 2 : 1, '10 rounds with ' + drill.wrong + ' mistake' + (drill.wrong === 1 ? '' : 's') + '.');
      else drillRound();
    }, 2300);
  }
  function endDrill() { if (drill) { clearInterval(drill.replay); drill.el.remove(); } drill = null; }

  // ---------------------------------------------------------------- missions
  function cleanup() {
    endBalance(); endDrill(); endNight();
    tunApi = null;
    if (tun.panel) { tun.panel = null; }
    anim = null;
    ACTIONS.forEach((x) => x.set(0));
    motionG.rotation.set(0, 0, 0);
  }
  const missions = [
    {
      id: 'beam', title: 'Balance Beam', objective: 'Move the battery until the model balances on the pivot',
      story: 'This model aircraft sits on a pivot at 80 mm from the nose. The battery is in the wrong place, so it tips. Slide the battery until clockwise and anticlockwise turning effects are equal.',
      learn: [
        { t: 'Moment', p: 'A turning effect. The further from the pivot, the bigger it is.', f: 'Moment = force × distance' },
        { t: 'Principle of moments', p: 'Balanced when clockwise moments = anticlockwise moments.' },
        { t: 'Centre of gravity', p: 'The single point where all the weight seems to act.', f: 'x_CG = Σ(m·x) ÷ Σm' },
      ],
      controls: ['Drag the slider in the panel', 'Drag the view to look around, scroll to zoom'],
      proved: 'The model balances when its CG is right above the pivot. Battery 300 g at 40 mm, frame 200 g at 100 mm, camera 100 g at 160 mm: (12,000 + 20,000 + 16,000) ÷ 600 = 80 mm. That is the worked example from your handout.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Battery 300 g at 40 mm')),
      start(api) {
        cleanup();
        setScene('bench');
        startBalance(planeRig, [
          { name: 'Battery', kind: 'battery', g: 300, x: 140, movable: true },
          { name: 'Frame', kind: 'mark', g: 200, x: 100 },
          { name: 'Camera', kind: 'camera', g: 100, x: 160 },
        ], 80, (mm) => (mm - 80) / 1000, api, { min: 0, max: 200, step: 5, ref: 'the nose', target: 80, tol: 1.5, sideA: 'Nose side (anticlockwise)', sideB: 'Tail side (clockwise)', frontPositive: false });
      },
      update(dt) { updateBalance(dt); },
    },
    {
      id: 'drone', title: 'Drone CG', objective: 'Move the battery so the drone\'s CG is exactly at 0 mm',
      story: 'Week 3 engineering challenge: frame 250 g at the centre, battery 180 g, camera 60 g at +70 mm (front). A drone must balance at its centre or the flight controller fights it all the time.',
      learn: [
        { t: 'Set the origin', p: 'Positions are measured from the centre: + is towards the front, − towards the back.' },
        { t: 'Solve it', p: 'You need 180 × x + 60 × 70 = 0.', f: 'x = −4,200 ÷ 180 ≈ −23 mm' },
        { t: 'Why it matters', p: 'A front-heavy drone makes the front motors work harder all the time, which wastes battery.' },
      ],
      controls: ['Drag the slider in the panel'],
      proved: 'With the battery at about −23 mm the moments cancel: 180 × (−23.3) + 60 × 70 ≈ 0. Balanced drones fly longer because all four motors share the work.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('The principle of moments')),
      start(api) {
        cleanup();
        setScene('bench');
        startBalance(droneRig, [
          { name: 'Battery', kind: 'battery', g: 180, x: 20, movable: true, y: 0.05 },
          { name: 'Frame', kind: 'mark', g: 250, x: 0, y: 0.05 },
          { name: 'Camera', kind: 'camera', g: 60, x: 70, y: 0.03 },
        ], 0, (mm) => -mm / 1000, api, { min: -60, max: 60, step: 1, ref: 'the centre', target: 0, tol: 0.9, sideA: 'Front side', sideB: 'Rear side', frontPositive: true });
      },
      update(dt) { updateBalance(dt); },
    },
    {
      id: 'tunnel', title: 'Wind Tunnel', objective: 'Find a CG position that is stable AND controllable',
      story: 'Engineers test stability in a wind tunnel. The model pivots at its CG. Choose where the CG is (as % of the wing chord), then hit it with a gust and watch. The neutral point (green) is at 40%.',
      learn: [
        { t: 'Static stability', p: 'A stable aircraft that is disturbed returns to where it was by itself.' },
        { t: 'Static margin', p: 'How far the CG is ahead of the neutral point, as % of chord.', f: 'SM = NP − CG' },
        { t: 'The sweet spot', p: 'Too small: unstable. Too big: sluggish, hard to rotate. Aim for 5–15%.' },
      ],
      controls: ['Choose the CG in the panel', 'Press <b>Gust test</b>', 'Drag to look around'],
      proved: 'The CG must be ahead of the neutral point (positive static margin) for the aircraft to weathercock back after a gust. Fighter jets use negative margin on purpose and let fly-by-wire computers keep them flying.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('If the CG is BEHIND')),
      start(api) {
        cleanup();
        setScene('tunnel');
        tunApi = api;
        tun.cg = 50; tun.theta = 0; tun.omega = 0; tun.running = 0; tun.tests = 0; tun.trace = [];
        layoutTunnel();
        newHud();
        const out = h('output', {}, tun.cg + '% of chord');
        const sl = h('input', { type: 'range', id: 'cgp', min: 10, max: 60, step: 5, value: tun.cg });
        sl.addEventListener('input', () => { if (tun.running > 0) return; tun.cg = +sl.value; out.textContent = tun.cg + '% of chord'; tun.theta = 0; layoutTunnel(); });
        hud.section('Centre of gravity').add(h('div', { class: 'ac-field' }, h('label', { for: 'cgp' }, 'CG from the leading edge', out), sl));
        hud.row('np', 'Neutral point').row('sm', 'Static margin');
        const btn = h('button', { class: 'ac-btn', type: 'button', style: { width: '100%', marginTop: '6px' } }, 'Gust test');
        btn.addEventListener('click', startGust);
        hud.add(btn);
        hud.section('Pitch after the gust (°)');
        gustGraph = new AC.Graph(hud.canvas('gust'), { xMin: 0, xMax: 5, yMin: -40, yMax: 40, xLabel: 't (s)', yLabel: 'θ', xTicks: 5, yTicks: 4 });
      },
      update(dt, api) {
        const SM = NP_PCT - tun.cg;
        hud.set('np', NP_PCT + '% of chord', 'cyan');
        hud.set('sm', SM + '%', SM < 0 ? 'bad' : SM < 5 || SM > 15 ? 'warn' : '');
        gustGraph.draw({ series: [{ pts: tun.trace, color: AC.css('--magenta') }], hlines: [{ y: 0, color: AC.css('--dim') }] });
        api.progress(tun.running > 0 ? 1 - tun.running / 5 : 0, tun.running > 0 ? 'Gust test running' : 'Tests run: ' + tun.tests);
      },
    },
    {
      id: 'controls', title: 'Control Surfaces', objective: 'Get 10 control-surface rounds right',
      story: 'Every aircraft is steered by three sets of hinged surfaces. Round one: pick the surface that makes the move. Round two: watch the surfaces and predict the move. Alternate for 10 rounds.',
      learn: [
        { t: 'Ailerons → roll', p: 'On the wing tips, moving opposite ways. Longitudinal axis.' },
        { t: 'Elevator → pitch', p: 'On the tailplane. Lateral axis. Elevator up = nose up.' },
        { t: 'Rudder → yaw', p: 'On the fin. Vertical axis. Rudder left = nose left.' },
      ],
      controls: ['Click an answer in the panel', 'Drag to look around'],
      proved: 'A deflected surface changes the local camber, so it changes the lift on that surface. Lift × distance to the CG = a turning moment. All three axes turn about the CG.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Which control surface controls YAW')),
      start(api) {
        cleanup();
        setScene('display');
        newHud().section('Axes').row('a1', 'Roll', 'ailerons').row('a2', 'Pitch', 'elevator').row('a3', 'Yaw', 'rudder');
        hud.formula('adv', 'Adverse yaw: the down-going aileron makes more drag, so the nose yaws away from the turn. Pilots add rudder.');
        buildDrill(api);
      },
      update(dt) { animStep(dt); },
    },
    {
      id: 'night', title: 'Night Watch', objective: 'Identify 8 aircraft from their navigation lights',
      story: 'It is night at Entebbe. You can only see the aircraft\'s lights. Red is always on the LEFT (port) wing tip, green on the RIGHT (starboard), white on the tail. Work out which way each aircraft is flying.',
      learn: [
        { t: 'Red = port', p: 'Left wing tip. Visible from in front and on the left side.' },
        { t: 'Green = starboard', p: 'Right wing tip. Visible from in front and on the right side.' },
        { t: 'White = tail', p: 'Only visible from behind. Flashing white = anti-collision strobe.' },
      ],
      controls: ['Watch the lights, then click an answer'],
      proved: 'Pilots read lights like a code. Red and green together means the aircraft is heading towards you. One colour means it is crossing. White only means it is flying away. That is the ICAO convention from your Week 3 handout.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('At night you see')),
      start(api) {
        cleanup();
        setScene('night');
        newHud().section('Light code').row('r', 'Red', 'port (left)').row('g', 'Green', 'starboard (right)').row('w', 'White', 'tail');
        hud.set('r', 'port (left)', 'bad'); hud.set('g', 'starboard (right)', ''); hud.set('w', 'tail', 'cyan');
        camera.position.set(0, 1.7, 0);
        camera.lookAt(0, 160, 800);
        buildNight(api);
      },
      update(dt) {
        nightPlane.position.addScaledVector(nw.vel, dt);
        navVisibility();
      },
    },
  ];
  const MR = AC.missions({ game: 'stab', week: 3, list: missions });

  function help() {
    AC.ui.card({
      eyebrow: 'Week 3', title: 'Stability Hangar',
      body: [
        'Five experiments about balance and control. Use the panel on the right for sliders and calculations. Drag the 3D view to look around and scroll to zoom.',
        AC.ui.learnGrid([
          { t: 'Orange arrows', p: 'Weights of each part.' },
          { t: 'Green arrow', p: 'The push of the pivot holding everything up.' },
          { t: 'Pink dot', p: 'Centre of gravity (CG).' },
        ]),
      ],
    });
  }
  AC.ui.hint('Drag to look around · scroll or pinch to zoom');

  S.onFrame((dt, t) => {
    MR.update(dt);
    if (scenePreset === 'tunnel') tunnelStep(dt, t);
    if (scenePreset !== 'night') oc.update(dt);
  });
  setScene('bench');
  S.start();
  MR.begin();
})();
