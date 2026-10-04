// main.js — scene, camera, interaction and the build state machine.

import * as THREE from 'three';
import { CATS, CAT, BY_ID, money, specTags } from './catalog.js';
import {
  conflicts, hasErrors, estimateDraw, evaluate, postCheck,
  requiredCables, CABLE_LABEL, readiness,
} from './compat.js';
import { buildRadiator, disposeTree } from './models.js';
import {
  makeModel, mountsFor, radiatorAnchor, makeAioTubes,
  cableEndWorld, makePowerCable,
} from './assemble.js';
import * as UI from './ui.js';

/* ============================================================ renderer */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.9));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a0f);
scene.fog = new THREE.Fog(0x070a0f, 26, 62);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

/* ============================================================ environment */
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x0c1016, roughness: 0.92, metalness: 0.1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.85;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(80, 80, 0x1d3a4a, 0x121a22);
grid.position.y = -2.84;
grid.material.transparent = true; grid.material.opacity = 0.5;
scene.add(grid);

// a workbench slab under the build
const bench = new THREE.Mesh(new THREE.BoxGeometry(11, 0.28, 9),
  new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.7, metalness: 0.25 }));
bench.position.y = -2.98;
bench.receiveShadow = true; bench.castShadow = true;
scene.add(bench);

scene.add(new THREE.HemisphereLight(0x8fb0d0, 0x121820, 0.95));

// Metals need something to reflect — without an environment map every
// high-metalness surface (case panels, heatsinks, IHS) renders near-black.
// A small hand-painted equirect standing in for a studio: two softboxes,
// a warm bounce and a cool rim.
(function buildEnvironment() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d');
  const sky = c.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#93b0cc');
  sky.addColorStop(0.42, '#4a6076');
  sky.addColorStop(0.52, '#2b3541');
  sky.addColorStop(1, '#141a21');
  c.fillStyle = sky; c.fillRect(0, 0, 512, 256);
  const blob = (x, y, r, col) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(150, 60, 110, 'rgba(255,255,255,0.95)');   // key softbox
  blob(380, 80, 90, 'rgba(190,215,240,0.55)');    // fill
  blob(300, 170, 120, 'rgba(40,190,230,0.28)');   // cool bounce
  blob(60, 190, 100, 'rgba(255,90,150,0.18)');    // magenta rim
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
})();

const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(7.5, 9, 6.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1; key.shadow.camera.far = 34;
key.shadow.camera.left = -8; key.shadow.camera.right = 8;
key.shadow.camera.top = 9; key.shadow.camera.bottom = -6;
key.shadow.bias = -0.0009;
key.shadow.normalBias = 0.02;
scene.add(key);

const fill = new THREE.DirectionalLight(0x93b6d8, 0.55);
fill.position.set(-6, 4, -5);
scene.add(fill);

const rimA = new THREE.PointLight(0x2fd8ff, 34, 26, 2);
rimA.position.set(-5.5, 2.6, -6.5);
scene.add(rimA);
const rimB = new THREE.PointLight(0xff3d92, 22, 24, 2);
rimB.position.set(6.5, -1.6, -5.5);
scene.add(rimB);

/* ============================================================ state */
const START_BUDGET = 2400;
let uidSeq = 1;

const state = {
  budget: START_BUDGET,
  spent: 0,
  tab: 'case',
  owned: [],                 // {uid, ...partSpec, installedAt}
  installed: {},             // cat -> owned item
  cables: { atx24: false, cpu8: false, pcie: false },
  held: null,
  powered: false,
  rgbOn: true,
};

const rig = new THREE.Group();
scene.add(rig);

const nodes = {};            // cat -> {root, parts:[], anchorList:[]}
const markers = [];          // active install targets
const connectorMarks = [];   // active cable targets
const cables = {};
const rotors = [];
const rgbMats = [];
let powerLed = null;
let caseGroup = null;

/* ============================================================ camera rig */
const view = { theta: -0.34, phi: 1.24, dist: 13.5, target: new THREE.Vector3(0.1, 0.3, 0) };
const goal = { theta: -0.34, phi: 1.24, dist: 13.5, target: new THREE.Vector3(0.1, 0.3, 0) };

const VIEWS = {
  // the case is twice as deep as it is wide, so "iso" stays close to the open
  // side — swing much further round and the front panel hides the whole build
  iso:   { theta: -0.34, phi: 1.24, dist: 11.5, target: [0.1, 0.3, 0] },
  front: { theta: -1.5708, phi: 1.5, dist: 11.5, target: [0, 0.2, 0] },
  mobo:  { theta: 0.06, phi: 1.5, dist: 7.2, target: [-0.4, 0.7, 0.4] },
  top:   { theta: -0.9, phi: 0.32, dist: 12, target: [0, 0, 0] },
  rear:  { theta: 1.62, phi: 1.45, dist: 10, target: [0, 0.5, 0.9] },
};
function setView(name) {
  const v = VIEWS[name]; if (!v) return;
  goal.theta = v.theta; goal.phi = v.phi; goal.dist = v.dist;
  goal.target.set(...v.target);
  document.querySelectorAll('.vb[data-view]').forEach(b =>
    b.classList.toggle('on', b.dataset.view === name));
}
function focusWorld(pos, dist = 6.5) {
  goal.target.copy(pos);
  goal.dist = dist;
  document.querySelectorAll('.vb[data-view]').forEach(b => b.classList.remove('on'));
}

/* ---- pointer control ---- */
let drag = null;
canvas.addEventListener('pointerdown', e => {
  if (e.button === 1) return;
  drag = { x: e.clientX, y: e.clientY, btn: e.button, moved: 0 };
  // taps arrive with no preceding move, so seed the ray from the down event
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerPx.set(e.clientX, e.clientY);
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
});
canvas.addEventListener('pointermove', e => {
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.btn === 2) {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      const k = goal.dist * 0.0016;
      goal.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    } else {
      goal.theta -= dx * 0.007;
      goal.phi = THREE.MathUtils.clamp(goal.phi - dy * 0.007, 0.16, 2.86);
    }
    drag.x = e.clientX; drag.y = e.clientY;
    document.querySelectorAll('.vb[data-view]').forEach(b => b.classList.remove('on'));
  }
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerPx.set(e.clientX, e.clientY);
  hoverDirty = true;
});
addEventListener('pointerup', e => {
  if (drag && drag.moved < 6) handleClick();
  drag = null;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  goal.dist = THREE.MathUtils.clamp(goal.dist * (1 + Math.sign(e.deltaY) * 0.11), 3.2, 34);
}, { passive: false });
canvas.addEventListener('dblclick', () => tryUninstallUnderPointer());

/* ============================================================ raycasting */
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2(-2, -2);
const pointerPx = new THREE.Vector2();
let hoverDirty = false;
let hoveredMarker = null;
let hoveredPart = null;

function pick(list) {
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects(list, true);
  return hits.length ? hits[0] : null;
}
function rootPartOf(obj) {
  let o = obj;
  while (o) { if (o.userData.partCat) return o; o = o.parent; }
  return null;
}

/** One raycast, resolved the same way for hovering and for clicking.
 *  Clicks re-run this rather than trusting cached hover state — otherwise a
 *  click that lands before the next animation frame would be swallowed. */
function resolvePick() {
  // install / connector markers take priority over the hardware behind them
  const hitTargets = [...markers.map(m => m.hit), ...connectorMarks.map(m => m.hit)];
  const mh = hitTargets.length ? pick(hitTargets) : null;
  if (mh) return { marker: mh.object.userData.owner, part: null };
  const roots = pickables.filter(o => o.parent && o.visible);
  const ph = roots.length ? pick(roots) : null;
  return { marker: null, part: ph ? rootPartOf(ph.object) : null };
}

/** Object trees that hardware picking should consider. Build mode contributes
 *  the rig; repair mode adds (and later removes) the machine on the bench. */
const pickables = [rig];
function registerPickable(o) { if (!pickables.includes(o)) pickables.push(o); }
function unregisterPickable(o) {
  const i = pickables.indexOf(o);
  if (i >= 0) pickables.splice(i, 1);
}

/** When inspection mode is on, clicking a component reports it instead of
 *  re-framing the camera on it. */
let inspectHandler = null;
function setInspectMode(on, cb) {
  inspectHandler = on ? cb : null;
  canvas.style.cursor = on ? 'crosshair' : 'default';
}

function updateHover() {
  hoverDirty = false;
  const { marker: newMark, part } = resolvePick();
  if (newMark !== hoveredMarker) {
    if (hoveredMarker) hoveredMarker.hovered = false;
    hoveredMarker = newMark;
    if (hoveredMarker) hoveredMarker.hovered = true;
    canvas.style.cursor = hoveredMarker ? 'pointer' : 'default';
  }
  if (hoveredMarker) {
    if (hoveredMarker.kind === 'connector')
      UI.showTip(pointerPx.x, pointerPx.y, CABLE_LABEL[hoveredMarker.key], ['Click to run this cable']);
    else
      UI.showTip(pointerPx.x, pointerPx.y, hoveredMarker.label,
        hoveredMarker.bad ? hoveredMarker.reasons : ['Click to install here']);
    hoveredPart = null;
    return;
  }

  // otherwise inspect installed hardware
  const root = part;
  hoveredPart = root;
  if (root) {
    const spec = BY_ID[root.userData.partId];
    canvas.style.cursor = 'help';
    UI.showTip(pointerPx.x, pointerPx.y, `${spec.brand} ${spec.name}`,
      [...specTags(spec), money(spec.price), '— double-click to remove —']);
  } else {
    canvas.style.cursor = drag ? 'grabbing' : 'default';
    UI.hideTip();
  }
}

function handleClick() {
  const { marker, part } = resolvePick();
  if (marker) {
    if (marker.kind === 'connector') runCable(marker.key);
    else if (marker.bad) UI.toast(marker.reasons.join(' '), 'err');
    else commitInstall(marker);
    return;
  }
  if (part) {
    if (inspectHandler) { inspectHandler(part.userData.partCat); return; }
    const b = new THREE.Box3().setFromObject(part);
    focusWorld(b.getCenter(new THREE.Vector3()), Math.max(3.6, b.getSize(new THREE.Vector3()).length() * 1.5));
  }
}

/* ============================================================ marker helpers */
const MARK_OK = 0x38e8ff, MARK_BAD = 0xff5050;

function makeMarker(anchor, size, center, label, bad, reasons, payload) {
  const col = bad ? MARK_BAD : MARK_OK;
  const grp = new THREE.Group();
  grp.position.copy(center);
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.95 }));
  const fillM = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: 0.1, depthWrite: false,
  }));
  grp.add(edges, fillM);
  anchor.add(grp);
  const m = { kind: 'slot', grp, edges, fill: fillM, hit: fillM, label, bad, reasons, hovered: false, ...payload };
  fillM.userData.owner = m;
  markers.push(m);
  return m;
}

function clearMarkers() {
  for (const m of markers) { m.grp.parent?.remove(m.grp); disposeTree(m.grp); }
  markers.length = 0;
  if (hoveredMarker?.kind === 'slot') hoveredMarker = null;
}

function makeConnectorMark(worldPos, key) {
  const grp = new THREE.Group();
  grp.position.copy(worldPos);
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.95 }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.16, depthWrite: false }));
  grp.add(s, halo);
  scene.add(grp);
  const m = { kind: 'connector', key, grp, hit: halo, hovered: false };
  halo.userData.owner = m;
  connectorMarks.push(m);
  return m;
}
function clearConnectorMarks() {
  for (const m of connectorMarks) { scene.remove(m.grp); disposeTree(m.grp); }
  connectorMarks.length = 0;
  if (hoveredMarker?.kind === 'connector') hoveredMarker = null;
}

/* ============================================================ dynamics registry */
/** Rescan the scene for spinnable fans, RGB materials and the power LED.
 *  A single sweep is cheap and cannot drift out of sync the way incremental
 *  add/remove bookkeeping did once parts started being swapped in place. */
function refreshDynamics() {
  rotors.length = 0;
  rgbMats.length = 0;
  powerLed = null;
  scene.traverse(o => {
    if (o.userData.rotor && !o.userData.seized) {
      // remember the component this fan belongs to so faults can stop just it
      let owner = o;
      while (owner && !owner.userData.partCat) owner = owner.parent;
      o.userData._owner = owner;
      rotors.push(o);
    }
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) if (m.userData?.rgb && !rgbMats.includes(m)) rgbMats.push(m);
    }
    if (o.userData.powerLed) powerLed = o;
  });
}

/* ============================================================ install pipeline */
const anims = [];

/** Where does a category mount, and how far out does it slide in from?
 *  The case is the one thing that mounts to the world rather than to another
 *  part, so it is handled here; everything else defers to the shared rules. */
function targetsFor(cat, spec) {
  if (cat === 'case') return [{ anchor: rig, offset: new THREE.Vector3(0, 3.5, 0) }];
  return mountsFor(cat, spec, { caseGroup, moboGroup: nodes.mobo?.root });
}

/** Pick a part up out of the tray: build previews and show the slot markers. */
function hold(uid) {
  uid = Number(uid);          // tray tiles hand this over as a data-attribute string
  const item = state.owned.find(o => o.uid === uid);
  if (!item || item.installedAt) return;
  if (state.held === uid) { release(); return; }
  release();

  const missing = CAT[item.cat].needs.filter(n => !state.installed[n]);
  if (missing.length) {
    UI.toast(`Install the <b>${missing.map(m => CAT[m].label).join('</b> and <b>')}</b> first.`, 'err');
    return;
  }

  state.held = uid;
  const targets = targetsFor(item.cat, item);
  if (!targets.length) { UI.toast('Nowhere to mount that yet.', 'err'); state.held = null; return; }

  const cf = conflicts(item, { ...UI.ownedBuild(state), [item.cat]: null });
  const bad = hasErrors(cf);
  const reasons = cf.filter(c => c.level === 'err').map(c => c.text);

  const models = targets.map(() => makeModel(item.cat, item));
  models.forEach((m, i) => {
    m.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(m);
    const size = b.getSize(new THREE.Vector3()).addScalar(0.06);
    const center = b.getCenter(new THREE.Vector3());
    makeMarker(targets[i].anchor, size, center,
      `${item.brand} ${item.name}`, bad, reasons,
      { uid, cat: item.cat, models, targets, spec: item });
  });

  UI.renderTray(state);
  UI.setHint(bad
    ? `<b>${item.name}</b> does not fit — the marker is red. Click it to see why, or pick something else.`
    : `Click the glowing slot to install <b>${item.name}</b>.`);

  // aim the camera at the first target
  const wp = new THREE.Vector3();
  targets[0].anchor.getWorldPosition(wp);
  if (item.cat !== 'case') focusWorld(wp, Math.max(5.5, goal.dist * 0.8));
}

function release() {
  if (!state.held) return;
  const m = markers.find(x => x.uid === state.held);
  m?.models.forEach(mo => disposeTree(mo));
  clearMarkers();
  state.held = null;
  UI.renderTray(state);
  refreshHint();
}

function commitInstall(mark) {
  const item = state.owned.find(o => o.uid === mark.uid);
  if (!item) return;
  const { cat, models, targets } = mark;

  clearMarkers();
  state.held = null;

  const parts = [];
  models.forEach((model, i) => {
    const { anchor, offset } = targets[i];
    model.userData.partCat = cat;
    model.userData.partId = item.id;
    anchor.add(model);
    model.position.copy(offset);
    anims.push({ obj: model, from: offset.clone(), to: new THREE.Vector3(0, 0, 0), t: 0, dur: 0.55 });
    parts.push(model);
  });

  // an AIO also drops a radiator into the case, plus its tubes
  if (cat === 'cooler' && item.type === 'aio') {
    const rad = buildRadiator(item);
    rad.userData.partCat = cat; rad.userData.partId = item.id;
    radiatorAnchor(caseGroup, item).add(rad);
    rad.position.set(0, 0, 1.2);
    anims.push({ obj: rad, from: new THREE.Vector3(0, 0, 1.2), to: new THREE.Vector3(), t: 0, dur: 0.55 });
    parts.push(rad);
    setTimeout(() => {
      const tubes = makeAioTubes(parts[0], rad, rig);
      tubes.forEach((t, i) => { cables['aio' + i] = t; });
    }, 620);
  }

  item.installedAt = Date.now();
  state.installed[cat] = item;
  nodes[cat] = { root: parts[0], parts };
  if (cat === 'case') { caseGroup = parts[0]; onCaseInstalled(); }

  refreshDynamics();
  UI.toast(`<b>${item.name}</b> installed.`, 'ok', 2200);
  refreshAll();
  refreshConnectorMarks();
}

function onCaseInstalled() {
  caseGroup.userData.sidePanel.visible = false;   // start with the panel off
  setView('iso');
}

/* ---- uninstall ---- */
function dependentsOf(cat) {
  return CATS.filter(c => c.needs.includes(cat) && state.installed[c.id]).map(c => c.label);
}
function tryUninstallUnderPointer() {
  const { part } = resolvePick();
  if (part) uninstall(part.userData.partCat);
}
function uninstall(cat) {
  const item = state.installed[cat];
  if (!item) return;
  const dep = dependentsOf(cat);
  if (dep.length) { UI.toast(`Remove the <b>${dep.join('</b>, <b>')}</b> first.`, 'err'); return; }
  if (cat === 'case') {
    UI.toast('Removing the case means starting over — use Reset for that.', 'err');
    return;
  }
  // drop any cable that terminated on this part
  const CABLE_ENDS = { atx24: ['psu', 'mobo'], cpu8: ['psu', 'mobo', 'cpu'], pcie: ['psu', 'gpu'] };
  for (const [k, ends] of Object.entries(CABLE_ENDS))
    if (state.cables[k] && ends.includes(cat)) dropCable(k);
  if (cat === 'cooler') { dropCable('aio0'); dropCable('aio1'); }

  for (const p of nodes[cat].parts) { p.parent?.remove(p); disposeTree(p); }
  delete nodes[cat];
  delete state.installed[cat];
  item.installedAt = null;
  refreshDynamics();
  UI.toast(`<b>${item.name}</b> removed — back in the tray.`, 'inf', 2200);
  refreshAll();
  refreshConnectorMarks();
}
function dropCable(k) {
  if (cables[k]) { cables[k].parent?.remove(cables[k]); disposeTree(cables[k]); delete cables[k]; }
  if (k in state.cables) state.cables[k] = false;
}

/* ============================================================ cables */
const connectorWorldPos = key => cableEndWorld(key, nodes.mobo?.root, nodes.gpu?.root);

function refreshConnectorMarks() {
  clearConnectorMarks();
  if (!nodes.psu) return;
  const need = requiredCables(state);
  for (const [k, on] of Object.entries(need)) {
    if (!on || state.cables[k]) continue;
    const p = connectorWorldPos(k);
    if (p) makeConnectorMark(p, k);
  }
}

function runCable(key) {
  const psu = nodes.psu?.root;
  const end = connectorWorldPos(key);
  if (!psu || !end) return;
  const c = makePowerCable(key, psu, end, caseGroup, rig);
  cables[key] = c;
  c.userData.grow = 0;
  state.cables[key] = true;
  UI.toast(`<b>${CABLE_LABEL[key]}</b> connected.`, 'ok', 1900);
  refreshConnectorMarks();
  refreshAll();
}

/* ============================================================ shop actions */
function buy(id) {
  const spec = BY_ID[id];
  if (!spec) return;
  const existing = state.owned.find(o => o.cat === spec.cat);

  // clicking a part you already own sells it back
  if (existing && existing.id === id) {
    if (existing.installedAt) {
      const dep = dependentsOf(spec.cat);
      if (dep.length) { UI.toast(`Remove the <b>${dep.join('</b>, <b>')}</b> first.`, 'err'); return; }
      uninstall(spec.cat);
    }
    state.spent -= spec.price;
    state.owned = state.owned.filter(o => o.uid !== existing.uid);
    if (state.held === existing.uid) release();
    UI.toast(`Refunded <b>${money(spec.price)}</b>.`, 'inf', 1900);
    refreshAll();
    return;
  }

  const delta = spec.price - (existing ? existing.price : 0);
  if (state.spent + delta > state.budget) {
    UI.toast(`Not enough budget — ${money(spec.price)} needs ${money(state.spent + delta - state.budget)} more.`, 'err');
    return;
  }

  if (existing) {
    if (existing.installedAt) {
      const dep = dependentsOf(spec.cat);
      if (dep.length) {
        UI.toast(`Remove the <b>${dep.join('</b>, <b>')}</b> before swapping the ${CAT[spec.cat].label}.`, 'err');
        return;
      }
      uninstall(spec.cat);
    }
    state.spent -= existing.price;
    state.owned = state.owned.filter(o => o.uid !== existing.uid);
    if (state.held === existing.uid) release();
  }

  const item = { uid: uidSeq++, ...spec, installedAt: null };
  state.owned.push(item);
  state.spent += spec.price;
  UI.toast(`Bought <b>${spec.name}</b> — ${money(spec.price)}`, 'ok', 2000);
  refreshAll();

  // the case is the foundation: install it straight away
  if (spec.cat === 'case') setTimeout(() => hold(item.uid), 120);
}

/* ============================================================ power on */
function powerOn() {
  const need = readiness(state);
  if (need.length) { UI.toast('Still to do: ' + need[0], 'err'); return; }
  const build = UI.buildOf(state);
  const check = postCheck(build);

  const lines = [
    ['RIGFORGE BIOS  v5.20  —  ' + build.mobo.brand + ' ' + build.mobo.name, 420],
    ['', 60],
    ['Detecting CPU ................ ' + build.cpu.brand + ' ' + build.cpu.name, 340],
    [`  ${build.cpu.cores} cores / ${build.cpu.threads} threads, socket ${build.cpu.socket}`, 260],
    ['Training memory .............. ' + build.ram.gb + ' GB ' + build.ram.mem + '-' + build.ram.speed, 480],
    ['  Channel A ... OK      Channel B ... OK', 240],
    ['Detecting storage ............ ' + build.storage.name, 300],
    ['Detecting PCIe devices ....... ' + build.gpu.brand + ' ' + build.gpu.name, 320],
    [`  ${build.gpu.vram} GB · PCIe ${Math.min(build.mobo.pcie, 4)}.0 x16`, 240],
    ['Power supply ................. ' + build.psu.watts + 'W ' + build.psu.rating, 280],
    [`  Estimated load ${estimateDraw(build)} W`, 300],
    ['', 200],
  ];
  if (check.ok) {
    lines.push(['POST ......................... PASS', 500]);
    lines.push(['', 120], ['Booting…', 600]);
  } else {
    lines.push(['POST ......................... FAIL', 600]);
    lines.push(['', 120], ['*** ' + check.code + ' ***', 700]);
  }

  UI.runBoot(lines, () => {
    if (!check.ok) { UI.showPostFailure(check); return; }
    state.powered = true;
    if (powerLed) powerLed.material.emissiveIntensity = 2.2;
    setView('iso');
    UI.toast('System running — fans up, lights on.', 'ok', 2600);
    const r = evaluate(build);
    setTimeout(() => UI.showResults(r, state), 1500);
  });
}

/* ============================================================ reset */
function reset() {
  release();
  clearConnectorMarks();
  for (const k of Object.keys(cables)) dropCable(k);
  for (const c of rig.children.slice()) { rig.remove(c); disposeTree(c); }
  refreshDynamics();
  caseGroup = null;
  for (const k of Object.keys(nodes)) delete nodes[k];
  state.owned = []; state.installed = {}; state.spent = 0;
  state.cables = { atx24: false, cpu8: false, pcie: false };
  state.powered = false; state.held = null; state.tab = 'case';
  goal.theta = -0.34; goal.phi = 1.24; goal.dist = 13.5; goal.target.set(0.1, 0.3, 0);
  refreshAll();
  UI.toast('Cleared. Fresh budget, fresh start.', 'inf');
}

/* ============================================================ glue */
function refreshHint() {
  if (state.held) return;
  if (!state.installed.case) { UI.setHint('Start by buying a <b>case</b> from the store on the left.'); return; }
  const need = readiness(state);
  if (!need.length) { UI.setHint('Everything is in. Hit <b>Power On</b> to boot and benchmark it.'); return; }
  const pend = state.owned.filter(o => !o.installedAt);
  if (pend.length) {
    const ready = pend.find(o => CAT[o.cat].needs.every(n => state.installed[n]));
    if (ready) { UI.setHint(`Click <b>${ready.name}</b> in the tray, then click the glowing slot.`); return; }
  }
  const cablesLeft = Object.entries(requiredCables(state)).find(([k, v]) => v && !state.cables[k]);
  if (cablesLeft) { UI.setHint(`Click the glowing <b>${CABLE_LABEL[cablesLeft[0]]}</b> connector.`); return; }
  const missing = CATS.find(c => c.required && !state.installed[c.id]);
  if (missing) UI.setHint(`Next up: buy a <b>${missing.long}</b> from the store.`);
}

function refreshAll() {
  UI.renderTop(state);
  UI.renderShop(state);
  UI.renderBuild(state);
  UI.renderTray(state);
  refreshHint();
}

UI.init({
  setTab: c => { state.tab = c; UI.renderShop(state); },
  buy,
  hold,
  reset,
  focusCat: cat => {
    const n = nodes[cat];
    if (!n) {
      const owned = state.owned.find(o => o.cat === cat && !o.installedAt);
      if (owned) hold(owned.uid);
      else { state.tab = cat; UI.renderShop(state); }
      return;
    }
    const b = new THREE.Box3().setFromObject(n.root);
    focusWorld(b.getCenter(new THREE.Vector3()),
      Math.max(3.8, b.getSize(new THREE.Vector3()).length() * 1.6));
  },
});

document.getElementById('bPower').addEventListener('click', powerOn);
document.getElementById('bReset').addEventListener('click', reset);
document.getElementById('bHelp').addEventListener('click', () => UI.showHelp(mode));
document.querySelectorAll('.vb[data-view]').forEach(b =>
  b.addEventListener('click', () => setView(b.dataset.view)));
document.getElementById('bGlass').addEventListener('click', e => {
  if (!caseGroup) return;
  const p = caseGroup.userData.sidePanel;
  p.visible = !p.visible;
  e.currentTarget.classList.toggle('on', p.visible);
});
document.getElementById('bLights').classList.add('on');
document.getElementById('bLights').addEventListener('click', e => {
  state.rgbOn = !state.rgbOn;
  e.currentTarget.classList.toggle('on', state.rgbOn);
  rimA.intensity = state.rgbOn ? 26 : 6;
  rimB.intensity = state.rgbOn ? 16 : 4;
});
addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (inspectHandler) { repairMod?.endInspection(); return; }
    release(); UI.closeModal();
  }
  if (e.key === 'h' || e.key === 'H') UI.showHelp(mode);
});

function onResize() {
  const w = innerWidth, h = innerHeight;
  // A collapsed or hidden pane reports 0×0; resizing to that would bake in a
  // bogus aspect ratio, so keep the last good size and wait to be told again.
  if (w < 2 || h < 2) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener('resize', onResize);
new ResizeObserver(onResize).observe(document.documentElement);
onResize();

/* ============================================================ loop */
const clock = new THREE.Clock();
let hue = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  // camera easing
  const k = 1 - Math.pow(0.0016, dt);
  view.theta += (goal.theta - view.theta) * k;
  view.phi += (goal.phi - view.phi) * k;
  view.dist += (goal.dist - view.dist) * k;
  view.target.lerp(goal.target, k);
  const sp = Math.sin(view.phi), cp = Math.cos(view.phi);
  camera.position.set(
    view.target.x + view.dist * sp * Math.cos(view.theta),
    view.target.y + view.dist * cp,
    view.target.z + view.dist * sp * Math.sin(view.theta));
  camera.lookAt(view.target);

  // install animations
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    a.t += dt / a.dur;
    const e = a.t >= 1 ? 1 : 1 - Math.pow(1 - a.t, 3);
    a.obj.position.lerpVectors(a.from, a.to, e);
    if (a.t >= 1) anims.splice(i, 1);
  }

  // cable growth
  for (const key of Object.keys(cables)) {
    const c = cables[key];
    if (c.userData.grow === undefined) continue;
    if (c.userData.grow < 1) {
      c.userData.grow = Math.min(1, c.userData.grow + dt * 1.8);
      c.geometry.setDrawRange(0, Math.floor(c.userData.growable * c.userData.grow));
    }
  }

  // fans + lighting
  const live = mode === 'repair' ? repairPowered : state.powered;
  if (live) {
    for (const r of rotors) {
      // a fault can stop an individual fan or a whole component's fans
      if (r.userData._owner?.userData.stopped) continue;
      r.rotation.z += dt * (6 + (r.userData.rotor.speed || 1) * 8);
    }
  }
  hue = (hue + dt * 0.08) % 1;
  for (let i = 0; i < rgbMats.length; i++) {
    const m = rgbMats[i];
    const on = state.rgbOn && (live || (mode === 'build' && !state.installed.case));
    m.emissiveIntensity = on ? 1.3 : 0.06;
    m.emissive.setHSL((hue + i * 0.06 + m.userData.rgb.phase * 0.03) % 1, 0.85, 0.55);
  }

  // marker pulse
  const pulse = 0.55 + Math.sin(performance.now() * 0.005) * 0.45;
  for (const m of markers) {
    m.fill.material.opacity = (m.hovered ? 0.26 : 0.10) + pulse * 0.08;
    m.edges.material.opacity = 0.55 + pulse * 0.45;
    m.grp.scale.setScalar(m.hovered ? 1.03 : 1.0);
  }
  for (const m of connectorMarks) {
    m.grp.scale.setScalar((m.hovered ? 1.35 : 1.0) * (0.9 + pulse * 0.22));
  }

  if (hoverDirty && !drag) updateHover();
  renderer.render(scene, camera);
}

/* ============================================================ modes */
// Repair mode is loaded on demand: it imports this module back, and deferring
// the import until after evaluation keeps that cycle from biting.
let repairMod = null;
let mode = 'build';
let repairPowered = false;

async function setMode(next) {
  if (mode === next) return;
  if (next === 'repair') {
    release();
    UI.setBusy('Opening the shop…');
    try {
      repairMod = repairMod || await import('./repair.js');
    } catch (err) {
      UI.setBusy(null);
      UI.toast('Could not load the repair shop: ' + err.message, 'err', 5000);
      return;
    }
    if (!repairMod.shop.rng) repairMod.init(engine);
    mode = 'repair';
    document.getElementById('app').classList.add('mode-repair');
    repairMod.enter();
    UI.setBusy(null);
    UI.setHint('Take a job from the queue on the left, then diagnose it on the bench.');
  } else {
    mode = 'build';
    repairPowered = false;
    document.getElementById('app').classList.remove('mode-repair');
    repairMod?.leave();
    setView('iso');
    refreshAll();
  }
  document.querySelectorAll('.modebtn').forEach(b =>
    b.classList.toggle('on', b.dataset.mode === mode));
}

/** Swap the backdrop between the build studio and the shop floor. */
function setEnvironment(which) {
  const studio = which === 'build';
  ground.visible = studio;
  grid.visible = studio;
  bench.visible = studio;
  rimA.intensity = studio ? (state.rgbOn ? 34 : 6) : 10;
  rimB.intensity = studio ? (state.rgbOn ? 22 : 4) : 7;
  key.intensity = studio ? 2.0 : 0.75;
  fill.intensity = studio ? 0.55 : 0.3;
  scene.fog.near = studio ? 26 : 34;
}

/** The API repair mode drives the shared scene through. */
const engine = {
  scene, camera, rig, THREE,
  registerPickable, unregisterPickable, setInspectMode, setEnvironment,
  refreshDynamics,
  setMachinePowered(on) { repairPowered = on; refreshDynamics(); },
  focusPoint(pos, dist, ang = {}) {
    goal.target.copy(pos);
    goal.dist = dist;
    if (ang.theta !== undefined) goal.theta = ang.theta;
    if (ang.phi !== undefined) goal.phi = ang.phi;
    document.querySelectorAll('.vb[data-view]').forEach(b => b.classList.remove('on'));
  },
};

document.querySelectorAll('.modebtn').forEach(b =>
  b.addEventListener('click', () => setMode(b.dataset.mode)));

// dev hook — handy for poking at the scene from the console
window.RIG = {
  setMode, get repair() { return repairMod; }, engine,
  scene, camera, rig, state, nodes, markers, view, goal, THREE,
  hold, release, powerOn, reset,
  /** install without aiming the mouse: pick it up, then take the first slot */
  install(uidOrCat) {
    const item = state.owned.find(o => o.uid === uidOrCat || (o.cat === uidOrCat && !o.installedAt));
    if (!item) return 'not owned: ' + uidOrCat;
    hold(item.uid);
    if (!markers.length) return 'no slot for ' + item.cat;
    commitInstall(markers[0]);
    return item.name;
  },
  connect: runCable,
  /** finish every in-flight install animation immediately */
  settle() {
    for (const a of anims) a.obj.position.copy(a.to);
    anims.length = 0;
    return 'settled';
  },
};

/* ============================================================ boot */
refreshAll();
setView('iso');
UI.setHint('Start by buying a <b>case</b> from the store on the left.');
tick();
// Revealing the app is deliberately not gated on requestAnimationFrame: a
// backgrounded or hidden tab never fires one, which would leave the loading
// veil covering a perfectly working scene.
{
  const l = document.getElementById('loading');
  l.classList.add('gone');
  setTimeout(() => l.remove(), 600);
  setTimeout(() => UI.showHelp(), 400);
}
