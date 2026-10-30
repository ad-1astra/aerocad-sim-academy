/* Autopilot Lab — Week 6 · Avionics systems & autopilots
   The Week 6 altitude-hold simulation (P, PD, PID) with a live graph, plus GPS trilateration over Uganda. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  const V3 = THREE.Vector3;
  AC.boot({ game: 'auto', week: 6, topic: 'Avionics & Autopilots', title: 'Autopilot Lab', help: () => help() });
  const S = AC.scene({ fov: 50, near: 0.05, far: 1500, background: 0x8fc4ea, shadows: true });
  const { scene, camera, renderer } = S;
  const lights = AC.lights(scene, { shadows: true, shadowSize: 12, dir: [10, 30, 8] });
  const sky = AC.skyDome(scene, 0x2c78c8, 0xd6ecf7, 0x5b7a4a, 1000);
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 24, min: 6, max: 80, phi: 1.35, theta: 0.6 });

  // ---------------------------------------------------------------- altitude test site
  const site = new THREE.Group();
  scene.add(site);
  AC.models.field(site, 300);
  const pad = AC.models.pad('H', 0xffb547, 1.2);
  site.add(pad);
  const pole = new THREE.Group();
  for (let m = 0; m <= 15; m++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(m % 5 === 0 ? 0.6 : 0.3, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    tick.position.set(-2.4, m, 0);
    pole.add(tick);
    if (m % 5 === 0) { const t = AC.textSprite(m + ' m', { color: '#ffffff', size: 0.5 }); t.position.set(-3.3, m, 0); pole.add(t); }
  }
  pole.add(AC.models.mesh(new THREE.CylinderGeometry(0.05, 0.05, 15, 8), AC.models.mat(0xdfe5ea), -2.2, 7.5, 0));
  const targetLine = new THREE.Mesh(new THREE.BoxGeometry(6, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: 0xff70d8 }));
  targetLine.position.set(0, 10, 0);
  pole.add(targetLine);
  const tTag = AC.textSprite('TARGET 10 m', { color: '#ff70d8', size: 0.55 });
  tTag.position.set(2.2, 10.4, 0);
  pole.add(tTag);
  site.add(pole);
  const drone = AC.models.quad({ arm: 0.225 });
  drone.scale.setScalar(2.2);
  drone.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  site.add(drone);
  const thrustArrow = new AC.Arrow(scene, 0x3fd0f0, { width: 0.05 });
  const weightArrow = new AC.Arrow(scene, 0xffb547, { width: 0.05 });
  const gustArrow = new AC.Arrow(scene, 0xff5a4f, { width: 0.07 });

  // the exact model from the Week 6 Python lab
  function simulate({ Kp, Kd, Ki = 0, massMul = 1, gust = false }) {
    const mNom = 1.0, m = mNom * massMul, g = 9.81, dt = 0.05, target = 10;
    let hgt = 0, v = 0, I = 0;
    const out = [];
    for (let step = 0; step < 600; step++) {
      const t = step * dt, e = target - hgt;
      I += e * dt;
      let thrust = mNom * g + Kp * e - Kd * v + Ki * I; // hover thrust + correction
      thrust = Math.max(0, Math.min(thrust, 2 * mNom * g)); // motor limits (T/W = 2)
      let a = (thrust - m * g) / m;
      const gusting = gust && t >= 10 && t < 10.5;
      if (gusting) a -= 3;
      v += a * dt;
      hgt += v * dt;
      if (hgt < 0) { hgt = 0; v = Math.max(0, v); }
      out.push({ t, h: hgt, thrust, e, gusting, P: Kp * e, D: -Kd * v, I: Ki * I });
    }
    let rise = null, peak = 0, settle = 0;
    out.forEach((p) => { if (rise === null && p.h >= 9.5) rise = p.t; peak = Math.max(peak, p.h); if (Math.abs(p.h - 10) > 0.2) settle = p.t + 0.05; });
    return { out, rise, over: Math.max(0, ((peak - 10) / 10) * 100), settle, final: out[out.length - 1].h };
  }

  // ---------------------------------------------------------------- GPS map of Uganda (stylised)
  const gps = new THREE.Group();
  gps.visible = false;
  scene.add(gps);
  const LON0 = 29.5, LON1 = 35.0, LAT0 = -1.6, LAT1 = 4.3, MAPW = 40, MAPH = (MAPW * (LAT1 - LAT0)) / (LON1 - LON0);
  const CITIES = [
    { n: 'Kampala', lon: 32.58, lat: 0.35 }, { n: 'Entebbe', lon: 32.46, lat: 0.06 }, { n: 'Jinja', lon: 33.2, lat: 0.45 },
    { n: 'Gulu', lon: 32.3, lat: 2.78 }, { n: 'Mbarara', lon: 30.65, lat: -0.61 }, { n: 'Mbale', lon: 34.18, lat: 1.08 },
    { n: 'Fort Portal', lon: 30.27, lat: 0.67 }, { n: 'Lira', lon: 32.9, lat: 2.25 }, { n: 'Arua', lon: 30.91, lat: 3.02 },
  ];
  const toMap = (lon, lat) => new V3(((lon - LON0) / (LON1 - LON0) - 0.5) * MAPW, 0.05, -((lat - LAT0) / (LAT1 - LAT0) - 0.5) * MAPH);
  const mapTex = AC.canvasTex(1024, Math.round((1024 * MAPH) / MAPW), (g, w, hh) => {
    const X = (lon) => ((lon - LON0) / (LON1 - LON0)) * w, Y = (lat) => ((LAT1 - lat) / (LAT1 - LAT0)) * hh;
    g.fillStyle = '#6f8f4a'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 5000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(60,90,40,0.25)' : 'rgba(150,140,90,0.2)'; g.fillRect(Math.random() * w, Math.random() * hh, 3, 3); }
    g.fillStyle = '#2f6f9a';
    const lake = (lon, lat, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(X(lon), Y(lat), (rx / (LON1 - LON0)) * w, (ry / (LAT1 - LAT0)) * hh, rot, 0, Math.PI * 2); g.fill(); };
    lake(33.1, -1.1, 1.6, 1.25); lake(32.9, 1.55, 0.6, 0.18, -0.2); lake(31.1, 1.9, 0.18, 0.55, 0.6); lake(29.85, -0.3, 0.2, 0.18);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
    for (let lo = 30; lo <= 35; lo++) { g.beginPath(); g.moveTo(X(lo), 0); g.lineTo(X(lo), hh); g.stroke(); }
    for (let la = -1; la <= 4; la++) { g.beginPath(); g.moveTo(0, Y(la)); g.lineTo(w, Y(la)); g.stroke(); }
    g.strokeStyle = 'rgba(255,215,90,0.9)'; g.setLineDash([10, 8]); g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,215,90,0.95)'; g.font = 'bold 20px "B612 Mono", monospace'; g.fillText('EQUATOR 0°', 12, Y(0) - 8);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = 'bold 26px "Chakra Petch", sans-serif'; g.fillText('Lake Victoria', X(32.4), Y(-1.2));
    CITIES.forEach((c) => { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X(c.lon), Y(c.lat), 6, 0, Math.PI * 2); g.fill(); g.font = 'bold 22px "Atkinson Hyperlegible", sans-serif'; g.fillText(c.n, X(c.lon) + 10, Y(c.lat) - 8); });
  });
  const map = new THREE.Mesh(new THREE.PlaneGeometry(MAPW, MAPH), new THREE.MeshLambertMaterial({ map: mapTex }));
  map.rotation.x = -Math.PI / 2;
  gps.add(map);
  const circles = new THREE.Group();
  gps.add(circles);
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 16), new THREE.MeshBasicMaterial({ color: 0xff70d8 }));
  marker.rotation.x = Math.PI;
  marker.visible = false;
  gps.add(marker);
  const satSprites = [];
  function drawCircles(sats, rx) {
    circles.clear();
    satSprites.forEach((s) => s.tag.el.remove());
    satSprites.length = 0;
    sats.forEach((s, i) => {
      const pts = [];
      const rad = s.p.distanceTo(rx);
      for (let k = 0; k <= 160; k++) { const a = (k / 160) * Math.PI * 2; pts.push(new V3(s.p.x + Math.cos(a) * rad, 0.12, s.p.z + Math.sin(a) * rad)); }
      const col = [0x3fd0f0, 0xffb547, 0x4be38a][i];
      circles.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col })));
      const sat = AC.models.gpssat();
      sat.scale.setScalar(0.5);
      sat.position.copy(s.p).setY(6);
      circles.add(sat);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6, 6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6 }));
      stem.position.copy(s.p).setY(3);
      circles.add(stem);
      const tag = S.tag('', ['var(--cyan)', 'var(--amber)', 'var(--green)'][i]);
      tag.pos.copy(s.p).setY(7.3);
      const km = (rad / MAPW) * (LON1 - LON0) * 111;
      tag.set('SAT ' + (i + 1) + ' · ' + AC.fmt((km / 300000) * 1000, 3) + ' ms → ' + AC.fmt(km) + ' km');
      satSprites.push({ tag, km });
    });
  }

  // ---------------------------------------------------------------- panels / HUD
  let hud = null, panel = null, graph = null;
  function newHud() { if (hud) hud.el.remove(); hud = AC.ui.hud(); return hud; }
  function clearPanel() { if (panel) panel.remove(); panel = null; }
  const run = { res: null, k: 0, playing: false };
  function slider(id, label, min, max, step, val, onChange) {
    const out = h('output', {}, String(val));
    const s = h('input', { type: 'range', id, min, max, step, value: val });
    s.addEventListener('input', () => { out.textContent = s.value; onChange(+s.value); });
    return h('div', { class: 'ac-field' }, h('label', { for: id }, label, out), s);
  }
  function pidHud(api, cfg) {
    newHud();
    hud.section('Controller gains');
    hud.add(slider('kp', 'Kp (proportional)', 0, 10, 0.5, cfg.Kp, (v) => (cfg.Kp = v)));
    hud.add(slider('kd', 'Kd (derivative)', 0, 6, 0.5, cfg.Kd, (v) => (cfg.Kd = v)));
    if (cfg.useKi) hud.add(slider('ki', 'Ki (integral)', 0, 3, 0.25, cfg.Ki, (v) => (cfg.Ki = v)));
    const go = h('button', { class: 'ac-btn', type: 'button', style: { width: '100%', marginTop: '6px' } }, '▶ Run 30 s flight');
    go.addEventListener('click', () => { if (run.playing) return; run.res = simulate(cfg); run.k = 0; run.playing = true; api.state.runs = (api.state.runs || 0) + 1; AC.audio.whoosh(); });
    hud.add(go);
    hud.formula('law', '');
    hud.section('Altitude (m) vs time (s)');
    graph = new AC.Graph(hud.canvas('alt'), { xMin: 0, xMax: 30, yMin: 0, yMax: 20, xLabel: 't (s)', yLabel: 'h', xTicks: 6, yTicks: 4 });
    hud.row('rise', 'Time to reach 9.5 m').row('over', 'Overshoot').row('settle', 'Settled (±0.2 m) at').row('final', 'Height at 30 s');
    graph.draw({ hlines: [{ y: 10, color: AC.css('--magenta'), label: 'target' }] });
  }
  function lawText(cfg, p) {
    const e = p ? p.e : 10;
    return 'thrust = m·g + Kp·e − Kd·v' + (cfg.useKi ? ' + Ki·∫e' : '') + '\ne = target − height = ' + AC.fmt(e, 2) + ' m' + (p ? '\nP = ' + AC.fmt(p.P, 2) + ' · D = ' + AC.fmt(p.D, 2) + (cfg.useKi ? ' · I = ' + AC.fmt(p.I, 2) : '') + ' N' : '');
  }
  function playRun(dt, cfg, api, judge) {
    if (!run.playing || !run.res) return;
    run.k = Math.min(run.res.out.length - 1, run.k + Math.max(1, Math.round((dt * 3) / 0.05)));
    const p = run.res.out[run.k];
    drone.position.set(0, p.h + 0.35, 0);
    drone.rotation.z = p.gusting ? 0.25 : 0;
    ud.props.forEach((pr, i) => (pr.rotation.y -= ud.spinDir[i] * (20 + p.thrust * 3) * dt));
    thrustArrow.set(drone.position.clone().add(new V3(0, 0.4, 0)), new V3(0, p.thrust, 0), 0.12);
    weightArrow.set(drone.position, new V3(0, -9.81 * (cfg.massMul || 1), 0), 0.12);
    if (p.gusting) gustArrow.set(drone.position.clone().add(new V3(1.5, 2, 0)), new V3(0, -3, 0), 0.4); else gustArrow.hide();
    hud.setFormula('law', lawText(cfg, p));
    graph.draw({ series: [{ pts: run.res.out.slice(0, run.k + 1).map((q) => [q.t, q.h]), color: AC.css('--cyan') }], hlines: [{ y: 10, color: AC.css('--magenta'), label: 'target' }], vlines: cfg.gust ? [{ x: 10, color: AC.css('--red'), label: 'gust' }] : [] });
    oc.target.set(0, Math.max(4, p.h * 0.7), 0);
    if (run.k >= run.res.out.length - 1) {
      run.playing = false;
      const r = run.res;
      hud.set('rise', r.rise != null ? AC.fmt(r.rise, 2) + ' s' : 'never', r.rise != null && r.rise < 4 ? '' : 'warn');
      hud.set('over', AC.fmt(r.over, 1) + ' %', r.over < 5 ? '' : 'warn');
      hud.set('settle', r.settle >= 29.9 ? 'never' : AC.fmt(r.settle, 1) + ' s');
      hud.set('final', AC.fmt(r.final, 2) + ' m', Math.abs(r.final - 10) < 0.05 ? '' : 'warn');
      judge(r);
    }
  }

  // ---------------------------------------------------------------- missions
  const ud = drone.userData;
  const cfg1 = { Kp: 2, Kd: 0 }, cfg2 = { Kp: 6, Kd: 3.5, Ki: 0, useKi: true, massMul: 1.1, gust: true };
  function showSite(on) { site.visible = on; gps.visible = !on; sky.visible = on; scene.background = new THREE.Color(on ? 0x8fc4ea : 0x0d1b2e); thrustArrow.hide(); weightArrow.hide(); gustArrow.hide(); }
  const missions = [
    {
      id: 'pd', title: 'Altitude Hold', objective: 'Tune the autopilot: reach 10 m in under 4 s with less than 5% overshoot',
      story: 'This is the 1 kg drone from your Week 6 Python lab. The autopilot measures the height error and adjusts thrust. Start with Kp = 2 and Kd = 0 and press Run. Then add D to calm it down.',
      learn: [
        { t: 'P: present', p: 'Thrust correction proportional to the error. Too much P makes it bounce up and down.', f: 'P = Kp × e' },
        { t: 'D: damping', p: 'Reacts to how fast you are moving and brakes before you overshoot.', f: 'D = −Kd × v' },
        { t: 'Closed loop', p: 'Sense (height) → think (PID) → act (thrust), 20 times a second.' },
      ],
      controls: ['Move the sliders', 'Press <b>▶ Run 30 s flight</b>', 'Read the graph'],
      proved: 'P alone oscillates forever because nothing brakes the drone. The D term predicts the motion and damps it. Engineers tune gains for a fast rise with little overshoot: exactly your Week 6 engineering challenge.',
      tip: 'Try Kp around 5–6 and raise Kd until the bounce disappears (about 3–3.5).',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('What does the D (derivative)')),
      start(api) {
        cleanup(); showSite(true);
        cfg1.Kp = 2; cfg1.Kd = 0;
        pidHud(api, cfg1);
        hud.setFormula('law', lawText(cfg1));
        drone.position.set(0, 0.35, 0);
      },
      update(dt, api) {
        playRun(dt, cfg1, api, (r) => {
          const ok = r.rise != null && r.rise < 4 && r.over < 5;
          AC.fact(ok ? 'Challenge met' : r.over >= 5 ? 'Too much overshoot' : 'Too slow', 'Rise ' + (r.rise != null ? AC.fmt(r.rise, 2) + ' s' : 'never') + ', overshoot ' + AC.fmt(r.over, 1) + '%. ' + (ok ? '' : r.over >= 5 ? 'Add more Kd to brake earlier.' : 'Raise Kp for more push.'), { color: ok ? 'var(--green)' : 'var(--amber)', tag: 'Run ' + api.state.runs });
          if (ok) api.win(r.settle < 3 ? 3 : r.settle < 5 ? 2 : 1, 'Kp = ' + cfg1.Kp + ', Kd = ' + cfg1.Kd + ': rise ' + AC.fmt(r.rise, 2) + ' s, overshoot ' + AC.fmt(r.over, 1) + '%, settled at ' + AC.fmt(r.settle, 1) + ' s.');
        });
        api.progress(run.playing ? run.k / 600 : 0, run.playing ? 'Flying…' : 'Runs: ' + (api.state.runs || 0));
      },
    },
    {
      id: 'pid', title: 'Heavy Battery', objective: 'With a heavier battery and a gust, end exactly on 10 m (±0.05 m)',
      story: 'The new battery is 10% heavier than the autopilot thinks, and a wind gust hits at t = 10 s. With only P and D the drone settles a little too low. Add the I term to remove that steady error.',
      learn: [
        { t: 'Steady offset', p: 'P and D only push when there is an error, so a constant extra weight leaves a constant error.' },
        { t: 'I: memory', p: 'The integral adds up the error over time and keeps pushing until it is gone.', f: 'I = Ki × ∫e dt' },
        { t: 'Do not overdo it', p: 'Too much Ki winds up and causes big overshoot. Keep overshoot under 25%.' },
      ],
      controls: ['Move the sliders', 'Press <b>▶ Run 30 s flight</b>'],
      proved: 'P reacts to the present, D predicts the future, I remembers the past. Real flight controllers on every drone and airliner autopilot use PID loops like this one, thousands of times per second.',
      tip: 'Keep Kp = 6 and Kd = 3.5, then try Ki = 1.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('The I (integral)')),
      start(api) {
        cleanup(); showSite(true);
        cfg2.Kp = 6; cfg2.Kd = 3.5; cfg2.Ki = 0;
        pidHud(api, cfg2);
        hud.setFormula('law', lawText(cfg2));
        drone.position.set(0, 0.35, 0);
      },
      update(dt, api) {
        playRun(dt, cfg2, api, (r) => {
          const ok = Math.abs(r.final - 10) < 0.05 && r.over < 25;
          AC.fact(ok ? 'Locked on' : Math.abs(r.final - 10) >= 0.05 ? 'Steady error' : 'Too much overshoot', 'Final height ' + AC.fmt(r.final, 2) + ' m, overshoot ' + AC.fmt(r.over, 1) + '%.' + (ok ? '' : Math.abs(r.final - 10) >= 0.05 ? ' Add some Ki.' : ' Use less Ki.'), { color: ok ? 'var(--green)' : 'var(--amber)', tag: 'Run ' + api.state.runs });
          if (ok) api.win(r.over < 15 ? 3 : r.over < 20 ? 2 : 1, 'Ki = ' + cfg2.Ki + ' removed the error: ' + AC.fmt(r.final, 2) + ' m at 30 s, overshoot ' + AC.fmt(r.over, 1) + '%.');
        });
        api.progress(run.playing ? run.k / 600 : 0, run.playing ? 'Flying…' : 'Runs: ' + (api.state.runs || 0));
      },
    },
    {
      id: 'gps', title: 'GPS Fix', objective: 'Find 3 receivers by clicking where the satellite circles cross',
      story: 'A GPS receiver measures how long each satellite signal took to arrive. Distance = speed of light × time, so each satellite gives a circle of possible positions. Click where the circles meet.',
      learn: [
        { t: 'Distance from time', p: 'Radio waves travel at the speed of light.', f: 'd = c × t = 300,000 km/s × t' },
        { t: 'Trilateration', p: 'One circle: anywhere on it. Two: two points. Three: one point.' },
        { t: 'Why 4 satellites?', p: 'In 3D you need three, plus one more to fix the receiver\'s cheap clock.' },
      ],
      controls: ['Click the map where all three circles cross', 'Drag to look around'],
      proved: 'Your phone does this every second: it measures signal times from at least four satellites (GPS, Galileo, GLONASS or BeiDou), works out the distances and solves for latitude, longitude, height and its own clock error.',
      quiz: AC.QUESTIONS.find((q) => q.q.startsWith('Why does GPS need')),
      start(api) {
        cleanup(); showSite(false);
        oc.target.set(0, 0, 0); oc.dist = 52; oc.phi = 0.35; oc.theta = 0;
        newHud().section('Signal maths').formula('c', 'd = c × t\nc = 300,000 km/s\n1 ms of travel = 300 km');
        hud.section('Found').row('found', 'Receivers', '0 of 3');
        api.state.round = 0; api.state.miss = 0;
        gpsRound(api);
      },
      update() { marker.rotation.y += 0.05; },
    },
  ];
  const ROUNDS = ['Kampala', 'Gulu', 'Mbarara'];
  let gpsApi = null, gpsTruth = null;
  function gpsRound(api) {
    gpsApi = api;
    const c = CITIES.find((x) => x.n === ROUNDS[api.state.round]);
    gpsTruth = toMap(c.lon, c.lat);
    const sats = [{ p: toMap(29.9, 3.9) }, { p: toMap(34.6, 2.9) }, { p: toMap(32.2, -1.3) }].map((s, i) => ({ p: s.p.clone().add(new V3((i - 1) * 2 + api.state.round * 1.5, 0, api.state.round * 1.2)) }));
    drawCircles(sats, gpsTruth);
    marker.visible = false;
    AC.fact('Receiver ' + (api.state.round + 1), 'Three satellites, three distances. Click the one spot that is on all three circles.', { tag: 'GPS fix', ms: 5000 });
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!gpsApi || !gps.visible || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(map)[0];
    if (!hit) return;
    marker.position.copy(hit.point).setY(1);
    marker.visible = true;
    const errKm = (hit.point.distanceTo(gpsTruth) / MAPW) * (LON1 - LON0) * 111;
    const api = gpsApi;
    if (errKm < 30) {
      AC.audio.good();
      const city = ROUNDS[api.state.round];
      AC.ui.toast('FIX: ' + city.toUpperCase(), 'var(--green)');
      AC.fact('Position found', 'The receiver is in ' + city + '. Your click was ' + AC.fmt(errKm) + ' km from the exact spot.', { tag: 'GPS fix', color: 'var(--green)' });
      api.state.round++;
      hud.set('found', api.state.round + ' of 3');
      api.progress(api.state.round / 3, api.state.round + ' of 3 found');
      const st = api.state;
      setTimeout(() => { if (st !== api.state || gpsApi !== api) return; if (api.state.round >= 3) api.win(api.state.miss <= 1 ? 3 : api.state.miss <= 3 ? 2 : 1, 'Three GPS fixes with ' + api.state.miss + ' miss' + (api.state.miss === 1 ? '' : 'es') + '.'); else gpsRound(api); }, 1400);
    } else {
      api.state.miss++;
      AC.audio.bad();
      AC.fact('Not on all three circles', 'That spot is ' + AC.fmt(errKm) + ' km away from the true position. Look for where all three coloured circles cross.', { color: 'var(--amber)', tag: 'Try again' });
    }
  });
  function cleanup() { clearPanel(); run.playing = false; gpsApi = null; circles.clear(); satSprites.forEach((s) => s.tag.el.remove()); satSprites.length = 0; marker.visible = false; }
  const MR = AC.missions({ game: 'auto', week: 6, list: missions });
  function help() { AC.ui.card({ eyebrow: 'Week 6', title: 'Autopilot Lab', body: ['The altitude model is exactly the Python code from your Week 6 handout: a 1 kg drone, target 10 m, thrust limited to twice its weight. The 3D replay runs three times faster than real time.'] }); }
  AC.ui.hint('Drag to look around · scroll to zoom');
  S.onFrame((dt) => { MR.update(dt); oc.update(dt); sky.position.copy(camera.position); });
  drone.position.set(0, 0.35, 0);
  S.start();
  MR.begin();
})();
