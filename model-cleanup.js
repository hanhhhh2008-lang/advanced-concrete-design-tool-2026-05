(function () {
  const q = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const call = (name, ...args) => (typeof window[name] === "function" ? window[name](...args) : undefined);

  function start() {
    layoutModelPanel();
    movePtSwitch();
    hideOldInputs();
    inputMenu();
    xOnlySpans();
    moveReoDiagram();
    punchPanel();
    patchReadInputs();
    patchPt();
    patchDraw();
    patchRun();
    ptVisibility();
    dragPt();
    refresh();
    if (typeof safeRun === "function") safeRun();
  }

  function layoutModelPanel() {
    const canvas = q("modelCanvas");
    if (canvas) {
      canvas.width = 1400;
      canvas.height = 660;
    }
    const pt = q("ptProfileCanvas");
    if (pt) {
      pt.width = 1400;
      pt.height = 620;
    }
    document.querySelectorAll(".model-subhead").forEach((h) => {
      if (/PT Tendon/i.test(h.textContent || "")) h.classList.add("model-pt-heading");
    });
    if (!q("modelInfoPanel") && canvas) {
      const wrap = canvas.closest(".canvas-wrap");
      const grid = document.createElement("div");
      grid.className = "model-overview-grid";
      wrap.before(grid);
      grid.appendChild(wrap);
      const info = document.createElement("aside");
      info.id = "modelInfoPanel";
      info.className = "model-info-panel";
      grid.appendChild(info);
    }
  }

  function movePtSwitch() {
    const label = q("ptEnabled")?.closest("label");
    const member = q("memberSection");
    const sw = q("selfWeight")?.closest("label");
    if (label && member && sw && label.parentElement !== member) member.insertBefore(label, sw);
    label?.classList.add("pt-member-toggle");
  }

  function hideOldInputs() {
    ["elementsPerSpan", "stressCompFactor", "stressTensFactor", "plateGrid"].forEach((id) => q(id)?.closest("label")?.classList.add("compat-control"));
    q("panelYSpans")?.closest(".span-editor")?.classList.add("compat-control");
    q("addPanelYSpanBtn")?.closest(".span-editor")?.classList.add("compat-control");
    labelText("panelX", "X design length (m)");
    labelText("panelY", "Design strip width (m)");
  }

  function labelText(id, text) {
    const node = [...(q(id)?.closest("label")?.childNodes || [])].find((n) => n.nodeType === Node.TEXT_NODE);
    if (node) node.textContent = text;
  }

  function inputMenu() {
    const old = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Input");
    const menu = q("menuDropdown");
    if (!old || !menu || old.dataset.cleanInputReady) return;
    const btn = old.cloneNode(true);
    btn.className = "menu-command";
    btn.dataset.cleanInputReady = "1";
    btn.removeAttribute("data-view");
    old.replaceWith(btn);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const two = (q("memberType")?.value || "twoWay") === "twoWay";
      const items = [
        ["Member, materials and PT", "memberSection", "section size, f'c, Ec and tendon switch"],
        ["Section geometry", "sectionGeometrySection", "shape, flange and cuts"],
        [two ? "Two-way X strip panel" : "Span geometry", two ? "twoWayPanelSection" : "spanInputSection", two ? "X spans, columns and transfer load" : "spans and support restraint"],
        ["Reinforcement schedule", "reinforcementSection", "top and bottom layer spacing"],
        ["Post-tensioning force", "postTensioningSection", "force, losses and P/A"],
        ["PT tendon profile", "ptProfileSection", "manual high and low point control"],
        ["Deflection / crack control", "deflectionParameterSection", "creep, shrinkage and crack settings"],
      ];
      menu.innerHTML = `<div class="menu-dropdown-title">Input categories</div><div class="input-category-panel">${items.map(([a, b, c]) => `<button type="button" data-clean-jump="${b}"><span>${esc(a)}</span><small>${esc(c)}</small></button>`).join("")}</div>`;
      const r = btn.getBoundingClientRect();
      menu.style.left = `${Math.max(12, Math.min(r.left, innerWidth - 382))}px`;
      menu.style.top = `${r.bottom + 6}px`;
      menu.hidden = false;
    });
    menu.addEventListener("click", (e) => {
      const id = e.target?.closest?.("[data-clean-jump]")?.dataset.cleanJump;
      if (!id) return;
      const section = q(id);
      if (!section) return;
      e.stopPropagation();
      section.hidden = false;
      section.style.display = "";
      section.classList.remove("input-section-collapsed");
      section.querySelector("[data-input-toggle]") && (section.querySelector("[data-input-toggle]").textContent = "Hide");
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      menu.hidden = true;
    });
  }

  function xOnlySpans() {
    state.twoWaySpansX ||= [Number(q("panelX")?.value || defaults.panelX || 8)];
    state.twoWaySpansY = [Number(q("panelY")?.value || defaults.panelY || 7)];
    drawXRows();
    if (!q("twoWayXModeNote") && q("twoWayPanelSection")) {
      const p = document.createElement("p");
      p.id = "twoWayXModeNote";
      p.className = "section-hint";
      p.textContent = "AS 3600-style equivalent frame input: edit X spans only, then review column-strip, middle-strip and punching-shear actions.";
      q("twoWayPanelSection").querySelector(".section-title")?.after(p);
    }
    q("addPanelXSpanBtn")?.addEventListener("click", () => {
      state.twoWaySpansX.push(state.twoWaySpansX.at(-1) || 6);
      drawXRows();
      safeRun?.();
    });
  }

  function drawXRows() {
    const box = q("panelXSpans");
    if (!box) return;
    box.innerHTML = state.twoWaySpansX.map((v, i) => `<div class="span-row compact-span-row"><label>X span ${i + 1} (m)<input type="number" min="0.5" step="0.1" value="${Number(v).toFixed(1)}" data-clean-x="${i}"></label><button type="button" data-clean-rx="${i}">x</button></div>`).join("");
    box.querySelectorAll("[data-clean-x]").forEach((el) => el.addEventListener("change", () => {
      state.twoWaySpansX[Number(el.dataset.cleanX)] = Math.max(0.5, Number(el.value) || 0.5);
      syncX();
      drawXRows();
      safeRun?.();
    }));
    box.querySelectorAll("[data-clean-rx]").forEach((el) => el.addEventListener("click", () => {
      if (state.twoWaySpansX.length > 1) state.twoWaySpansX.splice(Number(el.dataset.cleanRx), 1);
      syncX();
      drawXRows();
      safeRun?.();
    }));
    syncX();
  }

  function syncX() {
    if (q("panelX")) q("panelX").value = state.twoWaySpansX.reduce((s, v) => s + Math.max(0.5, Number(v) || 0.5), 0).toFixed(1);
    state.twoWaySpansY = [Math.max(1, Number(q("panelY")?.value || defaults.panelY || 7))];
  }

  function moveReoDiagram() {
    const wrap = document.querySelector(".input-section-canvas");
    const stack = document.querySelector("#view-design .design-stack");
    if (wrap && stack && !stack.contains(wrap)) {
      wrap.classList.add("right-side-diagram");
      stack.prepend(wrap);
    }
  }

  function punchPanel() {
    if (q("view-actions") && !q("punchingShearPanel")) {
      const p = document.createElement("aside");
      p.id = "punchingShearPanel";
      p.className = "punching-shear-panel";
      q("view-actions").appendChild(p);
    }
  }

  function patchReadInputs() {
    if (typeof readInputs !== "function" || readInputs.cleanPatch) return;
    const base = readInputs;
    readInputs = function () {
      syncX();
      const data = base();
      if (data.memberType === "twoWay") {
        data.twoWaySpansX = state.twoWaySpansX.slice();
        data.designStripWidth = data.panelY;
        data.transferX = Number(q("transferX")?.value || data.panelX / 2);
        data.transferY = Number(q("transferY")?.value || data.panelY / 2);
      }
      return data;
    };
    readInputs.cleanPatch = true;
  }

  function patchPt() {
    if (typeof ptProfileCounts === "function") {
      ptProfileCounts = function (input = null) {
        const type = input?.memberType || q("memberType")?.value || "twoWay";
        if (type === "twoWay") return { highCount: Math.max(1, state.twoWaySpansX?.length || 1) + 1, lowCount: Math.max(1, state.twoWaySpansX?.length || 1) };
        return { highCount: state.spans.length + 1, lowCount: state.spans.length };
      };
    }
    if (typeof autoDrapePtProfile === "function") {
      autoDrapePtProfile = function () {
        if (q("ptEnabled")) q("ptEnabled").checked = true;
        if (q("ptTopCover")) q("ptTopCover").value = 25;
        if (q("ptBottomCover")) q("ptBottomCover").value = 25;
        const lim = typeof ptProfileLimits === "function" ? ptProfileLimits() : { min: 31, max: Math.max(31, Number(q("depth")?.value || 220) - 31) };
        const n = typeof ptProfileCounts === "function" ? ptProfileCounts() : { highCount: 2, lowCount: 1 };
        state.ptProfile.highPoints = Array.from({ length: n.highCount }, () => lim.min);
        state.ptProfile.lowPoints = Array.from({ length: n.lowCount }, () => lim.max);
        if (q("ptAnchorHeight")) q("ptAnchorHeight").value = lim.min.toFixed(0);
        renderPtProfile?.();
        syncPt();
        safeRun?.();
      };
      q("ptAutoProfileBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        autoDrapePtProfile();
      }, true);
    }
  }

  function ptVisibility() {
    q("ptEnabled")?.addEventListener("change", () => {
      syncPt();
      renderPtProfile?.();
      safeRun?.();
    });
    syncPt();
  }

  function syncPt() {
    const on = Boolean(q("ptEnabled")?.checked);
    document.body.classList.toggle("pt-enabled", on);
    ["postTensioningSection", "ptProfileSection"].forEach((id) => {
      const section = q(id);
      if (section) section.hidden = !on;
    });
  }

  function patchDraw() {
    if (typeof drawModel === "function") drawModel = drawModelClean;
    if (typeof drawPtInputPreview === "function") drawPtInputPreview = drawPtClean;
    if (typeof drawTwoWayDiagrams === "function") drawTwoWayDiagrams = drawActionsClean;
    if (typeof drawTwoWayLimitDiagrams === "function") drawTwoWayLimitDiagrams = drawLimitClean;
  }

  function patchRun() {
    if (typeof safeRun === "function" && !safeRun.cleanPatch) {
      const base = safeRun;
      safeRun = function () {
        const out = base();
        refresh();
        return out;
      };
      safeRun.cleanPatch = true;
    }
    if (typeof renderSummary === "function" && !renderSummary.cleanPatch) {
      const base = renderSummary;
      renderSummary = function () {
        base();
        modelInfo();
      };
      renderSummary.cleanPatch = true;
    }
  }

  function refresh() {
    moveReoDiagram();
    punchPanel();
    syncPt();
    modelInfo();
    punchInfo();
  }

  function drawModelClean() {
    if (!state.result) return;
    state.result.mode === "twoWay" ? drawTwoWayModel() : drawLineModel();
    modelInfo();
  }

  function drawTwoWayModel() {
    const input = state.result.input, canvas = q("modelCanvas"), ctx = canvas.getContext("2d");
    clear(ctx, canvas);
    title(ctx, "Two-way X-direction strip model", "Labels are kept in the side panel so the drawing stays readable.", 34, 44);
    const r = fit(input.panelX, input.panelY, 104, 96, canvas.width - 208, canvas.height - 190);
    ctx.fillStyle = "#f7fbff"; ctx.strokeStyle = "#17211d"; ctx.lineWidth = 3; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeRect(r.x, r.y, r.w, r.h);
    const strip = clamp((input.columnStripPercent || 50) / 100, 0.2, 0.85) * r.h;
    ctx.fillStyle = "rgba(10,132,255,0.13)"; ctx.fillRect(r.x, r.y + r.h / 2 - strip / 2, r.w, strip);
    ctx.fillStyle = "rgba(255,138,31,0.11)"; ctx.fillRect(r.x, r.y, r.w, r.h / 2 - strip / 2); ctx.fillRect(r.x, r.y + r.h / 2 + strip / 2, r.w, r.h / 2 - strip / 2);
    spanTicks(ctx, r, state.twoWaySpansX || [input.panelX]);
    dim(ctx, r.x, r.y + r.h + 34, r.x + r.w, r.y + r.h + 34, `X length ${input.panelX.toFixed(2)} m`);
    dim(ctx, r.x - 36, r.y, r.x - 36, r.y + r.h, `strip width ${input.panelY.toFixed(2)} m`, true);
    col(ctx, r.x + r.w / 2, r.y + r.h / 2, Math.max(22, input.columnX / 1000 * r.scale), Math.max(22, input.columnY / 1000 * r.scale));
    transfer(ctx, r, input);
    legend(ctx, [["#0a84ff", "column strip"], ["#ff8a1f", "middle strip"], ["#60706a", "column"], ["#bd5b32", "transfer load"]], r.x, canvas.height - 54);
  }

  function drawLineModel() {
    const { input, ultimate, strengthCombo } = state.result, canvas = q("modelCanvas"), ctx = canvas.getContext("2d");
    clear(ctx, canvas);
    const pad = 88, y = 330, total = Math.max(1, ultimate.totalLength || input.spans.reduce((s, p) => s + p.length, 0)), sx = (canvas.width - 2 * pad) / total;
    title(ctx, `${input.memberType === "beam" ? "Beam" : "One-way slab"} span model`, "Loads and support restraint are summarised beside the model.", 34, 44);
    ctx.strokeStyle = "#17211d"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(canvas.width - pad, y); ctx.stroke();
    const supports = typeof spanSupportLocations === "function" ? spanSupportLocations(input) : input.spans.reduce((a, p) => [...a, a.at(-1) + p.length], [0]);
    supports.forEach((s, i) => { support(ctx, pad + s * sx, y + 8); ctx.fillStyle = "#17211d"; ctx.font = "13px system-ui"; ctx.textAlign = "center"; ctx.fillText(`S${i + 1}`, pad + s * sx, y + 62); });
    input.spans.forEach((span, i) => {
      const x1 = pad + supports[i] * sx, x2 = pad + supports[i + 1] * sx;
      arrows(ctx, x1, x2, y - 112); dim(ctx, x1, y + 90, x2, y + 90, `L${i + 1} ${span.length.toFixed(2)} m`);
      const wu = strengthCombo.sw * input.selfWeightLoad + strengthCombo.g * (span.g + (input.wetLineLoad || 0)) + strengthCombo.q * span.q;
      ctx.fillStyle = "#60706a"; ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.fillText(`G ${span.g.toFixed(1)} / Q ${span.q.toFixed(1)} / wu ${wu.toFixed(1)}`, (x1 + x2) / 2, y - 132);
    });
    legend(ctx, [["#17211d", "member"], ["#bd5b32", "gravity load"], ["#60706a", "support/restraint"]], pad, canvas.height - 54);
  }

  function drawPtClean() {
    const canvas = q("ptProfileCanvas"); if (!canvas?.getContext) return;
    const ctx = canvas.getContext("2d"); clear(ctx, canvas);
    if (!q("ptEnabled")?.checked) return title(ctx, "Post-tensioning is off", "Turn on Include post-tensioning tendons in the Member panel to edit the tendon profile.", 34, 64);
    const input = typeof previewPtInputFromDom === "function" ? previewPtInputFromDom() : state.result?.input || readInputs();
    const r = ptRect(canvas, input);
    title(ctx, "Editable PT tendon profile", "Drag high or low points, or type exact values in the PT Profile inputs.", 34, 42);
    depth(ctx, r, input); curve(ctx, input, r);
    const pts = ptPoints(input, r);
    pts.h.forEach((p, i) => dot(ctx, p.x, p.y, `H${i + 1}`, "#0a84ff"));
    pts.l.forEach((p, i) => dot(ctx, p.x, p.y, `L${i + 1}`, "#bd5b32"));
    legend(ctx, [["#0a84ff", "high at column"], ["#bd5b32", "low at midspan"], ["#a16207", "tendon centreline"], ["#60706a", "0 / mid / full depth"]], r.left, canvas.height - 46);
  }

  function drawActionsClean() {
    const { input, twoWay } = state.result, canvas = q("diagramCanvas"), ctx = canvas.getContext("2d");
    clear(ctx, canvas); title(ctx, "Moments, shear and punching shear", "X-direction column/middle strips with AS 3600 punching shear at the column.", 34, 42);
    barChart(ctx, twoWay.strips, 70, 330, 260, 560);
    const row = as3600(twoWay.supportShear); punchSketch(ctx, input, 760, 124, 460, 260, row); if (row) gauge(ctx, row, 760, 474, 460, 126, "AS 3600 punching shear demand / capacity");
    punchInfo();
  }

  function drawLimitClean() {
    const { input, twoWay } = state.result, canvas = q("limitCanvas"), ctx = canvas.getContext("2d"); clear(ctx, canvas);
    const limit = input.panelX * 1000 / input.deflectionRatio;
    const data = twoWay.shortPlate.xProfile.map((p, i) => ({ x: p.x, shortMm: p.defl * 1000, longMm: (twoWay.longPlate.xProfile[i]?.defl || p.defl) * 1000, limitMm: limit }));
    if (typeof drawDeflectionComparisonDiagram === "function") drawDeflectionComparisonDiagram(ctx, canvas, data, 70, 250, 220, "X-direction strip deflection: short-term / long-term", "#415f91", "#bd5b32");
    const row = as3600(twoWay.supportShear); if (row) gauge(ctx, row, 70, 570, canvas.width - 140, 110, "Punching shear remains checked in strength design");
  }

  function modelInfo() {
    const panel = q("modelInfoPanel"), input = state.result?.input || safeRead(); if (!panel || !input) return;
    const two = state.result?.mode === "twoWay" ? state.result.twoWay : null, row = as3600(two?.supportShear || []);
    const rows = [
      ["Member", input.memberType === "twoWay" ? "Two-way slab, X-direction equivalent frame" : member(input.memberType)],
      ["Geometry", `${shape(input)}, b=${input.b || 1000} mm, D=${input.D} mm, cover=${input.cover} mm`],
      ["Reinforcement", `Top: ${reo(input, "top")}; Bottom: ${reo(input, "bottom")}`],
      ["P/A", `${pa(input).toFixed(2)} MPa ${input.ptEnabled ? "(active)" : "(PT off)"}`],
      ["Loads", input.memberType === "twoWay" ? `G=${input.areaG.toFixed(1)} kPa, Q=${input.areaQ.toFixed(1)} kPa, transfer=${(input.transferLoadKn || 0).toFixed(0)} kN` : `${input.spans.length} span load set`],
      ["Support / restraint", input.memberType === "twoWay" ? `${input.supportType}, column/slab fixity ${input.columnFixity.toFixed(0)}%` : fix(input)],
    ];
    if (input.memberType === "twoWay") rows.push(["Strip model", `X length ${input.panelX.toFixed(2)} m, strip width ${input.panelY.toFixed(2)} m, column strip ${input.columnStripPercent.toFixed(0)}%, middle strip ${(100 - input.columnStripPercent).toFixed(0)}%`]);
    if (row) rows.push(["Punching shear", `${(row.util * 100).toFixed(0)}% util, Vu*=${row.Mu.toFixed(1)} kN, phiVu=${row.phiMu.toFixed(1)} kN`]);
    if (input.memberType === "beam") rows.push(["Shear ligs", `N${q("shearLigDia")?.value || 10}, ${q("shearLigLegs")?.value || 2} legs @ ${q("shearLigSpacing")?.value || 200} mm`]);
    panel.innerHTML = `<h3>Model Summary</h3><div class="model-info-list">${rows.map(([a, b]) => `<div class="model-info-row"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join("")}</div><p class="model-info-note">Key numbers are kept here so the diagrams can stay clean and readable.</p>`;
  }

  function punchInfo() {
    const panel = q("punchingShearPanel"); if (!panel) return;
    if (state.result?.mode !== "twoWay") return panel.innerHTML = `<h3>Punching Shear</h3><p class="model-info-note">Punching shear is shown for two-way slab panels.</p>`;
    const row = as3600(state.result.twoWay.supportShear), input = state.result.input; if (!row) return;
    panel.innerHTML = `<h3>AS 3600 Punching Shear</h3><div class="punching-shear-grid"><div><span>Demand Vu*</span><b>${row.Mu.toFixed(1)} kN</b></div><div><span>Capacity phiVu</span><b>${row.phiMu.toFixed(1)} kN</b></div><div><span>Utilisation</span><b>${(row.util * 100).toFixed(0)}%</b></div></div><p class="model-info-note">Critical perimeter is drawn around the ${input.columnX.toFixed(0)} x ${input.columnY.toFixed(0)} mm column. Review final design against AS 3600:2018 project requirements.</p>`;
  }

  function dragPt() {
    const canvas = q("ptProfileCanvas"); if (!canvas) return;
    let active = null;
    const pick = (e) => {
      if (!q("ptEnabled")?.checked) return null;
      const input = typeof previewPtInputFromDom === "function" ? previewPtInputFromDom() : readInputs(), r = ptRect(canvas, input), p = cpoint(e, canvas), pts = ptPoints(input, r);
      const all = [...pts.h.map((x, i) => ({ ...x, kind: "highPoints", i })), ...pts.l.map((x, i) => ({ ...x, kind: "lowPoints", i }))];
      all.sort((a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y)); return all[0];
    };
    const apply = (e, done) => {
      if (!active) return;
      const input = typeof previewPtInputFromDom === "function" ? previewPtInputFromDom() : readInputs(), r = ptRect(canvas, input), p = cpoint(e, canvas), lim = typeof ptProfileLimits === "function" ? ptProfileLimits() : { min: 0, max: input.D };
      state.ptProfile[active.kind][active.i] = clamp((p.y - r.top) / r.ys, lim.min, lim.max); drawPtClean();
      if (done) { renderPtProfile?.(); safeRun?.(); }
    };
    canvas.addEventListener("pointerdown", (e) => { active = pick(e); if (active) { canvas.setPointerCapture?.(e.pointerId); apply(e, false); } });
    canvas.addEventListener("pointermove", (e) => apply(e, false));
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => canvas.addEventListener(ev, (e) => { if (active) { apply(e, true); active = null; } }));
  }

  function safeRead() { try { return typeof readInputs === "function" ? readInputs() : null; } catch { return null; } }
  function member(v) { try { return typeof memberTypeLabel === "function" ? memberTypeLabel(v) : v; } catch { return v; } }
  function shape(i) { try { return typeof sectionShapeLabel === "function" ? sectionShapeLabel(i) : i.sectionShape; } catch { return i.sectionShape; } }
  function reo(i, f) { try { return typeof formatRebarLayerSchedule === "function" ? formatRebarLayerSchedule(i, f) : "-"; } catch { return "-"; } }
  function pa(i) { try { return typeof ptPAStress === "function" ? Number(ptPAStress(i)) || 0 : 0; } catch { return 0; } }
  function fix(i) { try { return typeof formatSupportFixities === "function" ? formatSupportFixities(i) : "span supports"; } catch { return "span supports"; } }
  function as3600(rows) { return (rows || []).find((r) => /AS\s*3600/i.test(r.zone || r.code || "")) || (rows || [])[0] || null; }
  function clear(ctx, canvas) { if (typeof window.clear === "function") window.clear(ctx, canvas); else ctx.clearRect(0, 0, canvas.width, canvas.height); }
  function title(ctx, a, b, x, y) { ctx.textAlign = "left"; ctx.fillStyle = "#17211d"; ctx.font = "22px system-ui"; ctx.fillText(a, x, y); ctx.fillStyle = "#60706a"; ctx.font = "14px system-ui"; ctx.fillText(b, x, y + 24); }
  function fit(wm, hm, x, y, mw, mh) { const s = Math.min(mw / Math.max(wm, .1), mh / Math.max(hm, .1)); return { x: x + (mw - wm * s) / 2, y: y + (mh - hm * s) / 2, w: wm * s, h: hm * s, scale: s }; }
  function dim(ctx, x1, y1, x2, y2, t, v) { ctx.save(); ctx.strokeStyle = "#60706a"; ctx.fillStyle = "#60706a"; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.font = "12px system-ui"; ctx.textAlign = "center"; if (v) { ctx.translate(x1 - 10, (y1 + y2) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(t, 0, 0); } else ctx.fillText(t, (x1 + x2) / 2, y1 - 8); ctx.restore(); }
  function spanTicks(ctx, r, spans) { const total = spans.reduce((s, v) => s + Math.max(.5, Number(v) || .5), 0); let a = 0; spans.forEach((sp, i) => { const start = a; a += Math.max(.5, Number(sp) || .5); const x = r.x + a / total * r.w; if (i < spans.length - 1) { ctx.save(); ctx.setLineDash([7, 6]); ctx.strokeStyle = "#60706a"; ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); ctx.restore(); } ctx.fillStyle = "#60706a"; ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.fillText(`X${i + 1} ${Number(sp).toFixed(1)} m`, r.x + (start + sp / 2) / total * r.w, r.y - 10); }); }
  function col(ctx, x, y, w, h) { ctx.fillStyle = "rgba(96,112,106,.24)"; ctx.strokeStyle = "#60706a"; ctx.lineWidth = 2; ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.strokeRect(x - w / 2, y - h / 2, w, h); }
  function transfer(ctx, r, i) { if (!(i.transferLoadKn > 0)) return; const x = r.x + clamp((i.transferX || i.panelX / 2) / i.panelX, 0, 1) * r.w, y = r.y + clamp((i.transferY || i.panelY / 2) / i.panelY, 0, 1) * r.h; ctx.fillStyle = "rgba(189,91,50,.18)"; ctx.strokeStyle = "#bd5b32"; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#bd5b32"; ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.fillText(`${i.transferLoadKn.toFixed(0)} kN`, x, y - 26); }
  function legend(ctx, items, x, y) { let lx = x; ctx.font = "12px system-ui"; ctx.textAlign = "left"; items.forEach(([c, l]) => { ctx.fillStyle = c; ctx.fillRect(lx, y - 10, 18, 8); ctx.fillStyle = "#60706a"; ctx.fillText(l, lx + 25, y); lx += Math.max(118, l.length * 7 + 42); }); }
  function support(ctx, x, y) { ctx.fillStyle = "rgba(96,112,106,.15)"; ctx.strokeStyle = "#60706a"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 18, y + 36); ctx.lineTo(x + 18, y + 36); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  function arrows(ctx, x1, x2, y) { ctx.strokeStyle = "#bd5b32"; for (let x = x1 + 18; x < x2 - 8; x += 34) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 74); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 4, y + 65); ctx.lineTo(x, y + 74); ctx.lineTo(x + 4, y + 65); ctx.stroke(); } }
  function ptSpans(input) { return (input.memberType || q("memberType")?.value) === "twoWay" ? (state.twoWaySpansX || [input.panelX]).map((v) => ({ length: Math.max(.5, Number(v) || .5) })) : (state.spans || input.spans || [{ length: 1 }]).map((v) => ({ length: Math.max(.5, Number(v.length) || .5) })); }
  function ptRect(canvas, input) { const left = 92, right = canvas.width - 70, top = 108, hp = Math.min(330, canvas.height - 250), total = ptSpans(input).reduce((s, p) => s + p.length, 0) || 1; return { left, right, top, h: hp, w: right - left, xs: (right - left) / total, ys: hp / Math.max(input.D, 1) }; }
  function depth(ctx, r, i) { ctx.fillStyle = "rgba(96,112,106,.06)"; ctx.strokeStyle = "rgba(96,112,106,.28)"; ctx.fillRect(r.left, r.top, r.w, r.h); ctx.strokeRect(r.left, r.top, r.w, r.h); [[0, "0 top"], [i.D / 2, `mid ${Math.round(i.D / 2)} mm`], [i.D, `full ${Math.round(i.D)} mm`]].forEach(([d, t]) => { const y = r.top + d * r.ys; ctx.strokeStyle = d === i.D / 2 ? "rgba(10,132,255,.35)" : "rgba(96,112,106,.25)"; ctx.beginPath(); ctx.moveTo(r.left, y); ctx.lineTo(r.right, y); ctx.stroke(); ctx.fillStyle = "#60706a"; ctx.font = "12px system-ui"; ctx.textAlign = "right"; ctx.fillText(t, r.left - 14, y + 4); }); const lim = typeof ptProfileLimits === "function" ? ptProfileLimits() : { min: 25, max: i.D - 25 }; ctx.setLineDash([8, 6]); ctx.strokeStyle = "#bd5b32"; [lim.min, lim.max].forEach((d) => { const y = r.top + d * r.ys; ctx.beginPath(); ctx.moveTo(r.left, y); ctx.lineTo(r.right, y); ctx.stroke(); }); ctx.setLineDash([]); ctx.fillStyle = "#bd5b32"; ctx.textAlign = "left"; ctx.fillText(`25 mm cover to duct zone: ${lim.min.toFixed(0)}-${lim.max.toFixed(0)} mm from top`, r.left, r.top + r.h + 28); }
  function ptPoints(i, r) { const spans = ptSpans(i), hi = i.ptHighPoints?.length ? i.ptHighPoints : state.ptProfile.highPoints, lo = i.ptLowPoints?.length ? i.ptLowPoints : state.ptProfile.lowPoints, h = [], l = []; let a = 0; h.push({ x: r.left, y: r.top + (hi[0] || i.D / 2) * r.ys }); spans.forEach((sp, n) => { l.push({ x: r.left + (a + sp.length / 2) * r.xs, y: r.top + (lo[n] ?? lo[0] ?? i.D / 2) * r.ys }); a += sp.length; h.push({ x: r.left + a * r.xs, y: r.top + (hi[n + 1] ?? hi.at(-1) ?? i.D / 2) * r.ys }); }); return { h, l }; }
  function curve(ctx, i, r) { const spans = ptSpans(i), hi = i.ptHighPoints?.length ? i.ptHighPoints : state.ptProfile.highPoints, lo = i.ptLowPoints?.length ? i.ptLowPoints : state.ptProfile.lowPoints; let a = 0; ctx.strokeStyle = "#a16207"; ctx.lineWidth = 4; spans.forEach((sp, n) => { const x1 = r.left + a * r.xs, x2 = r.left + (a + sp.length) * r.xs, h1 = hi[n] ?? hi[0] ?? i.D / 2, h2 = hi[n + 1] ?? hi.at(-1) ?? h1, low = lo[n] ?? lo[0] ?? i.D / 2; ctx.beginPath(); for (let j = 0; j <= 42; j++) { const rr = j / 42, yt = typeof tendonProfilePoint === "function" ? tendonProfilePoint(i, rr, h1, h2, low) : h1 * (1 - rr) + h2 * rr + Math.sin(Math.PI * rr) * (low - (h1 + h2) / 2), x = x1 + (x2 - x1) * rr, y = r.top + yt * r.ys; if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); ctx.fillStyle = "#60706a"; ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.fillText(`span ${n + 1} ${sp.length.toFixed(2)} m`, (x1 + x2) / 2, r.top + r.h + 52); a += sp.length; }); }
  function dot(ctx, x, y, t, c) { ctx.fillStyle = "#fff"; ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = c; ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.fillText(t, x, y - 16); }
  function cpoint(e, canvas) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / Math.max(r.width, 1) * canvas.width, y: (e.clientY - r.top) / Math.max(r.height, 1) * canvas.height }; }
  function barChart(ctx, rows, x, y, h, w) { const max = Math.max(1, ...rows.map((r) => Math.max(Math.abs(r.Mu || 0), Math.abs(r.phiMu || 0)))), bw = w / Math.max(rows.length, 1); ctx.fillStyle = "#17211d"; ctx.font = "16px system-ui"; ctx.fillText("Column and middle strip flexure", x, y - h - 26); rows.forEach((r, i) => { const bx = x + i * bw + bw * .2, dh = Math.abs(r.Mu || 0) / max * h, ch = Math.abs(r.phiMu || 0) / max * h; ctx.fillStyle = "#bd5b32"; ctx.fillRect(bx, y - dh, bw * .22, dh); ctx.fillStyle = "#126b63"; ctx.fillRect(bx + bw * .28, y - ch, bw * .22, ch); ctx.save(); ctx.translate(bx + bw * .2, y + 22); ctx.rotate(-Math.PI / 7); ctx.fillStyle = "#60706a"; ctx.font = "11px system-ui"; ctx.fillText(String(r.zone || `row ${i + 1}`).replace("Column strip", "Col").replace("Middle strip", "Mid"), 0, 0); ctx.restore(); }); ctx.strokeStyle = "#d7ddd8"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke(); legend(ctx, [["#bd5b32", "demand"], ["#126b63", "capacity"]], x, y + 72); }
  function punchSketch(ctx, i, x, y, w, h, row) { ctx.fillStyle = "#17211d"; ctx.font = "16px system-ui"; ctx.fillText("Punching shear critical perimeter", x, y - 26); ctx.fillStyle = "#f7fbff"; ctx.strokeStyle = "#d7ddd8"; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); const s = Math.min(w / 2.2, h / 2), cw = Math.max(42, i.columnX / 1000 * s), ch = Math.max(42, i.columnY / 1000 * s), cx = x + w / 2, cy = y + h / 2; col(ctx, cx, cy, cw, ch); const d = Math.max(22, i.d / 1000 * s); ctx.setLineDash([9, 6]); ctx.strokeStyle = "#bd5b32"; ctx.strokeRect(cx - cw / 2 - d / 2, cy - ch / 2 - d / 2, cw + d, ch + d); ctx.setLineDash([]); ctx.fillStyle = "#60706a"; ctx.font = "12px system-ui"; ctx.fillText(`column ${i.columnX.toFixed(0)} x ${i.columnY.toFixed(0)} mm`, x + 16, y + h - 42); ctx.fillText(`effective depth d=${i.d.toFixed(0)} mm`, x + 16, y + h - 22); if (row) { ctx.fillStyle = row.util > 1 ? "#c62828" : "#1f8f57"; ctx.fillText(`util ${(row.util * 100).toFixed(0)}%`, x + w - 88, y + h - 22); } }
  function gauge(ctx, row, x, y, w, h, t) { const max = Math.max(row.Mu, row.phiMu, 1); ctx.fillStyle = "#17211d"; ctx.font = "15px system-ui"; ctx.fillText(t, x, y - 18); ctx.fillStyle = "#f1f5f9"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#bd5b32"; ctx.fillRect(x, y, row.Mu / max * w, h * .42); ctx.fillStyle = "#126b63"; ctx.fillRect(x, y + h * .58, row.phiMu / max * w, h * .42); ctx.fillStyle = "#17211d"; ctx.font = "12px system-ui"; ctx.fillText(`Vu* ${row.Mu.toFixed(1)} kN`, x + 10, y + h * .29); ctx.fillText(`phiVu ${row.phiMu.toFixed(1)} kN`, x + 10, y + h * .87); }

  start();
})();
