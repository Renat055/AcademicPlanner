/* ============================================================
   auth.js — Autenticación local (localStorage)
   Pantalla de bienvenida en primer uso, perfil persistente
   ============================================================ */

'use strict';

/* ---- Check first run ---- */
document.addEventListener('DOMContentLoaded', () => {
  const profile = DB.get('profile', null);
  // null means never set — show onboarding overlay
  if (profile === null || (typeof profile === 'object' && !profile.name)) {
    showOnboarding();
  }
});

/* ---- Onboarding overlay ---- */
function showOnboarding() {
  // Don't show twice
  if (document.getElementById('onboardingOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'onboardingOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:1000;
    background:var(--bg);
    display:flex;align-items:center;justify-content:center;
    padding:1rem;
    animation: fadeUp 300ms var(--ease) both;
  `;

  overlay.innerHTML = `
    <div style="
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:20px;
      padding:2.5rem;
      width:100%;max-width:400px;
      box-shadow:var(--shadow-modal);
      text-align:center;
    ">
      <div style="
        width:48px;height:48px;border-radius:12px;
        background:var(--text-1);margin:0 auto 1.5rem;
      "></div>

      <h2 style="
        font-size:1.35rem;font-weight:600;
        letter-spacing:-0.03em;margin-bottom:.5rem;
      ">Bienvenido a Academic Planner</h2>

      <p style="
        font-size:.875rem;color:var(--text-3);
        margin-bottom:2rem;line-height:1.6;
      ">Organiza tus materias, tareas y sesiones de estudio en un solo lugar. Comencemos con tu información básica.</p>

      <div style="text-align:left;">
        <div class="form-field">
          <label class="field-label">Tu nombre</label>
          <input class="field-input" id="ob_name" placeholder="Ej: Ana García" autofocus />
        </div>
        <div class="form-field">
          <label class="field-label">Universidad</label>
          <input class="field-input" id="ob_university" placeholder="Nombre de tu universidad" />
        </div>
        <div class="form-field" style="margin-bottom:0">
          <label class="field-label">Carrera</label>
          <input class="field-input" id="ob_career" placeholder="Ej: Ingeniería en Sistemas" />
        </div>
      </div>

      <button
        onclick="finishOnboarding()"
        class="btn btn-primary"
        style="width:100%;margin-top:1.5rem;justify-content:center;padding:10px;"
      >
        Comenzar
      </button>

      <button
        onclick="skipOnboarding()"
        style="
          display:block;margin:.75rem auto 0;
          font-size:.78rem;color:var(--text-3);
          background:none;border:none;cursor:pointer;
        "
      >Completar después</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Enter key on last field
  overlay.querySelector('#ob_career')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') finishOnboarding();
  });
}

function finishOnboarding() {
  const name       = document.getElementById('ob_name')?.value.trim();
  const university = document.getElementById('ob_university')?.value.trim();
  const career     = document.getElementById('ob_career')?.value.trim();

  if (!name) {
    document.getElementById('ob_name')?.focus();
    return;
  }

  DB.set('profile', { name, university, career, semester: '' });
  updateSidebarProfile();
  removeOnboarding();
  toast(`¡Bienvenido, ${name.split(' ')[0]}!`, 'success');
}

function skipOnboarding() {
  DB.set('profile', { name: '', university: '', career: '', semester: '' });
  removeOnboarding();
}

function removeOnboarding() {
  const overlay = document.getElementById('onboardingOverlay');
  if (!overlay) return;
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 250ms ease';
  setTimeout(() => overlay.remove(), 260);
}