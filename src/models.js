// models.js — every component is generated procedurally from its spec sheet.
// No external assets: geometry + canvas textures only.
// Scale: 1 world unit = 100 mm.  MM converts millimetres to units.

import * as THREE from 'three';

export const MM = 0.01;

/* ------------------------------------------------------------------ textures */
const _texCache = new Map();
function canvasTex(key, size, draw, repeat) {
  if (_texCache.has(key)) return _texCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  _texCache.set(key, t);
  return t;
}

function pcbTexture(hex) {
  const base = '#' + hex.toString(16).padStart(6, '0');
  return canvasTex('pcb' + hex, 512, (c, s) => {
    c.fillStyle = base; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = `rgba(255,255,255,${Math.random() * 0.022})`;
      c.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    c.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      c.lineWidth = Math.random() < 0.2 ? 2.4 : 1.1;
      c.strokeStyle = `rgba(120,170,150,${0.04 + Math.random() * 0.09})`;
      let x = Math.random() * s, y = Math.random() * s;
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        if (Math.random() < 0.5) x += (Math.random() * 70 + 15) * (Math.random() < .5 ? -1 : 1);
        else y += (Math.random() * 70 + 15) * (Math.random() < .5 ? -1 : 1);
        c.lineTo(x, y);
      }
      c.stroke();
    }
    for (let i = 0; i < 340; i++) {
      c.fillStyle = 'rgba(200,168,96,0.30)';
      c.beginPath(); c.arc(Math.random() * s, Math.random() * s, 1.7, 0, 7); c.fill();
    }
    for (let i = 0; i < 40; i++) {           // silkscreen marks
      c.strokeStyle = 'rgba(220,230,240,0.10)'; c.lineWidth = 1;
      c.strokeRect(Math.random() * s, Math.random() * s, 14 + Math.random() * 40, 8 + Math.random() * 22);
    }
  }, [1, 1]);
}

function meshPanelTexture() {
  return canvasTex('meshpanel', 128, (c, s) => {
    c.fillStyle = '#252a31'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#04060a';
    const step = 16, r = 5.6;
    for (let y = -step; y < s + step; y += step)
      for (let x = -step; x < s + step; x += step) {
        const ox = ((y / step) | 0) % 2 ? step / 2 : 0;
        c.beginPath(); c.arc(x + ox, y, r, 0, 7); c.fill();
      }
  }, [6, 7]);
}

function ventTexture() {
  return canvasTex('vent', 128, (c, s) => {
    c.fillStyle = '#1b1f25'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#05070a';
    for (let y = 6; y < s; y += 14) c.fillRect(8, y, s - 16, 6);
  }, [4, 4]);
}

function finTexture(dark = '#0b0e12', light = '#4a545e') {
  return canvasTex('fin' + dark + light, 128, (c, s) => {
    c.fillStyle = light; c.fillRect(0, 0, s, s);
    c.fillStyle = dark;
    for (let x = 0; x < s; x += 5) c.fillRect(x, 0, 2.4, s);
  }, [10, 1]);
}

function labelTexture(key, draw) {
  return canvasTex('lbl' + key, 256, (c, s) => {
    c.fillStyle = '#0d1015'; c.fillRect(0, 0, s, s);
    draw(c, s);
  });
}

/* ------------------------------------------------------------------ materials */
const M = {
  steel: (col = 0x2b3038, r = 0.5) =>
    new THREE.MeshStandardMaterial({ color: col, roughness: r, metalness: 0.85 }),
  alu: (col = 0xb9c2cc) =>
    new THREE.MeshStandardMaterial({ color: col, roughness: 0.34, metalness: 0.95 }),
  copper: () => new THREE.MeshStandardMaterial({ color: 0xc27a3a, roughness: 0.28, metalness: 1 }),
  plastic: (col = 0x14171c, r = 0.72) =>
    new THREE.MeshStandardMaterial({ color: col, roughness: r, metalness: 0.05 }),
  rubber: (col = 0x0a0c0f) =>
    new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, metalness: 0 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xd7ab4e, roughness: 0.3, metalness: 1 }),
  glass: () => new THREE.MeshPhysicalMaterial({
    color: 0x0d1a22, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.2,
    side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.05,
  }),
  pcb: (hex) => new THREE.MeshStandardMaterial({
    color: 0xffffff, map: pcbTexture(hex), roughness: 0.62, metalness: 0.12,
  }),
};

function rgbMat(intensity = 1.1) {
  const m = new THREE.MeshStandardMaterial({
    color: 0x111111, emissive: new THREE.Color(0x00ffcc),
    emissiveIntensity: intensity, roughness: 0.4, metalness: 0,
  });
  m.userData.rgb = { phase: Math.random() * 6.283, speed: 0.55 };
  return m;
}
function ledMat(color, intensity = 1.6) {
  return new THREE.MeshStandardMaterial({
    color: 0x080808, emissive: new THREE.Color(color), emissiveIntensity: intensity,
    roughness: 0.5, metalness: 0,
  });
}

/* ------------------------------------------------------------------ geometry helpers */
function roundedShape(w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const x = -w / 2, y = -h / 2, s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Rounded-corner slab centred on the origin, thickness along Z. */
function slabGeo(w, h, d, r = 0.02) {
  const g = new THREE.ExtrudeGeometry(roundedShape(w, h, r),
    { depth: d, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -d / 2);
  return g;
}

let _box = null;
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  if (!_box) { _box = new THREE.BoxGeometry(1, 1, 1); _box.userData.shared = true; }
  const m = new THREE.Mesh(_box, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function slab(w, h, d, mat, r = 0.02) {
  const m = new THREE.Mesh(slabGeo(w, h, d, r), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Anchor: an empty whose +Z is the direction a part is pulled out along. */
function anchor(parent, x, y, z, rx = 0, ry = 0, rz = 0) {
  const a = new THREE.Object3D();
  a.position.set(x, y, z);
  a.rotation.set(rx, ry, rz);
  parent.add(a);
  return a;
}

/* ================================================================== FAN */
export function buildFan(size, opt = {}) {
  const { color = 0x15181d, rgb = false, blades = 9, depth = 25 * MM } = opt;
  const g = new THREE.Group();
  const half = size / 2;

  // square frame with a circular bore
  const shape = roundedShape(size, size, size * 0.09);
  shape.holes.push(new THREE.Path().absarc(0, 0, half * 0.94, 0, Math.PI * 2, true));
  const frameGeo = new THREE.ExtrudeGeometry(shape,
    { depth, bevelEnabled: false, curveSegments: 20 });
  frameGeo.translate(0, 0, -depth / 2);
  const frame = new THREE.Mesh(frameGeo, M.plastic(color, 0.66));
  frame.castShadow = frame.receiveShadow = true;
  g.add(frame);

  // corner rubber pads
  const pad = M.rubber();
  for (const sx of [-1, 1]) for (const sy of [-1, 1])
    g.add(box(size * 0.14, size * 0.14, depth * 1.06, pad, sx * half * 0.86, sy * half * 0.86, 0));

  if (rgb) {                                    // diffuser ring in the frame bore
    const rm = rgbMat(1.5);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(half * 0.9, size * 0.028, 8, 40), rm);
    ring.position.z = depth * 0.42;
    g.add(ring);
  }

  const rotor = new THREE.Group();
  rotor.userData.rotor = { speed: 1 };
  g.add(rotor);

  const hub = cyl(half * 0.30, half * 0.32, depth * 0.72, M.plastic(0x0a0c10, 0.5), 22);
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  const cap = cyl(half * 0.30, half * 0.30, 0.004, M.plastic(0x1b2028, 0.35), 22);
  cap.rotation.x = Math.PI / 2; cap.position.z = depth * 0.37;
  rotor.add(cap);

  // curved blades
  const bladeMat = new THREE.MeshStandardMaterial({
    color: rgb ? 0xdfe6ee : 0x2a3038, roughness: rgb ? 0.28 : 0.6,
    metalness: 0.08, side: THREE.DoubleSide,
    transparent: rgb, opacity: rgb ? 0.85 : 1,
  });
  const bg = bladeGeo(half * 0.3, half * 0.92, 0.62, depth * 0.5);
  for (let i = 0; i < blades; i++) {
    const b = new THREE.Mesh(bg, bladeMat);
    b.rotation.z = (i / blades) * Math.PI * 2;
    b.castShadow = true;
    rotor.add(b);
  }

  g.userData.size = new THREE.Vector3(size, size, depth);
  return g;
}

function bladeGeo(inner, outer, arc, pitch) {
  const g = new THREE.PlaneGeometry(1, 1, 6, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5;        // 0 at hub → 1 at tip
    const v = p.getY(i);              // -0.5 … 0.5 across the blade
    const r = inner + (outer - inner) * u;
    const a = v * arc * (0.35 + 0.65 * u);
    p.setXYZ(i, Math.cos(a) * r, Math.sin(a) * r, (v + 0.5) * pitch * (0.25 + 0.75 * u) - pitch * 0.35);
  }
  g.computeVertexNormals();
  return g;
}

/* ================================================================== CASE */
export function buildCase(spec) {
  const g = new THREE.Group();
  const { w, h, d } = spec.size;
  const t = 0.05;
  const body = M.steel(spec.color, 0.52);
  const trim = M.steel(spec.accent, 0.4);

  const hw = w / 2, hh = h / 2, hd = d / 2;

  // floor + roof
  const floor = box(w, t, d, body, 0, -hh, 0); g.add(floor);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w, t, d),
    new THREE.MeshStandardMaterial({ map: ventTexture(), roughness: 0.6, metalness: 0.7 }));
  roof.position.set(0, hh, 0); roof.castShadow = roof.receiveShadow = true; g.add(roof);

  // feet
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(box(0.22, 0.16, 0.22, M.rubber(), sx * (hw - 0.22), -hh - 0.1, sz * (hd - 0.24)));

  // front panel
  const frontMat = spec.glass
    ? M.steel(spec.color, 0.35)
    : new THREE.MeshStandardMaterial({ map: meshPanelTexture(), roughness: 0.8, metalness: 0.4 });
  const front = box(w, h, t, frontMat, 0, 0, -hd); g.add(front);
  // power button + front io strip
  g.add(box(0.16, 0.16, 0.03, M.plastic(0x2b3138, 0.4), hw - 0.3, hh - 0.22, -hd - t * 0.6));
  const pwrLed = new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), ledMat(0x39e0ff, 0));
  pwrLed.position.set(hw - 0.3, hh - 0.22, -hd - t * 0.62);
  pwrLed.rotation.y = Math.PI;
  pwrLed.userData.powerLed = true;
  g.add(pwrLed);

  // rear panel — built from strips so the I/O + expansion area stays open
  const trayX = -hw + 0.30;             // motherboard tray plane
  const ioX0 = trayX + 0.03;            // aperture starts at the board surface
  const ioW = 0.55;
  const ioH = Math.min(1.10, h * 0.26);
  const slotsH = Math.min(1.45, h * 0.32);   // expansion bracket column
  const openTop = hh - t - 0.18;
  const openBot = openTop - ioH - slotsH;
  const openL = ioX0, openR = Math.min(hw - 0.18, ioX0 + 1.28);

  const rp = (bw, bh, bx, by) => { if (bw > 1e-3 && bh > 1e-3) g.add(box(bw, bh, t, body, bx, by, hd)); };
  rp(w, hh - openTop + t, 0, (openTop + hh) / 2 + t / 2);      // above
  rp(w, openBot + hh, 0, (-hh + openBot) / 2);                 // below
  rp(openL + hw, openTop - openBot, (-hw + openL) / 2, (openTop + openBot) / 2);   // left of opening
  rp(hw - openR, openTop - openBot, (openR + hw) / 2, (openTop + openBot) / 2);    // right of opening
  // fill the strip right of the I/O aperture (top band only)
  rp(openR - (ioX0 + ioW), ioH, (ioX0 + ioW + openR) / 2, openTop - ioH / 2);

  // rear exhaust fan grille ring
  const grille = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 26), trim);
  grille.position.set(ioX0 + 0.75, openTop - ioH - 0.05, hd + t * 0.55);
  g.add(grille);

  // expansion slot covers (stacked vertically, 20.32 mm pitch)
  const slotCover = M.steel(spec.accent, 0.35);
  const slotTop = openTop - ioH - 0.06;
  const nCovers = Math.max(2, Math.min(7, Math.floor(slotsH / (20.32 * MM))));
  const slots = [];
  for (let i = 0; i < nCovers; i++) {
    const y = slotTop - 0.04 - i * 20.32 * MM;
    const c = box(Math.min(1.16, openR - ioX0 - 0.04), 17 * MM, t * 0.7, slotCover,
      ioX0 + 0.60, y, hd + t * 0.2);
    c.userData.slotCover = i;
    g.add(c); slots.push(c);
  }
  g.userData.slotCovers = slots;

  // motherboard tray wall + cable grommets
  const tray = box(t, h - t * 2, d * 0.94, M.steel(spec.color, 0.6), trayX, 0, 0.06);
  g.add(tray);
  for (const gy of [hh * 0.4, -hh * 0.16, -hh * 0.66]) {
    const gm = box(t * 1.4, Math.min(0.5, h * 0.11), 0.16, M.rubber(0x0d0f12), trayX, gy, -hd + 1.05);
    g.add(gm);
  }
  // standoffs
  for (const [sy, sz] of [[0.6, 0.7], [0.6, -0.18], [-0.26, 0.7], [-0.26, -0.18], [0.17, 0.26]]) {
    const st = cyl(0.05, 0.05, 0.20, M.alu(0x8d99a6), 8);
    st.rotation.z = Math.PI / 2;
    st.position.set(trayX + 0.10, sy * h * 0.3, sz * d * 0.5);
    g.add(st);
  }

  // far side panel (behind the tray) — solid
  g.add(box(t, h, d, M.steel(spec.color, 0.55), -hw, 0, 0));

  // near side panel — glass or steel, removable
  const panel = spec.glass
    ? slab(d * 0.94, h * 0.94, 0.03, M.glass(), 0.05)
    : slab(d * 0.94, h * 0.94, 0.03, M.steel(spec.color, 0.5), 0.05);
  panel.rotation.y = Math.PI / 2;
  panel.position.set(hw - t * 0.4, 0, 0);
  panel.userData.sidePanel = true;
  g.add(panel);
  g.userData.sidePanel = panel;

  // front intake fan anchors (bottom-up)
  const fanAnchors = [];
  const fanSlots = Math.max(1, Math.min(3, Math.floor((h - 0.6) / 1.25)));
  for (let i = 0; i < fanSlots; i++) {
    const y = -hh + 0.85 + i * 1.25;
    fanAnchors.push(anchor(g, trayX + 0.75, y, -hd + 0.22));
  }
  // radiator anchor: front panel, fans facing into the case (+Z)
  const radAnchor = anchor(g, trayX + 0.78, Math.min(0.15, hh - 1.4), -hd + 0.32);
  // top radiator anchor, used when the front is too short
  const radTopAnchor = anchor(g, trayX + 0.78, hh - 0.34, 0.15, Math.PI / 2, 0, 0);

  // Interior fill. A real case interior is a black hole to a camera; without
  // these the parts you spent money on read as unlit silhouettes.
  const inner = new THREE.PointLight(0xd6e6ff, 26, hd * 5, 2);
  inner.position.set(hw + 1.1, hh * 0.35, -hd * 0.10);
  g.add(inner);
  const inner2 = new THREE.PointLight(0xa8c8e8, 14, hd * 4, 2);
  inner2.position.set(hw + 0.9, -hh * 0.55, -hd * 0.55);
  g.add(inner2);

  // Reference planes so the board can be positioned per form factor.
  // Short cases pull the board right up under the roof so it clears the PSU.
  const headroom = Math.min(0.30, Math.max(0.06, (h - 3.4) * 0.15));
  g.userData.ref = {
    trayX: trayX + 0.10,        // board sits on 10 mm standoffs
    topY: hh - t - headroom,    // board's top edge
    rearZ: hd - t - 0.05,       // board's rear edge
    interiorW: hw - t - trayX,
    hw, hh, hd,
  };
  g.userData.mounts = { fans: fanAnchors, rad: radAnchor, radTop: radTopAnchor };
  g.userData.mounts.psu = anchor(g, trayX + 0.78, -hh + t + 0.45, hd - 0.85);
  g.userData.size = new THREE.Vector3(w, h, d);
  return g;
}

/* ================================================================== MOTHERBOARD */
export const BOARD_SIZE = { ATX: [3.05, 2.44], mATX: [2.44, 2.44], ITX: [1.70, 1.70] };

export function buildMobo(spec) {
  const g = new THREE.Group();
  const [BW, BH] = BOARD_SIZE[spec.form];
  const hw = BW / 2, hh = BH / 2;
  const compact = spec.form === 'ITX';

  const pcb = slab(BW, BH, 0.022, M.pcb(spec.pcb), 0.05);
  g.add(pcb);

  const blk = M.plastic(0x0b0d11, 0.55);
  const dark = M.plastic(0x1a1e24, 0.6);
  const acc = M.steel(spec.accent, 0.42);

  // ---- rear I/O cluster (ports poke out toward local -X)
  const ioX = -hw + 0.24, ioY = hh - 0.62;
  const shroud = slab(0.46, 1.16, 0.30, M.plastic(0x14181e, 0.5), 0.04);
  shroud.position.set(ioX, ioY, 0.16);
  g.add(shroud);
  if (spec.rgb) {
    const strip = box(0.03, 0.9, 0.16, rgbMat(1.4), ioX - 0.24, ioY, 0.2);
    g.add(strip);
  }
  // port block sticking past the board edge
  const ports = box(0.40, 1.02, 0.26, M.steel(0x3a4048, 0.4), -hw - 0.10, ioY, 0.13);
  g.add(ports);
  const portCols = [
    [0x1f5fd0, 0x1f5fd0], [0x1f5fd0, 0x1f5fd0], [0x18181c, 0x2a9d4a],
    [0xc0392b, 0x27ae60], [0x22262c, 0x22262c],
  ];
  portCols.forEach(([a, b], i) => {
    const y = ioY + 0.40 - i * 0.20;
    g.add(box(0.06, 0.07, 0.10, M.plastic(a, 0.4), -hw - 0.29, y, 0.20));
    g.add(box(0.06, 0.07, 0.10, M.plastic(b, 0.4), -hw - 0.29, y, 0.06));
  });

  // ---- CPU socket
  const sockX = compact ? -hw + 0.62 : -0.55, sockY = compact ? 0.18 : 0.50;
  const socket = slab(0.56, 0.56, 0.05, M.plastic(0x0d0f13, 0.45), 0.03);
  socket.position.set(sockX, sockY, 0.026);
  g.add(socket);
  const padGeo = new THREE.PlaneGeometry(0.42, 0.42);
  const pads = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({
    color: 0xb99a4e, roughness: 0.35, metalness: 0.9,
  }));
  pads.position.set(sockX, sockY, 0.052);
  g.add(pads);
  // retention arm
  const arm = box(0.62, 0.05, 0.04, M.alu(0x99a3ad), sockX, sockY - 0.34, 0.05);
  g.add(arm);
  g.userData.socketPos = new THREE.Vector3(sockX, sockY, 0.052);

  // ---- VRM heatsinks
  const vrmH = 0.10 + spec.vrm * 0.14;
  const vrmTop = finBlock(0.56, 0.20, vrmH, acc);
  vrmTop.position.set(sockX, sockY + 0.44, vrmH / 2 + 0.012);
  g.add(vrmTop);
  const vrmSide = finBlock(0.20, 0.62, vrmH, acc);
  vrmSide.position.set(sockX - 0.46, sockY, vrmH / 2 + 0.012);
  g.add(vrmSide);

  // ---- DIMM slots
  const nSlots = spec.slots;
  const dimmX0 = compact ? hw - 0.42 : sockX + 0.85;
  const dimmY = compact ? 0.0 : sockY - 0.04;
  const dimmPitch = 0.19;
  const dimmAnchors = [];
  for (let i = 0; i < nSlots; i++) {
    const x = dimmX0 + i * dimmPitch * (compact ? -1 : 1);
    const s = box(0.085, 1.28, 0.075, i % 2 ? blk : M.plastic(0x2c3138, 0.55), x, dimmY, 0.05);
    g.add(s);
    for (const sy of [-1, 1])       // latches
      g.add(box(0.075, 0.10, 0.10, M.plastic(0x3d444d, 0.5), x, dimmY + sy * 0.70, 0.06));
    dimmAnchors.push(anchor(g, x, dimmY, 0.09));
  }
  g.userData.dimmAnchors = dimmAnchors;

  // ---- PCIe slots
  const pcieY0 = compact ? -hh + 0.30 : sockY - 0.72;
  const pcieLen = 0.89, pcieX = -hw + 0.10 + pcieLen / 2;
  const nPcie = compact ? 1 : (spec.form === 'mATX' ? 2 : 3);
  const pcieAnchors = [];
  for (let i = 0; i < nPcie; i++) {
    const y = pcieY0 - i * 0.42;
    const primary = i === 0;
    const len = primary ? pcieLen : (i === 1 ? pcieLen : 0.4);
    const mat = primary ? M.alu(0xa8b2bd) : blk;
    g.add(box(len, 0.085, 0.075, mat, -hw + 0.10 + len / 2, y, 0.05));
    if (primary) pcieAnchors.push(anchor(g, -hw + 0.16, y, 0.09));
    else pcieAnchors.push(anchor(g, -hw + 0.16, y, 0.09));
  }
  g.userData.pcieAnchors = pcieAnchors;

  // ---- chipset heatsink
  const chipX = compact ? 0.25 : hw - 0.75, chipY = -hh + 0.42;
  const chip = finBlock(0.52, 0.52, 0.10, acc);
  chip.position.set(chipX, chipY, 0.062); g.add(chip);
  if (spec.rgb) {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), rgbMat(1.8));
    glow.position.set(chipX, chipY, 0.115); g.add(glow);
  }

  // ---- M.2 slots (with heat shields)
  const m2Anchors = [];
  const m2Count = Math.min(spec.m2, compact ? 1 : 2);
  for (let i = 0; i < m2Count; i++) {
    const y = compact ? -hh + 0.72 : sockY - 0.36 - i * 0.86;
    const x = compact ? 0.05 : 0.25;
    g.add(box(0.86, 0.18, 0.02, M.plastic(0x1e232a, 0.6), x, y, 0.024));
    m2Anchors.push(anchor(g, x, y, 0.036));
  }
  g.userData.m2Anchors = m2Anchors;

  // ---- power connectors
  const atx = box(0.11, 0.52, 0.14, M.plastic(0xe8e8e8, 0.55), hw - 0.10, compact ? 0.2 : sockY - 0.1, 0.082);
  atx.userData.connector = 'atx24'; g.add(atx);
  g.userData.atxAnchor = anchor(g, hw - 0.10, compact ? 0.2 : sockY - 0.1, 0.16);

  const eps = box(0.30, 0.11, 0.13, M.plastic(0x101317, 0.55), sockX + 0.1, hh - 0.09, 0.078);
  eps.userData.connector = 'cpu8'; g.add(eps);
  g.userData.epsAnchor = anchor(g, sockX + 0.1, hh - 0.09, 0.15);

  // ---- SATA + headers + caps
  g.add(box(0.14, 0.30, 0.10, M.plastic(0x1c2a4a, 0.5), hw - 0.10, -hh + 0.32, 0.062));
  for (let i = 0; i < (compact ? 5 : 12); i++) {
    const c = cyl(0.035, 0.035, 0.09, M.alu(0x6d7681), 10);
    c.rotation.x = Math.PI / 2;
    c.position.set(sockX - 0.1 + (i % 4) * 0.1, sockY + 0.26 - Math.floor(i / 4) * 0.09, 0.058);
    g.add(c);
  }
  // battery
  const bat = cyl(0.09, 0.09, 0.03, M.alu(0xc6ccd2), 18);
  bat.rotation.x = Math.PI / 2;
  bat.position.set(compact ? -0.4 : 0.2, -hh + 0.24, 0.03);
  g.add(bat);
  if (spec.wifi) {
    g.add(box(0.16, 0.10, 0.05, M.plastic(0x22262c, 0.5), -hw + 0.06, hh - 1.35, 0.04));
  }

  g.userData.size = new THREE.Vector3(BW, BH, 0.34);
  g.userData.boardSize = [BW, BH];
  return g;
}

/** Finned aluminium block used for VRM / chipset / GPU heatsinks. */
function finBlock(w, h, t, mat) {
  const grp = new THREE.Group();
  grp.add(box(w, h, t * 0.35, mat, 0, 0, -t * 0.32));
  const n = Math.max(3, Math.floor(w / 0.06));
  const fin = new THREE.BoxGeometry(0.018, h * 0.94, t * 0.8);
  const inst = new THREE.InstancedMesh(fin, mat, n);
  inst.castShadow = true;
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    mtx.makeTranslation(-w / 2 + (i + 0.5) * (w / n), 0, t * 0.1);
    inst.setMatrixAt(i, mtx);
  }
  inst.instanceMatrix.needsUpdate = true;
  grp.add(inst);
  return grp;
}

/* ================================================================== CPU */
export function buildCPU(spec) {
  const g = new THREE.Group();
  const sub = slab(0.45, 0.45, 0.018, M.pcb(0x1d2a1e), 0.02);
  g.add(sub);
  const ihsMat = M.alu(0xc8d0d8);
  const ihs = slab(0.36, 0.36, 0.035, ihsMat, 0.035);
  ihs.position.z = 0.026;
  g.add(ihs);
  // the four notched "wings" of a modern IHS
  for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    g.add(box(sx ? 0.06 : 0.20, sy ? 0.06 : 0.20, 0.03, ihsMat, sx * 0.20, sy * 0.20, 0.024));
  }
  // etched label
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30),
    new THREE.MeshStandardMaterial({
      map: labelTexture('cpu' + spec.id, (c, s) => {
        c.fillStyle = '#b9c2cb'; c.fillRect(0, 0, s, s);
        c.fillStyle = '#5a636c'; c.textAlign = 'center';
        c.font = 'bold 26px monospace'; c.fillText(spec.brand.toUpperCase(), s / 2, s * 0.34);
        c.font = '19px monospace';
        c.fillText(spec.name.split(' ').slice(-1)[0], s / 2, s * 0.52);
        c.font = '13px monospace'; c.fillStyle = '#7c848d';
        c.fillText(`${spec.cores}C / ${spec.threads}T`, s / 2, s * 0.68);
        c.fillText(spec.socket, s / 2, s * 0.80);
      }), roughness: 0.42, metalness: 0.8,
    }));
  lbl.position.z = 0.0442;
  g.add(lbl);
  // gold pad array underneath
  const pins = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.40), M.gold());
  pins.position.z = -0.010; pins.rotation.y = Math.PI;
  g.add(pins);
  g.userData.size = new THREE.Vector3(0.45, 0.45, 0.06);
  return g;
}

/* ================================================================== COOLER */
export function buildCooler(spec) {
  const g = new THREE.Group();
  if (spec.type === 'aio') return buildAIO(spec, g);

  const H = spec.height * MM;            // total height above the board
  const lowProfile = spec.height < 90;
  const base = slab(0.42, 0.42, 0.055, M.copper(), 0.03);
  base.position.z = 0.028; g.add(base);
  g.add(box(0.52, 0.52, 0.03, M.alu(0x8f99a3), 0, 0, 0.06));   // mounting bracket

  if (lowProfile) {
    // downdraft: radial fin disc + fan on top
    const fins = new THREE.Group();
    const n = 26;
    const fg = new THREE.BoxGeometry(0.012, 0.62, H * 0.5);
    const inst = new THREE.InstancedMesh(fg, M.alu(0xa9b3bd), n);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < n; i++) {
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (i / n) * Math.PI);
      mtx.compose(new THREE.Vector3(0, 0, 0.08 + H * 0.25), q, v);
      inst.setMatrixAt(i, mtx);
    }
    inst.instanceMatrix.needsUpdate = true; inst.castShadow = true;
    fins.add(inst); g.add(fins);
    const fan = buildFan(0.92, { color: 0x1a1e24, depth: 0.16 });
    fan.position.z = H - 0.10;
    g.add(fan);
    g.userData.size = new THREE.Vector3(0.95, 0.95, H);
    return g;
  }

  // ---- tower cooler.
  // Local axes here follow the motherboard: +X = case front (the airflow
  // direction), +Y = up the board, +Z = away from the board surface.
  const dual = spec.tdpCap > 220;
  const banks = dual ? [-0.42, 0.44] : [0];
  const bankD = dual ? 0.46 : 0.54;      // fin depth along the airflow
  const towerW = 1.15;                   // fin width across the airflow
  const stackZ0 = 0.30, stackZ1 = H - 0.04;

  const pipeMat = M.copper();
  const perBank = dual ? 4 : 6;
  for (const bx of banks) {
    for (let i = 0; i < perBank; i++) {
      const yOff = (i - (perBank - 1) / 2) * (dual ? 0.22 : 0.16);
      const pts = [
        new THREE.Vector3(0, yOff * 0.35, 0.05),
        new THREE.Vector3(bx * 0.45, yOff * 0.7, 0.19),
        new THREE.Vector3(bx, yOff, 0.42),
        new THREE.Vector3(bx, yOff, H - 0.05),
      ];
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.028, 8, false), pipeMat);
      tube.castShadow = true;
      g.add(tube);
    }
  }

  const finMat = M.alu(0xb4bec8);
  const nFins = Math.max(4, Math.floor((stackZ1 - stackZ0) / 0.032));
  for (const bx of banks) {
    const fg = new THREE.BoxGeometry(bankD, towerW, 0.008);
    const inst = new THREE.InstancedMesh(fg, finMat, nFins);
    inst.castShadow = true;
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < nFins; i++) {
      mtx.makeTranslation(bx, 0, stackZ0 + i * 0.032);
      inst.setMatrixAt(i, mtx);
    }
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);
    g.add(box(bankD + 0.04, towerW + 0.03, 0.02, M.steel(0x2a3038, 0.4), bx, 0, stackZ1 + 0.03));
  }

  // fan(s) bolted to the stack, axis along +X so they blow front → rear
  const fanZ = (stackZ0 + stackZ1) / 2;
  for (const fx of (dual ? [0.86, 0.0] : [0.44])) {
    const fan = buildFan(1.10, { color: 0x171a1f, depth: 0.24, rgb: spec.rgb });
    fan.rotation.y = Math.PI / 2;
    fan.position.set(fx, 0, fanZ);
    g.add(fan);
  }
  g.userData.size = new THREE.Vector3(dual ? 1.7 : 1.05, towerW, H);
  return g;
}

function buildAIO(spec, g) {
  // pump head sits on the CPU
  const pump = cyl(0.34, 0.36, 0.30, M.plastic(0x14181e, 0.42), 26);
  pump.rotation.x = Math.PI / 2; pump.position.z = 0.16;
  g.add(pump);
  const cold = slab(0.46, 0.46, 0.04, M.copper(), 0.03);
  cold.position.z = 0.02; g.add(cold);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.05, 26), rgbMat(1.7));
  ring.rotation.x = Math.PI / 2; ring.position.z = 0.30;
  g.add(ring);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.29, 26),
    new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.25, metalness: 0.7 }));
  top.position.z = 0.325; g.add(top);
  // barbs — the tubes themselves are drawn in world space once both ends exist
  for (const sy of [-1, 1]) {
    const barb = cyl(0.06, 0.06, 0.14, M.plastic(0x22262c, 0.5), 10);
    barb.position.set(0, sy * 0.32, 0.24);
    g.add(barb);
  }
  g.userData.tubePorts = [new THREE.Vector3(0, 0.36, 0.26), new THREE.Vector3(0, -0.36, 0.26)];
  g.userData.size = new THREE.Vector3(0.72, 0.72, 0.36);
  g.userData.isAIO = true;
  return g;
}

/** Radiator + fans. Mounted on the case, not on the CPU: the core is thin along
 *  Z (the airflow axis) and stacks fans vertically along Y. */
export function buildRadiator(spec) {
  const g = new THREE.Group();
  const fanCount = spec.radiator / 120;
  const L = fanCount * 1.24;
  const core = new THREE.Mesh(new THREE.BoxGeometry(1.20, L, 0.30),
    new THREE.MeshStandardMaterial({
      map: finTexture('#080a0d', '#39424c'), roughness: 0.75, metalness: 0.6,
    }));
  core.castShadow = core.receiveShadow = true;
  g.add(core);
  for (const sy of [-1, 1])            // end tanks
    g.add(box(1.24, 0.14, 0.34, M.steel(0x181c22, 0.5), 0, sy * (L / 2 - 0.05), 0));
  for (let i = 0; i < fanCount; i++) {
    const fan = buildFan(1.18, { color: 0x141216, depth: 0.24, rgb: spec.rgb });
    fan.position.set(0, -L / 2 + 0.62 + i * 1.24, 0.29);
    g.add(fan);
  }
  g.userData.tubePorts = [
    new THREE.Vector3(0.30, L / 2 + 0.06, 0.08), new THREE.Vector3(-0.05, L / 2 + 0.06, 0.08),
  ];
  g.userData.size = new THREE.Vector3(1.24, L + 0.2, 0.6);
  return g;
}

/* ================================================================== RAM */
export function buildRAM(spec) {
  // one DIMM, standing on its slot: X = thickness, Y = length, Z = height above board
  const g = new THREE.Group();
  const tall = spec.tall;
  const HGT = tall ? 0.42 : 0.32;
  const pcb = box(0.035, 1.31, HGT * 0.95, M.pcb(0x13181c), 0, 0, HGT * 0.5 - 0.02);
  g.add(pcb);
  // gold edge fingers
  g.add(box(0.038, 1.20, 0.06, M.gold(), 0, 0, 0.03));

  const spread = new THREE.MeshStandardMaterial({
    color: spec.color, roughness: 0.36, metalness: 0.78,
  });
  for (const sx of [-1, 1]) {
    // rotated so the plate's thin axis lands on X (the stick's thickness)
    const p = slab(HGT * 0.78, 1.26, 0.028, spread, 0.04);
    p.rotation.y = Math.PI / 2;
    p.position.set(sx * 0.05, 0, HGT * 0.52);
    g.add(p);
    // ribbed detail
    for (let i = 0; i < 7; i++)
      g.add(box(0.012, 0.05, HGT * 0.6, spread, sx * 0.068, -0.5 + i * 0.17, HGT * 0.52));
  }
  if (spec.rgb) {
    const bar = box(0.09, 1.16, 0.055, rgbMat(1.6), 0, 0, HGT * 0.95);
    g.add(bar);
    const top = box(0.10, 1.18, 0.02, M.plastic(0xf2f6fa, 0.2), 0, 0, HGT * 0.99);
    top.material.transparent = true; top.material.opacity = 0.55;
    g.add(top);
  } else {
    g.add(box(0.11, 1.20, 0.05, spread, 0, 0, HGT * 0.9));
  }
  g.userData.size = new THREE.Vector3(0.14, 1.31, HGT);
  return g;
}

/* ================================================================== GPU */
export function buildGPU(spec) {
  // local axes: +X = toward case front (card length), +Z = away from the board,
  // -Y = the cooler hangs below. Origin sits at the PCIe edge connector.
  const g = new THREE.Group();
  const L = spec.len * MM;
  const W = 1.16;                       // card width out from the board
  const T = spec.slots * 20.32 * MM;    // slot thickness
  const x0 = -0.28;                     // rear bracket plane
  const cx = x0 + L / 2;

  const pcbMesh = box(L * 0.94, 0.022, W * 0.92, M.pcb(0x0d1013), cx, 0, W * 0.5 + 0.06);
  g.add(pcbMesh);
  // gold fingers
  g.add(box(0.89, 0.030, 0.10, M.gold(), 0.16, 0, 0.05));
  g.add(box(0.05, 0.032, 0.10, M.plastic(0x101317), 0.60, 0, 0.05));   // keying notch

  // shroud (below the PCB)
  const shroudMat = new THREE.MeshStandardMaterial({
    color: spec.shroud, roughness: 0.42, metalness: 0.55,
  });
  const shroud = slab(L, W, T * 0.9, shroudMat, 0.06);
  shroud.rotation.x = Math.PI / 2;
  shroud.position.set(cx, -T * 0.5, W * 0.5 + 0.06);
  g.add(shroud);

  // heatsink fins visible along the card's front edge
  const finMat = M.alu(0xaeb8c2);
  const nf = Math.floor(L / 0.05);
  const fg = new THREE.BoxGeometry(0.014, T * 0.7, W * 0.8);
  const inst = new THREE.InstancedMesh(fg, finMat, nf);
  inst.castShadow = true;
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < nf; i++) {
    mtx.makeTranslation(x0 + 0.06 + i * 0.05, -T * 0.52, W * 0.5 + 0.06);
    inst.setMatrixAt(i, mtx);
  }
  inst.instanceMatrix.needsUpdate = true;
  g.add(inst);

  // fans on the underside
  const fanSize = Math.min(1.0, (L - 0.5) / spec.fans);
  for (let i = 0; i < spec.fans; i++) {
    const fan = buildFan(fanSize, { color: 0x0f1216, depth: T * 0.5, rgb: false, blades: 11 });
    fan.rotation.x = Math.PI / 2;
    fan.position.set(x0 + 0.30 + (i + 0.5) * ((L - 0.45) / spec.fans), -T * 0.86, W * 0.52 + 0.06);
    g.add(fan);
  }

  // backplate (above the PCB)
  const bp = slab(L * 0.97, W * 0.95, 0.03, new THREE.MeshStandardMaterial({
    color: spec.shroud, roughness: 0.5, metalness: 0.7,
  }), 0.05);
  bp.rotation.x = Math.PI / 2;
  bp.position.set(cx, 0.05, W * 0.5 + 0.06);
  g.add(bp);

  // accent stripe + logo bar
  const accMat = new THREE.MeshStandardMaterial({
    color: spec.accent, roughness: 0.35, metalness: 0.6,
    emissive: new THREE.Color(spec.accent), emissiveIntensity: 0.15,
  });
  g.add(box(L * 0.9, T * 0.16, 0.03, accMat, cx, -T * 0.30, 0.09));
  if (spec.rgb) {
    const logo = box(0.62, T * 0.3, 0.035, rgbMat(1.5), cx + L * 0.18, -T * 0.28, 0.085);
    g.add(logo);
  }

  // rear I/O bracket + display outputs
  const brk = box(0.035, T + 0.32, W * 0.9, M.steel(0x9aa4ae, 0.35), x0 - 0.02, -T * 0.4 + 0.06, W * 0.5 + 0.06);
  g.add(brk);
  for (let i = 0; i < 4; i++) {
    g.add(box(0.06, 0.10, 0.16, M.plastic(i === 3 ? 0x1b1f25 : 0x101418, 0.4),
      x0 - 0.05, -T * 0.4 + 0.06, 0.30 + i * 0.24));
  }

  // power connector on the top edge
  const conW = spec.connector === '12VHPWR' ? 0.30 : (spec.connector === '8+8-pin' ? 0.52 : 0.28);
  const pwr = box(conW, 0.10, 0.13, M.plastic(0x0c0e12, 0.5), cx + L * 0.24, 0.09, W * 0.9);
  pwr.userData.connector = 'pcie';
  g.add(pwr);
  g.userData.pcieAnchor = anchor(g, cx + L * 0.24, 0.20, W * 0.9);

  g.userData.size = new THREE.Vector3(L, T + 0.2, W + 0.1);
  g.userData.sagAxis = cx;
  return g;
}

/* ================================================================== PSU */
export function buildPSU(spec) {
  const g = new THREE.Group();
  const W = 1.50, H = 0.86, D = spec.len * MM;
  const shell = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.45, metalness: 0.8 });
  g.add(box(W, H, D, shell, 0, 0, 0));

  // intake fan on the underside
  const fan = buildFan(1.14, { color: 0x0e1115, depth: 0.12 });
  fan.rotation.x = Math.PI / 2;
  fan.position.set(0, -H / 2 - 0.02, 0);
  g.add(fan);
  const grille = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.03, 6, 26), M.steel(0x3a4149, 0.4));
  grille.rotation.x = Math.PI / 2;
  grille.position.set(0, -H / 2 - 0.05, 0);
  g.add(grille);

  // rear face: honeycomb exhaust + IEC socket + switch
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.98, H * 0.96),
    new THREE.MeshStandardMaterial({ map: meshPanelTexture(), roughness: 0.8, metalness: 0.5 }));
  rear.position.z = D / 2 + 0.002;
  g.add(rear);
  g.add(box(0.30, 0.24, 0.06, M.plastic(0x0a0c10, 0.5), -W / 2 + 0.26, 0, D / 2 + 0.02));
  g.add(box(0.14, 0.10, 0.05, M.plastic(0x1e242b, 0.5), -W / 2 + 0.52, 0, D / 2 + 0.02));

  // spec sticker on top
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.72, D * 0.68),
    new THREE.MeshStandardMaterial({
      map: labelTexture('psu' + spec.id, (c, s) => {
        c.fillStyle = '#101418'; c.fillRect(0, 0, s, s);
        c.strokeStyle = '#2e3944'; c.lineWidth = 3; c.strokeRect(10, 10, s - 20, s - 20);
        c.fillStyle = '#dfe8f0'; c.textAlign = 'center'; c.font = 'bold 30px monospace';
        c.fillText(spec.brand.toUpperCase(), s / 2, 62);
        c.font = 'bold 46px monospace'; c.fillStyle = '#38e8ff';
        c.fillText(spec.watts + 'W', s / 2, 118);
        c.font = '20px monospace'; c.fillStyle = '#8fa0b0';
        c.fillText('80 PLUS ' + spec.rating.toUpperCase(), s / 2, 152);
        c.font = '15px monospace'; c.fillStyle = '#63707d';
        c.fillText(spec.modular ? 'FULLY MODULAR' : 'FIXED CABLES', s / 2, 182);
        c.fillText('+12V  ' + Math.round(spec.watts / 12) + 'A', s / 2, 208);
        for (let i = 0; i < 6; i++) c.fillRect(40 + i * 30, 224, 20, 6);
      }), roughness: 0.85, metalness: 0.1,
    }));
  // face up, with the text reading correctly for someone standing at the front
  sticker.rotation.set(-Math.PI / 2, 0, Math.PI);
  sticker.position.y = H / 2 + 0.002;
  g.add(sticker);

  // modular sockets face the case front
  if (spec.modular) {
    for (let i = 0; i < 6; i++)
      g.add(box(0.16, 0.10, 0.04, M.plastic(0x05070a, 0.6), -0.5 + i * 0.2, 0.1, -D / 2 - 0.02));
  }
  g.userData.cableOrigin = new THREE.Vector3(0.25, 0.2, -D / 2 - 0.05);
  g.userData.size = new THREE.Vector3(W, H, D);
  return g;
}

/* ================================================================== STORAGE */
export function buildStorage(spec) {
  const g = new THREE.Group();
  if (spec.bus === 'M.2') {
    g.add(box(0.80, 0.22, 0.014, M.pcb(0x0f1c14), 0.02, 0, 0.007));
    // NAND + controller packages
    for (let i = 0; i < 3; i++)
      g.add(box(0.14, 0.14, 0.018, M.plastic(0x14181d, 0.45), -0.16 + i * 0.19, 0, 0.023));
    g.add(box(0.10, 0.10, 0.016, M.plastic(0x1c2128, 0.4), 0.28, 0.04, 0.022));
    g.add(box(0.07, 0.20, 0.016, M.gold(), -0.36, 0, 0.014));
    // heat shield
    const sh = slab(0.78, 0.24, 0.05, M.alu(0x7d8791), 0.02);
    sh.position.set(0.02, 0, 0.058);
    g.add(sh);
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.14),
      new THREE.MeshStandardMaterial({
        map: labelTexture('ssd' + spec.id, (c, s) => {
          c.fillStyle = '#0c1014'; c.fillRect(0, 0, s, s);
          c.fillStyle = '#8be0ff'; c.textAlign = 'center'; c.font = 'bold 44px monospace';
          c.fillText(spec.tb + 'TB', s / 2, s * 0.45);
          c.fillStyle = '#5f6d7a'; c.font = '26px monospace';
          c.fillText('GEN' + spec.gen + ' NVMe', s / 2, s * 0.68);
        }), roughness: 0.6, metalness: 0.3,
      }));
    lbl.position.set(0.02, 0, 0.084);
    g.add(lbl);
    g.userData.size = new THREE.Vector3(0.86, 0.26, 0.09);
  } else {
    const b = slab(1.00, 0.70, 0.07, new THREE.MeshStandardMaterial({
      color: spec.color, roughness: 0.4, metalness: 0.85,
    }), 0.02);
    b.position.z = 0.035;
    g.add(b);
    g.add(box(0.30, 0.10, 0.05, M.plastic(0x0a0c10, 0.5), -0.34, -0.24, 0.04));
    g.userData.size = new THREE.Vector3(1.0, 0.7, 0.08);
  }
  return g;
}

/* ================================================================== CABLES */
export function buildCable(from, to, opt = {}) {
  const { color = 0x0b0d10, radius = 0.05, sag = 0.45, via = null } = opt;
  const pts = [from.clone()];
  if (via) via.forEach(v => pts.push(v.clone()));
  else {
    const mid = from.clone().lerp(to, 0.5);
    mid.y -= sag; mid.z -= 0.2;
    pts.push(mid);
  }
  pts.push(to.clone());
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
  const geo = new THREE.TubeGeometry(curve, 48, radius, 8, false);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color, roughness: 0.82, metalness: 0.05,
  }));
  mesh.castShadow = true;
  mesh.userData.growable = geo.index.count;
  geo.setDrawRange(0, 0);
  return mesh;
}

/* ------------------------------------------------------------------ utilities */
export function boundsOf(obj) {
  const b = new THREE.Box3().setFromObject(obj);
  const s = new THREE.Vector3(), c = new THREE.Vector3();
  b.getSize(s); b.getCenter(c);
  return { size: s, center: c, box: b };
}

export function disposeTree(obj) {
  // Textures and the unit-cube geometry are cached and shared between rebuilds,
  // so they are deliberately left alone here.
  obj.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => m.dispose());
    }
  });
}

export const BUILDERS = {
  case: buildCase, mobo: buildMobo, cpu: buildCPU, cooler: buildCooler,
  ram: buildRAM, gpu: buildGPU, psu: buildPSU, storage: buildStorage,
};
