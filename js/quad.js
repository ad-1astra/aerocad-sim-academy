/* Quad Pilot — Week 4 · Propulsion & Multirotors
   Real rigid-body quadcopter: four motor thrusts, torques from arm positions, reaction torque
   from spin direction, and a flight-controller mixer exactly as in the Week 4 handout. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  const V3 = THREE.Vector3;

  AC.boot({ game: 'quad', week: 4, topic: 'Propulsion & Multirotors', title: 'Quad Pilot', help: () => help() });

  // ---------------------------------------------------------------- world
  const S = AC.scene({ fov: 62, near: 0.02, far: 2500, shadows: true });
  const { scene, camera, renderer } = S;
  const sky = AC.skyDome(scene, 0x2c78c8, 0xd6ecf7, 0x5b7a4a);
  scene.fog = new THREE.Fog(0xcfe6f2, 80, 700);
  const lights = AC.lights(scene, { shadows: true, shadowSize: 20, dir: [30, 60, 20] });
  AC.models.field(scene, 900);

  const LAKE = { x: 0, z: 72, r: 30 };
  const ISLAND = { x: 0, z: 78, r: 7, top: 0.3 };
  const water = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r, 64), new THREE.MeshStandardMaterial({ color: 0x2f6f9a, roughness: 0.12, metalness: 0.35 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(LAKE.x, 0.03, LAKE.z);
  water.receiveShadow = true;
  scene.add(water);
  const island = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND.r, ISLAND.r + 1.2, ISLAND.top, 40), AC.models.mat(0xcdb886));
  island.position.set(ISLAND.x, ISLAND.top / 2, ISLAND.z);
  island.receiveShadow = true;
  scene.add(island);
  const clinicPad = AC.models.pad('+', 0xff5a4f, 1.1);
  clinicPad.position.set(ISLAND.x, ISLAND.top, ISLAND.z);
  scene.add(clinicPad);
  const clinic = new THREE.Group();
  AC.models.mesh(new THREE.BoxGeometry(3, 2.2, 2.4), AC.models.mat(0xf2f5f8), 0, 1.1, 0, clinic);
  AC.models.mesh(new THREE.BoxGeometry(0.5, 1.4, 0.06), AC.models.mat(0xd8332a), 0, 1.2, 1.23, clinic);
  AC.models.mesh(new THREE.BoxGeometry(1.4, 0.5, 0.06), AC.models.mat(0xd8332a), 0, 1.2, 1.23, clinic);
  clinic.position.set(3.8, ISLAND.top, ISLAND.z + 2.6);
  clinic.rotation.y = Math.PI;
  scene.add(clinic);
  const startPad = AC.models.pad('H', 0xffb547, 1.1);
  scene.add(startPad);

  // trees
  (function trees() {
    const n = 400;
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 7, 7), AC.models.mat(0x2f5f2a), n);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 6), AC.models.mat(0x5a3f28), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3();
    let k = 0;
    for (let i = 0; i < 3000 && k < n; i++) {
      const x = AC.rand(-300, 300), z = AC.rand(-300, 300);
      if (Math.abs(x) < 50 && z > -25 && z < 115) continue;
      const sc = AC.rand(0.7, 1.6);
      s.set(sc, sc, sc);
      p.set(x, 2 * sc + 3.5 * sc, z); m4.compose(p, q, s); crown.setMatrixAt(k, m4);
      p.set(x, 1 * sc, z); m4.compose(p, q, s); trunk.setMatrixAt(k, m4);
      k++;
    }
    crown.count = trunk.count = k;
    crown.castShadow = true;
    scene.add(crown, trunk);
  })();

  // drone
  const drone = AC.models.quad({ arm: 0.225 });
  drone.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(drone);
  const ud = drone.userData;
  const MOTOR_NAME = ['M1', 'M2', 'M3', 'M4'];
  const MOTOR_POS = ['front-left', 'front-right', 'rear-right', 'rear-left'];

  // medicine payload box
  const payloadBox = new THREE.Group();
  AC.models.mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), AC.models.mat(0xf2f5f8), 0, 0, 0, payloadBox);
  AC.models.mesh(new THREE.BoxGeometry(0.03, 0.101, 0.09), AC.models.mat(0xd8332a), 0, 0, 0, payloadBox);
  AC.models.mesh(new THREE.BoxGeometry(0.09, 0.101, 0.03), AC.models.mat(0xd8332a), 0, 0, 0, payloadBox);
  payloadBox.position.y = -0.1;
  payloadBox.visible = false;
  drone.add(payloadBox);

  // test stand (Motor Lab)
  const stand = new THREE.Group();
  AC.models.mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.06, 24), AC.models.mat(0x3a4552), 0, 0.03, 0, stand);
  AC.models.mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.12, 10), AC.models.mat(0x9aa7b4, { metalness: 0.7 }), 0, 0.6, 0, stand);
  AC.models.mesh(new THREE.SphereGeometry(0.035, 14, 10), AC.models.mat(0xffb547), 0, 1.18, 0, stand);
  stand.visible = false;
  scene.add(stand);
  const STAND_Y = 1.22;

  // hover zone (2–4 m above the start pad)
  const zone = new THREE.Group();
  zone.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 2, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0xff70d8, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })));
  for (const y of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(3, 0.03, 6, 64), new THREE.MeshBasicMaterial({ color: 0xff70d8 })); r.rotation.x = Math.PI / 2; r.position.y = y; zone.add(r); }
  zone.position.y = 3;
  zone.visible = false;
  scene.add(zone);

  // rings course
  const RING_R = 0.9;
  const RING_PTS = [[0, 2.5, 12], [7, 4, 24], [17, 5.5, 30], [27, 3, 24], [29, 2, 10], [18, 6, 1]];
  const rings = RING_PTS.map((p, i) => {
    const g = new THREE.Group();
    const ring = AC.models.ring(RING_R, 0.07, 0xff70d8);
    g.add(ring);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, p[1] - RING_R, 6), AC.models.mat(0x9aa7b4));
    pole.position.y = -(RING_R + (p[1] - RING_R) / 2);
    g.add(pole);
    g.position.set(...p);
    const prev = i ? RING_PTS[i - 1] : [0, 1, 0];
    g.lookAt(new V3(p[0] + (p[0] - prev[0]), p[1], p[2] + (p[2] - prev[2])));
    pole.rotation.x = 0;
    g.visible = false;
    scene.add(g);
    return { g, ring };
  });

  // ---------------------------------------------------------------- physics
  const IXX = 0.012, IYY = 0.022, IZZ = 0.012; // kg·m²
  const KQ = 0.02;      // reaction torque per newton of thrust (m)
  const CD = 0.06;      // body drag coefficient
  const CLR = 0.075;    // leg clearance
  const STAND_K = 1.3;  // stand spring (N·m/rad)
  const DEFAULT = { name: 'Team drone (Week 4 challenge)', massG: 780, thrustG: 400, kv: 2300, prop: '5045', parts: 'Frame + electronics 450 g · battery 180 g · camera 150 g' };
  const P = {
    pos: new V3(0, CLR, 0), vel: new V3(), q: new THREE.Quaternion(), w: new V3(),
    T: [0, 0, 0, 0], cmd: [0, 0, 0, 0], mass: 0.78, payload: 0, tmax: 3.924, design: DEFAULT,
    mode: 'althold', throttle: 0, onGround: true, crashed: false, lastImpact: 0, sumT: 0,
  };
  const eul = new THREE.Euler(0, 0, 0, 'YXZ'), up = new V3(), acc = new V3(), tmp = new V3(), dq = new THREE.Quaternion();

  function setDesign(d) {
    P.design = d;
    P.mass = d.massG / 1000;
    P.tmax = (d.thrustG * AC.G) / 1000;
  }
  function groundAt(x, z) { return Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r ? ISLAND.top : 0; }
  function overWater(x, z) { return Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r && Math.hypot(x - ISLAND.x, z - ISLAND.z) >= ISLAND.r; }
  function resetDrone(x = 0, z = 0, yaw = 0, y) {
    P.pos.set(x, y != null ? y : groundAt(x, z) + CLR, z);
    P.vel.set(0, 0, 0);
    P.w.set(0, 0, 0);
    P.q.setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
    P.T = [0, 0, 0, 0]; P.cmd = [0, 0, 0, 0];
    P.throttle = 0; P.crashed = false; P.onGround = true; P.lastImpact = 0;
    LS.set(0, P.mode === 'manual' ? -1 : 0);
    camera._chaseInit = false;
  }
  function setMode(m) {
    P.mode = m;
    LS.opts.springY = m !== 'manual';
    LS.set(0, m === 'manual' ? -1 : 0);
  }
  function integrateQ(dt) {
    const wl = P.w.length();
    if (wl > 1e-7) {
      dq.setFromAxisAngle(tmp.copy(P.w).divideScalar(wl), wl * dt);
      P.q.multiply(dq).normalize();
    }
  }

  // flight controller: angle mode + mixer (Week 4 handout rules)
  function controller(inp) {
    eul.setFromQuaternion(P.q, 'YXZ');
    up.set(0, 1, 0).applyQuaternion(P.q);
    const m = P.mass + P.payload, Tm = P.tmax;
    let total;
    if (P.mode === 'manual') total = inp.thr * 4 * Tm;
    else {
      total = (m * (AC.G + 3.5 * (inp.climb * 3 - P.vel.y))) / Math.max(0.6, up.y);
      if (P.onGround && inp.climb <= 0.05) total = 0;
    }
    total = clamp(total, 0, 4 * Tm);
    if (total < 0.05 * Tm) {
      for (let i = 0; i < 4; i++) P.cmd[i] = 0.03 * Tm; // armed idle
      return;
    }
    const base = total / 4;
    const A = Math.abs(ud.pos[0].x);
    const pd = AC.rad(28) * inp.pitch, rd = AC.rad(28) * inp.roll;
    const tx = IXX * (55 * (pd - eul.x) - 11 * P.w.x);
    const tz = IZZ * (55 * (rd - eul.z) - 11 * P.w.z);
    const ty = IYY * 6 * (-inp.yaw * 2.2 - P.w.y);
    const d = tx / (4 * A), e = tz / (4 * A), f = clamp(ty / (4 * KQ), -0.3 * Tm, 0.3 * Tm);
    for (let i = 0; i < 4; i++) {
      const p = ud.pos[i];
      // pitch: rear up for nose-down · roll: left up for roll-right · yaw: CW pair up turns the frame left
      P.cmd[i] = clamp(base - Math.sign(p.z) * d + Math.sign(p.x) * e + ud.spinDir[i] * f, 0, Tm);
    }
  }

  function step(dt) {
    for (let i = 0; i < 4; i++) P.T[i] += (P.cmd[i] - P.T[i]) * (1 - Math.exp(-dt / 0.035));
    let tx = 0, ty = 0, tz = 0, sum = 0;
    for (let i = 0; i < 4; i++) {
      const T = P.T[i], p = ud.pos[i];
      tx += -p.z * T;           // front motors push the nose up
      tz += p.x * T;            // left motors roll the drone right
      ty += KQ * ud.spinDir[i] * T; // CW prop twists the frame anticlockwise
      sum += T;
    }
    P.sumT = sum;
    if (P.mode === 'lab') {
      eul.setFromQuaternion(P.q, 'YXZ');
      tx -= STAND_K * eul.x;
      tz -= STAND_K * eul.z;
      P.w.x += (tx / IXX - 6 * P.w.x) * dt;
      P.w.z += (tz / IZZ - 6 * P.w.z) * dt;
      P.w.y += (ty / IYY - 1.2 * P.w.y) * dt;
      integrateQ(dt);
      eul.setFromQuaternion(P.q, 'YXZ');
      const lim = AC.rad(26);
      if (Math.abs(eul.x) > lim || Math.abs(eul.z) > lim) {
        eul.x = clamp(eul.x, -lim, lim); eul.z = clamp(eul.z, -lim, lim);
        P.q.setFromEuler(eul);
        P.w.x *= 0.5; P.w.z *= 0.5;
      }
      P.pos.set(0, STAND_Y, 0);
      return;
    }
    P.w.x += (tx / IXX - 0.4 * P.w.x) * dt;
    P.w.y += (ty / IYY - 0.4 * P.w.y) * dt;
    P.w.z += (tz / IZZ - 0.4 * P.w.z) * dt;
    integrateQ(dt);
    up.set(0, 1, 0).applyQuaternion(P.q);
    const m = P.mass + P.payload;
    acc.copy(up).multiplyScalar(sum / m);
    acc.y -= AC.G;
    const sp = P.vel.length();
    acc.addScaledVector(P.vel, (-CD * sp) / m);
    P.vel.addScaledVector(acc, dt);
    P.pos.addScaledVector(P.vel, dt);
    const gy = groundAt(P.pos.x, P.pos.z) + CLR;
    if (P.pos.y <= gy) {
      const impact = -P.vel.y;
      const tilt = Math.acos(clamp(up.y, -1, 1));
      if (!P.onGround) P.lastImpact = impact;
      if (impact > 3 || tilt > 1.05) return crash(impact > 3 ? 'The drone hit the ground at ' + impact.toFixed(1) + ' m/s.' : 'The drone tipped over and the props hit the ground.');
      P.pos.y = gy;
      if (P.vel.y < 0) P.vel.y = 0;
      P.vel.x *= Math.exp(-8 * dt);
      P.vel.z *= Math.exp(-8 * dt);
      P.onGround = true;
      eul.setFromQuaternion(P.q, 'YXZ');
      eul.x *= Math.exp(-10 * dt); eul.z *= Math.exp(-10 * dt);
      P.q.setFromEuler(eul);
      P.w.x *= Math.exp(-10 * dt); P.w.z *= Math.exp(-10 * dt); P.w.y *= Math.exp(-6 * dt);
    } else if (P.pos.y > gy + 0.03) P.onGround = false;
    if (overWater(P.pos.x, P.pos.z) && P.pos.y < 0.15) crash('Splash! The drone fell into Lake Victoria.');
    if (P.pos.y > 120) { P.pos.y = 120; P.vel.y = Math.min(P.vel.y, 0); }
  }

  let crashTimer = 0, crashMsg = '';
  function crash(msg) {
    if (P.crashed) return;
    P.crashed = true;
    crashMsg = msg;
    crashTimer = 1.3;
    P.cmd = [0, 0, 0, 0]; P.T = [0, 0, 0, 0];
    AC.audio.boom();
    AC.ui.toast('CRASH', 'var(--red)');
  }

  // ---------------------------------------------------------------- input
  const LS = AC.touch.stick('l', 'THROTTLE · YAW', { springY: true });
  const RS = AC.touch.stick('r', 'PITCH · ROLL');
  function readInput(dt) {
    const yaw = AC.axis(['KeyA'], ['KeyD'], LS.x);
    const pitch = AC.axis(['ArrowDown'], ['ArrowUp'], RS.y);
    const roll = AC.axis(['ArrowLeft'], ['ArrowRight'], RS.x);
    if (P.mode === 'manual') {
      P.throttle = clamp(P.throttle + AC.axis(['KeyS'], ['KeyW']) * 0.3 * dt, 0, 1);
      if (LS.active) P.throttle = (LS.y + 1) / 2;
    }
    const climb = AC.axis(['KeyS'], ['KeyW'], LS.y);
    return { thr: P.throttle, climb, pitch, roll, yaw };
  }

  // ---------------------------------------------------------------- visuals: arrows, tags, sound
  const motorArrows = [0, 1, 2, 3].map(() => new AC.Arrow(scene, 0x3fd0f0, { width: 0.006 }));
  const wArrow = new AC.Arrow(scene, 0xffb547, { width: 0.012 });
  const tArrow = new AC.Arrow(scene, 0x3fd0f0, { width: 0.012 });
  const wTag = S.tag('W', 'var(--amber)');
  const tTag = S.tag('T', 'var(--cyan)');
  const ringTag = S.tag('NEXT', 'var(--magenta)');
  const padTag = S.tag('CLINIC', 'var(--red)');
  ringTag.visible = padTag.visible = false;
  let showForces = true;
  const hum = AC.audio.makeHum('sawtooth', 110);
  const ARROW_SCALE = 0.045; // metres per newton
  const mw = new V3();

  function visuals(dt) {
    drone.position.copy(P.pos);
    drone.quaternion.copy(P.q);
    if (P.crashed) { drone.rotation.z = 1.2; drone.position.y = Math.max(CLR, groundAt(P.pos.x, P.pos.z) + 0.1); }
    let avg = 0;
    for (let i = 0; i < 4; i++) {
      const u = P.T[i] / P.tmax;
      avg += u / 4;
      const prop = ud.props[i];
      prop.rotation.y -= ud.spinDir[i] * (u > 0.01 ? 30 + 70 * u : 0) * dt;
      prop.children[0].visible = u < 0.12;
      ud.discs[i].material.opacity = u > 0.1 ? 0.12 + 0.3 * u : 0;
    }
    hum.set(P.crashed ? 0 : avg, 0.8 + avg * 1.6);
    up.set(0, 1, 0).applyQuaternion(P.q);
    const m = P.mass + P.payload;
    if (showForces && !P.crashed) {
      for (let i = 0; i < 4; i++) {
        mw.copy(ud.pos[i]).applyQuaternion(P.q).add(P.pos);
        motorArrows[i].set(mw, tmp.copy(up).multiplyScalar(P.T[i]), ARROW_SCALE);
      }
      wArrow.set(P.pos, tmp.set(0, -m * AC.G, 0), ARROW_SCALE);
      tArrow.set(P.pos, tmp.copy(up).multiplyScalar(P.sumT), ARROW_SCALE);
      wTag.visible = tTag.visible = true;
      wTag.pos.copy(wArrow.tip); wTag.set('W = ' + AC.fmt(m * AC.G, 1) + ' N');
      tTag.pos.copy(tArrow.tip || P.pos); tTag.set('T = ' + AC.fmt(P.sumT, 1) + ' N');
      if (!tArrow.group.visible) tTag.visible = false;
    } else {
      motorArrows.forEach((a) => a.hide()); wArrow.hide(); tArrow.hide();
      wTag.visible = tTag.visible = false;
    }
    sky.position.copy(camera.position);
    lights.sun.position.set(P.pos.x + 20, P.pos.y + 40, P.pos.z + 12);
    lights.sun.target.position.copy(P.pos);
  }

  // camera: chase / orbit / top
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 2.2, min: 0.6, max: 40, phi: 1.15, theta: Math.PI });
  const CAMS = ['Chase', 'Orbit', 'Top-down'];
  let camMode = 0;
  const chaseOff = new V3(0, 0.42, -1.35);
  function cameraUpdate(dt) {
    if (P.mode === 'lab') {
      oc.target.set(0, STAND_Y - 0.22, 0);
      oc.update(dt);
      return;
    }
    if (camMode === 0) AC.chase(camera, P.pos, P.q, chaseOff, 3, 5, dt || 0.016, true);
    else if (camMode === 1) { oc.target.copy(P.pos); oc.update(dt); }
    else { camera.position.set(P.pos.x, P.pos.y + 9, P.pos.z - 0.01); camera.lookAt(P.pos); }
  }
  function cycleCam() { camMode = (camMode + 1) % 3; camera._chaseInit = false; AC.ui.toast(CAMS[camMode] + ' camera', 'var(--cyan)'); }

  // ---------------------------------------------------------------- HUD
  const hud = AC.ui.hud();
  hud.section('Flight').row('mode', 'Mode').row('alt', 'Altitude').row('vs', 'Climb rate').row('spd', 'Speed').row('hdg', 'Heading');
  hud.section('Thrust vs weight').row('w', 'Weight').row('tmax', 'Max thrust').row('tw', 'T/W ratio').row('thr', 'Throttle').row('hov', 'Hover throttle').meter('tnow');
  hud.formula('f', '');
  hud.section('Motors · top view');
  const mgrid = h('div', { class: 'mgrid' });
  const mcells = [];
  [0, 1, 3, 2].forEach((i) => {
    const bar = h('i', { style: { background: ud.spinDir[i] > 0 ? 'var(--amber)' : 'var(--cyan)' } });
    const pct = h('em', {}, '0%');
    const cell = h('div', { class: 'mcell' }, bar, h('b', { style: { color: ud.spinDir[i] > 0 ? 'var(--amber)' : 'var(--cyan)' } }, MOTOR_NAME[i], pct), h('span', {}, (ud.spinDir[i] > 0 ? 'CW · ' : 'CCW · ') + MOTOR_POS[i]));
    mcells[i] = { bar, pct };
    mgrid.appendChild(cell);
  });
  hud.add(h('div', { class: 'dim mono', style: { fontSize: '0.64rem', textAlign: 'center', color: 'var(--red)' } }, '▲ FRONT'));
  hud.add(mgrid);
  hud.formula('rpm', '');

  function hudUpdate() {
    const m = P.mass + P.payload;
    const massG = m * 1000, maxG = (P.tmax * 4 * 1000) / AC.G;
    const tw = maxG / massG;
    const alt = P.pos.y - CLR - groundAt(P.pos.x, P.pos.z);
    eul.setFromQuaternion(P.q, 'YXZ');
    hud.set('mode', { manual: 'Manual throttle', althold: 'Altitude hold', lab: 'Test stand' }[P.mode], 'cyan');
    hud.set('alt', AC.fmt(Math.max(0, alt), 1) + ' m');
    hud.set('vs', AC.fmt(P.vel.y, 1) + ' m/s');
    hud.set('spd', AC.fmt(Math.hypot(P.vel.x, P.vel.z), 1) + ' m/s');
    hud.set('hdg', String(Math.round(((-AC.deg(eul.y) % 360) + 360) % 360)).padStart(3, '0') + '°');
    hud.set('w', AC.fmt(massG) + ' g · ' + AC.fmt(m * AC.G, 1) + ' N');
    hud.set('tmax', AC.fmt(maxG) + ' g');
    hud.set('tw', AC.fmt(tw, 2) + ' : 1', tw < 1 ? 'bad' : tw < 2 ? 'warn' : '');
    const thr = P.sumT / (4 * P.tmax);
    hud.set('thr', AC.fmt(thr * 100) + ' %', 'cyan');
    hud.set('hov', AC.fmt(Math.min(100, (100 * massG) / maxG)) + ' %', 'mag');
    const ratio = P.sumT / (m * AC.G);
    hud.setMeter('tnow', ratio / 2, Math.abs(ratio - 1) < 0.05 ? 'var(--green)' : ratio > 1 ? 'var(--cyan)' : 'var(--amber)');
    hud.setFormula('f', 'T/W = ' + AC.fmt(maxG) + ' g ÷ ' + AC.fmt(massG) + ' g = ' + AC.fmt(tw, 2) + '\nNow: thrust ÷ weight = ' + AC.fmt(ratio, 2));
    for (let i = 0; i < 4; i++) {
      const u = P.T[i] / P.tmax;
      mcells[i].bar.style.height = clamp(u, 0, 1) * 100 + '%';
      mcells[i].pct.textContent = Math.round(u * 100) + '%';
    }
    const kv = P.design.kv || 2300;
    hud.setFormula('rpm', 'Unloaded rpm = KV × V\n' + AC.fmt(kv) + ' × 11.1 V = ' + AC.fmt(kv * 11.1) + ' rpm\n3S LiPo = 3 × 3.7 V = 11.1 V');
  }

  // ---------------------------------------------------------------- learning moments
  const seen = new Set();
  function once(key, title, text) {
    if (seen.has(key)) return;
    seen.add(key);
    AC.fact(title, text);
  }
  function teach(inp) {
    if (P.mode === 'lab' || P.crashed) return;
    if (!P.onGround && P.pos.y > 0.6) once('lift', 'Lift-off', 'Total thrust became bigger than weight, so the drone accelerates up. That is Newton\'s 2nd law: F = m × a.');
    if (inp.pitch > 0.6) once('pf', 'Watch the motor bars', 'Pitching forward: the rear motors M3 and M4 spin faster than the front motors M1 and M2.');
    if (inp.pitch < -0.6) once('pb', 'Watch the motor bars', 'Pitching back: the front motors M1 and M2 spin faster than the rear pair.');
    if (inp.roll > 0.6) once('rr', 'Rolling right', 'The left pair (M1, M4) speeds up and the right pair (M2, M3) slows down.');
    if (inp.roll < -0.6) once('rl', 'Rolling left', 'The right pair (M2, M3) speeds up and the left pair (M1, M4) slows down.');
    if (inp.yaw > 0.6) once('yr', 'Yawing right', 'The CCW pair (M2, M4) speeds up and the CW pair (M1, M3) slows down. The props\' reaction torque twists the frame.');
    if (inp.yaw < -0.6) once('yl', 'Yawing left', 'The CW pair (M1, M3) speeds up. Each prop twists the frame the opposite way to its spin.');
    if (Math.hypot(P.vel.x, P.vel.z) > 5) once('tilt', 'Tilted thrust', 'When the drone tilts, part of the thrust pushes it sideways and less holds it up. The flight controller adds throttle so it does not sink.');
  }

  // ---------------------------------------------------------------- Motor Lab (mission 1)
  const LAB_TASKS = [
    { name: 'CLIMB: push straight up, no tilting', want: [1, 1, 1, 1], why: 'All four motors faster means more total thrust. Two CW and two CCW still cancel, so it does not spin.' },
    { name: 'PITCH FORWARD: dip the nose', want: [0, 0, 1, 1], why: 'The rear pair (M3, M4) pushes harder, so the back rises and the nose dips. M3 is CW and M4 is CCW, so their twists still cancel.' },
    { name: 'ROLL RIGHT: dip the right side', want: [1, 0, 0, 1], why: 'The left pair (M1, M4) pushes harder, so the left lifts and the drone rolls right.' },
    { name: 'YAW RIGHT: turn clockwise on the spot', want: [0, 1, 0, 1], why: 'The CCW pair (M2, M4) spins faster. Each CCW prop twists the frame clockwise, so the drone yaws right with no tilt.' },
  ];
  let lab = null;
  function buildLab(api) {
    destroyLab();
    lab = { task: 0, sel: [0, 0, 0, 0], wrong: 0, testing: 0, api };
    const taskEl = h('div', { class: 'task' });
    const pick = h('div', { class: 'pick' });
    const btns = [];
    [0, 1, 3, 2].forEach((i) => {
      const st = h('span', { class: 'st' }, 'LOW');
      const b = h('button', { type: 'button' }, st, h('b', { style: { color: ud.spinDir[i] > 0 ? 'var(--amber)' : 'var(--cyan)' } }, MOTOR_NAME[i]), h('br'), MOTOR_POS[i] + ' · ' + (ud.spinDir[i] > 0 ? 'CW' : 'CCW'));
      b.addEventListener('click', () => {
        if (lab.testing) return;
        lab.sel[i] = lab.sel[i] ? 0 : 1;
        b.classList.toggle('hi', !!lab.sel[i]);
        st.textContent = lab.sel[i] ? 'HIGH' : 'LOW';
        AC.audio.click();
        idleStand();
      });
      btns[i] = { b, st };
      pick.appendChild(b);
    });
    const go = h('button', { class: 'ac-btn', type: 'button' }, 'Spin up & test');
    go.addEventListener('click', () => {
      if (lab.testing) return;
      if (!lab.sel.some(Boolean)) { AC.ui.toast('Pick at least one motor', 'var(--amber)'); return; }
      lab.testing = 2.4;
      for (let i = 0; i < 4; i++) P.cmd[i] = (lab.sel[i] ? 0.72 : 0.36) * P.tmax;
      AC.audio.whoosh();
    });
    lab.panel = h('div', { class: 'lab ac-panel' }, taskEl, h('div', { class: 'front' }, '▲ FRONT OF DRONE ▲'), pick, go);
    lab.taskEl = taskEl;
    lab.btns = btns;
    AC.root().appendChild(lab.panel);
    showTask();
  }
  function idleStand() { for (let i = 0; i < 4; i++) P.cmd[i] = 0; }
  function showTask() {
    const t = LAB_TASKS[lab.task];
    lab.taskEl.innerHTML = '';
    lab.taskEl.append(h('small', {}, 'Test ' + (lab.task + 1) + ' of ' + LAB_TASKS.length), t.name);
    lab.sel = [0, 0, 0, 0];
    lab.btns.forEach((x) => { x.b.classList.remove('hi'); x.st.textContent = 'LOW'; });
    lab.api.progress(lab.task / LAB_TASKS.length);
    lab.api.objective('Motor Lab: ' + t.name.split(':')[0].toLowerCase());
  }
  function evaluateLab() {
    const t = LAB_TASKS[lab.task];
    eul.setFromQuaternion(P.q, 'YXZ');
    const p = AC.deg(eul.x), r = AC.deg(eul.z), yr = P.w.y;
    const obs = [];
    if (p > 6) obs.push('the nose dipped (pitch forward)'); else if (p < -6) obs.push('the nose lifted (pitch back)');
    if (r > 6) obs.push('it rolled right'); else if (r < -6) obs.push('it rolled left');
    if (yr < -0.4) obs.push('it yawed right'); else if (yr > 0.4) obs.push('it yawed left');
    if (!obs.length) obs.push(lab.sel.every(Boolean) ? 'it pushed up harder on the stand with no tilt' : 'it stayed level');
    const ok = t.want.every((v, i) => v === lab.sel[i]);
    idleStand();
    if (ok) {
      AC.audio.good();
      AC.ui.toast('CORRECT', 'var(--green)');
      AC.fact(t.name.split(':')[0], t.why, { tag: 'You found it' });
      lab.task++;
      if (lab.task >= LAB_TASKS.length) {
        const stars = lab.wrong <= 1 ? 3 : lab.wrong <= 3 ? 2 : 1;
        setTimeout(() => lab && lab.api.win(stars, 'You solved all four motor puzzles with ' + lab.wrong + ' wrong tries.'), 900);
      } else setTimeout(() => lab && showTask(), 1200);
    } else {
      lab.wrong++;
      AC.audio.bad();
      AC.ui.toast('NOT YET', 'var(--amber)');
      AC.fact('What happened', 'With those motors on HIGH, ' + obs.join(' and ') + '. Hint: ' + hintFor(lab.task), { tag: 'Test result', color: 'var(--amber)' });
    }
  }
  function hintFor(i) {
    return ['Which motors make MORE total thrust without tilting?', 'The back of the drone must push harder than the front.', 'To dip the right side, lift the left side.', 'Use the reaction torque. Which spin direction twists the frame clockwise?'][i];
  }
  function destroyLab() {
    if (lab && lab.panel) lab.panel.remove();
    lab = null;
  }

  // ---------------------------------------------------------------- Drone Designer (mission 5)
  const PARTS = {
    frame: [
      { id: 'f250', name: '250 race frame', g: 220, maxProp: 5, note: '220 g · fits 5-inch props' },
      { id: 'f450', name: '450 camera frame', g: 350, maxProp: 10, note: '350 g · fits 10-inch props' },
    ],
    motor: [
      { id: 'm1806', name: '1806 · 2300 KV', thrust: 300, imax: 10, g: 18, prop: 5, kv: 2300, propName: '5045', note: '300 g thrust · 18 g · 5" prop' },
      { id: 'm2205', name: '2205 · 2300 KV', thrust: 400, imax: 18, g: 28, prop: 5, kv: 2300, propName: '5045', note: '400 g thrust · 28 g · 5" prop' },
      { id: 'm2212', name: '2212 · 920 KV', thrust: 600, imax: 15, g: 55, prop: 10, kv: 920, propName: '1045', note: '600 g thrust · 55 g · 10" prop' },
    ],
    batt: [
      { id: 'b1500', name: '3S 1500 mAh', cap: 1.5, g: 130, note: '130 g' },
      { id: 'b2200', name: '3S 2200 mAh', cap: 2.2, g: 180, note: '180 g' },
      { id: 'b3000', name: '3S 3000 mAh', cap: 3.0, g: 240, note: '240 g' },
      { id: 'b5000', name: '3S 5000 mAh', cap: 5.0, g: 400, note: '400 g' },
    ],
  };
  const CAM_G = 150;
  const design = { frame: PARTS.frame[0], motor: PARTS.motor[1], batt: PARTS.batt[0] };
  function evalDesign(d) {
    const mass = d.frame.g + 4 * d.motor.g + d.batt.g + CAM_G;
    const thrust = 4 * d.motor.thrust;
    const tw = thrust / mass;
    const hov = mass / thrust;
    const amps = 4 * d.motor.imax * Math.pow(Math.min(1, hov), 1.5) + 0.5;
    const time = ((0.8 * d.batt.cap) / amps) * 60;
    const fits = d.motor.prop <= d.frame.maxProp;
    return { mass, thrust, tw, hov, amps, time, fits, rpm: d.motor.kv * 11.1, ok: fits && tw >= 2 && time >= 8 };
  }
  let designer = null;
  function buildDesigner(api) {
    destroyDesigner();
    const calc = h('div', { class: 'calc' });
    const checks = h('div', { class: 'checks' });
    function seg(kind, label) {
      const wrap = h('div', { class: 'ac-seg' });
      PARTS[kind].forEach((part) => {
        const b = h('button', { type: 'button', class: design[kind] === part ? 'on' : '' }, part.name, h('small', {}, part.note));
        b.addEventListener('click', () => {
          design[kind] = part;
          [...wrap.children].forEach((c) => c.classList.remove('on'));
          b.classList.add('on');
          AC.audio.click();
          refresh();
        });
        wrap.appendChild(b);
      });
      return h('div', { class: 'grp' }, h('div', {}, label), wrap);
    }
    function refresh() {
      const r = evalDesign(design);
      calc.innerHTML = '';
      const row = (k, v) => calc.append(h('span', {}, k), h('span', {}, v));
      row('Frame + motors (4 × ' + design.motor.g + ' g)', design.frame.g + 4 * design.motor.g + ' g');
      row('Battery + camera', design.batt.g + ' + ' + CAM_G + ' g');
      row('All-up mass', AC.fmt(r.mass) + ' g');
      row('Total thrust (4 × ' + design.motor.thrust + ' g)', AC.fmt(r.thrust) + ' g');
      row('T/W = thrust ÷ mass', AC.fmt(r.tw, 2) + ' : 1');
      row('Hover throttle ≈ mass ÷ thrust', AC.fmt(r.hov * 100) + ' %');
      row('Average current', AC.fmt(r.amps, 1) + ' A');
      row('Flight time = 0.8 × ' + design.batt.cap + ' Ah ÷ ' + AC.fmt(r.amps, 1) + ' A × 60', AC.fmt(r.time, 1) + ' min');
      row('Motor rpm = ' + design.motor.kv + ' KV × 11.1 V', AC.fmt(r.rpm));
      checks.innerHTML = '';
      const ck = (ok, txt) => checks.append(h('div', { class: ok ? 'ok' : 'no' }, (ok ? '✓ ' : '✗ ') + txt));
      ck(true, 'Carries the 150 g camera');
      ck(r.fits, r.fits ? design.motor.propName + ' props fit the frame' : design.motor.prop + '-inch props are too big for a 250 frame: they would hit each other');
      ck(r.tw >= 2, 'T/W at least 2 : 1 (now ' + AC.fmt(r.tw, 2) + ')');
      ck(r.time >= 8, 'Flight time at least 8 min (now ' + AC.fmt(r.time, 1) + ')');
    }
    const fly = h('button', { class: 'ac-btn', type: 'button' }, 'Test-fly this design');
    fly.addEventListener('click', () => {
      const r = evalDesign(design);
      if (!r.fits) { AC.ui.toast('Props do not fit', 'var(--red)'); AC.audio.bad(); return; }
      designer.panel.hidden = true;
      api.state.flying = true;
      api.state.result = r;
      api.state.hold = 0;
      api.state.flyT = 0;
      setDesign({ name: 'Your design', massG: r.mass, thrustG: design.motor.thrust, kv: design.motor.kv, prop: design.motor.propName });
      drone.scale.setScalar(design.frame.id === 'f250' ? 0.65 : 1);
      resetDrone(0, 0, 0);
      api.objective('Test flight: climb above 1.5 m and hover for 3 s');
    });
    designer = {
      panel: h('div', { class: 'designer ac-panel' },
        h('div', { class: 'eyebrow mono', style: { fontSize: '0.7rem', color: 'var(--magenta)', letterSpacing: '0.12em' } }, 'DESIGN REVIEW · REQUIREMENTS'),
        h('h2', {}, 'Build a camera drone'),
        seg('frame', 'Frame'), seg('motor', 'Motors (× 4)'), seg('batt', 'Battery'),
        calc, checks, h('div', { class: 'ac-actions' }, fly)),
    };
    AC.root().appendChild(designer.panel);
    refresh();
  }
  function destroyDesigner() {
    if (designer) designer.panel.remove();
    designer = null;
    drone.scale.setScalar(1);
  }

  // ---------------------------------------------------------------- missions
  const CTRL_MANUAL = ['<kbd>W</kbd> <kbd>S</kbd> throttle up / down', '<kbd>↑</kbd> <kbd>↓</kbd> pitch', '<kbd>←</kbd> <kbd>→</kbd> roll', '<kbd>A</kbd> <kbd>D</kbd> yaw', '<kbd>C</kbd> camera', '<kbd>F</kbd> force arrows', '<kbd>R</kbd> restart'];
  const CTRL_ALT = ['<kbd>W</kbd> <kbd>S</kbd> climb / descend', '<kbd>↑</kbd> <kbd>↓</kbd> pitch', '<kbd>←</kbd> <kbd>→</kbd> roll', '<kbd>A</kbd> <kbd>D</kbd> yaw', '<kbd>C</kbd> camera', '<kbd>F</kbd> force arrows', '<kbd>R</kbd> restart'];
  function cleanup() {
    destroyLab();
    destroyDesigner();
    stand.visible = zone.visible = false;
    rings.forEach((r) => (r.g.visible = false));
    ringTag.visible = padTag.visible = false;
    payloadBox.visible = false;
    P.payload = 0;
    setDesign(DEFAULT);
  }
  const missions = [
    {
      id: 'lab', title: 'Motor Lab', objective: 'Motor Lab: solve 4 motor puzzles',
      story: 'Your drone is clamped on a test stand, just like engineers test a real flight controller. It can tilt and turn but cannot fly away. Choose which motors spin FAST to make it move the way each test asks.',
      learn: [
        { t: 'Two spin directions', p: 'M1 and M3 spin clockwise (orange props). M2 and M4 spin anticlockwise (blue props). Their twisting forces cancel.', f: '1 & 3 = CW · 2 & 4 = CCW' },
        { t: 'Tilt = thrust difference', p: 'Make one side push harder and that side rises. Rear faster → nose dips → drone flies forward.' },
        { t: 'Yaw = twist trick', p: 'Every spinning prop twists the frame the opposite way. Speed up one diagonal pair and the drone turns on the spot.' },
      ],
      controls: ['Click motors to switch <b>LOW / HIGH</b>', 'Press <b>Spin up & test</b>', 'Drag to look around, scroll to zoom'],
      proved: 'A quadcopter has no rudder or ailerons. It steers only by changing the speed of each motor. The flight controller does this mixing hundreds of times a second.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('To ROLL RIGHT')),
      start(api) {
        cleanup();
        setMode('lab');
        stand.visible = true;
        resetDrone(0, 0, 0, STAND_Y);
        oc.dist = 1.5; oc.phi = 1.0; oc.theta = Math.PI * 0.85;
        buildLab(api);
      },
      update(dt) {
        if (lab && lab.testing) {
          lab.testing -= dt;
          if (lab.testing <= 0) { lab.testing = 0; evaluateLab(); }
        }
      },
    },
    {
      id: 'hover', title: 'First Hover', objective: 'Hold the drone in the hover zone (2–4 m) for 5 s',
      story: 'Thrust must beat weight to lift off. Throttle up slowly, find the point where thrust equals weight, and hold the drone in the magenta hover zone for 5 seconds. Watch the T and W arrows.',
      learn: [
        { t: 'Weight', p: 'This drone has an all-up mass of 780 g.', f: 'W = 0.78 kg × 9.81 = 7.65 N' },
        { t: 'Thrust-to-weight', p: 'Four motors × 400 g of thrust = 1,600 g.', f: 'T/W = 1600 ÷ 780 = 2.05' },
        { t: 'Hover throttle', p: 'To hover, thrust = weight. So the throttle you need is about weight ÷ max thrust.', f: '780 ÷ 1600 ≈ 49 %' },
      ],
      controls: CTRL_MANUAL,
      proved: 'You found the hover throttle, where total thrust equals weight. Balanced forces, so no acceleration (Newton\'s 1st law). More throttle makes thrust bigger than weight, so the drone accelerates up (F = ma).',
      tip: 'Throttle up slowly to about 50% (the magenta "Hover throttle" number in the panel). Small taps on W and S. Keep the drone level.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('A 600 g drone')),
      start(api) {
        cleanup();
        setMode('manual');
        zone.visible = true;
        resetDrone(0, 0, 0);
        api.state.inZone = 0;
      },
      update(dt, api) {
        const alt = P.pos.y - CLR;
        const inZ = alt >= 2 && alt <= 4 && Math.hypot(P.pos.x, P.pos.z) < 3;
        api.state.inZone = inZ ? api.state.inZone + dt : Math.max(0, api.state.inZone - dt * 0.5);
        api.progress(api.state.inZone / 5, inZ ? 'In the zone: hold it' : 'Objective');
        if (api.state.inZone >= 5) api.win(api.t < 25 ? 3 : api.t < 45 ? 2 : 1, 'Hover found in ' + AC.fmt(api.t, 1) + ' s.');
      },
    },
    {
      id: 'rings', title: 'Ring Run', objective: 'Fly through all 6 rings in order',
      story: 'The flight controller now holds your height for you (altitude-hold mode), like a real camera drone. Fly through the 6 rings in order. Watch the motor bars: that is the mixer at work.',
      learn: [
        { t: 'Pitch forward', p: 'Rear pair speeds up, front pair slows down. The thrust tilts forward.' },
        { t: 'Roll right', p: 'Left pair speeds up, right pair slows down.' },
        { t: 'Yaw', p: 'One diagonal pair speeds up, the other slows. Total thrust stays the same, so height holds.' },
      ],
      controls: CTRL_ALT,
      proved: 'Tilting the drone tilts the thrust vector. Part of the thrust holds you up and part pushes you sideways. That is why the flight controller speeds up all motors a little when you tilt.',
      tip: 'Use the Chase camera (C). Yaw with A/D to face the next ring, then pitch forward gently.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('How does a quadcopter YAW')),
      start(api) {
        cleanup();
        setMode('althold');
        resetDrone(0, 0, 0);
        rings.forEach((r) => { r.g.visible = true; r.ring.material.color.set(0x5a6b80); });
        api.state.next = 0;
        rings[0].ring.material.color.set(0xff70d8);
        ringTag.visible = true;
      },
      update(dt, api) {
        const i = api.state.next;
        const r = rings[i];
        if (!r) return;
        tmp.copy(P.pos);
        r.g.worldToLocal(tmp);
        ringTag.pos.copy(r.g.position);
        ringTag.pos.y += 1.3;
        ringTag.set('RING ' + (i + 1) + ' · ' + AC.fmt(P.pos.distanceTo(r.g.position)) + ' m');
        if (Math.hypot(tmp.x, tmp.y) < RING_R * 0.95 && Math.abs(tmp.z) < 0.35) {
          r.ring.material.color.set(0x4be38a);
          AC.audio.ping();
          api.state.next++;
          api.progress(api.state.next / rings.length, 'Ring ' + api.state.next + ' of ' + rings.length);
          if (rings[api.state.next]) rings[api.state.next].ring.material.color.set(0xff70d8);
          else { ringTag.visible = false; api.win(api.t < 50 ? 3 : api.t < 80 ? 2 : 1, 'Course time: ' + AC.fmt(api.t, 1) + ' s.'); }
        }
      },
    },
    {
      id: 'delivery', title: 'Medicine Run', objective: 'Deliver the medicine to the island clinic',
      story: 'A clinic on an island in Lake Victoria needs medicine. Your drone now carries a 300 g medicine box. Heavier drone, same motors: what happens to T/W? Fly over the water and land gently on the red + pad.',
      learn: [
        { t: 'New all-up mass', p: '780 g + 300 g box = 1,080 g', f: 'T/W = 1600 ÷ 1080 = 1.48' },
        { t: 'Less margin', p: 'Below 2 : 1 the drone feels heavy and slow to climb. It needs about 68% throttle just to hover.' },
        { t: 'Land softly', p: 'Touch down slower than 1.2 m/s on the + pad. Stay out of the water!' },
      ],
      controls: CTRL_ALT,
      proved: 'Payload eats into your thrust margin. Engineers size the motors so that T/W stays at least 2 : 1 with the heaviest payload, otherwise the drone cannot fight wind or climb fast.',
      tip: 'Climb to 5 m before you cross the water. Slow down above the island, then hold S gently to descend.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Frame + electronics 450 g')),
      start(api) {
        cleanup();
        setMode('althold');
        P.payload = 0.3;
        payloadBox.visible = true;
        resetDrone(0, 0, 0);
        padTag.visible = true;
        padTag.pos.set(ISLAND.x, ISLAND.top + 1.5, ISLAND.z);
        AC.fact('Payload loaded', 'T/W dropped from 2.05 to 1.48. Watch the hover throttle number climb.', { tag: 'Mass changed' });
      },
      update(dt, api) {
        const d = Math.hypot(P.pos.x - ISLAND.x, P.pos.z - ISLAND.z);
        padTag.set('CLINIC · ' + AC.fmt(Math.hypot(d, P.pos.y - ISLAND.top)) + ' m');
        api.progress(1 - clamp(d / 78, 0, 1), 'Distance to clinic ' + AC.fmt(d) + ' m');
        if (P.onGround && d < 1.3 && api.t > 2) {
          if (P.lastImpact > 1.2) return api.fail('Touchdown at ' + AC.fmt(P.lastImpact, 1) + ' m/s was too hard and the medicine box broke.');
          api.win(api.t < 35 ? 3 : api.t < 55 ? 2 : 1, 'Delivered in ' + AC.fmt(api.t, 1) + ' s, touchdown at ' + AC.fmt(P.lastImpact, 2) + ' m/s.');
        } else if (P.onGround && d < ISLAND.r && d >= 1.3 && api.t > 2 && !api.state.warned) {
          api.state.warned = true;
          AC.fact('Missed the pad', 'You landed on the island but not on the + pad. Take off again and land on the red cross.', { color: 'var(--amber)', tag: 'Almost' });
        }
      },
    },
    {
      id: 'design', title: 'Design Review', objective: 'Design a camera drone that meets every requirement',
      story: 'Now YOU are the engineer. Pick a frame, motors and battery. Every choice changes mass, thrust and flight time. Meet the requirements, then test-fly your design.',
      learn: [
        { t: 'Requirement 1', p: 'Carry the 150 g camera, and the props must fit the frame.' },
        { t: 'Requirement 2', p: 'Thrust-to-weight at least 2 : 1.', f: 'T/W = 4 × motor thrust ÷ all-up mass' },
        { t: 'Requirement 3', p: 'Flight time at least 8 minutes. Longer earns more stars.', f: 'time = 0.8 × Ah ÷ A × 60' },
      ],
      controls: CTRL_ALT,
      proved: 'Engineering is trade-offs. A bigger battery gives more minutes but adds mass and lowers T/W. Big, slow (low-KV) motors with big props are efficient for long camera flights; small, fast (high-KV) motors suit racers.',
      tip: 'Small frames only fit small props. Try the 450 frame with the 2212 motors, then compare batteries.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Using 1.2 Ah')),
      start(api) {
        cleanup();
        setMode('althold');
        resetDrone(0, 0, 0);
        api.state.flying = false;
        buildDesigner(api);
        camMode = 1;
        oc.dist = 2.2; oc.phi = 1.2;
      },
      update(dt, api) {
        if (!api.state.flying) return;
        api.state.flyT += dt;
        const alt = P.pos.y - CLR;
        if (alt > 1.5) api.state.hold += dt;
        api.progress(api.state.hold / 3, 'Test flight');
        const r = api.state.result;
        if (api.state.flyT > 8 && alt < 0.3 && r.tw < 1.1) return api.fail('With T/W of ' + AC.fmt(r.tw, 2) + ' the drone can barely lift itself.');
        if (api.state.hold >= 3) {
          if (!r.ok) return api.fail('It flew, but the design review failed: ' + (r.tw < 2 ? 'T/W is only ' + AC.fmt(r.tw, 2) + '. ' : '') + (r.time < 8 ? 'Flight time is only ' + AC.fmt(r.time, 1) + ' min.' : ''));
          api.win(r.time >= 12 ? 3 : r.time >= 9 ? 2 : 1, 'Design approved: ' + AC.fmt(r.mass) + ' g, T/W ' + AC.fmt(r.tw, 2) + ', ' + AC.fmt(r.time, 1) + ' minutes of flight.');
        }
      },
    },
  ];

  const MR = AC.missions({ game: 'quad', week: 4, list: missions });

  // ---------------------------------------------------------------- tools, help, keys
  AC.ui.tools([
    { label: 'Camera', title: 'Change camera (C)', onclick: cycleCam },
    { label: 'Forces', title: 'Show / hide force arrows (F)', onclick: () => (showForces = !showForces) },
    { label: 'Restart', title: 'Restart mission (R)', onclick: () => MR.api.restart() },
  ]);
  AC.onKey('KeyC', cycleCam);
  AC.onKey('KeyF', () => (showForces = !showForces));
  AC.onKey('KeyR', () => MR.api.restart());
  AC.ui.hint('<kbd>W</kbd><kbd>S</kbd> throttle · <kbd>A</kbd><kbd>D</kbd> yaw · arrows tilt · <kbd>C</kbd> camera · <kbd>F</kbd> forces');

  function help() {
    AC.ui.card({
      eyebrow: 'How to fly', title: 'Quad Pilot controls',
      body: [
        'Real drone pilots use two sticks. Here the keyboard does the same job:',
        AC.ui.learnGrid([
          { t: 'Left stick', p: 'W / S = throttle (or climb in altitude-hold). A / D = yaw (turn on the spot).' },
          { t: 'Right stick', p: '↑ / ↓ = pitch (forward / back). ← / → = roll (sideways).' },
          { t: 'Motor panel', p: 'A top view of the drone. Orange = clockwise props, blue = anticlockwise.' },
          { t: 'Arrows', p: 'Blue arrows = thrust of each motor. Orange arrow = weight. Press F to hide them.' },
        ]),
        h('p', { class: 'dim' }, 'On a tablet or phone, use the two on-screen sticks.'),
      ],
    });
  }

  // ---------------------------------------------------------------- loop
  S.onFrame((dt) => {
    if (dt > 0) {
      const inp = readInput(dt);
      if (P.crashed) {
        crashTimer -= dt;
        if (crashTimer <= 0 && crashTimer > -1) {
          crashTimer = -2;
          MR.api.fail(crashMsg);
        }
      } else {
        const n = Math.max(4, Math.ceil(dt / 0.004)), sub = dt / n;
        for (let i = 0; i < n; i++) {
          if (P.mode !== 'lab') controller(inp);
          step(sub);
          if (P.crashed) break;
        }
        teach(inp);
      }
    }
    MR.update(dt);
    visuals(dt);
    hudUpdate();
    cameraUpdate(dt);
  });

  resetDrone();
  S.start();
  MR.begin();
})();
