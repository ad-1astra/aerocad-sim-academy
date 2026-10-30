/* AeroCAD Sim Academy — 3D models.
   Every model is built only from TinkerCAD basic shapes (box, cylinder, cone, sphere,
   torus, wedge) so learners can rebuild any of them in TinkerCAD.
   Axes: +Z = forward (nose), +Y = up, +X = LEFT (port) wing. */
(function () {
  'use strict';
  const M = (AC.models = {});
  const cache = {};
  const mat = (M.mat = function (color, o = {}) {
    const key = color + JSON.stringify(o);
    if (!cache[key]) cache[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.1 }, o));
    return cache[key];
  });
  const glow = (color) => new THREE.MeshBasicMaterial({ color });

  function mesh(geo, material, x = 0, y = 0, z = 0, parent) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.userData.shape = geo.type.replace('Geometry', '').replace('Buffer', '');
    if (parent) parent.add(m);
    return m;
  }
  M.mesh = mesh;
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
  // TinkerCAD "Wedge": right-angle triangle prism. Long side along +Z, height along +Y.
  M.wedge = function (w, h, d) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(d, 0); s.lineTo(d, h); s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.translate(-d / 2, 0, -w / 2);
    g.rotateY(-Math.PI / 2);
    g.type = 'WedgeGeometry';
    return g;
  };

  // explode a model into its separate TinkerCAD shapes (t = 0..1)
  M.explode = function (group, t) {
    const c = new THREE.Vector3();
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      if (!o.isMesh || o.userData.noExplode) return;
      if (!o.userData.home) o.userData.home = o.position.clone();
      if (!o.userData.dir) {
        const wp = new THREE.Vector3();
        o.getWorldPosition(wp);
        group.worldToLocal(wp);
        const d = wp.sub(c);
        if (d.lengthSq() < 1e-6) d.set(0, 1, 0);
        o.userData.dir = d.normalize();
        o.userData.depth = 0;
        let p = o.parent;
        while (p && p !== group) { o.userData.depth++; p = p.parent; }
      }
      const scale = o.userData.explodeScale || 1;
      const local = o.userData.dir.clone();
      // convert explode direction from group space into the parent's space
      if (o.parent !== group) {
        const q = new THREE.Quaternion();
        o.parent.getWorldQuaternion(q);
        const gq = new THREE.Quaternion();
        group.getWorldQuaternion(gq);
        local.applyQuaternion(gq).applyQuaternion(q.invert());
      }
      o.position.copy(o.userData.home).addScaledVector(local, t * scale * (M.explodeDistance || 1));
    });
  };

  // ---------------------------------------------------------------- aircraft (Cessna-class, metres)
  M.plane = function () {
    const g = new THREE.Group();
    const white = mat(0xf2f5f8), blue = mat(0x1d4f91), red = mat(0xd8332a), dark = mat(0x1a2433, { roughness: 0.25, metalness: 0.4 }), grey = mat(0x6c7a89);
    // fuselage: cylinder + cones
    const body = mesh(cyl(0.62, 0.62, 3.6), white, 0, 0, 0.6, g); body.rotation.x = Math.PI / 2;
    const nose = mesh(cyl(0.62, 0.45, 1.0), white, 0, -0.02, 2.9, g); nose.rotation.x = -Math.PI / 2;
    const tail = mesh(cyl(0.18, 0.62, 3.6), white, 0, 0.12, -3.0, g); tail.rotation.x = -Math.PI / 2;
    const stripe = mesh(cyl(0.635, 0.635, 3.0), blue, 0, -0.2, 0.4, g); stripe.rotation.x = Math.PI / 2; stripe.scale.set(1, 1, 0.25);
    mesh(box(1.0, 0.45, 1.2), dark, 0, 0.42, 1.25, g); // windscreen
    mesh(box(1.26, 0.38, 1.4), dark, 0, 0.32, 0.1, g); // side windows
    // wings (high wing)
    const wing = mesh(box(11, 0.16, 1.5), white, 0, 0.7, 0.55, g);
    mesh(box(0.25, 0.17, 1.52), red, 5.4, 0.7, 0.55, g);
    mesh(box(0.25, 0.17, 1.52), red, -5.4, 0.7, 0.55, g);
    // wing struts
    const sL = mesh(cyl(0.04, 0.04, 2.2, 6), grey, 1.6, 0.0, 0.5, g); sL.rotation.z = 1.0;
    const sR = mesh(cyl(0.04, 0.04, 2.2, 6), grey, -1.6, 0.0, 0.5, g); sR.rotation.z = -1.0;
    // ailerons on hinges (trailing edge of outer wing)
    function surface(w, h, d, x, y, z, parentMat) {
      const hinge = new THREE.Group();
      hinge.position.set(x, y, z);
      const s = mesh(box(w, h, d), parentMat || mat(0xd9e2ea), 0, 0, -d / 2, hinge);
      s.userData.explodeScale = 0.6;
      g.add(hinge);
      return hinge;
    }
    const ailL = surface(3.2, 0.1, 0.4, 3.4, 0.7, -0.2);
    const ailR = surface(3.2, 0.1, 0.4, -3.4, 0.7, -0.2);
    // tailplane + elevator
    mesh(box(3.6, 0.1, 0.8), white, 0, 0.18, -4.25, g);
    const elev = surface(3.4, 0.08, 0.45, 0, 0.18, -4.65);
    // fin (TinkerCAD wedge) + rudder
    mesh(M.wedge(0.1, 1.4, 1.1), blue, 0, 0.2, -4.2, g);
    const rudder = new THREE.Group();
    rudder.position.set(0, 0.2, -4.75);
    mesh(box(0.08, 1.45, 0.4), red, 0, 0.72, -0.2, rudder);
    g.add(rudder);
    // propeller
    const prop = new THREE.Group();
    prop.position.set(0, -0.02, 3.45);
    const spin = mesh(new THREE.ConeGeometry(0.2, 0.4, 14), red, 0, 0, 0.15, prop); spin.rotation.x = Math.PI / 2;
    mesh(box(0.14, 1.9, 0.04), dark, 0, 0, 0, prop);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), new THREE.MeshBasicMaterial({ color: 0x9fb3c8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    disc.userData.noExplode = true;
    prop.add(disc);
    g.add(prop);
    // landing gear
    const wheel = (x, z, r) => { const w = mesh(cyl(r, r, 0.14, 16), dark, x, -1.05, z, g); w.rotation.z = Math.PI / 2; };
    wheel(1.1, 0.2, 0.28); wheel(-1.1, 0.2, 0.28); wheel(0, 2.6, 0.22);
    const leg = (x) => { const l = mesh(cyl(0.04, 0.04, 1.1, 6), grey, x * 0.55, -0.6, 0.2, g); l.rotation.z = x > 0 ? 0.55 : -0.55; };
    leg(1); leg(-1);
    mesh(cyl(0.04, 0.04, 0.8, 6), grey, 0, -0.65, 2.6, g);
    // navigation lights: red = port (left, +X), green = starboard (right, -X), white = tail
    const red_ = mesh(new THREE.SphereGeometry(0.09, 10, 8), glow(0xff2a2a), 5.55, 0.7, 0.55, g);
    const green_ = mesh(new THREE.SphereGeometry(0.09, 10, 8), glow(0x22ff66), -5.55, 0.7, 0.55, g);
    const white_ = mesh(new THREE.SphereGeometry(0.08, 10, 8), glow(0xffffff), 0, 0.25, -4.85, g);
    const strobe = mesh(new THREE.SphereGeometry(0.08, 10, 8), glow(0xffffff), 0, 1.65, -4.55, g);
    g.userData = { prop, disc, ailL, ailR, elev, rudder, wing, lights: { red: red_, green: green_, white: white_, strobe } };
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  };

  // ---------------------------------------------------------------- quadcopter (450-class, metres)
  // Motor numbering as in the Week 4 handout: 1 & 3 spin CW, 2 & 4 spin CCW (diagonal pairs).
  // M1 front-left, M2 front-right, M3 rear-right, M4 rear-left.
  M.quad = function (o = {}) {
    const g = new THREE.Group();
    const arm = o.arm || 0.225; // centre to motor
    const carbon = mat(0x20262e, { roughness: 0.4, metalness: 0.3 });
    const motorMat = mat(0x9aa7b4, { metalness: 0.7, roughness: 0.3 });
    const cwMat = mat(0xffa53a), ccwMat = mat(0x39c6e8);
    mesh(box(0.12, 0.012, 0.16), carbon, 0, 0, 0, g);
    mesh(box(0.11, 0.01, 0.14), carbon, 0, 0.045, 0, g);
    mesh(box(0.045, 0.01, 0.045), mat(0x1f8a4c), 0, 0.022, 0, g); // flight controller
    const batt = mesh(box(0.07, 0.035, 0.11), mat(0x2b4d8c), 0, 0.068, 0, g); // LiPo on top
    mesh(box(0.072, 0.008, 0.02), mat(0xd8332a), 0, 0.088, 0, g); // battery strap
    const cam = mesh(box(0.035, 0.035, 0.03), mat(0x111111), 0, -0.01, 0.09, g);
    mesh(cyl(0.012, 0.012, 0.01, 12), mat(0x3a7bd5, { metalness: 0.8, roughness: 0.1 }), 0, -0.01, 0.106, g).rotation.x = Math.PI / 2;
    const dirs = [[1, 1], [-1, 1], [-1, -1], [1, -1]]; // FL, FR, RR, RL (x, z signs)
    const spinDir = [1, -1, 1, -1]; // +1 = CW seen from above
    const props = [], discs = [], motors = [], pos = [], leds = [];
    dirs.forEach(([sx, sz], i) => {
      const x = (sx * arm) / Math.SQRT2, z = (sz * arm) / Math.SQRT2;
      const a = mesh(box(0.022, 0.012, arm), carbon, x / 2, 0, z / 2, g);
      a.rotation.y = Math.atan2(x, z);
      const mo = mesh(cyl(0.022, 0.022, 0.03, 16), motorMat, x, 0.02, z, g);
      motors.push(mo);
      const p = new THREE.Group();
      p.position.set(x, 0.045, z);
      const blade = mesh(box(0.2, 0.004, 0.022), spinDir[i] > 0 ? cwMat : ccwMat, 0, 0, 0, p);
      blade.rotation.x = 0.12;
      mesh(cyl(0.008, 0.008, 0.012, 10), motorMat, 0, 0.004, 0, p);
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.105, 32), new THREE.MeshBasicMaterial({ color: spinDir[i] > 0 ? 0xffa53a : 0x39c6e8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      d.rotation.x = -Math.PI / 2;
      d.userData.noExplode = true;
      p.add(d);
      g.add(p);
      props.push(p); discs.push(d); pos.push(new THREE.Vector3(x, 0.045, z));
      // front arms carry red LEDs, rear arms green, so you can always tell front from back
      leds.push(mesh(new THREE.SphereGeometry(0.008, 8, 6), glow(sz > 0 ? 0xff3030 : 0x30ff70), x * 0.8, -0.01, z * 0.8, g));
      // landing leg
      mesh(cyl(0.004, 0.004, 0.07, 6), carbon, x * 0.55, -0.04, z * 0.55, g);
    });
    g.userData = { props, discs, motors, pos, spinDir, batt, cam, arm, leds };
    return g;
  };

  // ---------------------------------------------------------------- rocket parts (metres)
  M.rocketStage = function ({ r = 1.8, len = 20, color = 0xf2f5f8, band = 0x1d4f91, fins = false, bell = 1.4, engines = 1 } = {}) {
    const g = new THREE.Group();
    mesh(cyl(r, r, len, 28), mat(color), 0, len / 2, 0, g);
    mesh(cyl(r * 1.01, r * 1.01, len * 0.06, 28), mat(band), 0, len * 0.85, 0, g);
    mesh(cyl(r * 1.01, r * 1.01, len * 0.04, 28), mat(band), 0, len * 0.12, 0, g);
    const bellMat = mat(0x3a3f47, { metalness: 0.8, roughness: 0.35 });
    const nozzles = [];
    for (let i = 0; i < engines; i++) {
      const a = (i / engines) * Math.PI * 2, rr = engines > 1 ? r * 0.55 : 0;
      const n = mesh(cyl(r * 0.18, r * (engines > 1 ? 0.3 : 0.6), bell, 18), bellMat, Math.cos(a) * rr, -bell / 2, Math.sin(a) * rr, g);
      nozzles.push(n);
    }
    if (fins) {
      for (let i = 0; i < 4; i++) {
        const f = mesh(M.wedge(0.15, len * 0.18, r * 1.3), mat(band), 0, 0, 0, g);
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        f.rotation.y = a + Math.PI / 2;
        f.position.set(Math.cos(a) * (r + r * 0.6), 0, Math.sin(a) * (r + r * 0.6));
        f.rotation.z = 0;
      }
    }
    g.userData = { len, r, nozzles, bell };
    return g;
  };
  M.fairing = function (r = 1.8, len = 8, color = 0xf2f5f8) {
    const g = new THREE.Group();
    mesh(cyl(r, r, len * 0.4, 28), mat(color), 0, len * 0.2, 0, g);
    mesh(new THREE.ConeGeometry(r, len * 0.6, 28), mat(color), 0, len * 0.7, 0, g);
    g.userData = { len, r };
    return g;
  };
  // exhaust plume (cone, additive)
  M.flame = function (r = 1, len = 8) {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(r, len, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const inner = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, len * 0.6, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    outer.rotation.x = inner.rotation.x = Math.PI; // point down
    outer.position.y = -len / 2;
    inner.position.y = (-len * 0.6) / 2;
    outer.userData.noExplode = inner.userData.noExplode = true;
    g.add(outer, inner);
    g.userData = { outer, inner, len };
    return g;
  };

  // ---------------------------------------------------------------- satellites
  const panelTex = () => AC.canvasTex(128, 128, (c, w, hh) => {
    c.fillStyle = '#0b1f4a'; c.fillRect(0, 0, w, hh);
    c.strokeStyle = '#5d7fb8'; c.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo((i * w) / 4, 0); c.lineTo((i * w) / 4, hh); c.stroke(); c.beginPath(); c.moveTo(0, (i * hh) / 4); c.lineTo(w, (i * hh) / 4); c.stroke(); }
  });
  // 1U CubeSat like PearlAfricaSat-1: 10 x 10 x 11.35 cm (model units: 1 = 10 cm)
  M.cubesat = function () {
    const g = new THREE.Group();
    const cell = new THREE.MeshStandardMaterial({ map: panelTex(), roughness: 0.3, metalness: 0.5 });
    const alu = mat(0xc9d1d9, { metalness: 0.8, roughness: 0.35 });
    mesh(box(0.96, 1.08, 0.96), cell, 0, 0, 0, g);
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) mesh(box(0.085, 1.135, 0.085), alu, x * 0.46, 0, z * 0.46, g);
    mesh(box(1, 0.04, 1), alu, 0, 0.55, 0, g);
    mesh(box(1, 0.04, 1), alu, 0, -0.55, 0, g);
    mesh(cyl(0.12, 0.12, 0.05, 16), mat(0x111111), 0, -0.58, 0, g); // camera lens (Earth-facing)
    for (let i = 0; i < 4; i++) {
      const a = mesh(cyl(0.008, 0.008, 1.6, 4), alu, 0, 0.58, 0, g);
      a.rotation.z = Math.PI / 2;
      a.rotation.y = (i * Math.PI) / 2;
      a.position.set(Math.cos((i * Math.PI) / 2) * 0.8, 0.58, Math.sin((i * Math.PI) / 2) * 0.8);
    }
    return g;
  };
  // larger communications satellite (GEO) with solar wings and dish
  M.comsat = function () {
    const g = new THREE.Group();
    const gold = mat(0xd9a73a, { metalness: 0.9, roughness: 0.35 });
    mesh(box(1.2, 1.2, 1.6), gold, 0, 0, 0, g);
    const cell = new THREE.MeshStandardMaterial({ map: panelTex(), roughness: 0.3, metalness: 0.5 });
    for (const s of [1, -1]) {
      mesh(cyl(0.05, 0.05, 0.8, 6), mat(0xaaaaaa), s * 1.0, 0, 0, g).rotation.z = Math.PI / 2;
      mesh(box(3.2, 0.05, 1.2), cell, s * 3.0, 0, 0, g);
    }
    const dish = mesh(new THREE.SphereGeometry(0.7, 20, 10, 0, Math.PI * 2, 0, 0.9), mat(0xeeeeee, { side: THREE.DoubleSide }), 0, -0.1, 1.2, g);
    dish.rotation.x = -Math.PI / 2;
    return g;
  };
  // GPS-style satellite
  M.gpssat = function () {
    const g = M.comsat();
    g.children[0].material = mat(0x8fa3bd, { metalness: 0.8, roughness: 0.3 });
    return g;
  };

  // ---------------------------------------------------------------- planets (procedural textures)
  // 3D value noise so textures wrap around a sphere with no seam
  const N3 = (function () {
    const P = new Uint8Array(512);
    const p = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) P[i] = p[i & 255];
    const f = (t) => t * t * (3 - 2 * t);
    const v = (x, y, z) => P[(P[(P[x & 255] + y) & 511] + z) & 511] / 255;
    function n(x, y, z) {
      const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
      const u = f(x - X), w = f(y - Y), t = f(z - Z);
      const L = AC.lerp;
      return L(L(L(v(X, Y, Z), v(X + 1, Y, Z), u), L(v(X, Y + 1, Z), v(X + 1, Y + 1, Z), u), w), L(L(v(X, Y, Z + 1), v(X + 1, Y, Z + 1), u), L(v(X, Y + 1, Z + 1), v(X + 1, Y + 1, Z + 1), u), w), t);
    }
    return (x, y, z, oct = 4) => { let s = 0, a = 0.5, fr = 1; for (let i = 0; i < oct; i++) { s += a * n(x * fr, y * fr, z * fr); a *= 0.5; fr *= 2; } return s; };
  })();
  M.noise3 = N3;

  function sphereTex(w, hh, fn) {
    return AC.canvasTex(w, hh, (c) => {
      const img = c.createImageData(w, hh);
      for (let j = 0; j < hh; j++) {
        const lat = (0.5 - j / hh) * Math.PI;
        const cy = Math.sin(lat), cr = Math.cos(lat);
        for (let i = 0; i < w; i++) {
          const lon = (i / w) * Math.PI * 2;
          const x = cr * Math.cos(lon), z = cr * Math.sin(lon);
          const col = fn(x, cy, z, lat);
          const k = (j * w + i) * 4;
          img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
    });
  }
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const S = (t) => AC.clamp(t, 0, 1);

  const painters = {
    earth: (x, y, z, lat) => {
      const n = N3(x * 2.2 + 10, y * 2.2, z * 2.2, 5);
      const ice = Math.abs(lat) > 1.25;
      if (ice) return [235, 242, 248];
      if (n > 0.52) {
        const dry = N3(x * 4, y * 4 + 5, z * 4, 3);
        const lush = Math.abs(lat) < 0.35 ? 0.25 : 0;
        return mix3([70, 128, 58], [176, 150, 96], S((dry - 0.45 + 0.0 - lush) * 3));
      }
      return mix3([14, 46, 112], [32, 92, 160], S((n - 0.3) * 4));
    },
    clouds: (x, y, z) => { const n = N3(x * 3 + 3, y * 5, z * 3, 5); const a = S((n - 0.5) * 3.5) * 255; return [a, a, a]; },
    moon: (x, y, z) => { const n = N3(x * 3, y * 3, z * 3, 5); const c = N3(x * 9 + 7, y * 9, z * 9, 2); const v = 120 + n * 90 - (c > 0.62 ? 40 : 0); return [v, v, v * 1.02]; },
    mercury: (x, y, z) => { const n = N3(x * 3, y * 3, z * 3, 5); const v = 110 + n * 80; return [v * 1.05, v * 0.95, v * 0.85]; },
    venus: (x, y, z) => { const n = N3(x * 1.5, y * 6, z * 1.5, 4); return mix3([214, 170, 96], [243, 220, 160], n); },
    mars: (x, y, z, lat) => { if (Math.abs(lat) > 1.3) return [240, 235, 230]; const n = N3(x * 3, y * 3, z * 3, 5); return mix3([120, 48, 24], [214, 112, 62], S(n * 1.3)); },
    jupiter: (x, y, z, lat) => {
      const w = N3(x * 2, y * 2, z * 2, 3) * 0.6;
      const b = Math.sin(lat * 14 + w * 4);
      let c = mix3([196, 150, 110], [238, 224, 200], (b + 1) / 2);
      const dx = x - 0.75, dy = y + 0.38, dz = z - 0.5;
      if (dx * dx * 0.6 + dy * dy * 3.5 + dz * dz * 0.6 < 0.025) c = [190, 92, 60];
      return c;
    },
    saturn: (x, y, z, lat) => { const b = Math.sin(lat * 12 + N3(x * 2, y * 2, z * 2, 2) * 2); return mix3([208, 182, 130], [240, 222, 176], (b + 1) / 2); },
    uranus: (x, y, z, lat) => { const b = Math.sin(lat * 6) * 0.08; return mix3([150, 214, 222], [190, 236, 240], 0.5 + b); },
    neptune: (x, y, z, lat) => { const b = Math.sin(lat * 9 + N3(x * 2, y * 2, z * 2, 2) * 2); return mix3([38, 72, 180], [70, 120, 220], (b + 1) / 2); },
    sun: (x, y, z) => { const n = N3(x * 6, y * 6, z * 6, 4); return mix3([255, 150, 30], [255, 236, 140], n); },
  };

  M.planet = function (name, radius = 1, seg = 48) {
    const res = name === 'earth' ? [1024, 512] : [512, 256];
    const tex = sphereTex(res[0], res[1], painters[name] || painters.moon);
    const isSun = name === 'sun';
    const material = isSun ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 });
    const g = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, seg, seg / 2), material);
    g.add(ball);
    g.userData.ball = ball;
    if (name === 'earth') {
      const ctex = sphereTex(512, 256, painters.clouds);
      const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.012, seg, seg / 2), new THREE.MeshStandardMaterial({ alphaMap: ctex, color: 0xffffff, transparent: true, depthWrite: false, roughness: 1 }));
      g.add(clouds);
      g.userData.clouds = clouds;
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, seg, seg / 2), new THREE.MeshBasicMaterial({ color: 0x5fb4ff, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }));
      g.add(atmo);
    }
    if (name === 'saturn') {
      const rt = AC.canvasTex(256, 4, (c, w) => { for (let i = 0; i < w; i++) { const n = Math.sin(i * 0.3) * 0.3 + Math.sin(i * 0.07) * 0.4; const a = i < 20 || (i > 150 && i < 160) ? 0 : 0.5 + n * 0.4; c.fillStyle = `rgba(220,200,160,${AC.clamp(a, 0, 1)})`; c.fillRect(i, 0, 1, 4); } });
      const geo = new THREE.RingGeometry(radius * 1.25, radius * 2.3, 96, 1);
      const pos = geo.attributes.position, uv = geo.attributes.uv, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - radius * 1.25) / (radius * 1.05), 0.5); }
      const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: rt, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2 + 0.47;
      g.add(ring);
    }
    if (isSun) {
      const gt = AC.canvasTex(128, 128, (c, w, hh) => { const gr = c.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(255,220,120,0.9)'); gr.addColorStop(0.4, 'rgba(255,160,40,0.35)'); gr.addColorStop(1, 'rgba(255,120,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, hh); });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.set(radius * 4.5, radius * 4.5, 1);
      g.add(sp);
    }
    return g;
  };

  // ---------------------------------------------------------------- people & vehicles
  M.astronaut = function () {
    const g = new THREE.Group();
    const suit = mat(0xf0f2f4), visor = mat(0xd9a73a, { metalness: 0.9, roughness: 0.1 });
    mesh(new THREE.SphereGeometry(0.17, 16, 12), suit, 0, 1.6, 0, g);
    mesh(new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, 1.4), visor, 0, 1.6, 0.07, g).rotation.x = Math.PI / 2;
    mesh(cyl(0.2, 0.18, 0.6, 14), suit, 0, 1.15, 0, g);
    mesh(box(0.34, 0.4, 0.15), mat(0xc9d1d9), 0, 1.2, -0.18, g); // backpack
    for (const s of [1, -1]) {
      mesh(cyl(0.07, 0.065, 0.55, 10), suit, s * 0.27, 1.1, 0, g).rotation.z = s * 0.25;
      mesh(cyl(0.085, 0.08, 0.75, 10), suit, s * 0.1, 0.45, 0, g);
      mesh(box(0.14, 0.08, 0.24), mat(0x707a86), s * 0.1, 0.04, 0.04, g);
    }
    mesh(box(0.1, 0.06, 0.02), mat(0xd8332a), 0.1, 1.32, 0.19, g); // flag patch
    return g;
  };
  M.lander = function () {
    const g = new THREE.Group();
    const gold = mat(0xd9a73a, { metalness: 0.85, roughness: 0.4 });
    const grey = mat(0xbfc7cf, { metalness: 0.5, roughness: 0.5 });
    mesh(cyl(1.6, 1.6, 1.4, 8), gold, 0, 1.6, 0, g);
    mesh(cyl(1.0, 1.2, 1.3, 8), grey, 0, 2.95, 0, g);
    mesh(box(0.6, 0.5, 0.1), mat(0x1a2433, { metalness: 0.4, roughness: 0.2 }), 0, 3.1, 1.0, g);
    mesh(cyl(0.3, 0.6, 0.8, 16), mat(0x3a3f47, { metalness: 0.8, roughness: 0.35 }), 0, 0.6, 0, g);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const l = mesh(cyl(0.06, 0.06, 2.2, 6), grey, Math.cos(a) * 1.9, 0.9, Math.sin(a) * 1.9, g);
      l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      mesh(cyl(0.35, 0.4, 0.08, 12), grey, Math.cos(a) * 2.4, 0.04, Math.sin(a) * 2.4, g);
    }
    return g;
  };
  // arcade spaceship used in the test arena
  M.ship = function () {
    const g = new THREE.Group();
    const w = mat(0xe9f0f7), b = mat(0x1d4f91), r = mat(0xd8332a);
    mesh(new THREE.ConeGeometry(0.5, 2.4, 16), w, 0, 0, 0.4, g).rotation.x = Math.PI / 2;
    mesh(cyl(0.5, 0.42, 1.0, 16), w, 0, 0, -1.1, g).rotation.x = Math.PI / 2;
    mesh(box(3.2, 0.08, 0.9), b, 0, 0, -0.8, g);
    mesh(box(0.08, 0.8, 0.7), r, 0, 0.4, -1.3, g);
    mesh(new THREE.SphereGeometry(0.32, 14, 10), mat(0x1a2433, { metalness: 0.5, roughness: 0.1 }), 0, 0.25, 0.3, g);
    const fl = M.flame(0.35, 1.6);
    fl.rotation.x = -Math.PI / 2;
    fl.position.z = -1.6;
    g.add(fl);
    g.userData.flame = fl;
    return g;
  };

  // ---------------------------------------------------------------- scenery
  // hoop to fly through
  M.ring = function (r = 1, tube = 0.08, color = 0xff70d8) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 40), new THREE.MeshBasicMaterial({ color }));
    return m;
  };
  // ground with grass, lake and a runway (plane game). Runway centre at origin, along Z.
  M.airfield = function (scene, o = {}) {
    const size = o.size || 9000;
    const seg = 160;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const lake = o.lake || { x: 1800, z: 600, r: 1400 };
    const grass = new THREE.Color(0x5f8d3e), dry = new THREE.Color(0x9c8a52), dark = new THREE.Color(0x3f6b2c), c = new THREE.Color();
    // terrain height (m): flat airfield, Lake Victoria shore, rolling hills further out
    function heightAt(x, z) {
      const n = AC.noise2(x * 0.0012 + 50, z * 0.0012, 5);
      const far = Math.max(0, Math.hypot(x, z) - 1600);
      let hgt = (n - 0.45) * Math.min(far, 2500) * 0.12;
      const dl = Math.hypot(x - lake.x, z - lake.z) + (n - 0.5) * 500;
      if (dl < lake.r) hgt = -6;
      if (Math.abs(x) < 120 && Math.abs(z) < 900) hgt = 0;
      return hgt;
    }
    const inLake = (x, z) => Math.hypot(x - lake.x, z - lake.z) + (AC.noise2(x * 0.0012 + 50, z * 0.0012, 5) - 0.5) * 500 < lake.r;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = AC.noise2(x * 0.0012 + 50, z * 0.0012, 5);
      const hgt = heightAt(x, z);
      pos.setY(i, hgt);
      c.copy(grass).lerp(n > 0.55 ? dry : dark, Math.abs(n - 0.5) * 2.4);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    ground.receiveShadow = true;
    scene.add(ground);
    const water = new THREE.Mesh(new THREE.CircleGeometry(lake.r + 400, 64), new THREE.MeshStandardMaterial({ color: 0x2f6f9a, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(lake.x, -1.5, lake.z);
    scene.add(water);
    // runway with TinkerCAD-style flat box and painted texture
    const len = o.runway || 1400, wid = 30;
    const tex = AC.canvasTex(128, 2048, (g, w, hh) => {
      g.fillStyle = '#3b3f45'; g.fillRect(0, 0, w, hh);
      g.fillStyle = '#e8e8e8';
      for (let i = 0; i < 8; i++) { g.fillRect(8 + i * 14, 20, 8, 110); g.fillRect(8 + i * 14, hh - 130, 8, 110); }
      for (let y = 200; y < hh - 200; y += 70) g.fillRect(w / 2 - 2, y, 4, 36);
      g.fillRect(2, 0, 3, hh); g.fillRect(w - 5, 0, 3, hh);
      g.font = 'bold 48px sans-serif'; g.textAlign = 'center';
      g.save(); g.translate(w / 2, 190); g.fillText('17', 0, 0); g.restore();
      g.save(); g.translate(w / 2, hh - 150); g.rotate(Math.PI); g.fillText('35', 0, 0); g.restore();
    });
    const runway = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.1, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    runway.position.y = 0.05;
    runway.receiveShadow = true;
    scene.add(runway);
    // control tower + hangars (box + cylinder + round roof)
    const tower = new THREE.Group();
    mesh(cyl(4, 5, 24, 12), mat(0xdfe5ea), 0, 12, 0, tower);
    mesh(cyl(7, 6, 5, 12), mat(0x2a3a4d, { metalness: 0.4, roughness: 0.2 }), 0, 26.5, 0, tower);
    mesh(cyl(7.4, 7.4, 1, 12), mat(0xdfe5ea), 0, 29.5, 0, tower);
    tower.position.set(-120, 0, 150);
    scene.add(tower);
    for (let i = 0; i < 3; i++) {
      const hg = new THREE.Group();
      mesh(box(40, 12, 30), mat(0xb9c3cc), 0, 6, 0, hg);
      const roof = mesh(new THREE.CylinderGeometry(15, 15, 40, 16, 1, false, 0, Math.PI), mat(0x8996a3), 0, 12, 0, hg);
      roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
      hg.position.set(-110, 0, -150 - i * 50);
      hg.rotation.y = Math.PI / 2;
      scene.add(hg);
    }
    // trees (instanced cones + cylinders)
    const treeN = 700;
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(5, 14, 7), mat(0x2f5f2a), treeN);
    const trunk = new THREE.InstancedMesh(cyl(0.7, 0.9, 4, 6), mat(0x5a3f28), treeN);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    let k = 0;
    for (let tries = 0; tries < 4000 && k < treeN; tries++) {
      const x = AC.rand(-size / 2.3, size / 2.3), z = AC.rand(-size / 2.3, size / 2.3);
      if (Math.abs(x) < 160 && Math.abs(z) < 1100) continue;
      if (Math.hypot(x - lake.x, z - lake.z) < lake.r + 150) continue;
      const s = AC.rand(0.6, 1.5);
      sc.set(s, s, s);
      p.set(x, 7 * s + 3, z);
      m4.compose(p, q, sc); crown.setMatrixAt(k, m4);
      p.set(x, 2 * s, z);
      m4.compose(p, q, sc); trunk.setMatrixAt(k, m4);
      k++;
    }
    crown.count = trunk.count = k;
    scene.add(crown, trunk);
    return { ground, runway, water, lake, runwayLen: len, runwayWidth: wid, heightAt, inLake };
  };

  // simple grassy field with landing pads (drone games)
  M.field = function (scene, size = 400) {
    const tex = AC.canvasTex(512, 512, (g, w, hh) => {
      g.fillStyle = '#4f7f36'; g.fillRect(0, 0, w, hh);
      for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(40,80,30,0.35)' : 'rgba(120,160,70,0.25)'; g.fillRect(Math.random() * w, Math.random() * hh, 2, 2); }
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2;
      for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo((i * w) / 8, 0); g.lineTo((i * w) / 8, hh); g.stroke(); g.beginPath(); g.moveTo(0, (i * hh) / 8); g.lineTo(w, (i * hh) / 8); g.stroke(); }
    }, [size / 16, size / 16]);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    return ground;
  };
  M.pad = function (label = 'H', color = 0xffb547, r = 0.8) {
    const g = new THREE.Group();
    const tex = AC.canvasTex(256, 256, (c, w) => {
      c.fillStyle = '#20262e'; c.beginPath(); c.arc(128, 128, 126, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#' + color.toString(16).padStart(6, '0'); c.lineWidth = 12; c.beginPath(); c.arc(128, 128, 110, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ffffff'; c.font = 'bold 120px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, 128, 136);
    });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 40), [mat(0x20262e), new THREE.MeshStandardMaterial({ map: tex }), mat(0x20262e)]);
    disc.position.y = 0.02;
    disc.receiveShadow = true;
    g.add(disc);
    return g;
  };
})();
