/* ============================================================
   app.js — Núcleo de la aplicación
   Maneja: navegación, tema, localStorage, modales, toasts, perfil
   ============================================================ */

'use strict';

/* ---- Estado global ---- */
const APP = {
  currentPage: 'dashboard',
  theme: localStorage.getItem('ap_theme') || 'light',
  taskFilter: 'all',
};

/* ---- Colores por materia ---- */
const SUBJECT_COLORS = {
  blue:   '#3B82F6',
  indigo: '#6366F1',
  violet: '#8B5CF6',
  green:  '#10B981',
  teal:   '#0D9488',
  orange: '#F97316',
  rose:   '#F43F5E',
};

/* ---- DB helpers (localStorage) ---- */
const DB = {
  get:    (key, def = []) => JSON.parse(localStorage.getItem('ap_' + key) ?? JSON.stringify(def)),
  set:    (key, val)       => localStorage.setItem('ap_' + key, JSON.stringify(val)),
  update: (key, fn, def=[])=> { const v = DB.get(key, def); DB.set(key, fn(v)); return DB.get(key, def); },
};

/* ---- Toast ---- */
function toast(msg, type = '') {
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---- Modal helpers ---- */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Close modal on backdrop click
document.querySelectorAll('.modal-bg').forEach(bg => {
  bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
});

/* ---- Navigation ---- */
function navigate(page) {
  // Deactivate all
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Activate target
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  APP.currentPage = page;

  // Mobile: update topbar title
  const titles = {
    dashboard: 'Dashboard',
    tasks:     'Tareas',
    grades:    'Notas',
    pomodoro:  'Pomodoro',
    calendar:  'Calendario',
    profile:   'Perfil',
  };
  const topbarTitle = document.getElementById('topbarTitle');
  if (topbarTitle) topbarTitle.textContent = titles[page] || '';

  // Close mobile sidebar
  closeSidebar();

  // Refresh page data
  if (page === 'dashboard') renderDashboard();
  if (page === 'tasks')     renderTasks();
  if (page === 'grades')    renderGrades();
  if (page === 'pomodoro')  renderPomStats();
  if (page === 'calendar')  renderCalendar();
  if (page === 'profile')   renderProfile();
}

/* ---- Mobile sidebar ---- */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

/* ---- Theme ---- */
function toggleTheme() {
  APP.theme = APP.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  localStorage.setItem('ap_theme', APP.theme);
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', APP.theme);
  const isDark = APP.theme === 'dark';
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon)  icon.innerHTML = isDark
    ? `<path d="M7.5 1a6.5 6.5 0 1 0 6.5 6.5A5 5 0 0 1 7.5 1z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>`
    : `<path d="M7.5 1v1M7.5 13v1M1 7.5H2M13 7.5h1M3.2 3.2l.7.7M11.1 11.1l.7.7M3.2 11.8l.7-.7M11.1 4.4l.7-.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="7.5" cy="7.5" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/>`;
  if (label) label.textContent = isDark ? 'Modo claro' : 'Modo oscuro';
}

/* ---- Greeting ---- */
function renderGreeting() {
  const now = new Date();
  const h   = now.getHours();
  const gr  = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  const profile = DB.get('profile', {});
  const firstName = (profile.name || '').split(' ')[0];
  const grEl = document.getElementById('greetingText');
  if (grEl) grEl.textContent = firstName ? `${gr}, ${firstName}` : gr;

  const dateEl = document.getElementById('greetingDate');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }
}

/* ---- Dashboard ---- */
function renderDashboard() {
  renderGreeting();
  renderDashKPIs();
  renderDashTasks();
  renderDashExams();
  renderDashSubjects();
  renderDashWeekly();
}

function renderDashKPIs() {
  const tasks    = DB.get('tasks');
  const pending  = tasks.filter(t => !t.done).length;
  const grades   = DB.get('grades');
  const subjects = DB.get('subjects');
  const pomData  = DB.get('pom_log', []);
  const today    = new Date().toDateString();
  const todayPom = pomData.filter(p => new Date(p.ts).toDateString() === today).length;
  const todayMin = todayPom * parseInt(localStorage.getItem('ap_cfg_focus') || '25');

  // Pending tasks
  el('kpiPending').textContent = pending;
  el('kpiPendingSub').textContent = `${tasks.filter(t=>t.done).length} completadas`;

  // Overall average
  const avg = calcOverallAvg(subjects, grades);
  el('kpiAvg').textContent = avg !== null ? avg.toFixed(1) : '–';
  el('kpiAvgSub').textContent = avg !== null ? `${subjects.length} materia${subjects.length!==1?'s':''}` : 'Sin notas';

  // Pomodoros
  el('kpiPomodoros').textContent = todayPom;
  el('kpiPomSub').textContent = `${todayMin} min de enfoque`;

  // Next exam
  const events = DB.get('events');
  const exams  = events
    .filter(ev => ev.type === 'exam' && new Date(ev.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (exams.length) {
    const diff = Math.ceil((new Date(exams[0].date) - new Date()) / 86400000);
    el('kpiNextExam').textContent = diff === 0 ? 'Hoy' : `${diff}d`;
    el('kpiNextExamSub').textContent = exams[0].title;
  } else {
    el('kpiNextExam').textContent = '–';
    el('kpiNextExamSub').textContent = 'Sin exámenes';
  }

  // Badge
  const badge = document.getElementById('navBadgeTasks');
  if (badge) badge.textContent = pending;
}

function renderDashTasks() {
  const tasks   = DB.get('tasks').filter(t => !t.done).slice(0, 5);
  const subjects = DB.get('subjects');
  const wrap    = el('dashTasks');
  if (!wrap) return;
  if (!tasks.length) { wrap.innerHTML = '<div class="empty-msg">Sin tareas pendientes</div>'; return; }

  wrap.innerHTML = tasks.map(t => {
    const subj = subjects.find(s => s.id === t.subjectId);
    const color = subj ? SUBJECT_COLORS[subj.color] : 'var(--text-3)';
    return `<div class="dash-task-row">
      <div class="dash-task-dot" style="background:${color}"></div>
      <span class="dash-task-name">${esc(t.title)}</span>
      <span class="tag tag-${t.priority} dash-task-pri">${t.priority}</span>
    </div>`;
  }).join('');
}

function renderDashExams() {
  const events = DB.get('events');
  const subjects = DB.get('subjects');
  const exams  = events
    .filter(ev => ev.type === 'exam' && new Date(ev.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  const wrap = el('dashExams');
  if (!wrap) return;
  if (!exams.length) { wrap.innerHTML = '<div class="empty-msg">Sin exámenes próximos</div>'; return; }

  wrap.innerHTML = exams.map(ev => {
    const subj  = subjects.find(s => s.id === ev.subjectId);
    const color = subj ? SUBJECT_COLORS[subj.color] : 'var(--text-3)';
    const diff  = Math.ceil((new Date(ev.date) - new Date()) / 86400000);
    const daysLabel = diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : `${diff}d`;
    const tagColor  = diff <= 3 ? 'var(--red-bg);color:var(--red)' : diff <= 7 ? 'var(--amber-bg);color:var(--amber)' : 'var(--green-bg);color:var(--green)';
    return `<div class="exam-row">
      <div class="exam-dot" style="background:${color}"></div>
      <span class="exam-name">${esc(ev.title)}</span>
      <span class="exam-date">${formatDate(ev.date)}</span>
      <span class="exam-days-tag" style="background:${tagColor}">${daysLabel}</span>
    </div>`;
  }).join('');
}

function renderDashSubjects() {
  const subjects = DB.get('subjects');
  const grades   = DB.get('grades');
  const wrap     = el('dashSubjects');
  if (!wrap) return;
  if (!subjects.length) { wrap.innerHTML = '<div class="empty-msg">Agrega materias y notas</div>'; return; }

  wrap.innerHTML = subjects.map(s => {
    const avg  = calcSubjectAvg(s.id, grades);
    const color = SUBJECT_COLORS[s.color] || '#888';
    const pct   = avg !== null ? Math.min((avg / 10) * 100, 100) : 0;
    return `<div class="subj-row">
      <div class="subj-color-dot" style="background:${color}"></div>
      <span class="subj-name">${esc(s.name)}</span>
      <span class="subj-avg">${avg !== null ? avg.toFixed(1) : '–'}</span>
      <div class="subj-prog-wrap">
        <div class="prog-wrap"><div class="prog-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>
    </div>`;
  }).join('');
}

function renderDashWeekly() {
  const pomLog   = DB.get('pom_log', []);
  const focusMins = parseInt(localStorage.getItem('ap_cfg_focus') || '25');
  const days     = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const today    = new Date();
  const dayOfWeek = today.getDay();

  // Build last 7 days
  const weekData = Array.from({length: 7}, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const count = pomLog.filter(p => new Date(p.ts).toDateString() === d.toDateString()).length;
    return { label: days[d.getDay()], count, isToday: d.toDateString() === today.toDateString() };
  });

  const max = Math.max(...weekData.map(d => d.count), 1);
  const wrap = el('dashWeekly');
  if (!wrap) return;

  if (weekData.every(d => d.count === 0)) {
    wrap.innerHTML = '<div class="empty-msg">Usa el Pomodoro para registrar sesiones</div>';
    return;
  }

  wrap.innerHTML = `<div class="week-chart">
    ${weekData.map(d => `
      <div class="week-bar-wrap">
        <div class="week-bar-track" title="${d.count} pom (${d.count*focusMins} min)">
          <div class="week-bar-fill${d.isToday?' today':''}" style="height:${(d.count/max)*100}%"></div>
        </div>
        <div class="week-day-label">${d.label}</div>
      </div>`).join('')}
  </div>
  <div style="margin-top:.75rem;font-size:.78rem;color:var(--text-3)">
    Total semana: ${weekData.reduce((a,b)=>a+b.count,0)} pomodoros · ${weekData.reduce((a,b)=>a+b.count,0)*focusMins} min
  </div>`;
}

/* ---- Grade calculations ---- */
function calcSubjectAvg(subjectId, grades) {
  const sg = grades.filter(g => g.subjectId === subjectId);
  if (!sg.length) return null;
  // Weighted average normalized to 10
  let totalWeight = 0, weightedSum = 0;
  sg.forEach(g => {
    const norm   = (parseFloat(g.value) / parseFloat(g.max)) * 10;
    const weight = parseFloat(g.weight) || 100;
    weightedSum += norm * weight;
    totalWeight += weight;
  });
  return totalWeight ? weightedSum / totalWeight : null;
}

function calcOverallAvg(subjects, grades) {
  if (!subjects.length) return null;
  const avgs = subjects.map(s => calcSubjectAvg(s.id, grades)).filter(a => a !== null);
  if (!avgs.length) return null;
  return avgs.reduce((a, b) => a + b, 0) / avgs.length;
}

/* ---- Profile ---- */
function saveProfile() {
  const profile = {
    name:       val('pfName'),
    university: val('pfUniversity'),
    career:     val('pfCareer'),
    semester:   val('pfSemester'),
  };
  DB.set('profile', profile);
  updateSidebarProfile();
  toast('Perfil guardado', 'success');
}

function loadProfile() {
  const p = DB.get('profile', {});
  setVal('pfName',       p.name       || '');
  setVal('pfUniversity', p.university || '');
  setVal('pfCareer',     p.career     || '');
  setVal('pfSemester',   p.semester   || '');
}

function updateSidebarProfile() {
  const p = DB.get('profile', {});
  const name = p.name || 'Mi perfil';
  const initials = name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
  el('sidebarInitials').textContent = initials;
  el('sidebarName').textContent = name;
  el('sidebarSub').textContent = [p.career, p.semester].filter(Boolean).join(' · ') || 'Estudiante';
}

function renderProfile() {
  loadProfile();
  updateSidebarProfile();

  const tasks    = DB.get('tasks');
  const subjects = DB.get('subjects');
  const grades   = DB.get('grades');
  const pomLog   = DB.get('pom_log', []);
  const avg      = calcOverallAvg(subjects, grades);

  const statsEl = el('profileStats');
  if (!statsEl) return;
  statsEl.innerHTML = `
    <div class="stat-row"><span class="stat-row-label">Tareas completadas</span><span class="stat-row-value">${tasks.filter(t=>t.done).length}</span></div>
    <div class="stat-row"><span class="stat-row-label">Tareas pendientes</span><span class="stat-row-value">${tasks.filter(t=>!t.done).length}</span></div>
    <div class="stat-row"><span class="stat-row-label">Promedio general</span><span class="stat-row-value">${avg!==null?avg.toFixed(2):'–'}</span></div>
    <div class="stat-row"><span class="stat-row-label">Materias activas</span><span class="stat-row-value">${subjects.length}</span></div>
    <div class="stat-row"><span class="stat-row-label">Notas registradas</span><span class="stat-row-value">${grades.length}</span></div>
    <div class="stat-row"><span class="stat-row-label">Pomodoros totales</span><span class="stat-row-value">${pomLog.length}</span></div>
    <div class="stat-row"><span class="stat-row-label">Horas de enfoque</span><span class="stat-row-value">${Math.round(pomLog.length*25/60)} h</span></div>
  `;
}

/* ---- Export / Clear ---- */
function exportData() {
  const data = {
    tasks:    DB.get('tasks'),
    subjects: DB.get('subjects'),
    grades:   DB.get('grades'),
    events:   DB.get('events'),
    profile:  DB.get('profile', {}),
    pomLog:   DB.get('pom_log', []),
    exported: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'academic-planner-backup.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Datos exportados');
}

function clearData() {
  if (!confirm('¿Borrar todos los datos? Esta acción no se puede deshacer.')) return;
  ['tasks','subjects','grades','events','profile','pom_log'].forEach(k => localStorage.removeItem('ap_'+k));
  toast('Datos eliminados');
  renderDashboard();
  updateSidebarProfile();
}

/* ---- Subject selects (sync all modals) ---- */
function populateSubjectSelects() {
  const subjects = DB.get('subjects');
  const selects  = ['tSubject','gSubject','evSubject','filterSubject'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    const firstOpt = id === 'gSubject' ? '<option value="">Selecciona una materia</option>' : '<option value="">Sin materia</option>';
    sel.innerHTML = firstOpt + subjects.map(s =>
      `<option value="${s.id}">${esc(s.name)}</option>`
    ).join('');
    sel.value = current;
  });
}

/* ---- Utilities ---- */
function el(id)     { return document.getElementById(id); }
function val(id)    { return (el(id)?.value || '').trim(); }
function setVal(id, v) { if (el(id)) el(id).value = v; }
function esc(str)   { return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function uid()      { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-ES', {day:'numeric', month:'short'});
}
function daysUntil(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.ceil((d - now) / 86400000);
}

/* ---- Keyboard shortcuts ---- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
    closeSidebar();
  }
});

/* ---- Session helpers ---- */
function getSession() {
  try {
    const s = localStorage.getItem('ap_session') || sessionStorage.getItem('ap_session');
    return s ? JSON.parse(s) : null;
  } catch(_) { return null; }
}
function logout() {
  localStorage.removeItem('ap_session');
  sessionStorage.removeItem('ap_session');
  window.location.href = 'login.html';
}
function requireAuth() {
  /* Si no hay sesión, redirige al login */
  const session = getSession();
  if (!session?.userId) {
    window.location.href = 'login.html';
    return false;
  }
  /* Sincronizar nombre de sesión con sidebar */
  if (session.name && !DB.get('profile', {}).name) {
    DB.set('profile', { name: session.name, university: '', career: '', semester: '' });
  }
  return true;
}

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;   /* Redirige si no hay sesión */
  applyTheme();
  updateSidebarProfile();
  populateSubjectSelects();
  renderDashboard();
});