(function () {
  const q = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function start() {
    if (window.__lineTransferAddonStarted) return;
    window.__lineTransferAddonStarted = true;
    injectStyles();
    addControls();
    patchReadInputs();
    patchLineAnalysis();
    patchDrawings();
    patchSafeRun();
    refresh();
    if (typeof safeRun === "function") safeRun();
  }

  function injectStyles() {
    if (q("lineTransferStyles")) return;
    const style = document.createElement("style");
    style.id = "lineTransferStyles";
    style.textContent = `
      .line-transfer-controls {
        margin-top: 12px;
        padding: 12px;
        border: 1px solid rgba(189, 91, 50, 0.2);
        border-radius: 8px;
        background: #fff8f5;
      }
      .line-transfer-controls h3 {
        grid-column: 1 / -1;
        margin: 0;
        font-size: 14px;
      }
      .line-transfer-note {
        grid-column: 1 / -1;
        margin: -2px 0 0;
        color: var(--muted);
        font-size: 12px;
      }
      .input-panel,
      .input-panel * {
        min-width: 0;
      }
      .input-panel label,
      .input-panel .section-hint,
      .input-panel .line-transfer-note,
      .input-panel .fixity-heading span,
      .input-panel .member-actions span,
      .input-panel .pt-profile-heading span,
      .input-panel .pt-profile-summary,
      .input-panel .reo-group span,
      .input-panel .project-check-item span,
      .input-panel .ai-recommendations,
      .input-panel .workflow-tree {
        max-width: 100%;
        overflow-wrap: anywhere;
        word-break: normal;
        line-height: 1.35;
      }
      .input-panel input,
      .input-panel select,
      .input-panel textarea {
        max-width: 100%;
        min-width: 0;
      }
      .input-panel button {
        max-width: 100%;
        min-width: 0;
        height: auto;
        min-height: 34px;
        white-space: normal;
        overflow-wrap: anywhere;
        line-height: 1.2;
      }
      .input-panel .grid.two,
      .input-panel .combo-selects,
      .input-panel .support-fixity-grid,
      .input-panel .pt-profile-grid,
      .input-panel .pt-profile-summary,
      .input-panel .ai-actions,
      .input-panel .reo-settings {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .input-panel .section-title {
        align-items: start;
      }
      .input-panel .section-title h2 {
        overflow-wrap: anywhere;
      }
      .input-panel .section-title select,
      .input-panel .section-title button {
        flex: 1 1 150px;
        width: auto;
      }
      .input-panel .check {
        grid-template-columns: auto minmax(0, 1fr);
      }
      .span-row {
        grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(34px, auto);
      }
      .span-row button {
        width: 100%;
        min-width: 34px;
      }
      .compact-span-row {
        grid-template-columns: minmax(0, 1fr) minmax(34px, auto);
      }
      .reo-group-head,
      .reo-group-head > div {
        min-width: 0;
      }
      .reo-group-head b {
        min-width: 0;
        max-width: 45%;
        overflow-wrap: anywhere;
      }
      .reo-layer-row {
        grid-template-columns: minmax(48px, 0.55fr) minmax(0, 1fr) minmax(0, 1fr);
      }
      .input-category-panel {
        width: min(380px, calc(100vw - 24px));
      }
      .input-category-panel button {
        grid-template-columns: minmax(0, 1fr);
      }
      .input-category-panel small {
        white-space: normal;
        overflow-wrap: anywhere;
      }
      @media (max-width: 760px) {
        .input-panel .grid.two,
        .input-panel .combo-selects,
        .input-panel .support-fixity-grid,
        .input-panel .pt-profile-grid,
        .input-panel .pt-profile-summary,
        .input-panel .ai-actions,
        .input-panel .reo-settings,
        .span-row,
        .compact-span-row,
        .reo-layer-row {
          grid-template-columns: 1fr;
        }
        .input-panel .section-title {
          display: grid;
          grid-template-columns: 1fr;
        }
        .input-panel .section-title select,
        .input-panel .section-title button,
        .reo-group-head b {
          width: 100%;
          max-width: 100%;
        }
        .reo-group-head {
          display: grid;
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function addControls() {
    const section = q("spanInputSection");
    const spans = q("spans");
    if (!section || !spans || q("lineTransferLoadKn")) return;
    const panel = document.createElement("div");
    panel.id = "lineTransferControls";
    panel.className = "grid two line-transfer-controls";
    panel.innerHTML = `
      <h3>Transfer Load</h3>
      <label>Transfer load P (kN)<input id="lineTransferLoadKn" type="number" min="0" step="5" value="0"></label>
      <label>Location from left end (m)<input id="lineTransferX" type="number" min="0" step="0.1"></label>
      <label>Footprint / bearing length (mm)<input id="lineTransferFootprint" type="number" min="50" step="25" value="300"></label>
      <p id="lineTransferNote" class="line-transfer-note"></p>
    `;
    spans.after(panel);
    refreshLineTransferLimits();
    panel.querySelectorAll("input").forEach((input) => input.addEventListener("change", () => {
      refreshLineTransferLimits();
      if (typeof safeRun === "function") safeRun();
    }));
  }

  function patchReadInputs() {
    if (typeof readInputs !== "function" || readInputs.lineTransferAddon) return;
    const base = readInputs;
    readInputs = function () {
      const data = base();
      if (data.memberType !== "twoWay") addLineTransferData(data);
      return data;
    };
    readInputs.lineTransferAddon = true;
  }

  function addLineTransferData(data) {
    refreshLineTransferLimits();
    data.lineTransferLoadKn = Math.max(0, Number(q("lineTransferLoadKn")?.value || 0));
    data.lineTransferX = clamp(Number(q("lineTransferX")?.value || lineTotalLength(data) / 2), 0, lineTotalLength(data));
    data.lineTransferFootprint = Math.max(50, Number(q("lineTransferFootprint")?.value || 300));
    const pos = lineTransferPosition(data);
    data.lineTransferSpanIndex = pos.spanIndex;
    data.lineTransferSpanLocalX = pos.localX;
  }

  function patchLineAnalysis() {
    if (typeof analyse !== "function" || analyse.lineTransferAddon || typeof analyseCombination !== "function") return;
    analyseCombination = function (input, combo, options = {}) {
      const patterns = combo.pattern && combo.q > 0 ? liveLoadPatterns(input.spans.length) : [{ name: "all spans", factors: input.spans.map(() => 1) }];
      const pointLoads = lineTransferPointLoads(input, combo);
      const cases = patterns.map((pattern) =>
        analyse(
          input,
          (span, i) => combo.sw * input.selfWeightLoad + combo.g * (span.g + input.wetLineLoad) + combo.q * span.q * pattern.factors[i] - ptBalancedLoadForSpan(input, i),
          `${combo.name} - ${pattern.name}`,
          { ...options, pointLoads }
        )
      );
      return envelopeAnalyses(cases, combo);
    };
    analyse = function (input, loadFn, name = "analysis", options = {}) {
      const mesh = options.mesh || buildMesh(input);
      const dofs = buildFrameDofMap(input, mesh);
      const K = makeMatrix(dofs.count, dofs.count);
      const F = Array(dofs.count).fill(0);
      const baseEI = input.Ec * input.Igross * 1e-9;
      const pointLoads = options.pointLoads || [];

      mesh.elements.forEach((element) => {
        const L = element.length;
        const w = loadFn(input.spans[element.span], element.span);
        const EI = baseEI * (options.stiffnessModifiers?.[element.id] ?? 1);
        const k = beamK(EI, L);
        const fe = [w * L / 2, w * L * L / 12, w * L / 2, -w * L * L / 12];
        addPointLoadFe(fe, elementPointLoads(mesh, element, pointLoads), L);
        const map = dofs.elementMaps[element.id];
        map.forEach((a, i) => {
          F[a] += fe[i];
          map.forEach((b, j) => {
            K[a][b] += k[i][j];
          });
        });
      });

      const supportSprings = applySupportFixitySprings(K, input, mesh, baseEI, dofs);
      const fixed = mesh.supportNodes.map((support) => dofs.vertical[support.node]);
      const free = Array.from({ length: dofs.count }, (_, i) => i).filter((i) => !fixed.includes(i));
      const Kff = free.map((r) => free.map((c) => K[r][c]));
      const Ff = free.map((r) => F[r]);
      const df = solveLinear(Kff, Ff);
      const d = Array(dofs.count).fill(0);
      free.forEach((idx, i) => {
        d[idx] = df[i];
      });
      const R = multiplyMatrixVector(K, d).map((v, i) => v - F[i]);

      const samples = [];
      const elements = mesh.elements.map((element) => {
        const L = element.length;
        const w = loadFn(input.spans[element.span], element.span);
        const EI = baseEI * (options.stiffnessModifiers?.[element.id] ?? 1);
        const k = beamK(EI, L);
        const fe = [w * L / 2, w * L * L / 12, w * L / 2, -w * L * L / 12];
        const elementPoints = elementPointLoads(mesh, element, pointLoads);
        addPointLoadFe(fe, elementPoints, L);
        const map = dofs.elementMaps[element.id];
        const de = map.map((idx) => d[idx]);
        const end = subtract(multiplyMatrixVector(k, de), fe);
        for (let j = 0; j <= 4; j++) {
          const xi = (L * j) / 4;
          const globalX = mesh.nodes[element.i] + xi;
          const activePoints = elementPoints.filter((p) => xi >= p.a - 1e-9);
          const pointShear = activePoints.reduce((sum, p) => sum + p.P, 0);
          const pointMoment = activePoints.reduce((sum, p) => sum + p.P * (xi - p.a), 0);
          const defl = hermiteDeflection(de, xi, L) + udlFixedEndDeflection(w, xi, L, EI);
          const shear = -end[0] - w * xi - pointShear;
          const moment = end[1] - end[0] * xi - (w * xi * xi) / 2 - pointMoment;
          samples.push({ x: globalX, span: element.span, shear, moment, defl });
        }
        return { ...element, L, w, end, stiffnessModifier: options.stiffnessModifiers?.[element.id] ?? 1, pointLoads: elementPoints };
      });

      const maxMoment = maxAbs(samples, "moment");
      const maxShear = maxAbs(samples, "shear");
      const maxDefl = maxAbs(samples, "defl");
      const supportFixityMoments = supportSprings.map((spring) => ({
        support: spring.supportIndex + 1,
        x: spring.x,
        percent: spring.percent,
        moment: spring.k * d[spring.dof],
      }));
      return { name, x: mesh.supports, meshX: mesh.nodes, d, R, dofs, samples, elements, supportNodes: mesh.supportNodes, supportSprings, supportFixityMoments, maxMoment, maxShear, maxDefl, totalLength: mesh.supports[mesh.supports.length - 1], elementCount: mesh.elements.length, pointLoads };
    };
    analyse.lineTransferAddon = true;
  }

  function patchDrawings() {
    if (typeof drawModel === "function" && !drawModel.lineTransferAddon) {
      const baseModel = drawModel;
      drawModel = function () {
        baseModel();
        drawLineTransferOnModelCanvas();
      };
      drawModel.lineTransferAddon = true;
    }
    if (typeof renderLoads === "function" && !renderLoads.lineTransferAddon) {
      const baseLoads = renderLoads;
      renderLoads = function () {
        baseLoads();
        drawLineTransferOnLoadCanvas();
      };
      renderLoads.lineTransferAddon = true;
    }
    if (typeof renderSummary === "function" && !renderSummary.lineTransferAddon) {
      const baseSummary = renderSummary;
      renderSummary = function () {
        baseSummary();
        updateModelSummary();
      };
      renderSummary.lineTransferAddon = true;
    }
  }

  function patchSafeRun() {
    if (typeof safeRun !== "function" || safeRun.lineTransferAddon) return;
    const base = safeRun;
    safeRun = function () {
      const out = base();
      refresh();
      return out;
    };
    safeRun.lineTransferAddon = true;
  }

  function refresh() {
    refreshLineTransferLimits();
    updateModelSummary();
    drawLineTransferOnModelCanvas();
    drawLineTransferOnLoadCanvas();
  }

  function lineTransferPointLoads(input, combo) {
    if (input.memberType === "twoWay" || !(Number(input.lineTransferLoadKn) > 0)) return [];
    return [{ x: clamp(Number(input.lineTransferX) || lineTotalLength(input) / 2, 0, lineTotalLength(input)), P: Number(input.lineTransferLoadKn) * Number(combo.g || 0), label: "transfer" }];
  }

  function elementPointLoads(mesh, element, pointLoads) {
    if (!pointLoads.length) return [];
    const start = mesh.nodes[element.i];
    const end = mesh.nodes[element.j];
    return pointLoads
      .filter((load) => load.P > 0 && load.x >= start - 1e-9 && load.x <= end + 1e-9 && (load.x > start + 1e-9 || element.i === 0))
      .map((load) => ({ ...load, a: clamp(load.x - start, 0, element.length) }));
  }

  function addPointLoadFe(fe, loads, L) {
    loads.forEach((load) => {
      const r = clamp(load.a / Math.max(L, 1e-9), 0, 1);
      fe[0] += load.P * (1 - 3 * r * r + 2 * r * r * r);
      fe[1] += load.P * L * (r - 2 * r * r + r * r * r);
      fe[2] += load.P * (3 * r * r - 2 * r * r * r);
      fe[3] += load.P * L * (-r * r + r * r * r);
    });
  }

  function drawLineTransferOnModelCanvas() {
    const input = state.result?.input;
    const canvas = q("modelCanvas");
    if (!canvas?.getContext || !input || input.memberType === "twoWay" || !(input.lineTransferLoadKn > 0)) return;
    const pad = canvas.width >= 1300 ? 88 : 70;
    const y = canvas.width >= 1300 ? 330 : 250;
    const total = Math.max(0.5, state.result.ultimate?.totalLength || lineTotalLength(input));
    const sx = (canvas.width - 2 * pad) / total;
    drawMarker(canvas.getContext("2d"), pad, y, sx, input, true);
  }

  function drawLineTransferOnLoadCanvas() {
    const input = state.result?.input;
    const canvas = q("loadCanvas");
    if (!canvas?.getContext || !input || input.memberType === "twoWay" || !(input.lineTransferLoadKn > 0)) return;
    const pad = 80;
    const y = 220;
    const total = Math.max(0.5, state.result.ultimate?.totalLength || lineTotalLength(input));
    const sx = (canvas.width - 2 * pad) / total;
    drawMarker(canvas.getContext("2d"), pad, y, sx, input, true);
  }

  function drawMarker(ctx, pad, beamY, sx, input, showSpan) {
    const total = lineTotalLength(input);
    const x = pad + clamp(input.lineTransferX || total / 2, 0, total) * sx;
    const top = beamY - 170;
    const pos = lineTransferPosition(input);
    ctx.save();
    ctx.strokeStyle = "#c62828";
    ctx.fillStyle = "#c62828";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, beamY - 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 7, beamY - 28);
    ctx.lineTo(x, beamY - 14);
    ctx.lineTo(x + 7, beamY - 28);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, beamY - 14, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(198,40,40,.14)";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c62828";
    ctx.font = "13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`transfer ${input.lineTransferLoadKn.toFixed(0)} kN`, x, top - 12);
    ctx.fillStyle = "#60706a";
    ctx.font = "12px system-ui";
    ctx.fillText(`x=${input.lineTransferX.toFixed(2)} m${showSpan ? `, S${pos.spanIndex + 1} +${pos.localX.toFixed(2)} m` : ""}`, x, top + 8);
    if (input.lineTransferFootprint > 0) {
      const half = Math.max(7, (input.lineTransferFootprint / 1000) * sx / 2);
      ctx.strokeStyle = "#c62828";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x - half, beamY + 5);
      ctx.lineTo(x + half, beamY + 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateModelSummary() {
    const input = state.result?.input;
    const panel = q("modelInfoPanel");
    if (!panel || !input || input.memberType === "twoWay") return;
    q("lineTransferSummaryRow")?.remove();
    if (!(input.lineTransferLoadKn > 0)) return;
    const row = document.createElement("div");
    row.id = "lineTransferSummaryRow";
    row.className = "model-info-row";
    const pos = lineTransferPosition(input);
    row.innerHTML = `<span>Transfer load</span><b>${input.lineTransferLoadKn.toFixed(0)} kN at x=${input.lineTransferX.toFixed(2)} m, span ${pos.spanIndex + 1} +${pos.localX.toFixed(2)} m</b>`;
    const note = panel.querySelector(".model-info-note");
    if (note) note.before(row);
    else panel.appendChild(row);
  }

  function refreshLineTransferLimits() {
    const x = q("lineTransferX");
    if (!x) return;
    const total = lineTotalLength();
    x.max = total.toFixed(2);
    if (x.value === "") x.value = (total / 2).toFixed(2);
    const value = clamp(Number(x.value) || 0, 0, total);
    if (Number(x.value) !== value) x.value = value.toFixed(2);
    const note = q("lineTransferNote");
    const pos = lineTransferPosition({ lineTransferX: value, spans: state.spans || [] });
    if (note) note.textContent = `Measured from the left end over ${total.toFixed(2)} m total length. Current location is span ${pos.spanIndex + 1}, ${pos.localX.toFixed(2)} m from that span start.`;
  }

  function lineTotalLength(input = null) {
    const spans = input?.spans?.length ? input.spans : state.spans || [];
    return spans.reduce((sum, span) => sum + Math.max(0.5, Number(span.length) || 0.5), 0) || 1;
  }

  function lineTransferPosition(input = null) {
    const spans = input?.spans?.length ? input.spans : state.spans || [];
    const x = clamp(Number(input?.lineTransferX ?? q("lineTransferX")?.value ?? lineTotalLength(input) / 2), 0, lineTotalLength(input));
    let start = 0;
    for (let i = 0; i < spans.length; i++) {
      const L = Math.max(0.5, Number(spans[i].length) || 0.5);
      if (x <= start + L + 1e-9 || i === spans.length - 1) return { spanIndex: i, localX: clamp(x - start, 0, L), start, end: start + L };
      start += L;
    }
    return { spanIndex: 0, localX: x, start: 0, end: lineTotalLength(input) };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
