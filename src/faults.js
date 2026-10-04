// faults.js — what can be wrong with a customer's machine, what it looks like,
// what each diagnostic tool reveals, and what actually fixes it.
//
// Every fault is deliberately distinguishable: no two share the same combination
// of POST behaviour + tool readings, so a careful technician can always narrow
// it down without guessing. Symptoms alone are ambiguous on purpose — several
// faults present as "no display" — and that is the whole game.

export const POST = {
  DEAD: 'dead',           // nothing at all: no fans, no lights
  NO_DISPLAY: 'nodisplay',// fans spin, never reaches POST
  POSTS_UNSTABLE: 'unstable', // POSTs, then reboots or shuts down under load
  BOOTS: 'boots',         // reaches the OS
};

export const REPAIRS = {
  reseat: { id: 'reseat', label: 'Reseat', verb: 'Reseated', cost: 0, minutes: 10, needsPart: false },
  reconnect: { id: 'reconnect', label: 'Reconnect', verb: 'Reconnected', cost: 0, minutes: 5, needsPart: false },
  clean: { id: 'clean', label: 'Clean out', verb: 'Cleaned', cost: 4, minutes: 20, needsPart: false },
  repaste: { id: 'repaste', label: 'Repaste', verb: 'Repasted', cost: 8, minutes: 25, needsPart: false },
  remount: { id: 'remount', label: 'Remount cooler', verb: 'Remounted', cost: 8, minutes: 25, needsPart: false },
  replace: { id: 'replace', label: 'Replace', verb: 'Replaced', cost: null, minutes: 30, needsPart: true },
};

/**
 * target      which installed component the fault lives on
 * post        how the machine behaves on the bench
 * beeps       POST speaker code (0 = silent)
 * visual      what a close look at the part shows (null = nothing to see)
 * probe       readings per tool; anything omitted reads normal
 * fix         { action, target } that actually resolves it
 * labour      what the job is worth before parts
 */
export const FAULTS = [
  {
    id: 'ram-unseated', target: 'ram', severity: 1,
    name: 'Memory not seated',
    complaint: 'It was working, I moved it to my new desk, now it just beeps at me.',
    post: POST.NO_DISPLAY, beeps: 3,
    visual: 'One DIMM sits proud of its slot — the retention clip is still open.',
    probe: {
      multimeter: 'All rails within tolerance. 12V: 12.08 V, 5V: 5.02 V, 3.3V: 3.31 V.',
      thermal: 'Everything at ambient. Nothing is drawing load.',
      software: 'No POST — the diagnostic stick never gets control.',
    },
    fix: { action: 'reseat', target: 'ram' },
    labour: 45,
    lesson: 'Three short beeps is the classic memory POST code. Always reseat before you replace.',
  },
  {
    id: 'gpu-power-loose', target: 'gpu', severity: 1,
    name: 'PCIe power cable unplugged',
    complaint: 'No picture at all. The fans come on so I know it has power.',
    post: POST.NO_DISPLAY, beeps: 1,
    visual: 'The PCIe power connector is hanging loose beside the card.',
    probe: {
      multimeter: 'PSU rails fine. No draw on the PCIe auxiliary line.',
      thermal: 'GPU stone cold — it is not being powered.',
      software: 'No POST.',
    },
    fix: { action: 'reconnect', target: 'gpu' },
    labour: 40,
    lesson: 'A card with no auxiliary power will not initialise, even though the slot itself is live.',
  },
  {
    id: 'dust-choked', target: 'cooler', severity: 2,
    name: 'Cooler choked with dust',
    complaint: 'It has got really loud over the last year and games stutter badly.',
    post: POST.BOOTS, beeps: 0,
    visual: 'A thick grey dust mat is packed across the cooler fins and intake.',
    probe: {
      multimeter: 'Rails normal.',
      thermal: 'CPU 97 °C within a minute of load. Fan at maximum.',
      software: 'Clocks drop to base under sustained load. Thermal throttle flag set.',
    },
    fix: { action: 'clean', target: 'cooler' },
    labour: 55,
    lesson: 'Airflow, not silicon, is usually the limit. Dust is the cheapest performance fix there is.',
  },
  {
    id: 'paste-dried', target: 'cpu', severity: 2,
    name: 'Thermal paste has dried out',
    complaint: 'It shuts itself off whenever I render anything. Fine for email.',
    post: POST.POSTS_UNSTABLE, beeps: 0,
    visual: 'Cooler contact patch is chalky and cracked — the paste has gone powdery.',
    probe: {
      multimeter: 'Rails normal under load.',
      thermal: 'CPU spikes to 100 °C in seconds, then hard shutdown. Cooler itself stays cool.',
      software: 'Kernel log shows thermal emergency shutdown.',
    },
    fix: { action: 'repaste', target: 'cpu' },
    labour: 65,
    lesson: 'A cool heatsink with a scorching CPU means the heat is not crossing the joint.',
  },
  {
    id: 'cooler-loose', target: 'cooler', severity: 2,
    name: 'Cooler mount backed off',
    complaint: 'Something rattles when I move the tower, and it runs hot.',
    post: POST.POSTS_UNSTABLE, beeps: 0,
    visual: 'The cooler rocks against the socket — two mounting screws have backed right out.',
    probe: {
      multimeter: 'Rails normal.',
      thermal: 'CPU 99 °C under any load; heatsink barely above ambient.',
      software: 'Throttling immediately, then an emergency shutdown.',
    },
    fix: { action: 'remount', target: 'cooler' },
    labour: 60,
    lesson: 'Uneven mounting pressure gives the same signature as bad paste. Check the screws first.',
  },
  {
    id: 'psu-dead', target: 'psu', severity: 3,
    name: 'Power supply failed',
    complaint: 'There was a pop and a smell, and now nothing happens when I press the button.',
    post: POST.DEAD, beeps: 0,
    visual: 'Scorch marks around the PSU vents and a sharp burnt smell.',
    probe: {
      multimeter: '12V rail: 0.00 V. 5V standby: 0.00 V. The unit is not switching on at all.',
      thermal: 'No heat anywhere. Nothing is running.',
      software: 'Cannot test — no power.',
    },
    fix: { action: 'replace', target: 'psu' },
    labour: 70,
    lesson: 'No standby voltage means the PSU is dead, not the board. Test the rails before condemning anything else.',
  },
  {
    id: 'mobo-caps', target: 'mobo', severity: 3,
    name: 'Bulged VRM capacitors',
    complaint: 'It reboots at random. Sometimes it will not start for ten minutes.',
    post: POST.POSTS_UNSTABLE, beeps: 0,
    visual: 'Two capacitors near the VRM are domed and weeping brown residue.',
    probe: {
      multimeter: '12V from the PSU is clean, but the VRM output is unstable under load.',
      thermal: 'VRM heatsink at 105 °C. CPU itself is fine.',
      software: 'Random resets with no thermal or power event logged.',
    },
    fix: { action: 'replace', target: 'mobo' },
    labour: 95,
    lesson: 'Clean input plus dirty output means the fault is between them: the board regulation stage.',
  },
  {
    id: 'gpu-fan-seized', target: 'gpu', severity: 3,
    name: 'Seized graphics card fan',
    complaint: 'Green squares all over the screen in games, then it crashes to desktop.',
    post: POST.BOOTS, beeps: 0,
    visual: 'The middle GPU fan is jammed solid — a cracked blade is fouling the shroud.',
    probe: {
      multimeter: 'Rails normal.',
      thermal: 'GPU core 104 °C, memory junction higher. The other two fans are spinning.',
      software: 'Driver timeouts logged. Artefacts reproduce at 30 seconds of load.',
    },
    fix: { action: 'replace', target: 'gpu' },
    labour: 85,
    lesson: 'Artefacts plus a very hot core is overheating VRAM, not a bad driver.',
  },
  {
    id: 'ssd-failing', target: 'storage', severity: 2,
    name: 'Drive failing',
    complaint: 'Takes five minutes to get to the desktop and files keep going missing.',
    post: POST.BOOTS, beeps: 0,
    visual: null,
    probe: {
      multimeter: 'Rails normal.',
      thermal: 'Nothing unusual.',
      software: 'SMART: 2,145 reallocated sectors, media wearout 4 %. Reads stall for seconds at a time.',
    },
    fix: { action: 'replace', target: 'storage' },
    labour: 60,
    lesson: 'Some faults are invisible. If nothing looks wrong, read the drive telemetry.',
  },
  {
    id: 'ram-bad-stick', target: 'ram', severity: 2,
    name: 'One memory module failing',
    complaint: 'Blue screens, different error every time. Someone said it was a virus.',
    post: POST.POSTS_UNSTABLE, beeps: 0,
    visual: null,
    probe: {
      multimeter: 'Rails normal.',
      thermal: 'Nothing unusual.',
      software: 'Memtest: 1,204 errors, all in the second module\'s address range. Pass with that stick removed.',
    },
    fix: { action: 'replace', target: 'ram' },
    labour: 65,
    lesson: 'Random, inconsistent crashes are the signature of bad memory. Test it before reinstalling anything.',
  },
  {
    id: 'fan-unplugged', target: 'fans', severity: 1,
    name: 'Case fans unplugged',
    complaint: 'It gets hot and noisy but it does work. The shop that built it never finished it properly.',
    post: POST.BOOTS, beeps: 0,
    visual: 'Both intake fan cables are dangling, unplugged from the board headers.',
    probe: {
      multimeter: 'Rails normal.',
      thermal: 'Everything 15–20 °C above where it should sit. No case airflow at all.',
      software: 'Fan headers report 0 RPM. Mild sustained throttling.',
    },
    fix: { action: 'reconnect', target: 'fans' },
    labour: 35,
    lesson: 'Uniformly warm — rather than one hot component — points at case airflow, not a cooler.',
  },
];

export const FAULT_BY_ID = Object.fromEntries(FAULTS.map(f => [f.id, f]));

/** Tool definitions used by the repair bench. */
export const TOOLS = [
  { id: 'inspect', label: 'Inspect', glyph: '🔍', hint: 'Look closely at each component for physical damage.' },
  { id: 'power', label: 'Bench test', glyph: '⏻', hint: 'Press the power button and watch what the machine does.' },
  { id: 'multimeter', label: 'Multimeter', glyph: '🔌', hint: 'Probe the PSU rails for voltage.' },
  { id: 'thermal', label: 'Thermal cam', glyph: '🌡', hint: 'Read component temperatures under load.' },
  { id: 'software', label: 'Diagnostics', glyph: '💾', hint: 'Boot the diagnostic stick: memtest, SMART, event log.' },
];

export const POST_REPORT = {
  [POST.DEAD]: {
    line: 'Dead. No fans, no lights, no standby LED on the board.',
    detail: 'Pressing the button does nothing at all.',
  },
  [POST.NO_DISPLAY]: {
    line: 'Fans spin up, but it never reaches POST — no display output.',
    detail: 'Power is clearly getting in. Something is stopping it before firmware hands over.',
  },
  [POST.POSTS_UNSTABLE]: {
    line: 'POSTs and boots, then falls over under load.',
    detail: 'Stable at idle. Put it under sustained load and it throttles, reboots or shuts down.',
  },
  [POST.BOOTS]: {
    line: 'Boots to the desktop and stays up.',
    detail: 'Whatever is wrong, it is not stopping the machine from running.',
  },
};

/* ------------------------------------------------------------------ customers */

const FIRST = ['Marisol', 'Dev', 'Aleks', 'Priya', 'Tomas', 'Ngozi', 'Yuki', 'Rafa',
  'Elena', 'Kwame', 'Sam', 'Ines', 'Bo', 'Hana', 'Luca', 'Nadia'];
const LAST = ['Okafor', 'Verma', 'Lindqvist', 'Moreau', 'Silva', 'Adeyemi', 'Tanaka',
  'Ortiz', 'Novak', 'Mensah', 'Fischer', 'Ruiz', 'Chen', 'Kovac', 'Bianchi', 'Haddad'];

const PATIENCE = [
  { id: 'relaxed', label: 'No rush', mult: 1.0, note: 'Happy to leave it with you.' },
  { id: 'normal', label: 'Standard', mult: 1.0, note: 'Would like it back today.' },
  { id: 'rush', label: 'Rush job', mult: 1.35, note: 'Paying extra — needs it this afternoon.' },
];

/** Deterministic-ish PRNG so a seeded shop day can be replayed. */
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const pickOne = (arr, rng) => arr[Math.floor(rng() * arr.length) % arr.length];

/**
 * Build one work order. `machineSpecs` is a complete part list for the customer's
 * PC; the fault is chosen from those the machine can actually exhibit.
 */
export function makeTicket(id, machineSpecs, rng, forceFaultId = null) {
  const eligible = FAULTS.filter(f => machineSpecs[f.target]);
  const fault = forceFaultId
    ? (FAULT_BY_ID[forceFaultId] || pickOne(eligible, rng))
    : pickOne(eligible, rng);
  const patience = pickOne(PATIENCE, rng);
  const name = `${pickOne(FIRST, rng)} ${pickOne(LAST, rng)}`;

  // what the customer will pay for labour, before any parts you fit
  const quote = Math.round(fault.labour * patience.mult);

  return {
    id,
    customer: name,
    patience,
    complaint: fault.complaint,
    faultId: fault.id,
    quote,
    machineSpecs,
    // filled in as the job progresses
    opened: false,
    toolsUsed: [],
    repairsDone: [],
    partsFitted: [],
    partsCost: 0,
    spend: 0,             // everything that has left the till for this job
    resolved: false,
    closed: false,
    outcome: null,
  };
}

/** Did the work performed actually fix the reported fault? */
export function isResolved(ticket) {
  const fault = FAULT_BY_ID[ticket.faultId];
  return ticket.repairsDone.some(r => r.action === fault.fix.action && r.target === fault.fix.target);
}

/** Repairs that were not needed — these cost money and annoy the customer. */
export function unnecessaryWork(ticket) {
  const fault = FAULT_BY_ID[ticket.faultId];
  return ticket.repairsDone.filter(r =>
    !(r.action === fault.fix.action && r.target === fault.fix.target));
}

/**
 * Settle the invoice.
 *
 * Money has already left the till for every repair as it was performed
 * (`ticket.spend`). At settlement you bill the customer for the quoted labour
 * plus the cost of the work that actually fixed the machine — and nothing else.
 * Parts you fitted chasing a wrong theory stay on your side of the ledger.
 */
export function settle(ticket) {
  const fault = FAULT_BY_ID[ticket.faultId];
  const resolved = isResolved(ticket);
  const waste = unnecessaryWork(ticket);
  const wastedCost = waste.reduce((s, r) => s + (r.cost || 0), 0);

  const fixing = ticket.repairsDone.filter(r =>
    r.action === fault.fix.action && r.target === fault.fix.target);

  const labour = resolved ? ticket.quote : 0;
  const partsBilled = resolved ? fixing.reduce((s, r) => s + (r.cost || 0), 0) : 0;
  const revenue = labour + partsBilled;
  const costs = ticket.spend;
  const profit = revenue - costs;

  let rep = 0;
  if (resolved) {
    rep += 3;
    if (waste.length === 0) rep += 2;         // clean, precise diagnosis
    rep -= Math.min(3, waste.length);          // charged them for guesswork
    if (ticket.toolsUsed.length <= 2 && waste.length === 0) rep += 1;  // fast and right
  } else {
    rep -= 4;
  }

  return {
    resolved, fault, waste, wastedCost,
    labour, partsBilled, revenue, costs, profit, rep,
    verdict: resolved
      ? (waste.length === 0 ? 'Fixed first time' : 'Fixed, but you replaced good parts')
      : 'Returned unfixed',
  };
}
