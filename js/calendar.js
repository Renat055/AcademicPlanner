/* ============================================================
   calendar.js — Calendario académico
   Grid mensual, eventos, exámenes, entregas, navegación
   ============================================================ */

'use strict';

const CAL = {
  year:     new Date().getFullYear(),
  month:    new Date().getMonth(), // 0-indexed
  selected: new Date().toISOString().slice(0, 10),
};

let editingEventId = null;

/* ---- Event type config ---- */
const EVENT_TYPES = {
  exam:     { label: 'Examen',      color: 'var(--red)' },
  due:      { label: 'Entrega',     color: 'var(--amber)' },
  class:    { label: 'Clase',       color: 'var(--accent)' },
  event:    { label: 'Evento',      color: 'var(--green)' },
  reminder: { label: 'Recordatorio',color: 'var(--text-3)' },
};

/* ---- Navigation ---- */
function calNav(dir) {
  if (dir === 0) {
    CAL.year  = new Date().getFullYear();
    CAL.month = new Date().getMonth();
    CAL.selected = new Date().toISOString().slice(0, 10);
  } else {
    CAL.month += dir;
    if (CAL.month > 11) { CAL.month = 0;  CAL.year++; }
    if (CAL.month < 0)  { CAL.month = 11; CAL.year--; }
  }
  renderCalendar();
}

/* ---- Open event modal ---- */
function openEventModal(eventId = null, prefillDate = null) {
  editingEventId = eventId;
  populateSubjectSelects();

  const titleEl = el('eventModalTitle');

  if (eventId) {
    const ev = DB.get('events').find(e => e.id === eventId);
    if (!ev) return;
    titleEl.textContent = 'Editar evento';
    setVal('evTitle',   ev.title);
    setVal('evType',    ev.type);
    setVal('evSubject', ev.subjectId || '');
    setVal('evDate',    ev.date);
    setVal('evTime',    ev.time || '');
    setVal('evDesc',    ev.desc || '');
  } else {
    titleEl.textContent = 'Nuevo evento';
    setVal('evTitle',   '');
    setVal('evType',    'exam');
    setVal('evSubject', '');
    setVal('evDate',    prefillDate || CAL.selected || new Date().toISOString().slice(0,10));
    setVal('evTime',    '');
    setVal('evDesc',    '');
  }

  openModal('eventModal');
  setTimeout(() => el('evTitle')?.focus(), 50);
}

/* ---- Save event ---- */
function saveEvent() {
  const title = val('evTitle');
  const date  = val('evDate');
  if (!title) { toast('El título es obligatorio', 'error'); return; }
  if (!date)  { toast('La fecha es obligatoria', 'error'); return; }

  const events = DB.get('events');

  if (editingEventId) {
    const idx = events.findIndex(e => e.id === editingEventId);
    if (idx === -1) return;
    events[idx] = {
      ...events[idx],
      title,
      type:      val('evType') || 'event',
      subjectId: val('evSubject'),
      date,
      time:      val('evTime'),
      desc:      val('evDesc'),
    };
    toast('Evento actualizado', 'success');
  } else {
    events.push({
      id:        uid(),
      title,
      type:      val('evType') || 'event',
      subjectId: val('evSubject'),
      date,
      time:      val('evTime'),
      desc:      val('evDesc'),
      createdAt: Date.now(),
    });
    toast('Evento guardado', 'success');
  }

  DB.set('events', events);
  closeModal('eventModal');
  renderCalendar();
  renderDashboard();
  editingEventId = null;
}

/* ---- Delete event ---- */
function deleteEvent(id) {
  DB.update('events', evs => evs.filter(e => e.id !== id));
  toast('Evento eliminado');
  renderCalendar();
  renderDashboard();
}

/* ---- Select a day ---- */
function selectCalDay(dateStr) {
  CAL.selected = dateStr;
  // Rerender dots without full rebuild
  document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
  const cell = document.querySelector(`[data-date="${dateStr}"]`);
  if (cell) cell.classList.add('selected');
  renderCalDayEvents();
}

/* ---- Main render ---- */
function renderCalendar() {
  renderCalGrid();
  renderCalDayEvents();
  renderCalUpcoming();
}

/* ---- Calendar grid ---- */
function renderCalGrid() {
  const gridEl = el('calGrid');
  const labelEl = el('calLabel');
  if (!gridEl) return;

  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  if (labelEl) labelEl.textContent = `${monthNames[CAL.month]} ${CAL.year}`;

  const events   = DB.get('events');
  const today    = new Date().toISOString().slice(0, 10);
  const dayLabels = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

  // First day of month (adjust: Mon = 0)
  const firstDay = new Date(CAL.year, CAL.month, 1);
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // Convert to Mon=0

  const daysInMonth = new Date(CAL.year, CAL.month + 1, 0).getDate();
  const daysInPrev  = new Date(CAL.year, CAL.month, 0).getDate();

  let html = dayLabels.map(d => `<div class="cal-day-lbl">${d}</div>`).join('');

  // Prev month fill
  for (let i = startDow - 1; i >= 0; i--) {
    const d    = daysInPrev - i;
    const m    = CAL.month === 0 ? 11 : CAL.month - 1;
    const y    = CAL.month === 0 ? CAL.year - 1 : CAL.year;
    const date = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    html += buildCalCell(d, date, true);
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${CAL.year}-${String(CAL.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    html += buildCalCell(d, date, false);
  }

  // Next month fill
  const totalCells = startDow + daysInMonth;
  const nextFill   = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= nextFill; d++) {
    const m    = CAL.month === 11 ? 0  : CAL.month + 1;
    const y    = CAL.month === 11 ? CAL.year + 1 : CAL.year;
    const date = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    html += buildCalCell(d, date, true);
  }

  gridEl.innerHTML = html;

  // Attach click listeners
  gridEl.querySelectorAll('.cal-cell').forEach(cell => {
    cell.addEventListener('click', () => selectCalDay(cell.dataset.date));
  });
}

function buildCalCell(dayNum, dateStr, isOther) {
  const events   = DB.get('events').filter(e => e.date === dateStr);
  const subjects = DB.get('subjects');
  const today    = new Date().toISOString().slice(0,10);
  const isToday  = dateStr === today;
  const isSel    = dateStr === CAL.selected;

  const dots = events.slice(0,3).map(ev => {
    const subj  = subjects.find(s => s.id === ev.subjectId);
    const color = subj ? SUBJECT_COLORS[subj.color] : (EVENT_TYPES[ev.type]?.color || 'var(--text-3)');
    return `<div class="cal-dot" style="background:${color}"></div>`;
  }).join('');

  return `<div class="cal-cell${isOther?' other':''}${isToday?' today':''}${isSel?' selected':''}" data-date="${dateStr}">
    <span class="cal-num">${dayNum}</span>
    ${dots ? `<div class="cal-dots">${dots}</div>` : ''}
  </div>`;
}

/* ---- Day events panel ---- */
function renderCalDayEvents() {
  const wrap     = el('calDayEvents');
  const titleEl  = el('calDayTitle');
  if (!wrap) return;

  const events   = DB.get('events').filter(e => e.date === CAL.selected);
  const subjects = DB.get('subjects');

  if (titleEl) {
    const d = new Date(CAL.selected + 'T00:00:00');
    titleEl.textContent = d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
  }

  if (!events.length) {
    wrap.innerHTML = `<div class="empty-msg">Sin eventos
      <button class="link-btn" style="display:block;margin-top:6px" onclick="openEventModal(null,'${CAL.selected}')">Agregar evento</button>
    </div>`;
    return;
  }

  const sorted = [...events].sort((a,b) => (a.time||'99:99').localeCompare(b.time||'99:99'));

  wrap.innerHTML = sorted.map(ev => buildEventRow(ev, subjects, true)).join('');
}

/* ---- Upcoming events panel ---- */
function renderCalUpcoming() {
  const wrap     = el('calUpcoming');
  if (!wrap) return;

  const today    = new Date().toISOString().slice(0,10);
  const events   = DB.get('events')
    .filter(e => e.date >= today)
    .sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''))
    .slice(0, 8);
  const subjects = DB.get('subjects');

  if (!events.length) { wrap.innerHTML = '<div class="empty-msg">Sin eventos próximos</div>'; return; }

  wrap.innerHTML = events.map(ev => buildEventRow(ev, subjects, false)).join('');
}

/* ---- Build event row HTML ---- */
function buildEventRow(ev, subjects, showActions) {
  const subj  = subjects.find(s => s.id === ev.subjectId);
  const typeColor = EVENT_TYPES[ev.type]?.color || 'var(--text-3)';
  const barColor  = subj ? SUBJECT_COLORS[subj.color] : typeColor;
  const typeLabel = EVENT_TYPES[ev.type]?.label || ev.type;
  const timeStr   = ev.time ? ev.time : '';
  const dateStr   = ev.date !== CAL.selected ? formatDate(ev.date) : '';

  return `<div class="event-row">
    <div class="event-bar" style="background:${barColor}"></div>
    <div class="event-body">
      <div class="event-title">${esc(ev.title)}</div>
      <div class="event-meta">
        <span style="color:${typeColor}">${typeLabel}</span>
        ${subj ? ` · <span>${esc(subj.name)}</span>` : ''}
        ${timeStr ? ` · <span>${timeStr}</span>` : ''}
        ${dateStr ? ` · <span>${dateStr}</span>` : ''}
      </div>
      ${ev.desc ? `<div style="font-size:.72rem;color:var(--text-3);margin-top:2px">${esc(ev.desc)}</div>` : ''}
    </div>
    ${showActions ? `
    <div class="event-del" style="display:flex;gap:3px;">
      <button class="icon-btn" onclick="openEventModal('${ev.id}')" title="Editar">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="icon-btn" style="color:var(--red)" onclick="deleteEvent('${ev.id}')" title="Eliminar">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
    </div>` : ''}
  </div>`;
}

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  renderCalendar();
});