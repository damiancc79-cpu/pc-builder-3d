// assemble.js — where each component mounts, and how to stand up a complete
// machine in one go. Build mode installs parts one at a time through mountsFor();
// repair mode uses assembleMachine() to drop a finished PC on the bench. Both
// share this file so a fix to the mounting maths lands in both places.

import * as THREE from 'three';
import {
  BOARD_SIZE, buildCase, buildMobo, buildCPU, buildCooler, buildRadiator,
  buildRAM, buildGPU, buildPSU, buildStorage, buildFan, buildCable,
} from './models.js';

export function makeModel(cat, spec) {
  switch (cat) {
    case 'case': return buildCase(spec);
    case 'mobo': return buildMobo(spec);
    case 'cpu': return buildCPU(spec);
    case 'cooler': return buildCooler(spec);
    case 'ram': return buildRAM(spec);
    case 'gpu': return buildGPU(spec);
    case 'psu': return buildPSU(spec);
    case 'storage': return buildStorage(spec);
    case 'fans': return buildFan(1.2, { color: spec.color, rgb: spec.rgb, depth: 0.25 });
  }
  return null;
}

/* ------------------------------------------------------------------ anchors */

/** Reusable empty parented to `parent`, keyed so repeat calls reuse it. */
export function childAnchor(parent, pos, tag = 'a') {
  let a = parent.userData['_anc_' + tag];
  if (!a) {
    a = new THREE.Object3D();
    parent.add(a);
    parent.userData['_anc_' + tag] = a;
  }
  a.position.copy(pos);
  return a;
}

/** The board hangs off the tray, top- and rear-aligned, so every form factor
 *  lands where a real standoff pattern would put it. */
export function moboAnchorFor(caseGroup, form) {
  const prev = caseGroup.userData._moboAnchor;
  if (prev) caseGroup.remove(prev);
  const ref = caseGroup.userData.ref;
  const [BW, BH] = BOARD_SIZE[form];
  const a = new THREE.Object3D();
  a.rotation.y = Math.PI / 2;
  a.position.set(ref.trayX, ref.topY - BH / 2, ref.rearZ - BW / 2);
  caseGroup.add(a);
  caseGroup.userData._moboAnchor = a;
  return a;
}

export function sataAnchor(caseGroup) {
  if (!caseGroup.userData._sata) {
    const ref = caseGroup.userData.ref;
    const a = new THREE.Object3D();
    a.rotation.y = Math.PI / 2;
    a.position.set(ref.trayX + 0.02, -ref.hh + 1.35, -ref.hd + 1.3);
    caseGroup.add(a);
    caseGroup.userData._sata = a;
  }
  return caseGroup.userData._sata;
}

/** Where a category mounts, plus how far out along the anchor's +Z it slides
 *  in from. ctx = { caseGroup, moboGroup }. */
export function mountsFor(cat, spec, ctx) {
  const { caseGroup, moboGroup: mb } = ctx;
  const V = (z) => new THREE.Vector3(0, 0, z);
  switch (cat) {
    case 'psu':
      return caseGroup ? [{ anchor: caseGroup.userData.mounts.psu, offset: V(2.4) }] : [];
    case 'mobo':
      return caseGroup ? [{ anchor: moboAnchorFor(caseGroup, spec.form), offset: V(2.2) }] : [];
    case 'cpu':
      return mb ? [{ anchor: childAnchor(mb, mb.userData.socketPos), offset: V(1.1) }] : [];
    case 'cooler': {
      if (!mb) return [];
      const p = mb.userData.socketPos.clone(); p.z += 0.062;
      return [{ anchor: childAnchor(mb, p, 'cooler'), offset: V(1.7) }];
    }
    case 'ram': {
      if (!mb) return [];
      const a = mb.userData.dimmAnchors;
      // dual channel: slots 2 + 4 on a four-slot board, 1 + 2 on a two-slot board
      const idx = a.length >= 4 ? [1, 3] : [0, 1];
      return idx.slice(0, spec.sticks).map(i => ({ anchor: a[i], offset: V(1.0) }));
    }
    case 'gpu':
      return mb ? [{ anchor: mb.userData.pcieAnchors[0], offset: V(1.3) }] : [];
    case 'storage': {
      if (!mb) return [];
      if (spec.bus === 'M.2' && mb.userData.m2Anchors.length)
        return [{ anchor: mb.userData.m2Anchors[0], offset: V(0.8) }];
      return caseGroup ? [{ anchor: sataAnchor(caseGroup), offset: V(0.9) }] : [];
    }
    case 'fans': {
      if (!caseGroup) return [];
      return caseGroup.userData.mounts.fans.slice(0, spec.count)
        .map(a => ({ anchor: a, offset: V(1.3) }));
    }
  }
  return [];
}

/** Radiator mount: front panel unless the rad is taller than the case allows. */
export function radiatorAnchor(caseGroup, spec) {
  const ref = caseGroup.userData.ref;
  const L = (spec.radiator / 120) * 1.24;
  const useTop = L > (ref.hh * 2 - 0.9);
  return useTop ? caseGroup.userData.mounts.radTop : caseGroup.userData.mounts.rad;
}

/** Two coolant tubes between an AIO pump head and its radiator, expressed in
 *  `parent` space so the whole machine can be moved around afterwards. */
export function makeAioTubes(pump, rad, parent) {
  const a = pump.userData.tubePorts, b = rad.userData.tubePorts;
  if (!a || !b || !pump.parent || !rad.parent) return [];
  parent.updateMatrixWorld(true);
  const out = [];
  for (let i = 0; i < 2; i++) {
    const p0 = parent.worldToLocal(pump.localToWorld(a[i].clone()));
    const p1 = parent.worldToLocal(rad.localToWorld(b[i].clone()));
    const mid = p0.clone().lerp(p1, 0.5);
    mid.y += 0.5 + i * 0.16; mid.x += 0.35;
    const tube = buildCable(p0, p1, { color: 0x101318, radius: 0.075, via: [mid] });
    tube.geometry.setDrawRange(0, tube.userData.growable);
    parent.add(tube);
    out.push(tube);
  }
  return out;
}

export const CABLE_SPEC = {
  atx24: { radius: 0.09 },
  cpu8: { radius: 0.065 },
  pcie: { radius: 0.075 },
};

/** Where each power cable terminates, in world space. */
export function cableEndWorld(key, moboGroup, gpuGroup) {
  const v = new THREE.Vector3();
  if (key === 'atx24' && moboGroup) return moboGroup.userData.atxAnchor.getWorldPosition(v);
  if (key === 'cpu8' && moboGroup) return moboGroup.userData.epsAnchor.getWorldPosition(v);
  if (key === 'pcie' && gpuGroup) return gpuGroup.userData.pcieAnchor.getWorldPosition(v);
  return null;
}

/** Route one PSU cable. Points are converted into `parent` space on the way in. */
export function makePowerCable(key, psuGroup, endWorld, caseGroup, parent) {
  const ref = caseGroup.userData.ref;
  parent.updateMatrixWorld(true);

  const toParent = v => parent.worldToLocal(v.clone());
  const fromCase = (x, y, z) => toParent(caseGroup.localToWorld(new THREE.Vector3(x, y, z)));

  const start = toParent(psuGroup.localToWorld(psuGroup.userData.cableOrigin.clone()));
  const end = toParent(endWorld);

  // out of the PSU, forward along the floor, then up the front to the header
  const via = [
    new THREE.Vector3(start.x - 0.1, start.y - 0.15, start.z - 0.55),
    fromCase(ref.trayX + 0.95, -ref.hh + 0.6, -ref.hd + 1.6),
    fromCase(ref.trayX + 0.95, 0, -ref.hd + 1.1),
    new THREE.Vector3(end.x + 0.22, end.y - 0.1, end.z - 0.18),
  ];

  const c = buildCable(start, end, { color: 0x0a0c10, radius: CABLE_SPEC[key].radius, via });
  parent.add(c);
  return c;
}

/* ------------------------------------------------------------------ machine */

/**
 * Build a whole PC from a set of part specs.
 * @param specs  { case, psu, mobo, cpu, cooler, ram, gpu, storage, fans? }
 * @returns { group, caseGroup, parts, cables, specs }
 */
export function assembleMachine(specs, opts = {}) {
  const group = new THREE.Group();
  const parts = {};                       // cat -> array of groups
  const add = (cat, model, anchor) => {
    model.userData.partCat = cat;
    model.userData.partId = specs[cat].id;
    anchor.add(model);
    model.position.set(0, 0, 0);
    (parts[cat] ||= []).push(model);
  };

  const caseGroup = makeModel('case', specs.case);
  caseGroup.userData.partCat = 'case';
  caseGroup.userData.partId = specs.case.id;
  group.add(caseGroup);
  parts.case = [caseGroup];
  if (opts.openPanel !== false) caseGroup.userData.sidePanel.visible = false;

  // the board first: everything except the PSU and fans hangs off it
  const moboGroup = makeModel('mobo', specs.mobo);
  add('mobo', moboGroup, mountsFor('mobo', specs.mobo, { caseGroup })[0].anchor);

  const ctx = { caseGroup, moboGroup };
  for (const cat of ['psu', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'fans']) {
    const spec = specs[cat];
    if (!spec) continue;
    for (const { anchor } of mountsFor(cat, spec, ctx)) add(cat, makeModel(cat, spec), anchor);
  }

  // AIO coolers also occupy a radiator mount
  let tubes = [];
  if (specs.cooler?.type === 'aio') {
    const rad = buildRadiator(specs.cooler);
    add('cooler', rad, radiatorAnchor(caseGroup, specs.cooler));
    tubes = makeAioTubes(parts.cooler[0], rad, group);
  }

  // power harness
  const cables = {};
  for (const key of ['atx24', 'cpu8', 'pcie']) {
    if (key === 'pcie' && !specs.gpu) continue;
    const end = cableEndWorld(key, moboGroup, parts.gpu?.[0]);
    if (!end) continue;
    const c = makePowerCable(key, parts.psu[0], end, caseGroup, group);
    c.geometry.setDrawRange(0, c.userData.growable);
    cables[key] = c;
  }

  return { group, caseGroup, moboGroup, parts, cables, tubes, specs };
}
