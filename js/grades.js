/* ============================================================
   grades.js — Materias, notas y promedios
   Promedio ponderado, barras de progreso, historial
   ============================================================ */

'use strict';

let editingSubjectId = null;

/* ---- Subject modal ---- */
function openSubjectModal(subjectId = null) {
  editingSubjectId = subjectId;
  const titleEl = el('subjectModalTitle');

  if (subjectId) {
    const subj = DB.get('subjects').find(s => s.id === subjectId);
    if (!subj) return;
    titleEl.textContent = 'Editar materia';
    setVal('sName',    subj.name);
    setVal('sTeacher', subj.teacher || '');
    setVal('sColor',   subj.color   || 'blue');
    setVal('sGoal',    subj.goal    || '7');
  } else {
    titleEl.textContent = 'Nueva materia';
    setVal('sName',    '');
    setVal('sTeacher', '');
    setVal('sColor',   'blue');
    setVal('sGoal',    '7');
  }

  openModal('subjectModal');
  setTimeout(() => el('sName')?.focus(), 50);
}

/* ---- Save subject ---- */
function saveSubject() {
  const name = val('sName');
  if (!name) { toast('El nombre es obligatorio', 'error'); return; }

  const subjects = DB.get('subjects');

  if (editingSubjectId) {
    const idx = subjects.findIndex(s => s.id === editingSubjectId);
    subjects[idx] = {
      ...subjects[idx],
      name,
      teacher: val('sTeacher'),
      color:   val('sColor') || 'blue',
      goal:    parseFloat(val('sGoal')) || 7,
    };
    toast('Materia actualizada', 'success');
  } else {
    subjects.push({
      id:      uid(),
      name,
      teacher: val('sTeacher'),
      color:   val('sColor') || 'blue',
      goal:    parseFloat(val('sGoal')) || 7,
    });
    toast('Materia creada', 'success');
  }

  DB.set('subjects', subjects);
  populateSubjectSelects();
  closeModal('subjectModal');
  renderGrades();
  renderDashSubjects();
  editingSubjectId = null;
}

/* ---- Delete subject ---- */
function deleteSubject(id) {
  if (!confirm('¿Eliminar esta materia y todas sus notas?')) return;
  DB.update('subjects', ss => ss.filter(s => s.id !== id));
  DB.update('grades',   gs => gs.filter(g => g.subjectId !== id));
  populateSubjectSelects();
  renderGrades();
  renderDashboard();
  toast('Materia eliminada');
}

/* ---- Grade modal ---- */
function openGradeModal(subjectId = null) {
  populateSubjectSelects();
  setVal('gSubject', subjectId || '');
  setVal('gName',    '');
  setVal('gValue',   '');
  setVal('gMax',     '10');
  setVal('gWeight',  '100');
  setVal('gDate',    new Date().toISOString().slice(0,10));
  openModal('gradeModal');
  setTimeout(() => el('gSubject')?.focus(), 50);
}

/* ---- Save grade ---- */
function saveGrade() {
  const subjectId = val('gSubject');
  const name      = val('gName');
  const value     = parseFloat(val('gValue'));
  const max       = parseFloat(val('gMax')) || 10;

  if (!subjectId) { toast('Selecciona una materia', 'error'); return; }
  if (!name)      { toast('Ingresa el nombre de la actividad', 'error'); return; }
  if (isNaN(value) || value < 0) { toast('Ingresa una nota válida', 'error'); return; }
  if (value > max) { toast('La nota no puede superar el máximo', 'error'); return; }

  DB.update('grades', gs => {
    gs.push({
      id:        uid(),
      subjectId,
      name,
      value,
      max,
      weight:    parseFloat(val('gWeight')) || 100,
      date:      val('gDate'),
      createdAt: Date.now(),
    });
    return gs;
  });

  toast('Nota guardada', 'success');
  closeModal('gradeModal');
  renderGrades();
  renderDashboard();
}

/* ---- Delete grade ---- */
function deleteGrade(id) {
  DB.update('grades', gs => gs.filter(g => g.id !== id));
  toast('Nota eliminada');
  renderGrades();
  renderDashboard();
}

/* ---- Render grades page ---- */
function renderGrades() {
  const subjects = DB.get('subjects');
  const grades   = DB.get('grades');
  const gridEl   = el('subjectsGrid');
  const avgEl    = el('avgNumber');
  const bannerEl = el('avgBannerRight');
  if (!gridEl) return;

  // Overall avg
  const overall = calcOverallAvg(subjects, grades);
  if (avgEl) avgEl.textContent = overall !== null ? overall.toFixed(2) : '–';

  // Banner mini progress bars
  if (bannerEl) {
    bannerEl.innerHTML = subjects.slice(0,4).map(s => {
      const avg = calcSubjectAvg(s.id, grades);
      const pct = avg !== null ? Math.min((avg/10)*100,100) : 0;
      return `<div class="avg-subject-row">
        <span class="avg-subject-name">${esc(s.name)}</span>
        <div class="avg-prog-wrap"><div class="avg-prog-fill" style="width:${pct}%"></div></div>
        <span class="avg-subject-val">${avg!==null?avg.toFixed(1):'–'}</span>
      </div>`;
    }).join('');
  }

  if (!subjects.length) {
    gridEl.innerHTML = '<div class="empty-msg" style="padding:3rem;text-align:center">Agrega tu primera materia para comenzar</div>';
    return;
  }

  gridEl.innerHTML = subjects.map(s => {
    const sGrades = grades.filter(g => g.subjectId === s.id);
    const avg     = calcSubjectAvg(s.id, grades);
    const color   = SUBJECT_COLORS[s.color] || '#888';
    const goal    = s.goal || 7;
    const pct     = avg !== null ? Math.min((avg/10)*100,100) : 0;
    const goalPct = Math.min((goal/10)*100,100);

    // Grade color based on performance vs goal
    let avgColor = 'var(--text-1)';
    if (avg !== null) {
      avgColor = avg >= goal ? 'var(--green)' : avg >= goal * 0.85 ? 'var(--amber)' : 'var(--red)';
    }

    const gradeRows = sGrades.length
      ? sGrades.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).map(g => {
          const norm = ((g.value / g.max) * 10).toFixed(1);
          const gColor = parseFloat(norm) >= goal ? 'var(--green)' : parseFloat(norm) >= goal*0.85 ? 'var(--amber)' : 'var(--red)';
          return `<div class="grade-row">
            <span class="grade-name">${esc(g.name)}</span>
            <span class="grade-val" style="color:${gColor}">${g.value}</span>
            <span class="grade-max">/ ${g.max}</span>
            ${g.date ? `<span style="font-size:.7rem;color:var(--text-3)">${formatDate(g.date)}</span>` : ''}
            <button class="grade-del icon-btn" style="color:var(--red)" onclick="deleteGrade('${g.id}')" title="Eliminar">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </button>
          </div>`;
        }).join('')
      : '<div class="empty-msg">Sin notas registradas</div>';

    return `
      <div class="subject-card">
        <div class="subject-card-head">
          <div class="subject-color-bar" style="background:${color}"></div>
          <div style="flex:1;min-width:0;">
            <div class="subject-title">${esc(s.name)}</div>
            ${s.teacher ? `<div style="font-size:.72rem;color:var(--text-3)">${esc(s.teacher)}</div>` : ''}
          </div>
          <div class="subject-avg-num" style="color:${avgColor}">${avg!==null?avg.toFixed(1):'–'}</div>
          <div style="display:flex;gap:4px;margin-left:8px;">
            <button class="icon-btn" title="Agregar nota" onclick="openGradeModal('${s.id}')">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
            <button class="icon-btn" title="Editar materia" onclick="openSubjectModal('${s.id}')">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8.5 1.5l2 2L4 10H2V8L8.5 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="icon-btn" title="Eliminar materia" style="color:var(--red)" onclick="deleteSubject('${s.id}')">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1.5 2.5h9M4.5 2.5v-1h3v1M3.5 2.5l.5 8h4l.5-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="subject-card-body">
          <div class="grade-rows">${gradeRows}</div>
        </div>

        <div class="subject-card-foot">
          <span class="subject-prog-label">Meta: ${goal}/10</span>
          <div class="prog-wrap" style="flex:1;margin:0 8px;">
            <div class="prog-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <span class="subject-prog-val">${avg!==null?avg.toFixed(1):'–'}/10</span>
        </div>
      </div>`;
  }).join('');
}