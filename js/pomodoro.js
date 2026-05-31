/* ============================================================
   pomodoro.js — Timer Pomodoro
   Anillo SVG, modos, sonido, estadísticas, historial
   ============================================================ */

'use strict';

/* ---- Pomodoro state ---- */
const POM = {
  mode:       'focus',   // 'focus' | 'short' | 'long'
  running:    false,
  interval:   null,
  totalSecs:  25 * 60,
  remaining:  25 * 60,
  session:    0,         // pomodoros completed in this run (0-3)
  circumference: 2 * Math.PI * 88, // r=88 → ≈ 553
};

/* ---- Config (minutes) ---- */
function getPomConfig() {
  return {
    focus: parseInt(el('cfgFocus')?.value || localStorage.getItem('ap_cfg_focus') || '25'),
    short: parseInt(el('cfgShort')?.value || localStorage.getItem('ap_cfg_short') || '5'),
    long:  parseInt(el('cfgLong')?.value  || localStorage.getItem('ap_cfg_long')  || '15'),
  };
}
function applyPomConfig() {
  const cfg = getPomConfig();
  localStorage.setItem('ap_cfg_focus', cfg.focus);
  localStorage.setItem('ap_cfg_short', cfg.short);
  localStorage.setItem('ap_cfg_long',  cfg.long);
  if (!POM.running) {
    POM.totalSecs   = cfg[POM.mode] * 60;
    POM.remaining   = POM.totalSecs;
    updatePomDisplay();
  }
}

/* ---- Mode ---- */
function setPomMode(mode, btn) {
  if (POM.running) { toast('Detén el timer antes de cambiar el modo'); return; }
  POM.mode = mode;
  document.querySelectorAll('.pom-mode').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const cfg = getPomConfig();
  POM.totalSecs = cfg[mode] * 60;
  POM.remaining = POM.totalSecs;
  updatePomDisplay();
  updateRing();
}

/* ---- Toggle start/pause ---- */
function togglePom() {
  if (POM.running) {
    pausePom();
  } else {
    startPom();
  }
}

function startPom() {
  POM.running = true;
  el('pomBtn').textContent = 'Pausar';
  el('pomState').textContent = POM.mode === 'focus' ? 'En sesión' : 'Descansando';
  POM.interval = setInterval(tickPom, 1000);
}

function pausePom() {
  POM.running = false;
  el('pomBtn').textContent = 'Reanudar';
  el('pomState').textContent = 'Pausado';
  clearInterval(POM.interval);
}

function resetPom() {
  clearInterval(POM.interval);
  POM.running   = false;
  POM.remaining = POM.totalSecs;
  el('pomBtn').textContent  = 'Iniciar';
  el('pomState').textContent = 'Listo';
  updatePomDisplay();
  updateRing();
}

function skipPom() {
  clearInterval(POM.interval);
  POM.running = false;
  handlePomEnd();
}

/* ---- Tick ---- */
function tickPom() {
  POM.remaining--;
  updatePomDisplay();
  updateRing();
  if (POM.remaining <= 0) {
    clearInterval(POM.interval);
    POM.running = false;
    handlePomEnd();
  }
}

/* ---- Session end ---- */
function handlePomEnd() {
  playPomSound();

  if (POM.mode === 'focus') {
    // Log the pomodoro
    DB.update('pom_log', log => {
      log.push({ ts: Date.now(), mode: 'focus', mins: getPomConfig().focus });
      return log;
    }, []);
    POM.session = (POM.session + 1) % 4;
    renderPomDots();
    renderPomStats();
    renderDashKPIs();

    const toast_msg = POM.session === 0 ? 'Completaste 4 pomodoros. Tómate un descanso largo.' : 'Pomodoro completado. Descansa un momento.';
    toast(toast_msg, 'success');

    // Auto switch to break
    if (POM.session === 0) {
      setPomMode('long', document.querySelector('.pom-mode:nth-child(3)'));
    } else {
      setPomMode('short', document.querySelector('.pom-mode:nth-child(2)'));
    }
  } else {
    // Break ended → go back to focus
    toast('Descanso terminado. ¡A estudiar!');
    setPomMode('focus', document.querySelector('.pom-mode:nth-child(1)'));
  }

  el('pomBtn').textContent = 'Iniciar';
  el('pomState').textContent = 'Listo';
}

/* ---- Display ---- */
function updatePomDisplay() {
  const m = String(Math.floor(POM.remaining / 60)).padStart(2, '0');
  const s = String(POM.remaining % 60).padStart(2, '0');
  if (el('pomTime')) el('pomTime').textContent = `${m}:${s}`;
  // Update page title
  document.title = POM.running ? `${m}:${s} — Academic Planner` : 'Academic Planner';
}

function updateRing() {
  const ring = el('pomRing');
  if (!ring) return;
  const progress = POM.remaining / POM.totalSecs;
  const offset   = POM.circumference * (1 - progress);
  ring.style.strokeDashoffset = offset;

  // Color: green while working, blue on break
  ring.style.stroke = POM.mode === 'focus'
    ? (POM.remaining < 300 ? 'var(--red)' : 'var(--text-1)')
    : 'var(--green)';
}

/* ---- Session dots ---- */
function renderPomDots() {
  const dotsEl = el('pomDots');
  if (!dotsEl) return;
  dotsEl.innerHTML = Array.from({length:4}, (_,i) =>
    `<div class="pom-dot ${i < POM.session ? 'done' : ''}"></div>`
  ).join('');
}

/* ---- Stats ---- */
function renderPomStats() {
  const log    = DB.get('pom_log', []);
  const today  = new Date().toDateString();
  const todayLog = log.filter(p => new Date(p.ts).toDateString() === today);
  const focusCfg = getPomConfig().focus;

  // Week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekLog = log.filter(p => new Date(p.ts) >= weekStart);

  const statsEl = el('pomStatRows');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-row"><span class="stat-row-label">Pomodoros hoy</span><span class="stat-row-value">${todayLog.length}</span></div>
      <div class="stat-row"><span class="stat-row-label">Tiempo de enfoque</span><span class="stat-row-value">${todayLog.length * focusCfg} min</span></div>
      <div class="stat-row"><span class="stat-row-label">Esta semana</span><span class="stat-row-value">${weekLog.length} pom · ${Math.round(weekLog.length*focusCfg/60*10)/10}h</span></div>
      <div class="stat-row"><span class="stat-row-label">Total histórico</span><span class="stat-row-value">${log.length}</span></div>
    `;
  }

  // Log
  const logEl = el('pomLog');
  if (logEl) {
    const recent = [...log].reverse().slice(0, 15);
    if (!recent.length) {
      logEl.innerHTML = '<div class="empty-msg">Sin sesiones aún</div>';
    } else {
      logEl.innerHTML = recent.map(p => {
        const d  = new Date(p.ts);
        const time = d.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
        const date = d.toDateString() === today ? 'Hoy' : d.toLocaleDateString('es-ES', {day:'numeric',month:'short'});
        return `<div class="pom-log-item">
          <span style="color:var(--text-3)">${date} ${time}</span>
          <span>${p.mins || focusCfg} min enfoque</span>
        </div>`;
      }).join('');
    }
  }
}

/* ---- Sound (Web Audio API) ---- */
function playPomSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const notes = POM.mode === 'focus' ? [523, 659, 784] : [784, 659, 523]; // C E G ascending/descending

    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.18 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.5);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.6);
    });
  } catch(e) {
    // Audio not available
  }
}

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  // Load saved config
  const cfg = getPomConfig();
  if (el('cfgFocus')) el('cfgFocus').value = cfg.focus;
  if (el('cfgShort')) el('cfgShort').value = cfg.short;
  if (el('cfgLong'))  el('cfgLong').value  = cfg.long;

  POM.totalSecs = cfg.focus * 60;
  POM.remaining = POM.totalSecs;
  POM.circumference = 2 * Math.PI * 88;

  updatePomDisplay();
  updateRing();
  renderPomDots();
  renderPomStats();

  // Set ring dasharray
  const ring = el('pomRing');
  if (ring) ring.style.strokeDasharray = POM.circumference;
});