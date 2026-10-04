# RIGFORGE — 3D PC Builder &amp; Repair Shop Simulator

Two modes, switched from the top bar:

**Build** — buy parts on a budget, install them into a 3D case in the right
order, run the power cables, and boot the machine. It benchmarks what you built
and tells you which component is holding it back.

**Repair Shop** — customers leave broken machines on your bench. Diagnose the
fault with a bench test, a multimeter, a thermal camera, diagnostic software and
your own eyes, then fix it. You are paid for repairs that work; parts you fit
chasing a wrong theory come out of your own till.

Every part, and the shop around it, is generated procedurally — geometry and
canvas textures only, no external assets. Brands are fictional; the specs track
real hardware closely enough that the lessons transfer.

## Run it

```bash
python3 -m http.server 8231 --directory ~/Downloads/pc-builder-3d
```

Then open <http://localhost:8231>. There's also a `pc-builder` entry in
`~/Downloads/.claude/launch.json`.

It must be served over HTTP — the app uses ES modules, which browsers refuse to
load from `file://`.

## Controls

| Action | Input |
| --- | --- |
| Orbit | drag |
| Zoom | scroll |
| Pan | right-drag |
| Pick a part up | click it in the bottom tray |
| Install it | click the glowing slot in the 3D view |
| Inspect a part | hover it |
| Remove a part | double-click it |
| Sell a part back | click its card in the store again (full refund) |
| Preset views / panel / RGB | buttons on the right edge |
| Leave inspection mode | `Esc` |

## What it actually simulates

Compatibility is enforced, not decorative:

- CPU socket vs board socket, DDR4 vs DDR5, board form factor vs case standoffs
- GPU length and air-cooler height against real case clearances
- Radiator size against available mounting points
- PSU wattage against sustained draw, with headroom for transient spikes
- Cooler capacity vs CPU TDP — undercool a chip and it thermally throttles,
  which costs you frames in the benchmark
- Case airflow, VRM quality, memory speed, and PCIe generation all feed the
  final numbers

A part that doesn't fit still shows its outline in red at the slot, sized to its
real dimensions, so you can see *why* a 358 mm card won't go in a 330 mm case.

Install order follows real dependencies: case → PSU / motherboard → CPU →
cooler, memory, GPU, storage → cables. (In reality you'd seat the CPU, cooler
and RAM before the board goes in the case; here the board goes in first so you
can watch each step happen.)

The benchmark scores from the frames actually produced rather than from the spec
sheet, so a flagship GPU paired with a weak CPU scores like what it delivers.
Grades run F → S; because value and noise both push back on brute-force
spending, the most expensive possible build is *not* the highest-scoring one.

## The repair shop

Each work order carries a customer complaint and a hidden fault. Symptoms are
deliberately ambiguous — several faults present as "no display" — so the job is
to narrow it down rather than guess:

| Tool | What it separates |
| --- | --- |
| Inspect | Physical damage only: dust, bulged capacitors, scorching, a loose plug, an unseated stick. Click each component in 3D. |
| Bench test | How far it gets: dead / no display / unstable under load / boots. Plus POST beep codes. |
| Multimeter | PSU rail voltages — tells a dead supply from a dead board. |
| Thermal camera | Where the heat is. A scorching chip under a cold heatsink is a contact problem, not a capacity problem. |
| Diagnostics | Memtest, SMART and the event log, for faults with nothing to see. |

Eleven faults are modelled, from a memory stick that just needs reseating to
bulged VRM capacitors that need the board replaced. Two are deliberately
invisible — a failing drive and one bad DIMM — so that "nothing looks wrong"
becomes a real diagnostic state rather than a dead end.

The economics are the teaching mechanism. You are paid the quoted labour **only
if the machine leaves fixed**, and you may only bill for the part that was
actually the fault. Everything else you fitted, you eat:

```
clean fix (reseat a stick)        spend $0    invoiced $45   profit  +$45   rep +6
fix needing a part                spend $99   invoiced $169  profit  +$70   rep +6
one wrong guess, then the fix     spend $263  invoiced $59   profit -$204   rep +2
shotgun three parts, then the fix spend $346  invoiced $45   profit -$301   rep  0
never found it                    spend $8    invoiced $0    profit   -$8   rep -4
```

## Layout

| File | Contents |
| --- | --- |
| `index.html` | Markup, styling, import map |
| `src/catalog.js` | Every purchasable part and its spec sheet |
| `src/compat.js` | Compatibility rules, power draw, thermals, benchmark, grading |
| `src/models.js` | Procedural geometry + canvas textures for each component |
| `src/assemble.js` | Where components mount; builds a whole machine in one call |
| `src/faults.js` | Fault catalogue, work orders, invoice settlement |
| `src/shop.js` | The repair bay: room, bench, pegboard, shelving, damage overlays |
| `src/repair.js` | Repair-mode state machine: queue, tools, repairs |
| `src/ui.js` | All DOM rendering, both modes |
| `src/main.js` | Scene, camera, raycasting, install state machine, mode switching |
| `three.module.min.js` | Three.js r160, vendored locally |

`assemble.js` is shared deliberately: build mode installs one part at a time
through `mountsFor()`, repair mode drops a finished PC on the bench with
`assembleMachine()`, and both read the same mounting maths. Repair mode is
loaded with a dynamic `import()` on first use, which keeps the
`main → repair → main` module cycle from biting.

`window.RIG` is exposed for debugging from the console — it holds the scene,
state, and helpers (`install(cat)`, `settle()`, `connect(key)`, `reset()`).

## Notes

- Two coordinate conventions do most of the work in `models.js`: 1 world unit =
  100 mm, and every mount anchor's local **+Z is the direction a part is pulled
  out along**, so installing is always a slide from `+Z` to the origin.
- The motherboard owns its own child anchors (socket, DIMM slots, PCIe, M.2), so
  parts mounted on it inherit its placement automatically and form factors just
  work.
- A canvas-painted equirectangular environment map is generated at startup and
  run through `PMREMGenerator`. Without it every high-metalness surface — case
  panels, heatsinks, the CPU heatspreader — renders near-black.
