/* Code Pilot — block coding like TinkerCAD Codeblocks.
   Flight levels: program a drone through a course. Build levels: write code that builds a 3D model. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  const V3 = THREE.Vector3;
  AC.boot({ game: 'code', topic: 'TinkerCAD Codeblocks', title: 'Code Pilot', help: () => help() });

  const S = AC.scene({ fov: 50, near: 0.1, far: 2000, background: 0x0d1b2e, shadows: true });
  const { scene, camera, renderer } = S;
  const lights = AC.lights(scene, { sky: 0xdfe8f5, ground: 0x30343a, hemi: 0.85, sun: 0.9, dir: [20, 40, -15], shadows: true, shadowSize: 30 });
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 34, min: 8, max: 120, phi: 0.95, theta: Math.PI + 0.35 });
  const mat = AC.models.mat;

  // ---------------------------------------------------------------- block catalogue (TinkerCAD Codeblocks colours)
  const B = {
    takeoff: { label: 'Take off', cat: 'drone' },
    forward: { label: 'Fly forward', cat: 'drone', params: [{ k: 'n', v: 1, min: 1, max: 9, step: 1 }] },
    up: { label: 'Climb', cat: 'drone', params: [{ k: 'n', v: 1, min: 1, max: 5, step: 1 }] },
    down: { label: 'Descend', cat: 'drone', params: [{ k: 'n', v: 1, min: 1, max: 5, step: 1 }] },
    left: { label: 'Turn left 90°', cat: 'modify' },
    right: { label: 'Turn right 90°', cat: 'modify' },
    land: { label: 'Land', cat: 'drone' },
    drop: { label: 'Drop package', cat: 'drone' },
    repeat: { label: 'Repeat', cat: 'control', params: [{ k: 'n', v: 4, min: 2, max: 12, step: 1 }], body: true, suffix: 'times' },
    box: { label: 'Add box', cat: 'shape', params: [{ k: 'w', v: 2, min: 0.5, max: 20, step: 0.5, lbl: 'W' }, { k: 'l', v: 8, min: 0.5, max: 30, step: 0.5, lbl: 'L' }, { k: 'h', v: 1, min: 0.5, max: 30, step: 0.5, lbl: 'H' }] },
    cyl: { label: 'Add cylinder', cat: 'shape', params: [{ k: 'r', v: 2, min: 0.5, max: 10, step: 0.5, lbl: 'R' }, { k: 'h', v: 2, min: 0.5, max: 30, step: 0.5, lbl: 'H' }] },
    move: { label: 'Move forward', cat: 'modify', params: [{ k: 'n', v: 8, min: -30, max: 30, step: 0.5 }] },
    turn: { label: 'Turn right', cat: 'modify', params: [{ k: 'deg', v: 90, min: -360, max: 360, step: 1 }], suffix: '°' },
  };
  const CAT = { drone: 'var(--b-drone)', modify: 'var(--b-modify)', control: 'var(--b-control)', shape: 'var(--b-shape)' };

  // ---------------------------------------------------------------- levels
  const LEVELS = [
    {
      id: 'f1', kind: 'fly', title: 'First Flight', par: 3, blocks: ['takeoff', 'forward', 'left', 'right', 'land'],
      start: [1, 0, 0], pad: [1, 4], rings: [[1, 2, 1]], obstacles: [],
      story: 'Programs are instructions that run in order, top to bottom. Program the drone to take off, fly forward through the ring and land on the pad.',
      hint: 'Take off → Fly forward 4 → Land',
    },
    {
      id: 'f2', kind: 'fly', title: 'Square Patrol', par: 5, blocks: ['takeoff', 'forward', 'left', 'right', 'land', 'repeat'],
      start: [1, 1, 0], pad: [1, 1], rings: [[1, 4, 1], [4, 4, 1], [4, 1, 1]], obstacles: [[2, 2, 1], [3, 3, 1], [2, 3, 1], [3, 2, 1]],
      story: 'Fly a square around the trees through all three rings and land back on the start pad. Four sides that are all the same? That is a job for a Repeat loop.',
      hint: 'Take off → Repeat 4 { Fly forward 3 → Turn right } → Land',
    },
    {
      id: 'f3', kind: 'fly', title: 'Staircase', par: 6, blocks: ['takeoff', 'forward', 'up', 'down', 'left', 'right', 'land', 'repeat'],
      start: [3, 0, 0], pad: [3, 4], padHeight: 3, rings: [[3, 1, 1], [3, 2, 2], [3, 3, 3]], obstacles: [[3, 4, 3]],
      story: 'The rings climb like stairs to a landing pad on top of a tower. A loop can hold more than one block: forward AND up, again and again.',
      hint: 'Take off → Repeat 3 { Fly forward 1 → Climb 1 } → Fly forward 1 → Land',
    },
    {
      id: 'f4', kind: 'fly', title: 'Medicine Drop', par: 6, blocks: ['takeoff', 'forward', 'up', 'down', 'left', 'right', 'land', 'drop', 'repeat'],
      start: [0, 0, 0], pad: [5, 6], rings: [], obstacles: [[0, 3, 2], [1, 3, 2], [2, 3, 2], [3, 3, 2], [4, 3, 2], [5, 3, 2], [6, 3, 2], [7, 3, 2]], drop: true,
      story: 'A row of buildings blocks the way to the clinic. Climb above them, fly to the red + pad and drop the medicine box onto it.',
      hint: 'Take off → Climb 2 → Fly forward 6 → Turn right → Fly forward 5 → Drop package',
    },
    {
      id: 'b1', kind: 'build', title: 'Code a Quad Frame', par: 8, blocks: ['box', 'cyl', 'move', 'turn', 'repeat'],
      target: [['box', 0, 0, 0, 8, 8, 1], ...[0, 90, 180, 270].flatMap((a) => [['box', 8 * Math.sin(rad(a)), 8 * Math.cos(rad(a)), a, 2, 8, 1], ['cyl', 12 * Math.sin(rad(a)), 12 * Math.cos(rad(a)), 0, 2, 2]])],
      story: 'Just like TinkerCAD Codeblocks: write code that builds a quadcopter frame. A centre plate, then four arms with a motor at each end. The arms are 360° ÷ 4 = 90° apart, so use a Repeat 4 loop.',
      hint: 'Add box 8×8×1 → Repeat 4 { Move 8 → Add box 2×8×1 → Move 4 → Add cylinder 2×2 → Move −12 → Turn 90 }',
    },
    {
      id: 'b2', kind: 'build', title: 'Code Rocket Fins', par: 6, blocks: ['box', 'cyl', 'move', 'turn', 'repeat'],
      target: [['cyl', 0, 0, 0, 3, 20], ...[0, 120, 240].map((a) => ['box', 5.5 * Math.sin(rad(a)), 5.5 * Math.cos(rad(a)), a, 1, 5, 6])],
      story: 'A rocket needs fins spaced evenly around its body. Three fins: 360° ÷ 3 = 120° apart. Build the body, then use a loop for the fins.',
      hint: 'Add cylinder 3×20 → Repeat 3 { Move 5.5 → Add box 1×5×6 → Move −5.5 → Turn 120 }',
    },
  ];
  function rad(d) { return (d * Math.PI) / 180; }

  // ---------------------------------------------------------------- worlds
  const flyWorld = new THREE.Group();
  const buildWorld = new THREE.Group();
  scene.add(flyWorld, buildWorld);
  const CELL = 4, N = 8;
  const cellPos = (i, j, y = 0) => new V3(-(i - (N - 1) / 2) * CELL, y * CELL, (j - (N - 1) / 2) * CELL);
  // grass field with a cell grid
  const fieldTex = AC.canvasTex(512, 512, (g, w, hh) => {
    g.fillStyle = '#4f7f36'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 6000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(40,80,30,0.3)' : 'rgba(120,160,70,0.25)'; g.fillRect(Math.random() * w, Math.random() * hh, 2, 2); }
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2;
    for (let i = 0; i <= N; i++) { const p = (i / N) * w; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, hh); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); }
  });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(N * CELL, N * CELL), new THREE.MeshLambertMaterial({ map: fieldTex }));
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  flyWorld.add(field);
  const fieldEdge = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x3f6b2c }));
  fieldEdge.rotation.x = -Math.PI / 2;
  fieldEdge.position.y = -0.02;
  flyWorld.add(fieldEdge);
  const levelObjs = new THREE.Group();
  flyWorld.add(levelObjs);
  const drone = AC.models.quad({ arm: 0.225 });
  drone.scale.setScalar(4);
  drone.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  flyWorld.add(drone);
  const pkg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat(0xd8332a));
  pkg.castShadow = true;
  flyWorld.add(pkg);

  // TinkerCAD-style blue workplane
  const wpTex = AC.canvasTex(1024, 1024, (g, w, hh) => {
    g.fillStyle = '#8fb8e8'; g.fillRect(0, 0, w, hh);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1;
    for (let i = 0; i <= 40; i++) { const p = (i / 40) * w; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, hh); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); }
    g.strokeStyle = 'rgba(30,70,140,0.6)'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { const p = (i / 8) * w; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, hh); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); }
  });
  const workplane = new THREE.Mesh(new THREE.BoxGeometry(40, 0.3, 40), [mat(0x5f8fc8), mat(0x5f8fc8), new THREE.MeshLambertMaterial({ map: wpTex }), mat(0x5f8fc8), mat(0x5f8fc8), mat(0x5f8fc8)]);
  workplane.position.y = -0.15;
  workplane.receiveShadow = true;
  buildWorld.add(workplane);
  const wpLabel = AC.textSprite('Workplane', { color: '#1d4f91', bg: null, size: 1.4 });
  wpLabel.position.set(14, 0.3, -21);
  buildWorld.add(wpLabel);
  const ghostG = new THREE.Group(), builtG = new THREE.Group();
  buildWorld.add(ghostG, builtG);
  const cursor = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2, 3), new THREE.MeshBasicMaterial({ color: 0xff70d8 }));
  cursor.rotation.x = Math.PI / 2;
  const cursorG = new THREE.Group();
  cursorG.add(cursor);
  cursor.position.z = 1;
  buildWorld.add(cursorG);
  const TC = [0xe8463c, 0xf59a23, 0xf2d43b, 0x4cb648, 0x3f9cf0, 0xa57cf0]; // TinkerCAD-ish shape colours

  function shapeMesh(s, ghost) {
    const geo = s.type === 'box' ? new THREE.BoxGeometry(s.w, s.h, s.l) : new THREE.CylinderGeometry(s.r, s.r, s.h, 32);
    const m = ghost
      ? new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff70d8, wireframe: true, transparent: true, opacity: 0.45 }))
      : new THREE.Mesh(geo, mat(TC[s.i % TC.length]));
    m.position.set(s.x, s.h / 2, s.z);
    m.rotation.y = rad(s.ang);
    m.castShadow = !ghost;
    return m;
  }

  // ---------------------------------------------------------------- program model + editor
  let level = null, program = [], target = null, runner = null, api = null;
  const editorEl = h('div', { class: 'editor ac-panel' });
  AC.root().appendChild(editorEl);
  const palette = h('div', { class: 'palette' });
  const prog = h('div', { class: 'prog' });
  const count = h('span', { class: 'count' });
  const runBtn = h('button', { class: 'ac-btn green', type: 'button' }, '▶ Run');
  const resetBtn = h('button', { class: 'ac-btn ghost', type: 'button' }, 'Reset');
  const hintBtn = h('button', { class: 'ac-btn ghost', type: 'button' }, 'Hint');
  editorEl.append(h('div', {}, h('h2', {}, 'Blocks · click to add')), palette, prog, h('div', { class: 'runbar' }, runBtn, resetBtn, hintBtn, count));
  runBtn.addEventListener('click', run);
  resetBtn.addEventListener('click', () => { stopRun(); resetWorld(); });
  hintBtn.addEventListener('click', () => { api && (api.state.hints = (api.state.hints || 0) + 1); AC.fact('Hint', level.hint, { tag: 'Code idea', ms: 14000 }); });

  const node = (t) => ({ t, p: Object.fromEntries((B[t].params || []).map((q) => [q.k, q.v])), body: B[t].body ? [] : undefined, id: Math.random().toString(36).slice(2) });
  function buildPalette() {
    palette.innerHTML = '';
    level.blocks.forEach((t) => {
      const b = h('button', { type: 'button', style: { background: CAT[B[t].cat] } }, '+ ' + B[t].label);
      b.addEventListener('click', () => {
        if (runner) return;
        const n = node(t);
        (target || program).push(n);
        if (n.body) target = n.body;
        AC.audio.click();
        renderProg();
      });
      palette.appendChild(b);
    });
  }
  function countBlocks(list) { return list.reduce((s, n) => s + 1 + (n.body ? countBlocks(n.body) : 0), 0); }
  function renderProg() {
    prog.innerHTML = '';
    prog.classList.toggle('target-main', !target || target === program);
    const startRow = h('div', { class: 'start' }, '● When ▶ Run is clicked');
    startRow.style.cursor = 'pointer';
    startRow.addEventListener('click', () => { target = program; renderProg(); });
    prog.appendChild(startRow);
    renderList(program, prog);
    count.textContent = countBlocks(program) + ' blocks · par ' + level.par;
  }
  function renderList(list, container) {
    list.forEach((n, idx) => {
      const def = B[n.t];
      const row = h('div', { class: 'blk', 'data-id': n.id, style: { background: CAT[def.cat] } }, def.label);
      (def.params || []).forEach((q) => {
        if (q.lbl) row.append(h('span', { style: { fontSize: '0.7rem', opacity: 0.8 } }, q.lbl));
        const inp = h('input', { type: 'number', value: n.p[q.k], min: q.min, max: q.max, step: q.step, 'aria-label': def.label + ' ' + (q.lbl || q.k) });
        inp.addEventListener('change', () => { n.p[q.k] = clamp(+inp.value || q.v, q.min, q.max); inp.value = n.p[q.k]; });
        row.append(inp);
      });
      if (def.suffix) row.append(h('span', {}, def.suffix));
      if (n.t === 'forward' || n.t === 'up' || n.t === 'down') row.append(h('span', { style: { fontSize: '0.72rem' } }, 'squares'));
      const ctl = h('span', { class: 'ctl' });
      const mk = (txt, title, fn) => { const b = h('button', { type: 'button', title, 'aria-label': title }, txt); b.addEventListener('click', (e) => { e.stopPropagation(); if (runner) return; fn(); renderProg(); }); ctl.append(b); };
      mk('↑', 'Move up', () => { if (idx > 0) [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]; });
      mk('↓', 'Move down', () => { if (idx < list.length - 1) [list[idx + 1], list[idx]] = [list[idx], list[idx + 1]]; });
      mk('✕', 'Delete', () => { list.splice(idx, 1); if (n.body && (target === n.body || contains(n.body, target))) target = program; });
      row.append(ctl);
      if (n.body) {
        const body = h('div', { class: 'body' + (target === n.body ? ' target' : '') });
        body.addEventListener('click', (e) => { if (e.target === body) { target = n.body; renderProg(); } });
        renderList(n.body, body);
        container.append(h('div', { class: 'rep' }, row, body));
      } else container.append(row);
    });
  }
  function contains(list, arr) { return list.some((n) => n.body && (n.body === arr || contains(n.body, arr))); }
  function flatten(list, out = []) {
    for (const n of list) {
      if (out.length > 400) break;
      if (n.t === 'repeat') for (let k = 0; k < n.p.n; k++) flatten(n.body, out);
      else out.push(n);
    }
    return out;
  }

  // ---------------------------------------------------------------- flight interpreter
  const F = { i: 0, j: 0, y: 0, dir: 0, rings: [], dropped: null, crashed: false };
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const obstacleAt = (i, j) => (level.obstacles.find((o) => o[0] === i && o[1] === j) || [0, 0, 0])[2];
  function resetWorld() {
    if (!level) return;
    if (level.kind === 'fly') {
      F.i = level.start[0]; F.j = level.start[1]; F.y = 0; F.dir = level.start[2]; F.rings = level.rings.map(() => false); F.dropped = null; F.crashed = false;
      drone.position.copy(cellPos(F.i, F.j, 0)).add(new V3(0, 0.3, 0));
      drone.rotation.set(0, -F.dir * Math.PI / 2, 0);
      ringMeshes.forEach((r) => r.material.color.set(0xff70d8));
      pkg.visible = !!level.drop;
      placePkg();
    } else {
      builtG.clear();
      B.cur = { x: 0, z: 0, ang: 0, n: 0 };
      cursorG.position.set(0, 0.2, 0);
      cursorG.rotation.y = 0;
      built = [];
    }
    highlight(null);
  }
  function placePkg() { if (!F.dropped) pkg.position.copy(drone.position).add(new V3(0, -0.6, 0)); }
  let ringMeshes = [];
  function buildFlyLevel() {
    levelObjs.clear();
    ringMeshes = level.rings.map(([i, j, y], k) => {
      const r = AC.models.ring(1.6, 0.18, 0xff70d8);
      r.position.copy(cellPos(i, j, y)).add(new V3(0, 0.3, 0));
      // face along the direction of travel through this ring
      const prev = k ? level.rings[k - 1] : level.start;
      if (prev[0] !== i) r.rotation.y = Math.PI / 2;
      levelObjs.add(r);
      return r;
    });
    level.obstacles.forEach(([i, j, hgt]) => {
      const tower = level.id === 'f3';
      const geo = tower ? new THREE.BoxGeometry(CELL * 0.9, hgt * CELL, CELL * 0.9) : level.drop ? new THREE.BoxGeometry(CELL * 0.92, hgt * CELL, CELL * 0.8) : new THREE.ConeGeometry(CELL * 0.4, hgt * CELL * 1.6, 8);
      const m = new THREE.Mesh(geo, mat(tower ? 0x8d949c : level.drop ? [0xdfe5ea, 0xc9b38a, 0xb9c3cc][(i + j) % 3] : 0x2f5f2a));
      m.position.copy(cellPos(i, j, 0)).add(new V3(0, (tower || level.drop ? hgt * CELL : hgt * CELL * 1.6) / 2, 0));
      m.castShadow = m.receiveShadow = true;
      levelObjs.add(m);
    });
    const pad = AC.models.pad(level.drop ? '+' : 'H', level.drop ? 0xff5a4f : 0x4be38a, 1.7);
    pad.position.copy(cellPos(level.pad[0], level.pad[1], level.padHeight || 0)).add(new V3(0, 0.02, 0));
    levelObjs.add(pad);
    const n = AC.textSprite('N ↑ forward', { color: '#e9f0f7', size: 1.6 });
    n.position.copy(cellPos(level.start[0], level.start[1], 0)).add(new V3(0, 0.6, -2.6));
    levelObjs.add(n);
  }
  function buildBuildLevel() {
    ghostG.clear();
    target_ = level.target.map(([type, x, z, ang, a, b, c], i) => (type === 'box' ? { type, x, z, ang, w: a, l: b, h: c, i } : { type, x, z, ang, r: a, h: b, i }));
    target_.forEach((s) => ghostG.add(shapeMesh(s, true)));
  }
  let target_ = [], built = [];

  // each action becomes a little animation
  function flyAction(n) {
    const steps = [];
    const at = () => cellPos(F.i, F.j, F.y).add(new V3(0, 0.3, 0));
    const fail = (msg) => steps.push({ fail: msg });
    switch (n.t) {
      case 'takeoff': if (F.y > 0) fail('You are already flying.'); else { F.y = 1; steps.push({ to: at(), dur: 0.6 }); } break;
      case 'forward':
        for (let k = 0; k < n.p.n; k++) {
          if (F.y === 0) { fail('The drone is still on the ground. Use Take off first.'); break; }
          F.i += DIRS[F.dir][0]; F.j += DIRS[F.dir][1];
          if (F.i < 0 || F.j < 0 || F.i >= N || F.j >= N) { fail('Flew out of the test field.'); break; }
          if (obstacleAt(F.i, F.j) >= F.y) { steps.push({ to: at(), dur: 0.35 }); fail('Crashed into an obstacle. Climb higher first.'); break; }
          steps.push({ to: at(), dur: 0.35, check: { i: F.i, j: F.j, y: F.y } });
        }
        break;
      case 'up': for (let k = 0; k < n.p.n; k++) { if (F.y === 0) { fail('Take off first.'); break; } F.y++; if (F.y > 6) { fail('Too high: the drone is not allowed above 6 squares.'); break; } steps.push({ to: at(), dur: 0.35, check: { i: F.i, j: F.j, y: F.y } }); } break;
      case 'down':
        for (let k = 0; k < n.p.n; k++) {
          F.y--;
          const floor = obstacleAt(F.i, F.j);
          if (F.y <= floor) { fail(floor ? 'Descended onto a building!' : 'Descended into the ground. Use Land to touch down gently.'); break; }
          steps.push({ to: at(), dur: 0.35, check: { i: F.i, j: F.j, y: F.y } });
        }
        break;
      case 'left': F.dir = (F.dir + 3) % 4; steps.push({ yaw: -F.dir * Math.PI / 2, dur: 0.35 }); break;
      case 'right': F.dir = (F.dir + 1) % 4; steps.push({ yaw: -F.dir * Math.PI / 2, dur: 0.35 }); break;
      case 'land': { const top = (level.pad[0] === F.i && level.pad[1] === F.j && level.padHeight) || obstacleAt(F.i, F.j); F.y = top; steps.push({ to: cellPos(F.i, F.j, top).add(new V3(0, 0.3, 0)), dur: 0.7 }); break; }
      case 'drop': if (F.dropped || !level.drop) fail('There is no package to drop.'); else { F.dropped = { i: F.i, j: F.j }; steps.push({ dropPkg: cellPos(F.i, F.j, 0).add(new V3(0, 0.3, 0)), dur: 0.6 }); } break;
    }
    return steps;
  }
  function buildAction(n) {
    const c = B.cur;
    switch (n.t) {
      case 'box': case 'cyl': {
        const s = n.t === 'box' ? { type: 'box', x: c.x, z: c.z, ang: c.ang, w: n.p.w, l: n.p.l, h: n.p.h, i: c.n++ } : { type: 'cyl', x: c.x, z: c.z, ang: 0, r: n.p.r, h: n.p.h, i: c.n++ };
        return [{ add: s, dur: 0.35 }];
      }
      case 'move': c.x += n.p.n * Math.sin(rad(c.ang)); c.z += n.p.n * Math.cos(rad(c.ang)); return [{ cur: true, dur: 0.3 }];
      case 'turn': c.ang -= n.p.deg; return [{ cur: true, dur: 0.3 }];
      default: return [{ fail: 'That block does not work in build mode.' }];
    }
  }

  // ---------------------------------------------------------------- runner (animates the queue)
  function run() {
    if (runner || !level) return;
    if (!countBlocks(program)) { AC.ui.toast('Add some blocks first', 'var(--amber)'); return; }
    resetWorld();
    api.state.runs = (api.state.runs || 0) + 1;
    runner = { list: flatten(program), k: -1, steps: [], s: null, t: 0, from: null, fromYaw: 0 };
    AC.audio.click();
  }
  function stopRun() { runner = null; highlight(null); }
  function highlight(id) { prog.querySelectorAll('.blk').forEach((b) => b.classList.toggle('run', b.dataset.id === id)); }
  function stepRunner(dt) {
    const r = runner;
    if (!r) return;
    if (!r.s) {
      if (!r.steps.length) {
        r.k++;
        if (r.k >= r.list.length) { runner = null; highlight(null); return judge(); }
        const n = r.list[r.k];
        highlight(n.id);
        r.steps = level.kind === 'fly' ? flyAction(n) : buildAction(n);
        if (!r.steps.length) return;
      }
      r.s = r.steps.shift();
      r.t = 0;
      r.from = drone.position.clone();
      r.fromYaw = drone.rotation.y;
      if (r.s.fail) { runner = null; return crash(r.s.fail); }
      if (r.s.add) { const m = shapeMesh(r.s.add, false); m.scale.setScalar(0.01); builtG.add(m); r.s.mesh = m; built.push(r.s.add); AC.audio.tone(500 + built.length * 60, 0.08, 'triangle', 0.12); }
    }
    const s = r.s;
    r.t += dt;
    const k = clamp(r.t / s.dur, 0, 1), e = k * k * (3 - 2 * k);
    if (s.to) drone.position.lerpVectors(r.from, s.to, e);
    if (s.yaw != null) {
      let d = s.yaw - r.fromYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      drone.rotation.y = r.fromYaw + d * e;
    }
    if (s.dropPkg) { pkg.position.lerpVectors(r.from.clone().add(new V3(0, -0.6, 0)), s.dropPkg, e * e); }
    if (s.mesh) s.mesh.scale.setScalar(Math.max(0.01, e));
    if (s.cur) { cursorG.position.set(B.cur.x, 0.2, B.cur.z); cursorG.rotation.y = AC.damp(cursorG.rotation.y, rad(B.cur.ang), 12, dt); }
    if (level.kind === 'fly') placePkg();
    if (k >= 1) {
      if (s.check) checkRings(s.check);
      if (s.cur) cursorG.rotation.y = rad(B.cur.ang);
      r.s = null;
    }
  }
  function checkRings(c) {
    level.rings.forEach(([i, j, y], k) => {
      if (!F.rings[k] && c.i === i && c.j === j && c.y === y) { F.rings[k] = true; ringMeshes[k].material.color.set(0x4be38a); AC.audio.ping(); }
    });
  }
  function crash(msg) {
    AC.audio.bad();
    AC.ui.toast('BUG FOUND', 'var(--amber)');
    AC.fact('Debug time', msg + ' Fix the program and press Run again.', { tag: 'Program stopped', color: 'var(--amber)' });
    highlight(null);
  }
  function judge() {
    if (level.kind === 'fly') {
      const ringsOk = F.rings.every(Boolean);
      const onPad = F.i === level.pad[0] && F.j === level.pad[1];
      const landed = F.y === (level.padHeight || 0) && onPad;
      const delivered = !level.drop || (F.dropped && F.dropped.i === level.pad[0] && F.dropped.j === level.pad[1]);
      const problems = [];
      if (!ringsOk) problems.push('missed ' + F.rings.filter((x) => !x).length + ' ring(s)');
      if (level.drop) { if (!delivered) problems.push('the package did not land on the + pad'); }
      else if (!landed) problems.push(onPad ? 'did not land on the pad' : 'did not finish on the pad');
      if (problems.length) return crash('The program ran to the end, but the drone ' + problems.join(' and ') + '.');
    } else {
      const res = compareShapes(built, target_);
      if (!res.ok) return crash(res.msg);
    }
    const n = countBlocks(program);
    const stars = n <= level.par && !(api.state.hints > 1) ? 3 : n <= level.par + 3 ? 2 : 1;
    api.win(stars, 'Solved with ' + n + ' blocks (par ' + level.par + ') after ' + api.state.runs + ' run' + (api.state.runs > 1 ? 's' : '') + '.');
  }
  function norm(a, mod) { return ((a % mod) + mod) % mod; }
  function compareShapes(have, want) {
    const used = new Set();
    let matched = 0;
    for (const w of want) {
      const k = have.findIndex((s, i) => {
        if (used.has(i) || s.type !== w.type) return false;
        if (Math.hypot(s.x - w.x, s.z - w.z) > 0.3 || Math.abs(s.h - w.h) > 0.01) return false;
        if (s.type === 'cyl') return Math.abs(s.r - w.r) < 0.01;
        const same = Math.abs(s.w - w.w) < 0.01 && Math.abs(s.l - w.l) < 0.01;
        const swap = Math.abs(s.w - w.l) < 0.01 && Math.abs(s.l - w.w) < 0.01;
        const mod = Math.abs(w.w - w.l) < 0.01 ? 90 : 180;
        const da = Math.abs(norm(s.ang, mod) - norm(w.ang, mod));
        const dRot = Math.min(da, mod - da);
        const dSwap = Math.min(Math.abs(norm(s.ang + 90, mod) - norm(w.ang, mod)), mod - Math.abs(norm(s.ang + 90, mod) - norm(w.ang, mod)));
        return (same && dRot < 2) || (swap && dSwap < 2);
      });
      if (k >= 0) { used.add(k); matched++; }
    }
    if (matched === want.length && have.length === want.length) return { ok: true };
    if (matched === want.length) return { ok: false, msg: 'All the pink ghost shapes are built, but there are ' + (have.length - want.length) + ' extra shape(s).' };
    return { ok: false, msg: matched + ' of ' + want.length + ' shapes match the pink ghost model.' + (have.length > want.length ? ' Some shapes are extra.' : '') + ' Check sizes, Move distances and Turn angles.' };
  }

  // ---------------------------------------------------------------- missions
  const missions = LEVELS.map((L) => ({
    id: L.id, title: L.title, objective: L.kind === 'fly' ? 'Program the drone: ' + L.title : 'Write code that builds the pink ghost model',
    story: L.story,
    learn: L.kind === 'fly'
      ? [{ t: 'Sequence', p: 'Blocks run in order, top to bottom, just like in TinkerCAD Codeblocks.' }, { t: 'Loops', p: 'Repeat runs the blocks inside it many times. Click a loop\'s dashed area to add blocks into it.' }, { t: 'Debugging', p: 'If the drone crashes, read the message, fix one block, run again. Real engineers do this all day.' }]
      : [{ t: 'Like Codeblocks', p: 'Add shape, Move and Turn blocks place shapes on the workplane, exactly like TinkerCAD Codeblocks.' }, { t: 'Patterns', p: 'Evenly spaced parts: turn by 360° ÷ the number of parts.', f: '4 arms → 90° · 3 fins → 120°' }, { t: 'Parametric', p: 'Change one number and the whole model updates. That is parametric design.' }],
    controls: ['Click blocks to add them', 'Click a Repeat\'s dashed area to fill it', '<b>▶ Run</b> to test'],
    proved: L.kind === 'fly' ? 'Your program is a flight plan: a sequence of commands with loops. Autopilots and drone delivery services run flight plans just like this one.' : 'You just built a 3D model with code. A loop plus a turn of 360° ÷ n makes evenly spaced parts. TinkerCAD Codeblocks and professional CAD (SolidWorks Circular Pattern) use exactly this idea.',
    quiz: AC.QUESTIONS.find((q) => q.q.includes(L.id === 'b2' ? '3 rocket fins' : L.kind === 'build' ? '4 drone arms' : 'runs the same steps')),
    start(a) {
      api = a;
      level = L;
      program = [];
      target = program;
      stopRun();
      flyWorld.visible = L.kind === 'fly';
      buildWorld.visible = L.kind === 'build';
      scene.background = new THREE.Color(L.kind === 'fly' ? 0x8fc4ea : 0xe9eef5);
      if (L.kind === 'fly') { buildFlyLevel(); oc.target.set(7, 2, 0); oc.dist = 46; oc.phi = 0.85; oc.theta = Math.PI + 0.3; }
      else { buildBuildLevel(); oc.target.set(8, 2, 0); oc.dist = 44; oc.phi = 0.8; oc.theta = Math.PI + 0.5; }
      buildPalette();
      renderProg();
      resetWorld();
    },
    update(dt) { stepRunner(dt); if (level && level.kind === 'fly') ud.props.forEach((p, i) => (p.rotation.y += (F.y > 0 ? 40 : 0) * dt * ud.spinDir[i])); },
  }));
  const ud = drone.userData;
  const MR = AC.missions({ game: 'code', week: 0, list: missions });
  MR.panel.style.cssText = 'left:auto;right:max(12px, env(safe-area-inset-right, 0px));top:auto;bottom:calc(12px + env(safe-area-inset-bottom, 0px));width:230px;max-height:42%;';
  function help() {
    AC.ui.card({ eyebrow: 'Code Pilot', title: 'How to code', body: [
      AC.ui.learnGrid([{ t: 'Add', p: 'Click a coloured block to add it at the end of your program (or inside the selected loop).' }, { t: 'Edit', p: 'Type numbers into the white boxes. ↑ ↓ move a block, ✕ deletes it.' }, { t: 'Loops', p: 'Click the dashed area of a Repeat block to put new blocks inside it. Click "When Run is clicked" to go back to the main program.' }, { t: 'Colours', p: 'Blue = shapes, purple = move/turn, orange = control, green = drone. The same as TinkerCAD Codeblocks.' }]),
    ] });
  }
  S.onFrame((dt) => { MR.update(dt); oc.update(dt); });
  S.start();
  MR.begin();
})();
