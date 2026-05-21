(function () {
  if (window.__analysisManualDirectFixes) return;
  window.__analysisManualDirectFixes = true;

  const q = (id) => document.getElementById(id);
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, Number(value) || 0));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let geometryTimer = null;
  let geometryArmed = false;

  function stateRef() {
    try { return typeof state !== 'undefined' ? state : null; } catch { return null; }
  }

  function start() {
    injectStyles();
    patchGeometryKeyboard();
    patchCombinationCards();
    patchDesignDuplicate();
    patchHelpManual();
    setTimeout(() => { try { if (typeof safeRun === 'function') safeRun(); } catch {} }, 80);
  }

  function injectStyles() {
    if (q('analysisManualDirectStyles')) return;
    const style = document.createElement('style');
    style.id = 'analysisManualDirectStyles';
    style.textContent = `
      .operation-manual{display:grid;gap:14px;line-height:1.48;color:#17211d;overflow-wrap:anywhere}
      .operation-manual .manual-block{border:1px solid rgba(23,33,29,.12);border-radius:8px;background:#fff;padding:12px 14px}
      .operation-manual h2,.operation-manual h3{margin:0 0 8px;letter-spacing:0}.operation-manual p{margin:0}.operation-manual ul,.operation-manual ol{margin:8px 0 0 18px;padding:0}
      .input-panel label,.menu-dropdown button,.tree-item,.model-info-panel,.model-info-row,.model-info-row b{min-width:0;overflow-wrap:anywhere}
      .geometry-keyboard-hint{margin-top:8px;padding:10px 12px;border:1px solid rgba(23,33,29,.12);border-radius:8px;background:#f7faf8;color:#33443d;font-size:13px;line-height:1.35}
      .combo-card-editor{display:grid;gap:10px}.combo-card{display:grid;gap:8px;padding:10px;border:1px solid rgba(23,33,29,.12);border-radius:8px;background:#fff}
      .combo-card-head,.combo-factor-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(72px,.6fr);gap:8px}.combo-factor-grid{grid-template-columns:repeat(4,minmax(0,1fr));align-items:end}
      .combo-card label{display:grid;gap:4px;min-width:0;font-size:12px;color:#60706a}.combo-card input,.combo-card select{width:100%;min-width:0;box-sizing:border-box}
      .combo-card .combo-pattern{grid-template-columns:auto minmax(0,1fr);align-items:center;color:#17211d}
      body.design-view-active #view-design .input-section-canvas,body.design-view-active #reinforcementSection .input-section-canvas{display:none!important}
      body.design-view-active #reinforcementSection::after{content:"Reinforcement input section preview is hidden while Flexure / Shear is open to avoid duplicate section diagrams.";display:block;margin-top:8px;padding:10px 12px;border:1px solid rgba(23,33,29,.12);border-radius:8px;background:#f7faf8;color:#60706a;font-size:13px;line-height:1.35}
      @media(max-width:760px){.combo-card-head,.combo-factor-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function patchHelpManual() {
    const helpButton = [...document.querySelectorAll('.menu-action,button')].find((button) => button.textContent.trim().toLowerCase() === 'help');
    if (!helpButton || helpButton.dataset.analysisManualHelp) return;
    helpButton.dataset.analysisManualHelp = '1';
    helpButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (typeof switchTab === 'function') switchTab('messages');
      const target = q('messageWindow');
      if (target) target.innerHTML = operationManualHtml();
    }, true);
  }

  function operationManualHtml() {
    return `
      <article class="operation-manual">
        <section class="manual-block"><h2>Operation Manual</h2><p>This tool is an AS 3600 style design-aid for beams, one-way slab strips and two-way slab equivalent strips. Inputs define geometry, supports, loads, reinforcement and post-tensioning; the right-hand panels show model, actions, deflection, flexure/shear and report output.</p></section>
        <section class="manual-block"><h3>Analysis logic</h3><ol><li>Read member, section, material and load inputs.</li><li>Build the selected member model and support layout.</li><li>Apply self-weight, G, Q, transfer loads and post-tensioning balanced load where enabled.</li><li>Check service deflection, flexure, shear and punching shear where applicable.</li></ol></section>
        <section class="manual-block"><h3>Post-tensioning and deflection</h3><p>P/A, tendon force, losses and high/low points affect deflection because tendon drape is converted into an upward balanced load before the service deflection check.</p></section>
      </article>`;
  }

  function patchGeometryKeyboard() {
    const canvas = q('geometry3dCanvas');
    if (!canvas || canvas.dataset.analysisKeyboardPatch) return;
    canvas.dataset.analysisKeyboardPatch = '1';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', '3D concrete section geometry editor. Use arrow keys to move the cut section.');
    const wrapper = canvas.closest('.canvas-wrap') || canvas.parentElement;
    if (wrapper && !wrapper.querySelector('.geometry-keyboard-hint')) {
      const hint = document.createElement('div');
      hint.className = 'geometry-keyboard-hint';
      hint.textContent = 'Click the 3D section, then use Left/Right to move the cut location and Up/Down to change cut depth. Hold Shift for larger steps.';
      wrapper.appendChild(hint);
    }
    canvas.addEventListener('mouseenter', () => { geometryArmed = true; });
    canvas.addEventListener('mouseleave', () => { if (document.activeElement !== canvas) geometryArmed = false; });
    canvas.addEventListener('focus', () => { geometryArmed = true; });
    canvas.addEventListener('pointerdown', (event) => {
      geometryArmed = true;
      try { canvas.focus({ preventScroll: true }); } catch { try { canvas.focus(); } catch {} }
      event.preventDefault();
      event.stopImmediatePropagation();
      updateCutFromPointer(event, canvas);
    }, true);
    document.addEventListener('keydown', handleGeometryKey, true);
  }

  function handleGeometryKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const canvas = q('geometry3dCanvas');
    if (!canvas) return;
    const tag = String(event.target?.tagName || '').toLowerCase();
    const editing = event.target?.isContentEditable || ['input', 'select', 'textarea'].includes(tag);
    const focused = document.activeElement === canvas;
    if (editing && !focused) return;
    if (!focused && !geometryArmed) return;
    const limits = cutLimits(currentGeometryInput());
    let offset = Number(q('surfaceCutOffset')?.value || 0);
    let depth = Number(q('surfaceCutDepth')?.value || 0);
    if (event.key === 'ArrowLeft') offset -= event.shiftKey ? 100 : 25;
    if (event.key === 'ArrowRight') offset += event.shiftKey ? 100 : 25;
    if (event.key === 'ArrowUp') depth -= event.shiftKey ? 20 : 5;
    if (event.key === 'ArrowDown') depth += event.shiftKey ? 20 : 5;
    applyCut({ offset, depth, width: limits.width, face: q('surfaceCutFace')?.value || 'top' }, limits);
    event.preventDefault();
    event.stopPropagation();
  }

  function updateCutFromPointer(event, canvas) {
    const limits = cutLimits(currentGeometryInput());
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * canvas.width;
    const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * canvas.height;
    const offset = Math.round(((x / Math.max(canvas.width, 1)) * limits.overall - limits.width / 2) / 25) * 25;
    const depth = Math.round(Math.abs(y - canvas.height / 2) / 5) * 5;
    applyCut({ offset, depth, width: limits.width, face: y < canvas.height / 2 ? 'top' : 'bottom' }, limits);
  }

  function applyCut(values, limits = cutLimits(currentGeometryInput())) {
    const width = clamp(values.width || limits.width, 0, limits.overall);
    const offset = clamp(values.offset, 0, Math.max(0, limits.overall - width));
    const depth = clamp(values.depth, 0, limits.maxDepth);
    if (q('surfaceCutEnabled')) q('surfaceCutEnabled').checked = true;
    if (q('surfaceCutFace')) q('surfaceCutFace').value = values.face || 'top';
    if (q('surfaceCutDepth')) q('surfaceCutDepth').value = depth.toFixed(0);
    if (q('surfaceCutWidth')) q('surfaceCutWidth').value = width.toFixed(0);
    if (q('surfaceCutOffset')) q('surfaceCutOffset').value = offset.toFixed(0);
    try { if (typeof drawInputSectionPreview === 'function') drawInputSectionPreview(); } catch {}
    clearTimeout(geometryTimer);
    geometryTimer = setTimeout(() => { try { if (typeof safeRun === 'function') safeRun(); } catch {} }, 260);
  }

  function cutLimits(input = currentGeometryInput()) {
    let overall = Number(input.b || q('width')?.value || 1000);
    try { if (typeof sectionOverallWidth === 'function') overall = Number(sectionOverallWidth(input)); } catch {}
    overall = Math.max(50, overall || 1000);
    const depth = Math.max(80, Number(input.D || q('depth')?.value || 200));
    const existingWidth = Number(q('surfaceCutWidth')?.value || input.surfaceCutWidth || 0);
    const width = existingWidth > 0 ? Math.min(overall, existingWidth) : Math.min(overall, Math.max(150, overall * 0.25));
    return { overall, width, maxDepth: Math.max(0, depth - 40) };
  }

  function currentGeometryInput() {
    try { if (typeof currentSectionPreviewInput === 'function') return currentSectionPreviewInput(); } catch {}
    try { if (typeof readInputs === 'function') return readInputs(); } catch {}
    return stateRef()?.result?.input || {};
  }

  function patchCombinationCards() {
    if (typeof renderCombinations !== 'function' || renderCombinations.analysisManualComboPatch) return;
    const base = renderCombinations;
    renderCombinations = function () {
      const out = base.apply(this, arguments);
      renderComboCards();
      return out;
    };
    renderCombinations.analysisManualComboPatch = true;
    setTimeout(renderComboCards, 0);
  }

  function renderComboCards() {
    const rows = q('comboRows');
    const combos = stateRef()?.combinations;
    if (!rows || !combos) return;
    const holder = rows.closest('.mini-table');
    if (!holder) return;
    const table = holder.querySelector('table');
    if (table) table.style.display = 'none';
    let cardGrid = q('comboCardRows');
    if (!cardGrid) {
      cardGrid = document.createElement('div');
      cardGrid.id = 'comboCardRows';
      cardGrid.className = 'combo-card-editor';
      holder.appendChild(cardGrid);
    }
    cardGrid.innerHTML = combos.map(comboCardHtml).join('');
    cardGrid.querySelectorAll('input,select').forEach((control) => control.addEventListener('change', handleComboCardChange));
  }

  function comboCardHtml(combo, index) {
    const factor = (value) => {
      try { return typeof formatComboFactor === 'function' ? formatComboFactor(value) : Number(value || 0).toFixed(3).replace(/\.?0+$/, ''); } catch { return String(value || 0); }
    };
    return `
      <div class="combo-card">
        <div class="combo-card-head">
          <label>Name<input value="${esc(combo.name)}" data-combo-card-index="${index}" data-combo-card-field="name"></label>
          <label>Type<select data-combo-card-index="${index}" data-combo-card-field="type"><option value="ULS" ${combo.type === 'ULS' ? 'selected' : ''}>ULS</option><option value="SLS" ${combo.type === 'SLS' ? 'selected' : ''}>SLS</option><option value="DEF" ${combo.type === 'DEF' ? 'selected' : ''}>DEF</option></select></label>
        </div>
        <div class="combo-factor-grid">
          <label>SW factor<input type="number" step="0.05" value="${factor(combo.sw)}" data-combo-card-index="${index}" data-combo-card-field="sw"></label>
          <label>G factor<input type="number" step="0.05" value="${factor(combo.g)}" data-combo-card-index="${index}" data-combo-card-field="g"></label>
          <label>Q factor<input type="number" step="0.05" value="${factor(combo.q)}" data-combo-card-index="${index}" data-combo-card-field="q"></label>
          <label class="combo-pattern"><input type="checkbox" ${combo.pattern ? 'checked' : ''} data-combo-card-index="${index}" data-combo-card-field="pattern">Pattern</label>
        </div>
      </div>`;
  }

  function handleComboCardChange(event) {
    const target = event.currentTarget;
    const combo = stateRef()?.combinations?.[Number(target.dataset.comboCardIndex)];
    if (!combo) return;
    const field = target.dataset.comboCardField;
    if (field === 'pattern') combo.pattern = target.checked;
    else if (['sw', 'g', 'q'].includes(field)) combo[field] = Number(target.value);
    else combo[field] = target.value;
    if (typeof renderCombinations === 'function') renderCombinations();
    if (typeof safeRun === 'function') safeRun();
  }

  function patchDesignDuplicate() {
    syncDesignViewClass();
    if (typeof switchTab === 'function' && !switchTab.analysisManualDesignPatch) {
      const base = switchTab;
      switchTab = function (view) {
        const out = base.apply(this, arguments);
        syncDesignViewClass();
        return out;
      };
      switchTab.analysisManualDesignPatch = true;
    }
    document.querySelectorAll('.tab[data-view="design"],.menu-action[data-view="design"]').forEach((control) => control.addEventListener('click', () => setTimeout(syncDesignViewClass, 0)));
  }

  function syncDesignViewClass() {
    document.body.classList.toggle('design-view-active', Boolean(q('view-design')?.classList.contains('active')));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
