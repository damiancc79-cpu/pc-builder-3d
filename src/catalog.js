// catalog.js — every part you can buy, with the specs the sim reasons about.
// Brands are fictional but the numbers track real-world hardware closely enough
// that the compatibility + thermal lessons transfer.

// `label` is the short chip text; `long` is used in prose hints.
export const CATS = [
  { id: 'case',    label: 'Case',      long: 'case',           glyph: '▤', required: true,  needs: []       },
  { id: 'psu',     label: 'Power',     long: 'power supply',   glyph: '⚡', required: true,  needs: ['case'] },
  { id: 'mobo',    label: 'Mainboard', long: 'motherboard',    glyph: '▦', required: true,  needs: ['case'] },
  { id: 'cpu',     label: 'CPU',       long: 'CPU',            glyph: '⬛', required: true,  needs: ['mobo'] },
  { id: 'cooler',  label: 'Cooling',   long: 'CPU cooler',     glyph: '❄', required: true,  needs: ['cpu']  },
  { id: 'ram',     label: 'Memory',    long: 'memory kit',     glyph: '▥', required: true,  needs: ['mobo'] },
  { id: 'gpu',     label: 'GPU',       long: 'graphics card',  glyph: '▬', required: true,  needs: ['mobo'] },
  { id: 'storage', label: 'Storage',   long: 'drive',          glyph: '▭', required: true,  needs: ['mobo'] },
  { id: 'fans',    label: 'Fans',      long: 'fan pack',       glyph: '✤', required: false, needs: ['case'] },
];

export const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));

// ---------------------------------------------------------------- cases
const CASES = [
  {
    id: 'case-vent', cat: 'case', brand: 'Kryotek', name: 'Vent 200 Mesh', price: 79,
    form: ['ATX', 'mATX', 'ITX'], maxGpu: 330, maxCooler: 165, radiators: [120, 240],
    fansIncluded: 2, airflow: 8, glass: false, rgb: false,
    size: { w: 2.10, h: 4.60, d: 4.50 },
    color: 0x33393f, accent: 0x5d6b78,
    blurb: 'Cheap, ugly, breathes like a wind tunnel. The value pick.',
  },
  {
    id: 'case-aurora', cat: 'case', brand: 'Aurora', name: 'Glass X7', price: 129,
    form: ['ATX', 'mATX', 'ITX'], maxGpu: 360, maxCooler: 170, radiators: [120, 240, 360],
    fansIncluded: 3, airflow: 6, glass: true, rgb: true,
    size: { w: 2.16, h: 4.70, d: 4.55 },
    color: 0x252b34, accent: 0x3d4855,
    blurb: 'Tempered glass on two sides. Looks incredible, breathes okay.',
  },
  {
    id: 'case-nano', cat: 'case', brand: 'Kryotek', name: 'Nano Cube S1', price: 109,
    form: ['ITX'], maxGpu: 265, maxCooler: 62, radiators: [120],
    fansIncluded: 1, airflow: 4, glass: true, rgb: false,
    size: { w: 2.05, h: 2.75, d: 3.45 },
    color: 0x2a2f36, accent: 0x4a5560,
    blurb: 'Tiny. Only takes ITX boards, low-profile coolers and short cards.',
  },
  {
    id: 'case-mono', cat: 'case', brand: 'Titanflux', name: 'Monolith XL', price: 189,
    form: ['ATX', 'mATX', 'ITX'], maxGpu: 425, maxCooler: 190, radiators: [120, 240, 360],
    fansIncluded: 4, airflow: 9, glass: true, rgb: true,
    size: { w: 2.42, h: 5.45, d: 5.15 },
    color: 0x1d2126, accent: 0x7a6428,
    blurb: 'Full tower. Fits absolutely everything, twice.',
  },
];

// ---------------------------------------------------------------- power supplies
const PSUS = [
  {
    id: 'psu-nn500', cat: 'psu', brand: 'NoName', name: 'PowerMax 500', price: 29,
    watts: 500, rating: 'None', modular: false, quality: 0.35, len: 140,
    color: 0x2a2a2a,
    blurb: 'Suspiciously cheap. The label is the best-engineered part.',
  },
  {
    id: 'psu-550', cat: 'psu', brand: 'Voltcore', name: 'V550 Bronze', price: 59,
    watts: 550, rating: 'Bronze', modular: false, quality: 0.75, len: 140,
    color: 0x1e2126,
    blurb: 'Honest budget unit for a modest build.',
  },
  {
    id: 'psu-750', cat: 'psu', brand: 'Voltcore', name: 'V750 Gold', price: 99,
    watts: 750, rating: 'Gold', modular: false, quality: 0.9, len: 150,
    color: 0x1a1d21,
    blurb: 'The sweet spot for a single mid-range GPU.',
  },
  {
    id: 'psu-850', cat: 'psu', brand: 'Voltcore', name: 'V850 Gold Modular', price: 139,
    watts: 850, rating: 'Gold', modular: true, quality: 0.93, len: 160,
    color: 0x16191d,
    blurb: 'Fully modular — only plug in the cables you actually need.',
  },
  {
    id: 'psu-1000', cat: 'psu', brand: 'Voltcore', name: 'V1000 Platinum', price: 199,
    watts: 1000, rating: 'Platinum', modular: true, quality: 0.97, len: 170,
    color: 0x101317,
    blurb: 'Headroom for a flagship GPU and then some.',
  },
];

// ---------------------------------------------------------------- motherboards
const MOBOS = [
  {
    id: 'mb-b650', cat: 'mobo', brand: 'Vex', name: 'B650 Pulse', price: 159,
    socket: 'VX5', form: 'ATX', mem: 'DDR5', slots: 4, maxMem: 128, m2: 2,
    vrm: 0.7, pcie: 4, wifi: false, rgb: false,
    pcb: 0x14181e, accent: 0x2f3a48,
    blurb: 'Solid mid-range ATX board. Good VRM for the money.',
  },
  {
    id: 'mb-x670', cat: 'mobo', brand: 'Vex', name: 'X670E Prime', price: 299,
    socket: 'VX5', form: 'ATX', mem: 'DDR5', slots: 4, maxMem: 192, m2: 4,
    vrm: 0.95, pcie: 5, wifi: true, rgb: true,
    pcb: 0x0d1014, accent: 0x8a2f5a,
    blurb: 'Flagship board — heavy VRM, PCIe 5.0, Wi-Fi, RGB.',
  },
  {
    id: 'mb-b650i', cat: 'mobo', brand: 'Vex', name: 'B650I Nano', price: 199,
    socket: 'VX5', form: 'ITX', mem: 'DDR5', slots: 2, maxMem: 96, m2: 2,
    vrm: 0.72, pcie: 4, wifi: true, rgb: false,
    pcb: 0x121620, accent: 0x2a4a5e,
    blurb: 'Mini-ITX. Two RAM slots only, and it needs a small case.',
  },
  {
    id: 'mb-b760', cat: 'mobo', brand: 'Nexon', name: 'B760 Edge', price: 169,
    socket: 'NX7', form: 'ATX', mem: 'DDR5', slots: 4, maxMem: 128, m2: 3,
    vrm: 0.72, pcie: 4, wifi: false, rgb: false,
    pcb: 0x101418, accent: 0x2c3d50,
    blurb: 'Mainstream Nexon board. Locked for overclocking, fine otherwise.',
  },
  {
    id: 'mb-z790', cat: 'mobo', brand: 'Nexon', name: 'Z790 Apex', price: 329,
    socket: 'NX7', form: 'ATX', mem: 'DDR5', slots: 4, maxMem: 192, m2: 4,
    vrm: 0.97, pcie: 5, wifi: true, rgb: true,
    pcb: 0x0b0e12, accent: 0x1d5f7a,
    blurb: 'Overclocking board with a VRM that can feed a 250 W chip.',
  },
  {
    id: 'mb-h610', cat: 'mobo', brand: 'Nexon', name: 'H610M Basic', price: 89,
    socket: 'NX7', form: 'mATX', mem: 'DDR4', slots: 2, maxMem: 64, m2: 1,
    vrm: 0.4, pcie: 4, wifi: false, rgb: false,
    pcb: 0x171b20, accent: 0x3a4048,
    blurb: 'Bare-bones micro-ATX. DDR4 only, and the VRM hates big chips.',
  },
];

// ---------------------------------------------------------------- CPUs
const CPUS = [
  {
    id: 'cpu-r3', cat: 'cpu', brand: 'Vex', name: 'Ryder 3 7300', price: 129,
    socket: 'VX5', cores: 4, threads: 8, tdp: 65, perf: 40, mt: 34, igpu: true,
    blurb: 'Entry quad-core. Has integrated graphics as a safety net.',
  },
  {
    id: 'cpu-r5', cat: 'cpu', brand: 'Vex', name: 'Ryder 5 7600X', price: 229,
    socket: 'VX5', cores: 6, threads: 12, tdp: 105, perf: 62, mt: 55, igpu: true,
    blurb: 'Six fast cores. The default sensible gaming CPU.',
  },
  {
    id: 'cpu-r7x', cat: 'cpu', brand: 'Vex', name: 'Ryder 7 7800X3D', price: 389,
    socket: 'VX5', cores: 8, threads: 16, tdp: 120, perf: 88, mt: 70, igpu: true,
    blurb: 'Stacked cache. Absurd gaming performance for its power draw.',
  },
  {
    id: 'cpu-r9', cat: 'cpu', brand: 'Vex', name: 'Ryder 9 7950X', price: 549,
    socket: 'VX5', cores: 16, threads: 32, tdp: 170, perf: 84, mt: 100, igpu: true,
    blurb: '16 cores for rendering and compiles. Runs hot by design.',
  },
  {
    id: 'cpu-i5', cat: 'cpu', brand: 'Nexon', name: 'Core X5-13600K', price: 289,
    socket: 'NX7', cores: 14, threads: 20, tdp: 125, perf: 70, mt: 72, igpu: true,
    blurb: 'Hybrid 6P+8E design. Great all-rounder.',
  },
  {
    id: 'cpu-i7', cat: 'cpu', brand: 'Nexon', name: 'Core X7-13700K', price: 409,
    socket: 'NX7', cores: 16, threads: 24, tdp: 150, perf: 80, mt: 86, igpu: true,
    blurb: 'Fast in games, strong in production. Wants real cooling.',
  },
  {
    id: 'cpu-i9', cat: 'cpu', brand: 'Nexon', name: 'Core X9-13900K', price: 589,
    socket: 'NX7', cores: 24, threads: 32, tdp: 253, perf: 90, mt: 104, igpu: true,
    blurb: 'Monstrous multi-core. 253 W means a 360 mm radiator, minimum.',
  },
];

// ---------------------------------------------------------------- coolers
const COOLERS = [
  {
    id: 'cool-stock', cat: 'cooler', brand: 'Generic', name: 'Stock Heatsink', price: 15,
    type: 'air', height: 68, tdpCap: 95, noise: 9, rgb: false, radiator: 0,
    blurb: 'The little aluminium puck in the box. Adequate for 65 W chips.',
  },
  {
    id: 'cool-low', cat: 'cooler', brand: 'Kryotek', name: 'SlimFin L60', price: 45,
    type: 'air', height: 58, tdpCap: 125, noise: 7, rgb: false, radiator: 0,
    blurb: 'Low-profile downdraft cooler built for small-form-factor cases.',
  },
  {
    id: 'cool-t120', cat: 'cooler', brand: 'Kryotek', name: 'Tower 120', price: 39,
    type: 'air', height: 155, tdpCap: 180, noise: 5, rgb: false, radiator: 0,
    blurb: 'Single-tower air cooler. Quiet, cheap, hard to beat on value.',
  },
  {
    id: 'cool-d2', cat: 'cooler', brand: 'Kryotek', name: 'Dual Tower D2', price: 89,
    type: 'air', height: 168, tdpCap: 265, noise: 4, rgb: false, radiator: 0,
    blurb: 'Two fin stacks, two fans. Matches most 240 mm liquid coolers.',
  },
  {
    id: 'cool-a240', cat: 'cooler', brand: 'Frostline', name: 'AIO 240 ARGB', price: 129,
    type: 'aio', height: 55, tdpCap: 250, noise: 6, rgb: true, radiator: 240,
    blurb: 'All-in-one liquid loop, 240 mm radiator. Glowing pump head.',
  },
  {
    id: 'cool-a360', cat: 'cooler', brand: 'Frostline', name: 'AIO 360 ARGB', price: 189,
    type: 'aio', height: 55, tdpCap: 330, noise: 7, rgb: true, radiator: 360,
    blurb: 'Three-fan radiator. The only sane answer to a 250 W CPU.',
  },
];

// ---------------------------------------------------------------- memory
const RAMS = [
  {
    id: 'ram-d4-16', cat: 'ram', brand: 'Kryotek', name: 'Value 16GB DDR4-3200', price: 39,
    mem: 'DDR4', gb: 16, sticks: 2, speed: 3200, rgb: false, tall: false, color: 0x1e2228,
    blurb: 'Two green sticks under a plain black heatspreader.',
  },
  {
    id: 'ram-d5-16', cat: 'ram', brand: 'Kryotek', name: 'Fury 16GB DDR5-5600', price: 59,
    mem: 'DDR5', gb: 16, sticks: 2, speed: 5600, rgb: false, tall: false, color: 0x23272d,
    blurb: '16 GB is still the sane floor for gaming.',
  },
  {
    id: 'ram-d5-32', cat: 'ram', brand: 'Kryotek', name: 'Fury RGB 32GB DDR5-6000', price: 109,
    mem: 'DDR5', gb: 32, sticks: 2, speed: 6000, rgb: true, tall: true, color: 0x14181e,
    blurb: '32 GB at 6000 MT/s with a diffused RGB bar. The popular kit.',
  },
  {
    id: 'ram-d5-64', cat: 'ram', brand: 'Kryotek', name: 'Titan 64GB DDR5-6400', price: 219,
    mem: 'DDR5', gb: 64, sticks: 2, speed: 6400, rgb: true, tall: true, color: 0x0f1216,
    blurb: 'Overkill for games, lovely for VMs and huge project files.',
  },
];

// ---------------------------------------------------------------- GPUs
const GPUS = [
  {
    id: 'gpu-7600', cat: 'gpu', brand: 'Radion', name: 'RX 7600 Dual', price: 259,
    vram: 8, len: 225, slots: 2, tdp: 165, perf: 44, fans: 2, rgb: false,
    connector: '8-pin', shroud: 0x2c3037, accent: 0xe04a4a,
    blurb: 'Honest 1080p card. Short enough for anything.',
  },
  {
    id: 'gpu-4060', cat: 'gpu', brand: 'Nova', name: 'RTX 4060 Ti OC', price: 399,
    vram: 8, len: 244, slots: 2, tdp: 160, perf: 54, fans: 2, rgb: true,
    connector: '8-pin', shroud: 0x262a31, accent: 0x4ed06a,
    blurb: 'Efficient and quiet, but 8 GB of VRAM ages fast.',
  },
  {
    id: 'gpu-7800', cat: 'gpu', brand: 'Radion', name: 'RX 7800 XT Nitro', price: 499,
    vram: 16, len: 288, slots: 3, tdp: 263, perf: 72, fans: 3, rgb: true,
    connector: '8+8-pin', shroud: 0x2a2e35, accent: 0xf05a48,
    blurb: '16 GB at 1440p. Thirsty, thick, and very fast for the money.',
  },
  {
    id: 'gpu-4070', cat: 'gpu', brand: 'Nova', name: 'RTX 4070 Ti Super', price: 799,
    vram: 16, len: 312, slots: 3, tdp: 285, perf: 82, fans: 3, rgb: true,
    connector: '12VHPWR', shroud: 0x242931, accent: 0x5ce08c,
    blurb: 'High-refresh 1440p, comfortable 4K. Measure your case first.',
  },
  {
    id: 'gpu-4090', cat: 'gpu', brand: 'Nova', name: 'RTX 4090 Ti Titan', price: 1699,
    vram: 24, len: 358, slots: 4, tdp: 450, perf: 100, fans: 3, rgb: true,
    connector: '12VHPWR', shroud: 0x1f232b, accent: 0xdfb63a,
    blurb: 'The halo card. 358 mm long, 450 W, four slots of pure ego.',
  },
];

// ---------------------------------------------------------------- storage
const STORAGE = [
  {
    id: 'ssd-sata', cat: 'storage', brand: 'Datacore', name: '1TB SATA SSD', price: 49,
    tb: 1, bus: 'SATA', readMB: 550, gen: 3, color: 0x2a2e34,
    blurb: 'A 2.5-inch SATA drive. Fine, but six times slower than NVMe.',
  },
  {
    id: 'ssd-1tb', cat: 'storage', brand: 'Datacore', name: '1TB NVMe Gen4', price: 79,
    tb: 1, bus: 'M.2', readMB: 5000, gen: 4, color: 0x1c2026,
    blurb: 'M.2 stick, straight into the board. The default choice.',
  },
  {
    id: 'ssd-2tb', cat: 'storage', brand: 'Datacore', name: '2TB NVMe Gen4', price: 139,
    tb: 2, bus: 'M.2', readMB: 7000, gen: 4, color: 0x181c22,
    blurb: 'Twice the room, same speed class. Games are enormous now.',
  },
  {
    id: 'ssd-4tb', cat: 'storage', brand: 'Datacore', name: '4TB NVMe Gen5', price: 329,
    tb: 4, bus: 'M.2', readMB: 12000, gen: 5, color: 0x121519,
    blurb: 'Gen 5 speeds. Needs a Gen 5 board to actually hit them.',
  },
];

// ---------------------------------------------------------------- extra fans
const FANS = [
  {
    id: 'fan-3', cat: 'fans', brand: 'Airflux', name: '120mm Trio', price: 29,
    count: 3, airflow: 3, noise: 3, rgb: false, color: 0x1a1d21,
    blurb: 'Three plain black fans. Cheap thermal insurance.',
  },
  {
    id: 'fan-rgb', cat: 'fans', brand: 'Airflux', name: '120mm ARGB Trio', price: 55,
    count: 3, airflow: 3, noise: 4, rgb: true, color: 0x14171b,
    blurb: 'Same airflow, but they glow. Priorities.',
  },
  {
    id: 'fan-quiet', cat: 'fans', brand: 'Airflux', name: 'Whisper 140 Duo', price: 39,
    count: 2, airflow: 2, noise: 1, rgb: false, color: 0x22252a,
    blurb: 'Big, slow, nearly silent 140 mm fans.',
  },
];

export const PARTS = [...CASES, ...PSUS, ...MOBOS, ...CPUS, ...COOLERS,
  ...RAMS, ...GPUS, ...STORAGE, ...FANS];

export const BY_ID = Object.fromEntries(PARTS.map(p => [p.id, p]));

export const partsIn = cat => PARTS.filter(p => p.cat === cat);

export const money = n => '$' + n.toLocaleString('en-US');

// Short spec chips shown on each store card.
export function specTags(p) {
  switch (p.cat) {
    case 'case': return [p.form.join('/'), `GPU ≤${p.maxGpu}mm`, `Cooler ≤${p.maxCooler}mm`,
      `${p.fansIncluded} fans`, p.glass ? 'glass' : 'solid'];
    case 'psu': return [`${p.watts} W`, p.rating, p.modular ? 'modular' : 'fixed cables'];
    case 'mobo': return [p.socket, p.form, p.mem, `${p.slots} slots`, `PCIe ${p.pcie}.0`,
      ...(p.wifi ? ['Wi-Fi'] : [])];
    case 'cpu': return [p.socket, `${p.cores}C/${p.threads}T`, `${p.tdp} W`];
    case 'cooler': return [p.type === 'aio' ? `${p.radiator}mm AIO` : 'air',
      `${p.height}mm tall`, `≤${p.tdpCap} W`];
    case 'ram': return [p.mem, `${p.gb} GB`, `${p.speed} MT/s`, `${p.sticks}×`,
      ...(p.rgb ? ['RGB'] : [])];
    case 'gpu': return [`${p.vram} GB`, `${p.len}mm`, `${p.slots}-slot`, `${p.tdp} W`, p.connector];
    case 'storage': return [p.bus, `${p.tb} TB`, `${p.readMB} MB/s`];
    case 'fans': return [`${p.count}×`, ...(p.rgb ? ['ARGB'] : []), 'quiet'];
    default: return [];
  }
}
