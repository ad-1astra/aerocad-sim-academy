/* AeroCAD Sim Academy — hub: pilots, course map, live hero scene */
(function () {
  'use strict';
  const { h } = AC;

  const GAMES = {
    sky: { name: 'Sky School', url: 'sky.html', missions: ['forces', 'takeoff', 'stall', 'rings', 'landing'] },
    stab: { name: 'Stability Hangar', url: 'stability.html', missions: ['beam', 'drone', 'tunnel', 'controls', 'night'] },
    quad: { name: 'Quad Pilot', url: 'quad.html', missions: ['lab', 'hover', 'rings', 'delivery', 'design'] },
    struct: { name: 'Strong & Light', url: 'structures.html', missions: ['arm', 'truss', 'materials'] },
    auto: { name: 'Autopilot Lab', url: 'autopilot.html', missions: ['pd', 'pid', 'gps'] },
    rocket: { name: 'Launch Pad', url: 'rocket.html', missions: ['hop', 'karman', 'orbit'] },
    orbit: { name: 'Orbit Lab', url: 'orbit.html', missions: ['cannon', 'higher', 'geo', 'escape'] },
    planets: { name: 'Planet Hopper', url: 'planets.html', missions: ['order', 'jump', 'drop', 'lander'] },
    code: { name: 'Code Pilot', url: 'code.html', missions: ['f1', 'f2', 'f3', 'f4', 'b1', 'b2'] },
  };
  const WEEKS = [
    { n: 1, date: '2026-10-10', title: 'Foundations of Flight', idea: 'Flight is a balance of four force vectors.', games: [['sky', ['forces', 'landing'], 'Four Forces · Land at Entebbe']] },
    { n: 2, date: '2026-10-17', title: 'Aerodynamics & Wing Design', idea: 'Lift depends on air density, speed², wing area and C_L.', games: [['sky', ['takeoff', 'stall'], 'Take-off at Entebbe · Stall Lab']] },
    { n: 3, date: '2026-10-24', title: 'Stability & Control', idea: 'Stable when the CG is ahead of the neutral point; steered by moments.', games: [['stab', null, 'Balance beam, drone CG, wind tunnel, controls, night lights'], ['sky', ['rings'], 'Sky Rings: all three control surfaces']] },
    { n: 4, date: '2026-10-31', title: 'Propulsion & Multirotors', idea: 'A multirotor flies by precisely varying the thrust of each rotor.', games: [['quad', null, 'Motor lab, hover, rings, medicine run, design review']] },
    { n: 5, date: '2026-11-07', title: 'Structures, Materials & Manufacturing', idea: 'A fight for the best strength-to-weight ratio.', games: [['struct', null, 'Arm load test, triangle trusses, material match']] },
    { n: 6, date: '2026-11-14', title: 'Avionics Systems & Autopilots', idea: 'Sensors measure, computers decide, actuators correct.', games: [['auto', null, 'PD and PID altitude hold, GPS fix over Uganda']] },
    { n: 7, date: '2026-11-21', title: 'Rockets, Orbits & Space Systems', idea: 'Orbit means going sideways fast enough to keep falling around Earth.', games: [['rocket', null, 'T/W, Kármán line, staging to orbit'], ['orbit', null, 'Newton\'s cannon, GPS & geostationary orbits'], ['planets', null, 'Planet order, gravity jumps, Moon & Mars landers']] },
    { n: 8, date: '2026-11-28', title: 'Design Review & Showcase', idea: 'Engineering is not finished until it is tested, documented and communicated.', games: [], final: true },
  ];
  const total = Object.values(GAMES).reduce((s, g) => s + g.missions.length, 0);
  const chip = document.querySelector('.hud-chip');
  if (chip) chip.textContent = '◆ 9 GAMES · ' + total + ' MISSIONS · TESTS YOU PLAY';

  const starsOf = (game, ids) => (ids || GAMES[game].missions).reduce((s, id) => s + AC.starsFor(game, id), 0);
  const starStr = (got, max) => { const el = h('span', { class: 'st' }); el.innerHTML = '★'.repeat(Math.round((got / max) * 5)) + '<i>' + '★'.repeat(5 - Math.round((got / max) * 5)) + '</i> ' + got + '/' + max; return el; };

  // ---------------------------------------------------------------- pilots
  const pilotsEl = document.getElementById('pilots');
  function pilotStars(p) { return Object.values(p.stars || {}).reduce((s, v) => s + v, 0); }
  function renderPilots() {
    pilotsEl.innerHTML = '';
    AC.data.pilots.forEach((p, i) => {
      const inp = h('input', { type: 'text', value: p.name, maxlength: 18, 'aria-label': 'Pilot ' + (i + 1) + ' name', id: 'pilot-name-' + i });
      inp.addEventListener('click', (e) => e.stopPropagation());
      inp.addEventListener('change', () => { p.name = inp.value.trim() || 'Pilot ' + (i + 1); AC.save(); renderPilots(); });
      const card = h('div', { class: 'pilot' + (i === AC.data.cur ? ' on' : ''), role: 'button', tabindex: 0 },
        h('span', { class: 'act' }, i === AC.data.cur ? '● Flying now' : 'Tap to fly as this pilot'),
        inp,
        h('div', { class: 'stats' }, h('span', {}, h('b', {}, String(p.xp || 0)), ' XP'), h('span', {}, h('b', {}, String(pilotStars(p))), ' ★'), h('span', {}, h('b', {}, String(Object.values(p.log || {}).reduce((s, l) => s + l.length, 0))), ' facts')));
      const pick = () => { AC.data.cur = i; AC.save(); renderPilots(); renderWeeks(); AC.audio.click(); };
      card.addEventListener('click', pick);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      pilotsEl.appendChild(card);
    });
    if (AC.data.pilots.length < 4) {
      const add = h('button', { class: 'pilot add', type: 'button' }, '+ Add a pilot');
      add.addEventListener('click', () => { AC.data.pilots.push(AC.blankPilot('Pilot ' + (AC.data.pilots.length + 1))); AC.save(); renderPilots(); });
      pilotsEl.appendChild(add);
    }
  }

  // ---------------------------------------------------------------- course map
  const weeksEl = document.getElementById('weeks');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nowIdx = WEEKS.findIndex((w) => new Date(w.date + 'T23:59:59') >= today);
  function renderWeeks() {
    weeksEl.innerHTML = '';
    WEEKS.forEach((w, i) => {
      const d = new Date(w.date + 'T09:00:00');
      const dateTxt = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      let got = 0, max = 0;
      w.games.forEach(([g, ids]) => { got += starsOf(g, ids); max += (ids || GAMES[g].missions).length * 3; });
      const days = Math.round((d - today) / 86400000);
      let pill;
      if (i === nowIdx) pill = h('span', { class: 'pill now' }, days <= 0 ? 'Today' : days <= 6 ? 'This Saturday' : 'Next');
      else if (i < nowIdx || nowIdx < 0) pill = max && got >= max * 0.6 ? h('span', { class: 'pill done' }, 'Done') : h('span', { class: 'pill past' }, 'Catch up');
      else pill = h('span', { class: 'pill next' }, 'Coming');
      const games = h('div', { class: 'games' });
      w.games.forEach(([g, ids, sub]) => {
        const m = (ids || GAMES[g].missions).length * 3;
        games.appendChild(h('a', { class: 'g', href: GAMES[g].url }, h('b', {}, GAMES[g].name), starStr(starsOf(g, ids), m), h('small', {}, sub)));
      });
      if (w.final) {
        games.appendChild(h('a', { class: 'g', href: 'arena.html#all' }, h('b', {}, 'Final exam'), h('span', {}), h('small', {}, 'Gate Runner with questions from every week')));
        games.appendChild(h('a', { class: 'g', href: 'arena.html#all' }, h('b', {}, 'Showcase Quiz Duel'), h('span', {}), h('small', {}, 'Pilot vs pilot in front of your guests')));
      }
      const card = h('article', { class: 'wk' + (i === nowIdx ? ' now' : '') },
        h('div', { class: 'top' }, h('span', { class: 'num' }, 'Week ' + w.n + ' · ' + dateTxt), pill),
        h('h3', {}, w.title),
        h('p', { class: 'idea' }, w.idea),
        games,
        w.final ? null : h('a', { class: 'test', href: 'arena.html#w' + w.n }, '▸ Take the Week ' + w.n + ' test'));
      weeksEl.appendChild(card);
    });
    const cs = document.getElementById('code-stars');
    if (cs) { cs.innerHTML = ''; cs.appendChild(starStr(starsOf('code'), GAMES.code.missions.length * 3)); }
    const cur = WEEKS[nowIdx] || WEEKS[3];
    const go = document.getElementById('go-now');
    if (go && cur.games[0]) { go.href = GAMES[cur.games[0][0]].url; go.textContent = 'Play Week ' + cur.n + ': ' + GAMES[cur.games[0][0]].name; }
  }

  // ---------------------------------------------------------------- reset (two-step, no browser dialog)
  const reset = document.getElementById('reset');
  let armed = 0;
  reset.addEventListener('click', () => {
    if (!armed) { armed = setTimeout(() => { armed = 0; reset.textContent = 'Reset all progress…'; }, 4000); reset.textContent = 'Click again to erase all pilots and stars'; return; }
    clearTimeout(armed); armed = 0;
    AC.data.pilots = [AC.blankPilot('Pilot 1'), AC.blankPilot('Pilot 2')];
    AC.data.cur = 0;
    AC.save();
    reset.textContent = 'Progress erased';
    renderPilots(); renderWeeks();
  });

  renderPilots();
  renderWeeks();

  // ---------------------------------------------------------------- hero scene
  if (!window.THREE) return;
  const S = AC.scene({ host: document.getElementById('stage'), fov: 40, near: 0.1, far: 500, alpha: true });
  const { scene, camera } = S;
  S.renderer.setClearColor(0x000000, 0);
  AC.lights(scene, { sky: 0x9fb3d0, ground: 0x101418, hemi: 0.45, sun: 1.3, dir: [-6, 3, 5] });
  AC.starfield(scene, 1200, 200, 1.4);
  const world = new THREE.Group();
  scene.add(world);
  const earth = AC.models.planet('earth', 2.2, 64);
  world.add(earth);
  const moon = AC.models.planet('moon', 0.45, 32);
  moon.position.set(3.2, 2.3, -3);
  world.add(moon);
  // PearlAfricaSat-1 in a tilted orbit
  const satOrbit = new THREE.Group();
  satOrbit.rotation.set(0.5, 0, 0.35);
  world.add(satOrbit);
  const sat = AC.models.cubesat();
  sat.scale.setScalar(0.22);
  satOrbit.add(sat);
  const satTag = S.tag('PearlAfricaSat-1', 'var(--amber)');
  // aircraft circling low
  const planeOrbit = new THREE.Group();
  planeOrbit.rotation.set(-0.3, 0, -0.2);
  world.add(planeOrbit);
  const plane = AC.models.plane();
  plane.scale.setScalar(0.045);
  planeOrbit.add(plane);
  // a quadcopter hovering near Kampala
  const quad = AC.models.quad();
  quad.scale.setScalar(0.9);
  world.add(quad);
  // rocket that launches again and again
  const rocket = new THREE.Group();
  const st = AC.models.rocketStage({ r: 0.05, len: 0.5, fins: true, bell: 0.05 });
  rocket.add(st);
  const fair = AC.models.fairing(0.05, 0.18);
  fair.position.y = 0.5;
  rocket.add(fair);
  const fl = AC.models.flame(0.04, 0.3);
  fl.position.y = -0.05;
  rocket.add(fl);
  world.add(rocket);
  const place = () => { const wide = S.host.clientWidth > 760; world.position.set(wide ? 2.6 : 0, wide ? -0.1 : -0.6, 0); };
  place();
  window.addEventListener('resize', place);
  camera.position.set(0, 1.2, 10.5);
  camera.lookAt(0, 0, 0);
  const tmp = new THREE.Vector3();
  S.onFrame((dt, t, real) => {
    const T = performance.now() / 1000;
    earth.rotation.y += real * 0.06;
    if (earth.userData.clouds) earth.userData.clouds.rotation.y += real * 0.015;
    sat.position.set(Math.cos(T * 0.5) * 3.3, 0, Math.sin(T * 0.5) * 3.3);
    sat.rotation.y = T;
    sat.getWorldPosition(satTag.pos);
    satTag.pos.y += 0.35;
    satTag.visible = S.host.clientWidth > 760;
    const a = T * 0.35;
    plane.position.set(Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6);
    plane.rotation.set(0, -a, -0.35); // nose along the orbit, banked into the turn
    plane.userData.prop.rotation.z += real * 30;
    quad.position.set(0.35, 2.32 + Math.sin(T * 2) * 0.03, 1.0);
    quad.lookAt(0, 3, 6);
    quad.userData.props.forEach((p, i) => (p.rotation.y += real * 40 * quad.userData.spinDir[i]));
    const k = (T * 0.18) % 1;
    const up = new THREE.Vector3(-0.55, 0.75, 0.38).normalize();
    rocket.position.copy(up).multiplyScalar(2.2 + k * 3.2);
    rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    rocket.visible = k < 0.9;
    fl.scale.setScalar(0.8 + Math.random() * 0.4);
    moon.rotation.y += real * 0.05;
  });
  S.start();
})();
