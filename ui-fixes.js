(function () {
  const $id = (id) => document.getElementById(id);
  const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
  const roundTo = (value, step) => Math.round(Number(value) / step) * step;

  function ecFromFc(fc) {
    const points = [
      [20, 24000],
      [25, 26700],
      [32, 30100],
      [40, 32800],
      [50, 34800],
      [65, 37400],
      [80, 39600],
      [100, 42200],
    ];
    const f = clampValue(Number(fc) || 32, points[0][0], points[points.length - 1][0]);
    for (let i = 1; i < points.length; i++) {
      const [f1, e1] = points[i];
      const [f0, e0] = points[i - 1];
      if (f <= f1) return Math.round(e0 + ((f - f0) / (f1 - f0)) * (e1 - e0));
    }
    return points[points.length - 1][1];
  }

  function syncEc() {
    if (!$id("ecAuto")?.checked || !$id("ec") || !$id("fc")) return;
    $id("ec").value = ecFromFc($id("fc").value);
  }

  function setupEc() {
    if (!$id("ecAuto")) return;
    $id("ecAuto").checked = true;
    syncEc();
    $id("fc")?.addEventListener("input", () => {
      syncEc();
      safeRun?.();
    });
    $id("ecAuto")?.addEventListener("change", () => {
      syncEc();
      safeRun?.();
    });
    $id("ec")?.addEventListener("input", (event) => {
      if (event.isTrusted && $id("ecAuto")?.checked) $id("ecAuto").checked = false;
    });
  }

  function setupInputToggles() {
    document.querySelectorAll(".input-panel > section").forEach((section, index) => {
      if (section.id === "workflowSection") return;
      const title = section.querySelector(".section-title");
      if (!title || title.querySelector("[data-input-toggle]")) return;
      if (!section.id) section.id = `inputSection${index + 1}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "compact-toggle input-toggle";
      button.dataset.inputToggle = section.id;
      button.addEventListener("click", () => setInputCollapsed(section.id, !section.classList.contains("input-section-collapsed"), true));
      title.appendChild(button);
      setInputCollapsed(section.id, readStored(`inputSectionCollapsed:${section.id}`, false), false);
    });
  }

  function setInputCollapsed(sectionId, collapsed, persist) {
    const section = $id(sectionId);
    const button = section?.querySelector(`[data-input-toggle="${sectionId}"]`);
    if (!section || !button) return;
    section.classList.toggle("input-section-collapsed", collapsed);
    button.textContent = collapsed ? "Show" : "Hide";
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (persist) writeStored(`inputSectionCollapsed:${sectionId}`, collapsed);
  }

  function setAllInputs(collapsed) {
    document.querySelectorAll(".input-panel > section").forEach((section) => {
      if (section.id && section.id !== "workflowSection") setInputCollapsed(section.id, collapsed, true);
    });
  }

  function readStored(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : value === "true";
    } catch {
      return fallback;
    }
  }

  function writeStored(key, value) {
    try {
      localStorage.setItem(key, value ? "true" : "false");
    } catch {
      // Storage can be disabled; the current session still updates.
    }
  }

  function setupMenus() {
    const dropdown = $id("menuDropdown");
    if (!dropdown) return;
    const menus = {
      file: [
        ["Calculate and open report", "report"],
        ["Save calculation to library", "save"],
        ["Export job file", "export"],
        ["Clear calculation library", "clear"],
      ],
      edit: [
        ["Edit member and materials", "memberSection"],
        ["Edit section geometry", "sectionGeometrySection"],
        ["Edit reinforcement schedule", "reinforcementSection"],
        ["Auto drape PT profile", "drape"],
      ],
      view: [
        ["Model panel", "model"],
        ["Loads diagram", "loads"],
        ["Deflection checks", "limits"],
        ["Show all input panels", "show"],
        ["Hide all input panels", "hide"],
      ],
    };
    document.querySelectorAll(".menu-command").forEach((button) => {
      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          const command = button.dataset.menuCommand;
          const items = menus[command] || menus.view;
          dropdown.innerHTML = `<div class="menu-dropdown-title">${command}</div>${items.map(([label, action]) => `<button type="button" data-ui-action="${action}">${label}</button>`).join("")}`;
          const rect = button.getBoundingClientRect();
          dropdown.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 292))}px`;
          dropdown.style.top = `${rect.bottom + 6}px`;
          dropdown.hidden = false;
        },
        true
      );
    });
    dropdown.addEventListener("click", (event) => {
      const action = event.target?.dataset?.uiAction;
      if (!action) return;
      event.stopPropagation();
      runMenuAction(action);
      dropdown.hidden = true;
    });
    document.addEventListener("click", (event) => {
      if (!dropdown.contains(event.target)) dropdown.hidden = true;
    });
  }

  function runMenuAction(action) {
    if (action === "report") {
      safeRun();
      appendCalculationSheet();
      switchTab("report");
    } else if (action === "save") {
      saveCurrentCheckToProject?.();
      switchTab("messages");
    } else if (action === "export") {
      exportProjectFile?.();
    } else if (action === "clear") {
      clearProjectFile?.();
      switchTab("messages");
    } else if (["model", "loads", "limits"].includes(action)) {
      safeRun();
      switchTab(action);
    } else if (action === "show") {
      setAllInputs(false);
    } else if (action === "hide") {
      setAllInputs(true);
    } else if (action === "drape") {
      autoDrapePtProfile?.();
      safeRun();
    } else {
      setInputCollapsed(action, false, true);
      $id(action)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function setupCalculate() {
    $id("calculateBtn")?.addEventListener("click", () => {
      safeRun();
      appendCalculationSheet();
      switchTab("report");
    });
    $id("saveCalcLibraryBtn")?.addEventListener("click", () => {
      saveCurrentCheckToProject?.();
      switchTab("messages");
    });
    $id("clearCalcLibraryBtn")?.addEventListener("click", () => {
      clearProjectFile?.();
      switchTab("messages");
    });
  }

  function appendCalculationSheet() {
    const report = $id("report");
    if (!report || !state?.result || report.value.includes("CALCULATION SHEET")) return;
    const input = state.result.input;
    const lines = ["CALCULATION SHEET"];
    lines.push(`  Member type: ${memberTypeLabel(input.memberType)}`);
    lines.push(`  Section: ${sectionShapeLabel(input)}, b=${input.b} mm, D=${input.D} mm, d=${input.d.toFixed(0)} mm, Ag=${input.Agross.toFixed(0)} mm2, Ig=${input.Igross.toExponential(3)} mm4`);
    lines.push(`  Materials: f'c=${input.fc} MPa, fsy=${input.fsy} MPa, Ec=${input.Ec.toFixed(0)} MPa`);
    lines.push(`  Reinforcement top: ${formatRebarLayerSchedule(input, "top")}`);
    lines.push(`  Reinforcement bottom: ${formatRebarLayerSchedule(input, "bottom")}`);
    if (state.result.mode === "twoWay") {
      const twoWay = state.result.twoWay;
      lines.push(`  Panel: X=${input.panelX.toFixed(2)} m, Y=${input.panelY.toFixed(2)} m, column=${input.columnX} x ${input.columnY} mm, fixity=${input.columnFixity.toFixed(0)}%`);
      lines.push(`  Loads: ULS=${twoWay.ulsLoad.toFixed(2)} kPa, SLS=${twoWay.serviceLoad.toFixed(2)} kPa`);
      lines.push(`  Deflection: short=${(twoWay.shortPlate.maxDeflectionM * 1000).toFixed(2)} mm, long=${(twoWay.longPlate.maxDeflectionM * 1000).toFixed(2)} mm`);
    } else {
      lines.push(`  Spans: ${input.spans.map((span, i) => `S${i + 1} L=${span.length} m, G=${span.g}, Q=${span.q}`).join("; ")}`);
      lines.push(`  Strength: max Mu*=${Math.abs(state.result.ultimate.maxMoment.value).toFixed(1)} kNm, max Vu*=${Math.abs(state.result.ultimate.maxShear.value).toFixed(1)} kN`);
      lines.push(`  Deflection: short=${(Math.abs(state.result.deflection.shortMax.value) * 1000).toFixed(2)} mm, long=${(Math.abs(state.result.deflection.longMax.value) * 1000).toFixed(2)} mm`);
    }
    const split = report.value.indexOf("\n\n");
    report.value = split > 0 ? `${report.value.slice(0, split + 2)}\n${lines.join("\n")}\n${report.value.slice(split + 2)}` : `${lines.join("\n")}\n\n${report.value}`;
  }

  function setupReportPatch() {
    if (typeof renderReport !== "function") return;
    const baseRenderReport = renderReport;
    renderReport = function () {
      baseRenderReport();
      appendCalculationSheet();
    };
    appendCalculationSheet();
  }

  function setupTwoWaySpans() {
    state.twoWaySpansX = state.twoWaySpansX || [Number($id("panelX")?.value || defaults.panelX)];
    state.twoWaySpansY = state.twoWaySpansY || [Number($id("panelY")?.value || defaults.panelY)];
    const render = () => {
      ["x", "y"].forEach((axis) => {
        const container = $id(axis === "x" ? "panelXSpans" : "panelYSpans");
        const spans = axis === "x" ? state.twoWaySpansX : state.twoWaySpansY;
        if (!container) return;
        container.innerHTML = spans
          .map((span, index) => `<div class="span-row compact-span-row"><label>${axis.toUpperCase()} span ${index + 1} (m)<input type="number" min="0.5" step="0.1" value="${roundTo(span, 0.1).toFixed(1)}" data-panel-axis="${axis}" data-panel-span="${index}"></label><button type="button" data-remove-panel-axis="${axis}" data-remove-panel-span="${index}">x</button></div>`)
          .join("");
      });
      syncPanelTotals();
    };
    const add = (axis) => {
      const spans = axis === "x" ? state.twoWaySpansX : state.twoWaySpansY;
      spans.push(spans[spans.length - 1] || 6);
      render();
      safeRun();
    };
    document.addEventListener("change", (event) => {
      const input = event.target.closest?.("[data-panel-axis]");
      if (!input) return;
      const spans = input.dataset.panelAxis === "x" ? state.twoWaySpansX : state.twoWaySpansY;
      spans[Number(input.dataset.panelSpan)] = Math.max(0.5, Number(input.value) || 0.5);
      render();
      safeRun();
    });
    document.addEventListener("click", (event) => {
      const remove = event.target.closest?.("[data-remove-panel-axis]");
      if (remove) {
        const spans = remove.dataset.removePanelAxis === "x" ? state.twoWaySpansX : state.twoWaySpansY;
        if (spans.length > 1) spans.splice(Number(remove.dataset.removePanelSpan), 1);
        render();
        safeRun();
      }
    });
    $id("addPanelXSpanBtn")?.addEventListener("click", () => add("x"));
    $id("addPanelYSpanBtn")?.addEventListener("click", () => add("y"));
    render();
  }

  function syncPanelTotals() {
    const x = (state.twoWaySpansX || []).reduce((sum, span) => sum + Math.max(0.5, Number(span) || 0.5), 0);
    const y = (state.twoWaySpansY || []).reduce((sum, span) => sum + Math.max(0.5, Number(span) || 0.5), 0);
    if ($id("panelX")) $id("panelX").value = roundTo(x, 0.1).toFixed(1);
    if ($id("panelY")) $id("panelY").value = roundTo(y, 0.1).toFixed(1);
  }

  function setupInputPatch() {
    if (typeof readInputs !== "function") return;
    const baseReadInputs = readInputs;
    readInputs = function () {
      syncEc();
      syncPanelTotals();
      const data = baseReadInputs();
      data.EcAuto = Boolean($id("ecAuto")?.checked);
      data.EcCalculated = ecFromFc(data.fc);
      data.transferX = Number($id("transferX")?.value || data.panelX / 2);
      data.transferY = Number($id("transferY")?.value || data.panelY / 2);
      data.deflectionViewScale = state.deflectionViewScale || 0.5;
      return data;
    };
  }

  function setupLoadsPatch() {
    if (typeof renderLoads !== "function") return;
    const baseRenderLoads = renderLoads;
    renderLoads = function () {
      baseRenderLoads();
      drawLoadPatch();
    };
    drawLoadPatch();
  }

  function drawLoadPatch() {
    const canvas = $id("loadCanvas");
    if (!canvas?.getContext || !state?.result) return;
    const ctx = canvas.getContext("2d");
    clear(ctx, canvas);
    ctx.fillStyle = "#17211d";
    ctx.font = "18px system-ui";
    ctx.fillText("Loads, supports and transfer actions", 36, 38);
    ctx.font = "13px system-ui";
    ctx.fillStyle = "#60706a";
    const input = state.result.input;
    if (state.result.mode === "twoWay") {
      ctx.fillText(`Panel ${input.panelX.toFixed(2)} x ${input.panelY.toFixed(2)} m with area loads and transfer load marker.`, 36, 60);
      const px = 90, py = 90, pw = 820, ph = 260;
      ctx.strokeStyle = "#17211d";
      ctx.lineWidth = 3;
      ctx.strokeRect(px, py, pw, ph);
      drawPanelArrows(ctx, px, py, pw, ph, `G=${input.areaG.toFixed(1)} kPa, Q=${input.areaQ.toFixed(1)} kPa`);
      ctx.fillStyle = "#60706a";
      ctx.fillRect(px + pw / 2 - 20, py + ph / 2 - 20, 40, 40);
      if (input.transferLoadKn > 0) {
        const tx = px + clampValue((input.transferX || input.panelX / 2) / input.panelX, 0, 1) * pw;
        const ty = py + clampValue((input.transferY || input.panelY / 2) / input.panelY, 0, 1) * ph;
        ctx.strokeStyle = "#bd5b32";
        ctx.fillStyle = "rgba(189,91,50,0.16)";
        ctx.beginPath();
        ctx.arc(tx, ty, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#bd5b32";
        ctx.fillText(`transfer ${input.transferLoadKn.toFixed(0)} kN`, tx + 24, ty - 6);
      }
    } else {
      ctx.fillText(`${memberTypeLabel(input.memberType)} line loads with supports and restraint labels.`, 36, 60);
      const pad = 80, y = 220;
      const total = state.result.ultimate.totalLength;
      const scale = (canvas.width - 2 * pad) / total;
      ctx.strokeStyle = "#17211d";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(canvas.width - pad, y);
      ctx.stroke();
      const supports = spanSupportLocations(input);
      supports.forEach((supportX, index) => {
        const x = pad + supportX * scale;
        drawSupport(ctx, x, y + 7);
        ctx.fillStyle = "#60706a";
        ctx.fillText(`S${index + 1} ${supportFixityPercent(input, index).toFixed(0)}%`, x - 18, y + 58);
      });
      input.spans.forEach((span, index) => {
        const x1 = pad + supports[index] * scale;
        const x2 = pad + supports[index + 1] * scale;
        drawLineArrows(ctx, x1, x2, y - 90, `G=${span.g}, Q=${span.q} kN/m`);
      });
    }
  }

  function drawPanelArrows(ctx, px, py, pw, ph, label) {
    ctx.save();
    ctx.strokeStyle = "#bd5b32";
    ctx.fillStyle = "#bd5b32";
    for (let i = 1; i <= 5; i++) {
      for (let j = 1; j <= 3; j++) {
        const x = px + (pw * i) / 6;
        const y = py + (ph * j) / 4;
        ctx.beginPath();
        ctx.moveTo(x, y - 22);
        ctx.lineTo(x, y + 10);
        ctx.stroke();
      }
    }
    ctx.fillText(label, px + 14, py + 22);
    ctx.restore();
  }

  function drawLineArrows(ctx, x1, x2, y, label) {
    ctx.save();
    ctx.strokeStyle = "#bd5b32";
    ctx.fillStyle = "#bd5b32";
    for (let x = x1 + 16; x < x2 - 8; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 52);
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.fillText(label, (x1 + x2) / 2, y - 10);
    ctx.restore();
  }

  function setupDeflectionWheel() {
    state.deflectionViewScale = state.deflectionViewScale || 0.5;
    $id("limitCanvas")?.addEventListener("wheel", (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      state.deflectionViewScale = clampValue((state.deflectionViewScale || 0.5) * factor, 0.25, 3);
      if (state.result?.input) state.result.input.deflectionViewScale = state.deflectionViewScale;
      drawLimitDiagrams?.();
      renderDeflectionSummary?.();
    }, { passive: false });
  }

  setupEc();
  setupInputToggles();
  setupMenus();
  setupCalculate();
  setupTwoWaySpans();
  setupInputPatch();
  setupReportPatch();
  setupLoadsPatch();
  setupDeflectionWheel();
  safeRun?.();
})();
