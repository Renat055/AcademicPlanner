/* ============================================================
   tasks.js — Gestión completa de tareas
   Crear, editar, eliminar, completar, filtrar, buscar
   ============================================================ */

'use strict';

let editingTaskId = null;

/* ---- Open modal (new or edit) ---- */
function openTaskModal(taskId = null) {
  editingTaskId = taskId;
  populateSubjectSelects();

  const titleEl = el('taskModalTitle');

  if (taskId) {
    // Edit mode
    const task = DB.get('tasks').find(t => t.id === taskId);
    if (!task) return;
    titleEl.textContent = 'Editar tarea';
    setVal('tTitle',    task.title);
    setVal('tDesc',     task.desc || '');
    setVal('tSubject',  task.subjectId || '');
    setVal('tPriority', task.priority || 'media');
    setVal('tDue',      task.due || '');
  } else {
    // New
    titleEl.textContent = 'Nueva tarea';
    setVal('tTitle', '');
    setVal('tDesc',  '');
    setVal('tSubject',  '');
    setVal('tPriority', 'media');
    setVal('tDue',      '');
  }

  openModal('taskModal');
  setTimeout(() => el('tTitle')?.focus(), 50);
}

/* ---- Save task ---- */
function saveTask() {
  const title = val('tTitle');
  if (!title) { toast('El título es obligatorio', 'error'); return; }

  const tasks = DB.get('tasks');

  if (editingTaskId) {
    // Update
    const idx = tasks.findIndex(t => t.id === editingTaskId);
    if (idx === -1) return;
    tasks[idx] = {
      ...tasks[idx],
      title,
      desc:      val('tDesc'),
      subjectId: val('tSubject'),
      priority:  val('tPriority'),
      due:       val('tDue'),
      updatedAt: Date.now(),
    };
    toast('Tarea actualizada', 'success');
  } else {
    // Create
    tasks.unshift({
      id:        uid(),
      title,
      desc:      val('tDesc'),
      subjectId: val('tSubject'),
      priority:  val('tPriority') || 'media',
      due:       val('tDue'),
      done:      false,
      createdAt: Date.now(),
    });
    toast('Tarea creada', 'success');
  }

  DB.set('tasks', tasks);
  closeModal('taskModal');
  renderTasks();
  renderDashKPIs();
  editingTaskId = null;
}

/* ---- Toggle done ---- */
function toggleTask(id) {
  DB.update('tasks', tasks =>
    tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)
  );
  renderTasks();
  renderDashboard();
}

/* ---- Delete task ---- */
function deleteTask(id) {
  DB.update('tasks', tasks => tasks.filter(t => t.id !== id));
  toast('Tarea eliminada');
  renderTasks();
  renderDashboard();
}

/* ---- Filter state ---- */
function setFilter(filter, btn) {
  APP.taskFilter = filter;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

/* ---- Render task list ---- */
function renderTasks() {
  const listEl   = el('taskList');
  if (!listEl) return;

  const subjects  = DB.get('subjects');
  const query     = (el('taskSearch')?.value || '').toLowerCase().trim();
  const subFilter = val('filterSubject');
  const priFilter = val('filterPriority');

  let tasks = DB.get('tasks');

  // Filter by status
  if (APP.taskFilter === 'pending')   tasks = tasks.filter(t => !t.done);
  if (APP.taskFilter === 'done')      tasks = tasks.filter(t =>  t.done);

  // Filter by subject
  if (subFilter) tasks = tasks.filter(t => t.subjectId === subFilter);

  // Filter by priority
  if (priFilter) tasks = tasks.filter(t => t.priority === priFilter);

  // Search
  if (query) tasks = tasks.filter(t =>
    t.title.toLowerCase().includes(query) ||
    (t.desc || '').toLowerCase().includes(query)
  );

  if (!tasks.length) {
    listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-3);font-size:.85rem">Sin tareas</div>';
    return;
  }

  // Sort: pending first, then by priority, then by due date
  const priOrder = { alta: 0, media: 1, baja: 2 };
  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (priOrder[a.priority] !== priOrder[b.priority]) return priOrder[a.priority] - priOrder[b.priority];
    if (a.due && b.due) return new Date(a.due) - new Date(b.due);
    return a.due ? -1 : 1;
  });

  listEl.innerHTML = tasks.map(t => {
    const subj  = subjects.find(s => s.id === t.subjectId);
    const color = subj ? SUBJECT_COLORS[subj.color] : 'transparent';
    const daysLeft = t.due ? daysUntil(t.due) : null;
    let dueLabel = '';
    if (t.due) {
      if (daysLeft < 0)       dueLabel = `<span style="color:var(--red)">Vencida</span>`;
      else if (daysLeft === 0) dueLabel = `<span style="color:var(--amber)">Hoy</span>`;
      else if (daysLeft === 1) dueLabel = `<span style="color:var(--amber)">Mañana</span>`;
      else                     dueLabel = formatDate(t.due);
    }

    return `
      <div class="task-item ${t.done ? 'done' : ''}">
        <div class="task-check ${t.done ? 'done' : ''}" onclick="toggleTask('${t.id}')">
          ${t.done ? '✓' : ''}
        </div>
        <div class="task-subject-line" style="background:${color}"></div>
        <div class="task-body">
          <div class="task-title ${t.done ? 'done' : ''}">${esc(t.title)}</div>
          <div class="task-meta">
            ${subj ? `<span class="task-meta-item tag tag-${subj.color}">${esc(subj.name)}</span>` : ''}
            <span class="task-meta-item tag tag-${t.priority}">${t.priority}</span>
            ${dueLabel ? `<span class="task-meta-item">${dueLabel}</span>` : ''}
            ${t.desc ? `<span class="task-meta-item" style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.desc)}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" title="Editar" onclick="openTaskModal('${t.id}')">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M9 2l2 2-7 7H2V9L9 2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="icon-btn" title="Eliminar" onclick="deleteTask('${t.id}')" style="color:var(--red)">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 3h9M5 3V2h3v1M4 3l.5 8h4L9 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

/* ---- Keyboard submit in modal ---- */
document.addEventListener('DOMContentLoaded', () => {
  el('tTitle')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveTask(); });
});