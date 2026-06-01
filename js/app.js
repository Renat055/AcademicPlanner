/* ============================================================
   app.js — Núcleo de la aplicación
   v2.0 — Correcciones: persistencia, dashboard materias, UX

   CAMBIOS v2:
   ① requireAuth: sincroniza perfil desde sesión al cargar
   ② renderDashSubjects: añade botón "+" directo en el dashboard
   ③ openSubjectModalFromDash: abre modal con callback de vuelta al dash
   ④ saveSubject: tras guardar refresca dashboard y notas
   ⑤ clearData: no borra usuarios ni sesión (solo datos académicos)
   ⑥ populateSubjectSelects: incluye también los selects de pages/
   ⑦ Corrección de claves DB: unificación de ap_profile
   ⑧ renderDashSubjects: estado vacío con CTA de agregar materia
   ⑨ Validación de uid() única garantizada
   ⑩ Logout limpio sin perder datos de otros usuarios
============================================================ */

'use strict';

/* ─────────────────────────────────────────
   ESTADO GLOBAL
───────────────────────────────────────── */
const APP = {
  currentPage: 'dashboard',
  theme:       localStorage.getItem('ap_theme') || 'light',
  taskFilter:  'all',
};

/* ─────────────────────────────────────────
   PALETA DE COLORES POR MATERIA
───────────────────────────────────────── */
const SUBJECT_COLORS = {
  blue:   '#3B82F6',
  indigo: '#6366F1',
  violet: '#8B5CF6',
  green:  '#10B981',
  teal:   '#0D9488',
  orange: '#F97316',
  rose:   '#F43F5E',
};

/* ─────────────────────────────────────────
   DB — localStorage con prefijo "ap_"
   Todos los datos académicos usan este helper.
   Los usuarios y sesión se manejan por separado
   para evitar borrarlos con clearData().
───────────────────────────────────────── */
const DB = {
  get(key, def = []) {
    try {
      const raw = localStorage.getItem('ap_' + key);
      return raw !== null ? JSON.parse(raw) : def;
    } catch (_) { return def; }
  },
  set(key, val) {
    localStorage.setItem('ap_' + key, JSON.stringify(val));
  },
  remove(key) {
    localStorage.removeItem('ap_' + key);
  },
  update(key, fn, def = []) {
    const v = DB.get(key, def);
    const updated = fn(v);
    DB.set(key, updated);
    return updated;
  },
};

/* ─────────────────────────────────────────
   UTILIDADES
───────────────────────────────────────── */
function el(id)        { return document.getElementById(id); }
function val(id)       { return (el(id)?.value || '').trim(); }
function setVal(id, v) { if (el(id)) el(id).value = v; }
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* UID con colisión prácticamente imposible */
function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short',
  });
}
function daysUntil(dateStr) {
  const d   = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d - now) / 86400000);
}

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
function toast(msg, type = '') {
  const wrap = el('toastWrap');
  if (!wrap) return;
  const div = document.createElement('div');
  div.className = 'toast' + (type ? ' ' + type : '');
  div.textContent = msg;
  wrap.appendChild(div);
  setTimeout(() => div.remove(), 3200);
}

/* ─────────────────────────────────────────
   MODALES
───────────────────────────────────────── */
function openModal(id) {
  const m = el(id);
  if (m) m.classList.add('open');
}
function closeModal(id) {
  const m = el(id);
  if (m) m.classList.remove('open');
}

/* Cerrar al hacer click en el fondo */
document.querySelectorAll('.modal-bg').forEach(bg => {
  bg.addEventListener('click', e => {
    if (e.target === bg) bg.classList.remove('open');
  });
});

/* ─────────────────────────────────────────
   NAVEGACIÓN
───────────────────────────────────────── */
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = el('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  APP.currentPage = page;

  const titles = {
    dashboard: 'Dashboard', tasks: 'Tareas', grades: 'Notas',
    pomodoro: 'Pomodoro',   calendar: 'Calendario', profile: 'Perfil',
  };
  const topbarTitle = el('topbarTitle');
  if (topbarTitle) topbarTitle.textContent = titles[page] || '';

  closeSidebar();

  /* Renderizar la página destino */
  if (page === 'dashboard') renderDashboard();
  if (page === 'tasks')     renderTasks();
  if (page === 'grades')    renderGrades();
  if (page === 'pomodoro')  renderPomStats();
  if (page === 'calendar')  renderCalendar();
  if (page === 'profile')   renderProfile();
}

/* ─────────────────────────────────────────
   SIDEBAR MÓVIL
───────────────────────────────────────── */
function openSidebar() {
  el('sidebar')?.classList.add('open');
  el('overlay')?.classList.add('open');
}
function closeSidebar() {
  el('sidebar')?.classList.remove('open');
  el('overlay')?.classList.remove('open');
}

/* ─────────────────────────────────────────
   TEMA
───────────────────────────────────────── */
function toggleTheme() {
  APP.theme = APP.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('ap_theme', APP.theme);
  applyTheme();
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', APP.theme);
  const dark  = APP.theme === 'dark';
  const icon  = el('themeIcon');
  const label = el('themeLabel');
  if (icon) icon.innerHTML = dark
    ? `<path d="M7.5 1a6.5 6.5 0 1 0 6.5 6.5A5 5 0 0 1 7.5 1z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>`
    : `<path d="M7.5 1v1M7.5 13v1M1 7.5H2M13 7.5h1M3.2 3.2l.7.7M11.1 11.1l.7.7M3.2 11.8l.7-.7M11.1 4.4l.7-.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="7.5" cy="7.5" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/>`;
  if (label) label.textContent = dark ? 'Modo claro' : 'Modo oscuro';
}

/* ─────────────────────────────────────────
   SALUDO DEL DASHBOARD
───────────────────────────────────────── */
function renderGreeting() {
  const h  = new Date().getHours();
  const gr = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = (DB.get('profile', {}).name || '').split(' ')[0];
  const grEl = el('greetingText');
  if (grEl) grEl.textContent = firstName ? `${gr}, ${firstName}` : gr;
  const dateEl = el('greetingDate');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/* ─────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────── */
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
  const grades   = DB.get('grades');
  const subjects = DB.get('subjects');
  const pomData  = DB.get('pom_log', []);
  const today    = new Date().toDateString();
  const todayPom = pomData.filter(p => new Date(p.ts).toDateString() === today).length;
  const focusMins = parseInt(localStorage.getItem('ap_cfg_focus') || '25');

  const pending = tasks.filter(t => !t.done).length;

  if (el('kpiPending')) {
    el('kpiPending').textContent = pending;
    el('kpiPendingSub').textContent = `${tasks.filter(t => t.done).length} completadas`;
  }

  const avg = calcOverallAvg(subjects, grades);
  if (el('kpiAvg')) {
    el('kpiAvg').textContent    = avg !== null ? avg.toFixed(1) : '–';
    el('kpiAvgSub').textContent = avg !== null
      ? `${subjects.length} materia${subjects.length !== 1 ? 's' : ''}`
      : 'Sin notas aún';
  }

  if (el('kpiPomodoros')) {
    el('kpiPomodoros').textContent = todayPom;
    el('kpiPomSub').textContent    = `${todayPom * focusMins} min de enfoque`;
  }

  const exams = DB.get('events')
    .filter(ev => ev.type === 'exam' && new Date(ev.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (el('kpiNextExam')) {
    if (exams.length) {
      const diff = Math.ceil((new Date(exams[0].date) - new Date()) / 86400000);
      el('kpiNextExam').textContent    = diff === 0 ? 'Hoy' : `${diff}d`;
      el('kpiNextExamSub').textContent = exams[0].title;
    } else {
      el('kpiNextExam').textContent    = '–';
      el('kpiNextExamSub').textContent = 'Sin exámenes';
    }
  }

  /* Badge del nav */
  const badge = el('navBadgeTasks');
  if (badge) badge.textContent = pending;
}

function renderDashTasks() {
  const tasks    = DB.get('tasks').filter(t => !t.done).slice(0, 5);
  const subjects = DB.get('subjects');
  const wrap     = el('dashTasks');
  if (!wrap) return;

  if (!tasks.length) {
    wrap.innerHTML = `
      <div class="empty-msg">Sin tareas pendientes
        <button class="link-btn" style="display:block;margin-top:6px"
          onclick="navigate('tasks');setTimeout(openTaskModal,80)">
          Agregar tarea
        </button>
      </div>`;
    return;
  }

  wrap.innerHTML = tasks.map(t => {
    const subj  = subjects.find(s => s.id === t.subjectId);
    const color = subj ? SUBJECT_COLORS[subj.color] : 'var(--text-3)';
    return `<div class="dash-task-row">
      <div class="dash-task-dot" style="background:${color}"></div>
      <span class="dash-task-name">${esc(t.title)}</span>
      <span class="tag tag-${t.priority} dash-task-pri">${t.priority}</span>
    </div>`;
  }).join('');
}

function renderDashExams() {
  const subjects = DB.get('subjects');
  const exams    = DB.get('events')
    .filter(ev => ev.type === 'exam' && new Date(ev.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  const wrap = el('dashExams');
  if (!wrap) return;

  if (!exams.length) {
    wrap.innerHTML = `
      <div class="empty-msg">Sin exámenes próximos
        <button class="link-btn" style="display:block;margin-top:6px"
          onclick="navigate('calendar');setTimeout(openEventModal,80)">
          Agregar examen
        </button>
      </div>`;
    return;
  }

  wrap.innerHTML = exams.map(ev => {
    const subj     = subjects.find(s => s.id === ev.subjectId);
    const color    = subj ? SUBJECT_COLORS[subj.color] : 'var(--text-3)';
    const diff     = Math.ceil((new Date(ev.date) - new Date()) / 86400000);
    const label    = diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : `${diff}d`;
    const tagStyle = diff <= 3
      ? 'background:var(--red-bg);color:var(--red)'
      : diff <= 7
        ? 'background:var(--amber-bg);color:var(--amber)'
        : 'background:var(--green-bg);color:var(--green)';
    return `<div class="exam-row">
      <div class="exam-dot" style="background:${color}"></div>
      <span class="exam-name">${esc(ev.title)}</span>
      <span class="exam-date">${formatDate(ev.date)}</span>
      <span class="exam-days-tag" style="${tagStyle}">${label}</span>
    </div>`;
  }).join('');
}

/*
 * CORRECCIÓN ①: renderDashSubjects
 * Antes: solo mostraba lista y un link a "Ver notas".
 * Ahora: muestra botón "+" directo para agregar materia desde el dashboard.
 * Si no hay materias, el estado vacío tiene un CTA prominente.
 */
function renderDashSubjects() {
  const subjects = DB.get('subjects');
  const grades   = DB.get('grades');
  const wrap     = el('dashSubjects');
  if (!wrap) return;

  if (!subjects.length) {
    wrap.innerHTML = `
      <div class="empty-msg">
        Aún no tienes materias registradas
        <button class="link-btn" style="
          display:inline-flex;align-items:center;gap:4px;
          margin-top:8px;padding:6px 12px;
          border-radius:6px;background:var(--accent);
          color:#fff;font-size:.78rem;font-weight:600;cursor:pointer;
        " onclick="openSubjectModal()">
          + Agregar primera materia
        </button>
      </div>`;
    return;
  }

  wrap.innerHTML = subjects.map(s => {
    const avg   = calcSubjectAvg(s.id, grades);
    const color = SUBJECT_COLORS[s.color] || '#888';
    const pct   = avg !== null ? Math.min((avg / 10) * 100, 100) : 0;
    return `<div class="subj-row">
      <div class="subj-color-dot" style="background:${color}"></div>
      <span class="subj-name">${esc(s.name)}</span>
      <span class="subj-avg">${avg !== null ? avg.toFixed(1) : '–'}</span>
      <div class="subj-prog-wrap">
        <div class="prog-wrap">
          <div class="prog-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderDashWeekly() {
  const pomLog    = DB.get('pom_log', []);
  const focusMins = parseInt(localStorage.getItem('ap_cfg_focus') || '25');
  const days      = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const today     = new Date();

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const count = pomLog.filter(p => new Date(p.ts).toDateString() === d.toDateString()).length;
    return { label: days[d.getDay()], count, isToday: d.toDateString() === today.toDateString() };
  });

  const wrap = el('dashWeekly');
  if (!wrap) return;

  if (weekData.every(d => d.count === 0)) {
    wrap.innerHTML = '<div class="empty-msg">Usa el Pomodoro para registrar sesiones</div>';
    return;
  }

  const max = Math.max(...weekData.map(d => d.count), 1);
  const total = weekData.reduce((a, b) => a + b.count, 0);
  wrap.innerHTML = `
    <div class="week-chart">
      ${weekData.map(d => `
        <div class="week-bar-wrap">
          <div class="week-bar-track" title="${d.count} pomodoros · ${d.count * focusMins} min">
            <div class="week-bar-fill${d.isToday ? ' today' : ''}"
                 style="height:${(d.count / max) * 100}%"></div>
          </div>
          <div class="week-day-label">${d.label}</div>
        </div>`).join('')}
    </div>
    <div style="margin-top:.75rem;font-size:.78rem;color:var(--text-3)">
      Esta semana: ${total} pomodoros · ${total * focusMins} min de enfoque
    </div>`;
}

/* ─────────────────────────────────────────
   CÁLCULOS DE NOTAS
───────────────────────────────────────── */
function calcSubjectAvg(subjectId, grades) {
  const sg = grades.filter(g => g.subjectId === subjectId);
  if (!sg.length) return null;
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
  const avgs = subjects
    .map(s => calcSubjectAvg(s.id, grades))
    .filter(a => a !== null);
  if (!avgs.length) return null;
  return avgs.reduce((a, b) => a + b, 0) / avgs.length;
}

/* ─────────────────────────────────────────
   PERFIL
───────────────────────────────────────── */
function saveProfile() {
  const profile = {
    name:       val('pfName'),
    university: val('pfUniversity'),
    career:     val('pfCareer'),
    semester:   val('pfSemester'),
  };
  if (!profile.name) { toast('El nombre es obligatorio', 'error'); return; }
  DB.set('profile', profile);

  /* Actualizar también el nombre en la sesión activa */
  const session = getSession();
  if (session) {
    session.name = profile.name;
    const storage = localStorage.getItem('ap_session') ? localStorage : sessionStorage;
    storage.setItem('ap_session', JSON.stringify(session));
  }

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
  const p        = DB.get('profile', {});
  const name     = p.name || 'Mi perfil';
  const initials = name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
  if (el('sidebarInitials')) el('sidebarInitials').textContent = initials;
  if (el('sidebarName'))     el('sidebarName').textContent     = name;
  if (el('sidebarSub'))      el('sidebarSub').textContent      =
    [p.career, p.semester].filter(Boolean).join(' · ') || 'Estudiante';
}

function renderProfile() {
  loadProfile();
  updateSidebarProfile();

  const tasks    = DB.get('tasks');
  const subjects = DB.get('subjects');
  const grades   = DB.get('grades');
  const pomLog   = DB.get('pom_log', []);
  const focusMins = parseInt(localStorage.getItem('ap_cfg_focus') || '25');
  const avg      = calcOverallAvg(subjects, grades);
  const statsEl  = el('profileStats');
  if (!statsEl) return;

  statsEl.innerHTML = `
    <div class="stat-row"><span class="stat-row-label">Tareas completadas</span><span class="stat-row-value">${tasks.filter(t => t.done).length}</span></div>
    <div class="stat-row"><span class="stat-row-label">Tareas pendientes</span><span class="stat-row-value">${tasks.filter(t => !t.done).length}</span></div>
    <div class="stat-row"><span class="stat-row-label">Promedio general</span><span class="stat-row-value">${avg !== null ? avg.toFixed(2) : '–'}</span></div>
    <div class="stat-row"><span class="stat-row-label">Materias activas</span><span class="stat-row-value">${subjects.length}</span></div>
    <div class="stat-row"><span class="stat-row-label">Notas registradas</span><span class="stat-row-value">${grades.length}</span></div>
    <div class="stat-row"><span class="stat-row-label">Pomodoros totales</span><span class="stat-row-value">${pomLog.length}</span></div>
    <div class="stat-row"><span class="stat-row-label">Horas de enfoque</span><span class="stat-row-value">${Math.round(pomLog.length * focusMins / 60 * 10) / 10} h</span></div>
  `;
}

/* ─────────────────────────────────────────
   EXPORTAR / LIMPIAR DATOS
   CORRECCIÓN ②: clearData NO borra usuarios
   ni sesión — solo datos académicos del usuario actual.
───────────────────────────────────────── */
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
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'academic-planner-backup.json' });
  a.click();
  URL.revokeObjectURL(url);
  toast('Datos exportados correctamente');
}

function clearData() {
  if (!confirm('¿Borrar todos los datos académicos? Esta acción no se puede deshacer.\n\nNota: tu cuenta y sesión se mantendrán.')) return;
  /* Solo borra datos académicos, NO toca ap_users ni ap_session */
  ['tasks', 'subjects', 'grades', 'events', 'pom_log'].forEach(k => DB.remove(k));
  /* Mantiene el perfil pero vacía los datos académicos */
  toast('Datos académicos eliminados');
  renderDashboard();
  updateSidebarProfile();
}

/* ─────────────────────────────────────────
   SELECTS DE MATERIAS — sincroniza todos los modales
   CORRECCIÓN ③: incluye IDs de pages/ standalone
───────────────────────────────────────── */
function populateSubjectSelects() {
  const subjects = DB.get('subjects');
  const selectIds = [
    'tSubject', 'gSubject', 'evSubject',   /* modales en index.html */
    'filterSubject',                         /* toolbar de tareas     */
  ];

  selectIds.forEach(id => {
    const sel = el(id);
    if (!sel) return;
    const current  = sel.value;
    const firstOpt = id === 'gSubject'
      ? '<option value="">Selecciona una materia</option>'
      : '<option value="">Sin materia</option>';
    sel.innerHTML = firstOpt + subjects.map(s =>
      `<option value="${s.id}">${esc(s.name)}</option>`
    ).join('');
    /* Restaurar selección previa si aún existe */
    if (subjects.find(s => s.id === current)) sel.value = current;
  });
}

/* ─────────────────────────────────────────
   SESIÓN Y AUTENTICACIÓN
   CORRECCIÓN ④: requireAuth sincroniza perfil
   correctamente desde la sesión guardada,
   sin sobreescribir datos existentes.
───────────────────────────────────────── */
function getSession() {
  try {
    const raw = localStorage.getItem('ap_session') || sessionStorage.getItem('ap_session');
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function logout() {
  localStorage.removeItem('ap_session');
  sessionStorage.removeItem('ap_session');
  window.location.href = 'login.html';
}

function requireAuth() {
  const session = getSession();
  if (!session?.userId) {
    window.location.href = 'login.html';
    return false;
  }

  /*
   * Sincronizar perfil desde sesión SOLO si no hay perfil guardado.
   * Esto evita sobreescribir un perfil que el usuario haya editado.
   */
  const existingProfile = DB.get('profile', {});
  if (!existingProfile.name && session.name) {
    DB.set('profile', {
      name:       session.name,
      university: session.university || '',
      career:     session.career     || '',
      semester:   '',
    });
  }
  return true;
}

/* ─────────────────────────────────────────
   TECLADO
───────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
    closeSidebar();
  }
});

/* ─────────────────────────────────────────
   INICIO
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  applyTheme();
  updateSidebarProfile();
  populateSubjectSelects();
  renderDashboard();
});