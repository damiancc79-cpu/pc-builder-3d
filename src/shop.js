// shop.js — the repair bay: room shell, workbench, pegboard, shelving, tools,
// and the visual damage overlays that get stuck onto a faulty component.
//
// Same conventions as models.js: 1 world unit = 100 mm, procedural only.

import * as THREE from 'three';

/* ------------------------------------------------------------------ helpers */
const _unit = new THREE.BoxGeometry(1, 1, 1);
_unit.userData.shared = true;

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(_unit, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function cyl(r, h, mat, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
const mat = (color, roughness = 0.7, metalness = 0.1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const _texCache = new Map();
function canvasTex(key, w, h, draw, repeat) {
  if (_texCache.has(key)) return _texCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  _texCache.set(key, t);
  return t;
}

function pegboardTex() {
  return canvasTex('pegboard', 128, 128, (c, w, h) => {
    c.fillStyle = '#8a6f4e'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < 300; i++) c.fillRect(Math.random() * w, Math.random() * h, 3, 1);
    c.fillStyle = '#2a2118';
    for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) {
      c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill();
    }
  }, [6, 3]);
}

function concreteTex() {
  return canvasTex('concrete', 256, 256, (c, w, h) => {
    c.fillStyle = '#2c3138'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) {
      const v = Math.random();
      c.fillStyle = `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},0.035)`;
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 2;
    c.strokeRect(0, 0, w, h);
  }, [10, 10]);
}

function matTex() {
  // ESD mat: dark blue rubber with a faint grid and a grounding stud
  return canvasTex('esdmat', 256, 256, (c, w, h) => {
    c.fillStyle = '#16323f'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(120,190,220,0.08)'; c.lineWidth = 1;
    for (let i = 0; i <= w; i += 32) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke();
      c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke();
    }
    c.strokeStyle = 'rgba(120,190,220,0.16)'; c.lineWidth = 3;
    c.strokeRect(8, 8, w - 16, h - 16);
  });
}

function signTex(text, sub) {
  return canvasTex('sign' + text, 512, 128, (c, w, h) => {
    c.fillStyle = '#07090d'; c.fillRect(0, 0, w, h);
    c.textAlign = 'center';
    c.fillStyle = '#38e8ff';
    c.font = 'bold 54px Inter, system-ui, sans-serif';
    c.fillText(text, w / 2, 62);
    c.fillStyle = '#ff4d9d';
    c.font = 'bold 20px Inter, system-ui, sans-serif';
    c.fillText(sub, w / 2, 94);
  });
}

function boxArtTex(label, hue) {
  return canvasTex('boxart' + label + hue, 128, 128, (c, w, h) => {
    c.fillStyle = `hsl(${hue},32%,26%)`; c.fillRect(0, 0, w, h);
    c.fillStyle = `hsl(${hue},45%,38%)`; c.fillRect(0, 0, w, 30);
    c.fillStyle = '#e8f0f6'; c.font = 'bold 15px monospace'; c.textAlign = 'center';
    c.fillText(label, w / 2, 20);
    c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 2;
    c.strokeRect(10, 42, w - 20, h - 56);
    c.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 5; i++) c.fillRect(20, 54 + i * 12, w - 40 - i * 9, 5);
  });
}

/* ================================================================== the room */

export const BENCH_TOP_Y = -0.55;      // where a machine sits on the bench

/**
 * Builds the whole repair bay. The workbench top is at BENCH_TOP_Y so a case
 * placed there rests on the surface rather than floating.
 */
export function buildShop() {
  const g = new THREE.Group();
  g.userData.lights = [];

  const W = 26, D = 20, H = 11;          // room, in 100 mm units
  const floorY = -3.0;

  // ---- shell
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: concreteTex(), roughness: 0.88, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  g.add(floor);

  const wallMat = mat(0x39424e, 0.9, 0.05);
  const backWall = box(W, H, 0.3, wallMat, 0, floorY + H / 2, -D / 2);
  g.add(backWall);
  g.add(box(0.3, H, D, wallMat, -W / 2, floorY + H / 2, 0));
  g.add(box(0.3, H, D, wallMat, W / 2, floorY + H / 2, 0));
  // ceiling, kept dark so it reads as depth rather than a lid
  g.add(box(W, 0.3, D, mat(0x14181e, 0.95, 0), 0, floorY + H, 0));

  // skirting + a painted safety line
  g.add(box(W, 0.35, 0.12, mat(0x232a33, 0.85), 0, floorY + 0.17, -D / 2 + 0.2));
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(W - 1, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xd9a227, roughness: 0.8 }));
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(0, floorY + 0.01, 3.6);
  g.add(stripe);

  // ---- sign over the bench
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3),
    new THREE.MeshStandardMaterial({
      map: signTex('RIGFORGE', 'SERVICE  ·  BAY 1'), roughness: 0.5, metalness: 0.2,
      emissive: 0xffffff, emissiveMap: signTex('RIGFORGE', 'SERVICE  ·  BAY 1'),
      emissiveIntensity: 0.85,
    }));
  sign.position.set(0, floorY + 7.4, -D / 2 + 0.17);
  g.add(sign);

  // ---- pegboard + hung tools
  const peg = new THREE.Mesh(new THREE.PlaneGeometry(9, 4),
    new THREE.MeshStandardMaterial({ map: pegboardTex(), roughness: 0.85 }));
  peg.position.set(0, floorY + 4.3, -D / 2 + 0.17);
  peg.receiveShadow = true;
  g.add(peg);
  g.add(hangingTools(0, floorY + 4.3, -D / 2 + 0.22));

  // ---- shelving either side, stacked with part boxes
  g.add(shelfUnit(-8.4, floorY, -D / 2 + 1.3, 27));
  g.add(shelfUnit(8.4, floorY, -D / 2 + 1.3, 205));

  // ---- the workbench
  const bench = workbench(floorY);
  g.add(bench);

  // ---- bench props
  g.add(benchProps(BENCH_TOP_Y));

  // ---- a parts trolley off to one side
  g.add(trolley(-6.6, floorY, 2.4));

  // ---- lighting rig: two ceiling strips + a task lamp over the bench
  for (const x of [-4.5, 4.5]) {
    const tube = box(0.5, 0.16, 7.5, new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xdcecff, emissiveIntensity: 1.5, roughness: 0.4,
    }), x, floorY + H - 0.5, -1.5);
    g.add(tube);
    const l = new THREE.PointLight(0xdcecff, 55, 22, 2);
    l.position.set(x, floorY + H - 1.0, -1.5);
    g.add(l);
    g.userData.lights.push(l);
  }

  // Hung above and behind the bench: lights the work area without sitting
  // between the technician's viewpoint and the machine.
  const task = new THREE.SpotLight(0xffffff, 150, 15, 0.68, 0.45, 2);
  task.position.set(0.4, floorY + 6.6, -2.1);
  task.target.position.set(0.2, BENCH_TOP_Y, 0.3);
  task.castShadow = true;
  task.shadow.mapSize.set(1024, 1024);
  task.shadow.bias = -0.0012;
  task.shadow.normalBias = 0.02;
  g.add(task, task.target);
  g.userData.taskLight = task;

  // the lamp housing itself, on a drop rod from the ceiling
  g.add(box(0.1, 1.6, 0.1, mat(0x2b323b, 0.5, 0.6), 0.4, floorY + H - 0.8, -2.1));
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.75, 18, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x3d4650, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide,
    }));
  shade.position.set(0.4, floorY + 6.62, -2.1);
  shade.rotation.x = -0.3;
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.62, 18),
    new THREE.MeshBasicMaterial({ color: 0xfff4dd }));
  bulb.position.set(0.42, floorY + 6.3, -2.02);
  bulb.rotation.x = -Math.PI / 2 - 0.3;
  g.add(bulb);

  g.userData.floorY = floorY;
  return g;
}

function workbench(floorY) {
  const g = new THREE.Group();
  const steel = mat(0x545e6a, 0.45, 0.8);
  const topMat = new THREE.MeshStandardMaterial({ map: matTex(), roughness: 0.82, metalness: 0.05 });

  const topY = BENCH_TOP_Y - 0.09;
  // worktop with an ESD mat surface
  const top = box(11, 0.18, 5.2, mat(0x3a3128, 0.8, 0.05), 0, topY, 0.4);
  g.add(top);
  const esd = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 4.2), topMat);
  esd.rotation.x = -Math.PI / 2;
  esd.position.set(-0.4, BENCH_TOP_Y + 0.001, 0.4);
  esd.receiveShadow = true;
  g.add(esd);

  // legs + lower shelf
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(box(0.24, topY - floorY, 0.24, steel, sx * 5.2, (topY + floorY) / 2, 0.4 + sz * 2.3));
  g.add(box(10.6, 0.12, 4.6, mat(0x39414b, 0.7, 0.5), 0, floorY + 0.9, 0.4));

  // a couple of drawers under the right end
  for (let i = 0; i < 3; i++) {
    const y = topY - 0.45 - i * 0.62;
    g.add(box(3.0, 0.56, 4.4, mat(0x4a545f, 0.55, 0.6), 3.6, y, 0.4));
    g.add(box(1.1, 0.09, 0.12, mat(0x9aa6b2, 0.35, 0.9), 3.6, y, 0.4 - 2.24));
  }
  return g;
}

/** Screwdrivers, pliers and a can hanging on the pegboard. */
function hangingTools(x, y, z) {
  const g = new THREE.Group();
  const handle = mat(0xc4392f, 0.6, 0.1);
  const handle2 = mat(0x1f6fb2, 0.6, 0.1);
  const steel = mat(0xb8c2cc, 0.3, 0.95);

  // a row of screwdrivers, descending in size
  for (let i = 0; i < 6; i++) {
    const s = 1 - i * 0.07;
    const hx = x - 3.5 + i * 0.55;
    const h = cyl(0.09, 0.85 * s, i % 2 ? handle2 : handle, 10);
    h.position.set(hx, y + 1.05, z); g.add(h);
    const shaft = cyl(0.035, 0.9 * s, steel, 8);
    shaft.position.set(hx, y + 0.2, z); g.add(shaft);
  }
  // pliers + cutters as simple crossed bars
  for (let i = 0; i < 2; i++) {
    const px = x + 0.9 + i * 0.9;
    for (const rot of [0.22, -0.22]) {
      const bar = box(0.1, 1.5, 0.08, steel, px, y + 0.7, z);
      bar.rotation.z = rot;
      g.add(bar);
    }
    g.add(box(0.34, 0.5, 0.1, i ? handle : handle2, px, y + 0.05, z));
  }
  // compressed-air can + paste tube on a small ledge
  g.add(box(2.4, 0.1, 0.45, mat(0x4a545f, 0.6, 0.5), x + 3.1, y - 0.9, z + 0.2));
  const can = cyl(0.26, 1.0, mat(0xdcdfe3, 0.4, 0.5), 14);
  can.position.set(x + 2.5, y - 0.35, z + 0.2); g.add(can);
  g.add(box(0.1, 0.3, 0.1, mat(0xd23a3a, 0.6), x + 2.5, y + 0.22, z + 0.2));
  const tube = cyl(0.13, 0.7, mat(0x22262c, 0.5), 12);
  tube.position.set(x + 3.3, y - 0.5, z + 0.2); g.add(tube);
  return g;
}

function shelfUnit(x, floorY, z, hue) {
  const g = new THREE.Group();
  const frame = mat(0x4b5560, 0.5, 0.7);
  const W = 4.6, D = 1.9, H = 6.4;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(box(0.14, H, 0.14, frame, x + sx * W / 2, floorY + H / 2, z + sz * D / 2));
  const labels = ['GPU', 'PSU', 'DDR5', 'M.2', 'FANS', 'MB'];
  for (let s = 0; s < 4; s++) {
    const y = floorY + 0.9 + s * 1.7;
    g.add(box(W, 0.1, D, mat(0x3d4650, 0.7, 0.4), x, y, z));
    // boxed stock, jittered a little so it doesn't read as a texture
    const n = 3 + (s % 2);
    for (let i = 0; i < n; i++) {
      const bw = W / n * 0.82;
      const label = labels[(s * 2 + i) % labels.length];
      const b = new THREE.Mesh(_unit, new THREE.MeshStandardMaterial({
        map: boxArtTex(label, (hue + s * 26 + i * 11) % 360), roughness: 0.85,
      }));
      b.scale.set(bw, 1.15 + (i % 2) * 0.2, D * 0.75);
      b.position.set(x - W / 2 + (i + 0.5) * (W / n), y + 0.63, z + (i % 2 ? 0.08 : -0.06));
      b.rotation.y = (i % 3 - 1) * 0.05;
      b.castShadow = b.receiveShadow = true;
      g.add(b);
    }
  }
  return g;
}

function trolley(x, floorY, z) {
  const g = new THREE.Group();
  const frame = mat(0x50596a, 0.5, 0.7);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.12, 2.0, 0.12, frame, x + sx * 1.0, floorY + 1.1, z + sz * 0.7));
    const w = cyl(0.16, 0.1, mat(0x15181c, 0.9), 12);
    w.rotation.z = Math.PI / 2;
    w.position.set(x + sx * 1.0, floorY + 0.16, z + sz * 0.7);
    g.add(w);
  }
  for (let i = 0; i < 2; i++)
    g.add(box(2.3, 0.09, 1.7, mat(0x3f4854, 0.65, 0.45), x, floorY + 0.8 + i * 1.2, z));
  // a scatter of pulled parts on the top shelf
  g.add(box(0.9, 0.12, 0.6, mat(0x1b3a2a, 0.7), x - 0.5, floorY + 2.06, z - 0.2));
  g.add(box(0.5, 0.3, 0.5, mat(0x2a2f36, 0.6, 0.6), x + 0.6, floorY + 2.15, z + 0.2));
  return g;
}

/** Loose objects on the bench: tray of screws, coffee, notepad, torch. */
function benchProps(topY) {
  const g = new THREE.Group();
  // magnetic parts tray
  const tray = box(1.3, 0.16, 1.0, mat(0x8a9198, 0.35, 0.9), -4.3, topY + 0.08, 1.5);
  g.add(tray);
  for (let i = 0; i < 7; i++) {
    const s = cyl(0.045, 0.12, mat(0xb9c2cc, 0.3, 1), 8);
    s.rotation.x = Math.PI / 2;
    s.position.set(-4.6 + (i % 4) * 0.2, topY + 0.19, 1.3 + Math.floor(i / 4) * 0.22);
    g.add(s);
  }
  // notepad with the job sheet
  const pad = box(1.5, 0.06, 1.1, mat(0xe8e4d8, 0.9), -4.2, topY + 0.03, -0.9);
  pad.rotation.y = 0.16;
  g.add(pad);
  // coffee
  const mug = cyl(0.28, 0.52, mat(0xd8dde2, 0.5), 16);
  mug.position.set(4.5, topY + 0.26, 1.7); g.add(mug);
  const brew = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), mat(0x3a2418, 0.35));
  brew.rotation.x = -Math.PI / 2;
  brew.position.set(4.5, topY + 0.5, 1.7); g.add(brew);
  // torch
  const torch = cyl(0.11, 1.0, mat(0x1d232b, 0.5, 0.6), 12);
  torch.rotation.z = Math.PI / 2;
  torch.position.set(4.3, topY + 0.11, -1.0); g.add(torch);
  return g;
}

/* ================================================================== damage */

/**
 * Visual damage stuck onto a component. Returns a group that should be added to
 * the faulty part; `dispose()` removes it once the fault is repaired.
 */
/** Bounding box of a subtree expressed in that subtree's own local frame.
 *  A world-space Box3 is wrong here: most components hang off rotated anchors,
 *  so world X/Y/Z do not line up with the part's own axes. */
function localBounds(root) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const tmp = new THREE.Box3(), m = new THREE.Matrix4();
  root.traverse(o => {
    if (!o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox);
    m.multiplyMatrices(inv, o.matrixWorld);
    tmp.applyMatrix4(m);
    box.union(tmp);
  });
  if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
  return box;
}

export function buildDamage(kind, part) {
  const g = new THREE.Group();
  const b = localBounds(part);
  const size = b.getSize(new THREE.Vector3());
  const centre = b.getCenter(new THREE.Vector3());

  switch (kind) {
    case 'dust': {
      // a felt of fine grey flakes packed into the fins
      const m = new THREE.MeshStandardMaterial({
        color: 0x6e6558, roughness: 1, metalness: 0,
        transparent: true, opacity: 0.9, flatShading: true,
      });
      const n = 260;
      const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.018, 0), m, n);
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion();
      const v = new THREE.Vector3(), s = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        v.set(centre.x + (Math.random() - 0.5) * size.x * 0.94,
          centre.y + (Math.random() - 0.5) * size.y * 0.94,
          centre.z + (Math.random() - 0.5) * size.z * 0.96);
        q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3));
        const k = 0.7 + Math.random() * 0.8;
        s.set(k * 2.2, k * 0.5, k * 2.2);        // flattened flakes, not gravel
        mtx.compose(v, q, s);
        inst.setMatrixAt(i, mtx);
      }
      inst.instanceMatrix.needsUpdate = true;
      g.add(inst);
      break;
    }
    case 'burn': {
      // scorch halo + soot, on the top face where it can actually be seen
      const yTop = centre.y + size.y * 0.5 + 0.012;
      const m = new THREE.MeshStandardMaterial({
        color: 0x120c08, roughness: 1, metalness: 0, transparent: true, opacity: 0.88,
      });
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(new THREE.CircleGeometry(0.12 + Math.random() * 0.26, 12), m);
        p.rotation.x = -Math.PI / 2;
        p.position.set(centre.x + (Math.random() - 0.5) * size.x * 0.7, yTop,
          centre.z + (Math.random() - 0.5) * size.z * 0.7);
        g.add(p);
      }
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18),
        new THREE.MeshBasicMaterial({
          color: 0x5a2410, transparent: true, opacity: 0.4, depthWrite: false,
        }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(centre.x, yTop + 0.004, centre.z);
      g.add(glow);
      break;
    }
    case 'bulge': {
      // two domed, weeping capacitors
      const canM = new THREE.MeshStandardMaterial({ color: 0x2b3a52, roughness: 0.45, metalness: 0.6 });
      const gunk = new THREE.MeshStandardMaterial({ color: 0x8a5a1e, roughness: 0.9 });
      for (let i = 0; i < 2; i++) {
        const x = centre.x - 0.35 + i * 0.28;
        const y = centre.y + 0.30;
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 12), canM);
        can.rotation.x = Math.PI / 2;
        can.position.set(x, y, centre.z + size.z * 0.5 + 0.08);
        g.add(can);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8, 0, 6.3, 0, 1.3), canM);
        dome.rotation.x = -Math.PI / 2;
        dome.position.set(x, y, centre.z + size.z * 0.5 + 0.18);
        g.add(dome);
        const ooze = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), gunk);
        ooze.position.set(x, y, centre.z + size.z * 0.5 + 0.03);
        g.add(ooze);
      }
      break;
    }
    case 'crack': {
      // a snapped fan blade + jam marker
      const m = new THREE.MeshStandardMaterial({ color: 0x11151a, roughness: 0.8, side: THREE.DoubleSide });
      for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.06), m);
        shard.position.set(centre.x + (Math.random() - 0.5) * 0.9,
          centre.y - size.y * 0.4, centre.z + (Math.random() - 0.5) * 0.9);
        shard.rotation.set(Math.random(), Math.random() * 3, Math.random());
        g.add(shard);
      }
      break;
    }
    case 'loose': {
      // a dangling, unplugged connector
      const m = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.8 });
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.16), m);
      head.position.set(centre.x + size.x * 0.28, centre.y - 0.28, centre.z + size.z * 0.55);
      g.add(head);
      const curve = new THREE.CatmullRomCurve3([
        head.position.clone(),
        head.position.clone().add(new THREE.Vector3(0.15, -0.45, 0.12)),
        head.position.clone().add(new THREE.Vector3(-0.1, -0.95, 0.05)),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.045, 6, false), m));
      break;
    }
    case 'chalk': {
      // dried-out thermal compound: a pale cracked patch
      const m = new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 1, metalness: 0 });
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.19, 14), m);
      patch.position.set(centre.x, centre.y, centre.z + size.z * 0.5 + 0.01);
      g.add(patch);
      const dark = new THREE.MeshStandardMaterial({ color: 0x5d574c, roughness: 1 });
      for (let i = 0; i < 6; i++) {
        const cr = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.16), dark);
        cr.position.set(centre.x + (Math.random() - 0.5) * 0.28,
          centre.y + (Math.random() - 0.5) * 0.28, centre.z + size.z * 0.5 + 0.02);
        cr.rotation.z = Math.random() * 3;
        g.add(cr);
      }
      break;
    }
  }

  g.userData.isDamage = true;
  return g;
}

/** Which damage visual belongs to which fault. */
export const DAMAGE_FOR_FAULT = {
  'ram-unseated': null,          // handled by physically offsetting the stick
  'gpu-power-loose': 'loose',
  'dust-choked': 'dust',
  'paste-dried': 'chalk',
  'cooler-loose': null,          // handled by tilting the cooler
  'psu-dead': 'burn',
  'mobo-caps': 'bulge',
  'gpu-fan-seized': 'crack',
  'ssd-failing': null,
  'ram-bad-stick': null,
  'fan-unplugged': 'loose',
};
