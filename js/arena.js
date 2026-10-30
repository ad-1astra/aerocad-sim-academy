/* Test Arena — tests you play.
   Gate Runner: fly through the gate with the right answer. Quiz Duel: two players, one keyboard. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  const V3 = THREE.Vector3;
  AC.boot({ game: 'arena', topic: 'Tests you play', title: 'Test Arena', help: () => menu() });

  const S = AC.scene({ fov: 62, near: 0.1, far: 2500, background: 0x0b1a33 });
  const { scene, camera, renderer } = S;
  const lights = AC.lights(scene, { sky: 0xcfe2ff, ground: 0x1b2433, hemi: 0.9, sun: 0.9, dir: [10, 30, -20] });
  const stars = AC.starfield(scene, 2500, 1500, 1.6);
  const sky = AC.skyDome(scene, 0x1f63b0, 0xcde8f6, 0x5b7a4a, 1400);
  scene.fog = new THREE.Fog(0xcde8f6, 200, 900);

  // ---------------------------------------------------------------- themes & player craft
  const craft = { sky: AC.models.plane(), space: AC.models.ship() };
  craft.sky.scale.setScalar(0.32);
  craft.sky.traverse((o) => { if (o.isMesh && o.position.y < -0.5) o.visible = false; });
  scene.add(craft.sky, craft.space);
  let theme = 'sky', ship = craft.sky;
  function setTheme(t) {
    theme = t;
    craft.sky.visible = t === 'sky';
    craft.space.visible = t === 'space';
    ship = craft[t];
    sky.visible = t === 'sky';
    stars.visible = t === 'space';
    scene.fog = t === 'sky' ? new THREE.Fog(0xcde8f6, 200, 900) : null;
    scene.background = new THREE.Color(t === 'sky' ? 0x8fc4ea : 0x03060f);
    ground.visible = t === 'sky';
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ map: AC.canvasTex(128, 128, (g, w, hh) => { g.fillStyle = '#4f7f36'; g.fillRect(0, 0, w, hh); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.strokeRect(0, 0, w, hh); }, [200, 200]) }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -40;
  scene.add(ground);
  // floating decor (clouds in sky, asteroids in space) recycled along the track
  const decor = [];
  const decoGeo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(decoGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }));
    m.position.set((Math.random() < 0.5 ? -1 : 1) * AC.rand(22, 95), AC.rand(-25, 40), AC.rand(0, 900));
    const s = AC.rand(1.5, 5);
    m.scale.set(s * AC.rand(1, 2), s, s);
    scene.add(m);
    decor.push(m);
  }
  function tintDecor() { decor.forEach((m) => m.material.color.set(theme === 'sky' ? 0xffffff : 0x8a7f74)); }

  // ---------------------------------------------------------------- gates
  const GX = 3.2, GY = 2.3, GW = 5.6, GH = 4.0;
  function makeGate() {
    const g = new THREE.Group();
    const cols = [0xff70d8, 0x3fd0f0, 0xffb547, 0x4be38a];
    for (let i = 0; i < 4; i++) {
      const x = i % 2 === 0 ? GX : -GX, y = i < 2 ? GY : -GY;
      const frame = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: cols[i] });
      const bar = (w, hh, px, py) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.3), mat); b.position.set(px, py, 0); frame.add(b); };
      bar(GW, 0.25, 0, GH / 2); bar(GW, 0.25, 0, -GH / 2); bar(0.25, GH, GW / 2, 0); bar(0.25, GH, -GW / 2, 0);
      const letter = AC.textSprite('ABCD'[i], { color: '#ffffff', bg: null, size: 2.2, font: 'bold 60px "Chakra Petch", sans-serif' });
      letter.position.set(0, 0, 0);
      frame.add(letter);
      frame.position.set(x, y, 0);
      frame.userData.mat = mat;
      g.add(frame);
    }
    scene.add(g);
    return g;
  }
  const gate = makeGate();
  gate.visible = false;

  // ---------------------------------------------------------------- state
  const G = { mode: null, weeks: [], qs: [], qi: 0, score: 0, right: 0, shields: 3, combo: 0, speed: 24, z: 0, x: 0, y: 0, gateZ: 0, q: null, waiting: 0, over: false };
  const LS = AC.touch.stick('l', 'STEER');
  let ui = null;

  function menu(preset) {
    stopAll();
    const hash = (location.hash || '').replace('#', '');
    const pre = preset || (hash.startsWith('w') ? [hash === 'w9' ? 9 : +hash.slice(1)] : hash === 'all' ? [1, 2, 3, 4, 5, 6, 7] : [4]);
    const sel = new Set(pre.filter((w) => AC.WEEKS[w]));
    const chips = h('div', { class: 'weeks' });
    Object.keys(AC.WEEKS).map(Number).sort((a, b) => (a || 99) - (b || 99)).forEach((w) => {
      const n = AC.QUESTIONS.filter((q) => q.w === w).length;
      const b = h('button', { type: 'button', class: sel.has(w) ? 'on' : '' }, (w >= 1 && w <= 8 ? 'Week ' + w + ' · ' : '') + AC.WEEKS[w] + ' (' + n + ')');
      b.addEventListener('click', () => { sel.has(w) ? sel.delete(w) : sel.add(w); b.classList.toggle('on'); AC.audio.click(); });
      chips.appendChild(b);
    });
    const all = h('button', { class: 'ac-btn ghost small', type: 'button' }, 'Select all (final exam)');
    all.addEventListener('click', () => { [...chips.children].forEach((c) => c.classList.add('on')); Object.keys(AC.WEEKS).forEach((w) => sel.add(+w)); });
    const p1 = AC.data.pilots[0] ? AC.data.pilots[0].name : 'Player 1';
    const p2 = AC.data.pilots[1] ? AC.data.pilots[1].name : 'Player 2';
    const go = (mode) => {
      if (!sel.size) { AC.ui.toast('Pick at least one week', 'var(--amber)'); return; }
      m.close();
      start(mode, [...sel]);
    };
    const modes = h('div', { class: 'modes' },
      h('button', { type: 'button', onclick: () => go('runner') }, h('b', {}, 'Gate Runner'), h('span', {}, 'Solo · fly through the gate with the right answer. 10 questions, 3 shields.')),
      h('button', { type: 'button', onclick: () => go('duel') }, h('b', {}, 'Quiz Duel'), h('span', {}, p1 + ' vs ' + p2 + ' on one keyboard. First correct answer scores.')));
    const card = h('div', { class: 'ac-card menu', style: { width: 'min(720px, 100%)' } },
      h('div', { class: 'eyebrow' }, 'Test Arena'),
      h('h2', {}, 'Choose your test'),
      h('p', { class: 'dim' }, 'Pick the weeks to be tested on, then a game. Every answer comes with the reason why.'),
      chips, h('div', {}, all), modes);
    const m = AC.ui.modal(card);
  }

  function stopAll() {
    G.over = true;
    gate.visible = false;
    if (ui) { ui.forEach((e) => e.remove()); ui = null; }
    duelState = null;
  }

  // ---------------------------------------------------------------- Gate Runner
  function start(mode, weeks) {
    stopAll();
    G.mode = mode;
    G.weeks = weeks;
    G.qs = AC.questionsFor(weeks, 10).map(AC.shuffleQ);
    G.qi = 0; G.score = 0; G.right = 0; G.shields = 3; G.combo = 0; G.over = false;
    setTheme(weeks.every((w) => w === 7 || w === 9) ? 'space' : 'sky');
    tintDecor();
    if (mode === 'runner') startRunner(); else startDuel();
  }
  let qpanel, scoreEl;
  function startRunner() {
    G.z = 0; G.x = 0; G.y = 0; G.speed = 24;
    const q = h('div', { class: 'q' });
    const ans = h('div', { class: 'ans' });
    qpanel = h('div', { class: 'qpanel ac-panel' }, q, ans);
    qpanel.q = q; qpanel.ans = ans;
    scoreEl = h('div', { class: 'score ac-panel' });
    ui = [qpanel, scoreEl];
    ui.forEach((e) => AC.root().appendChild(e));
    AC.ui.hint('Steer with the arrow keys or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> into the gate with the right letter');
    nextGate();
  }
  function nextGate() {
    if (G.qi >= G.qs.length || G.shields <= 0) return finishRunner();
    G.q = G.qs[G.qi];
    G.gateZ = G.z + 190 + G.speed * 0.5;
    gate.position.set(0, 0, G.gateZ);
    gate.visible = true;
    gate.children.forEach((f) => f.scale.setScalar(1));
    qpanel.q.innerHTML = '';
    qpanel.q.append(h('small', {}, 'Question ' + (G.qi + 1) + ' of ' + G.qs.length + ' · ' + weekLabel(G.q.w)), G.q.q);
    qpanel.ans.innerHTML = '';
    G.q.a.forEach((a, i) => qpanel.ans.appendChild(h('div', {}, h('b', {}, 'ABCD'[i]), h('span', {}, a))));
    drawScore();
  }
  const weekLabel = (w) => (w >= 1 && w <= 8 ? 'Week ' + w : AC.WEEKS[w]);
  function drawScore() {
    scoreEl.innerHTML = '';
    scoreEl.append(h('span', { class: 'dim' }, 'SCORE'), h('span', { class: 'big' }, AC.fmt(G.score)), h('span', { class: 'shields' }, '◆'.repeat(G.shields) + '◇'.repeat(Math.max(0, 3 - G.shields))), h('span', { class: 'dim' }, 'Combo ×' + Math.max(1, G.combo)));
  }
  function passGate() {
    const idx = (G.y >= 0 ? 0 : 2) + (G.x >= 0 ? 0 : 1);
    const ok = idx === G.q.c;
    const rows = [...qpanel.ans.children];
    rows[G.q.c].classList.add('right');
    if (!ok) rows[idx].classList.add('wrong');
    if (ok) {
      G.combo++;
      G.right++;
      G.score += 100 * Math.min(G.combo, 5);
      AC.audio.good();
      AC.ui.toast(G.combo > 1 ? 'CORRECT ×' + Math.min(G.combo, 5) : 'CORRECT', 'var(--green)');
      G.speed = Math.min(40, G.speed + 1.5);
    } else {
      G.combo = 0;
      G.shields--;
      AC.audio.bad();
      AC.ui.toast('WRONG GATE', 'var(--red)');
    }
    AC.fact(ok ? 'Correct' : 'Answer: ' + 'ABCD'[G.q.c] + ', ' + G.q.a[G.q.c], G.q.x || '', { tag: weekLabel(G.q.w), color: ok ? 'var(--green)' : 'var(--amber)', ms: 6500 });
    gate.visible = false;
    G.qi++;
    G.waiting = 1.6;
    drawScore();
  }
  function finishRunner() {
    G.over = true;
    gate.visible = false;
    const pct = G.right / G.qs.length;
    const stars = pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct >= 0.5 ? 1 : 0;
    const key = G.weeks.length === 1 ? 'w' + G.weeks[0] : 'mix';
    let gained = 0;
    if (stars) gained = AC.award('arena', key, stars);
    AC.setBest('arena:' + key, G.score);
    stars ? AC.audio.win() : AC.audio.bad();
    const verdict = stars === 3 ? 'Ace pilot!' : stars === 2 ? 'Great flying' : stars === 1 ? 'You passed' : G.shields <= 0 ? 'Shields gone' : 'Keep practising';
    AC.ui.card({
      eyebrow: 'Test result · ' + G.weeks.map(weekLabel).join(', '), title: verdict,
      body: [
        h('div', { class: 'ac-stars', html: '★'.repeat(stars) + '<span class="off">' + '★'.repeat(3 - stars) + '</span>' }),
        h('p', { class: 'story' }, G.right + ' of ' + G.qs.length + ' correct · score ' + AC.fmt(G.score) + (G.shields <= 0 ? ' · ran out of shields' : '')),
        gained ? h('p', { class: 'dim mono' }, '+' + gained + ' XP for ' + AC.pilot().name) : null,
        'Read the pop-up after each gate: it says why the answer is right. Then try again to beat your score.',
      ],
      buttons: [{ label: 'Change test', ghost: true, onclick: () => menu(G.weeks) }, { label: 'Fly again', onclick: () => start('runner', G.weeks) }],
      dismiss: false,
    });
  }
  function stepRunner(dt) {
    if (G.over) return;
    const sx = AC.axis(['ArrowRight', 'KeyD'], ['ArrowLeft', 'KeyA'], -LS.x);
    const sy = AC.axis(['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW'], LS.y);
    G.x = clamp(G.x + sx * 9 * dt, -6.5, 6.5);
    G.y = clamp(G.y + sy * 7 * dt, -4.6, 4.6);
    G.z += G.speed * dt;
    if (G.waiting > 0) { G.waiting -= dt; if (G.waiting <= 0) nextGate(); }
    else if (gate.visible && G.z >= G.gateZ) passGate();
    ship.position.set(G.x, G.y, G.z);
    ship.rotation.set(-sy * 0.25, 0, -sx * 0.5);
    if (theme === 'sky') craft.sky.userData.prop.rotation.z += dt * 40;
    // highlight the gate you are lined up with
    if (gate.visible) {
      const idx = (G.y >= 0 ? 0 : 2) + (G.x >= 0 ? 0 : 1);
      gate.children.forEach((f, i) => f.scale.setScalar(i === idx ? 1.06 : 1));
    }
    decor.forEach((m) => { if (m.position.z < G.z - 30) m.position.z += 900; m.rotation.y += dt * 0.2; });
    camera.position.set(G.x * 0.6, G.y * 0.6 + 2.2, G.z - 9);
    camera.lookAt(G.x * 0.3, G.y * 0.3, G.z + 20);
    sky.position.copy(camera.position);
    ground.position.z = G.z;
    stars.position.copy(camera.position);
  }

  // ---------------------------------------------------------------- Quiz Duel
  let duelState = null;
  const KEYS = [['KeyA', 'KeyS', 'KeyD', 'KeyF'], ['KeyJ', 'KeyK', 'KeyL', 'Semicolon']];
  function startDuel() {
    const names = [AC.data.pilots[0] ? AC.data.pilots[0].name : 'Player 1', AC.data.pilots[1] ? AC.data.pilots[1].name : 'Player 2'];
    const pl = names.map((n, i) => {
      const pts = h('span', { class: 'pts' }, '0');
      const el = h('div', { class: 'pl ac-panel p' + (i + 1) }, h('span', { class: 'nm' }, n), pts, h('span', { class: 'keys' }, 'Answer keys: ' + (i === 0 ? 'A S D F' : 'J K L ;')));
      return { el, pts, score: 0, right: 0, name: n };
    });
    const timer = h('div', { class: 'timer' }, '20');
    const q = h('div', { class: 'q' });
    const ans = h('div', { class: 'ans' });
    const pads = h('div', { class: 'tpads' });
    [0, 1].forEach((p) => {
      const col = h('div', { class: 't' + (p + 1) });
      for (let i = 0; i < 4; i++) { const b = h('button', { type: 'button' }, 'ABCD'[i]); b.addEventListener('click', () => duelAnswer(p, i)); col.appendChild(b); }
      pads.appendChild(col);
    });
    const center = h('div', { class: 'center ac-panel' }, q, ans, pads);
    const wrap = h('div', { class: 'duel' }, h('div', { class: 'board' }, pl[0].el, timer, pl[1].el), center);
    ui = [wrap];
    AC.root().appendChild(wrap);
    duelState = { pl, timer, q, ans, t: 20, locked: [false, false], resolved: false, pause: 0 };
    AC.ui.hint('<b>' + names[0] + '</b>: <kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><kbd>F</kbd> · <b>' + names[1] + '</b>: <kbd>J</kbd><kbd>K</kbd><kbd>L</kbd><kbd>;</kbd>');
    duelQuestion();
  }
  function duelQuestion() {
    const D = duelState;
    if (G.qi >= G.qs.length) return finishDuel();
    G.q = G.qs[G.qi];
    D.t = 20; D.locked = [false, false]; D.resolved = false;
    D.q.innerHTML = '';
    D.q.append(h('small', {}, 'Question ' + (G.qi + 1) + ' of ' + G.qs.length + ' · ' + weekLabel(G.q.w)), G.q.q);
    D.ans.innerHTML = '';
    G.q.a.forEach((a, i) => D.ans.appendChild(h('div', {}, h('b', {}, 'ABCD'[i] + ' · ' + 'ASDF'[i] + '/' + 'JKL;'[i]), h('span', {}, a))));
    D.pl.forEach((p) => p.el.classList.remove('locked'));
  }
  function duelAnswer(p, i) {
    const D = duelState;
    if (!D || D.resolved || D.locked[p] || D.pause > 0) return;
    const ok = i === G.q.c;
    const rows = [...D.ans.children];
    if (ok) {
      D.pl[p].score += 100 + Math.round(D.t * 3);
      D.pl[p].right++;
      rows[i].classList.add('right');
      AC.audio.good();
      AC.ui.toast(D.pl[p].name + ' scores!', p === 0 ? 'var(--cyan)' : 'var(--amber)');
      resolve();
    } else {
      D.locked[p] = true;
      D.pl[p].score = Math.max(0, D.pl[p].score - 50);
      rows[i].classList.add(p === 0 ? 'p1x' : 'p2x');
      D.pl[p].el.classList.add('locked');
      AC.audio.bad();
      if (D.locked[0] && D.locked[1]) resolve();
    }
    D.pl.forEach((x) => (x.pts.textContent = x.score));
  }
  function resolve() {
    const D = duelState;
    D.resolved = true;
    [...D.ans.children][G.q.c].classList.add('right');
    AC.fact('Answer ' + 'ABCD'[G.q.c] + ': ' + G.q.a[G.q.c], G.q.x || '', { tag: weekLabel(G.q.w), ms: 5000 });
    D.pause = 3.2;
  }
  function finishDuel() {
    const D = duelState;
    G.over = true;
    const [a, b] = D.pl;
    const tie = a.score === b.score;
    const win = a.score > b.score ? a : b;
    [0, 1].forEach((i) => { if (AC.data.pilots[i]) AC.data.pilots[i].xp += D.pl[i].right * 5; });
    AC.save();
    AC.audio.win();
    AC.ui.card({
      eyebrow: 'Quiz Duel · ' + G.weeks.map(weekLabel).join(', '), title: tie ? 'It\'s a draw!' : win.name + ' wins!',
      body: [
        h('div', { class: 'pcard', style: { display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '4px 16px', fontFamily: 'var(--f-hud)' } },
          h('span', { class: 'dim' }, 'Pilot'), h('span', { class: 'dim' }, 'Correct'), h('span', { class: 'dim' }, 'Points'),
          ...D.pl.flatMap((p) => [h('span', {}, p.name), h('span', {}, p.right + ' / ' + G.qs.length), h('span', {}, AC.fmt(p.score))])),
        'Both pilots earn 5 XP for every correct answer.',
      ],
      buttons: [{ label: 'Change test', ghost: true, onclick: () => menu(G.weeks) }, { label: 'Rematch', onclick: () => start('duel', G.weeks) }],
      dismiss: false,
    });
  }
  window.addEventListener('keydown', (e) => {
    if (G.mode !== 'duel' || !duelState || e.repeat) return;
    for (let p = 0; p < 2; p++) { const i = KEYS[p].indexOf(e.code); if (i >= 0) duelAnswer(p, i); }
  });
  function stepDuel(dt, t) {
    const D = duelState;
    if (!D || G.over) return;
    if (D.pause > 0) {
      D.pause -= dt;
      if (D.pause <= 0) { G.qi++; duelQuestion(); }
    } else if (!D.resolved) {
      D.t -= dt;
      if (D.t <= 0) { D.t = 0; resolve(); }
    }
    D.timer.textContent = Math.ceil(D.t);
    // slow fly-by behind the questions
    ship.position.set(Math.sin(t * 0.4) * 4, Math.cos(t * 0.3) * 1.5, t * 6);
    ship.rotation.set(0, 0, Math.sin(t * 0.4) * 0.4);
    camera.position.set(8, 3, t * 6 - 12);
    camera.lookAt(ship.position);
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
  }

  S.onFrame((dt, t) => {
    if (G.mode === 'runner') stepRunner(dt);
    else if (G.mode === 'duel') stepDuel(dt, t);
    else { camera.position.set(6, 2, -10); camera.lookAt(0, 0, 0); ship.rotation.y += dt * 0.4; }
  });
  setTheme('sky');
  window.addEventListener('hashchange', () => menu());
  S.start();
  menu();
})();
