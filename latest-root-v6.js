(function () {
  if (window.__latestRootV6Applied) return;
  window.__latestRootV6Applied = true;

  const id = (name) => document.getElementById(name);
  const n = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const sum = (items) => (items || []).reduce((total, value) => total + Math.max(0.5, Number(value) || 0.5), 0);
  const st = () => {
    try {
      return state;
    } catch {
      return null;
    }
  };

  function start() {
    hideDerivedTwoWayInputs();
    setupXSpanRows();
    patchRunButton();
    patchReadInputs();
    patchMultiSpanPlate();
    patchReviewPanels();
    try {
      if (typeof safeRun === "function") safeRun();
    } catch {}
  }

  function hideDerivedTwoWayInputs() {
    const defaults = {
      columnsBelowLayout: "grid",
      columnsBelowSpacingX: "1.5",
      columnsBelowSpacingY: "1.5",
    };
    Object.entries(defaults).forEach(([name, value]) => {
      const input = id(name);
      if (!input) return;
      input.value = input.value || value;
      const label = input.closest("label");
      if (label) label.style.display = "none";
    });
  }

  function getXSpans() {
    const app = st();
    if (Array.isArray(app?.twoWaySpansX) && app.twoWaySpansX.length) return app.twoWaySpansX;
    if (Array.isArray(window.__latestRootXSpans) && window.__latestRootXSpans.length) return window.__latestRootXSpans;
    const rows = [...document.querySelectorAll("#panelXSpans input")].map((input) => Math.max(0.5, n(input.value, 0.5)));
    window.__latestRootXSpans = rows.length ? rows : [Math.max(0.5, n(id("panelX")?.value, 8))];
    return window.__latestRootXSpans;
  }

  function setXSpans(spans) {
    const clean = spans.map((span) => Math.max(0.5, Number(span) || 0.5));
    window.__latestRootXSpans = clean;
    const app = st();
    if (app) app.twoWaySpansX = clean.slice();
    if (id("panelX")) id("panelX").value = sum(clean).toFixed(1);
  }

  function xSpans(input = {}) {
    const app = st();
    const raw = Array.isArray(input.twoWaySpansX) && input.twoWaySpansX.length
      ? input.twoWaySpansX
      : Array.isArray(app?.twoWaySpansX) && app.twoWaySpansX.length
        ? app.twoWaySpansX
        : getXSpans();
    const spans = raw.map((span) => Math.max(0.5, Number(span) || 0.5));
    const total = sum(spans);
    const target = Math.max(0.5, Number(input.panelX) || total || 1);
    if (Math.abs(total - target) > 0.05) {
      const scale = target / Math.max(total, 0.5);
      return spans.map((span) => Math.max(0.5, span * scale));
    }
    return spans;
  }

  function setupXSpanRows() {
    renderXSpanRows();
    const addX = id("addPanelXSpanBtn");
    if (addX && addX.dataset.latestRootSingleSpan !== "1") {
      addX.dataset.latestRootSingleSpan = "1";
      addX.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const spans = getXSpans().slice();
        spans.push(spans.at(-1) || 8);
        setXSpans(spans);
        renderXSpanRows();
        try {
          if (typeof renderPtProfile === "function") renderPtProfile();
          if (typeof safeRun === "function") safeRun();
        } catch {}
      }, true);
    }

    const addY = id("addPanelYSpanBtn");
    if (addY && addY.dataset.latestRootSingleSpan !== "1") {
      addY.dataset.latestRootSingleSpan = "1";
      addY.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
    }
  }

  function renderXSpanRows() {
    const box = id("panelXSpans");
    if (!box) return;
    const spans = getXSpans();
    setXSpans(spans);
    box.innerHTML = spans.map((span, index) => `
      <div class="span-row compact-span-row">
        <label>X span ${index + 1} (m)<input type="number" min="0.5" step="0.1" value="${Math.max(0.5, Number(span) || 0.5).toFixed(1)}" data-latest-root-x-span="${index}"></label>
        <button type="button" title="Remove X span" data-latest-root-remove-x="${index}">x</button>
      </div>
    `).join("");
    box.querySelectorAll("[data-latest-root-x-span]").forEach((input) => input.addEventListener("change", () => {
      const spans = getXSpans().slice();
      spans[Number(input.dataset.latestRootXSpan)] = Math.max(0.5, n(input.value, 0.5));
      setXSpans(spans);
      renderXSpanRows();
      try {
        if (typeof safeRun === "function") safeRun();
      } catch {}
    }));
    box.querySelectorAll("[data-latest-root-remove-x]").forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const spans = getXSpans().slice();
      if (spans.length > 1) spans.splice(Number(button.dataset.latestRootRemoveX), 1);
      setXSpans(spans);
      renderXSpanRows();
      try {
        if (typeof safeRun === "function") safeRun();
      } catch {}
    }, true));
  }

  function patchRunButton() {
    const button = id("runAnalysisBtn");
    if (!button || button.dataset.latestRootNoJump === "1") return;
    button.dataset.latestRootNoJump = "1";
    button.addEventListener("click", (event) => {
      const active = document.querySelector(".tab.active")?.dataset.view || "model";
      event.preventDefault();
      event.stopImmediatePropagation();
      if (typeof safeRun === "function") safeRun();
      if (typeof switchTab === "function") switchTab(active);
      renderXSpanRows();
    }, true);
  }

  function patchReadInputs() {
    if (typeof readInputs !== "function" || readInputs.latestRootV6) return;
    const base = readInputs;
    readInputs = function () {
      const data = base.apply(this, arguments);
      if (data?.memberType === "twoWay") {
        data.twoWaySpansX = xSpans(data);
        data.twoWaySpansY = [Math.max(0.5, n(id("panelY")?.value, data.panelY || 7))];
        data.panelX = sum(data.twoWaySpansX);
        data.panelY = data.twoWaySpansY[0];
        data.columnsBelowLayout = "grid";
        data.columnsBelowSpacingX = 1.5;
        data.columnsBelowSpacingY = 1.5;
      }
      return data;
    };
    readInputs.latestRootV6 = true;
  }

  function patchMultiSpanPlate() {
    if (typeof plateGridDeflection !== "function" || plateGridDeflection.latestRootV6) return;
    const base = plateGridDeflection;
    plateGridDeflection = function (input, qLoad, options = {}) {
      const spans = xSpans(input);
      if (input?.memberType !== "twoWay" || input.__singleSpanPlate || spans.length <= 1) {
        const plate = base(input, qLoad, options);
        if (input?.memberType === "twoWay") plate.xSpanLengths = spans;
        return plate;
      }

      const points = [];
      const xProfile = [];
      let offset = 0;
      let maxDeflectionM = 0;
      let maxAt = { x: spans[0] / 2, y: Math.max(Number(input.panelY || 1), 1) / 2 };
      let governing = null;

      spans.forEach((span, spanIndex) => {
        const plate = base({ ...input, panelX: span, twoWaySpansX: [span], __singleSpanPlate: true }, qLoad, options);
        (plate.points || []).forEach((point) => points.push({ ...point, x: point.x + offset, localX: point.x, spanIndex }));
        (plate.xProfile || []).forEach((point, index) => {
          if (spanIndex > 0 && index === 0) return;
          xProfile.push({ ...point, x: point.x + offset, localX: point.x, spanIndex, spanLength: span });
        });
        if (Math.abs(plate.maxDeflectionM || 0) > Math.abs(maxDeflectionM)) {
          maxDeflectionM = Math.abs(plate.maxDeflectionM || 0);
          maxAt = { x: offset + (plate.maxAt?.x || span / 2), y: plate.maxAt?.y || input.panelY / 2 };
          governing = plate;
        }
        offset += span;
      });

      return {
        grid: governing?.grid || input.plateGrid || 18,
        stiffnessModifier: governing?.stiffnessModifier || 1,
        restraintModifier: governing?.restraintModifier || 1,
        points,
        maxDeflectionM,
        maxAt,
        xProfile,
        yProfile: governing?.yProfile || [],
        xSpanLengths: spans,
      };
    };
    plateGridDeflection.latestRootV6 = true;
  }

  function patchReviewPanels() {
    if (typeof drawLimitDiagrams === "function") {
      drawLimitDiagrams = function () {
        const result = st()?.result;
        if (!result) return;
        if (result.mode === "twoWay") return drawTwoWayDeflectionOnly(result);
        return drawLineDeflectionClear(result);
      };
    }
    if (typeof drawTwoWayDiagrams === "function") {
      drawTwoWayDiagrams = function () {
        const result = st()?.result;
        if (result?.mode !== "twoWay") return;
        const canvas = id("diagramCanvas");
        if (!canvas?.getContext) return;
        canvas.width = 1400;
        canvas.height = 900;
        const ctx = canvas.getContext("2d");
        wipe(ctx, canvas);
        title(ctx, "Moments / Shear Review", "Flexure strip checks and punching shear are separated so labels do not clash.", 42, 48);
        barChart(ctx, result.twoWay.strips || [], 70, 365, 250, 650);
        const row = as3600Punching(result.twoWay.supportShear);
        punchingSketch(ctx, result.input, 760, 136, 560, 320, row);
        if (row) gauge(ctx, row, 790, 540, 500, 90, "AS 3600 punching shear demand / capacity");
      };
    }
  }

  function drawTwoWayDeflectionOnly(result) {
    const canvas = id("limitCanvas");
    if (!canvas?.getContext) return;
    canvas.width = 1400;
    canvas.height = 760;
    const ctx = canvas.getContext("2d");
    wipe(ctx, canvas);
    title(ctx, "Deflection Review", "Long-term deflection is drawn span by span. Punching shear is shown only in Moments / Shear.", 42, 48);
    const samples = twoWayDeflectionSamples(result.input, result.twoWay);
    summary(ctx, 42, 86, samples, result.input);
    drawDeflection(ctx, samples, result.input, 92, 410, 250, canvas.width);
  }

  function drawLineDeflectionClear(result) {
    const canvas = id("limitCanvas");
    if (!canvas?.getContext) return;
    canvas.width = 1400;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    wipe(ctx, canvas);
    const { input, service, deflection } = result;
    const samples = (deflection.longSamples || []).map((sample, index) => {
      const short = Math.abs((deflection.shortSamples?.[index]?.shortDefl || service.samples?.[index]?.defl || 0) * 1000);
      const long = Math.abs((sample.defl || 0) * 1000);
      return { x: sample.x, shortMm: short, longMm: long, incrementalMm: Math.max(0, long - short), limitMm: lineLimitAt(input, sample.x) };
    });
    title(ctx, "Deflection Review", "Beam and one-way deflection labels are separated from the stress diagram below.", 42, 48);
    drawDeflection(ctx, samples, input, 70, 155, 205, canvas.width);
    if (typeof stressSamples === "function" && typeof drawStressLimitDiagram === "function") {
      drawStressLimitDiagram(ctx, canvas, stressSamples(input, service.samples), 70, 705, 260, "Selected service case elastic concrete stress checks", "#126b63", "#bd5b32");
    }
  }

  function twoWayDeflectionSamples(input, twoWay) {
    const shortProfile = twoWay?.shortPlate?.xProfile || [];
    const longProfile = twoWay?.longPlate?.xProfile || shortProfile;
    const spans = xSpans(input);
    const total = sum(spans) || Math.max(Number(input.panelX) || 1, 1);
    const profileTotal = Math.max(shortProfile.at(-1)?.x || 0, longProfile.at(-1)?.x || 0, Number(input.panelX) || total, 1);
    return shortProfile.map((point, index) => {
      const x = (Number(point.x || 0) / profileTotal) * total;
      const shortMm = Math.abs(Number(point.defl || 0) * 1000);
      const longMm = Math.abs(Number(longProfile[index]?.defl ?? point.defl ?? 0) * 1000);
      return { x, shortMm, longMm, incrementalMm: Math.max(0, longMm - shortMm), limitMm: twoWayLimitAt(input, spans, x) };
    });
  }

  function twoWayLimitAt(input, spans, x) {
    const ratio = Math.max(Number(input.deflectionRatio || 250), 1);
    let start = 0;
    for (const span of spans) {
      if (x <= start + span + 1e-9) return (span * 1000) / ratio;
      start += span;
    }
    return (((spans.at(-1) || input.panelX || 1) * 1000) / ratio);
  }

  function lineLimitAt(input, x) {
    const spans = input.spans || [{ length: input.panelX || 1 }];
    let start = 0;
    for (const span of spans) {
      const length = Math.max(0.5, Number(span.length) || 0.5);
      if (x <= start + length + 1e-9) return (length * 1000) / Math.max(Number(input.deflectionRatio || 250), 1);
      start += length;
    }
    return (Math.max(0.5, Number(spans.at(-1)?.length) || 1) * 1000) / Math.max(Number(input.deflectionRatio || 250), 1);
  }

  function drawDeflection(ctx, samples, input, pad, axisY, height, width) {
    if (!samples.length) return;
    const total = samples.at(-1).x || 1;
    const max = Math.max(1, ...samples.map((sample) => Math.max(sample.longMm, sample.limitMm)));
    const xScale = (width - 2 * pad) / total;
    const yScale = height / max;
    const bottom = axisY + height;
    line(ctx, pad, axisY, width - pad, axisY, "#cfd8d1", 1.5);
    markers(ctx, input, pad, axisY, height, xScale);
    poly(ctx, samples, (sample) => pad + sample.x * xScale, (sample) => axisY + sample.limitMm * yScale, "#a16207", [8, 6]);
    poly(ctx, samples, (sample) => pad + sample.x * xScale, (sample) => axisY + sample.longMm * yScale, "#bd5b32");
    const governing = samples.reduce((best, sample) => (sample.longMm > best.longMm ? sample : best), samples[0]);
    label(ctx, `long-term ${governing.longMm.toFixed(2)} mm`, Math.min(width - pad - 170, pad + governing.x * xScale + 12), axisY + governing.longMm * yScale - 10, "#bd5b32", 14);
    label(ctx, `incremental max ${Math.max(...samples.map((sample) => sample.incrementalMm)).toFixed(2)} mm`, pad, bottom + 76, "#bd5b32", 15);
    label(ctx, "long-term", pad + 250, bottom + 106, "#bd5b32", 13);
    label(ctx, "allowable", pad + 380, bottom + 106, "#a16207", 13);
  }

  function markers(ctx, input, pad, axisY, height, xScale) {
    const spans = input.memberType === "twoWay" ? xSpans(input) : (input.spans || []).map((span) => Math.max(0.5, Number(span.length) || 0.5));
    let x = 0;
    spans.slice(0, -1).forEach((span) => {
      x += span;
      line(ctx, pad + x * xScale, axisY - 8, pad + x * xScale, axisY + height + 8, "rgba(96,112,106,.32)", 1);
    });
    x = 0;
    spans.forEach((span, index) => {
      if (index === 0) support(ctx, pad, axisY + height + 12, input.memberType === "twoWay" ? "C1" : "S1");
      x += span;
      support(ctx, pad + x * xScale, axisY + height + 12, input.memberType === "twoWay" ? `C${index + 2}` : `S${index + 2}`);
      if (spans.length > 1) label(ctx, `span ${index + 1}: ${span.toFixed(1)} m`, pad + (x - span / 2) * xScale - 38, axisY + height + 50, "#60706a", 11);
    });
  }

  function summary(ctx, x, y, samples, input) {
    const longMax = Math.max(0, ...samples.map((sample) => sample.longMm));
    const incMax = Math.max(0, ...samples.map((sample) => sample.incrementalMm));
    const limit = Math.min(...samples.map((sample) => sample.limitMm));
    card(ctx, x, y, 1290, 86);
    [
      ["Long-term", `${longMax.toFixed(2)} mm`],
      ["Incremental", `${incMax.toFixed(2)} mm`],
      ["Allowable", `L/${input.deflectionRatio} = ${limit.toFixed(1)} mm`],
      ["Status", longMax <= limit ? "OK" : "Review"],
    ].forEach(([name, value], index) => {
      label(ctx, name, x + 16 + index * 320, y + 30, "#60706a", 13);
      label(ctx, value, x + 16 + index * 320, y + 60, "#17211d", 20);
    });
  }

  function as3600Punching(rows) {
    return (rows || []).find((row) => /AS 3600/i.test(row.zone || "")) || (rows || [])[0];
  }

  function barChart(ctx, rows, x, axisY, height, width) {
    if (!rows.length) return;
    label(ctx, "X-direction column and middle strip flexure", x, axisY - height - 32, "#17211d", 18);
    const max = Math.max(1, ...rows.map((row) => Math.max(Math.abs(row.Mu || 0), Math.abs(row.phiMu || 0))));
    const group = width / rows.length;
    rows.forEach((row, index) => {
      const gx = x + index * group + 12;
      const demandHeight = (Math.abs(row.Mu || 0) / max) * height;
      const capacityHeight = (Math.abs(row.phiMu || 0) / max) * height;
      ctx.fillStyle = "#bd5b32";
      ctx.fillRect(gx, axisY - demandHeight, group * 0.25, demandHeight);
      ctx.fillStyle = "#126b63";
      ctx.fillRect(gx + group * 0.34, axisY - capacityHeight, group * 0.25, capacityHeight);
      label(ctx, String(row.zone || "").replace(/^X /, ""), gx, axisY + 24, "#60706a", 11);
    });
  }

  function punchingSketch(ctx, input, x, y, w, h, row) {
    label(ctx, "Punching shear plan", x, y - 34, "#17211d", 17);
    const planW = 330;
    const cx = x + planW / 2;
    const cy = y + h / 2;
    ctx.fillStyle = "#f7fbff";
    ctx.strokeStyle = "#17211d";
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, planW, h);
    ctx.strokeRect(x, y, planW, h);
    const colW = Math.max(42, Math.min(100, (Number(input.columnX || 450) / 1000) * 160));
    const colH = Math.max(42, Math.min(100, (Number(input.columnY || 450) / 1000) * 160));
    ctx.fillStyle = "rgba(96,112,106,.28)";
    ctx.fillRect(cx - colW / 2, cy - colH / 2, colW, colH);
    ctx.strokeStyle = "#60706a";
    ctx.strokeRect(cx - colW / 2, cy - colH / 2, colW, colH);
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "#bd5b32";
    ctx.strokeRect(cx - colW / 2 - 42, cy - colH / 2 - 42, colW + 84, colH + 84);
    ctx.setLineDash([]);
    const ix = x + planW + 26;
    label(ctx, `${Number(input.columnX || 0).toFixed(0)} x ${Number(input.columnY || 0).toFixed(0)} mm column`, ix, y + 28, "#17211d", 14);
    label(ctx, "critical shear perimeter", ix, y + 58, "#bd5b32", 14);
    label(ctx, `effective depth d = ${Number(input.d || 0).toFixed(0)} mm`, ix, y + 88, "#60706a", 14);
    if (row) label(ctx, `utilisation ${(row.util * 100).toFixed(0)}%`, ix, y + 128, row.util <= 1 ? "#126b63" : "#bd5b32", 14);
  }

  function gauge(ctx, row, x, y, w, h, titleText) {
    label(ctx, titleText, x, y - 30, "#17211d", 17);
    const util = Math.max(0, row.Mu || 0) / Math.max(1, row.phiMu || 1);
    card(ctx, x, y, w, h);
    ctx.fillStyle = util <= 1 ? "#126b63" : "#bd5b32";
    ctx.fillRect(x, y, Math.min(w, w * util), h);
    label(ctx, `${(row.Mu || 0).toFixed(1)} / ${(row.phiMu || 0).toFixed(1)} kN (${(util * 100).toFixed(0)}%)`, x + w / 2 - 120, y + h / 2 + 6, "#17211d", 16);
  }

  function wipe(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function title(ctx, heading, subheading, x, y) {
    label(ctx, heading, x, y, "#17211d", 26);
    label(ctx, subheading, x, y + 28, "#60706a", 15);
  }

  function card(ctx, x, y, w, h) {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(23,33,29,.14)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 8);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
  }

  function label(ctx, text, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.font = `${size}px system-ui`;
    ctx.textAlign = "left";
    ctx.fillText(String(text), x, y);
  }

  function line(ctx, x1, y1, x2, y2, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function poly(ctx, samples, xf, yf, color, dash) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    samples.forEach((sample, index) => {
      const x = xf(sample);
      const y = yf(sample);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function support(ctx, x, y, text) {
    line(ctx, x, y - 12, x, y + 10, "#60706a", 1.5);
    line(ctx, x - 8, y + 10, x + 8, y + 10, "#60706a", 1.5);
    label(ctx, text, x - 8, y + 25, "#60706a", 10);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
