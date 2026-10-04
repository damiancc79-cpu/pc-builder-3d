// compat.js — the rules engine. Decides what can be bought, what can be
// installed, and how well the finished machine actually performs.

import { CAT, CATS } from './catalog.js';

/** Hard blockers between a candidate part and everything already chosen.
 *  Returns [] when the part fits. Each entry: {level:'err'|'wrn', text}. */
export function conflicts(part, build) {
  const out = [];
  const add = (level, text) => out.push({ level, text });
  const cs = build.case, mb = build.mobo, cpu = build.cpu, gpu = build.gpu;
  const cool = build.cooler, ram = build.ram, psu = build.psu, ssd = build.storage;

  switch (part.cat) {
    case 'case':
      if (mb && !part.form.includes(mb.form))
        add('err', `${part.name} does not accept ${mb.form} boards (${mb.name}).`);
      if (gpu && gpu.len > part.maxGpu)
        add('err', `${gpu.name} is ${gpu.len}mm — this case tops out at ${part.maxGpu}mm.`);
      if (cool && cool.type === 'air' && cool.height > part.maxCooler)
        add('err', `${cool.name} is ${cool.height}mm tall — clearance is ${part.maxCooler}mm.`);
      if (cool && cool.type === 'aio' && !part.radiators.includes(cool.radiator))
        add('err', `No mounting point for a ${cool.radiator}mm radiator.`);
      break;

    case 'mobo':
      if (cs && !cs.form.includes(part.form))
        add('err', `${cs.name} has no standoffs for an ${part.form} board.`);
      if (cpu && cpu.socket !== part.socket)
        add('err', `${cpu.name} is socket ${cpu.socket}; this board is ${part.socket}.`);
      if (ram && ram.mem !== part.mem)
        add('err', `${ram.name} is ${ram.mem}; this board only takes ${part.mem}.`);
      if (ram && ram.sticks > part.slots)
        add('err', `Kit has ${ram.sticks} sticks, board has ${part.slots} slots.`);
      if (ssd && ssd.bus === 'M.2' && part.m2 < 1)
        add('err', 'No M.2 slot on this board.');
      break;

    case 'cpu':
      if (mb && mb.socket !== part.socket)
        add('err', `Socket ${part.socket} will not drop into a ${mb.socket} board (${mb.name}).`);
      if (mb && part.tdp > 200 && mb.vrm < 0.8)
        add('wrn', `${mb.name}'s VRM will run hot feeding a ${part.tdp} W chip.`);
      if (cool && part.tdp > cool.tdpCap)
        add('wrn', `${cool.name} handles ${cool.tdpCap} W — this CPU pulls ${part.tdp} W.`);
      break;

    case 'cooler':
      if (cs && part.type === 'air' && part.height > cs.maxCooler)
        add('err', `${part.height}mm tall, but ${cs.name} allows ${cs.maxCooler}mm.`);
      if (cs && part.type === 'aio' && !cs.radiators.includes(part.radiator))
        add('err', `${cs.name} has no ${part.radiator}mm radiator mount.`);
      if (cpu && cpu.tdp > part.tdpCap)
        add('wrn', `Rated for ${part.tdpCap} W; ${cpu.name} pulls ${cpu.tdp} W under load.`);
      break;

    case 'ram':
      if (mb && mb.mem !== part.mem)
        add('err', `${part.mem} modules cannot fit a ${mb.mem} slot.`);
      if (mb && part.sticks > mb.slots)
        add('err', `${mb.name} only has ${mb.slots} DIMM slots.`);
      if (mb && part.gb > mb.maxMem)
        add('err', `${mb.name} caps out at ${mb.maxMem} GB.`);
      if (cool && cool.type === 'air' && cool.height > 150 && part.tall)
        add('wrn', 'Tall heatspreaders may foul a big air cooler — check the first slot.');
      break;

    case 'gpu':
      if (cs && part.len > cs.maxGpu)
        add('err', `${part.len}mm card, ${cs.maxGpu}mm of room in ${cs.name}.`);
      if (psu && psu.watts < estimateDraw({ ...build, gpu: part }) * 1.15)
        add('wrn', `${psu.watts} W is tight for this card — expect shutdowns under load.`);
      if (mb && mb.form === 'ITX' && part.slots >= 4)
        add('wrn', 'A four-slot card in an ITX build is asking a lot of the case.');
      break;

    case 'psu': {
      const need = estimateDraw(build);
      if (need && part.watts < need)
        add('err', `Build needs about ${need} W; this unit supplies ${part.watts} W.`);
      else if (need && part.watts < need * 1.2)
        add('wrn', `Only ${part.watts - need} W of headroom. Transient spikes may trip it.`);
      if (part.quality < 0.5)
        add('wrn', 'Unrated, no protection circuitry. This is how hardware dies.');
      break;
    }

    case 'storage':
      if (mb && part.bus === 'M.2' && mb.m2 < 1) add('err', 'Board has no M.2 slot.');
      if (mb && part.gen === 5 && mb.pcie < 5)
        add('wrn', `${mb.name} is PCIe ${mb.pcie}.0 — a Gen 5 drive runs at half speed.`);
      break;

    case 'fans':
      if (cs && cs.airflow >= 8)
        add('wrn', `${cs.name} already moves plenty of air — these are optional.`);
      break;
  }
  return out;
}

export const hasErrors = list => list.some(c => c.level === 'err');

/** Estimated sustained wall draw in watts. */
export function estimateDraw(build) {
  const cpu = build.cpu?.tdp || 0;
  const gpu = build.gpu?.tdp || 0;
  if (!cpu && !gpu) return 0;
  const rest = 25 + (build.storage ? 8 : 0) + (build.ram ? 10 : 0) +
    (build.fans ? build.fans.count * 3 : 0) + (build.cooler?.type === 'aio' ? 12 : 4);
  return Math.round(cpu * 1.1 + gpu * 1.15 + rest);
}

/** Which categories are still missing / installed, in build order. */
export function progress(state) {
  return CATS.map(c => ({
    cat: c,
    owned: !!state.owned.find(o => o.cat === c.id),
    installed: !!state.installed[c.id],
  }));
}

/** Everything that must be true before the machine will POST. */
export function readiness(state) {
  const out = [];
  for (const c of CATS) {
    if (!c.required) continue;
    if (!state.installed[c.id]) out.push(`${c.label} not installed`);
  }
  for (const [k, need] of Object.entries(requiredCables(state)))
    if (need && !state.cables[k]) out.push(`${CABLE_LABEL[k]} not connected`);
  return out;
}

export const CABLE_LABEL = {
  atx24: '24-pin board power',
  cpu8: '8-pin CPU power',
  pcie: 'PCIe GPU power',
};

export function requiredCables(state) {
  const i = state.installed;
  return {
    atx24: !!(i.psu && i.mobo),
    cpu8: !!(i.psu && i.mobo && i.cpu),
    pcie: !!(i.psu && i.gpu),
  };
}

// `base` is calibrated so a mid-range card lands on realistic 1440p numbers:
// ~160 fps esports / ~90 RPG / ~35 ray-traced on an RX 7600 class GPU.
const GAMES = [
  { name: 'Esports Shooter',     gpuW: 0.55, cpuW: 0.45, base: 4.60 },
  { name: 'Open-World RPG',      gpuW: 0.80, cpuW: 0.20, base: 1.57 },
  { name: 'Ray-Traced Flagship', gpuW: 0.92, cpuW: 0.08, base: 0.88 },
  { name: 'Strategy / Sim',      gpuW: 0.30, cpuW: 0.70, base: 2.20 },
];

/** Full evaluation once the build powers on. */
export function evaluate(build, opts = {}) {
  const { cpu, gpu, ram, mobo, cooler, psu, storage, fans } = build;
  const cs = build.case;

  // --- airflow: lower is better (multiplier on temperature rise)
  let airflow = 1.18 - cs.airflow * 0.022 - (fans ? fans.airflow * 0.018 : 0);
  if (cooler.type === 'aio') airflow -= 0.03;
  airflow = Math.max(0.8, airflow);

  // --- thermals
  let cpuTemp = 38 + 56 * Math.pow(cpu.tdp / cooler.tdpCap, 0.85) * airflow;
  if (mobo.vrm < 0.6 && cpu.tdp > 125) cpuTemp += 8;
  const cpuThrottle = cpuTemp > 95;
  cpuTemp = Math.min(cpuTemp, 100);

  let gpuTemp = 38 + 30 * airflow + gpu.tdp * 0.042;
  const gpuThrottle = gpuTemp > 86;
  gpuTemp = Math.min(gpuTemp, 94);

  // --- raw performance
  const memMult = 0.93 + Math.min(0.14, (ram.speed - 3000) / 26000) +
    (ram.gb >= 32 ? 0.02 : 0) - (ram.gb < 16 ? 0.05 : 0);
  const pcieMult = gpu.slots >= 3 && mobo.pcie < 4 ? 0.97 : 1;
  let cpuScore = cpu.perf * memMult * (cpuThrottle ? 0.82 : 1);
  let gpuScore = gpu.perf * pcieMult * (gpuThrottle ? 0.9 : 1);
  if (gpu.vram <= 8) gpuScore *= 0.94; // VRAM ceiling in modern titles

  const fps = GAMES.map(g => {
    const raw = (gpuScore * g.gpuW + cpuScore * g.cpuW) * g.base;
    const bottleneck = Math.min(1, 0.62 + Math.min(cpuScore, gpuScore) / 190);
    return { name: g.name, fps: Math.max(12, Math.round(raw * bottleneck)) };
  });

  // --- noise
  let noise = 24 + cooler.noise * 1.2 + gpu.tdp / 42 + (fans ? fans.noise * 0.8 : 0);
  if (cpuThrottle) noise += 6;
  if (psu.quality < 0.6) noise += 3;
  noise = Math.round(noise);

  // --- power
  const draw = estimateDraw(build);
  const headroom = psu.watts - draw;
  const psuSafe = headroom > 0 && !(psu.quality < 0.5 && draw > psu.watts * 0.7);

  // --- storage feel
  const effRead = storage.gen === 5 && mobo.pcie < 5 ? storage.readMB * 0.55 : storage.readMB;

  // --- sub-scores (0..100)
  // Score against the frames actually produced, not the parts on paper — that
  // way a 4090 held back by a 4-core CPU scores like what it delivers.
  const REF = [460, 158, 90, 220];
  const perfScore = Math.min(100, Math.round(
    fps.reduce((s, f, i) => s + f.fps / REF[i], 0) / fps.length * 100));
  // 80 °C on a 450 W card is normal, and a loaded gaming PC at 45 dB is not a
  // failure — these penalties only bite once the build is genuinely misspecced.
  const thermScore = Math.round(Math.max(0, 100 - Math.max(0, cpuTemp - 62) * 2.4
    - Math.max(0, gpuTemp - 78) * 2.0));
  const quietScore = Math.round(Math.max(0, 100 - Math.max(0, noise - 30) * 3.0));
  const total = build.price;
  const valueScore = Math.min(100, Math.round((perfScore / (total / 1000)) * 1.4));
  const balance = Math.round(100 - Math.abs(cpuScore - gpuScore) * 1.15);
  const looks = Math.round(35 + (cs.glass ? 20 : 0) + (ram.rgb ? 12 : 0) + (gpu.rgb ? 12 : 0)
    + (cooler.rgb ? 12 : 0) + (mobo.rgb ? 8 : 0) + (fans?.rgb ? 12 : 0)
    + (psu.modular ? 6 : 0));

  const overall = Math.round(perfScore * 0.36 + thermScore * 0.2 + valueScore * 0.16 +
    quietScore * 0.12 + Math.max(0, balance) * 0.1 + Math.min(100, looks) * 0.06);

  // Thresholds are set against the real achievable range: because value and
  // noise both push back on brute-force spending, ~84 is a near-perfect build.
  const grade = overall >= 84 ? 'S' : overall >= 74 ? 'A' : overall >= 63 ? 'B'
    : overall >= 52 ? 'C' : overall >= 40 ? 'D' : 'F';

  // --- prose notes
  const notes = [];
  if (cpuThrottle) notes.push(`<b>${cpu.name} is thermal throttling at ${Math.round(cpuTemp)} °C.</b> ${cooler.name} is rated for ${cooler.tdpCap} W and the chip pulls ${cpu.tdp} W. A bigger cooler is worth more than any other upgrade here.`);
  else if (cpuTemp < 65) notes.push(`CPU sits at a cool <b>${Math.round(cpuTemp)} °C</b> — ${cooler.name} has room to spare.`);
  if (gpuThrottle) notes.push(`GPU hits <b>${Math.round(gpuTemp)} °C</b>; ${cs.name} is starving it of intake air. More case fans, or a mesh front.`);
  if (Math.abs(cpuScore - gpuScore) > 26) {
    const weak = cpuScore < gpuScore ? cpu.name : gpu.name;
    notes.push(`Noticeable imbalance: <b>${weak}</b> is holding the other component back. Money moved to it would buy more frames than anything else.`);
  }
  if (headroom < 0) notes.push(`<b>The PSU cannot supply this build.</b> ${draw} W needed, ${psu.watts} W available.`);
  else if (headroom < draw * 0.15) notes.push(`Only <b>${headroom} W</b> of PSU headroom. Transient spikes from ${gpu.name} can trip the over-current protection mid-game.`);
  if (psu.quality < 0.5) notes.push('The unrated PSU has no over-voltage protection. When it fails it can take the board with it. Never save money here.');
  if (ram.gb < 16) notes.push('Under 16 GB of RAM causes stutter in modern titles regardless of GPU.');
  if (storage.gen === 5 && mobo.pcie < 5) notes.push(`Gen 5 drive on a PCIe ${mobo.pcie}.0 board — you paid for ${storage.readMB} MB/s and get about ${Math.round(effRead)} MB/s.`);
  if (mobo.vrm < 0.6 && cpu.tdp > 125) notes.push(`${mobo.name}'s power stages are undersized for a ${cpu.tdp} W CPU; sustained loads will down-clock.`);
  if (!notes.length) notes.push('No weak links worth naming. The parts are matched and the cooling is sufficient.');

  return {
    grade, overall, perfScore, thermScore, quietScore, valueScore,
    balance: Math.max(0, balance), looks: Math.min(100, looks),
    cpuTemp: Math.round(cpuTemp), gpuTemp: Math.round(gpuTemp), noise,
    draw, headroom, psuSafe, cpuThrottle, gpuThrottle,
    fps, effRead: Math.round(effRead), notes, price: total,
    ...opts,
  };
}

/** POST failure reasons — checked before the benchmark runs. */
export function postCheck(build) {
  const draw = estimateDraw(build);
  if (build.psu.watts < draw)
    return { ok: false, code: 'PSU_OVERLOAD', msg: `Power supply overload — ${draw} W demanded from a ${build.psu.watts} W unit. The protection circuit cut the rail.` };
  if (build.psu.quality < 0.5 && draw > build.psu.watts * 0.7)
    return { ok: false, code: 'PSU_FAIL', msg: 'The unrated PSU let out its magic smoke under load. Board survived. Barely.' };
  if (build.cpu.socket !== build.mobo.socket)
    return { ok: false, code: 'NO_CPU', msg: 'No CPU detected — socket mismatch.' };
  if (build.ram.mem !== build.mobo.mem)
    return { ok: false, code: 'NO_MEM', msg: 'Memory training failed — wrong DIMM type.' };
  return { ok: true };
}
