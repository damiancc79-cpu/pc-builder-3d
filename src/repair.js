// repair.js — the shop floor. Owns the ticket queue, the customer machine on
// the bench, the diagnostic tools and the repair actions.
//
// Loaded lazily by main.js the first time the player switches to repair mode,
// which keeps the module cycle (main → repair → main) harmless.

import * as THREE from 'three';
import { BY_ID, PARTS, money } from './catalog.js';
import { assembleMachine, makeModel } from './assemble.js';
import { buildShop, buildDamage, DAMAGE_FOR_FAULT, BENCH_TOP_Y } from './shop.js';
import {
  FAULT_BY_ID, TOOLS, POST, POST_REPORT, REPAIRS, makeTicket, makeRng, settle,
} from './faults.js';
import { disposeTree } from './models.js';
import * as UI from './ui.js';

let engine = null;              // injected from main.js
let shopGroup = null;
let machine = null;             // { group, parts, ... } currently on the bench
let damageNode = null;

export const shop = {
  active: false,
  day: 1,
  cash: 600,
  reputation: 12,
  tickets: [],
  ticket: null,                 // the open work order
  findings: {},                 // toolId -> readout text
  inspected: {},                // cat -> true once looked at closely
  seed: 20260801,
  rng: null,
  log: [],
};

/* ------------------------------------------------------------------ machines */

const pickFrom = (cat, rng, filter = () => true) => {
  const all = PARTS.filter(p => p.cat === cat);
  const list = all.filter(filter);
  const pool = list.length ? list : all;      // never let a filter empty the pool
  return pool[Math.floor(rng() * pool.length) % pool.length];
};

/** A plausible customer PC: parts that actually fit each other. */
function randomMachine(rng) {
  const cs = pickFrom('case', rng, p => p.form.includes('ATX'));
  const mobo = pickFrom('mobo', rng, p => p.form === 'ATX');
  const cpu = pickFrom('cpu', rng, p => p.socket === mobo.socket);
  const ram = pickFrom('ram', rng, p => p.mem === mobo.mem && p.sticks <= mobo.slots);
  const gpu = pickFrom('gpu', rng, p => p.len <= cs.maxGpu);
  const cooler = pickFrom('cooler', rng, p =>
    (p.type === 'air' ? p.height <= cs.maxCooler : cs.radiators.includes(p.radiator)));
  const storage = pickFrom('storage', rng, p => p.bus === 'M.2');
  const psu = pickFrom('psu', rng, p => p.watts >= cpu.tdp + gpu.tdp + 150);
  const fans = pickFrom('fans', rng);
  return { case: cs, mobo, cpu, ram, gpu, cooler, storage, psu, fans };
}

/* ------------------------------------------------------------------ lifecycle */

export function init(eng) {
  engine = eng;
  shop.rng = makeRng(shop.seed);
  refillQueue();
}

export function enter() {
  shop.active = true;
  if (!shopGroup) {
    shopGroup = buildShop();
    engine.scene.add(shopGroup);
  }
  shopGroup.visible = true;
  engine.rig.visible = false;
  engine.setEnvironment('shop');
  if (shop.ticket) frameBench(); else frameShopWide();
  render();
}

export function leave() {
  shop.active = false;
  if (shopGroup) shopGroup.visible = false;
  engine.rig.visible = true;
  engine.setEnvironment('build');
}

function refillQueue() {
  while (shop.tickets.filter(t => !t.closed).length < 3) {
    const specs = randomMachine(shop.rng);
    shop.tickets.push(makeTicket(shop.tickets.length + 1, specs, shop.rng));
  }
}

/* ------------------------------------------------------------------ the bench */

export function openTicket(id) {
  const t = shop.tickets.find(x => x.id === Number(id));
  if (!t || t.closed) return;
  if (shop.ticket && shop.ticket.id === t.id) return;
  if (shop.ticket && !shop.ticket.closed && shop.ticket.repairsDone.length)
    UI.toast(`Job #${shop.ticket.id} set aside — you can come back to it.`, 'inf');

  clearBench();
  shop.ticket = t;
  t.opened = true;
  shop.findings = {};
  shop.inspected = {};

  machine = assembleMachine(t.machineSpecs);
  machine.group.position.set(0.2, BENCH_TOP_Y + caseHalfHeight(t.machineSpecs.case), 0.3);
  // Turn the open side towards the technician. rotY maps the case's local +X
  // (the panel that comes off) to (cos, 0, -sin), so a negative angle swings it
  // round to +Z where the camera sits.
  machine.group.rotation.y = -0.55;
  shopGroup.add(machine.group);        // parented so leaving the mode hides it too
  engine.registerPickable(machine.group);

  applyFault(FAULT_BY_ID[t.faultId]);
  frameBench();
  UI.toast(`Job <b>#${t.id}</b> on the bench — ${t.customer}.`, 'ok');
  render();
}

const caseHalfHeight = spec => spec.size.h / 2 + 0.16;   // + feet

function clearBench() {
  if (!machine) return;
  engine.unregisterPickable(machine.group);
  machine.group.parent?.remove(machine.group);
  disposeTree(machine.group);
  machine = null;
  damageNode = null;
}

/** Make the machine physically show its fault. */
function applyFault(fault) {
  if (!fault || !machine) return;
  const targets = machine.parts[fault.target] || [];
  const host = targets[0];
  if (!host) return;

  const kind = DAMAGE_FOR_FAULT[fault.id];
  if (kind) {
    damageNode = buildDamage(kind, host);
    host.add(damageNode);
  }

  // some faults are shown by displacing the part rather than decorating it
  if (fault.id === 'ram-unseated' && targets[1]) {
    targets[1].position.z += 0.26;
    targets[1].rotation.x = 0.10;
    targets[1].userData.displaced = true;
  }
  if (fault.id === 'cooler-loose') {
    host.rotation.x = 0.075;
    host.position.z += 0.06;
    host.userData.displaced = true;
  }
  if (fault.id === 'gpu-power-loose' && machine.cables.pcie) {
    machine.cables.pcie.visible = false;
  }
  if (fault.id === 'fan-unplugged') {
    for (const f of machine.parts.fans || []) f.userData.stopped = true;
  }
  if (fault.id === 'gpu-fan-seized') {
    // jam one fan, not the whole card — the other two still turn
    const spinners = [];
    host.traverse(o => { if (o.userData.rotor) spinners.push(o); });
    const victim = spinners[Math.min(1, spinners.length - 1)];
    if (victim) { victim.userData.seized = true; host.userData._seizedRotor = victim; }
  }
  engine.refreshDynamics();
}

/** Undo the visual fault once it has actually been repaired. */
function clearFaultVisual(fault) {
  if (!machine) return;
  const targets = machine.parts[fault.target] || [];
  const host = targets[0];
  if (damageNode) {
    damageNode.parent?.remove(damageNode);
    disposeTree(damageNode);
    damageNode = null;
  }
  for (const p of targets) {
    if (!p.userData.displaced) continue;
    p.position.z -= (fault.id === 'ram-unseated' ? 0.26 : 0.06);
    p.rotation.x = 0;
    p.userData.displaced = false;
  }
  if (fault.id === 'gpu-power-loose' && machine.cables.pcie) machine.cables.pcie.visible = true;
  if (fault.id === 'fan-unplugged') for (const f of machine.parts.fans || []) f.userData.stopped = false;
  if (host?.userData._seizedRotor) {
    host.userData._seizedRotor.userData.seized = false;
    host.userData._seizedRotor = null;
  }
  engine.refreshDynamics();
}

/* ------------------------------------------------------------------ tools */

export function useTool(toolId) {
  const t = shop.ticket;
  if (!t) { UI.toast('Take a job from the queue first.', 'err'); return; }
  const fault = FAULT_BY_ID[t.faultId];
  if (!t.toolsUsed.includes(toolId)) t.toolsUsed.push(toolId);

  if (toolId === 'inspect') { beginInspection(); return; }

  if (toolId === 'power') {
    const rep = POST_REPORT[fault.post];
    shop.findings.power = `<b>${rep.line}</b><br>${rep.detail}` +
      (fault.beeps ? `<br>POST speaker: <b>${fault.beeps} short beep${fault.beeps > 1 ? 's' : ''}</b>.` : '');
    engine.setMachinePowered(fault.post !== POST.DEAD);
    UI.toast('Bench test run.', 'inf', 1800);
  } else {
    shop.findings[toolId] = fault.probe?.[toolId] || 'Nothing out of the ordinary.';
    UI.toast(`${TOOLS.find(x => x.id === toolId).label} reading taken.`, 'inf', 1800);
  }
  render();
}

/** Inspection mode: click components to look at them closely. */
function beginInspection() {
  shop.inspecting = true;
  engine.setInspectMode(true, (partCat) => {
    shop.inspected[partCat] = true;
    const fault = FAULT_BY_ID[shop.ticket.faultId];
    const found = fault.target === partCat && fault.visual;
    if (found) {
      shop.findings.inspect = `<b>${labelFor(partCat)}:</b> ${fault.visual}`;
      UI.toast('You found something.', 'ok', 2200);
    } else {
      UI.toast(`${labelFor(partCat)} — nothing obviously wrong.`, 'inf', 1600);
    }
    render();
  });
  UI.setHint('<b>Inspection mode</b> — click each component to look it over. Press <b>Esc</b> when done.');
}

export function endInspection() {
  shop.inspecting = false;
  engine.setInspectMode(false, null);
  render();
}

const labelFor = cat => ({
  case: 'Case', psu: 'Power supply', mobo: 'Motherboard', cpu: 'CPU',
  cooler: 'Cooler', ram: 'Memory', gpu: 'Graphics card', storage: 'Drive', fans: 'Case fans',
}[cat] || cat);

/* ------------------------------------------------------------------ repairs */

/** Repairs available for a given component, given what it is. */
export function repairsFor(cat) {
  const out = [];
  if (['ram', 'gpu', 'cpu', 'storage'].includes(cat)) out.push(REPAIRS.reseat);
  if (['gpu', 'fans', 'storage'].includes(cat)) out.push(REPAIRS.reconnect);
  if (['cooler', 'fans', 'case', 'psu'].includes(cat)) out.push(REPAIRS.clean);
  if (cat === 'cpu') out.push(REPAIRS.repaste);
  if (cat === 'cooler') out.push(REPAIRS.remount, REPAIRS.clean);
  if (cat !== 'case') out.push(REPAIRS.replace);
  // de-dupe while preserving order
  return out.filter((r, i) => out.indexOf(r) === i);
}

export function doRepair(cat, actionId, replacementId = null) {
  const t = shop.ticket;
  if (!t) return;
  const action = REPAIRS[actionId];
  if (!action) return;

  let cost = action.cost || 0;
  let note = `${action.verb} ${labelFor(cat).toLowerCase()}`;

  if (actionId === 'replace') {
    const spec = replacementId ? BY_ID[replacementId] : t.machineSpecs[cat];
    if (!spec) return;
    cost = spec.price;
    if (cost > shop.cash) {
      UI.toast(`Not enough cash for a ${spec.name} — you have ${money(shop.cash)}.`, 'err');
      return;
    }
    t.partsCost += cost;
    t.partsFitted.push(spec);
    note = `Fitted ${spec.name}`;
    swapPart(cat, spec);
  } else if (cost > shop.cash) {
    UI.toast(`Not enough in the till for that (${money(cost)}).`, 'err');
    return;
  }

  // every repair — parts and consumables alike — is paid for as it happens;
  // settlement decides how much of it you get to bill back
  shop.cash -= cost;
  t.spend += cost;
  t.repairsDone.push({ action: actionId, target: cat, cost, note });
  shop.log.unshift(`#${t.id} · ${note}`);

  const fault = FAULT_BY_ID[t.faultId];
  if (actionId === fault.fix.action && cat === fault.fix.target) {
    clearFaultVisual(fault);
    t.resolved = true;
    UI.toast(`<b>${note}.</b> That looks like the problem.`, 'ok', 2600);
  } else {
    UI.toast(`${note}.`, 'inf', 2000);
  }
  render();
}

/** Physically swap a component out for a new one on the bench. */
function swapPart(cat, spec) {
  if (!machine) return;
  const old = machine.parts[cat] || [];
  const anchors = old.map(p => p.parent);
  for (const p of old) {
    engine.unregisterPickable(p);
    p.parent?.remove(p);
    disposeTree(p);
  }
  const fresh = [];
  for (const anchor of anchors) {
    const m = makeModel(cat, spec);
    if (!m) break;
    m.userData.partCat = cat;
    m.userData.partId = spec.id;
    anchor.add(m);
    m.position.set(0, 0, 0);
    fresh.push(m);
  }
  machine.parts[cat] = fresh;
  machine.specs[cat] = spec;
  engine.refreshDynamics();
}

/** Parts you could fit as a replacement, cheapest sensible options first. */
export function replacementsFor(cat) {
  const specs = shop.ticket?.machineSpecs;
  if (!specs) return [];
  return PARTS.filter(p => p.cat === cat).filter(p => {
    if (cat === 'mobo') return p.socket === specs.cpu.socket && specs.case.form.includes(p.form);
    if (cat === 'cpu') return p.socket === specs.mobo.socket;
    if (cat === 'ram') return p.mem === specs.mobo.mem && p.sticks <= specs.mobo.slots;
    if (cat === 'gpu') return p.len <= specs.case.maxGpu;
    if (cat === 'cooler') return p.type === 'air'
      ? p.height <= specs.case.maxCooler : specs.case.radiators.includes(p.radiator);
    if (cat === 'psu') return p.watts >= specs.cpu.tdp + specs.gpu.tdp + 120;
    return true;
  }).sort((a, b) => a.price - b.price);
}

/* ------------------------------------------------------------------ closing */

export function closeTicket() {
  const t = shop.ticket;
  if (!t) return;
  if (!t.repairsDone.length) { UI.toast('You have not done any work on this yet.', 'err'); return; }

  const result = settle(t);
  t.closed = true;
  t.outcome = result;
  shop.cash += result.revenue;
  shop.reputation = Math.max(0, Math.min(100, shop.reputation + result.rep));

  UI.showRepairInvoice(t, result, () => {
    shop.ticket = null;
    clearBench();
    refillQueue();
    frameShopWide();
    render();
  });
}

/* ------------------------------------------------------------------ camera */

// The player stands on the +Z side of the bench, so both framings keep the
// camera inside the room (x ±13, z ±10) and looking back towards the pegboard.
function frameBench() {
  engine.focusPoint(new THREE.Vector3(0.2, BENCH_TOP_Y + 2.0, 0.3), 9.6, { theta: 0.86, phi: 1.18 });
}
function frameShopWide() {
  engine.focusPoint(new THREE.Vector3(0, 0.6, -1.6), 11, { theta: 1.22, phi: 1.30 });
}
export const camera = { frameBench, frameShopWide };

/* ------------------------------------------------------------------ render */

export function render() {
  UI.renderRepair(shop, {
    openTicket, useTool, doRepair, closeTicket, repairsFor, replacementsFor,
    endInspection, labelFor,
  }, machine);
  if (!shop.inspecting) UI.setHint(nextStepHint());
}

/** Nudge toward whatever the technician sensibly does next. */
function nextStepHint() {
  const t = shop.ticket;
  if (!t) return 'Take a job from the queue on the left to bring it to the bench.';
  if (t.resolved) return 'That should be it — <b>return it to the customer</b> and invoice the job.';
  if (!t.toolsUsed.length) return 'Start with a <b>bench test</b> or a <b>visual inspection</b>.';
  if (!t.repairsDone.length) return 'Read the evidence, then pick the <b>one repair</b> you think fixes it.';
  return 'Not fixed yet — take another reading before you replace anything else.';
}

export function currentMachine() { return machine; }
export function activeFault() {
  return shop.ticket ? FAULT_BY_ID[shop.ticket.faultId] : null;
}
