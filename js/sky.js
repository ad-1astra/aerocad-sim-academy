/* Sky School — Weeks 1–2 · Four forces, lift equation, stall.
   Cessna-172-class aircraft: lift L = ½ρv²S·C_L with the Week 2 lift curve (C_L = 2πα + 0.25,
   stall past 14°), induced drag, propeller thrust that fades with speed, and Entebbe air density. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  const V3 = THREE.Vector3;

  AC.boot({ game: 'sky', topic: 'Weeks 1–2 · Forces, lift & stall', title: 'Sky School', help: () => help() });

  // ---------------------------------------------------------------- world
  const S = AC.scene({ fov: 60, near: 0.5, far: 14000, shadows: true });
  const { scene, camera, renderer } = S;
  const sky = AC.skyDome(scene, 0x2a6fc0, 0xd2e9f6, 0x6f8f5a, 9000);
  scene.fog = new THREE.Fog(0xd2e9f6, 1800, 9500);
  const lights = AC.lights(scene, { shadows: true, shadowSize: 22, dir: [300, 500, 200], sun: 1.0 });
  const field = AC.models.airfield(scene, { size: 16000, runway: 1400 });

  // clouds made of spheres
  (function clouds() {
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const matc = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
    const n = 60 * 6;
    const im = new THREE.InstancedMesh(geo, matc, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3();
    let k = 0;
    for (let c = 0; c < 60; c++) {
      const cx = AC.rand(-6000, 6000), cz = AC.rand(-6000, 6000), cy = AC.rand(1100, 1900);
      if (Math.hypot(cx, cz) < 900) continue;
      for (let j = 0; j < 6; j++) {
        const r = AC.rand(60, 140);
        s.set(r * 1.4, r * 0.7, r);
        p.set(cx + AC.rand(-180, 180), cy + AC.rand(-30, 40), cz + AC.rand(-120, 120));
        m4.compose(p, q, s);
        im.setMatrixAt(k++, m4);
      }
    }
    im.count = k;
    scene.add(im);
  })();

  const plane = AC.models.plane();
  scene.add(plane);
  const pu = plane.userData;

  // ---------------------------------------------------------------- aircraft data (Cessna 172 class)
  const G = AC.G, MASS = 1100, W = MASS * G, S_W = 16.2, CD0 = 0.03, K_IND = 0.053, TMAX = 3400, VZERO = 92, CLMAX = 1.6;
  const CLR = 1.33; // wheel clearance
  const DENS = { entebbe: { rho: 1.09, name: 'Entebbe (1,155 m)' }, sea: { rho: 1.225, name: 'Sea level' } };
  let air = 'entebbe';
  const rho = () => DENS[air].rho;

  function liftCoef(a) {
    let cl = 2 * Math.PI * AC.rad(a) + 0.25; // Week 2: C_L = 2π·α + 0.25
    if (a > 14) cl = Math.max(0.6, cl - 0.15 * Math.pow(a - 14, 1.5)); // stall
    if (a < -10) cl = Math.min(-0.6, cl + 0.15 * Math.pow(-10 - a, 1.5));
    return cl;
  }
  function dragCoef(a, cl) {
    let cd = CD0 + K_IND * cl * cl;
    if (a > 14) cd += Math.min(1.2, 0.012 * (a - 14) * (a - 14));
    return cd;
  }
  const vTakeoff = () => Math.sqrt((2 * W) / (rho() * S_W * CLMAX));

  // ---------------------------------------------------------------- state
  const P = {
    pos: new V3(), vel: new V3(), q: new THREE.Quaternion(), thr: 0, ground: true, crashed: false,
    inp: { pitch: 0, roll: 0, yaw: 0 }, atrim: 3, alpha: 0, cl: 0, L: 0, D: 0, T: 0, acc: 0, brake: false, touchVS: 0, stallT: 0,
  };
  const f = new V3(), u = new V3(), r = new V3(), vhat = new V3(), ldir = new V3(), force = new V3(), tmp = new V3(), tmp2 = new V3();
  const eul = new THREE.Euler(0, 0, 0, 'YXZ'), dq = new THREE.Quaternion(), w = new V3();
  const onRunway = () => Math.abs(P.pos.x) < 16 && Math.abs(P.pos.z) < 700;
  const flatZone = () => Math.abs(P.pos.x) < 120 && Math.abs(P.pos.z) < 900;
  const agl = () => P.pos.y - CLR - Math.max(0, field.heightAt(P.pos.x, P.pos.z));

  function place(x, y, z, speed, thr, yaw = 0, pitchDeg = 0) {
    P.pos.set(x, y, z);
    P.q.setFromEuler(new THREE.Euler(-AC.rad(pitchDeg), yaw, 0, 'YXZ'));
    P.vel.set(0, 0, speed).applyAxisAngle(new V3(0, 1, 0), yaw);
    P.thr = thr;
    P.ground = y <= CLR + 0.01;
    P.crashed = false;
    P.inp = { pitch: 0, roll: 0, yaw: 0 };
    P.stallT = 0;
    P.atrim = P.ground ? 0 : 3;
    P.startedOnGround = P.ground;
    LS.set(0, thr * 2 - 1);
    camera._chaseInit = false;
    stallEl.hidden = true;
  }

  function step(dt) {
    f.set(0, 0, 1).applyQuaternion(P.q);
    u.set(0, 1, 0).applyQuaternion(P.q);
    r.set(-1, 0, 0).applyQuaternion(P.q);
    const v = P.vel.length();
    if (v > 0.5) vhat.copy(P.vel).divideScalar(v); else vhat.copy(f);
    const alpha = v > 3 ? AC.deg(Math.atan2(-P.vel.dot(u), P.vel.dot(f))) : 0;
    const beta = v > 3 ? Math.asin(clamp(P.vel.dot(r) / v, -1, 1)) : 0;
    const qd = 0.5 * rho() * v * v;
    const cl = liftCoef(alpha), cd = dragCoef(alpha, cl);
    const L = qd * S_W * cl, D = qd * S_W * cd;
    const T = TMAX * P.thr * Math.max(0, 1 - v / VZERO);
    ldir.copy(u).addScaledVector(vhat, -u.dot(vhat));
    if (ldir.lengthSq() > 1e-6) ldir.normalize(); else ldir.set(0, 1, 0);
    force.set(0, -W, 0).addScaledVector(ldir, L).addScaledVector(vhat, -D).addScaledVector(f, T).addScaledVector(r, -qd * S_W * 0.6 * beta);
    if (P.ground) {
      const N = Math.max(0, -force.y);
      force.y += N;
      const hs = Math.hypot(P.vel.x, P.vel.z);
      if (hs > 0.05) {
        const mu = P.brake ? 0.45 : 0.025;
        force.x -= (P.vel.x / hs) * mu * N;
        force.z -= (P.vel.z / hs) * mu * N;
      } else if (T < 50) { P.vel.x = 0; P.vel.z = 0; }
    }
    const before = P.vel.dot(vhat);
    P.vel.addScaledVector(force, dt / MASS);
    P.acc = (P.vel.dot(vhat) - before) / dt;
    if (P.ground) {
      // wheels stop sideways skidding
      tmp.set(r.x, 0, r.z).normalize();
      P.vel.addScaledVector(tmp, -P.vel.dot(tmp) * Math.min(1, 12 * dt));
    }
    P.pos.addScaledVector(P.vel, dt);
    Object.assign(P, { alpha, cl, L, D, T, beta, v });

    // attitude (arcade control laws with real stability tendencies)
    eul.setFromQuaternion(P.q, 'YXZ');
    const auth = clamp(v / 30, 0.1, 1.4);
    // the pilot sets the angle of attack; the tail holds it (trim), but never lets it sit past 12°
    if (Math.abs(P.inp.pitch) > 0.05) P.atrim = clamp(alpha, -4, 12);
    let noseUp = 0.5 * P.inp.pitch * auth;
    if (v > 8 && !P.ground) noseUp -= 1.6 * auth * AC.rad(alpha - P.atrim); // weathercock stability
    let rollRight = P.ground ? 0 : 1.3 * P.inp.roll * auth - 0.15 * eul.z;
    let yawRight = P.ground ? P.inp.yaw * 0.5 * clamp(v / 8, 0, 1) : 0.35 * P.inp.yaw * auth + (v > 5 ? 2.5 * beta : 0);
    w.set(-noseUp, -yawRight, rollRight);
    const wl = w.length();
    if (wl > 1e-7) { dq.setFromAxisAngle(tmp.copy(w).divideScalar(wl), wl * dt); P.q.multiply(dq).normalize(); }

    // ground and crashes
    const gH = field.heightAt(P.pos.x, P.pos.z);
    if (field.inLake(P.pos.x, P.pos.z) && P.pos.y < 0.5) return crash('Splash! You ditched in Lake Victoria.');
    if (P.pos.y <= Math.max(gH, 0) + CLR) {
      const vs = -P.vel.y;
      eul.setFromQuaternion(P.q, 'YXZ');
      if (!P.ground) { P.touchVS = vs; touchdown(vs); }
      if (P.crashed) return;
      if (vs > 3.5) return crash('You hit the ground at ' + AC.fmt(vs, 1) + ' m/s. The landing gear collapsed.');
      if (Math.abs(eul.z) > AC.rad(20)) return crash('A wing tip hit the ground. Keep the wings level when you land.');
      if (-eul.x < AC.rad(-6)) return crash('The nose wheel hit first and broke. Raise the nose a little before touchdown.');
      if (!flatZone() && v > 8) return crash('You landed in the bush, away from the airfield.');
      P.pos.y = Math.max(gH, 0) + CLR;
      if (P.vel.y < 0) P.vel.y = 0;
      P.ground = true;
      eul.z = 0;
      eul.x = -clamp(-eul.x, 0, AC.rad(12));
      P.q.setFromEuler(eul);
    } else if (P.pos.y > Math.max(gH, 0) + CLR + 0.05) P.ground = false;
  }

  let crashTimer = 0, crashMsg = '';
  function crash(msg) {
    if (P.crashed) return;
    P.crashed = true;
    crashMsg = msg;
    crashTimer = 1.4;
    P.vel.set(0, 0, 0);
    P.thr = 0;
    AC.audio.boom();
    AC.ui.toast('CRASH', 'var(--red)');
    stallEl.hidden = true;
  }
  let touchHook = null;
  function touchdown(vs) { if (touchHook) touchHook(vs); }

  // ---------------------------------------------------------------- input
  const LS = AC.touch.stick('l', 'THROTTLE · RUDDER', { springY: false, initY: -1 });
  const RS = AC.touch.stick('r', 'PULL ↓ · ROLL');
  const brakeBtn = AC.touch.button('BRAKE');
  function readInput(dt) {
    const k = 3 * dt;
    const tp = AC.axis(['ArrowUp'], ['ArrowDown'], -RS.y); // pull back (↓) = nose up
    const tr = AC.axis(['ArrowLeft'], ['ArrowRight'], RS.x);
    const ty = AC.axis(['KeyA'], ['KeyD'], LS.x);
    P.inp.pitch += clamp(tp - P.inp.pitch, -k, k);
    P.inp.roll += clamp(tr - P.inp.roll, -k * 1.5, k * 1.5);
    P.inp.yaw += clamp(ty - P.inp.yaw, -k, k);
    P.thr = clamp(P.thr + AC.axis(['KeyS'], ['KeyW']) * 0.4 * dt, 0, 1);
    if (LS.active) P.thr = (LS.y + 1) / 2;
    P.brake = AC.key('KeyB', 'Space') || brakeBtn.down;
  }

  // ---------------------------------------------------------------- visuals
  const COL = { L: 0x4be38a, W: 0xffb547, T: 0x3fd0f0, D: 0xff5a4f };
  const arrows = { L: new AC.Arrow(scene, COL.L, { width: 0.13 }), W: new AC.Arrow(scene, COL.W, { width: 0.13 }), T: new AC.Arrow(scene, COL.T, { width: 0.13 }), D: new AC.Arrow(scene, COL.D, { width: 0.13 }) };
  const tags = { L: S.tag('LIFT', 'var(--green)'), W: S.tag('WEIGHT', 'var(--amber)'), T: S.tag('THRUST', 'var(--cyan)'), D: S.tag('DRAG', 'var(--red)') };
  const targetTag = S.tag('', 'var(--magenta)');
  targetTag.visible = false;
  let showForces = true;
  const SCALE = 0.0005; // metres of arrow per newton
  const hum = AC.audio.makeHum('sawtooth', 70);
  const stallEl = h('div', { class: 'stallwarn', hidden: true }, 'STALL');
  AC.root().appendChild(stallEl);
  let hornT = 0;

  function visuals(dt) {
    plane.position.copy(P.pos);
    plane.quaternion.copy(P.q);
    if (P.crashed) { plane.rotation.z = 0.5; plane.position.y = Math.max(0, field.heightAt(P.pos.x, P.pos.z)) + 0.6; }
    pu.prop.rotation.z += (P.crashed ? 0 : 6 + 60 * P.thr) * dt;
    pu.prop.children[1].visible = P.thr < 0.15 || P.crashed;
    pu.disc.material.opacity = P.crashed ? 0 : 0.1 + 0.25 * P.thr;
    pu.elev.rotation.x = 0.35 * P.inp.pitch;
    pu.ailR.rotation.x = 0.3 * P.inp.roll;
    pu.ailL.rotation.x = -0.3 * P.inp.roll;
    pu.rudder.rotation.y = 0.4 * P.inp.yaw;
    pu.lights.strobe.visible = Math.sin(performance.now() / 120) > 0.85;
    hum.set(P.crashed ? 0 : 0.3 + 0.7 * P.thr, 0.7 + P.thr * 0.9);
    // forces
    f.set(0, 0, 1).applyQuaternion(P.q);
    u.set(0, 1, 0).applyQuaternion(P.q);
    if (showForces && !P.crashed) {
      const v = P.vel.length();
      if (v > 0.5) vhat.copy(P.vel).divideScalar(v); else vhat.copy(f);
      ldir.copy(u).addScaledVector(vhat, -u.dot(vhat)).normalize();
      arrows.L.set(tmp.copy(P.pos).addScaledVector(u, 0.9), tmp2.copy(ldir).multiplyScalar(P.L), SCALE);
      arrows.W.set(P.pos, tmp2.set(0, -W, 0), SCALE);
      arrows.T.set(tmp.copy(P.pos).addScaledVector(f, 3.8), tmp2.copy(f).multiplyScalar(P.T), SCALE);
      arrows.D.set(tmp.copy(P.pos).addScaledVector(f, -5), tmp2.copy(vhat).multiplyScalar(-P.D), SCALE);
      for (const k of ['L', 'W', 'T', 'D']) {
        const a = arrows[k];
        tags[k].visible = a.group.visible && !!a.tip;
        if (a.tip) tags[k].pos.copy(a.tip);
      }
      tags.L.set('LIFT ' + AC.fmt(P.L / 1000, 1) + ' kN');
      tags.W.set('WEIGHT ' + AC.fmt(W / 1000, 1) + ' kN');
      tags.T.set('THRUST ' + AC.fmt(P.T / 1000, 1) + ' kN');
      tags.D.set('DRAG ' + AC.fmt(P.D / 1000, 1) + ' kN');
    } else {
      for (const k in arrows) { arrows[k].hide(); tags[k].visible = false; }
    }
    // stall warning horn (real aircraft warn a few degrees before the stall)
    const warn = !P.ground && !P.crashed && P.alpha > 13;
    stallEl.hidden = !(warn && P.alpha > 14.5);
    hornT -= dt;
    if (warn && hornT <= 0) { AC.audio.tone(820, 0.18, 'square', 0.06); hornT = 0.35; }
    sky.position.copy(camera.position);
    lights.sun.position.set(P.pos.x + 300, P.pos.y + 500, P.pos.z + 200);
    lights.sun.target.position.copy(P.pos);
  }

  // cameras
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 28, min: 10, max: 300, phi: 1.2, theta: Math.PI + 0.6 });
  const CAMS = ['Chase', 'Side view (forces)', 'Orbit'];
  let camMode = 0;
  const chaseOff = new V3(0, 3.6, -17);
  function cameraUpdate(dt) {
    if (camMode === 0) AC.chase(camera, P.pos, P.q, chaseOff, 14, 4, dt || 0.016, false);
    else if (camMode === 1) {
      eul.setFromQuaternion(P.q, 'YXZ');
      tmp.set(-Math.cos(eul.y), 0, Math.sin(eul.y)).multiplyScalar(34); // to the aircraft's right
      camera.position.copy(P.pos).add(tmp).add(tmp2.set(0, 2, 0));
      camera.lookAt(P.pos);
    } else { oc.target.copy(P.pos); oc.update(dt); }
  }
  function cycleCam() { camMode = (camMode + 1) % 3; camera._chaseInit = false; AC.ui.toast(CAMS[camMode], 'var(--cyan)'); }

  // ---------------------------------------------------------------- HUD
  const hud = AC.ui.hud();
  hud.section('Flight').row('spd', 'Airspeed').row('kt', 'km/h · knots').row('alt', 'Height').row('vs', 'Climb rate').row('thr', 'Throttle').row('aoa', 'Angle of attack α').row('att', 'Pitch · bank');
  hud.section('Four forces');
  const bal = h('div', { class: 'bal' });
  const balRow = (lbl, col) => {
    const i = h('i', { style: { background: col } });
    const n = h('span', { class: 'n', style: { color: col } });
    bal.append(h('span', { style: { color: col } }, lbl), h('div', { class: 'bar' }, i), n);
    return { i, n };
  };
  const bL = balRow('L', 'var(--green)'), bW = balRow('W', 'var(--amber)'), bT = balRow('T', 'var(--cyan)'), bD = balRow('D', 'var(--red)');
  const eqEl = h('div', { class: 'eq' });
  hud.add(bal).add(eqEl);
  hud.section('Lift equation');
  hud.formula('lift', '');
  const gc = hud.canvas('clgraph');
  const graph = new AC.Graph(gc, { xMin: -5, xMax: 25, yMin: 0, yMax: 2.4, xLabel: 'α (°)', yLabel: 'C_L', xTicks: 6, yTicks: 4 });
  const curve = [];
  for (let a = -5; a <= 25; a += 0.5) curve.push([a, liftCoef(a)]);
  hud.formula('vto', '');

  function hudUpdate() {
    const v = P.vel.length();
    hud.set('spd', AC.fmt(v, 1) + ' m/s');
    hud.set('kt', AC.fmt(v * 3.6) + ' · ' + AC.fmt((v * 3.6) / 1.852) + ' kt', 'cyan');
    hud.set('alt', AC.fmt(agl()) + ' m');
    hud.set('vs', AC.fmt(P.vel.y, 1) + ' m/s');
    hud.set('thr', AC.fmt(P.thr * 100) + ' %', 'cyan');
    hud.set('aoa', AC.fmt(P.alpha, 1) + '°', P.alpha > 14 ? 'bad' : P.alpha > 11 ? 'warn' : '');
    eul.setFromQuaternion(P.q, 'YXZ');
    hud.set('att', AC.fmt(-AC.deg(eul.x)) + '° · ' + AC.fmt(AC.deg(eul.z)) + '°');
    const mx = Math.max(W, P.L, 1) * 1.15, mt = Math.max(P.T, P.D, 500) * 1.15;
    bL.i.style.width = (100 * Math.max(0, P.L)) / mx + '%'; bL.n.textContent = AC.fmt(P.L / 1000, 1) + ' kN';
    bW.i.style.width = (100 * W) / mx + '%'; bW.n.textContent = AC.fmt(W / 1000, 1) + ' kN';
    bT.i.style.width = (100 * P.T) / mt + '%'; bT.n.textContent = AC.fmt(P.T / 1000, 2) + ' kN';
    bD.i.style.width = (100 * P.D) / mt + '%'; bD.n.textContent = AC.fmt(P.D / 1000, 2) + ' kN';
    const lw = P.L - W * Math.cos(eul.z), td = P.T - P.D;
    const lTxt = P.ground ? 'On the ground' : Math.abs(lw) < 400 ? 'L ≈ W' : lw > 0 ? 'L > W ↑' : 'L < W ↓';
    const tTxt = Math.abs(td) < 120 ? 'T ≈ D' : td > 0 ? 'T > D → faster' : 'T < D → slower';
    eqEl.textContent = lTxt + ' · ' + tTxt;
    eqEl.style.color = lTxt === 'L ≈ W' && tTxt === 'T ≈ D' ? 'var(--green)' : 'var(--dim)';
    hud.setFormula('lift', 'L = ½ × ρ × v² × S × C_L\n= ½ × ' + rho() + ' × ' + AC.fmt(v, 1) + '² × 16.2 × ' + AC.fmt(P.cl, 2) + '\n= ' + AC.fmt(P.L / 1000, 1) + ' kN');
    graph.draw({
      series: [{ pts: curve, color: AC.css('--green'), width: 1.5 }],
      vlines: [{ x: 14, color: AC.css('--red'), label: 'stall' }],
      marks: [{ x: clamp(P.alpha, -5, 25), y: clamp(P.cl, 0, 2.4), color: AC.css('--magenta'), r: 5 }],
    });
    hud.setFormula('vto', DENS[air].name + ': ρ = ' + rho() + '\nTake-off speed v = √(2W ÷ ρSC_Lmax)\n= √(2 × ' + AC.fmt(W) + ' ÷ (' + rho() + ' × 16.2 × 1.6))\n= ' + AC.fmt(vTakeoff(), 1) + ' m/s (' + AC.fmt(vTakeoff() * 3.6) + ' km/h)');
  }

  // ---------------------------------------------------------------- teaching moments
  const seen = new Set();
  function once(key, title, text, opts) { if (!seen.has(key)) { seen.add(key); AC.fact(title, text, opts); } }
  function teach() {
    if (P.crashed) return;
    const v = P.vel.length();
    if (P.ground && v > 15) once('v2', 'Speed makes lift', 'Lift grows with v². At double the speed you get four times the lift. Watch the green LIFT bar grow.');
    if (P.startedOnGround && !P.ground && agl() > 3) once('lw', 'Lift beat weight', 'L > W, so the aircraft accelerates upward. You just took off!');
    if (!P.ground && P.alpha > 11) once('aoa', 'High angle of attack', 'More α gives more C_L, but only up to about 14°. Look at the C_L graph: your magenta dot is near the top of the curve.');
    if (!P.ground && P.alpha > 14.5) once('stall', 'STALL', 'The airflow peeled away from the top of the wing. Lift collapsed and drag soared. Push the nose down (↑) to reduce α and recover.', { color: 'var(--red)', tag: 'Warning' });
    eul.setFromQuaternion(P.q, 'YXZ');
    if (!P.ground && Math.abs(eul.z) > AC.rad(25)) once('bank', 'Turning = tilting lift', 'In a bank, part of the lift pulls you round the turn, so less holds you up. Pull back a little to keep your height.');
    if (!P.ground && P.thr < 0.05 && P.vel.y < -1) once('glide', 'Gliding', 'With no thrust, the aircraft trades height for speed. Drag is now balanced by part of the weight.');
    if (v > 70) once('fast', 'Fast flight', 'At high speed v² is big, so the wing needs only a small angle of attack to make enough lift.');
  }

  // ---------------------------------------------------------------- rings (mission 4)
  const RINGS = [];
  const RR = 30;
  for (let k = 0; k < 6; k++) {
    const th = AC.rad(-90 + k * 50);
    const R = 1300, hgt = [350, 420, 500, 450, 380, 330][k];
    const g = new THREE.Group();
    const ring = AC.models.ring(RR, 1.6, 0xff70d8);
    g.add(ring);
    g.position.set(R * Math.cos(th), hgt, R * Math.sin(th));
    g.lookAt(g.position.clone().add(new V3(-Math.sin(th), 0, Math.cos(th))));
    g.visible = false;
    scene.add(g);
    RINGS.push({ g, ring });
  }

  // ---------------------------------------------------------------- missions
  const CTRL = ['<kbd>W</kbd> <kbd>S</kbd> throttle', '<kbd>↓</kbd> pull back = nose up', '<kbd>↑</kbd> push = nose down', '<kbd>←</kbd> <kbd>→</kbd> roll (ailerons)', '<kbd>A</kbd> <kbd>D</kbd> rudder / steer', '<kbd>B</kbd> brakes', '<kbd>C</kbd> camera', '<kbd>F</kbd> forces'];
  function cleanup() {
    touchHook = null;
    targetTag.visible = false;
    RINGS.forEach((x) => (x.g.visible = false));
  }
  const missions = [
    {
      id: 'forces', week: 1, title: 'Four Forces', objective: 'Fly straight and level: L = W and T = D for 4 seconds',
      story: 'You are cruising over Entebbe with too much throttle, so you keep speeding up and climbing. Balance the four forces: make lift equal weight and thrust equal drag. Then the aircraft flies steady and level.',
      learn: [
        { t: 'Lift vs Weight', p: 'Lift (green) acts at 90° to the airflow. Weight (orange) always points to Earth\'s centre.', f: 'Level: L = W = m × g' },
        { t: 'Thrust vs Drag', p: 'Thrust (blue) pulls forward. Drag (red) resists motion through the air.', f: 'Steady speed: T = D' },
        { t: 'Newton\'s 1st law', p: 'Balanced forces mean no acceleration: speed and height stay the same.', f: 'W = 1,100 × 9.81 = 10.8 kN' },
      ],
      controls: CTRL,
      proved: 'Steady, level, unaccelerated flight is equilibrium: L = W and T = D. When T > D the aircraft speeds up; when L > W it climbs (F = ma). This is the free-body diagram from your Week 1 handout, live.',
      tip: 'Watch the force bars on the right. If you are climbing or speeding up, take off some throttle (S) and wait a few seconds for the aircraft to settle.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('What are the conditions for steady')),
      start(api) {
        cleanup();
        place(0, 650, -2600, 55, 0.78);
        api.state.hold = 0;
      },
      update(dt, api) {
        eul.setFromQuaternion(P.q, 'YXZ');
        const level = Math.abs(P.vel.y) < 1.0 && Math.abs(P.acc) < 0.35 && Math.abs(eul.z) < AC.rad(10);
        api.state.hold = level ? api.state.hold + dt : Math.max(0, api.state.hold - dt * 2);
        api.progress(api.state.hold / 4, level ? 'Balanced: hold it' : 'Objective');
        if (api.state.hold >= 4) api.win(api.t < 30 ? 3 : api.t < 60 ? 2 : 1, 'Forces balanced in ' + AC.fmt(api.t) + ' s at ' + AC.fmt(P.vel.length()) + ' m/s with ' + AC.fmt(P.thr * 100) + '% throttle.');
        if (agl() < 80) api.fail('You got too low.');
      },
    },
    {
      id: 'takeoff', week: 2, title: 'Take-off at Entebbe', objective: 'Take off from runway 17 and climb to 150 m',
      story: 'Entebbe sits about 1,150 m above sea level, so the air is thinner. Full throttle, keep straight with the rudder, and when you reach take-off speed pull back gently to rotate.',
      learn: [
        { t: 'The lift equation', p: 'Lift grows with air density, speed squared, wing area and C_L.', f: 'L = ½ ρ v² S C_L' },
        { t: 'Take-off speed', p: 'Thin air means you need more speed. Watch the formula panel.', f: 'v = √(2W ÷ ρSC_Lmax) ≈ 28 m/s' },
        { t: 'Rotate', p: 'At about 28 m/s (100 km/h) hold ↓ gently. More α gives more C_L, so lift beats weight.' },
      ],
      controls: CTRL,
      proved: 'Lift depends on v², so speed is everything on the runway. Rotating raises the angle of attack, which raises C_L. Thinner air at Entebbe (ρ = 1.09) needs about 6% more speed than at sea level (ρ = 1.225).',
      tip: 'Hold W for full throttle. When the airspeed reads about 28 m/s, hold ↓ (pull back) gently until the nose lifts, then ease off.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Why do aircraft need longer runways')),
      start(api) {
        cleanup();
        place(0, CLR, -660, 0, 0);
        api.state.lift = null;
      },
      update(dt, api) {
        if (!api.state.lift && !P.ground) {
          api.state.lift = { d: P.pos.z + 660, v: P.vel.length() };
          AC.fact('Lift-off', 'You left the ground after ' + AC.fmt(api.state.lift.d) + ' m of runway at ' + AC.fmt(api.state.lift.v, 1) + ' m/s (' + AC.fmt(api.state.lift.v * 3.6) + ' km/h).', { tag: 'Measured' });
        }
        if (P.ground && P.pos.z > 700) return api.fail('You ran out of runway before taking off.');
        const a = agl();
        api.progress(P.ground ? (P.vel.length() / vTakeoff()) * 0.5 : 0.5 + a / 300, P.ground ? 'Take-off roll' : 'Climb to 150 m');
        if (a >= 150 && api.state.lift) {
          const d = api.state.lift.d;
          api.win(d < 450 ? 3 : d < 700 ? 2 : 1, 'Lift-off after ' + AC.fmt(d) + ' m at ' + AC.fmt(api.state.lift.v, 1) + ' m/s. Formula predicted ' + AC.fmt(vTakeoff(), 1) + ' m/s at full C_L.');
        }
      },
    },
    {
      id: 'stall', week: 2, title: 'Stall Lab', objective: 'Make the wing stall, then recover',
      story: 'Test pilots stall aircraft on purpose, high up where it is safe. Close the throttle, then pull back slowly. Watch α rise on the C_L graph until the wing stalls. Then recover: push the nose down and add full power.',
      learn: [
        { t: 'Angle of attack', p: 'α is the angle between the wing and the oncoming air. More α, more C_L, up to a limit.' },
        { t: 'The stall', p: 'Past about 14° the air separates from the top of the wing. Lift collapses, drag soars.', f: 'Stall ≈ 12–16°' },
        { t: 'Recovery', p: 'Reduce α first (nose down), then add power. Pulling harder makes it worse!' },
      ],
      controls: CTRL,
      proved: 'A stall is about angle of attack, not speed. Push the nose down and α drops below the stall angle, the airflow re-attaches and lift returns. That is why pilots practise recovery until it is automatic.',
      tip: 'Throttle to 0 with S, then hold ↓ until STALL flashes. Then let go, press ↑ to lower the nose and W for full power.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('A wing STALLS when')),
      start(api) {
        cleanup();
        place(0, 1250, -2400, 45, 0.5);
        api.state.phase = 0;
      },
      update(dt, api) {
        const a = agl();
        if (a < 250) return api.fail('Too low! You lost ' + AC.fmt(api.state.stallAlt ? api.state.stallAlt - a : 0) + ' m before recovering.');
        if (api.state.phase === 0) {
          api.objective('Throttle to idle, pull back slowly until the wing stalls');
          api.progress(clamp(P.alpha / 15, 0, 1) * 0.5, 'α = ' + AC.fmt(P.alpha, 1) + '°');
          if (P.alpha > 15) {
            P.stallT += dt;
            if (P.stallT > 0.4) { api.state.phase = 1; api.state.stallAlt = a; AC.ui.toast('STALLED: RECOVER', 'var(--red)'); }
          }
        } else {
          api.objective('Recover: nose down (↑), full power, back to 40 m/s');
          const lost = Math.max(0, api.state.stallAlt - a);
          api.progress(0.5 + clamp(P.vel.length() / 40, 0, 1) * 0.5, 'Height lost ' + AC.fmt(lost) + ' m');
          if (P.alpha < 10 && P.vel.length() > 40 && P.vel.y > -2) api.win(lost < 120 ? 3 : lost < 250 ? 2 : 1, 'Recovered after losing ' + AC.fmt(lost) + ' m of height.');
        }
      },
    },
    {
      id: 'rings', week: 3, title: 'Sky Rings', objective: 'Fly through all 6 rings',
      story: 'Use all three control surfaces. Ailerons roll the wings, the elevator pitches the nose, the rudder yaws. To turn, roll into a bank and pull back a little.',
      learn: [
        { t: 'Ailerons → roll', p: 'One goes up, the other goes down, on opposite wings. ← and →.' },
        { t: 'Elevator → pitch', p: 'On the tailplane. ↓ pulls the nose up, ↑ pushes it down.' },
        { t: 'Rudder → yaw', p: 'On the fin. A and D swing the nose left and right.' },
      ],
      controls: CTRL,
      proved: 'Aircraft turn by banking. The tilted lift pulls them round the turn, and the rudder keeps the turn coordinated. Every control surface works by changing the local camber, and so the lift, on that surface.',
      tip: 'Use gentle banks of about 20–30°. Press C for the chase camera, and fly a little above each ring then let the nose drop into it.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Which control surface controls ROLL')),
      start(api) {
        cleanup();
        place(0, 360, -2600, 52, 0.6);
        RINGS.forEach((x) => { x.g.visible = true; x.ring.material.color.set(0x5a6b80); });
        RINGS[0].ring.material.color.set(0xff70d8);
        api.state.next = 0;
        targetTag.visible = true;
      },
      update(dt, api) {
        const R = RINGS[api.state.next];
        if (!R) return;
        targetTag.pos.copy(R.g.position).add(tmp.set(0, RR + 8, 0));
        targetTag.set('RING ' + (api.state.next + 1) + ' · ' + AC.fmt(P.pos.distanceTo(R.g.position)) + ' m');
        tmp.copy(P.pos);
        R.g.worldToLocal(tmp);
        if (Math.hypot(tmp.x, tmp.y) < RR && Math.abs(tmp.z) < 6) {
          R.ring.material.color.set(0x4be38a);
          AC.audio.ping();
          api.state.next++;
          api.progress(api.state.next / RINGS.length, 'Ring ' + api.state.next + ' of 6');
          if (RINGS[api.state.next]) RINGS[api.state.next].ring.material.color.set(0xff70d8);
          else { targetTag.visible = false; api.win(api.t < 100 ? 3 : api.t < 160 ? 2 : 1, 'All rings in ' + AC.fmt(api.t) + ' s.'); }
        }
        if (agl() < 60) api.fail('Too low, pull up!');
      },
    },
    {
      id: 'landing', week: 2, title: 'Land at Entebbe', objective: 'Land on runway 17 and stop',
      story: 'Final approach to runway 17. Fly a gentle 3–4° slope, keep the wings level, and just before the runway raise the nose a little (the flare) so you touch down softly. Then brake to a stop.',
      learn: [
        { t: 'Slow flight', p: 'Slower means less v², so the wing needs a bigger α. Keep away from 14° or it stalls!' },
        { t: 'Glide slope', p: 'Height and distance: 200 m high at 3 km out is about a 4° slope.' },
        { t: 'Flare', p: 'Close the throttle over the runway and pull back gently to stop the sink.' },
      ],
      controls: CTRL,
      proved: 'Landing is controlled lift loss. Less throttle means T < D so you slow down; less v² needs more α to keep lift close to weight. The flare trades your last bit of speed for a soft touchdown.',
      tip: 'Keep about 35–40 m/s on approach. Use throttle to control your slope and the elevator to control speed. Wings level near the ground.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('If airspeed DOUBLES')),
      start(api) {
        cleanup();
        place(0, 240, -4300, 40, 0.3, 0, 0);
        api.state.td = null;
        targetTag.visible = true;
        touchHook = (vs) => {
          if (api.state.td) return;
          api.state.td = { vs, on: onRunway() };
        };
      },
      update(dt, api) {
        const dist = -560 - P.pos.z;
        if (!api.state.td) {
          targetTag.pos.set(0, 4, -560);
          const slope = dist > 0 ? AC.deg(Math.atan2(agl(), dist)) : 0;
          const call = slope > 5 ? 'HIGH' : slope < 2.5 ? 'LOW' : 'ON SLOPE';
          targetTag.set('RWY 17 · ' + AC.fmt(Math.max(0, dist)) + ' m · ' + call);
          api.progress(1 - clamp(dist / 3740, 0, 1), dist > 0 ? 'Glide slope ' + AC.fmt(slope, 1) + '°' : 'Over the runway');
        } else {
          targetTag.visible = false;
          if (!api.state.td.on) return api.fail('You touched down off the runway.');
          if (P.ground && P.pos.z > 700) return api.fail('You ran off the end of the runway. Brake earlier (B).');
          api.progress(1 - P.vel.length() / 40, 'Touchdown at ' + AC.fmt(api.state.td.vs, 2) + ' m/s. Brake!');
          if (P.ground && P.vel.length() < 2) {
            const vs = api.state.td.vs;
            api.win(vs < 1.0 ? 3 : vs < 2.0 ? 2 : 1, 'Touchdown sink rate ' + AC.fmt(vs, 2) + ' m/s. ' + (vs < 1 ? 'Butter-smooth!' : 'Firm but safe.'));
          }
        }
      },
    },
  ];
  const MR = AC.missions({ game: 'sky', week: 1, list: missions });

  // ---------------------------------------------------------------- tools / keys / help
  const airBtnLabel = () => (air === 'entebbe' ? 'Air: Entebbe' : 'Air: sea level');
  AC.ui.tools([
    { label: 'Camera', title: 'Change camera (C)', onclick: cycleCam },
    { label: 'Forces', title: 'Show / hide force arrows (F)', onclick: () => (showForces = !showForces) },
    {
      label: airBtnLabel(), title: 'Switch air density', onclick: (btn) => {
        air = air === 'entebbe' ? 'sea' : 'entebbe';
        btn.textContent = airBtnLabel();
        AC.fact('Air density changed', DENS[air].name + ': ρ = ' + rho() + ' kg/m³. Take-off speed is now ' + AC.fmt(vTakeoff(), 1) + ' m/s.', { tag: 'Experiment' });
      },
    },
    { label: 'Restart', title: 'Restart mission (R)', onclick: () => MR.api.restart() },
  ]);
  AC.onKey('KeyC', cycleCam);
  AC.onKey('KeyF', () => (showForces = !showForces));
  AC.onKey('KeyR', () => MR.api.restart());
  AC.ui.hint('<kbd>W</kbd><kbd>S</kbd> throttle · <kbd>↓</kbd> nose up · <kbd>↑</kbd> nose down · <kbd>←</kbd><kbd>→</kbd> roll · <kbd>A</kbd><kbd>D</kbd> rudder · <kbd>B</kbd> brake');
  function help() {
    AC.ui.card({
      eyebrow: 'How to fly', title: 'Sky School controls',
      body: [
        'You fly like a real pilot: pull the stick back (↓) to raise the nose, push it forward (↑) to lower it.',
        AC.ui.learnGrid([
          { t: 'Throttle', p: 'W / S. Throttle controls thrust.' },
          { t: 'Elevator', p: '↓ pull = nose up. ↑ push = nose down.' },
          { t: 'Ailerons', p: '← / → roll the wings to bank and turn.' },
          { t: 'Rudder', p: 'A / D yaw the nose, and steer on the runway. B = brakes.' },
        ]),
        'Green arrow = lift, orange = weight, blue = thrust, red = drag. Use the Side view camera to see them clearly.',
      ],
    });
  }

  // ---------------------------------------------------------------- loop
  S.onFrame((dt) => {
    if (dt > 0) {
      if (P.crashed) {
        crashTimer -= dt;
        if (crashTimer <= 0 && crashTimer > -1) { crashTimer = -2; MR.api.fail(crashMsg); }
      } else {
        readInput(dt);
        const n = Math.max(4, Math.ceil(dt / 0.01));
        for (let i = 0; i < n && !P.crashed; i++) step(dt / n);
        teach();
      }
    }
    MR.update(dt);
    visuals(dt);
    hudUpdate();
    cameraUpdate(dt);
  });
  place(0, CLR, -660, 0, 0);
  S.start();
  MR.begin();
})();
