// ui.js — all DOM rendering. Reads state, calls back into main.js for actions.

import { CATS, CAT, partsIn, money, specTags } from './catalog.js';
import { conflicts, hasErrors, estimateDraw, readiness, requiredCables, CABLE_LABEL } from './compat.js';

const $ = s => document.querySelector(s);
export const el = {
  budget: $('#mBudget'), spent: $('#mSpent'), left: $('#mLeft'), cLeft: $('#cLeft'),
  steps: $('#steps'), tabs: $('#tabs'), shopList: $('#shopList'), shopCount: $('#shopCount'),
  buildList: $('#buildList'), issues: $('#issues'), wattTag: $('#wattTag'),
  tray: $('#tray'), hint: $('#hint'), toasts: $('#toasts'), tip: $('#tip'),
  modal: $('#modal'), sheet: $('#sheet'), boot: $('#boot'),
  power: $('#bPower'), reset: $('#bReset'), help: $('#bHelp'),
};

let hooks = {};
export function init(h) {
  hooks = h;
  el.tabs.addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (t) hooks.setTab(t.dataset.cat);
  });
  el.shopList.addEventListener('click', e => {
    const c = e.target.closest('.card');
    if (c) hooks.buy(c.dataset.id);
  });
  el.tray.addEventListener('click', e => {
    const t = e.target.closest('.titem');
    if (t && !t.classList.contains('locked')) hooks.hold(t.dataset.uid);
    else if (t) toast(t.dataset.why || 'Install its prerequisites first.', 'err');
  });
  el.buildList.addEventListener('click', e => {
    const r = e.target.closest('.brow');
    if (r) hooks.focusCat(r.dataset.cat);
  });
  el.modal.addEventListener('click', e => { if (e.target === el.modal) closeModal(); });
  initRepairUI();
}

/* ---------------------------------------------------------------- top bar */
export function renderTop(state) {
  const left = state.budget - state.spent;
  el.budget.textContent = money(state.budget);
  el.spent.textContent = money(state.spent);
  el.left.textContent = money(left);
  el.cLeft.className = 'chip ' + (left < 0 ? 'bad' : 'ok');

  el.steps.innerHTML = CATS.filter(c => c.required).map(c => {
    const done = !!state.installed[c.id];
    const next = !done && c.needs.every(n => state.installed[n]);
    return `<div class="step ${done ? 'done' : next ? 'now' : ''}">${c.label}</div>`;
  }).join('');

  const ready = readiness(state);
  el.power.disabled = ready.length > 0;
  el.power.title = ready.length ? 'Still to do: ' + ready.join(', ') : 'Boot the machine';
}

/* ---------------------------------------------------------------- store */
export function renderShop(state) {
  el.tabs.innerHTML = CATS.map(c => {
    const owned = state.owned.some(o => o.cat === c.id);
    return `<button class="tab ${state.tab === c.id ? 'active' : ''}" data-cat="${c.id}">
      ${c.label}${owned ? '<i class="dot"></i>' : ''}</button>`;
  }).join('');

  // compare against everything owned, not just what's already screwed in,
  // so the store warns you before you buy the mismatched part
  const build = ownedBuild(state);
  const list = partsIn(state.tab);
  el.shopCount.textContent = list.length + ' items';

  el.shopList.innerHTML = list.map(p => {
    const isOwned = state.owned.some(o => o.id === p.id);
    const cf = conflicts(p, { ...build, [p.cat]: null });
    const bad = hasErrors(cf);
    const afford = state.budget - state.spent >= p.price || isOwned;
    return `<div class="card ${isOwned ? 'owned' : ''} ${bad ? 'bad' : ''}" data-id="${p.id}">
      <div class="br">${p.brand}</div>
      <div class="nm">${p.name}</div>
      <div class="pr" style="color:${afford ? 'var(--txt)' : 'var(--red)'}">${money(p.price)}</div>
      <div class="sp">${specTags(p).map(t => `<span class="tag">${t}</span>`).join('')}</div>
      ${cf.length ? `<div class="warn" style="color:${bad ? 'var(--red)' : 'var(--amber)'}">
        ${cf.map(c => '⚠ ' + c.text).join('<br>')}</div>` : ''}
      ${isOwned ? '<div class="badge">Owned</div>' : ''}
    </div>`;
  }).join('') || '<div class="empty">Nothing here.</div>';
}

/* ---------------------------------------------------------------- build panel */
export function renderBuild(state) {
  const build = ownedBuild(state);
  const draw = estimateDraw(build);
  el.wattTag.textContent = draw ? `~${draw} W` : '— W';
  el.wattTag.className = 'tag' + (build.psu && draw > build.psu.watts ? '' : ' hi');

  el.buildList.innerHTML = CATS.map(c => {
    const inst = state.installed[c.id];
    const own = state.owned.find(o => o.cat === c.id);
    const part = inst || own;
    const cls = inst ? 'has' : own ? 'pend' : '';
    return `<div class="brow ${cls}" data-cat="${c.id}">
      <div class="ic">${c.glyph}</div>
      <div class="tx"><b>${c.label}</b><span>${part ? part.name : '—'}</span></div>
      <div class="st">${inst ? 'IN' : own ? 'TRAY' : c.required ? 'NEED' : 'OPT'}</div>
    </div>`;
  }).join('');

  // ---- issues feed
  const items = [];
  for (const c of CATS) {
    const p = state.installed[c.id] || state.owned.find(o => o.cat === c.id);
    if (!p) continue;
    for (const x of conflicts(p, { ...build, [c.id]: null }))
      items.push({ level: x.level, text: `<b>${p.name}</b> — ${x.text}` });
  }
  const cablesNeeded = requiredCables(state);
  for (const [k, need] of Object.entries(cablesNeeded))
    if (need && !state.cables[k])
      items.push({ level: 'inf', text: `Connect the <b>${CABLE_LABEL[k]}</b> cable.` });

  if (!items.length) {
    const ready = readiness(state);
    if (!ready.length) items.push({ level: 'ok', text: 'Everything checks out. Hit <b>Power On</b>.' });
    else items.push({ level: 'inf', text: 'Next: <b>' + ready[0] + '</b>.' });
  }
  const icon = { err: '✕', wrn: '!', inf: 'i', ok: '✓' };
  el.issues.innerHTML = items.map(i =>
    `<div class="iss ${i.level}"><span class="k">${icon[i.level]}</span><div>${i.text}</div></div>`).join('');
}

/* ---------------------------------------------------------------- tray */
export function renderTray(state) {
  const pend = state.owned.filter(o => !o.installedAt);
  if (!pend.length) { el.tray.classList.add('hidden'); return; }
  el.tray.classList.remove('hidden');
  el.tray.innerHTML = '<div class="trayLbl">Tray</div>' + pend.map(o => {
    const c = CAT[o.cat];
    const missing = c.needs.filter(n => !state.installed[n]);
    const locked = missing.length > 0;
    const why = locked ? `Install the ${missing.map(m => CAT[m].label).join(' + ')} first.` : '';
    return `<div class="titem ${state.held === o.uid ? 'held' : ''} ${locked ? 'locked' : ''}"
      data-uid="${o.uid}" data-why="${why}" title="${o.name}">
      <div class="g">${c.glyph}</div><div class="c">${c.label}</div>
      <div class="n">${o.name}</div></div>`;
  }).join('');
}

/* ---------------------------------------------------------------- misc */
export function setHint(html) { el.hint.innerHTML = html; }

let toastTimer = [];
export function toast(msg, kind = 'inf', ms = 3200) {
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  d.innerHTML = msg;
  el.toasts.appendChild(d);
  const t = setTimeout(() => {
    d.style.transition = 'opacity .3s,transform .3s';
    d.style.opacity = 0; d.style.transform = 'translateY(-8px)';
    setTimeout(() => d.remove(), 320);
  }, ms);
  toastTimer.push(t);
  while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
}

export function showTip(x, y, title, lines) {
  el.tip.innerHTML = `<b>${title}</b>${lines.map(l => `<i>${l}</i>`).join('<br>')}`;
  const r = el.tip.getBoundingClientRect();
  el.tip.style.left = Math.min(x + 16, window.innerWidth - r.width - 12) + 'px';
  el.tip.style.top = Math.max(60, y - r.height - 12) + 'px';
  el.tip.classList.add('on');
}
export function hideTip() { el.tip.classList.remove('on'); }

export function closeModal() { el.modal.classList.remove('on'); }
export function openModal(html) { el.sheet.innerHTML = html; el.modal.classList.add('on'); }

/* ---------------------------------------------------------------- results */
const GRADE_COLOR = { S: '#8bff6a', A: '#8bff6a', B: '#38e8ff', C: '#ffc247', D: '#ff9a47', F: '#ff5a5a' };

export function showResults(r, state) {
  const bar = (v, col) => `<div class="bar"><i style="width:${Math.max(2, Math.min(100, v))}%;background:${col}"></i></div>`;
  const maxFps = Math.max(...r.fps.map(f => f.fps));
  openModal(`
    <div class="hd">
      <div class="grade" style="color:${GRADE_COLOR[r.grade]}">${r.grade}</div>
      <div>
        <h1>${r.grade === 'F' ? 'It runs. Barely.' : r.grade === 'S' ? 'Exceptional build.' : 'Build complete'}</h1>
        <p>Overall score <b style="color:${GRADE_COLOR[r.grade]}">${r.overall}</b>/100 · ${money(r.price)} spent · ${r.draw} W under load</p>
      </div>
    </div>
    <div class="bd">
      <div class="mets">
        <div class="met"><span>Performance</span><b style="color:#38e8ff">${r.perfScore}</b>${bar(r.perfScore, '#38e8ff')}</div>
        <div class="met"><span>Thermals</span><b style="color:${r.cpuTemp > 90 ? '#ff5a5a' : '#8bff6a'}">${r.cpuTemp}°C</b><i>CPU · GPU ${r.gpuTemp}°C</i>${bar(r.thermScore, r.thermScore > 60 ? '#8bff6a' : '#ff5a5a')}</div>
        <div class="met"><span>Noise</span><b style="color:#ffc247">${r.noise} dB</b><i>${r.noise < 32 ? 'quiet' : r.noise < 42 ? 'audible' : 'loud'}</i>${bar(r.quietScore, '#ffc247')}</div>
        <div class="met"><span>Value</span><b style="color:#ff4d9d">${r.valueScore}</b><i>perf per dollar</i>${bar(r.valueScore, '#ff4d9d')}</div>
        <div class="met"><span>Balance</span><b>${r.balance}</b><i>CPU vs GPU</i>${bar(r.balance, '#9d7bff')}</div>
        <div class="met"><span>Looks</span><b>${r.looks}</b><i>RGB &amp; glass</i>${bar(r.looks, '#4dd6ff')}</div>
      </div>

      <div class="sect">Benchmark — average FPS at 1440p</div>
      ${r.fps.map(f => `<div class="fpsrow">
        <div class="gm">${f.name}</div>
        ${bar(f.fps / maxFps * 100, f.fps > 100 ? '#8bff6a' : f.fps > 55 ? '#38e8ff' : '#ffc247')}
        <div class="vl">${f.fps} fps</div></div>`).join('')}

      <div class="sect">Analysis</div>
      <div class="notes"><ul>${r.notes.map(n => `<li>${n}</li>`).join('')}</ul></div>
    </div>
    <div class="ft">
      <button class="btn" data-act="close">Keep tinkering</button>
      <button class="btn primary" data-act="new">New build</button>
    </div>`);
  wireSheet(state);
}

export function showPostFailure(fail) {
  openModal(`
    <div class="hd">
      <div class="grade" style="color:#ff5a5a">✕</div>
      <div><h1>It didn't POST</h1><p>${fail.code.replace(/_/g, ' ')}</p></div>
    </div>
    <div class="bd"><div class="notes">${fail.msg}</div>
      <div class="sect">What now</div>
      <div class="notes">Swap the offending part in the store, then hit Power On again.
      Nothing is broken permanently — this is a simulator, and that is the entire point of one.</div>
    </div>
    <div class="ft"><button class="btn primary" data-act="close">Back to the build</button></div>`);
  wireSheet();
}

function wireSheet(state) {
  el.sheet.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
    closeModal();
    if (b.dataset.act === 'new') hooks.reset();
  }));
}

export function showHelp(mode = 'build') {
  if (mode === 'repair') return showRepairHelp();
  openModal(`
    <div class="hd"><div class="grade" style="color:#38e8ff">?</div>
      <div><h1>How to build a PC</h1><p>Buy parts, install them in order, connect power, boot.</p></div></div>
    <div class="bd">
      <div class="sect">Controls</div>
      <div class="notes">
        <li><b>Drag</b> to orbit · <b>scroll</b> to zoom · <b>right-drag</b> to pan</li>
        <li><b>Click a part in the tray</b> to pick it up, then click the glowing slot</li>
        <li><b>Hover any installed part</b> for its spec sheet</li>
        <li>The view buttons on the right jump to a preset angle and toggle the side panel</li>
      </div>
      <div class="sect">Build order</div>
      <div class="notes">
        The sim enforces real dependencies: the case comes first, then the power supply and
        motherboard, then the CPU onto the board, the cooler onto the CPU, memory, graphics card
        and storage. Finally, click each glowing connector to run the power cables.
        <br><br>(In real life you would seat the CPU, cooler and RAM <b>before</b> the board goes
        in the case — much easier to reach. Here the board goes in first so you can watch it happen.)
      </div>
      <div class="sect">What the sim actually checks</div>
      <div class="notes">
        <li>CPU socket vs board socket · DDR4 vs DDR5 · board form factor vs case</li>
        <li>GPU length and cooler height vs case clearance</li>
        <li>Radiator size vs available mounts</li>
        <li>PSU wattage vs sustained draw, with headroom for transients</li>
        <li>Cooler capacity vs CPU TDP — undercool it and it throttles in the benchmark</li>
        <li>Case airflow, VRM quality, memory speed, PCIe generation</li>
      </div>
    </div>
    <div class="ft"><button class="btn primary" data-act="close">Got it</button></div>`);
  wireSheet();
}

/* ---------------------------------------------------------------- boot screen */
export function runBoot(lines, onDone) {
  el.boot.classList.add('on');
  el.boot.textContent = '';
  let i = 0;
  const step = () => {
    if (i >= lines.length) {
      setTimeout(() => { el.boot.classList.remove('on'); onDone(); }, 700);
      return;
    }
    const [txt, delay] = lines[i++];
    el.boot.textContent += txt + '\n';
    el.boot.scrollTop = el.boot.scrollHeight;
    setTimeout(step, delay);
  };
  setTimeout(step, 260);
}

/* ================================================================ repair shop */

const rEl = {
  queue: $('#rqueue'), stats: $('#rstats'), job: $('#rjob'),
  tools: $('#rtools'), findings: $('#rfindings'), work: $('#rwork'),
  foot: $('#rfoot'),
};

let repairHooks = {};

export function setBusy(text) {
  const b = $('#busy');
  if (!b) return;
  b.textContent = text || '';
  b.classList.toggle('on', !!text);
}

export function renderRepair(shop, hooks, machine) {
  repairHooks = hooks;
  if (!rEl.queue) return;

  // ---- shop stats
  rEl.stats.innerHTML = `
    <div class="stat"><b>${money(shop.cash)}</b><span>Till</span></div>
    <div class="stat"><b>${shop.reputation}</b><span>Rep</span></div>
    <div class="stat"><b>${shop.tickets.filter(t => !t.closed).length}</b><span>Waiting</span></div>`;

  // ---- job queue
  const open = shop.tickets.filter(t => !t.closed);
  rEl.queue.innerHTML = open.map(t => {
    const active = shop.ticket && shop.ticket.id === t.id;
    const m = t.machineSpecs;
    return `<div class="job ${active ? 'active' : ''}" data-ticket="${t.id}">
      <div class="jhead"><b>#${t.id} ${t.customer}</b><span class="pr">${money(t.quote)}</span></div>
      <div class="jrush ${t.patience.id}">${t.patience.label} · ${t.patience.note}</div>
      <div class="jsay">“${t.complaint}”</div>
      <div class="sp"><span class="tag">${m.cpu.name}</span><span class="tag">${m.gpu.name}</span></div>
      ${active ? '<div class="badge">On the bench</div>' : ''}
    </div>`;
  }).join('') || '<div class="empty">No jobs waiting. Nice work.</div>';

  const t = shop.ticket;
  if (!t) {
    rEl.job.innerHTML = '<div class="empty">Pick a job from the queue to bring it to the bench.</div>';
    rEl.tools.innerHTML = ''; rEl.findings.innerHTML = ''; rEl.work.innerHTML = '';
    rEl.foot.innerHTML = '';
    return;
  }

  // ---- open work order
  rEl.job.innerHTML = `
    <div class="jhead"><b>#${t.id} ${t.customer}</b><span class="pr">${money(t.quote)}</span></div>
    <div class="jsay">“${t.complaint}”</div>`;

  // ---- diagnostics
  rEl.tools.innerHTML = TOOL_DEFS.map(tool => {
    const used = t.toolsUsed.includes(tool.id);
    return `<button class="tool ${used ? 'used' : ''}" data-tool="${tool.id}"
      title="${tool.hint}"><span>${tool.glyph}</span>${tool.label}</button>`;
  }).join('');

  const findings = Object.entries(shop.findings);
  rEl.findings.innerHTML = findings.length
    ? findings.map(([k, v]) =>
      `<div class="finding"><span class="flabel">${toolLabel(k)}</span><div>${v}</div></div>`).join('')
    : '<div class="empty small">No readings yet. Start with a bench test or a visual inspection.</div>';

  // ---- repair actions per component
  const cats = ['psu', 'mobo', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'fans'];
  rEl.work.innerHTML = cats.map(cat => {
    const spec = t.machineSpecs[cat];
    if (!spec) return '';
    const done = t.repairsDone.filter(r => r.target === cat);
    const acts = hooks.repairsFor(cat);
    return `<div class="wrow">
      <div class="whead"><b>${hooks.labelFor(cat)}</b><span>${spec.name}</span></div>
      <div class="wacts">${acts.map(a => `<button class="wbtn" data-cat="${cat}" data-act="${a.id}">
        ${a.label}${a.cost ? ` <i>${money(a.cost)}</i>` : ''}</button>`).join('')}</div>
      ${done.length ? `<div class="wdone">${done.map(d => '✓ ' + d.note).join('<br>')}</div>` : ''}
    </div>`;
  }).join('');

  const anyWork = t.repairsDone.length > 0;
  rEl.foot.innerHTML = `
    <div class="tally">Parts fitted: <b>${money(t.partsCost)}</b> · Labour quoted: <b>${money(t.quote)}</b></div>
    <button class="btn primary wide" id="rclose" ${anyWork ? '' : 'disabled'}>Return to customer &amp; invoice</button>`;
}

const TOOL_DEFS = [
  { id: 'inspect', label: 'Inspect', glyph: '🔍', hint: 'Look closely at each component for physical damage.' },
  { id: 'power', label: 'Bench test', glyph: '⏻', hint: 'Press the power button and see what happens.' },
  { id: 'multimeter', label: 'Multimeter', glyph: '🔌', hint: 'Probe the PSU rails for voltage.' },
  { id: 'thermal', label: 'Thermal', glyph: '🌡', hint: 'Read component temperatures under load.' },
  { id: 'software', label: 'Diagnostics', glyph: '💾', hint: 'Memtest, SMART and the event log.' },
];
const toolLabel = id => (TOOL_DEFS.find(t => t.id === id) || { label: id }).label;

/** Delegated handlers for the repair panels. */
export function initRepairUI() {
  if (!rEl.queue) return;
  rEl.queue.addEventListener('click', e => {
    const j = e.target.closest('.job');
    if (j) repairHooks.openTicket?.(j.dataset.ticket);
  });
  rEl.tools.addEventListener('click', e => {
    const b = e.target.closest('.tool');
    if (b) repairHooks.useTool?.(b.dataset.tool);
  });
  rEl.work.addEventListener('click', e => {
    const b = e.target.closest('.wbtn');
    if (!b) return;
    if (b.dataset.act === 'replace') showReplacePicker(b.dataset.cat);
    else repairHooks.doRepair?.(b.dataset.cat, b.dataset.act);
  });
  rEl.foot.addEventListener('click', e => {
    if (e.target.closest('#rclose')) repairHooks.closeTicket?.();
  });
}

function showReplacePicker(cat) {
  const list = repairHooks.replacementsFor(cat);
  openModal(`
    <div class="hd"><div class="grade" style="color:#38e8ff">⟳</div>
      <div><h1>Fit a replacement ${repairHooks.labelFor(cat).toLowerCase()}</h1>
      <p>Parts come out of the till. You only bill the customer if it was actually the fault.</p></div></div>
    <div class="bd">
      ${list.map(p => `<div class="card" data-swap="${p.id}">
        <div class="br">${p.brand}</div><div class="nm">${p.name}</div>
        <div class="pr">${money(p.price)}</div>
        <div class="sp">${specTags(p).map(s => `<span class="tag">${s}</span>`).join('')}</div>
      </div>`).join('')}
    </div>
    <div class="ft"><button class="btn" data-act="close">Cancel</button></div>`);
  el.sheet.querySelectorAll('[data-swap]').forEach(c => c.addEventListener('click', () => {
    closeModal();
    repairHooks.doRepair?.(cat, 'replace', c.dataset.swap);
  }));
  el.sheet.querySelectorAll('[data-act="close"]').forEach(b =>
    b.addEventListener('click', closeModal));
}

export function showRepairInvoice(ticket, r, onDone) {
  const good = r.resolved;
  const col = good ? (r.waste.length ? '#ffc247' : '#8bff6a') : '#ff5a5a';
  openModal(`
    <div class="hd">
      <div class="grade" style="color:${col}">${good ? (r.waste.length ? '~' : '✓') : '✕'}</div>
      <div><h1>${r.verdict}</h1>
        <p>Job #${ticket.id} · ${ticket.customer} · ${r.fault.name}</p></div>
    </div>
    <div class="bd">
      <div class="mets">
        <div class="met"><span>Invoiced</span><b style="color:#8bff6a">${money(r.revenue)}</b>
          <i>labour ${money(r.labour)} + parts ${money(r.partsBilled)}</i></div>
        <div class="met"><span>Your costs</span><b style="color:#ff9a47">${money(r.costs)}</b>
          <i>${ticket.partsFitted.length} part(s) fitted</i></div>
        <div class="met"><span>Profit</span><b style="color:${r.profit >= 0 ? '#38e8ff' : '#ff5a5a'}">${money(r.profit)}</b></div>
        <div class="met"><span>Reputation</span><b style="color:${r.rep >= 0 ? '#8bff6a' : '#ff5a5a'}">${r.rep >= 0 ? '+' : ''}${r.rep}</b></div>
      </div>

      <div class="sect">The actual fault</div>
      <div class="notes"><b>${r.fault.name}.</b> ${r.fault.visual || r.fault.probe.software}</div>

      ${r.waste.length ? `<div class="sect">Work that wasn't needed</div>
        <div class="notes">${r.waste.map(w => `<li>${w.note}${w.cost ? ` — ${money(w.cost)} out of your pocket` : ''}</li>`).join('')}</div>` : ''}

      <div class="sect">Takeaway</div>
      <div class="notes">${r.fault.lesson}</div>
    </div>
    <div class="ft"><button class="btn primary" data-act="next">Next job</button></div>`);
  el.sheet.querySelectorAll('[data-act="next"]').forEach(b => b.addEventListener('click', () => {
    closeModal(); onDone();
  }));
}

function showRepairHelp() {
  openModal(`
    <div class="hd"><div class="grade" style="color:#38e8ff">?</div>
      <div><h1>Running the repair bay</h1><p>Diagnose first. Replacing parts costs you money.</p></div></div>
    <div class="bd">
      <div class="sect">The loop</div>
      <div class="notes">
        <li>Take a job from the queue — the customer's machine appears on the bench</li>
        <li>Use the diagnostic tools to gather evidence</li>
        <li>Perform the repair you think fixes it</li>
        <li>Return it to the customer and settle the invoice</li>
      </div>
      <div class="sect">The tools</div>
      <div class="notes">
        <li><b>Inspect</b> — click each component in 3D to look it over. Physical damage
          (dust, bulged caps, scorching, a loose plug) is only visible this way.</li>
        <li><b>Bench test</b> — power it up and see how far it gets. Dead, no display,
          unstable under load, or fine.</li>
        <li><b>Multimeter</b> — PSU rail voltages. Separates a dead supply from a dead board.</li>
        <li><b>Thermal</b> — where the heat is. A scorching chip under a cold heatsink is a
          contact problem, not a cooling capacity problem.</li>
        <li><b>Diagnostics</b> — memtest, SMART and the event log, for faults with nothing to see.</li>
      </div>
      <div class="sect">How you get paid</div>
      <div class="notes">
        You are paid the quoted labour <b>only if the machine actually leaves fixed</b>.
        Parts you fit come out of the till up front; you bill them back only on a successful
        repair. Anything you replaced that was not the problem, you eat — in cash and in
        reputation. Swapping parts until something works is the expensive way to do this job.
      </div>
    </div>
    <div class="ft"><button class="btn primary" data-act="close">Got it</button></div>`);
  el.sheet.querySelectorAll('[data-act="close"]').forEach(b =>
    b.addEventListener('click', closeModal));
}

/* ---------------------------------------------------------------- helper */
export function buildOf(state) {
  const b = {};
  for (const c of CATS) b[c.id] = state.installed[c.id] || null;
  b.price = state.spent;
  return b;
}

export function ownedBuild(state) {
  const b = {};
  for (const c of CATS) b[c.id] = state.owned.find(o => o.cat === c.id) || null;
  b.price = state.spent;
  return b;
}
