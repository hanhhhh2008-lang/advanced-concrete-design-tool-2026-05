const $ = (id) => document.getElementById(id);

const DEFAULT_PSI_SHORT = 0.7;
const DEFAULT_PSI_LONG = 0.4;

const state = {
  spans: [
    { length: 6.0, g: 6.0, q: 4.0, system: "continuous" },
    { length: 7.0, g: 6.0, q: 4.0, system: "continuous" },
    { length: 5.5, g: 6.0, q: 4.0, system: "continuous" },
  ],
  combinations: defaultCombinations(),
  result: null,
  validation: { errors: [], warnings: [] },
  rebar: {
    top: [16, 20],
    bottom: [16, 20],
  },
  rebarSchedule: {
    top: [{ dia: 16, count: 5 }],
    bottom: [{ dia: 16, count: 5 }],
  },
  supportFixities: [50, 50, 50, 50],
  ptProfile: {
    highPoints: [60, 60, 60, 60],
    lowPoints: [160, 160, 160],
  },
  project: null,
  aiRecommendations: [],
  lastMemberType: "twoWay",
};

const defaults = {
  memberType: "twoWay",
  width: 1000,
  depth: 220,
  cover: 30,
  barDia: 16,
  fc: 32,
  fsy: 500,
  ec: 30000,
  elementsPerSpan: 8,
  sectionAnalysisMode: "uncracked",
  columnFixity: 50,
  deflectionRatio: 250,
  stressCompFactor: 0.45,
  stressTensFactor: 0.6,
  sectionShape: "rect",
  flangeWidth: 1000,
  flangeThickness: 100,
  sectionAreaFactor: 1,
  sectionInertiaFactor: 1,
  geometryName: "Default section",
  wetAreaEnabled: false,
  wetLoadKpa: 1.0,
  wetAreaPercent: 100,
  crackControlMode: "as3600",
  crackMaxSpacing: 250,
  creepFactor: 1.5,
  shrinkageStrain: 550,
  temperatureDelta: 0,
  thermalCoeff: 10,
  temperatureRestraint: 50,
  humidityFactor: 1,
  selfWeight: true,
  maxSpacing: 250,
  layers: 1,
  topLayerBars: "N16",
  bottomLayerBars: "N16",
  topBarsPerM: 5,
  bottomBarsPerM: 5,
  ptEnabled: false,
  ptTendonCount: 4,
  ptForce: 150,
  ptLossPercent: 15,
  ptStrandArea: 140,
  panelX: 8,
  panelY: 7,
  areaG: 3,
  areaQ: 4,
  columnX: 450,
  columnY: 450,
  columnStripPercent: 50,
  plateGrid: 18,
  supportType: "interior",
  projectName: "Concrete design job",
  projectCheckName: "Current span check",
};

function defaultCombinations() {
  return [
    { name: "AS1170 ULS permanent only 1.35G", type: "ULS", sw: 1.35, g: 1.35, q: 0, pattern: false },
    { name: "AS1170 ULS gravity 1.2G+1.5Q", type: "ULS", sw: 1.2, g: 1.2, q: 1.5, pattern: false },
    { name: "AS1170 ULS gravity patterned 1.2G+1.5Q", type: "ULS", sw: 1.2, g: 1.2, q: 1.5, pattern: true },
    { name: "AS1170 ULS long-term imposed 1.2G+1.5psi_lQ", type: "ULS", sw: 1.2, g: 1.2, q: roundComboFactor(1.5 * DEFAULT_PSI_LONG), pattern: false },
    { name: "AS1170 ULS stability 0.9G", type: "ULS", sw: 0.9, g: 0.9, q: 0, pattern: false },
    { name: "AS1170 SLS short-term G+psi_sQ", type: "SLS", sw: 1.0, g: 1.0, q: DEFAULT_PSI_SHORT, pattern: false },
    { name: "AS1170 SLS sustained G+psi_lQ", type: "SLS", sw: 1.0, g: 1.0, q: DEFAULT_PSI_LONG, pattern: false },
    { name: "AS1170 DEF short-term G+psi_sQ", type: "DEF", sw: 1.0, g: 1.0, q: DEFAULT_PSI_SHORT, pattern: false },
    { name: "AS1170 DEF sustained G+psi_lQ", type: "DEF", sw: 1.0, g: 1.0, q: DEFAULT_PSI_LONG, pattern: false },
    { name: "AS1170 DEF permanent only G", type: "DEF", sw: 1.0, g: 1.0, q: 0, pattern: false },
  ];
}

function init() {
  Object.entries(defaults).forEach(([key, value]) => {
    const el = $(key);
    if (!el) return;
    if (el.type === "checkbox") el.checked = value;
    else el.value = value;
  });
  renderSpans();
  renderCombinations();
  configureMemberInputs();
  renderReinforcementInput();
  renderGeometryLibrary();
  loadProjectFile();
  renderProjectFile();
  restoreWorkflowNavigatorState();
  bindEvents();
  safeRun();
}

function bindEvents() {
  $("memberType").addEventListener("change", () => {
    applyMemberPreset($("memberType").value);
    configureMemberInputs();
    renderReinforcementInput();
  });
  ["topLayerBars", "bottomLayerBars"].forEach((id) => {
    $(id)?.addEventListener("change", () => {
      renderReinforcementInput();
    });
  });
  $("layers").addEventListener("change", () => {
    renderReinforcementInput();
    safeRun();
  });
  $("workflowToggleBtn")?.addEventListener("click", () => {
    const collapsed = !$("workflowSection")?.classList.contains("collapsed");
    setWorkflowNavigatorCollapsed(collapsed, true);
  });
  $("resetCombosBtn").addEventListener("click", () => {
    state.combinations = defaultCombinations();
    renderCombinations(true);
    safeRun();
  });
  $("addSpanBtn").addEventListener("click", () => {
    state.spans.push({ length: 6, g: 5, q: 3, system: "continuous" });
    state.supportFixities.push(normaliseFixityPercent(Number($("columnFixity").value)));
    renderSpans();
    safeRun();
  });
  $("columnFixity").addEventListener("change", () => {
    const fixity = normaliseFixityPercent(Number($("columnFixity").value));
    state.supportFixities = Array(state.spans.length + 1).fill(fixity);
    renderSupportFixities();
    safeRun();
  });
  ["ptEnabled", "ptTendonCount", "ptForce", "ptLossPercent", "ptStrandArea"].forEach((id) => {
    $(id).addEventListener("change", () => {
      renderPtProfile();
      safeRun();
    });
  });
  ["sectionShape", "flangeWidth", "flangeThickness", "sectionAreaFactor", "sectionInertiaFactor", "wetAreaEnabled", "wetLoadKpa", "wetAreaPercent"].forEach((id) => {
    $(id)?.addEventListener("change", () => {
      drawInputSectionPreview();
      safeRun();
    });
  });
  $("saveGeometryBtn")?.addEventListener("click", () => {
    saveGeometryToLibrary();
    safeRun();
  });
  $("loadGeometryBtn")?.addEventListener("click", () => {
    loadSelectedGeometryFromLibrary();
    safeRun();
  });
  $("geometryLibrarySelect")?.addEventListener("change", updateGeometryLibraryStatus);
  document.querySelectorAll("input,select").forEach((el) => {
    ["input", "change"].forEach((eventName) => {
      el.addEventListener(eventName, (event) => {
        clearAiSuggestionOnManualEdit(event.currentTarget, event);
        safeRun();
      });
    });
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.view));
  });
  document.querySelectorAll(".menu-action").forEach((item) => {
    item.addEventListener("click", () => switchTab(item.dataset.view));
  });
  document.querySelectorAll(".menu-command").forEach((item) => {
    item.addEventListener("click", () => handleMenuCommand(item.dataset.menuCommand));
  });
  $("runAnalysisBtn").addEventListener("click", () => {
    safeRun();
    switchTab("model");
  });
  ["aiAdjustBtn", "aiAdjustHeaderBtn", "aiProjectAdjustBtn"].forEach((id) => {
    $(id)?.addEventListener("click", () => {
      runAiAdjustTool();
      switchTab("messages");
    });
  });
  $("saveProjectCheckBtn")?.addEventListener("click", () => {
    saveCurrentCheckToProject();
    switchTab("messages");
  });
  $("aiAnalyzeProjectBtn")?.addEventListener("click", () => {
    analyzeProjectFile();
    switchTab("messages");
  });
  $("exportProjectBtn")?.addEventListener("click", exportProjectFile);
  $("clearProjectBtn")?.addEventListener("click", () => {
    clearProjectFile();
    switchTab("messages");
  });
  $("calculateBtn").addEventListener("click", safeRun);
}

function handleMenuCommand(command) {
  if (command === "file") {
    saveGeometryToLibrary();
    return;
  }
  if (command === "edit") {
    $("sectionGeometrySection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    $("sectionShape")?.focus();
    return;
  }
  if (command === "view") {
    safeRun();
    switchTab("model");
  }
}

function restoreWorkflowNavigatorState() {
  const collapsed = readStoredBoolean("workflowNavigatorCollapsed", false);
  setWorkflowNavigatorCollapsed(collapsed, false);
}

function setWorkflowNavigatorCollapsed(collapsed, persist = true) {
  const section = $("workflowSection");
  const tree = $("workflowTree");
  const toggle = $("workflowToggleBtn");
  if (!section || !tree || !toggle) return;
  section.classList.toggle("collapsed", collapsed);
  tree.hidden = collapsed;
  toggle.textContent = collapsed ? "Show" : "Hide";
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggle.title = collapsed ? "Show workflow navigator" : "Hide workflow navigator";
  if (persist) writeStoredBoolean("workflowNavigatorCollapsed", collapsed);
}

function readStoredBoolean(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    if (value == null) return fallback;
    return value === "true";
  } catch {
    return fallback;
  }
}

function writeStoredBoolean(key, value) {
  try {
    window.localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // Storage can be disabled for local files; the button still works for the current page session.
  }
}

function geometryLibraryKey() {
  return "advancedConcreteGeometryLibrary";
}

function readGeometryLibrary() {
  try {
    return JSON.parse(window.localStorage.getItem(geometryLibraryKey()) || "[]").filter((item) => item?.name);
  } catch {
    return [];
  }
}

function writeGeometryLibrary(items) {
  try {
    window.localStorage.setItem(geometryLibraryKey(), JSON.stringify(items));
  } catch {
    // Local files can disable storage. The status text reports that the save did not persist.
  }
}

function renderGeometryLibrary(selectedName = "") {
  const select = $("geometryLibrarySelect");
  if (!select) return;
  const library = readGeometryLibrary();
  select.innerHTML = library.length
    ? library.map((item) => `<option value="${escapeAttr(item.name)}">${escapeHtml(item.name)}</option>`).join("")
    : `<option value="">No saved sections</option>`;
  if (selectedName && library.some((item) => item.name === selectedName)) select.value = selectedName;
  updateGeometryLibraryStatus();
}

function updateGeometryLibraryStatus(text = "") {
  const target = $("geometryLibraryStatus");
  if (!target) return;
  const library = readGeometryLibrary();
  const selected = $("geometryLibrarySelect")?.value;
  if (text) {
    target.textContent = text;
  } else if (selected) {
    const item = library.find((entry) => entry.name === selected);
    target.textContent = item ? `${sectionShapeLabel(item)} saved for ${item.memberType || "member"}.` : "Saved geometry selected.";
  } else {
    target.textContent = "No saved geometry loaded.";
  }
}

function geometrySnapshotFromControls() {
  return {
    name: ($("geometryName")?.value || "Saved section").trim() || "Saved section",
    memberType: $("memberType")?.value || defaults.memberType,
    width: Number($("width")?.value || defaults.width),
    depth: Number($("depth")?.value || defaults.depth),
    cover: Number($("cover")?.value || defaults.cover),
    sectionShape: normaliseSectionShape($("sectionShape")?.value),
    flangeWidth: Number($("flangeWidth")?.value || defaults.flangeWidth),
    flangeThickness: Number($("flangeThickness")?.value || defaults.flangeThickness),
    sectionAreaFactor: Number($("sectionAreaFactor")?.value || defaults.sectionAreaFactor),
    sectionInertiaFactor: Number($("sectionInertiaFactor")?.value || defaults.sectionInertiaFactor),
    wetAreaEnabled: $("wetAreaEnabled")?.checked || false,
    wetLoadKpa: Number($("wetLoadKpa")?.value || defaults.wetLoadKpa),
    wetAreaPercent: Number($("wetAreaPercent")?.value || defaults.wetAreaPercent),
  };
}

function saveGeometryToLibrary() {
  const snapshot = geometrySnapshotFromControls();
  const library = readGeometryLibrary().filter((item) => item.name !== snapshot.name);
  library.push({ ...snapshot, savedAt: new Date().toISOString() });
  writeGeometryLibrary(library.slice(-40));
  renderGeometryLibrary(snapshot.name);
  updateGeometryLibraryStatus(`Saved geometry "${snapshot.name}".`);
}

function loadSelectedGeometryFromLibrary() {
  const selected = $("geometryLibrarySelect")?.value;
  const item = readGeometryLibrary().find((entry) => entry.name === selected);
  if (!item) {
    updateGeometryLibraryStatus("No saved geometry is selected.");
    return;
  }
  applyGeometrySnapshot(item);
  updateGeometryLibraryStatus(`Loaded geometry "${item.name}".`);
}

function applyGeometrySnapshot(item) {
  const fields = {
    memberType: item.memberType,
    width: item.width,
    depth: item.depth,
    cover: item.cover,
    sectionShape: item.sectionShape,
    flangeWidth: item.flangeWidth,
    flangeThickness: item.flangeThickness,
    sectionAreaFactor: item.sectionAreaFactor,
    sectionInertiaFactor: item.sectionInertiaFactor,
    geometryName: item.name,
    wetLoadKpa: item.wetLoadKpa,
    wetAreaPercent: item.wetAreaPercent,
  };
  Object.entries(fields).forEach(([id, value]) => {
    const el = $(id);
    if (el && value != null) el.value = value;
  });
  if ($("wetAreaEnabled")) $("wetAreaEnabled").checked = Boolean(item.wetAreaEnabled);
  if (item.memberType) state.lastMemberType = item.memberType;
  configureMemberInputs();
  renderReinforcementInput();
  renderPtProfile();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function projectFileKey() {
  return "advancedConcreteProjectFile";
}

function defaultProjectFile() {
  return {
    name: $("projectName")?.value || defaults.projectName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    checks: [],
    aiSummary: [],
  };
}

function loadProjectFile() {
  try {
    state.project = JSON.parse(window.localStorage.getItem(projectFileKey()) || "null") || defaultProjectFile();
  } catch {
    state.project = defaultProjectFile();
  }
  if ($("projectName")) $("projectName").value = state.project.name || defaults.projectName;
  if ($("projectCheckName") && !$("projectCheckName").value) $("projectCheckName").value = defaults.projectCheckName;
}

function writeProjectFile() {
  if (!state.project) state.project = defaultProjectFile();
  state.project.name = $("projectName")?.value || state.project.name || defaults.projectName;
  state.project.updatedAt = new Date().toISOString();
  try {
    window.localStorage.setItem(projectFileKey(), JSON.stringify(state.project));
  } catch {
    // The UI still keeps the project data for this page session.
  }
}

function renderProjectFile() {
  const list = $("projectCheckList");
  if (!list) return;
  const project = state.project || defaultProjectFile();
  if ($("projectName")) $("projectName").value = project.name || defaults.projectName;
  list.innerHTML = project.checks.length
    ? project.checks
        .slice()
        .reverse()
        .map(
          (check) => `
          <div class="project-check-item ${check.statusOk ? "ok" : "fail"}">
            <div>
              <b>${escapeHtml(check.name)}</b>
              <span>${escapeHtml(check.memberTypeLabel)}; ${escapeHtml(check.spanSummary)}; ${escapeHtml(check.savedAtText)}</span>
            </div>
            <em>${check.statusOk ? "WORKS" : "FAILS"}</em>
          </div>`
        )
        .join("")
    : "No span checks saved in this project file yet.";
  renderAiRecommendations(project.aiSummary || state.aiRecommendations || []);
}

function saveCurrentCheckToProject() {
  safeRun();
  if (!state.result) {
    state.aiRecommendations = [{ type: "fail", title: "Cannot save check", text: "Fix input validation errors first, then run analysis again." }];
    renderAiRecommendations(state.aiRecommendations);
    return;
  }
  const reportText = $("report")?.value || "";
  const input = state.result.input;
  const project = state.project || defaultProjectFile();
  const name = ($("projectCheckName")?.value || `${memberTypeLabel(input.memberType)} check ${project.checks.length + 1}`).trim();
  const record = {
    id: `check-${Date.now()}`,
    name,
    savedAt: new Date().toISOString(),
    savedAtText: new Date().toLocaleString(),
    memberType: input.memberType,
    memberTypeLabel: memberTypeLabel(input.memberType),
    spanSummary: projectSpanSummary(input),
    statusOk: Boolean(state.result.status.ok),
    statusLabel: state.result.status.label,
    failures: state.result.status.failures.slice(),
    warnings: state.result.status.warnings.slice(),
    report: reportText,
    input: compactProjectInput(input),
    metrics: projectMetrics(state.result),
  };
  project.checks.push(record);
  project.aiSummary = analyzeProjectRecords(project.checks);
  state.project = project;
  writeProjectFile();
  renderProjectFile();
  if ($("projectCheckName")) $("projectCheckName").value = `${memberTypeLabel(input.memberType)} check ${project.checks.length + 1}`;
}

function clearProjectFile() {
  state.project = defaultProjectFile();
  state.aiRecommendations = [{ type: "info", title: "Project file cleared", text: "Saved checks were removed from this browser project file." }];
  writeProjectFile();
  renderProjectFile();
}

function exportProjectFile() {
  if (!state.project) state.project = defaultProjectFile();
  writeProjectFile();
  const data = JSON.stringify(state.project, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = (state.project.name || "concrete-design-job").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  link.href = url;
  link.download = `${safeName || "concrete-design-job"}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function analyzeProjectFile() {
  safeRun();
  if (!state.project) state.project = defaultProjectFile();
  if (!state.project.checks.length && state.result) saveCurrentCheckToProject();
  state.project.aiSummary = analyzeProjectRecords(state.project.checks);
  writeProjectFile();
  renderProjectFile();
  renderMessages();
}

function analyzeProjectRecords(checks) {
  const items = [];
  if (!checks.length) {
    return [{ type: "info", title: "No saved checks", text: "Save beam, one-way slab or two-way slab checks into the project file before running project analysis." }];
  }
  const failed = checks.filter((check) => !check.statusOk);
  const deflectionCritical = checks.filter((check) => check.metrics.deflectionRatio > 0.85);
  const strengthCritical = checks.filter((check) => check.metrics.flexureUtil > 0.9);
  const shearCritical = checks.filter((check) => check.metrics.shearUtil > 0.9);
  items.push({ type: failed.length ? "fail" : "ok", title: "Project status", text: `${checks.length} saved checks reviewed; ${failed.length} failing checks need design action.` });
  if (deflectionCritical.length) items.push({ type: "warn", title: "Deflection trend", text: `${deflectionCritical.length} checks are above 85% of the deflection limit. Consider more depth, transformed cracked analysis review, PT balancing or lower sustained load where project-appropriate.` });
  if (strengthCritical.length) items.push({ type: "warn", title: "Flexure trend", text: `${strengthCritical.length} checks are above 90% flexural utilisation. Increase effective depth, add reinforcement layers or review strip/load distribution.` });
  if (shearCritical.length) items.push({ type: "warn", title: "Shear trend", text: `${shearCritical.length} checks are above 90% shear utilisation. Increase section depth/width, support size or fitment density as applicable.` });
  const commonFailures = topFailureWords(failed);
  if (commonFailures) items.push({ type: "warn", title: "Repeated failure pattern", text: commonFailures });
  items.push({ type: "info", title: "Recommended workflow", text: "Use AI Adjust Tool for a conservative starting point, then review yellow fields manually and rerun all saved project checks." });
  return items;
}

function renderAiRecommendations(items = []) {
  const target = $("aiRecommendations");
  if (!target) return;
  target.innerHTML = items.length
    ? items.map((item) => `<div class="ai-recommendation ${item.type || "info"}"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.text)}</span></div>`).join("")
    : "Save one or more span checks, then run project analysis.";
}

function runAiAdjustTool() {
  safeRun();
  if (!state.result) {
    state.aiRecommendations = [{ type: "fail", title: "AI adjust blocked", text: "Input validation has errors. Correct red fields before automatic adjustment." }];
    renderAiRecommendations(state.aiRecommendations);
    return;
  }
  const suggestions = buildAiAdjustmentPlan(state.result);
  if (!suggestions.length) {
    state.aiRecommendations = [{ type: "ok", title: "No automatic changes needed", text: "Current design passes the implemented checks. Save the check into the project file for job-level review." }];
    renderAiRecommendations(state.aiRecommendations);
    renderMessages();
    return;
  }
  renderReinforcementInput();
  suggestions.forEach((item) => applyAiSuggestion(item.id, item.value, item.reason));
  renderPtProfile();
  safeRun();
  state.aiRecommendations = suggestions.map((item) => ({ type: "warn", title: `Adjusted ${inputLabelForId(item.id)}`, text: item.reason }));
  if (state.project) {
    state.project.aiSummary = state.aiRecommendations;
    writeProjectFile();
  }
  renderProjectFile();
  renderMessages();
}

function buildAiAdjustmentPlan(result) {
  const input = result.input;
  const suggestions = [];
  const push = (id, value, reason) => {
    const el = $(id);
    if (!el) return;
    const current = el.type === "checkbox" ? el.checked : Number.isFinite(Number(el.value)) ? Number(el.value) : el.value;
    if (String(current) !== String(value)) suggestions.push({ id, value, reason });
  };
  const metrics = projectMetrics(result);
  const hasDeflectionFail = result.status.failures.some((item) => /deflection/i.test(item)) || metrics.deflectionRatio > 0.95;
  const hasFlexureFail = result.status.failures.some((item) => /flexure|strength/i.test(item)) || metrics.flexureUtil > 0.95;
  const hasShearFail = result.status.failures.some((item) => /shear/i.test(item)) || metrics.shearUtil > 0.95;

  if (hasDeflectionFail) {
    push("depth", roundUpTo(Number($("depth").value) * 1.12, 10), "Deflection is high, so the tool increased section depth to improve stiffness.");
    push("elementsPerSpan", Math.max(Number($("elementsPerSpan").value), input.memberType === "twoWay" ? 12 : 16), "Mesh density was raised for better envelope and deflection resolution.");
    if (input.memberType === "twoWay") push("plateGrid", Math.max(Number($("plateGrid").value), 22), "Plate grid density was raised for clearer two-way deflection review.");
  }
  if (hasFlexureFail) {
    push("depth", roundUpTo(Math.max(Number($("depth").value) * 1.08, Number($("depth").value) + 20), 10), "Flexural utilisation is high, so depth was increased as a conservative first adjustment.");
    push("layers", Math.min(3, Math.max(Number($("layers").value), input.memberType === "beam" ? 2 : 1)), "Layer capacity was increased where useful for the selected member type.");
    increasePrimaryRebar("top", input.memberType, "Flexural envelope needs more top reinforcement near negative moment zones.");
    increasePrimaryRebar("bottom", input.memberType, "Flexural envelope needs more bottom reinforcement near positive moment zones.");
  }
  if (hasShearFail) {
    push("depth", roundUpTo(Math.max(Number($("depth").value) * 1.1, Number($("depth").value) + 25), 10), "Shear utilisation is high, so effective depth was increased.");
    if (input.memberType === "beam") push("width", roundUpTo(Math.max(Number($("width").value) * 1.1, Number($("width").value) + 25), 10), "Beam shear is high, so web width was increased.");
    if (input.memberType === "twoWay") {
      push("columnX", roundUpTo(Number($("columnX").value) * 1.1, 25), "Two-way support shear is high, so column/support dimension was increased.");
      push("columnY", roundUpTo(Number($("columnY").value) * 1.1, 25), "Two-way support shear is high, so column/support dimension was increased.");
    }
  }
  if (state.validation.warnings.some((issue) => /spacing|crack/i.test(issue.message))) {
    push("maxSpacing", Math.min(Number($("maxSpacing").value), 200), "Crack/spacing warning found, so maximum reinforcement spacing was reduced.");
    push("crackMaxSpacing", Math.min(Number($("crackMaxSpacing").value), 200), "Crack-control spacing cap was tightened.");
  }

  function increasePrimaryRebar(face, memberType, reason) {
    const layers = resizeRebarLayers(state.rebarSchedule[face] || [], currentLayerCount(), memberType, face);
    if (!layers.length) return;
    const current = Number(layers[0].count || 0);
    layers[0].count = memberType === "beam" ? Math.min(12, current + 1) : Math.min(20, Math.round((current + 1) * 2) / 2);
    state.rebarSchedule[face] = layers;
    syncRebarScheduleToInputs();
    const selector = `[data-reo-face="${face}"][data-reo-index="0"][data-reo-field="count"]`;
    suggestions.push({ id: selector, value: layers[0].count, reason });
  }

  return suggestions;
}

function applyAiSuggestion(id, value, reason) {
  const el = id.startsWith("[") ? document.querySelector(id) : $(id);
  if (!el) return;
  if (el.type === "checkbox") el.checked = Boolean(value);
  else el.value = value;
  el.classList.add("ai-suggested");
  el.dataset.aiSuggestion = reason || "AI adjusted this input. Edit manually to clear yellow highlight.";
  el.title = reason || el.title || "AI adjusted this input. Edit manually to clear yellow highlight.";
}

function clearAiSuggestionOnManualEdit(el, event) {
  if (!el?.classList?.contains("ai-suggested")) return;
  el.classList.remove("ai-suggested");
  delete el.dataset.aiSuggestion;
  if (el.title && /AI adjusted/i.test(el.title)) el.removeAttribute("title");
}

function compactProjectInput(input) {
  return {
    memberType: input.memberType,
    spans: input.spans,
    b: input.b,
    D: input.D,
    cover: input.cover,
    fc: input.fc,
    fsy: input.fsy,
    Ec: input.Ec,
    sectionShape: input.sectionShape,
    panelX: input.panelX,
    panelY: input.panelY,
    supportType: input.supportType,
    reinforcementTop: formatRebarLayerSchedule(input, "top"),
    reinforcementBottom: formatRebarLayerSchedule(input, "bottom"),
    ptEnabled: input.ptEnabled,
  };
}

function projectMetrics(result) {
  if (result.mode === "twoWay") {
    const input = result.input;
    const deflectionLimit = (Math.min(input.panelX, input.panelY) * 1000) / input.deflectionRatio;
    return {
      flexureUtil: Math.max(...result.twoWay.strips.map((row) => row.util || 0), 0),
      shearUtil: Math.max(...result.twoWay.supportShear.map((row) => row.util || 0), 0),
      deflectionMm: result.twoWay.longPlate.maxDeflectionM * 1000,
      deflectionLimit,
      deflectionRatio: (result.twoWay.longPlate.maxDeflectionM * 1000) / Math.max(deflectionLimit, 1e-9),
    };
  }
  const worstFlexure = Math.max(...result.design.map((row) => row.util || 0), 0);
  const worstShear = Math.max(...result.design.map((row) => (row.shear ? row.shear.demand / Math.max(row.shear.phiVu, 1e-9) : 0)), 0);
  const lows = spanDeflectionLowPoints(result.input, result.deflection);
  const worstDeflection = Math.max(...lows.map((point) => point.longMm / Math.max(point.limitMm, 1e-9)), 0);
  const worstLow = lows.reduce((best, point) => (point.longMm / Math.max(point.limitMm, 1e-9) > best.longMm / Math.max(best.limitMm, 1e-9) ? point : best), lows[0] || { longMm: 0, limitMm: 1 });
  return {
    flexureUtil: worstFlexure,
    shearUtil: worstShear,
    deflectionMm: worstLow.longMm,
    deflectionLimit: worstLow.limitMm,
    deflectionRatio: worstDeflection,
  };
}

function projectSpanSummary(input) {
  if (input.memberType === "twoWay") return `${input.panelX} x ${input.panelY} m panel`;
  return `${input.spans.length} spans, total ${input.spans.reduce((sum, span) => sum + span.length, 0).toFixed(2)} m`;
}

function memberTypeLabel(memberType) {
  return memberType === "twoWay" ? "Two-way slab" : memberType === "slab" ? "One-way slab" : "Beam";
}

function inputLabelForId(id) {
  if (id.startsWith("[")) return id.includes('data-reo-face="top"') ? "top reinforcement" : "bottom reinforcement";
  const target = $(id);
  const label = [...document.querySelectorAll("label")].find((item) => item.contains(target));
  return label ? label.textContent.trim().replace(/\s+/g, " ") : id;
}

function topFailureWords(failedChecks) {
  const text = failedChecks.flatMap((check) => check.failures || []).join("; ");
  if (!text) return "";
  const buckets = [
    [/deflection/i, "deflection"],
    [/flexure|strength/i, "flexure"],
    [/shear/i, "shear"],
    [/spacing|crack/i, "crack/spacing"],
  ]
    .map(([regex, label]) => ({ label, count: (text.match(new RegExp(regex.source, "gi")) || []).length }))
    .filter((item) => item.count);
  if (!buckets.length) return "";
  return buckets.sort((a, b) => b.count - a.count).map((item) => `${item.label} appeared ${item.count} times`).join("; ");
}

function switchTab(view) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("active", panel.id === `view-${view}`));
}

function renderCombinations(forceDefaults = false) {
  const strengthSelect = $("strengthCombo");
  const serviceSelect = $("serviceCombo");
  const previousStrength = strengthSelect.value;
  const previousService = serviceSelect.value;
  strengthSelect.innerHTML = "";
  serviceSelect.innerHTML = "";

  state.combinations.forEach((combo, i) => {
    const option = new Option(combo.name, String(i));
    if (combo.type === "ULS") strengthSelect.add(option.cloneNode(true));
    if (combo.type === "SLS" || combo.type === "DEF") serviceSelect.add(option.cloneNode(true));
  });
  const defaultStrength = state.combinations.findIndex((c) => c.name === "AS1170 ULS gravity patterned 1.2G+1.5Q");
  const defaultService = state.combinations.findIndex((c) => c.name === "AS1170 DEF short-term G+psi_sQ");
  strengthSelect.value = !forceDefaults && previousStrength && state.combinations[Number(previousStrength)]?.type === "ULS" ? previousStrength : String(defaultStrength >= 0 ? defaultStrength : state.combinations.findIndex((c) => c.type === "ULS"));
  serviceSelect.value = !forceDefaults && previousService && ["SLS", "DEF"].includes(state.combinations[Number(previousService)]?.type) ? previousService : String(defaultService >= 0 ? defaultService : state.combinations.findIndex((c) => c.type === "DEF"));

  $("comboRows").innerHTML = state.combinations
    .map(
      (combo, i) => `
      <tr>
        <td><input value="${combo.name}" data-combo="${i}" data-field="name"></td>
        <td>
          <select data-combo="${i}" data-field="type">
            <option value="ULS" ${combo.type === "ULS" ? "selected" : ""}>ULS</option>
            <option value="SLS" ${combo.type === "SLS" ? "selected" : ""}>SLS</option>
            <option value="DEF" ${combo.type === "DEF" ? "selected" : ""}>DEF</option>
          </select>
        </td>
        <td><input type="number" step="0.05" value="${formatComboFactor(combo.sw)}" data-combo="${i}" data-field="sw"></td>
        <td><input type="number" step="0.05" value="${formatComboFactor(combo.g)}" data-combo="${i}" data-field="g"></td>
        <td><input type="number" step="0.05" value="${formatComboFactor(combo.q)}" data-combo="${i}" data-field="q"></td>
        <td><input type="checkbox" ${combo.pattern ? "checked" : ""} data-combo="${i}" data-field="pattern"></td>
      </tr>`
    )
    .join("");

  $("comboRows").querySelectorAll("input,select").forEach((el) => {
    el.addEventListener("change", (event) => {
      const target = event.currentTarget;
      const combo = state.combinations[Number(target.dataset.combo)];
      if (target.dataset.field === "pattern") combo.pattern = target.checked;
      else if (["sw", "g", "q"].includes(target.dataset.field)) combo[target.dataset.field] = Number(target.value);
      else combo[target.dataset.field] = target.value;
      renderCombinations();
      safeRun();
    });
  });
}

function roundComboFactor(value) {
  return Math.round(value * 1000) / 1000;
}

function formatComboFactor(value) {
  return roundComboFactor(Number(value)).toFixed(3).replace(/\.?0+$/, "");
}

function renderSpans() {
  const container = $("spans");
  container.innerHTML = "";
  const memberType = $("memberType")?.value || "twoWay";
  const prefix = memberType === "beam" ? "Beam span" : "Strip span";
  state.spans.forEach((span, i) => {
    span.system = normaliseSpanSystem(span.system);
    const row = document.createElement("div");
    row.className = "span-row";
    row.innerHTML = `
      <label>${prefix} ${i + 1} length (m)<input type="number" min="0.5" step="0.1" value="${span.length}" data-span="${i}" data-field="length"></label>
      <label>Permanent G (kN/m)<input type="number" min="0" step="0.1" value="${span.g}" data-span="${i}" data-field="g"></label>
      <label>Live Q (kN/m)<input type="number" min="0" step="0.1" value="${span.q}" data-span="${i}" data-field="q"></label>
      <label>Span system
        <select data-span="${i}" data-field="system">
          <option value="continuous" ${span.system === "continuous" ? "selected" : ""}>Continuous/supports</option>
          <option value="simple" ${span.system === "simple" ? "selected" : ""}>Simply supported</option>
          <option value="leftCantilever" ${span.system === "leftCantilever" ? "selected" : ""}>Cantilever left</option>
          <option value="rightCantilever" ${span.system === "rightCantilever" ? "selected" : ""}>Cantilever right</option>
        </select>
      </label>
      <button type="button" title="Remove span" data-remove="${i}">x</button>
    `;
    container.appendChild(row);
  });
  container.querySelectorAll("input,select").forEach((input) => {
    input.addEventListener("change", (event) => {
      const target = event.currentTarget;
      const span = state.spans[Number(target.dataset.span)];
      span[target.dataset.field] = target.dataset.field === "system" ? normaliseSpanSystem(target.value) : Number(target.value);
      safeRun();
    });
  });
  container.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (state.spans.length === 1) return;
      const removed = Number(event.currentTarget.dataset.remove);
      state.spans.splice(removed, 1);
      state.supportFixities.splice(Math.min(removed + 1, state.supportFixities.length - 1), 1);
      renderSpans();
      safeRun();
    });
  });
  renderSupportFixities();
  renderPtProfile();
}

function renderSupportFixities() {
  const container = $("supportFixities");
  if (!container) return;
  ensureSupportFixities();
  container.innerHTML = state.supportFixities
    .map(
      (fixity, i) => `
      <label>S${i + 1} fixity (%)
        <input type="number" min="0" max="100" step="5" value="${fixity}" data-support="${i}" data-field="fixity">
      </label>`
    )
    .join("");
  container.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", (event) => {
      const target = event.currentTarget;
      state.supportFixities[Number(target.dataset.support)] = normaliseFixityPercent(Number(target.value));
      target.value = state.supportFixities[Number(target.dataset.support)];
      safeRun();
    });
  });
}

function ensureSupportFixities() {
  const targetCount = state.spans.length + 1;
  const fallback = normaliseFixityPercent(Number($("columnFixity")?.value ?? defaults.columnFixity));
  while (state.supportFixities.length < targetCount) state.supportFixities.push(fallback);
  if (state.supportFixities.length > targetCount) state.supportFixities.length = targetCount;
  state.supportFixities = state.supportFixities.map((value) => normaliseFixityPercent(value ?? fallback));
}

function normaliseSpanSystem(value) {
  return ["continuous", "simple", "leftCantilever", "rightCantilever"].includes(value) ? value : "continuous";
}

function spanSystemLabel(value) {
  const labels = {
    continuous: "continuous",
    simple: "simply supported",
    leftCantilever: "left cantilever",
    rightCantilever: "right cantilever",
  };
  return labels[normaliseSpanSystem(value)] || labels.continuous;
}

function spanBoundarySupportStates(input) {
  const supported = Array(input.spans.length + 1).fill(false);
  input.spans.forEach((span, i) => {
    const system = normaliseSpanSystem(span.system);
    if (system === "leftCantilever") {
      supported[i + 1] = true;
      return;
    }
    if (system === "rightCantilever") {
      supported[i] = true;
      return;
    }
    supported[i] = true;
    supported[i + 1] = true;
  });
  return supported;
}

function isBoundarySupported(input, boundaryIndex) {
  return spanBoundarySupportStates(input)[boundaryIndex] !== false;
}

function renderPtProfile() {
  const container = $("ptProfileRows");
  if (!container) return;
  ensurePtProfile();
  const memberType = $("memberType")?.value || "twoWay";
  const isTwoWay = memberType === "twoWay";
  $("ptProfileHint").textContent = isTwoWay
    ? "Two-way mode uses an equivalent tendon band along panel Lx. High points are panel edge/support points; the low point is panel midspan."
    : "High points are over supports; low points are near span sag points. Values are from slab/beam top face.";
  const highRows = state.ptProfile.highPoints.map(
    (value, i) => `
      <label>${isTwoWay ? `Panel edge H${i + 1}` : `Support S${i + 1} high point`} (mm)
        <input type="number" min="0" step="5" value="${value}" data-pt-profile="high" data-pt-index="${i}">
      </label>`
  );
  const lowRows = state.ptProfile.lowPoints.map(
    (value, i) => `
      <label>${isTwoWay ? "Panel low point" : `Span ${i + 1} low point`} (mm)
        <input type="number" min="0" step="5" value="${value}" data-pt-profile="low" data-pt-index="${i}">
      </label>`
  );
  container.innerHTML = [...highRows, ...lowRows].join("");
  container.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", (event) => {
      const target = event.currentTarget;
      clearAiSuggestionOnManualEdit(target, event);
      const key = target.dataset.ptProfile === "high" ? "highPoints" : "lowPoints";
      const index = Number(target.dataset.ptIndex);
      state.ptProfile[key][index] = normalisePtPoint(Number(target.value));
      target.value = state.ptProfile[key][index];
      drawPtInputPreview();
      safeRun();
    });
  });
  drawPtInputPreview();
}

function ensurePtProfile() {
  const counts = ptProfileCounts();
  resizePtArray(state.ptProfile.highPoints, counts.highCount, defaultPtHighPoint());
  resizePtArray(state.ptProfile.lowPoints, counts.lowCount, defaultPtLowPoint());
}

function ptProfileCounts(input = null) {
  const memberType = input?.memberType || $("memberType")?.value || "twoWay";
  if (memberType === "twoWay") return { highCount: 2, lowCount: 1 };
  return { highCount: state.spans.length + 1, lowCount: state.spans.length };
}

function resizePtArray(items, targetCount, fallback) {
  while (items.length < targetCount) items.push(fallback);
  if (items.length > targetCount) items.length = targetCount;
  for (let i = 0; i < items.length; i++) items[i] = normalisePtPoint(items[i] ?? fallback);
}

function defaultPtHighPoint() {
  return Math.max(35, Number($("cover")?.value || defaults.cover) + 25);
}

function defaultPtLowPoint() {
  const depth = Number($("depth")?.value || defaults.depth);
  return Math.max(defaultPtHighPoint() + 20, depth - Math.max(45, Number($("cover")?.value || defaults.cover) + 25));
}

function normalisePtPoint(value) {
  const numeric = Number(value);
  return Math.max(0, Number.isFinite(numeric) ? numeric : 0);
}

function applyMemberPreset(memberType) {
  if (state.lastMemberType === memberType) return;
  state.lastMemberType = memberType;
  const presets = {
    twoWay: { width: 1000, depth: 220, cover: 30, barDia: 16, layers: 1, elementsPerSpan: 8, columnFixity: 50, sectionShape: "rect", flangeWidth: 1000, flangeThickness: 100, topLayerBars: "N16", bottomLayerBars: "N16", topBarsPerM: 5, bottomBarsPerM: 5 },
    slab: { width: 1000, depth: 200, cover: 30, barDia: 16, layers: 1, elementsPerSpan: 10, columnFixity: 50, sectionShape: "rect", flangeWidth: 1000, flangeThickness: 100, topLayerBars: "N16", bottomLayerBars: "N16", topBarsPerM: 5, bottomBarsPerM: 5 },
    beam: { width: 300, depth: 600, cover: 40, barDia: 20, layers: 2, elementsPerSpan: 12, columnFixity: 50, sectionShape: "rect", flangeWidth: 900, flangeThickness: 120, topLayerBars: "N20,N16", bottomLayerBars: "N20,N20", topBarsPerM: 2, bottomBarsPerM: 3 },
  };
  Object.entries(presets[memberType] || {}).forEach(([id, value]) => {
    const el = $(id);
    if (el) el.value = value;
  });
  state.supportFixities = Array(state.spans.length + 1).fill(normaliseFixityPercent(Number($("columnFixity").value)));
  resetRebarScheduleForMember(memberType);
  state.ptProfile.highPoints = [];
  state.ptProfile.lowPoints = [];
  ensurePtProfile();
}

function configureMemberInputs() {
  const memberType = $("memberType").value;
  $("spanSectionTitle").textContent = memberType === "beam" ? "Beam Input: Spans, Line Loads and Fixity" : "One-Way Slab Strip Input";
  $("spanSectionHint").textContent =
    memberType === "beam"
      ? "Beam mode uses span lengths, G/Q line loads, support fixity and beam-specific shear fitments. Two-way panel inputs are hidden."
      : "One-way slab mode uses a 1000 mm design strip with spans, line loads and support fixity. Two-way panel inputs are hidden.";
  renderSpans();
  setMemberLayoutState(memberType);
  renderPtProfile();
  const labels = {
    twoWay: "Two-way slab panel design with automatic support-shear review",
    slab: "One-way slab strip design with one-way shear review",
    beam: "Beam design with transverse fitments",
  };
  $("memberContextLabel").textContent = labels[memberType] || labels.twoWay;
}

function setMemberLayoutState(memberType) {
  const isTwoWay = memberType === "twoWay";
  document.body.dataset.memberType = memberType;
  document.body.dataset.layoutMode = isTwoWay ? "two-way" : "line";
  setSectionVisible($("twoWayPanelSection"), isTwoWay);
  setSectionVisible($("spanInputSection"), !isTwoWay);
  $("twoWayPanelSection")?.classList.toggle("active-layout", isTwoWay);
  $("spanInputSection")?.classList.toggle("active-layout", !isTwoWay);
  setSectionControlsEnabled($("twoWayPanelSection"), isTwoWay);
  setSectionControlsEnabled($("spanInputSection"), !isTwoWay);
}

function setSectionVisible(section, visible) {
  if (!section) return;
  section.hidden = !visible;
  section.style.display = visible ? "" : "none";
  section.setAttribute?.("aria-hidden", visible ? "false" : "true");
}

function setSectionControlsEnabled(section, enabled) {
  if (!section) return;
  section.querySelectorAll("input,select,button").forEach((control) => {
    control.disabled = !enabled;
  });
}

function renderReinforcementInput() {
  renderRebarSchedule();
  renderRebarChips();
  drawInputSectionPreview();
}

function resetRebarScheduleForMember(memberType) {
  const beam = memberType === "beam";
  state.rebarSchedule = {
    top: beam ? [{ dia: 20, count: 2 }, { dia: 16, count: 2 }] : [{ dia: 16, count: 5 }],
    bottom: beam ? [{ dia: 20, count: 3 }, { dia: 20, count: 2 }] : [{ dia: 16, count: 5 }],
  };
  syncRebarScheduleToInputs();
}

function renderRebarSchedule() {
  const memberType = $("memberType").value;
  const layerCount = currentLayerCount();
  ["top", "bottom"].forEach((face) => {
    const container = $(`${face}LayerRows`);
    if (!container) return;
    const layers = resizeRebarLayers(readRebarLayers(face, memberType), layerCount, memberType, face);
    state.rebarSchedule[face] = layers;
    const countLabel = memberType === "beam" ? "Bars in layer" : "Bars per metre";
    const countStep = memberType === "beam" ? "1" : "0.5";
    const countMin = memberType === "beam" ? "0" : "0";
    container.innerHTML = layers
      .map(
        (layer, i) => `
        <div class="reo-layer-row">
          <strong>Layer ${i + 1}</strong>
          <label>Bar size
            <select data-reo-face="${face}" data-reo-index="${i}" data-reo-field="dia">
              ${standardRebarSizes().map((dia) => `<option value="${dia}" ${dia === layer.dia ? "selected" : ""}>N${dia}</option>`).join("")}
            </select>
          </label>
          <label>${countLabel}
            <input type="number" min="${countMin}" max="30" step="${countStep}" value="${formatLayerCount(layer.count, memberType)}" data-reo-face="${face}" data-reo-index="${i}" data-reo-field="count">
          </label>
        </div>`
      )
      .join("");
    container.querySelectorAll("input,select").forEach((control) => {
      control.addEventListener("change", (event) => {
        clearAiSuggestionOnManualEdit(event.currentTarget, event);
        updateRebarLayerFromControl(event.currentTarget);
        syncRebarScheduleToInputs();
        renderRebarSummaries();
        drawInputSectionPreview();
        safeRun();
      });
    });
  });
  syncRebarScheduleToInputs();
  renderRebarSummaries();
}

function renderRebarChips() {
  const memberType = $("memberType").value;
  ["top", "bottom"].forEach((face) => {
    const container = $(`${face}BarChips`);
    if (!container) return;
    const selected = selectedBarsForFace(face, memberType);
    const available = standardRebarSizes();
    container.innerHTML = available
      .map((dia) => `<button class="bar-chip ${selected.includes(dia) ? "active" : ""}" type="button" data-face="${face}" data-dia="${dia}">N${dia}</button>`)
      .join("");
    container.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        setPrimaryRebarSize(button.dataset.face, Number(button.dataset.dia));
        renderReinforcementInput();
        safeRun();
      });
    });
  });
}

function updateRebarLayerFromControl(control) {
  const face = control.dataset.reoFace;
  const index = Number(control.dataset.reoIndex);
  const field = control.dataset.reoField;
  const memberType = $("memberType").value;
  const layers = resizeRebarLayers(state.rebarSchedule[face] || [], currentLayerCount(), memberType, face);
  const layer = layers[index] || defaultRebarLayer(memberType, face, index);
  layer[field] = field === "dia" ? Number(control.value) : normaliseRebarLayerCount(Number(control.value), memberType);
  layers[index] = layer;
  state.rebarSchedule[face] = layers;
  if (field === "count") control.value = formatLayerCount(layer.count, memberType);
}

function captureRebarScheduleFromControls(memberType = $("memberType")?.value || defaults.memberType) {
  ["top", "bottom"].forEach((face) => {
    const rendered = readRenderedRebarLayers(face, memberType);
    if (rendered.length) {
      state.rebarSchedule[face] = resizeRebarLayers(rendered, currentLayerCount(), memberType, face);
    }
  });
}

function setPrimaryRebarSize(face, dia) {
  const memberType = $("memberType").value;
  const layers = resizeRebarLayers(state.rebarSchedule[face] || [], currentLayerCount(), memberType, face);
  layers[0] = { ...layers[0], dia };
  state.rebarSchedule[face] = layers;
  syncRebarScheduleToInputs();
}

function renderRebarSummaries() {
  const memberType = $("memberType").value;
  ["top", "bottom"].forEach((face) => {
    const target = $(`${face}ReoSummary`);
    if (!target) return;
    const provided = scheduledReoForFace({ memberType, rebarSchedule: state.rebarSchedule }, face);
    target.textContent = memberType === "beam" ? `${provided.count || 0} bars, ${provided.as.toFixed(0)} mm2` : `${formatBarsPerM(provided.countPerM || 0)}/m, ${provided.as.toFixed(0)} mm2/m`;
  });
}

function readRebarLayers(face, memberType) {
  const stored = state.rebarSchedule?.[face];
  if (stored?.length) return stored.map((layer) => ({ ...layer }));
  const rendered = readRenderedRebarLayers(face, memberType);
  if (rendered.length) return rendered;
  return layerBarsFromInputs(face, memberType);
}

function readRenderedRebarLayers(face, memberType) {
  const rows = [...document.querySelectorAll(`[data-reo-face="${face}"][data-reo-field="dia"]`)];
  return rows
    .map((select) => {
      const index = Number(select.dataset.reoIndex);
      const count = document.querySelector(`[data-reo-face="${face}"][data-reo-index="${index}"][data-reo-field="count"]`);
      return {
        dia: Number(select.value),
        count: normaliseRebarLayerCount(Number(count?.value || 0), memberType),
      };
    })
    .filter((layer) => layer.dia > 0);
}

function layerBarsFromInputs(face, memberType) {
  const bars = parseBars($(face === "top" ? "topLayerBars" : "bottomLayerBars")?.value || "");
  const count = Number($(face === "top" ? "topBarsPerM" : "bottomBarsPerM")?.value || (memberType === "beam" ? (face === "top" ? 2 : 3) : 5));
  return (bars.length ? bars : [memberType === "beam" ? 20 : 16]).map((dia, i) => ({
    dia,
    count: normaliseRebarLayerCount(i === 0 ? count : memberType === "beam" ? 0 : 0, memberType),
  }));
}

function resizeRebarLayers(layers, targetCount, memberType, face) {
  const resized = layers.slice(0, targetCount).map((layer, i) => ({
    dia: standardRebarSizes().includes(Number(layer.dia)) ? Number(layer.dia) : defaultRebarLayer(memberType, face, i).dia,
    count: normaliseRebarLayerCount(Number(layer.count), memberType),
  }));
  while (resized.length < targetCount) resized.push(defaultRebarLayer(memberType, face, resized.length));
  return resized;
}

function defaultRebarLayer(memberType, face, index) {
  if (memberType === "beam") {
    const dia = face === "top" ? (index === 0 ? 20 : 16) : 20;
    const count = index === 0 ? (face === "top" ? 2 : 3) : 0;
    return { dia, count };
  }
  return { dia: 16, count: index === 0 ? 5 : 0 };
}

function normaliseRebarLayerCount(value, memberType) {
  const numeric = Number.isFinite(value) ? Math.max(0, value) : 0;
  return memberType === "beam" ? Math.round(numeric) : Math.round(numeric * 2) / 2;
}

function formatLayerCount(value, memberType) {
  return memberType === "beam" || Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function currentLayerCount() {
  const el = $("layers");
  const count = clamp(Math.round(Number(el?.value || defaults.layers)), 1, 3);
  if (el) el.value = count;
  return count;
}

function syncRebarScheduleToInputs() {
  const memberType = $("memberType")?.value || defaults.memberType;
  ["top", "bottom"].forEach((face) => {
    const layers = resizeRebarLayers(state.rebarSchedule[face] || [], currentLayerCount(), memberType, face);
    state.rebarSchedule[face] = layers;
    const active = layers.filter((layer) => layer.count > 0);
    const bars = uniqueNumbers((active.length ? active : layers).map((layer) => layer.dia));
    setFaceBarInput(face, bars);
    const countEl = $(face === "top" ? "topBarsPerM" : "bottomBarsPerM");
    if (countEl) countEl.value = faceLayerCountTotal(layers, memberType);
  });
}

function selectedBarsForFace(face, memberType) {
  const layers = state.rebarSchedule?.[face] || [];
  const selected = layers.length ? uniqueNumbers(layers.filter((layer) => layer.count > 0).map((layer) => layer.dia)) : parseBars($(face === "top" ? "topLayerBars" : "bottomLayerBars")?.value || "");
  state.rebar[face] = uniqueNumbers(selected);
  return state.rebar[face].slice();
}

function setFaceBarInput(face, bars) {
  const el = $(face === "top" ? "topLayerBars" : "bottomLayerBars");
  if (!el) return;
  el.value = bars.map((dia) => `N${dia}`).join(",");
  state.rebar[face] = bars.slice();
}

function uniqueNumbers(values) {
  return [...new Set(values.map(Number).filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b);
}

function standardRebarSizes() {
  return [12, 16, 20, 24, 28, 32, 36];
}

function standardRebarSizesText() {
  return standardRebarSizes().map((dia) => `N${dia}`).join(",");
}

function readInputs() {
  const memberType = $("memberType").value;
  captureRebarScheduleFromControls(memberType);
  syncRebarScheduleToInputs();
  const rebarSchedule = {
    top: resizeRebarLayers(state.rebarSchedule.top || [], currentLayerCount(), memberType, "top"),
    bottom: resizeRebarLayers(state.rebarSchedule.bottom || [], currentLayerCount(), memberType, "bottom"),
  };
  const topBars = selectedBarsForFace("top", memberType);
  const bottomBars = selectedBarsForFace("bottom", memberType);
  const designBars = uniqueNumbers([...topBars, ...bottomBars]);
  const governingBarDia = Math.max(Number($("barDia").value), ...designBars);
  const data = {
    memberType,
    b: Number($("width").value),
    D: Number($("depth").value),
    cover: Number($("cover").value),
    barDia: governingBarDia,
    fc: Number($("fc").value),
    fsy: Number($("fsy").value),
    Ec: Number($("ec").value),
    elementsPerSpan: Number($("elementsPerSpan").value),
    sectionAnalysisMode: normaliseSectionAnalysisMode($("sectionAnalysisMode")?.value),
    columnFixity: Number($("columnFixity").value),
    deflectionRatio: Number($("deflectionRatio").value),
    stressCompFactor: Number($("stressCompFactor").value),
    stressTensFactor: Number($("stressTensFactor").value),
    sectionShape: normaliseSectionShape($("sectionShape")?.value),
    flangeWidth: Number($("flangeWidth")?.value),
    flangeThickness: Number($("flangeThickness")?.value),
    sectionAreaFactor: Number($("sectionAreaFactor")?.value),
    sectionInertiaFactor: Number($("sectionInertiaFactor")?.value),
    geometryName: $("geometryName")?.value || "Current section",
    wetAreaEnabled: $("wetAreaEnabled")?.checked || false,
    wetLoadKpa: Number($("wetLoadKpa")?.value),
    wetAreaPercent: Number($("wetAreaPercent")?.value),
    crackControlMode: $("crackControlMode")?.value || defaults.crackControlMode,
    crackMaxSpacing: Number($("crackMaxSpacing")?.value),
    creepFactor: Number($("creepFactor")?.value),
    shrinkageStrain: Number($("shrinkageStrain")?.value),
    temperatureDelta: Number($("temperatureDelta")?.value),
    thermalCoeff: Number($("thermalCoeff")?.value),
    temperatureRestraint: Number($("temperatureRestraint")?.value),
    humidityFactor: Number($("humidityFactor")?.value),
    selfWeight: $("selfWeight").checked,
    panelX: Number($("panelX").value),
    panelY: Number($("panelY").value),
    areaG: Number($("areaG").value),
    areaQ: Number($("areaQ").value),
    columnX: Number($("columnX").value),
    columnY: Number($("columnY").value),
    columnStripPercent: Number($("columnStripPercent").value),
    plateGrid: Number($("plateGrid").value),
    supportType: $("supportType").value,
    maxSpacing: Number($("maxSpacing").value),
    layers: Number($("layers").value),
    rebarSchedule,
    topRebarLayers: rebarSchedule.top,
    bottomRebarLayers: rebarSchedule.bottom,
    topBars,
    bottomBars,
    topBarsPerM: faceLayerCountTotal(rebarSchedule.top, memberType),
    bottomBarsPerM: faceLayerCountTotal(rebarSchedule.bottom, memberType),
    bars: designBars,
    supportFixities: supportFixitiesForInput(),
    ptEnabled: $("ptEnabled").checked,
    ptTendonCount: Number($("ptTendonCount").value),
    ptForce: Number($("ptForce").value),
    ptLossPercent: Number($("ptLossPercent").value),
    ptStrandArea: Number($("ptStrandArea").value),
    ptHighPoints: ptProfileForInput().highPoints,
    ptLowPoints: ptProfileForInput().lowPoints,
    spans: state.spans.map((span) => ({ ...span, system: normaliseSpanSystem(span.system) })),
    combinations: state.combinations.map((combo) => ({ ...combo })),
    strengthComboIndex: Number($("strengthCombo").value),
    serviceComboIndex: Number($("serviceCombo").value),
  };
  data.d = data.D - data.cover - data.barDia / 2;
  data.sectionProperties = sectionProperties(data);
  data.Agross = data.sectionProperties.area;
  data.sectionCentroid = data.sectionProperties.centroid;
  data.Igross = data.sectionProperties.inertia;
  data.selfWeightLoad = data.selfWeight ? 24 * (data.Agross / 1e6) : 0;
  data.wetAreaLoad = data.wetAreaEnabled ? Math.max(0, data.wetLoadKpa || 0) * clamp((data.wetAreaPercent || 0) / 100, 0, 1) : 0;
  data.wetLineLoad = data.wetAreaLoad * (data.b / 1000);
  data.ptEffectiveForce = ptEffectiveForce(data);
  return data;
}

function supportFixitiesForInput() {
  ensureSupportFixities();
  return state.supportFixities.map((value) => normaliseFixityPercent(value));
}

function ptProfileForInput() {
  ensurePtProfile();
  return {
    highPoints: state.ptProfile.highPoints.map((value) => normalisePtPoint(value)),
    lowPoints: state.ptProfile.lowPoints.map((value) => normalisePtPoint(value)),
  };
}

function parseBars(text) {
  return text
    .split(",")
    .map((item) => Number(item.trim().replace(/[^\d.]/g, "")))
    .filter((dia) => dia > 0);
}

function normaliseSectionShape(value) {
  return ["rect", "tTop", "tBottom", "irregular"].includes(value) ? value : "rect";
}

function sectionShapeLabel(input) {
  const labels = {
    rect: "rectangular",
    tTop: "T section, flange up",
    tBottom: "T section, flange down",
    irregular: "wet / irregular equivalent",
  };
  return labels[normaliseSectionShape(input.sectionShape)] || labels.rect;
}

function normaliseSectionAnalysisMode(value) {
  return value === "cracked" ? "cracked" : "uncracked";
}

function sectionAnalysisLabel(input) {
  return normaliseSectionAnalysisMode(input.sectionAnalysisMode) === "cracked" ? "cracked transformed section" : "uncracked transformed section";
}

function sectionAnalysisShortLabel(input) {
  return normaliseSectionAnalysisMode(input.sectionAnalysisMode) === "cracked" ? "cracked" : "uncracked";
}

function sectionOverallWidth(input) {
  const shape = normaliseSectionShape(input.sectionShape);
  if (shape === "tTop" || shape === "tBottom") return Math.max(input.b, input.flangeWidth || input.b);
  return input.b;
}

function sectionRectangles(input) {
  const shape = normaliseSectionShape(input.sectionShape);
  const webWidth = Math.max(input.b || 1, 1);
  const depth = Math.max(input.D || 1, 1);
  const flangeWidth = Math.max(input.flangeWidth || webWidth, webWidth);
  const flangeThickness = clamp(input.flangeThickness || 0, 0, depth);
  if ((shape === "tTop" || shape === "tBottom") && flangeThickness > 0 && flangeWidth > webWidth) {
    const flangeY = shape === "tTop" ? 0 : depth - flangeThickness;
    return [
      { y: 0, h: depth, b: webWidth },
      { y: flangeY, h: flangeThickness, b: flangeWidth - webWidth },
    ];
  }
  return [{ y: 0, h: depth, b: webWidth }];
}

function sectionProperties(input) {
  const areaFactor = Math.max(0.1, Number(input.sectionAreaFactor || 1));
  const inertiaFactor = Math.max(0.1, Number(input.sectionInertiaFactor || 1));
  const rectangles = sectionRectangles(input);
  const rawArea = rectangles.reduce((sum, rect) => sum + rect.b * rect.h, 0);
  const rawCentroid = rectangles.reduce((sum, rect) => sum + rect.b * rect.h * (rect.y + rect.h / 2), 0) / Math.max(rawArea, 1);
  const rawInertia = rectangles.reduce((sum, rect) => {
    const area = rect.b * rect.h;
    const yc = rect.y + rect.h / 2;
    return sum + (rect.b * Math.pow(rect.h, 3)) / 12 + area * Math.pow(yc - rawCentroid, 2);
  }, 0);
  return {
    area: rawArea * areaFactor,
    centroid: rawCentroid,
    inertia: rawInertia * inertiaFactor,
    rawArea,
    rawInertia,
    areaFactor,
    inertiaFactor,
    rectangles,
  };
}

function selfWeightAreaLoad(input) {
  if (!input.selfWeight) return 0;
  const tributaryWidth = Math.max(input.b / 1000, 0.001);
  return 24 * (input.Agross / 1e6) / tributaryWidth;
}

function safeRun() {
  try {
    run();
  } catch (error) {
    console.error(error);
    const banner = $("designStatus");
    if (banner) {
      banner.className = "status-banner fail";
      banner.innerHTML = `
        <div class="status-mark">ERROR</div>
        <div class="status-copy">
          <b>Analysis did not complete.</b>
          <span>${error.message || error}</span>
        </div>
      `;
    }
  }
}

function run() {
  const input = readInputs();
  const validation = validateInputData(input);
  state.validation = validation;
  applyInputValidation(validation);
  if (validation.errors.length) {
    renderValidationFailure(validation);
    return;
  }
  const strengthCombo = input.combinations[input.strengthComboIndex] || input.combinations.find((combo) => combo.type === "ULS");
  const serviceCombo = input.combinations[input.serviceComboIndex] || input.combinations.find((combo) => combo.type === "DEF") || input.combinations.find((combo) => combo.type === "SLS");
  if (input.memberType === "twoWay") {
    const analysisModel = buildTwoWayAnalysisModel(input);
    const combinationResults = input.combinations.map((combo) => ({ combo, analysis: analyseTwoWayForCombo(input, combo) }));
    const twoWayEnvelope = buildTwoWayEnvelope(input, combinationResults);
    const envelopeStrengthCombo = twoWayEnvelope.ulsCombo || strengthCombo;
    const twoWay = analyseTwoWayPanel(input, envelopeStrengthCombo, serviceCombo);
    const status = evaluateTwoWayStatus(twoWay);
    state.result = { mode: "twoWay", input, analysisModel, strengthCombo: envelopeStrengthCombo, serviceCombo, twoWay, design: twoWay.designRows, combinationResults, twoWayEnvelope, envelopeRows: twoWayEnvelope.rows, status };
    renderSummary();
    renderStatus();
    renderWorkflowTree();
    renderMessages();
    renderTree();
    drawModel();
    drawDiagrams();
    drawLimitDiagrams();
    drawEnvelopeDiagrams();
    renderLoads();
    renderEnvelopes();
    renderDesign();
    drawSectionDiagram();
    renderDeflectionSummary();
    renderReport();
    return;
  }
  const analysisModel = buildFrameAnalysisModel(input);
  const analysisOptions = { mesh: analysisModel.mesh };
  const ultimate = analyseCombination(input, strengthCombo, analysisOptions);
  const service = analyseServiceCombination(input, serviceCombo, analysisOptions);
  const sustainedCombo = findSustainedDeflectionCombo(input, serviceCombo);
  const sustainedService = analyseServiceCombination(input, sustainedCombo, analysisOptions);
  const combinationResults = input.combinations.map((combo) => ({ combo, analysis: combo.type === "ULS" ? analyseCombination(input, combo, analysisOptions) : analyseServiceCombination(input, combo, analysisOptions) }));
  const designEnvelope = buildOneWayActionEnvelope(input, combinationResults, "ULS");
  const serviceEnvelope = buildOneWayActionEnvelope(input, combinationResults, "service");
  const deflection = makeOneWayDeflectionSet(input, serviceEnvelope, sustainedService, serviceEnvelope.combo, sustainedCombo);
  const designService = { ...serviceEnvelope, samples: deflection.longSamples, maxDefl: deflection.longMax };
  const design = designMember(input, designEnvelope, designService);
  const envelopeRows = buildOneWayEnvelopeRows(input, designEnvelope, serviceEnvelope, deflection);
  const status = evaluateDesignStatus(input, service, design);
  state.result = { input, analysisModel, strengthCombo, serviceCombo, sustainedCombo, ultimate, service, sustainedService, deflection, design, combinationResults, designEnvelope, serviceEnvelope, envelopeRows, status };
  renderSummary();
  renderStatus();
  renderWorkflowTree();
  renderMessages();
  renderTree();
  drawModel();
  drawDiagrams();
  drawLimitDiagrams();
  drawEnvelopeDiagrams();
  renderLoads();
  renderEnvelopes();
  renderDesign();
  drawSectionDiagram();
  renderDeflectionSummary();
  renderReport();
}

function validateInputData(input) {
  const errors = [];
  const warnings = [];
  const error = (fields, message) => errors.push({ fields: Array.isArray(fields) ? fields : [fields], message });
  const warn = (fields, message) => warnings.push({ fields: Array.isArray(fields) ? fields : [fields], message });

  if (!Number.isFinite(input.b) || input.b <= 0) error("width", "Section width must be greater than zero.");
  if (!Number.isFinite(input.D) || input.D <= 0) error("depth", "Section depth must be greater than zero.");
  if (!Number.isFinite(input.cover) || input.cover < 10) error("cover", "Concrete cover is too small for this layout.");
  if (!Number.isFinite(input.barDia) || input.barDia <= 0) error("barDia", "Main bar diameter must be greater than zero.");
  if (input.d <= 40) error(["depth", "cover", "barDia"], "Effective depth is too small. Reduce cover/bar diameter or increase section depth.");
  if (input.cover + input.barDia > input.D / 2) warn(["depth", "cover", "barDia"], "Cover and selected bar size occupy a large part of the section depth.");
  if (!Number.isFinite(input.fc) || input.fc <= 0) error("fc", "Concrete strength must be greater than zero.");
  if (!Number.isFinite(input.fsy) || input.fsy <= 0) error("fsy", "Reinforcement yield strength must be greater than zero.");
  if (!Number.isFinite(input.Ec) || input.Ec <= 0) error("ec", "Concrete elastic modulus must be greater than zero.");
  if (!Number.isFinite(input.elementsPerSpan) || input.elementsPerSpan < 1 || input.elementsPerSpan > 80) error("elementsPerSpan", "FE elements per span must be between 1 and 80.");
  if (!Number.isFinite(input.columnFixity) || input.columnFixity < 0 || input.columnFixity > 100) error("columnFixity", "Column/slab fixity must be between 0% and 100%.");
  if (input.columnFixity > 90) warn("columnFixity", "Column/slab fixity is near fully fixed; confirm column stiffness and joint restraint.");
  if (!Number.isFinite(input.deflectionRatio) || input.deflectionRatio < 100) error("deflectionRatio", "Deflection check ratio must be at least L/100.");
  if (input.stressCompFactor <= 0) error("stressCompFactor", "Concrete compression stress check factor must be positive.");
  if (input.stressTensFactor < 0) error("stressTensFactor", "Tension stress check factor cannot be negative.");
  if (!["uncracked", "cracked"].includes(input.sectionAnalysisMode)) error("sectionAnalysisMode", "Service section analysis must be uncracked or cracked.");
  if (!["rect", "tTop", "tBottom", "irregular"].includes(input.sectionShape)) error("sectionShape", "Select a valid section geometry shape.");
  if (["tTop", "tBottom"].includes(input.sectionShape)) {
    if (!Number.isFinite(input.flangeWidth) || input.flangeWidth < input.b) error(["flangeWidth", "width"], "T-section flange width must be at least the web width b.");
    if (!Number.isFinite(input.flangeThickness) || input.flangeThickness <= 0 || input.flangeThickness >= input.D) error(["flangeThickness", "depth"], "T-section flange thickness must be greater than zero and less than the section depth.");
    warn("sectionShape", "T-section capacity uses a layered compression-block model; verify effective flange width and local detailing against the project design method.");
  }
  if (!Number.isFinite(input.sectionAreaFactor) || input.sectionAreaFactor <= 0) error("sectionAreaFactor", "Equivalent area factor must be positive.");
  if (!Number.isFinite(input.sectionInertiaFactor) || input.sectionInertiaFactor <= 0) error("sectionInertiaFactor", "Equivalent inertia factor must be positive.");
  if (input.sectionShape === "irregular") warn(["sectionAreaFactor", "sectionInertiaFactor"], "Irregular geometry uses equivalent area and inertia factors; verify the section properties from project geometry.");
  if (input.wetAreaEnabled) {
    if (!Number.isFinite(input.wetLoadKpa) || input.wetLoadKpa < 0) error("wetLoadKpa", "Wet area load cannot be negative.");
    if (!Number.isFinite(input.wetAreaPercent) || input.wetAreaPercent < 0 || input.wetAreaPercent > 100) error("wetAreaPercent", "Wet area percentage must be between 0% and 100%.");
  }
  if (!Number.isFinite(input.crackMaxSpacing) || input.crackMaxSpacing < 75) error("crackMaxSpacing", "Crack-control spacing cap must be at least 75 mm.");
  if (!Number.isFinite(input.creepFactor) || input.creepFactor < 0) error("creepFactor", "Sustained-load creep factor cannot be negative.");
  if (!Number.isFinite(input.shrinkageStrain) || input.shrinkageStrain < 0) error("shrinkageStrain", "Shrinkage strain cannot be negative.");
  if (!Number.isFinite(input.thermalCoeff) || input.thermalCoeff < 0) error("thermalCoeff", "Thermal coefficient cannot be negative.");
  if (!Number.isFinite(input.temperatureRestraint) || input.temperatureRestraint < 0 || input.temperatureRestraint > 100) error("temperatureRestraint", "Temperature restraint must be between 0% and 100%.");
  if (!Number.isFinite(input.humidityFactor) || input.humidityFactor <= 0) error("humidityFactor", "Humidity / drying factor must be positive.");
  if (!input.topBars.length) error("topLayerBars", "No valid top layer bar sizes are available.");
  if (!input.bottomBars.length) error("bottomLayerBars", "No valid bottom layer bar sizes are available.");
  if (!input.bars.length) error(["topLayerBars", "bottomLayerBars"], "No valid reinforcement bar sizes are available for the selected member type.");
  const outOfRangeBars = input.bars.filter((dia) => dia < 12 || dia > 36);
  if (outOfRangeBars.length) error(["topLayerBars", "bottomLayerBars"], "Layer bar sizes must be between N12 and N36.");
  if (input.layers < 1 || input.layers > 3) error("layers", "Layer count must be between 1 and 3.");
  validateRebarLayerInput(input, "top", error, warn);
  validateRebarLayerInput(input, "bottom", error, warn);
  if (input.memberType === "beam") {
    if (input.topBarsPerM > 20) warn(`[data-reo-face="top"][data-reo-field="count"]`, "Top face has a very high total bar count; check beam constructability.");
    if (input.bottomBarsPerM > 20) warn(`[data-reo-face="bottom"][data-reo-field="count"]`, "Bottom face has a very high total bar count; check beam constructability.");
  } else {
    if (!Number.isFinite(input.topBarsPerM) || input.topBarsPerM <= 0) error(`[data-reo-face="top"][data-reo-field="count"]`, "Top bars per metre must be greater than zero.");
    if (!Number.isFinite(input.bottomBarsPerM) || input.bottomBarsPerM <= 0) error(`[data-reo-face="bottom"][data-reo-field="count"]`, "Bottom bars per metre must be greater than zero.");
    if (input.topBarsPerM > 20) warn(`[data-reo-face="top"][data-reo-field="count"]`, "Top bars per metre is very dense; check constructability.");
    if (input.bottomBarsPerM > 20) warn(`[data-reo-face="bottom"][data-reo-field="count"]`, "Bottom bars per metre is very dense; check constructability.");
  }
  if (input.ptEnabled) {
    if (!Number.isFinite(input.ptTendonCount) || input.ptTendonCount <= 0) error("ptTendonCount", "PT tendon count must be greater than zero when post-tensioning is enabled.");
    if (!Number.isFinite(input.ptForce) || input.ptForce <= 0) error("ptForce", "PT jacking force per tendon must be greater than zero.");
    if (!Number.isFinite(input.ptLossPercent) || input.ptLossPercent < 0 || input.ptLossPercent > 60) error("ptLossPercent", "PT long-term losses must be between 0% and 60%.");
    if (!Number.isFinite(input.ptStrandArea) || input.ptStrandArea <= 0) error("ptStrandArea", "PT strand area per tendon must be greater than zero.");
    [...input.ptHighPoints, ...input.ptLowPoints].forEach((point, i) => {
      const isHigh = i < input.ptHighPoints.length;
      const index = isHigh ? i : i - input.ptHighPoints.length;
      const field = `[data-pt-profile="${isHigh ? "high" : "low"}"][data-pt-index="${index}"]`;
      if (!Number.isFinite(point) || point < input.cover || point > input.D - input.cover) error(field, "PT profile point must stay inside cover from the top and bottom faces.");
    });
    input.ptLowPoints.forEach((low, i) => {
      const highA = input.ptHighPoints[i] ?? input.ptHighPoints[0] ?? defaultPtHighPoint();
      const highB = input.ptHighPoints[i + 1] ?? input.ptHighPoints[input.ptHighPoints.length - 1] ?? highA;
      if (low <= (highA + highB) / 2) warn(`[data-pt-profile="low"][data-pt-index="${i}"]`, `Span ${i + 1} low point is not below the adjacent high points, so balancing load will be small or reversed.`);
    });
    const effectiveStress = (input.ptForce * (1 - input.ptLossPercent / 100) * 1000) / Math.max(input.ptStrandArea, 1);
    if (effectiveStress > 1400) warn(["ptForce", "ptStrandArea", "ptLossPercent"], "Effective prestress stress is high; verify tendon force, strand area and losses.");
  }

  if (input.memberType === "twoWay") {
    if (input.panelX <= 0) error("panelX", "Panel Lx must be greater than zero.");
    if (input.panelY <= 0) error("panelY", "Panel Ly must be greater than zero.");
    if (input.areaG < 0) error("areaG", "Superimposed permanent load cannot be negative.");
    if (input.areaQ < 0) error("areaQ", "Live load cannot be negative.");
    if (input.columnX <= 0) error("columnX", "Column x dimension must be greater than zero.");
    if (input.columnY <= 0) error("columnY", "Column y dimension must be greater than zero.");
    if (input.columnX / 1000 >= input.panelX * 0.8) error(["columnX", "panelX"], "Column x dimension conflicts with panel Lx.");
    if (input.columnY / 1000 >= input.panelY * 0.8) error(["columnY", "panelY"], "Column y dimension conflicts with panel Ly.");
    if (input.columnStripPercent < 20 || input.columnStripPercent > 80) error("columnStripPercent", "Column strip percentage must stay between 20% and 80%.");
    if (input.plateGrid < 8 || input.plateGrid > 40) error("plateGrid", "Plate grid should be between 8 and 40.");
    const aspect = Math.max(input.panelX, input.panelY) / Math.max(0.001, Math.min(input.panelX, input.panelY));
    if (aspect > 2) warn(["panelX", "panelY"], "Panel aspect ratio is above 2.0; a one-way slab idealisation may govern.");
  } else {
    if (input.supportFixities.length !== input.spans.length + 1) error("supportFixities", "Support fixity count must match the number of span supports.");
    const supportedBoundaries = spanBoundarySupportStates(input);
    if (!supportedBoundaries.some(Boolean)) error("supportFixities", "At least one support is required for the frame model.");
    input.supportFixities.forEach((fixity, i) => {
      const field = `[data-support="${i}"][data-field="fixity"]`;
      if (!Number.isFinite(fixity) || fixity < 0 || fixity > 100) error(field, `Support ${i + 1} fixity must be between 0% and 100%.`);
      if (!supportedBoundaries[i]) {
        warn(field, `Boundary ${i + 1} is a free cantilever tip; its fixity value is ignored.`);
      } else if (fixity > 90) {
        warn(field, `Support ${i + 1} is near fully fixed; confirm the column connection stiffness.`);
      }
    });
    input.spans.forEach((span, i) => {
      const lengthField = `[data-span="${i}"][data-field="length"]`;
      const gField = `[data-span="${i}"][data-field="g"]`;
      const qField = `[data-span="${i}"][data-field="q"]`;
      const systemField = `[data-span="${i}"][data-field="system"]`;
      const system = normaliseSpanSystem(span.system);
      if (!Number.isFinite(span.length) || span.length <= 0) error(lengthField, `Span ${i + 1} length must be greater than zero.`);
      if (span.g < 0) error(gField, `Span ${i + 1} permanent load cannot be negative.`);
      if (span.q < 0) error(qField, `Span ${i + 1} live load cannot be negative.`);
      if (system === "leftCantilever" && i !== 0) error(systemField, "A left cantilever must be the first span so its free tip is at the model edge.");
      if (system === "rightCantilever" && i !== input.spans.length - 1) error(systemField, "A right cantilever must be the last span so its free tip is at the model edge.");
      const cantileverBackFixity = system === "leftCantilever" ? input.supportFixities[i + 1] : system === "rightCantilever" ? input.supportFixities[i] : null;
      const hasContinuousBackspan =
        (system === "leftCantilever" && input.spans[i + 1] && normaliseSpanSystem(input.spans[i + 1].system) !== "simple") ||
        (system === "rightCantilever" && input.spans[i - 1] && normaliseSpanSystem(input.spans[i - 1].system) !== "simple");
      if (cantileverBackFixity != null && cantileverBackFixity < 5 && !hasContinuousBackspan) {
        error(systemField, `Span ${i + 1} is a cantilever but its back support has no rotational fixity; increase support fixity to stabilise the frame.`);
      } else if (cantileverBackFixity != null && cantileverBackFixity < 70 && !hasContinuousBackspan) {
        warn(systemField, `Span ${i + 1} is a cantilever; use high support fixity at the backspan/support for realistic deflection.`);
      }
      const spanDepthRatio = (span.length * 1000) / Math.max(input.D, 1);
      if (input.memberType === "beam" && spanDepthRatio > 28) warn(["depth", lengthField], `Span ${i + 1} is slender for the selected beam depth.`);
      if (input.memberType === "slab" && spanDepthRatio > 35) warn(["depth", lengthField], `Span ${i + 1} is slender for the selected slab depth.`);
    });
    if (input.memberType === "beam") {
      const largestBar = Math.max(...input.bars, input.barDia);
      const minimumWidth = 2 * input.cover + 2 * largestBar + 60;
      if (input.b < minimumWidth) error(["width", "cover"], `Beam width is too tight for cover and selected bars. Try b >= ${Math.ceil(minimumWidth)} mm.`);
    }
    if (input.memberType === "slab") {
      if (input.maxSpacing > Math.min(300, 2 * input.D)) warn("maxSpacing", "Maximum slab spacing exceeds the current AS 3600 spacing cap used by the design routine.");
      if (input.b !== 1000) warn("width", "One-way slab design is normally reviewed as a 1000 mm strip; current width is used directly in analysis.");
    }
  }

  if (input.memberType !== "beam") {
    const spacingCap = slabSpacingLimit(input);
    if (input.topBarsPerM > 0 && 1000 / input.topBarsPerM > spacingCap) warn(`[data-reo-face="top"][data-reo-field="count"]`, `Top bars per metre gives spacing above the ${spacingCap.toFixed(0)} mm slab spacing cap.`);
    if (input.bottomBarsPerM > 0 && 1000 / input.bottomBarsPerM > spacingCap) warn(`[data-reo-face="bottom"][data-reo-field="count"]`, `Bottom bars per metre gives spacing above the ${spacingCap.toFixed(0)} mm slab spacing cap.`);
  }

  input.combinations.forEach((combo, i) => {
    ["sw", "g", "q"].forEach((field) => {
      if (!Number.isFinite(combo[field])) error(`[data-combo="${i}"][data-field="${field}"]`, `${combo.name} has an invalid ${field.toUpperCase()} factor.`);
      if (combo[field] < 0) error(`[data-combo="${i}"][data-field="${field}"]`, `${combo.name} has a negative ${field.toUpperCase()} factor, which conflicts with the current gravity-only layout.`);
    });
    if (Math.abs(combo.sw) + Math.abs(combo.g) + Math.abs(combo.q) === 0) warn(`[data-combo="${i}"][data-field="name"]`, `${combo.name} has all load factors set to zero.`);
  });
  if (!input.combinations.some((combo) => combo.type === "ULS")) error("strengthCombo", "At least one ULS combination is required.");
  if (!input.combinations.some((combo) => combo.type === "SLS" || combo.type === "DEF")) error("serviceCombo", "At least one service or deflection combination is required.");

  return { errors, warnings };
}

function validateRebarLayerInput(input, face, error, warn) {
  const layers = input.rebarSchedule?.[face] || [];
  const active = layers.map((layer, index) => ({ ...layer, index })).filter((layer) => Number(layer.count) > 0);
  if (!active.length) {
    error(`[data-reo-face="${face}"][data-reo-field="count"]`, `${face === "top" ? "Top" : "Bottom"} face needs at least one active reinforcement layer.`);
    return;
  }
  active.forEach((layer) => {
    const diaField = `[data-reo-face="${face}"][data-reo-index="${layer.index}"][data-reo-field="dia"]`;
    const countField = `[data-reo-face="${face}"][data-reo-index="${layer.index}"][data-reo-field="count"]`;
    if (!standardRebarSizes().includes(Number(layer.dia))) error(diaField, `Layer ${layer.index + 1} bar size must be between N12 and N36.`);
    if (!Number.isFinite(Number(layer.count)) || Number(layer.count) <= 0) error(countField, `Layer ${layer.index + 1} bar quantity must be greater than zero.`);
    if (input.memberType === "beam" && Math.round(Number(layer.count)) !== Number(layer.count)) error(countField, `Beam layer ${layer.index + 1} must use a whole number of bars.`);
    if (input.memberType === "beam") {
      const clearWidth = input.b - 2 * input.cover;
      const minClear = Math.max(25, Number(layer.dia));
      const requiredWidth = Number(layer.count) * Number(layer.dia) + Math.max(0, Number(layer.count) - 1) * minClear;
      if (requiredWidth > clearWidth) warn(countField, `Layer ${layer.index + 1} may not fit across the beam width with cover and clear spacing.`);
    }
  });
}

function buildFrameAnalysisModel(input) {
  const mesh = buildMesh(input);
  return {
    type: "frame",
    mesh,
    nodeCount: mesh.nodes.length,
    elementCount: mesh.elements.length,
    supportCount: mesh.supportNodes.length,
    supports: mesh.supports.map((x, i) => ({ boundary: i + 1, x, supported: isBoundarySupported(input, i), fixity: isBoundarySupported(input, i) ? supportFixityPercent(input, i) : 0 })),
    spans: input.spans.map((span, i) => ({
      span: i + 1,
      start: mesh.supports[i],
      end: mesh.supports[i + 1],
      length: span.length,
      system: normaliseSpanSystem(span.system),
      g: span.g,
      q: span.q,
      ptBalance: ptBalancedLoadForSpan(input, i),
    })),
  };
}

function buildTwoWayAnalysisModel(input) {
  const grid = clamp(Math.round(input.plateGrid || 18), 8, 32);
  return {
    type: "twoWayPlate",
    grid,
    nodeCount: (grid + 1) * (grid + 1),
    elementCount: grid * grid,
    panelX: input.panelX,
    panelY: input.panelY,
    column: { x: input.columnX, y: input.columnY, supportType: input.supportType },
    columnStripPercent: input.columnStripPercent,
    columnFixity: input.columnFixity,
    ptBalance: ptTwoWayBalancedLoad(input),
  };
}

function applyInputValidation(validation) {
  document.querySelectorAll(".invalid-input,.warn-input").forEach((el) => {
    el.classList.remove("invalid-input", "warn-input");
    el.removeAttribute("title");
  });
  validation.warnings.forEach((issue) => markValidationFields(issue, "warn-input"));
  validation.errors.forEach((issue) => markValidationFields(issue, "invalid-input"));
}

function markValidationFields(issue, cls) {
  issue.fields.forEach((field) => {
    const el = field.startsWith("[") ? document.querySelector(field) : $(field);
    if (!el) return;
    el.classList.remove("warn-input", "invalid-input");
    el.classList.add(cls);
    el.title = issue.message;
  });
}

function renderValidationFailure(validation) {
  state.result = null;
  const banner = $("designStatus");
  if (banner) {
    banner.className = "status-banner fail";
    banner.innerHTML = `
      <div class="status-mark">INPUT</div>
      <div class="status-copy">
        <b>Input validation failed.</b>
        <span>${validation.errors.slice(0, 3).map((issue) => issue.message).join("; ")}</span>
      </div>
    `;
  }
  renderValidationMessages(validation);
  clearAnalysisOutputs();
  drawInputSectionPreview();
}

function renderValidationMessages(validation) {
  const target = $("messageWindow");
  if (target) {
    const rows = [
      ...validation.errors.map((issue) => ({ type: "fail", text: issue.message })),
      ...validation.warnings.map((issue) => ({ type: "warn", text: issue.message })),
    ];
    target.innerHTML = rows.length
      ? rows.map((message) => `<div class="message-row ${message.type}"><b>${message.type}</b><span>${message.text}</span></div>`).join("")
      : `<div class="message-row info"><b>info</b><span>Inputs are ready to run.</span></div>`;
  }
  const workflow = $("workflowTree");
  if (workflow) {
    workflow.innerHTML = `
      <div class="tree-title">Input</div>
      <button class="tree-item fail" type="button">Validation</button>
      <button class="tree-item review" type="button">Correct red fields, then Run Analysis</button>
      <div class="tree-title">Output</div>
      <button class="tree-item fail" type="button">Analysis blocked</button>
    `;
  }
}

function clearAnalysisOutputs() {
  ["summary", "resultTree", "loadRows", "envelopeRows", "designRows", "deflectionSummary"].forEach((id) => {
    const el = $(id);
    if (el) el.innerHTML = "";
  });
  const report = $("report");
  if (report) report.value = "INPUT VALIDATION FAILED\n\nCorrect the red input fields, then click Run Analysis.";
  ["modelCanvas", "diagramCanvas", "envelopeCanvas", "limitCanvas", "sectionCanvas", "inputSectionCanvas"].forEach((id) => {
    const canvas = $(id);
    if (canvas?.getContext) clear(canvas.getContext("2d"), canvas);
  });
}

function analyseTwoWayPanel(input, strengthCombo, serviceCombo) {
  const ulsLoad = comboAreaLoad(input, strengthCombo);
  const sustainedCombo = findSustainedDeflectionCombo(input, serviceCombo);
  const serviceLoad = comboAreaLoad(input, serviceCombo);
  const sustainedLoad = comboAreaLoad(input, sustainedCombo);
  const cracked = normaliseSectionAnalysisMode(input.sectionAnalysisMode) === "cracked";
  const shortPlate = plateGridDeflection(input, serviceLoad, { cracked });
  const sustainedPlate = plateGridDeflection(input, sustainedLoad, { cracked });
  const longPlate = combinePlateDeflection(shortPlate, sustainedPlate, longTermDeflectionMultiplier(input));
  const stripRows = designTwoWayStrips(input, ulsLoad, longPlate);
  const supportShear = supportShearChecks(input, ulsLoad, stripRows);
  return {
    ulsLoad,
    serviceLoad,
    sustainedLoad,
    sustainedCombo,
    longTermFactor: longTermDeflectionMultiplier(input),
    plate: shortPlate,
    shortPlate,
    sustainedPlate,
    longPlate,
    strips: stripRows,
    supportShear,
    designRows: [...stripRows, ...supportShear],
  };
}

function analyseTwoWayForCombo(input, combo) {
  const load = comboAreaLoad(input, combo);
  const plate = plateGridDeflection(input, load, { cracked: combo.type !== "ULS" && normaliseSectionAnalysisMode(input.sectionAnalysisMode) === "cracked" });
  const strips = designTwoWayStrips(input, load, plate);
  const supportShear = supportShearChecks(input, load, strips);
  const maxMoment = strips.reduce((max, row) => Math.max(max, row.Mu), 0);
  const maxSupportShear = supportShear.reduce((max, row) => Math.max(max, row.util), 0);
  return {
    maxMoment: { value: maxMoment, x: 0 },
    maxShear: { value: maxSupportShear, x: 0 },
    maxDefl: { value: plate.maxDeflectionM, x: plate.maxAt.x },
  };
}

function comboAreaLoad(input, combo) {
  return combo.sw * selfWeightAreaLoad(input) + combo.g * (input.areaG + input.wetAreaLoad) + combo.q * input.areaQ - ptTwoWayBalancedLoad(input);
}

function findSustainedDeflectionCombo(input, fallback) {
  const combinations = input.combinations || [];
  return (
    combinations.find((combo) => combo.type === "DEF" && /sustained|psi_l|long/i.test(combo.name)) ||
    combinations.find((combo) => combo.type === "SLS" && /long|permanent|psi_l/i.test(combo.name)) ||
    fallback
  );
}

function longTermDeflectionMultiplier(input = {}) {
  const creep = clamp(Number(input.creepFactor ?? defaults.creepFactor), 0, 4);
  const thicknessFactor = clamp(200 / Math.max(input.D || defaults.depth, 1), 0.6, 1.6);
  const shrinkageRatio = clamp(Number(input.shrinkageStrain || 0) / 600, 0, 3);
  const humidity = clamp(Number(input.humidityFactor || 1), 0.2, 2);
  const thermalStrain = Math.abs(Number(input.temperatureDelta || 0)) * Number(input.thermalCoeff || defaults.thermalCoeff) / 1e6;
  const restraint = clamp(Number(input.temperatureRestraint || 0) / 100, 0, 1);
  const wet = input.wetAreaEnabled ? 0.1 * clamp(Number(input.wetAreaPercent || 0) / 100, 0, 1) : 0;
  const shrinkageTerm = 0.12 * shrinkageRatio * thicknessFactor * humidity;
  const temperatureTerm = 0.1 * restraint * clamp(thermalStrain / 0.0003, 0, 3);
  return clamp(creep + shrinkageTerm + temperatureTerm + wet, 0, 4.5);
}

function ptEffectiveForce(input) {
  if (!input.ptEnabled) return 0;
  const grossForce = Math.max(0, input.ptTendonCount || 0) * Math.max(0, input.ptForce || 0);
  return grossForce * (1 - clamp((input.ptLossPercent || 0) / 100, 0, 0.6));
}

function ptBalancedLoadForSpan(input, spanIndex) {
  const P = input.ptEffectiveForce ?? ptEffectiveForce(input);
  if (!input.ptEnabled || P <= 0) return 0;
  const L = input.spans?.[spanIndex]?.length || (input.memberType === "twoWay" ? input.panelX : 0);
  if (!L) return 0;
  const highA = input.ptHighPoints?.[spanIndex] ?? input.ptHighPoints?.[0] ?? defaultPtHighPoint();
  const highB = input.ptHighPoints?.[spanIndex + 1] ?? input.ptHighPoints?.[input.ptHighPoints.length - 1] ?? highA;
  const low = input.ptLowPoints?.[spanIndex] ?? defaultPtLowPoint();
  const sag = (low - (highA + highB) / 2) / 1000;
  return (8 * P * sag) / (L * L);
}

function ptTwoWayBalancedLoad(input) {
  if (!input.ptEnabled) return 0;
  const stripInput = {
    ...input,
    spans: [{ length: input.panelX }],
    ptHighPoints: input.ptHighPoints?.length ? input.ptHighPoints : [defaultPtHighPoint(), defaultPtHighPoint()],
    ptLowPoints: input.ptLowPoints?.length ? input.ptLowPoints : [defaultPtLowPoint()],
  };
  return ptBalancedLoadForSpan(stripInput, 0);
}

function tendonPointFromTop(input, x) {
  if (!input.ptEnabled) return input.D / 2;
  const spans = input.memberType === "twoWay" ? [{ length: input.panelX }] : input.spans;
  let start = 0;
  for (let i = 0; i < spans.length; i++) {
    const L = spans[i].length;
    const end = start + L;
    if (x <= end + 1e-9 || i === spans.length - 1) {
      const r = clamp((x - start) / Math.max(L, 1e-9), 0, 1);
      const highA = input.ptHighPoints?.[i] ?? input.ptHighPoints?.[0] ?? defaultPtHighPoint();
      const highB = input.ptHighPoints?.[i + 1] ?? input.ptHighPoints?.[input.ptHighPoints.length - 1] ?? highA;
      const low = input.ptLowPoints?.[i] ?? defaultPtLowPoint();
      const linear = highA + (highB - highA) * r;
      const midLinear = (highA + highB) / 2;
      return linear + 4 * (low - midLinear) * r * (1 - r);
    }
    start = end;
  }
  return input.D / 2;
}

function ptSummaryText(input) {
  if (!input.ptEnabled) return "off";
  const balance = input.memberType === "twoWay" ? ptTwoWayBalancedLoad(input) : Math.max(0, ...input.spans.map((_, i) => ptBalancedLoadForSpan(input, i)));
  const units = input.memberType === "twoWay" || input.memberType === "slab" ? "kPa" : "kN/m";
  return `${ptEffectiveForce(input).toFixed(0)} kN effective, max balance ${balance.toFixed(2)} ${units}`;
}

function makeOneWayDeflectionSet(input, shortService, sustainedService, shortCombo, sustainedCombo) {
  const factor = longTermDeflectionMultiplier(input);
  const longSamples = shortService.samples.map((sample, i) => {
    const sustained = sustainedService.samples[i] || sample;
    return {
      ...sample,
      shortDefl: sample.defl,
      sustainedDefl: sustained.defl,
      defl: sample.defl + factor * sustained.defl,
    };
  });
  return {
    shortCombo,
    sustainedCombo,
    factor,
    shortSamples: shortService.samples.map((sample, i) => ({ ...sample, shortDefl: sample.defl, sustainedDefl: sustainedService.samples[i]?.defl || 0, longDefl: longSamples[i].defl })),
    longSamples,
    shortMax: maxAbs(shortService.samples, "defl"),
    sustainedMax: maxAbs(sustainedService.samples, "defl"),
    longMax: maxAbs(longSamples, "defl"),
  };
}

function combinePlateDeflection(shortPlate, sustainedPlate, factor) {
  const points = shortPlate.points.map((point, i) => {
    const sustained = sustainedPlate.points[i] || point;
    return {
      x: point.x,
      y: point.y,
      w: Math.abs(point.w) + factor * Math.abs(sustained.w),
    };
  });
  const maxPoint = points.reduce((best, point) => (Math.abs(point.w) > Math.abs(best.w) ? point : best), points[0]);
  const grid = shortPlate.grid;
  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));
  const xMid = maxX / 2;
  const yMid = maxY / 2;
  return {
    grid,
    points,
    maxDeflectionM: Math.abs(maxPoint.w),
    maxAt: { x: maxPoint.x, y: maxPoint.y },
    xProfile: points.filter((p) => Math.abs(p.y - yMid) <= maxY / grid / 2).map((p) => ({ x: p.x, defl: Math.abs(p.w) })),
    yProfile: points.filter((p) => Math.abs(p.x - xMid) <= maxX / grid / 2).map((p) => ({ x: p.y, defl: Math.abs(p.w) })),
  };
}

function designTwoWayStrips(input, wu, plate) {
  const lx = input.panelX;
  const ly = input.panelY;
  const short = Math.min(lx, ly);
  const long = Math.max(lx, ly);
  const aspect = long / short;
  const colFrac = clamp(input.columnStripPercent / 100, 0.2, 0.8);
  const fixity = connectionFixityRatio(input);
  const factors = twoWayStripDistributionFactors(fixity);
  const xFrame = equivalentFrameStaticMoment(wu, lx, ly);
  const yFrame = equivalentFrameStaticMoment(wu, ly, lx);
  const rows = [];
  [
    { dir: "X", total: xFrame, span: lx, trans: ly },
    { dir: "Y", total: yFrame, span: ly, trans: lx },
  ].forEach((axis) => {
    const columnWidth = axis.trans * colFrac;
    const middleWidth = Math.max(axis.trans - columnWidth, axis.trans * 0.1);
    [
      { strip: "column strip", sign: "negative", frac: factors.columnNegative, width: columnWidth },
      { strip: "column strip", sign: "positive", frac: factors.columnPositive, width: columnWidth },
      { strip: "middle strip", sign: "positive", frac: factors.middlePositive, width: middleWidth },
      { strip: "middle strip", sign: "negative", frac: factors.middleNegative, width: middleWidth },
    ].forEach((item) => {
      const Mu = Math.abs((axis.total * item.frac) / Math.max(item.width, 0.1));
      const stripInput = { ...input, memberType: "slab", b: 1000, d: input.d };
      const face = item.sign === "negative" ? "top" : "bottom";
      const phi = flexurePhi(stripInput);
      const asReq = requiredSteel(stripInput, Mu / phi, face);
      const provided = chooseReo({ ...stripInput, memberType: "slab" }, asReq, face);
      const phiMu = phi * momentCapacity(stripInput, provided.as, face);
      rows.push({
        zone: `${axis.dir} ${item.strip}`,
        location: item.sign,
        face,
        Mu,
        phiMu,
        asReq,
        provided,
        util: phiMu > 0 ? Mu / phiMu : Infinity,
        deflection: plate.maxDeflectionM * 1000,
        limit: (short * 1000) / input.deflectionRatio,
        deflectionOk: plate.maxDeflectionM * 1000 <= (short * 1000) / input.deflectionRatio,
        check: `Full-width equivalent frame, ${item.width.toFixed(2)} m strip, aspect ${aspect.toFixed(2)}, column fixity ${input.columnFixity.toFixed(0)}%`,
      });
    });
  });
  return rows;
}

function twoWayStripDistributionFactors(fixity) {
  return {
    columnNegative: lerp(0.55, 0.85, fixity),
    columnPositive: lerp(0.70, 0.50, fixity),
    middlePositive: lerp(0.48, 0.34, fixity),
    middleNegative: lerp(0.12, 0.30, fixity),
  };
}

function equivalentFrameStaticMoment(wu, span, transverseWidth) {
  const lineLoad = wu * transverseWidth;
  return (lineLoad * span * span) / 8;
}

function supportShearChecks(input, wu, stripRows) {
  const dmm = input.d;
  const dm = dmm / 1000;
  const cx = input.columnX / 1000;
  const cy = input.columnY / 1000;
  const beta = input.supportType === "corner" ? 1.5 : input.supportType === "edge" ? 1.4 : 1.15;
  const reaction = wu * input.panelX * input.panelY * (input.supportType === "corner" ? 0.25 : input.supportType === "edge" ? 0.5 : 1);
  const rho = clamp(Math.max(...stripRows.map((row) => row.provided.as || 0)) / (1000 * dmm), 0.002, 0.02);
  const bc = Math.max(input.columnX, input.columnY) / Math.min(input.columnX, input.columnY);
  const defs = [
    {
      code: "AS 3600",
      b0: 2 * ((cx + dm) + (cy + dm)),
      vc: 0.17 * (1 + 2 / bc) * Math.sqrt(input.fc),
      phi: 0.75,
    },
    {
      code: "ACI 318",
      b0: 2 * ((cx + dm) + (cy + dm)),
      vc: Math.min(0.33, 0.17 * (1 + 2 / bc)) * Math.sqrt(input.fc),
      phi: 0.75,
    },
    {
      code: "Eurocode 2",
      b0: 2 * ((cx + 4 * dm) + (cy + 4 * dm)),
      vc: (0.18 / 1.5) * Math.min(2, 1 + Math.sqrt(200 / dmm)) * Math.pow(100 * rho * input.fc, 1 / 3),
      phi: 1,
    },
  ];
  return defs.map((def) => {
    const demand = beta * reaction;
    const capacity = (def.phi * def.vc * def.b0 * 1000 * dmm) / 1000;
    return {
      kind: "supportShear",
      zone: `Column shear ${def.code}`,
      location: input.supportType,
      Mu: demand,
      phiMu: capacity,
      asReq: 0,
      provided: { text: `${def.b0.toFixed(2)} m perimeter`, as: 0 },
      util: capacity > 0 ? demand / capacity : Infinity,
      deflection: 0,
      limit: 0,
      deflectionOk: true,
      check: capacity >= demand ? "OK" : "Increase depth, column size, drop panel or shear reinforcement",
    };
  });
}

function plateGridDeflection(input, q, options = {}) {
  const a = input.panelX;
  const b = input.panelY;
  const n = clamp(Math.round(input.plateGrid || 18), 8, 32);
  const nu = 0.2;
  const h = input.D / 1000;
  const stiffnessModifier = plateGrossInertiaRatio(input) * (options.cracked ? twoWayPlateStiffnessModifier(input, q) : uncrackedTransformedInertiaRatio({ ...input, memberType: "slab", b: 1000 }));
  const restraintModifier = 1 + 0.75 * connectionFixityRatio(input);
  const Dp = ((input.Ec * 1000 * Math.pow(h, 3)) / (12 * (1 - nu * nu))) * stiffnessModifier * restraintModifier;
  const points = [];
  let maxDeflectionM = 0;
  let maxAt = { x: a / 2, y: b / 2 };
  for (let iy = 0; iy <= n; iy++) {
    for (let ix = 0; ix <= n; ix++) {
      const x = (a * ix) / n;
      const y = (b * iy) / n;
      const w = plateSeriesDeflection(q, Dp, a, b, x, y);
      points.push({ x, y, w });
      if (Math.abs(w) > Math.abs(maxDeflectionM)) {
        maxDeflectionM = w;
        maxAt = { x, y };
      }
    }
  }
  return {
    grid: n,
    stiffnessModifier,
    restraintModifier,
    points,
    maxDeflectionM: Math.abs(maxDeflectionM),
    maxAt,
    xProfile: points.filter((p) => Math.abs(p.y - b / 2) <= b / n / 2).map((p) => ({ x: p.x, defl: Math.abs(p.w) })),
    yProfile: points.filter((p) => Math.abs(p.x - a / 2) <= a / n / 2).map((p) => ({ x: p.y, defl: Math.abs(p.w) })),
  };
}

function twoWayPlateStiffnessModifier(input, q) {
  const stripInput = { ...input, memberType: "slab", b: 1000, Igross: input.Igross || (1000 * Math.pow(input.D, 3)) / 12 };
  const mx = Math.abs((q * input.panelX * input.panelX) / 8);
  const my = Math.abs((q * input.panelY * input.panelY) / 8);
  const topRatio = effectiveInertiaRatio(stripInput, Math.max(mx, my) * 0.75, "top");
  const bottomRatio = effectiveInertiaRatio(stripInput, Math.max(mx, my) * 0.6, "bottom");
  return clamp(Math.min(topRatio, bottomRatio), 0.18, Math.max(1, uncrackedTransformedInertiaRatio(stripInput)));
}

function plateGrossInertiaRatio(input) {
  const rectIg = (1000 * Math.pow(input.D, 3)) / 12;
  return clamp((input.Igross || rectIg) / Math.max(rectIg, 1), 0.1, 5);
}

function plateSeriesDeflection(q, Dp, a, b, x, y) {
  let sum = 0;
  for (let m = 1; m <= 15; m += 2) {
    for (let n = 1; n <= 15; n += 2) {
      const denom = m * n * Math.pow(Math.pow(m / a, 2) + Math.pow(n / b, 2), 2);
      sum += (Math.sin((m * Math.PI * x) / a) * Math.sin((n * Math.PI * y) / b)) / denom;
    }
  }
  return (16 * q * sum) / (Math.pow(Math.PI, 6) * Dp);
}

function evaluateTwoWayStatus(twoWay) {
  const stripFailures = twoWay.strips.filter((row) => row.util > 1).map((row) => `${row.zone} ${row.location}: flexure ${(row.util * 100).toFixed(0)}%`);
  const deflectionFailures = twoWay.strips.filter((row) => !row.deflectionOk).slice(0, 1).map((row) => `plate deflection ${row.deflection.toFixed(1)} mm > ${row.limit.toFixed(1)} mm`);
  const supportShearFailures = twoWay.supportShear.filter((row) => row.util > 1).map((row) => `${row.zone}: support shear ${(row.util * 100).toFixed(0)}%`);
  const failures = [...stripFailures, ...deflectionFailures, ...supportShearFailures];
  return {
    ok: failures.length === 0,
    label: failures.length ? "FAILS" : "WORKS",
    headline: failures.length ? "Two-way slab advanced design fails one or more checks." : "Two-way slab advanced flexure, deflection and support-shear checks pass.",
    failures,
    warnings: ["Two-way support-shear formulas are advanced code-style checks; verify against the licensed standard and national annex."],
    reviewItems: verificationItems(),
  };
}

function evaluateDesignStatus(input, service, design) {
  const stress = stressSamples(input, service.samples);
  const strengthFailures = design.filter((row) => row.util > 1 || row.provided.as <= 0).map((row) => `${row.zone}: strength utilisation ${(row.util * 100).toFixed(0)}%`);
  const shearFailures = design.filter((row) => row.shear && !row.shear.ok).map((row) => `${row.zone}: ${input.memberType === "slab" ? "one-way slab shear" : "beam shear"} ${(row.shear.demand / Math.max(row.shear.phiVu, 1e-9) * 100).toFixed(0)}%`);
  const detailingFailures = design.filter((row) => row.slabDetailing && (!row.slabDetailing.provided.as || row.provided.spacing > row.slabDetailing.spacingLimit)).map((row) => `${row.zone}: slab bar spacing/detailing requires review`);
  const deflectionFailures = design.filter((row) => !row.zone.startsWith("Support") && !row.deflectionOk).map((row) => `${row.zone}: deflection ${row.deflection.toFixed(1)} mm > ${row.limit.toFixed(1)} mm`);
  const stressWarnings = stress
    .filter((row) => row.top > row.tensileLimit || row.bottom > row.tensileLimit || row.top < row.compressionLimit || row.bottom < row.compressionLimit)
    .slice(0, 4)
    .map((row) => `x=${row.x.toFixed(2)} m: elastic stress outside check range`);
  const failures = [...strengthFailures, ...shearFailures, ...detailingFailures, ...deflectionFailures];
  const reviewItems = verificationItems();
  return {
    ok: failures.length === 0,
    label: failures.length === 0 ? "WORKS" : "FAILS",
    headline: failures.length === 0 ? "Advanced flexure, shear and deflection checks pass." : "Advanced design fails one or more checks.",
    failures,
    warnings: stressWarnings,
    reviewItems,
  };
}

function verificationItems() {
  return [
    "detailing",
    "ductility",
    "shear",
    "torsion",
    "anchorage and development length",
    "crack control",
    "fire resistance",
    "durability exposure",
    "project load combinations",
  ];
}

function analyseCombination(input, combo, options = {}) {
  const patterns = combo.pattern && combo.q > 0 ? liveLoadPatterns(input.spans.length) : [{ name: "all spans", factors: input.spans.map(() => 1) }];
  const cases = patterns.map((pattern) =>
    analyse(input, (span, i) => combo.sw * input.selfWeightLoad + combo.g * (span.g + input.wetLineLoad) + combo.q * span.q * pattern.factors[i] - ptBalancedLoadForSpan(input, i), `${combo.name} - ${pattern.name}`, options)
  );
  return envelopeAnalyses(cases, combo);
}

function analyseServiceCombination(input, combo, options = {}) {
  if (normaliseSectionAnalysisMode(input.sectionAnalysisMode) === "cracked") return analyseCrackedCombination(input, combo, options);
  const mesh = options.mesh || buildMesh(input);
  const stiffnessModifiers = uncrackedStiffnessModifiers(input, mesh);
  return {
    ...analyseCombination(input, combo, { ...options, mesh, stiffnessModifiers }),
    cracked: false,
    stiffnessModifiers,
    sectionAnalysisMode: "uncracked",
  };
}

function analyseCrackedCombination(input, combo, options = {}) {
  let result = analyseCombination(input, combo, options);
  let stiffnessModifiers = null;
  for (let i = 0; i < 3; i++) {
    stiffnessModifiers = crackedStiffnessModifiers(input, result);
    result = analyseCombination(input, combo, { ...options, stiffnessModifiers });
  }
  return {
    ...result,
    cracked: true,
    stiffnessModifiers,
    sectionAnalysisMode: "cracked",
  };
}

function crackedStiffnessModifiers(input, result) {
  const modifiers = {};
  result.elements.forEach((element) => {
    const mid = (result.meshX[element.i] + result.meshX[element.j]) / 2;
    const sample = nearestSample(result.samples, mid);
    const face = sample.moment < 0 ? "top" : "bottom";
    modifiers[element.id] = effectiveInertiaRatio(input, Math.abs(sample.moment), face);
  });
  return modifiers;
}

function uncrackedStiffnessModifiers(input, mesh) {
  const ratio = uncrackedTransformedInertiaRatio(input);
  return Object.fromEntries(mesh.elements.map((element) => [element.id, ratio]));
}

function nearestSample(samples, x) {
  if (!samples?.length) return null;
  return samples.reduce((best, sample) => (Math.abs(sample.x - x) < Math.abs(best.x - x) ? sample : best), samples[0]);
}

function effectiveInertiaRatio(input, momentKNm, face) {
  const Ig = input.Igross || (input.b * Math.pow(input.D, 3)) / 12;
  const Mcr = crackingMoment(input);
  const uncrackedRatio = uncrackedTransformedInertiaRatio(input);
  if (!Number.isFinite(momentKNm) || momentKNm <= Mcr) return uncrackedRatio;
  const asReq = requiredSteel(input, momentKNm / flexurePhi(input), face);
  const provided = chooseReo(input, asReq, face);
  const As = Math.max(provided.as || 0, minSteel(input));
  const Icr = crackedInertia(input, As, face);
  const ratio = Mcr / Math.max(momentKNm, 1e-9);
  const Ie = Math.pow(ratio, 3) * Ig * uncrackedRatio + (1 - Math.pow(ratio, 3)) * Icr;
  return clamp(Ie / Ig, clamp(Icr / Ig, 0.08, 1), Math.max(1, uncrackedRatio));
}

function crackingMoment(input) {
  const Ig = input.Igross || (input.b * Math.pow(input.D, 3)) / 12;
  const fct = 0.6 * Math.sqrt(input.fc);
  const centroid = input.sectionCentroid || input.D / 2;
  const y = Math.max(centroid, input.D - centroid, input.D / 2);
  return (fct * Ig / y) / 1e6;
}

function crackedInertia(input, As, face = "bottom") {
  const n = 200000 / Math.max(input.Ec, 1);
  const b = Math.max(input.b, 1);
  const d = Math.max(effectiveDepthForFace(input, face), 1);
  const nAs = n * Math.max(As, 1);
  const x = clamp((-nAs + Math.sqrt(nAs * nAs + 2 * b * nAs * d)) / b, 1, input.D);
  const Icr = (b * Math.pow(x, 3)) / 3 + nAs * Math.pow(d - x, 2);
  const Ig = input.Igross || (input.b * Math.pow(input.D, 3)) / 12;
  return clamp(Icr, 0.05 * Ig, Ig);
}

function uncrackedTransformedInertiaRatio(input) {
  const Ig = input.Igross || (input.b * Math.pow(input.D, 3)) / 12;
  const concrete = sectionProperties(input);
  const nMinusOne = Math.max(0, 200000 / Math.max(input.Ec || defaults.ec, 1) - 1);
  const steel = transformedSteelItems(input, nMinusOne);
  if (!steel.length) return 1;
  const concreteArea = concrete.area;
  const transformedArea = concreteArea + steel.reduce((sum, item) => sum + item.area, 0);
  const ybar = (concreteArea * concrete.centroid + steel.reduce((sum, item) => sum + item.area * item.y, 0)) / Math.max(transformedArea, 1);
  const concreteI = concrete.inertia + concreteArea * Math.pow(concrete.centroid - ybar, 2);
  const steelI = steel.reduce((sum, item) => sum + item.area * Math.pow(item.y - ybar, 2), 0);
  return clamp((concreteI + steelI) / Math.max(Ig, 1), 0.5, 2.5);
}

function transformedSteelItems(input, factor) {
  return ["top", "bottom"].flatMap((face) =>
    rebarLayersForFace(input, face).map((layer) => ({
      area: layer.count * barArea(layer.dia) * factor,
      y: layerDepthFromTop(input, face, layer),
    }))
  ).filter((item) => item.area > 0 && Number.isFinite(item.y));
}

function effectiveDepthForFace(input, tensionFace) {
  const layers = rebarLayersForFace(input, tensionFace);
  if (layers.length) {
    const weightedY = layers.reduce((sum, layer) => sum + layerDepthFromTop(input, tensionFace, layer) * layer.count * barArea(layer.dia), 0);
    const area = layers.reduce((sum, layer) => sum + layer.count * barArea(layer.dia), 0);
    const y = weightedY / Math.max(area, 1);
    return tensionFace === "top" ? input.D - y : y;
  }
  const fallback = input.cover + (input.barDia || 16) / 2;
  return input.D - fallback;
}

function layerDepthFromTop(input, face, layer) {
  const index = Math.max(0, (layer.layer || 1) - 1);
  const gap = Math.max(25, Number(layer.dia || input.barDia || 16) + 10);
  const first = input.cover + Number(layer.dia || input.barDia || 16) / 2;
  return face === "top" ? first + index * gap : input.D - first - index * gap;
}

function liveLoadPatterns(spanCount) {
  const all = { name: "all live", factors: Array(spanCount).fill(1) };
  if (spanCount <= 8) {
    const patterns = [];
    const total = Math.pow(2, spanCount);
    for (let mask = 1; mask < total; mask++) {
      const factors = Array.from({ length: spanCount }, (_, i) => (mask & (1 << i) ? 1 : 0));
      const loaded = factors.map((value, i) => (value ? i + 1 : null)).filter(Boolean).join("-");
      patterns.push({ name: loaded === Array.from({ length: spanCount }, (_, i) => i + 1).join("-") ? "all live" : `loaded spans ${loaded}`, factors });
    }
    return patterns;
  }
  const odd = { name: "alternate odd", factors: Array.from({ length: spanCount }, (_, i) => (i % 2 === 0 ? 1 : 0)) };
  const even = { name: "alternate even", factors: Array.from({ length: spanCount }, (_, i) => (i % 2 === 1 ? 1 : 0)) };
  const adjacent = [];
  for (let i = 0; i < spanCount - 1; i++) {
    adjacent.push({ name: `adjacent ${i + 1}-${i + 2}`, factors: Array.from({ length: spanCount }, (_, j) => (j === i || j === i + 1 ? 1 : 0)) });
  }
  return [all, odd, even, ...adjacent];
}

function envelopeAnalyses(cases, combo) {
  const first = cases[0];
  const samples = first.samples.map((sample, i) => {
    const candidate = cases.reduce((best, c) => (Math.abs(c.samples[i].moment) > Math.abs(best.moment) ? c.samples[i] : best), sample);
    const shearCandidate = cases.reduce((best, c) => (Math.abs(c.samples[i].shear) > Math.abs(best.shear) ? c.samples[i] : best), sample);
    const deflCandidate = cases.reduce((best, c) => (Math.abs(c.samples[i].defl) > Math.abs(best.defl) ? c.samples[i] : best), sample);
    return { ...candidate, shear: shearCandidate.shear, defl: deflCandidate.defl };
  });
  return {
    ...first,
    combo,
    cases,
    samples,
    maxMoment: maxAbs(samples, "moment"),
    maxShear: maxAbs(samples, "shear"),
    maxDefl: maxAbs(samples, "defl"),
  };
}

function buildOneWayActionEnvelope(input, combinationResults, type) {
  const include = type === "ULS" ? (combo) => combo.type === "ULS" : (combo) => combo.type === "SLS" || combo.type === "DEF";
  const cases = combinationResults
    .filter(({ combo }) => include(combo))
    .flatMap(({ combo, analysis }) => (analysis.cases?.length ? analysis.cases : [analysis]).map((item) => ({ ...item, combo, caseLabel: item.name || combo.name })));
  const fallback = combinationResults[0]?.analysis;
  if (!cases.length || !fallback) return fallback;

  const first = cases[0];
  const samples = first.samples.map((sample, i) => {
    const at = cases.map((c) => ({ c, s: c.samples[i] || sample }));
    const maxM = at.reduce((best, item) => (item.s.moment > best.s.moment ? item : best), at[0]);
    const minM = at.reduce((best, item) => (item.s.moment < best.s.moment ? item : best), at[0]);
    const maxV = at.reduce((best, item) => (item.s.shear > best.s.shear ? item : best), at[0]);
    const minV = at.reduce((best, item) => (item.s.shear < best.s.shear ? item : best), at[0]);
    const absM = Math.abs(maxM.s.moment) >= Math.abs(minM.s.moment) ? maxM : minM;
    const absV = Math.abs(maxV.s.shear) >= Math.abs(minV.s.shear) ? maxV : minV;
    const absD = at.reduce((best, item) => (Math.abs(item.s.defl) > Math.abs(best.s.defl) ? item : best), at[0]);
    return {
      ...sample,
      moment: absM.s.moment,
      shear: absV.s.shear,
      defl: absD.s.defl,
      momentMax: maxM.s.moment,
      momentMin: minM.s.moment,
      momentMaxCoShear: maxM.s.shear,
      momentMinCoShear: minM.s.shear,
      shearMax: maxV.s.shear,
      shearMin: minV.s.shear,
      shearMaxCoMoment: maxV.s.moment,
      shearMinCoMoment: minV.s.moment,
      deflAbs: Math.abs(absD.s.defl),
      momentMaxCase: maxM.c.caseLabel,
      momentMinCase: minM.c.caseLabel,
      shearMaxCase: maxV.c.caseLabel,
      shearMinCase: minV.c.caseLabel,
      deflCase: absD.c.caseLabel,
    };
  });

  return {
    ...first,
    name: `${type === "ULS" ? "Strength" : "Service"} design envelope`,
    combo: { name: `${type === "ULS" ? "All ULS" : "All service/deflection"} combinations`, type },
    cases,
    samples,
    maxMoment: maxAbs(samples, "moment"),
    maxShear: maxAbs(samples, "shear"),
    maxDefl: maxAbs(samples, "defl"),
    maxPositiveMoment: maxBy(samples, (s) => s.momentMax),
    maxNegativeMoment: maxBy(samples, (s) => -s.momentMin),
    maxPositiveShear: maxBy(samples, (s) => s.shearMax),
    maxNegativeShear: maxBy(samples, (s) => -s.shearMin),
  };
}

function buildOneWayEnvelopeRows(input, strengthEnvelope, serviceEnvelope, deflection) {
  const rows = [];
  const lowPoints = spanDeflectionLowPoints(input, deflection);
  rows.push(
    makeEnvelopeRow(
      "Envelope method",
      `${strengthEnvelope.cases?.length || 0} strength cases`,
      "Moment and shear controlled",
      "All strength combinations and live-load span patterns",
      "At each design station M envelope stores co-existing V, and V envelope stores co-existing M"
    )
  );
  designPointStations(input).forEach((station) => {
    const strength = nearestEnvelopeSample(strengthEnvelope, station.x);
    const service = nearestEnvelopeSample(serviceEnvelope, station.x);
    if (!strength) return;
    rows.push(makeEnvelopeRow(`${station.label} M+ envelope`, `${station.x.toFixed(2)} m`, `${(strength.momentMax || 0).toFixed(1)} kNm, co-V ${(strength.momentMaxCoShear || 0).toFixed(1)} kN`, strength.momentMaxCase || "case", "Moment-controlled design station"));
    rows.push(makeEnvelopeRow(`${station.label} M- envelope`, `${station.x.toFixed(2)} m`, `${Math.abs(strength.momentMin || 0).toFixed(1)} kNm, co-V ${(strength.momentMinCoShear || 0).toFixed(1)} kN`, strength.momentMinCase || "case", "Moment-controlled design station"));
    rows.push(makeEnvelopeRow(`${station.label} V+ envelope`, `${station.x.toFixed(2)} m`, `${(strength.shearMax || 0).toFixed(1)} kN, co-M ${(strength.shearMaxCoMoment || 0).toFixed(1)} kNm`, strength.shearMaxCase || "case", "Shear-controlled design station"));
    rows.push(makeEnvelopeRow(`${station.label} V- envelope`, `${station.x.toFixed(2)} m`, `${Math.abs(strength.shearMin || 0).toFixed(1)} kN, co-M ${(strength.shearMinCoMoment || 0).toFixed(1)} kNm`, strength.shearMinCase || "case", "Shear-controlled design station"));
    if (service) rows.push(makeEnvelopeRow(`${station.label} service deflection`, `${station.x.toFixed(2)} m`, `${((service.deflAbs || Math.abs(service.defl || 0)) * 1000).toFixed(2)} mm`, service.deflCase || "All service/deflection combinations", "Service envelope station"));
  });
  input.spans.forEach((span, i) => {
    const start = strengthEnvelope.x[i];
    const end = strengthEnvelope.x[i + 1];
    const inSpan = (s) => s.x >= start - 1e-9 && s.x <= end + 1e-9;
    const sagging = bestSampleInCases(strengthEnvelope.cases, inSpan, (s) => s.moment, "max");
    const shear = bestSampleInCases(strengthEnvelope.cases, inSpan, (s) => Math.abs(s.shear), "max");
    const service = bestSampleInCases(serviceEnvelope.cases || [], inSpan, (s) => Math.abs(s.defl), "max");
    rows.push(makeEnvelopeRow(`Span ${i + 1} M+`, `${sagging.sample.x.toFixed(2)} m`, `${sagging.sample.moment.toFixed(1)} kNm`, sagging.caseName, "Sagging flexure design"));
    rows.push(makeEnvelopeRow(`Span ${i + 1} |V|`, `${shear.sample.x.toFixed(2)} m`, `${Math.abs(shear.sample.shear).toFixed(1)} kN`, shear.caseName, input.memberType === "beam" ? "Beam shear fitments" : "One-way slab shear"));
    if (service.sample) rows.push(makeEnvelopeRow(`Span ${i + 1} short deflection`, `${service.sample.x.toFixed(2)} m`, `${(Math.abs(service.sample.defl) * 1000).toFixed(2)} mm`, service.caseName, "Service deflection review"));
    const low = lowPoints[i];
    if (low) rows.push(makeEnvelopeRow(`Span ${i + 1} long deflection low point`, `${low.x.toFixed(2)} m`, `${low.longMm.toFixed(2)} mm`, `${deflection.shortCombo.name} + sustained ${deflection.sustainedCombo.name}`, `L/${input.deflectionRatio} limit ${low.limitMm.toFixed(1)} mm`));
  });
  for (let i = 1; i < input.spans.length; i++) {
    const supportX = strengthEnvelope.x[i];
    const window = Math.max(0.08, Math.min(input.spans[i - 1].length, input.spans[i].length) / 40);
    const nearSupport = (s) => Math.abs(s.x - supportX) <= window;
    const hogging = bestSampleInCases(strengthEnvelope.cases, nearSupport, (s) => s.moment, "min");
    const shear = bestSampleInCases(strengthEnvelope.cases, nearSupport, (s) => Math.abs(s.shear), "max");
    rows.push(makeEnvelopeRow(`Support ${i + 1} M-`, `${supportX.toFixed(2)} m`, `${Math.abs(hogging.sample.moment).toFixed(1)} kNm`, hogging.caseName, "Top reinforcement design"));
    rows.push(makeEnvelopeRow(`Support ${i + 1} |V|`, `${supportX.toFixed(2)} m`, `${Math.abs(shear.sample.shear).toFixed(1)} kN`, shear.caseName, input.memberType === "beam" ? "Support shear fitments" : "Concrete one-way shear"));
  }
  reactionEnvelopeRows(strengthEnvelope).forEach((row) => rows.push(row));
  rows.push(makeEnvelopeRow("Overall long-term deflection", `${deflection.longMax.x.toFixed(2)} m`, `${(Math.abs(deflection.longMax.value) * 1000).toFixed(2)} mm`, `${deflection.shortCombo.name} + sustained ${deflection.sustainedCombo.name}`, "Governing deflection check"));
  return rows;
}

function designPointStations(input) {
  const supports = spanSupportLocations(input);
  return input.spans.flatMap((span, spanIndex) => {
    const start = supports[spanIndex];
    const step = span.length / 12;
    return Array.from({ length: 13 }, (_, i) => {
      const x = start + step * i;
      const label = i === 0 ? `Span ${spanIndex + 1} left support` : i === 12 ? `Span ${spanIndex + 1} right support` : `Span ${spanIndex + 1} ${i}/12`;
      return { span: spanIndex + 1, index: i, x, label };
    });
  });
}

function nearestEnvelopeSample(envelope, x) {
  const samples = envelope?.samples || [];
  if (!samples.length) return null;
  return samples.reduce((best, sample) => (Math.abs(sample.x - x) < Math.abs(best.x - x) ? sample : best), samples[0]);
}

function spanDeflectionLowPoints(input, deflection) {
  const supports = spanSupportLocations(input);
  return input.spans.map((span, i) => {
    const start = supports[i];
    const end = supports[i + 1];
    const inSpan = (sample) => sample.x >= start - 1e-9 && sample.x <= end + 1e-9;
    const candidates = deflection.longSamples.filter(inSpan);
    const best = candidates.reduce((acc, sample) => (Math.abs(sample.defl) > Math.abs(acc.defl) ? sample : acc), candidates[0] || { x: (start + end) / 2, defl: 0 });
    const short = nearestSample(deflection.shortSamples || [], best.x);
    return {
      span: i + 1,
      x: best.x,
      localX: best.x - start,
      shortMm: Math.abs((short?.shortDefl ?? short?.defl ?? 0) * 1000),
      longMm: Math.abs(best.defl * 1000),
      limitMm: (span.length * 1000) / input.deflectionRatio,
    };
  });
}

function spanSupportLocations(input) {
  const supports = [0];
  input.spans.forEach((span) => supports.push(supports[supports.length - 1] + span.length));
  return supports;
}

function bestSampleInCases(cases, predicate, scoreFn, mode) {
  const candidates = cases.flatMap((c) => c.samples.filter(predicate).map((sample) => ({ sample, caseName: c.caseLabel || c.name || c.combo?.name || "case", score: scoreFn(sample) })));
  if (!candidates.length) return { sample: { x: 0, moment: 0, shear: 0, defl: 0 }, caseName: "none", score: 0 };
  return candidates.reduce((best, item) => (mode === "min" ? (item.score < best.score ? item : best) : item.score > best.score ? item : best), candidates[0]);
}

function reactionEnvelopeRows(envelope) {
  const rows = [];
  const supports = envelope.supportNodes?.length
    ? envelope.supportNodes
    : envelope.x.map((x, i) => ({ x, boundaryIndex: i, node: envelope.meshX.findIndex((nodeX) => Math.abs(nodeX - x) < 1e-9) }));
  supports.forEach((support) => {
    const supportX = support.x;
    const nodeIndex = support.node;
    if (nodeIndex < 0) return;
    const dof = envelope.dofs?.vertical?.[nodeIndex] ?? 2 * nodeIndex;
    const best = envelope.cases.reduce(
      (acc, c) => {
        const reaction = c.R?.[dof] || 0;
        return Math.abs(reaction) > Math.abs(acc.reaction) ? { reaction, caseName: c.caseLabel || c.name || c.combo?.name || "case" } : acc;
      },
      { reaction: 0, caseName: "none" }
    );
    rows.push(makeEnvelopeRow(`Support ${support.boundaryIndex + 1} reaction`, `${supportX.toFixed(2)} m`, `${Math.abs(best.reaction).toFixed(1)} kN`, best.caseName, "Support / column reaction envelope"));
  });
  return rows;
}

function makeEnvelopeRow(name, location, value, caseName, use) {
  return { name, location, value, caseName, use };
}

function buildTwoWayEnvelope(input, combinationResults) {
  const rows = [];
  const bestMoment = bestCombinationResult(combinationResults, ({ analysis }) => Math.abs(analysis.maxMoment.value), (combo) => combo.type === "ULS");
  const bestSupportShear = bestCombinationResult(combinationResults, ({ analysis }) => Math.abs(analysis.maxShear.value), (combo) => combo.type === "ULS");
  const bestDefl = bestCombinationResult(combinationResults, ({ analysis }) => Math.abs(analysis.maxDefl.value), (combo) => combo.type === "SLS" || combo.type === "DEF");
  if (bestMoment) rows.push(makeEnvelopeRow("Two-way strip M*", "column/middle strips", `${Math.abs(bestMoment.analysis.maxMoment.value).toFixed(1)} kNm/m`, bestMoment.combo.name, "Flexure strip design"));
  if (bestSupportShear) rows.push(makeEnvelopeRow("Support-shear utilisation", input.supportType, `${(Math.abs(bestSupportShear.analysis.maxShear.value) * 100).toFixed(0)}%`, bestSupportShear.combo.name, "Two-way support-shear review"));
  if (bestDefl) rows.push(makeEnvelopeRow("Plate deflection", `${bestDefl.analysis.maxDefl.x.toFixed(2)} m`, `${(Math.abs(bestDefl.analysis.maxDefl.value) * 1000).toFixed(2)} mm`, bestDefl.combo.name, "Service deflection review"));
  return { rows, ulsCombo: bestMoment?.combo || bestSupportShear?.combo || null, bestMoment, bestSupportShear, bestDefl };
}

function bestCombinationResult(results, scoreFn, include) {
  const candidates = results.filter(({ combo }) => include(combo));
  if (!candidates.length) return null;
  return candidates.reduce((best, item) => (scoreFn(item) > scoreFn(best) ? item : best), candidates[0]);
}

function maxBy(items, scoreFn) {
  return items.reduce((best, item) => {
    const score = scoreFn(item);
    return score > best.score ? { ...item, value: score, score } : best;
  }, { value: 0, x: 0, score: -Infinity });
}

function analyse(input, loadFn, name = "analysis", options = {}) {
  const mesh = options.mesh || buildMesh(input);
  const nodeCount = mesh.nodes.length;
  const dofs = buildFrameDofMap(input, mesh);
  const dof = dofs.count;
  const K = makeMatrix(dof, dof);
  const F = Array(dof).fill(0);
  const baseEI = input.Ec * input.Igross * 1e-9;

  mesh.elements.forEach((element) => {
    const L = element.length;
    const w = loadFn(input.spans[element.span], element.span);
    const EI = baseEI * (options.stiffnessModifiers?.[element.id] ?? 1);
    const k = beamK(EI, L);
    const fe = [w * L / 2, w * L * L / 12, w * L / 2, -w * L * L / 12];
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
  const free = Array.from({ length: dof }, (_, i) => i).filter((i) => !fixed.includes(i));
  const Kff = free.map((r) => free.map((c) => K[r][c]));
  const Ff = free.map((r) => F[r]);
  const df = solveLinear(Kff, Ff);
  const d = Array(dof).fill(0);
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
    const map = dofs.elementMaps[element.id];
    const de = map.map((idx) => d[idx]);
    const end = subtract(multiplyMatrixVector(k, de), fe);
    for (let j = 0; j <= 4; j++) {
      const xi = (L * j) / 4;
      const globalX = mesh.nodes[element.i] + xi;
      const defl = hermiteDeflection(de, xi, L) + udlFixedEndDeflection(w, xi, L, EI);
      const shear = -end[0] - w * xi;
      const moment = end[1] - end[0] * xi - (w * xi * xi) / 2;
      samples.push({ x: globalX, span: element.span, shear, moment, defl });
    }
    return { ...element, L, w, end, stiffnessModifier: options.stiffnessModifiers?.[element.id] ?? 1 };
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
  return { name, x: mesh.supports, meshX: mesh.nodes, d, R, dofs, samples, elements, supportNodes: mesh.supportNodes, supportSprings, supportFixityMoments, maxMoment, maxShear, maxDefl, totalLength: mesh.supports[mesh.supports.length - 1], elementCount: mesh.elements.length };
}

function buildFrameDofMap(input, mesh) {
  const vertical = mesh.nodes.map((_, i) => i);
  const rotationByNode = Array(mesh.nodes.length).fill(null);
  const elementMaps = {};
  let next = mesh.nodes.length;

  mesh.elements.forEach((element) => {
    const releaseI = isElementEndReleased(input, element, "i");
    const releaseJ = isElementEndReleased(input, element, "j");
    const thetaI = releaseI ? next++ : rotationDofForNode(rotationByNode, element.i, () => next++);
    const thetaJ = releaseJ ? next++ : rotationDofForNode(rotationByNode, element.j, () => next++);
    elementMaps[element.id] = [vertical[element.i], thetaI, vertical[element.j], thetaJ];
  });

  return { count: next, vertical, rotationByNode, elementMaps };
}

function rotationDofForNode(rotationByNode, node, create) {
  if (rotationByNode[node] == null) rotationByNode[node] = create();
  return rotationByNode[node];
}

function isElementEndReleased(input, element, end) {
  const system = normaliseSpanSystem(input.spans[element.span]?.system);
  if (system !== "simple") return false;
  if (end === "i") return element.localIndex === 0;
  return element.localIndex === element.perSpan - 1;
}

function applySupportFixitySprings(K, input, mesh, baseEI, dofs) {
  return mesh.supportNodes
    .map((support) => {
      const supportIndex = support.boundaryIndex;
      const node = support.node;
      const percent = supportFixityPercent(input, supportIndex);
      const ratio = percent / 100;
      if (ratio <= 0) return null;
      const dof = dofs.rotationByNode[node];
      if (dof == null) return null;
      const reference = supportReferenceRotationalStiffness(input, supportIndex, baseEI);
      const k = reference * ratio / Math.max(0.02, 1 - ratio);
      K[dof][dof] += k;
      return { supportIndex, node, x: support.x, percent, dof, k };
    })
    .filter(Boolean);
}

function supportReferenceRotationalStiffness(input, supportIndex, baseEI) {
  const left = supportIndex > 0 ? input.spans[supportIndex - 1]?.length : 0;
  const right = supportIndex < input.spans.length ? input.spans[supportIndex]?.length : 0;
  const leftK = left > 0 ? 4 * baseEI / left : 0;
  const rightK = right > 0 ? 4 * baseEI / right : 0;
  return Math.max(leftK + rightK, baseEI);
}

function supportFixityPercent(input, supportIndex) {
  const value = input.supportFixities?.[supportIndex] ?? input.columnFixity ?? 0;
  return normaliseFixityPercent(value);
}

function averageSupportFixity(input) {
  const values = input.supportFixities?.length ? input.supportFixities : [input.columnFixity || 0];
  const supported = input.spans ? spanBoundarySupportStates(input) : values.map(() => true);
  const active = values.filter((_, i) => supported[i]);
  return active.reduce((sum, value) => sum + normaliseFixityPercent(value), 0) / Math.max(active.length, 1);
}

function formatSupportFixities(input) {
  const values = input.supportFixities?.length ? input.supportFixities : [input.columnFixity || 0];
  const supported = input.spans ? spanBoundarySupportStates(input) : values.map(() => true);
  return values.map((value, i) => (supported[i] ? `S${i + 1} ${normaliseFixityPercent(value).toFixed(0)}%` : `T${i + 1} free`)).join(", ");
}

function buildMesh(input) {
  const perSpan = clamp(Math.round(input.elementsPerSpan || 8), 1, 40);
  const nodes = [0];
  const supports = [0];
  const elements = [];
  let elementId = 0;

  input.spans.forEach((span, spanIndex) => {
    const startNode = nodes.length - 1;
    const startX = nodes[startNode];
    for (let i = 1; i <= perSpan; i++) {
      nodes.push(startX + (span.length * i) / perSpan);
      elements.push({
        id: elementId++,
        span: spanIndex,
        i: startNode + i - 1,
        j: startNode + i,
        length: span.length / perSpan,
        localIndex: i - 1,
        perSpan,
      });
    }
    supports.push(nodes[nodes.length - 1]);
  });

  const supportStates = spanBoundarySupportStates(input);
  const supportNodeIndices = supports.map((_, i) => i * perSpan).filter((_, i) => supportStates[i]);
  const supportNodes = supports
    .map((x, boundaryIndex) => ({ x, boundaryIndex, node: boundaryIndex * perSpan }))
    .filter((item) => supportStates[item.boundaryIndex]);

  return { nodes, supports, supportNodeIndices, supportNodes, elements };
}

function beamK(EI, L) {
  const a = (12 * EI) / Math.pow(L, 3);
  const b = (6 * EI) / Math.pow(L, 2);
  const c = (4 * EI) / L;
  const d = (2 * EI) / L;
  return [
    [a, b, -a, b],
    [b, c, -b, d],
    [-a, -b, a, -b],
    [b, d, -b, c],
  ];
}

function hermiteDeflection(de, x, L) {
  const r = x / L;
  const n1 = 1 - 3 * r * r + 2 * r * r * r;
  const n2 = L * (r - 2 * r * r + r * r * r);
  const n3 = 3 * r * r - 2 * r * r * r;
  const n4 = L * (-r * r + r * r * r);
  return n1 * de[0] + n2 * de[1] + n3 * de[2] + n4 * de[3];
}

function udlFixedEndDeflection(w, x, L, EI) {
  return (w * x * x * Math.pow(L - x, 2)) / (24 * EI);
}

function designMember(input, ultimate, service) {
  const zones = [];
  const ultimateSamples = ultimate.cases ? ultimate.cases.flatMap((c) => c.samples) : ultimate.samples;
  const serviceSamplesAll = service.cases ? service.cases.flatMap((c) => c.samples) : service.samples;
  input.spans.forEach((span, i) => {
    const start = ultimate.x[i];
    const end = ultimate.x[i + 1];
    const mid = (start + end) / 2;
    const midSamples = ultimateSamples.filter((s) => s.x >= start && s.x <= end);
    const serviceSamples = serviceSamplesAll.filter((s) => s.x >= start && s.x <= end);
    const sag = midSamples.reduce((best, s) => (s.moment > best.moment ? s : best), midSamples[0]);
    const spanShear = maxAbs(midSamples, "shear");
    const defl = maxAbs(serviceSamples, "defl");
    zones.push(makeDesignZone(input, `Span ${i + 1}`, `${mid.toFixed(2)} m`, Math.max(0, sag.moment), spanShear.value, span.length, defl.value));
    if (i > 0) {
      const supportX = start;
      const supportSamples = ultimateSamples.filter((s) => Math.abs(s.x - supportX) < Math.max(0.08, span.length / 40));
      const hog = supportSamples.reduce((best, s) => (s.moment < best.moment ? s : best), supportSamples[0]);
      const supportShear = maxAbs(supportSamples, "shear");
      zones.push(makeDesignZone(input, `Support ${i + 1}`, `${supportX.toFixed(2)} m`, Math.abs(Math.min(0, hog.moment)), supportShear.value, Math.min(input.spans[i - 1].length, span.length), 0));
    }
  });
  return zones;
}

function makeDesignZone(input, zone, location, Mu, Vu, spanLength, deflectionM) {
  const phi = flexurePhi(input);
  const face = location === "negative" || zone.startsWith("Support") ? "top" : "bottom";
  const asReq = requiredSteel(input, Mu / phi, face);
  const provided = chooseReo(input, asReq, face);
  const phiMu = phi * momentCapacity(input, provided.as, face);
  const limit = (spanLength * 1000) / input.deflectionRatio;
  const deflection = Math.abs(deflectionM) * 1000;
  const shear = designShear(input, Vu, provided.as);
  const slabDetailing = input.memberType === "slab" ? slabDetailingDesign(input) : null;
  return {
    zone,
    location,
    Mu,
    Vu: Math.abs(Vu || 0),
    phiMu,
    asReq,
    provided,
    face,
    shear,
    slabDetailing,
    util: phiMu > 0 ? Mu / phiMu : Infinity,
    deflection,
    limit,
    deflectionOk: zone.startsWith("Support") || deflection <= limit,
    check: memberCheckText(input, shear, slabDetailing),
  };
}

function alpha2(fc) {
  return clamp(0.85 - 0.0015 * fc, 0.67, 0.85);
}

function gammaBlock(fc) {
  return clamp(0.97 - 0.0025 * fc, 0.67, 0.97);
}

function flexurePhi() {
  return 0.85;
}

function shearPhi() {
  return 0.75;
}

function requiredSteel(input, targetMn, face = "bottom") {
  if (targetMn <= 0) return minSteel(input);
  let lo = minSteel(input);
  let hi = sectionOverallWidth(input) * effectiveDepthForFace(input, face) * 0.04;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (momentCapacity(input, mid, face) >= targetMn) hi = mid;
    else lo = mid;
  }
  return Math.max(hi, minSteel(input));
}

function minSteel(input) {
  if (input.memberType === "slab") return slabMinimums(input).primary;
  return beamMinimums(input).flexural;
}

function beamMinimums(input) {
  const crackControlMin = 0.13 * Math.sqrt(input.fc) * input.b * input.d / input.fsy;
  const robustMin = 0.002 * input.b * input.D;
  const bottomBar = input.bottomBars?.[0] || input.bars?.[0] || 16;
  const nominalTop = 2 * barArea(Math.max(12, Math.min(bottomBar, 16)));
  return {
    flexural: Math.max(crackControlMin, robustMin),
    nominalTop,
  };
}

function slabMinimums(input) {
  const d = Math.max(input.d, 1);
  const fctf = 0.6 * Math.sqrt(input.fc);
  const flexuralCrackMin = 0.19 * Math.pow(input.D / d, 2) * (fctf / input.fsy) * input.b * d;
  const shrinkageFactor = clamp((input.shrinkageStrain || defaults.shrinkageStrain) / 550, 0.6, 1.8) * clamp(input.humidityFactor || 1, 0.5, 1.8);
  const restrainedShrinkageMin = 1.75 * shrinkageFactor * input.b * input.D * 1e-3;
  const spacingLimit = slabSpacingLimit(input);
  return {
    primary: Math.max(flexuralCrackMin, restrainedShrinkageMin),
    secondary: restrainedShrinkageMin,
    spacingLimit,
  };
}

function slabSpacingLimit(input) {
  return Math.min(input.maxSpacing || 250, input.crackMaxSpacing || 250, 2 * input.D, 300);
}

function slabDetailingDesign(input) {
  const mins = slabMinimums(input);
  return {
    secondaryAs: mins.secondary,
    spacingLimit: mins.spacingLimit,
    provided: chooseSlabReo(input, mins.secondary, "bottom"),
  };
}

function designShear(input, Vu, providedAs) {
  const demand = Math.abs(Vu || 0);
  const phi = shearPhi();
  const dv = Math.max(0.72 * input.D, 0.9 * input.d);
  const bv = input.b;
  const kv = input.memberType === "slab" ? 0.15 : 0.18;
  const vuc = (kv * bv * dv * Math.sqrt(input.fc)) / 1000;
  const phiVuc = phi * vuc;
  const vuMax = (0.55 * bv * dv * Math.sqrt(input.fc)) / 1000;
  const phiVuMax = phi * vuMax;

  if (input.memberType === "slab") {
    return {
      demand,
      phiVu: Math.min(phiVuc, phiVuMax),
      phiVuc,
      phiVuMax,
      dv,
      ok: demand <= Math.min(phiVuc, phiVuMax),
      provided: "No shear ligs",
      text: demand <= Math.min(phiVuc, phiVuMax) ? `one-way shear OK (${demand.toFixed(0)} / ${Math.min(phiVuc, phiVuMax).toFixed(0)} kN)` : `one-way shear FAIL (${demand.toFixed(0)} / ${Math.min(phiVuc, phiVuMax).toFixed(0)} kN)`,
    };
  }

  const fsyf = Math.min(input.fsy, 500);
  const maxSpacing = Math.min(300, 0.5 * dv);
  const minAsvPerS = (0.08 * Math.sqrt(input.fc) * bv) / fsyf;
  const needsLinks = demand > phiVuc || input.D >= 750;
  const vusReq = Math.max(0, demand / phi - vuc);
  const stirrup = designBeamStirrups(input, {
    demand,
    needsLinks,
    vusReq,
    fsyf,
    dv,
    maxSpacing,
    minAsvPerS,
  });
  const phiVus = stirrup.required ? phi * ((stirrup.asv / stirrup.spacing) * fsyf * dv) / 1000 : 0;
  const phiVu = Math.min(phiVuc + phiVus, phiVuMax);
  const ok = demand <= phiVu;
  return {
    demand,
    phiVu,
    phiVuc,
    phiVus,
    phiVuMax,
    dv,
    ok,
    stirrup,
    provided: stirrup.text,
    text: `${ok ? "shear OK" : "shear FAIL"} ${demand.toFixed(0)} / ${phiVu.toFixed(0)} kN, ${stirrup.text}`,
  };
}

function designBeamStirrups(input, spec) {
  const candidates = [];
  [10, 12, 16].forEach((dia) => {
    [2, 4].forEach((legs) => {
      const asv = legs * barArea(dia);
      const requiredAsvPerS = Math.max(spec.minAsvPerS, spec.vusReq > 0 ? (spec.vusReq * 1000) / (spec.fsyf * spec.dv) : 0);
      const spacingLimit = Math.min(spec.maxSpacing, asv / Math.max(requiredAsvPerS, 1e-9));
      const spacing = roundDownTo(spacingLimit, 25);
      if (spacing >= 75) {
        candidates.push({
          dia,
          legs,
          asv,
          spacing,
          required: spec.needsLinks,
          steelPerM: (asv * 1000) / spacing,
        });
      }
    });
  });

  if (!spec.needsLinks) {
    const nominalDia = input.b > 450 ? 12 : 10;
    const nominalLegs = input.b > 450 ? 4 : 2;
    const nominalSpacing = roundDownTo(Math.min(spec.maxSpacing, 300), 25);
    const asv = nominalLegs * barArea(nominalDia);
    return {
      dia: nominalDia,
      legs: nominalLegs,
      asv,
      spacing: nominalSpacing,
      required: false,
      steelPerM: (asv * 1000) / nominalSpacing,
      text: `Nominal ${nominalLegs}-R${nominalDia} closed ligs @ ${nominalSpacing} mm`,
    };
  }

  const best = candidates.sort((a, b) => a.steelPerM - b.steelPerM || a.dia - b.dia || a.legs - b.legs)[0];
  if (best) {
    return {
      ...best,
      text: `${best.legs}-R${best.dia} closed ligs @ ${best.spacing} mm`,
    };
  }

  const dia = 16;
  const legs = input.b > 450 ? 4 : 2;
  const asv = legs * barArea(dia);
  return {
    dia,
    legs,
    asv,
    spacing: 75,
    required: true,
    steelPerM: (asv * 1000) / 75,
    text: `${legs}-R${dia} closed ligs @ 75 mm, increase beam size`,
  };
}

function memberCheckText(input, shear, slabDetailing) {
  if (input.memberType === "slab") {
    return `AS3600 slab strip: main bars per metre, secondary ${slabDetailing.provided.text}, max spacing ${slabDetailing.spacingLimit.toFixed(0)} mm; ${shear.text}`;
  }
  const mins = beamMinimums(input);
  return `AS3600 beam: longitudinal bars plus fitments; nominal top >= ${mins.nominalTop.toFixed(0)} mm2; ${shear.text}`;
}

function momentCapacity(input, As, face = "bottom") {
  const a2 = alpha2(input.fc);
  const tension = Math.max(0, As) * input.fsy;
  const compressionFace = face === "top" ? "bottom" : "top";
  const maxBlock = Math.max(input.D, 1);
  let lo = 0;
  let hi = maxBlock;
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2;
    const block = compressionBlock(input, compressionFace, mid);
    const capacity = a2 * input.fc * block.area;
    if (capacity >= tension) hi = mid;
    else lo = mid;
  }
  const block = compressionBlock(input, compressionFace, hi);
  const compressionCentroid = block.centroidFromFace;
  const dFace = effectiveDepthForFace(input, face);
  const z = dFace - compressionCentroid;
  if (z <= 0 || block.area <= 0) return 0;
  const balancedCompression = Math.min(tension, a2 * input.fc * block.area);
  return (balancedCompression * z) / 1e6;
}

function compressionBlock(input, compressionFace, depth) {
  const d = clamp(depth, 0, input.D);
  const from = compressionFace === "top" ? 0 : input.D - d;
  const to = compressionFace === "top" ? d : input.D;
  const pieces = sectionRectangles(input)
    .map((rect) => {
      const y1 = Math.max(rect.y, from);
      const y2 = Math.min(rect.y + rect.h, to);
      const h = Math.max(0, y2 - y1);
      const area = rect.b * h;
      const yGlobal = y1 + h / 2;
      const centroidFromFace = compressionFace === "top" ? yGlobal : input.D - yGlobal;
      return { area, centroidFromFace };
    })
    .filter((piece) => piece.area > 0);
  const area = pieces.reduce((sum, piece) => sum + piece.area, 0);
  const centroidFromFace = pieces.reduce((sum, piece) => sum + piece.area * piece.centroidFromFace, 0) / Math.max(area, 1);
  return { area, centroidFromFace };
}

function chooseReo(input, asReq, face = "bottom") {
  if (input.memberType === "slab") {
    return chooseSlabReo(input, asReq, face);
  }

  const scheduled = scheduledReoForFace(input, face);
  if (scheduled.as > 0) return scheduled;

  let best = null;
  designBarsForFace(input, face).forEach((dia) => {
    const area = barArea(dia);
    for (let n = 2; n <= 12 * input.layers; n++) {
      const as = n * area;
      if (as >= asReq && (!best || as < best.as)) best = { text: `${n}N${dia}`, as, dia, count: n };
    }
  });
  return best || { text: "Increase section or bars", as: 0 };
}

function chooseSlabReo(input, asReq, face = "bottom") {
  const scheduled = scheduledReoForFace(input, face);
  if (scheduled.as > 0) return scheduled;

  let best = null;
  const barsPerM = faceBarsPerMetre(input, face);
  if (barsPerM > 0) {
    const spacing = 1000 / barsPerM;
    designBarsForFace(input, face).forEach((dia) => {
      const as = barsPerM * barArea(dia);
      const option = { text: `${formatBarsPerM(barsPerM)}N${dia}/m (${spacing.toFixed(0)} mm ctrs)`, as, dia, spacing, countPerM: barsPerM, fixed: true };
      if (as >= asReq && (!best || as < best.as)) best = option;
      if (!best || (best.as < asReq && as > best.as)) best = option;
    });
    return best || { text: "Increase bars per metre or bar size", as: 0 };
  }
  const maxSpacing = slabSpacingLimit(input);
  designBarsForFace(input, face).forEach((dia) => {
    const area = barArea(dia);
    for (let spacing = 75; spacing <= maxSpacing; spacing += 5) {
      const as = (1000 / spacing) * area;
      if (as >= asReq && (!best || as < best.as)) {
        best = { text: `N${dia} @ ${spacing} mm`, as, dia, spacing };
      }
    }
  });
  return best || { text: "Increase slab depth or bars", as: 0 };
}

function designBarsForFace(input, face) {
  const selected = face === "top" ? input.topBars : input.bottomBars;
  return selected?.length ? selected : input.bars || [];
}

function faceBarsPerMetre(input, face) {
  return face === "top" ? Number(input.topBarsPerM || 0) : Number(input.bottomBarsPerM || 0);
}

function rebarLayersForFace(input, face) {
  const layers = input.rebarSchedule?.[face] || (face === "top" ? input.topRebarLayers : input.bottomRebarLayers) || [];
  return layers
    .map((layer, i) => ({
      layer: i + 1,
      dia: Number(layer.dia),
      count: normaliseRebarLayerCount(Number(layer.count), input.memberType),
    }))
    .filter((layer) => standardRebarSizes().includes(layer.dia) && layer.count > 0);
}

function scheduledReoForFace(input, face) {
  const memberType = input.memberType || $("memberType")?.value || defaults.memberType;
  const layers = rebarLayersForFace(input, face);
  const as = layers.reduce((sum, layer) => sum + layer.count * barArea(layer.dia), 0);
  const totalCount = layers.reduce((sum, layer) => sum + layer.count, 0);
  const largest = layers.reduce((max, layer) => Math.max(max, layer.dia), 0);
  const spacing = memberType === "beam" || totalCount <= 0 ? null : 1000 / totalCount;
  return {
    text: formatRebarLayerSchedule({ ...input, memberType }, face, layers),
    as,
    dia: largest || input.barDia || 16,
    count: totalCount,
    countPerM: memberType === "beam" ? null : totalCount,
    spacing,
    layers,
    fixed: true,
  };
}

function formatRebarLayerSchedule(input, face, layers = rebarLayersForFace(input, face)) {
  if (!layers.length) return "No bars entered";
  if (input.memberType === "beam") {
    return layers.map((layer) => `L${layer.layer} ${formatBarsPerM(layer.count)}N${layer.dia}`).join(" + ");
  }
  return layers.map((layer) => `L${layer.layer} ${formatBarsPerM(layer.count)}N${layer.dia}/m`).join(" + ");
}

function faceLayerCountTotal(layers, memberType) {
  const total = (layers || []).reduce((sum, layer) => sum + normaliseRebarLayerCount(Number(layer.count), memberType), 0);
  return memberType === "beam" ? Math.round(total) : Math.round(total * 2) / 2;
}

function formatBarsPerM(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function barArea(dia) {
  return (Math.PI * dia * dia) / 4;
}

function roundDownTo(value, step) {
  return Math.max(step, Math.floor(value / step) * step);
}

function roundUpTo(value, step) {
  return Math.max(step, Math.ceil(value / step) * step);
}

function renderSummary() {
  if (state.result.mode === "twoWay") {
    const { input, twoWay } = state.result;
    const maxFlex = Math.max(...twoWay.strips.map((row) => row.util));
    const maxSupportShear = Math.max(...twoWay.supportShear.map((row) => row.util));
    const analysisName = sectionAnalysisShortLabel(input);
    $("summary").innerHTML = [
      ["Panel", `${input.panelX.toFixed(1)} x ${input.panelY.toFixed(1)} m`],
      [`Short ${analysisName} deflection`, `${(twoWay.shortPlate.maxDeflectionM * 1000).toFixed(1)} mm`],
      [`Long ${analysisName} deflection`, `${(twoWay.longPlate.maxDeflectionM * 1000).toFixed(1)} mm`],
      ["Column/slab fixity", `${input.columnFixity.toFixed(0)}%`],
      ["Post-tensioning", ptSummaryText(input)],
      ["Max flexure util.", `${(maxFlex * 100).toFixed(0)}%`],
      ["Max support shear", `${(maxSupportShear * 100).toFixed(0)}%`],
    ]
      .map(([label, value]) => `<div class="metric"><span>${label}</span><b>${value}</b></div>`)
      .join("");
    return;
  }
  const { input, strengthCombo, ultimate, deflection } = state.result;
  $("summary").innerHTML = [
    ["Total length", `${ultimate.totalLength.toFixed(2)} m`],
    [`Max Mu* (${strengthCombo.name})`, `${Math.abs(ultimate.maxMoment.value).toFixed(1)} kNm`],
    [`Short ${sectionAnalysisShortLabel(input)} defl.`, `${(Math.abs(deflection.shortMax.value) * 1000).toFixed(1)} mm`],
    [`Long ${sectionAnalysisShortLabel(input)} defl.`, `${(Math.abs(deflection.longMax.value) * 1000).toFixed(1)} mm`],
    ["Avg support fixity", `${averageSupportFixity(input).toFixed(0)}%`],
    ["Post-tensioning", ptSummaryText(input)],
    ["FE mesh", `${ultimate.elementCount} elements`],
  ]
    .map(([label, value]) => `<div class="metric"><span>${label}</span><b>${value}</b></div>`)
    .join("");
}

function renderDeflectionSummary() {
  const target = $("deflectionSummary");
  if (!target || !state.result) return;
  if (state.result.mode === "twoWay") {
    const { input, twoWay } = state.result;
    const allowable = (Math.min(input.panelX, input.panelY) * 1000) / input.deflectionRatio;
    target.innerHTML = [
      ["Service section analysis", sectionAnalysisLabel(input)],
      [`Short-term ${sectionAnalysisShortLabel(input)} plate`, `${(twoWay.shortPlate.maxDeflectionM * 1000).toFixed(2)} mm`],
      [`Long-term ${sectionAnalysisShortLabel(input)} plate`, `${(twoWay.longPlate.maxDeflectionM * 1000).toFixed(2)} mm`],
      ["Allowable deflection", `L/${input.deflectionRatio} = ${allowable.toFixed(1)} mm`],
      ["Service stiffness factor", `${(twoWay.shortPlate.stiffnessModifier * 100).toFixed(0)}% gross`],
      ["Column restraint modifier", `${twoWay.shortPlate.restraintModifier.toFixed(2)}x`],
      ["Long-term factor", `${longTermDeflectionMultiplier(input).toFixed(2)}x sustained load`],
      ["Section geometry", sectionShapeLabel(input)],
    ]
      .map(([label, value]) => `<div class="metric"><span>${label}</span><b>${value}</b></div>`)
      .join("");
    return;
  }
  const { input, deflection, serviceEnvelope } = state.result;
  const governingSpan = input.spans.reduce((best, span) => (span.length > best.length ? span : best), input.spans[0]);
  const avgModifier = serviceEnvelope.elements.reduce((sum, element) => sum + (element.stiffnessModifier || 1), 0) / Math.max(serviceEnvelope.elements.length, 1);
  const lowPoints = spanDeflectionLowPoints(input, deflection);
  target.innerHTML = [
    ["Service section analysis", sectionAnalysisLabel(input)],
    [`Short-term ${sectionAnalysisShortLabel(input)} FE`, `${(Math.abs(deflection.shortMax.value) * 1000).toFixed(2)} mm`],
    [`Long-term ${sectionAnalysisShortLabel(input)} FE`, `${(Math.abs(deflection.longMax.value) * 1000).toFixed(2)} mm`],
    ["Allowable deflection", `L/${input.deflectionRatio} = ${((governingSpan.length * 1000) / input.deflectionRatio).toFixed(1)} mm`],
    ["Average service stiffness", `${(avgModifier * 100).toFixed(0)}% gross EI`],
    ["Long-term factor", `${longTermDeflectionMultiplier(input).toFixed(2)}x sustained load`],
    ["Span systems", input.spans.map((span, i) => `S${i + 1} ${spanSystemLabel(span.system)}`).join("; ")],
    ["Support condition", formatSupportFixities(input)],
    ["Frame mesh", `${state.result.analysisModel.nodeCount} nodes, ${state.result.analysisModel.elementCount} elements`],
    ...lowPoints.map((point) => [`Span ${point.span} low point`, `${point.longMm.toFixed(2)} mm at x=${point.x.toFixed(2)} m`]),
  ]
    .map(([label, value]) => `<div class="metric"><span>${label}</span><b>${value}</b></div>`)
    .join("");
}

function renderStatus() {
  const { status } = state.result;
  const banner = $("designStatus");
  const cls = status.ok ? (status.warnings.length ? "review" : "pass") : "fail";
  const detail = status.ok
    ? `${status.warnings[0] ? `${status.warnings[0]}. ` : ""}AS 3600 engineering review still required for ${status.reviewItems.join(", ")}.`
    : status.failures.slice(0, 3).join("; ");
  banner.className = `status-banner ${cls}`;
  banner.innerHTML = `
    <div class="status-mark">${status.label}</div>
    <div class="status-copy">
      <b>${status.headline}</b>
      <span>${detail}</span>
    </div>
  `;
}

function renderWorkflowTree() {
  const target = $("workflowTree");
  if (!target || !state.result) return;
  const { input, status } = state.result;
  const isTwoWay = state.result.mode === "twoWay";
  const shearLabel = isTwoWay ? "Two-way support shear" : input.memberType === "beam" ? "Beam shear fitments" : "One-way slab shear";
  const nodes = [
    ["Input", null, "title"],
    ["General data", "model", "done"],
    [isTwoWay ? "Panel and column geometry" : "Span geometry", "model", "done"],
    ["Load cases", "loads", "done"],
    ["Load combinations", "loads", "done"],
    ["Design envelopes", "envelopes", "done"],
    ["Design data", "design", "done"],
    ["Reinforcement data", "design", "done"],
    ["Output", null, "title"],
    ["Messages and warnings", "messages", status.ok ? (status.warnings.length ? "review" : "done") : "fail"],
    ["Frame / section graphics", "model", "done"],
    ["Load graphics", "loads", "done"],
    ["Envelope graphics", "envelopes", "done"],
    ["Moment and shear envelopes", "actions", "done"],
    ["Flexural design", "design", designTreeStatus()],
    [shearLabel, "design", designTreeStatus()],
    ["Deflections", "limits", status.failures.some((item) => /deflection/i.test(item)) ? "fail" : "done"],
    ["Detailed reinforcement layout", "design", "done"],
    ["Report", "report", "done"],
  ];
  target.innerHTML = nodes
    .map(([label, view, stateClass]) => (stateClass === "title" ? `<div class="tree-title">${label}</div>` : `<button class="tree-item ${stateClass}" type="button" data-tree-view="${view}">${label}</button>`))
    .join("");
  target.querySelectorAll("[data-tree-view]").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.treeView)));
}

function designTreeStatus() {
  const { status } = state.result;
  if (!status.ok) return "fail";
  return status.warnings.length ? "review" : "done";
}

function renderMessages() {
  const target = $("messageWindow");
  if (!target || !state.result) return;
  const messages = buildMessages();
  target.innerHTML = messages
    .map((message) => `<div class="message-row ${message.type}"><b>${message.type}</b><span>${message.text}</span></div>`)
    .join("");
}

function buildMessages() {
  const { input, status } = state.result;
  const messages = [];
  state.validation.errors.forEach((issue) => messages.push({ type: "fail", text: issue.message }));
  state.validation.warnings.forEach((issue) => messages.push({ type: "warn", text: issue.message }));
  messages.push({ type: status.ok ? "info" : "fail", text: status.headline });
  status.failures.forEach((text) => messages.push({ type: "fail", text }));
  status.warnings.forEach((text) => messages.push({ type: "warn", text }));
  if (state.result.mode === "twoWay") {
    const { twoWay } = state.result;
    messages.push({ type: "info", text: `Run sequence: rebuilt ${state.result.analysisModel.nodeCount}-node plate grid, then calculated all load-combination envelopes, then produced final status ${status.label}.` });
    messages.push({ type: "info", text: `Equivalent frame/design-strip model: ${input.panelX} m x ${input.panelY} m panel, column strip ${input.columnStripPercent}%, column/slab fixity ${input.columnFixity.toFixed(0)}%, ${input.plateGrid} x ${input.plateGrid} ${sectionAnalysisShortLabel(input)} plate deflection grid.` });
    messages.push({ type: "info", text: `Section geometry: ${sectionShapeLabel(input)}, Ag=${input.Agross.toFixed(0)} mm2, Ig=${input.Igross.toExponential(3)} mm4; reinforcement is included in transformed service stiffness.` });
    if (input.ptEnabled) messages.push({ type: "info", text: `Post-tensioning: ${ptSummaryText(input)} using editable high/low tendon points.` });
    messages.push({ type: "info", text: `Short-term deflection ${(twoWay.shortPlate.maxDeflectionM * 1000).toFixed(2)} mm; long-term deflection ${(twoWay.longPlate.maxDeflectionM * 1000).toFixed(2)} mm using creep ${input.creepFactor.toFixed(2)}, shrinkage ${input.shrinkageStrain.toFixed(0)} microstrain and temperature ${input.temperatureDelta.toFixed(0)} deg C.` });
  } else {
    const { ultimate, deflection } = state.result;
    const caseCount = state.result.combinationResults.reduce((sum, item) => sum + (item.analysis.cases?.length || 1), 0);
    messages.push({ type: "info", text: `Run sequence: rebuilt ${state.result.analysisModel.nodeCount}-node / ${state.result.analysisModel.elementCount}-element frame mesh from the current spans, then solved ${caseCount} envelope cases, then produced final status ${status.label}.` });
    messages.push({ type: "info", text: `${input.spans.length} span FE strip model with ${ultimate.elementCount} elements, support rotational springs from ${formatSupportFixities(input)}, ${sectionAnalysisLabel(input)} service stiffness and all-combination design envelopes.` });
    messages.push({ type: "info", text: `Section geometry: ${sectionShapeLabel(input)}, Ag=${input.Agross.toFixed(0)} mm2, Ig=${input.Igross.toExponential(3)} mm4; changing top/bottom reinforcement changes transformed service stiffness.` });
    spanDeflectionLowPoints(input, deflection).forEach((point) => messages.push({ type: point.longMm <= point.limitMm ? "info" : "fail", text: `Span ${point.span} deflection low point: ${point.longMm.toFixed(2)} mm downward at x=${point.x.toFixed(2)} m; limit ${point.limitMm.toFixed(1)} mm.` }));
    if (input.ptEnabled) messages.push({ type: "info", text: `Post-tensioning: ${ptSummaryText(input)}; equivalent upward loads are included before envelope analysis.` });
    messages.push({ type: "info", text: `Strength design envelopes include ${state.result.designEnvelope.cases.length} ULS cases/patterns and ${designPointStations(input).length} design stations. Each station stores moment-controlled envelopes with co-existing shear and shear-controlled envelopes with co-existing moment.` });
    messages.push({ type: "info", text: `Short-term deflection ${(Math.abs(deflection.shortMax.value) * 1000).toFixed(2)} mm; long-term deflection ${(Math.abs(deflection.longMax.value) * 1000).toFixed(2)} mm using creep ${input.creepFactor.toFixed(2)}, shrinkage ${input.shrinkageStrain.toFixed(0)} microstrain and temperature ${input.temperatureDelta.toFixed(0)} deg C.` });
    if (input.memberType === "beam") {
      const worst = governingDesignRow(state.result.design);
      messages.push({ type: worst.shear.ok ? "info" : "fail", text: `Beam shear design: ${worst.shear.provided}, Vu* ${worst.shear.demand.toFixed(1)} kN, phiVu ${worst.shear.phiVu.toFixed(1)} kN.` });
    }
  }
  messages.push({ type: "warn", text: `Default imposed-action factors use psi_s=${DEFAULT_PSI_SHORT} and psi_l=${DEFAULT_PSI_LONG}; set the project-specific AS/NZS 1170 occupancy factors before final design.` });
  messages.push({ type: "warn", text: `Engineering verification still required for ${status.reviewItems.join(", ")}.` });
  (state.aiRecommendations || []).forEach((item) => messages.push({ type: item.type === "fail" ? "fail" : item.type === "ok" ? "info" : "warn", text: `AI: ${item.title} - ${item.text}` }));
  return messages;
}

function renderTree() {
  const { input, strengthCombo, serviceCombo, status } = state.result;
  if (state.result.mode === "twoWay") {
    $("resultTree").innerHTML = `
      <div class="tree-title">Two-way slab</div>
      <button class="tree-item active" type="button">Panel ${input.panelX} x ${input.panelY} m</button>
      <button class="tree-item" type="button">Equivalent frame strips</button>
      <button class="tree-item" type="button">Column strip + middle strip</button>
      <button class="tree-item" type="button">Column fixity: ${input.columnFixity.toFixed(0)}%</button>
      <button class="tree-item" type="button">Plate grid: ${input.plateGrid} x ${input.plateGrid}</button>
      <button class="tree-item" type="button">Support shear: AS / ACI / EC</button>
      <div class="tree-title">Results</div>
      <button class="tree-item" type="button">Strength: ${strengthCombo.name}</button>
      <button class="tree-item" type="button">Deflection: ${serviceCombo.name}</button>
      <button class="tree-item" type="button">Design envelopes: all combinations</button>
      <button class="tree-item" type="button">Status: ${status.label}</button>
    `;
    return;
  }
  $("resultTree").innerHTML = `
    <div class="tree-title">Input data</div>
    <button class="tree-item active" type="button">General data</button>
    <button class="tree-item" type="button">Spans: ${input.spans.length}</button>
    <button class="tree-item" type="button">FE mesh: ${input.elementsPerSpan}/span</button>
    <button class="tree-item" type="button">Supports: ${state.result.analysisModel.supportCount}, ${averageSupportFixity(input).toFixed(0)}% avg fixity</button>
    <button class="tree-item" type="button">Span systems: ${input.spans.map((span) => spanSystemLabel(span.system)).join(", ")}</button>
    <button class="tree-item" type="button">Load cases: SW, G, Q</button>
    <button class="tree-item" type="button">Combinations: ${input.combinations.length}</button>
    <button class="tree-item" type="button">${input.memberType === "slab" ? "AS3600 slab strip rules" : "AS3600 beam + fitments"}</button>
    <div class="tree-title">Results</div>
    <button class="tree-item" type="button">Strength: ${strengthCombo.name}</button>
    <button class="tree-item" type="button">Service: ${serviceCombo.name}</button>
    <button class="tree-item" type="button">Design envelopes: all ULS/service cases</button>
    <button class="tree-item" type="button">Status: ${status.label}</button>
    <button class="tree-item" type="button">Reinforcement zones</button>
    <button class="tree-item" type="button">Report</button>
  `;
}

function renderLoads() {
  if (state.result.mode === "twoWay") {
    $("loadRows").innerHTML = state.result.combinationResults
      .map(({ combo, analysis }) => {
        const formula = `${combo.sw.toFixed(2)}SW + ${combo.g.toFixed(2)}G + ${combo.q.toFixed(2)}Q`;
        return `
          <tr>
            <td>${combo.name}</td>
            <td>${combo.type}</td>
            <td>${formula}</td>
            <td>${Math.abs(analysis.maxMoment.value).toFixed(1)} kNm/m</td>
            <td>${(analysis.maxShear.value * 100).toFixed(0)}% support shear</td>
            <td>${(Math.abs(analysis.maxDefl.value) * 1000).toFixed(1)} mm</td>
          </tr>`;
      })
      .join("");
    return;
  }
  $("loadRows").innerHTML = state.result.combinationResults
    .map(({ combo, analysis }) => {
      const formula = `${combo.sw.toFixed(2)}SW + ${combo.g.toFixed(2)}G + ${combo.q.toFixed(2)}Q${combo.pattern ? " with live pattern envelope" : ""}`;
      return `
        <tr>
          <td>${combo.name}</td>
          <td>${combo.type}</td>
          <td>${formula}</td>
          <td>${Math.abs(analysis.maxMoment.value).toFixed(1)} kNm</td>
          <td>${Math.abs(analysis.maxShear.value).toFixed(1)} kN</td>
          <td>${(Math.abs(analysis.maxDefl.value) * 1000).toFixed(1)} mm</td>
        </tr>`;
    })
    .join("");
}

function renderEnvelopes() {
  const target = $("envelopeRows");
  if (!target || !state.result) return;
  const rows = state.result.envelopeRows || [];
  target.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.name}</td>
          <td>${row.location}</td>
          <td>${row.value}</td>
          <td>${row.caseName}</td>
          <td>${row.use}</td>
        </tr>`
    )
    .join("");
}

function renderDesign() {
  if (state.result.mode === "twoWay") {
    $("designRows").innerHTML = state.result.design
      .map((row) => {
        const cls = row.util <= 1 ? "ok" : row.util <= 1.08 ? "warn" : "bad";
        const checkText = row.kind === "supportShear" ? row.check : `${row.check}; long-term defl ${row.deflection.toFixed(1)} / ${row.limit.toFixed(1)} mm`;
        return `
          <tr>
            <td>${row.zone}</td>
            <td>${row.location}</td>
            <td>${row.Mu.toFixed(1)} ${row.kind === "supportShear" ? "kN" : "kNm/m"}</td>
            <td>${row.phiMu.toFixed(1)} ${row.kind === "supportShear" ? "kN" : "kNm/m"}</td>
            <td>${row.asReq ? row.asReq.toFixed(0) : "-"}</td>
            <td>${row.provided.text}</td>
            <td><span class="pill ${cls}">${(row.util * 100).toFixed(0)}%</span></td>
            <td>${checkText}</td>
          </tr>`;
      })
      .join("");
    return;
  }
  $("designRows").innerHTML = state.result.design
    .map((row) => {
      const cls = row.util <= 1 && row.deflectionOk && (!row.shear || row.shear.ok) ? "ok" : row.util <= 1.08 && (!row.shear || row.shear.ok) ? "warn" : "bad";
      const deflText = row.zone.startsWith("Support") ? "-" : `long-term defl ${row.deflection.toFixed(1)} / L/${state.result.input.deflectionRatio} (${row.limit.toFixed(1)})`;
      const shearText = row.shear ? `${row.shear.provided}; ${row.shear.text}` : "";
      const slabText = row.slabDetailing ? `Secondary/distribution ${row.slabDetailing.provided.text} (${row.slabDetailing.provided.as.toFixed(0)} mm2/m)` : "";
      const checkText = [deflText, shearText, slabText, row.check].filter(Boolean).join("<br>");
      return `
        <tr>
          <td>${row.zone}</td>
          <td>${row.location}</td>
          <td>${row.Mu.toFixed(1)} kNm</td>
          <td>${row.phiMu.toFixed(1)} kNm</td>
          <td>${row.asReq.toFixed(0)} mm2</td>
          <td>${row.provided.text}<br>${row.provided.as.toFixed(0)} mm2</td>
          <td><span class="pill ${cls}">${(row.util * 100).toFixed(0)}%</span></td>
          <td>${checkText}</td>
        </tr>`;
    })
    .join("");
}

function drawSectionDiagram() {
  drawResultSectionDiagramOnCanvas($("sectionCanvas"));
  drawInputSectionPreview();
}

function drawResultSectionDiagramOnCanvas(canvas) {
  if (!canvas || !state.result) return;
  const ctx = canvas.getContext("2d");
  clear(ctx, canvas);

  if (state.result.mode === "twoWay") {
    drawTwoWaySection(ctx, canvas);
    return;
  }

  if (state.result.input.memberType === "beam") drawBeamSection(ctx, canvas);
  else drawSlabSection(ctx, canvas, state.result.input, governingDesignRow(state.result.design), "One-way slab strip reinforcement");
}

function drawInputSectionPreview() {
  const canvas = $("inputSectionCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  clear(ctx, canvas);
  const input = currentSectionPreviewInput();
  if (input.memberType === "beam") {
    drawBeamInputSection(ctx, canvas, input);
  } else {
    const title = input.memberType === "twoWay" ? "Two-way slab design strip reinforcement input" : "One-way slab strip reinforcement input";
    drawSlabInputSection(ctx, canvas, input, title);
  }
}

function currentSectionPreviewInput() {
  const memberType = $("memberType")?.value || defaults.memberType;
  captureRebarScheduleFromControls(memberType);
  const rebarSchedule = {
    top: resizeRebarLayers(state.rebarSchedule.top || [], currentLayerCount(), memberType, "top"),
    bottom: resizeRebarLayers(state.rebarSchedule.bottom || [], currentLayerCount(), memberType, "bottom"),
  };
  const selectedBars = uniqueNumbers([...rebarSchedule.top, ...rebarSchedule.bottom].map((layer) => layer.dia));
  const b = memberType === "beam" ? Number($("width")?.value || defaults.width) : 1000;
  const D = Number($("depth")?.value || defaults.depth);
  const cover = Number($("cover")?.value || defaults.cover);
  const barDia = Math.max(Number($("barDia")?.value || defaults.barDia), ...selectedBars);
  const input = {
    memberType,
    b,
    D,
    cover,
    barDia,
    sectionShape: normaliseSectionShape($("sectionShape")?.value),
    flangeWidth: Number($("flangeWidth")?.value || defaults.flangeWidth),
    flangeThickness: Number($("flangeThickness")?.value || defaults.flangeThickness),
    sectionAreaFactor: Number($("sectionAreaFactor")?.value || defaults.sectionAreaFactor),
    sectionInertiaFactor: Number($("sectionInertiaFactor")?.value || defaults.sectionInertiaFactor),
    rebarSchedule,
    topRebarLayers: rebarSchedule.top,
    bottomRebarLayers: rebarSchedule.bottom,
  };
  input.sectionProperties = sectionProperties(input);
  input.Igross = input.sectionProperties.inertia;
  return input;
}

function governingDesignRow(rows) {
  return rows.reduce((best, row) => {
    const rowScore = Math.max(row.util || 0, row.shear ? row.shear.demand / Math.max(row.shear.phiVu, 1e-9) : 0);
    const bestScore = Math.max(best.util || 0, best.shear ? best.shear.demand / Math.max(best.shear.phiVu, 1e-9) : 0);
    return rowScore > bestScore ? row : best;
  }, rows[0]);
}

function drawBeamInputSection(ctx, canvas, input) {
  const m = sectionCanvasMetrics(input, 430, 285, 145, 78);
  const top = 78;

  ctx.fillStyle = "#17211d";
  ctx.font = "18px system-ui";
  ctx.fillText("Beam reinforcement input preview", 36, 36);
  ctx.font = "13px system-ui";
  ctx.fillStyle = "#60706a";
  ctx.fillText("This preview is drawn directly from the top and bottom layer inputs.", 36, 58);

  drawConcreteSectionShape(ctx, m, input);
  drawStirrupLoop(ctx, m.webLeft, top, m.webW, m.h, input.cover * m.scale, Math.max(3, 10 * m.scale));
  drawBeamLayerSchedule(ctx, m.webLeft, top, m.webW, m.h, input, "top", "#126b63", false, true);
  drawBeamLayerSchedule(ctx, m.webLeft, top, m.webW, m.h, input, "bottom", "#126b63", false, true);
  drawDimension(ctx, m.shapeLeft, top + m.h + 34, m.shapeLeft + m.totalW, top + m.h + 34, `${sectionOverallWidth(input)} mm overall`);
  drawDimension(ctx, m.shapeLeft + m.totalW + 42, top, m.shapeLeft + m.totalW + 42, top + m.h, `${input.D} mm`, true);

  drawSectionNotes(ctx, 650, 94, [
    ["Section", sectionShapeLabel(input)],
    ["Top input", formatRebarLayerSchedule(input, "top")],
    ["Bottom input", formatRebarLayerSchedule(input, "bottom")],
    ["Top As", `${scheduledReoForFace(input, "top").as.toFixed(0)} mm2`],
    ["Bottom As", `${scheduledReoForFace(input, "bottom").as.toFixed(0)} mm2`],
    ["Layer count", `${currentLayerCount()} per face`],
  ]);
}

function drawSlabInputSection(ctx, canvas, input, title) {
  const slabInput = { ...input, b: 1000 };
  const m = sectionCanvasMetrics(slabInput, 660, 170, 78, 120);
  const top = 120;

  ctx.fillStyle = "#17211d";
  ctx.font = "18px system-ui";
  ctx.fillText(title, 36, 38);
  ctx.font = "13px system-ui";
  ctx.fillStyle = "#60706a";
  ctx.fillText("This 1000 mm strip preview is drawn directly from the per-metre layer inputs.", 36, 60);

  drawConcreteSectionShape(ctx, m, slabInput);
  drawSlabLayerSchedule(ctx, m.webLeft, top, m.webW, m.h, slabInput, "top", "#126b63", false, true);
  drawSlabLayerSchedule(ctx, m.webLeft, top, m.webW, m.h, slabInput, "bottom", "#126b63", false, true);
  drawDimension(ctx, m.shapeLeft, top + m.h + 34, m.shapeLeft + m.totalW, top + m.h + 34, `${sectionOverallWidth(slabInput)} mm strip`);
  drawDimension(ctx, m.shapeLeft + m.totalW + 42, top, m.shapeLeft + m.totalW + 42, top + m.h, `${input.D} mm`, true);

  drawSectionNotes(ctx, 790, 105, [
    ["Section", sectionShapeLabel(slabInput)],
    ["Top input", formatRebarLayerSchedule(input, "top")],
    ["Bottom input", formatRebarLayerSchedule(input, "bottom")],
    ["Top As", `${scheduledReoForFace(input, "top").as.toFixed(0)} mm2/m`],
    ["Bottom As", `${scheduledReoForFace(input, "bottom").as.toFixed(0)} mm2/m`],
    ["Layer count", `${currentLayerCount()} per face`],
  ]);
}

function drawBeamSection(ctx, canvas) {
  const { input, design } = state.result;
  const row = governingDesignRow(design);
  const m = sectionCanvasMetrics(input, 430, 285, 145, 78);
  const top = 78;
  const stirrup = row.shear.stirrup;
  const tensileFace = row.location === "negative" ? "top" : "bottom";

  ctx.fillStyle = "#17211d";
  ctx.font = "18px system-ui";
  ctx.fillText(`Beam section reinforcement - governing ${row.zone} (${row.location})`, 36, 36);
  ctx.font = "13px system-ui";
  ctx.fillStyle = "#60706a";
  ctx.fillText("Closed ligature drawn inside cover; top and bottom bars are drawn from the input layer schedule.", 36, 58);

  drawConcreteSectionShape(ctx, m, input);
  drawStirrupLoop(ctx, m.webLeft, top, m.webW, m.h, input.cover * m.scale, stirrup.dia * m.scale);
  drawBeamLayerSchedule(ctx, m.webLeft, top, m.webW, m.h, input, "top", tensileFace === "top" ? "#126b63" : "#60706a", tensileFace !== "top");
  drawBeamLayerSchedule(ctx, m.webLeft, top, m.webW, m.h, input, "bottom", tensileFace === "bottom" ? "#126b63" : "#60706a", tensileFace !== "bottom");
  drawDimension(ctx, m.shapeLeft, top + m.h + 34, m.shapeLeft + m.totalW, top + m.h + 34, `${sectionOverallWidth(input)} mm overall`);
  drawDimension(ctx, m.shapeLeft + m.totalW + 42, top, m.shapeLeft + m.totalW + 42, top + m.h, `${input.D} mm`, true);

  const panelX = 650;
  drawSectionNotes(ctx, panelX, 94, [
    ["Section", sectionShapeLabel(input)],
    ["Main tension steel", row.provided.text],
    ["Top layers", formatRebarLayerSchedule(input, "top")],
    ["Bottom layers", formatRebarLayerSchedule(input, "bottom")],
    ["Top / bottom As", `${scheduledReoForFace(input, "top").as.toFixed(0)} / ${scheduledReoForFace(input, "bottom").as.toFixed(0)} mm2`],
    ["Stirrups / ligs", stirrup.text],
    ["Asv per metre", `${stirrup.steelPerM.toFixed(0)} mm2/m`],
    ["Vu* / phiVu", `${row.shear.demand.toFixed(1)} / ${row.shear.phiVu.toFixed(1)} kN`],
    ["Mu* / phiMu", `${row.Mu.toFixed(1)} / ${row.phiMu.toFixed(1)} kNm`],
  ]);
}

function drawTwoWaySection(ctx, canvas) {
  const { input, twoWay } = state.result;
  const row = governingDesignRow(twoWay.strips);
  drawSlabSection(ctx, canvas, { ...input, b: 1000 }, row, `Two-way slab strip reinforcement - ${row.zone} ${row.location}`);
}

function drawSlabSection(ctx, canvas, input, row, title) {
  const slabInput = { ...input, b: 1000 };
  const m = sectionCanvasMetrics(slabInput, 660, 170, 78, 120);
  const top = 120;
  const face = row.location === "negative" ? "top" : "bottom";
  const secondary = row.slabDetailing?.provided;

  ctx.fillStyle = "#17211d";
  ctx.font = "18px system-ui";
  ctx.fillText(title, 36, 38);
  ctx.font = "13px system-ui";
  ctx.fillStyle = "#60706a";
  ctx.fillText("Section is drawn as a 1000 mm design strip; top and bottom bars come from the input layer schedule.", 36, 60);

  drawConcreteSectionShape(ctx, m, slabInput);
  drawSlabLayerSchedule(ctx, m.webLeft, top, m.webW, m.h, slabInput, "top", face === "top" ? "#126b63" : "#60706a", face !== "top");
  drawSlabLayerSchedule(ctx, m.webLeft, top, m.webW, m.h, slabInput, "bottom", face === "bottom" ? "#126b63" : "#60706a", face !== "bottom");
  if (secondary) drawDistributionBars(ctx, m.webLeft, top, m.webW, m.h, slabInput, secondary, face === "top" ? "bottom" : "top");
  drawDimension(ctx, m.shapeLeft, top + m.h + 34, m.shapeLeft + m.totalW, top + m.h + 34, `${sectionOverallWidth(slabInput)} mm strip`);
  drawDimension(ctx, m.shapeLeft + m.totalW + 42, top, m.shapeLeft + m.totalW + 42, top + m.h, `${input.D} mm`, true);

  drawSectionNotes(ctx, 790, 105, [
    ["Section", sectionShapeLabel(input)],
    ["Main reinforcement", row.provided.text],
    ["Top layers", formatRebarLayerSchedule(input, "top")],
    ["Bottom layers", formatRebarLayerSchedule(input, "bottom")],
    ["Top / bottom As", `${scheduledReoForFace(input, "top").as.toFixed(0)} / ${scheduledReoForFace(input, "bottom").as.toFixed(0)} mm2/m`],
    ["Secondary/distribution", secondary ? secondary.text : "Use project slab distribution steel"],
    ["Spacing cap", `${slabSpacingLimit(input).toFixed(0)} mm`],
    ["One-way shear", row.shear ? row.shear.text : "not shown for two-way strip"],
    ["Mu* / phiMu", `${row.Mu.toFixed(1)} / ${row.phiMu.toFixed(1)} ${state.result.mode === "twoWay" ? "kNm/m" : "kNm"}`],
  ]);
}

function sectionCanvasMetrics(input, maxWidth, maxHeight, shapeLeft, top) {
  const overall = sectionOverallWidth(input);
  const scale = Math.min(maxWidth / Math.max(overall, 1), maxHeight / Math.max(input.D, 1));
  const totalW = overall * scale;
  const webW = input.b * scale;
  const h = input.D * scale;
  return {
    scale,
    shapeLeft,
    top,
    totalW,
    webW,
    h,
    webLeft: shapeLeft + (totalW - webW) / 2,
  };
}

function drawConcreteSectionShape(ctx, metrics, input) {
  const shape = normaliseSectionShape(input.sectionShape);
  if (shape === "tTop" || shape === "tBottom") {
    const tf = clamp(input.flangeThickness || 0, 0, input.D) * metrics.scale;
    const flangeY = shape === "tTop" ? metrics.top : metrics.top + metrics.h - tf;
    ctx.fillStyle = "#f8faf8";
    ctx.strokeStyle = "#17211d";
    ctx.lineWidth = 2;
    ctx.fillRect(metrics.webLeft, metrics.top, metrics.webW, metrics.h);
    ctx.strokeRect(metrics.webLeft, metrics.top, metrics.webW, metrics.h);
    ctx.fillRect(metrics.shapeLeft, flangeY, metrics.totalW, tf);
    ctx.strokeRect(metrics.shapeLeft, flangeY, metrics.totalW, tf);
    ctx.fillStyle = "rgba(10,132,255,0.08)";
    ctx.fillRect(metrics.shapeLeft, flangeY, metrics.totalW, tf);
    return;
  }
  drawConcreteSection(ctx, metrics.webLeft, metrics.top, metrics.webW, metrics.h);
  if (shape === "irregular") {
    ctx.save();
    ctx.setLineDash([9, 6]);
    ctx.strokeStyle = "#0a84ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(metrics.webLeft - 8, metrics.top - 8, metrics.webW + 16, metrics.h + 16);
    ctx.restore();
  }
}

function drawConcreteSection(ctx, left, top, w, h) {
  ctx.fillStyle = "#f8faf8";
  ctx.strokeStyle = "#17211d";
  ctx.lineWidth = 2;
  ctx.fillRect(left, top, w, h);
  ctx.strokeRect(left, top, w, h);
}

function drawStirrupLoop(ctx, left, top, w, h, cover, diaPx) {
  const inset = Math.max(12, cover);
  ctx.strokeStyle = "#bd5b32";
  ctx.lineWidth = Math.max(3, diaPx);
  ctx.strokeRect(left + inset, top + inset, Math.max(20, w - 2 * inset), Math.max(20, h - 2 * inset));
  ctx.lineWidth = 2;
}

function drawBeamLayerSchedule(ctx, left, top, w, h, input, face, color, hollow = false, showLabels = false) {
  const scale = Math.min(w / input.b, h / input.D);
  const layers = rebarLayersForFace(input, face);
  if (!layers.length) return;
  const maxRadius = Math.max(5, (Math.max(...layers.map((layer) => layer.dia), input.barDia || 16) * scale) / 2);
  const cover = input.cover * scale + maxRadius + 7;
  const rowGap = Math.max(18, maxRadius * 2.8);
  layers.forEach((layer, layerIndex) => {
    const count = Math.max(1, Math.round(layer.count));
    const radius = Math.max(5, (layer.dia * scale) / 2);
    const usable = Math.max(10, w - 2 * cover);
    const y = face === "top" ? top + cover + layerIndex * rowGap : top + h - cover - layerIndex * rowGap;
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? left + w / 2 : left + cover + (usable * i) / (count - 1);
      drawBar(ctx, x, y, radius, color, hollow);
    }
    if (showLabels) drawLayerScheduleLabel(ctx, left - 76, y + 4, face, layer, input.memberType, color);
  });
}

function drawSlabLayerSchedule(ctx, left, top, w, h, input, face, color, hollow = false, showLabels = false) {
  const scale = Math.min(w / 1000, h / input.D);
  const layers = rebarLayersForFace(input, face);
  if (!layers.length) return;
  const maxRadius = Math.max(4, (Math.max(...layers.map((layer) => layer.dia), input.barDia || 16) * scale) / 2);
  const cover = input.cover * scale + maxRadius + 4;
  const rowGap = Math.max(13, maxRadius * 2.6);
  layers.forEach((layer, layerIndex) => {
    const radius = Math.max(4, (layer.dia * scale) / 2);
    const count = Math.max(1, Math.round(layer.count));
    const y = face === "top" ? top + cover + layerIndex * rowGap : top + h - cover - layerIndex * rowGap;
    for (let i = 0; i < count; i++) {
      const x = left + cover + ((w - 2 * cover) * i) / Math.max(1, count - 1);
      drawBar(ctx, x, y, radius, color, hollow);
    }
    if (showLabels) drawLayerScheduleLabel(ctx, left - 70, y + 4, face, layer, input.memberType, color);
  });
}

function drawLayerScheduleLabel(ctx, x, y, face, layer, memberType, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = "11px system-ui";
  const prefix = face === "top" ? "T" : "B";
  const suffix = memberType === "beam" ? ` ${formatBarsPerM(layer.count)}N${layer.dia}` : ` ${formatBarsPerM(layer.count)}N${layer.dia}/m`;
  ctx.fillText(`${prefix} L${layer.layer}${suffix}`, x, y);
  ctx.restore();
}

function drawBeamBars(ctx, left, top, w, h, input, count, dia, face, color, hollow = false) {
  const scale = Math.min(w / input.b, h / input.D);
  const radius = Math.max(5, (dia * scale) / 2);
  const cover = input.cover * scale + radius + 7;
  const rowGap = Math.max(18, radius * 2.6);
  const perLayer = Math.max(2, Math.min(6, Math.ceil(count / Math.ceil(count / 6))));
  for (let i = 0; i < count; i++) {
    const layer = Math.floor(i / perLayer);
    const index = i % perLayer;
    const barsInLayer = Math.min(perLayer, count - layer * perLayer);
    const usable = w - 2 * cover;
    const x = barsInLayer === 1 ? left + w / 2 : left + cover + (usable * index) / (barsInLayer - 1);
    const y = face === "top" ? top + cover + layer * rowGap : top + h - cover - layer * rowGap;
    drawBar(ctx, x, y, radius, color, hollow);
  }
}

function drawSlabBars(ctx, left, top, w, h, input, provided, face, color) {
  const scale = Math.min(w / 1000, h / input.D);
  const radius = Math.max(4, ((provided.dia || input.barDia) * scale) / 2);
  const spacing = Math.max(75, provided.spacing || 200);
  const count = Math.max(2, provided.countPerM ? Math.round(provided.countPerM) : Math.floor(1000 / spacing) + 1);
  const cover = input.cover * scale + radius + 4;
  const y = face === "top" ? top + cover : top + h - cover;
  for (let i = 0; i < count; i++) {
    const x = left + cover + ((w - 2 * cover) * i) / (count - 1);
    drawBar(ctx, x, y, radius, color);
  }
}

function drawDistributionBars(ctx, left, top, w, h, input, provided, face) {
  const scale = Math.min(w / 1000, h / input.D);
  const cover = input.cover * scale + 10;
  const y = face === "top" ? top + cover : top + h - cover;
  ctx.strokeStyle = "#bd5b32";
  ctx.lineWidth = Math.max(3, (provided.dia || 12) * scale);
  for (let i = 0; i < 8; i++) {
    const x = left + 44 + (i * (w - 88)) / 7;
    ctx.beginPath();
    ctx.moveTo(x - 18, y);
    ctx.lineTo(x + 18, y);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
}

function drawBar(ctx, x, y, radius, color, hollow = false) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (hollow) {
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function drawSectionNotes(ctx, x, y, rows) {
  const rowH = 38;
  ctx.fillStyle = "#fbfcfa";
  ctx.strokeStyle = "#d7ddd8";
  ctx.lineWidth = 1;
  ctx.fillRect(x - 18, y - 28, 360, rows.length * rowH + 42);
  ctx.strokeRect(x - 18, y - 28, 360, rows.length * rowH + 42);
  rows.forEach(([label, value], i) => {
    const yy = y + i * rowH;
    ctx.fillStyle = "#60706a";
    ctx.font = "12px system-ui";
    ctx.fillText(label, x, yy);
    ctx.fillStyle = "#17211d";
    ctx.font = "15px system-ui";
    ctx.fillText(value, x, yy + 18);
  });
}

function drawDimension(ctx, x1, y1, x2, y2, text, vertical = false) {
  ctx.strokeStyle = "#60706a";
  ctx.fillStyle = "#60706a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  if (vertical) {
    ctx.save();
    ctx.translate(x1 + 14, (y1 + y2) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = "13px system-ui";
    ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
    ctx.restore();
  } else {
    ctx.font = "13px system-ui";
    ctx.fillText(text, (x1 + x2) / 2 - ctx.measureText(text).width / 2, y1 + 18);
  }
}

function renderReport() {
  if (state.result.mode === "twoWay") {
    const { input, strengthCombo, serviceCombo, twoWay, status } = state.result;
    const lines = [];
    lines.push("TWO-WAY SLAB DESIGN REPORT");
    lines.push(`DESIGN STATUS: ${status.label}`);
    lines.push(`  ${status.headline}`);
    if (status.failures.length) status.failures.forEach((item) => lines.push(`  FAIL: ${item}`));
    status.warnings.forEach((item) => lines.push(`  REVIEW: ${item}`));
    lines.push(`  REVIEW REQUIRED: ${status.reviewItems.join(", ")}`);
    lines.push("");
    lines.push(`Panel: ${input.panelX} m x ${input.panelY} m, slab D=${input.D} mm, d=${input.d.toFixed(0)} mm`);
    lines.push(`Section geometry: ${sectionShapeLabel(input)}, Ag=${input.Agross.toFixed(0)} mm2, centroid=${input.sectionCentroid.toFixed(1)} mm from top, Ig=${input.Igross.toExponential(3)} mm4.`);
    lines.push(`Column: ${input.columnX} mm x ${input.columnY} mm, support type=${input.supportType}`);
    lines.push(`Column/slab fixity: ${input.columnFixity.toFixed(0)}% semi-rigid rotational restraint used for strip distribution and plate stiffness.`);
    lines.push(input.ptEnabled ? `Post-tensioning: ${ptSummaryText(input)}. High points from top=${input.ptHighPoints.join(", ")} mm; low points from top=${input.ptLowPoints.join(", ")} mm.` : "Post-tensioning: not included.");
    lines.push(`Analysis model: Equivalent frame/design-strip model.`);
    lines.push(`Run sequence: built ${state.result.analysisModel.nodeCount}-node plate grid, analysed load-combination envelopes, final status ${status.label}.`);
    lines.push(`Design strips: full panel-width frame actions distributed into column strip ${input.columnStripPercent}% of bay plus middle strip.`);
    lines.push(`Deflection model: ${sectionAnalysisLabel(input)} plate grid/series check, grid ${input.plateGrid} x ${input.plateGrid}, with short-term and sustained-load long-term curves.`);
    lines.push(`Long-term parameters: creep factor=${input.creepFactor}, shrinkage=${input.shrinkageStrain} microstrain, temperature=${input.temperatureDelta} deg C, thermal coefficient=${input.thermalCoeff} microstrain/deg C, restraint=${input.temperatureRestraint}%, humidity factor=${input.humidityFactor}, resulting sustained multiplier=${longTermDeflectionMultiplier(input).toFixed(2)}.`);
    if (input.wetAreaEnabled) lines.push(`Wet-area load: ${input.wetLoadKpa} kPa over ${input.wetAreaPercent}% area, included with permanent load factors.`);
    lines.push(`Service stiffness modifier: ${(twoWay.shortPlate.stiffnessModifier * 100).toFixed(0)}% of gross plate stiffness, restraint modifier ${twoWay.shortPlate.restraintModifier.toFixed(2)} for service deflection.`);
    lines.push(`Strength combination: ${strengthCombo.name}, wu=${twoWay.ulsLoad.toFixed(2)} kPa`);
    lines.push("Design envelope: all ULS combinations are scanned for strip flexure and two-way support shear; governing ULS combination is used for the design run.");
    lines.push(`Short-term deflection combination: ${serviceCombo.name}, ws=${twoWay.serviceLoad.toFixed(2)} kPa`);
    lines.push(`Sustained deflection combination: ${twoWay.sustainedCombo.name}, ws=${twoWay.sustainedLoad.toFixed(2)} kPa`);
    lines.push(`Max short-term plate deflection: ${(twoWay.shortPlate.maxDeflectionM * 1000).toFixed(2)} mm at x=${twoWay.shortPlate.maxAt.x.toFixed(2)} m, y=${twoWay.shortPlate.maxAt.y.toFixed(2)} m`);
    lines.push(`Max long-term plate deflection: ${(twoWay.longPlate.maxDeflectionM * 1000).toFixed(2)} mm at x=${twoWay.longPlate.maxAt.x.toFixed(2)} m, y=${twoWay.longPlate.maxAt.y.toFixed(2)} m`);
    lines.push("");
    lines.push("REINFORCEMENT INPUT");
    lines.push(`  Top face: ${formatRebarLayerSchedule(input, "top")} (${scheduledReoForFace(input, "top").as.toFixed(0)} mm2/m)`);
    lines.push(`  Bottom face: ${formatRebarLayerSchedule(input, "bottom")} (${scheduledReoForFace(input, "bottom").as.toFixed(0)} mm2/m)`);
    lines.push("");
    lines.push("STRIP FLEXURE");
    twoWay.strips.forEach((row) => lines.push(`  ${row.zone} ${row.location}: Mu*=${row.Mu.toFixed(1)} kNm/m, provide ${row.provided.text}, util=${(row.util * 100).toFixed(0)}%`));
    lines.push("");
    lines.push("TWO-WAY SUPPORT SHEAR");
    twoWay.supportShear.forEach((row) => lines.push(`  ${row.zone}: Vu*=${row.Mu.toFixed(1)} kN, capacity=${row.phiMu.toFixed(1)} kN, util=${(row.util * 100).toFixed(0)}%, ${row.check}`));
    lines.push("");
    lines.push("LIMITATIONS");
    lines.push("  Advanced design aid. Verify AS 3600, ACI 318 and Eurocode 2 checks against the current licensed standards, national annexes and project requirements.");
    lines.push(`  AS/NZS 1170 presets cover SW, G and Q only and use default psi_s=${DEFAULT_PSI_SHORT}, psi_l=${DEFAULT_PSI_LONG}; add and verify wind, earthquake, snow, liquid pressure, load reductions and project-specific actions separately.`);
    lines.push("  This program uses a full-width frame/design-strip workflow with lateral distribution factors; it is not a commercial nonlinear shell solver.");
    lines.push("  Long-term deflection uses the selected service stiffness mode and a sustained-load creep component; verify creep, shrinkage, load history and cracking with the licensed project method.");
    $("report").value = lines.join("\n");
    return;
  }
  const { input, strengthCombo, serviceCombo, sustainedCombo, ultimate, service, deflection, design, status } = state.result;
  const lines = [];
  lines.push("CONCRETE FEA DESIGN REPORT");
  lines.push(`DESIGN STATUS: ${status.label}`);
  lines.push(`  ${status.headline}`);
  if (status.failures.length) status.failures.forEach((item) => lines.push(`  FAIL: ${item}`));
  if (status.warnings.length) status.warnings.forEach((item) => lines.push(`  REVIEW: ${item}`));
  lines.push(`  REVIEW REQUIRED: ${status.reviewItems.join(", ")}`);
  lines.push("");
  lines.push(`Member: ${input.memberType === "slab" ? "one-way slab strip" : "beam"}`);
  lines.push(`Section: b=${input.b} mm, D=${input.D} mm, d=${input.d.toFixed(0)} mm`);
  lines.push(`Section geometry: ${sectionShapeLabel(input)}, Ag=${input.Agross.toFixed(0)} mm2, centroid=${input.sectionCentroid.toFixed(1)} mm from top, Ig=${input.Igross.toExponential(3)} mm4.`);
  lines.push(`Materials: f'c=${input.fc} MPa, fsy=${input.fsy} MPa, Ec=${input.Ec} MPa`);
  lines.push(`Model: ${input.spans.length} span 2D frame/strip FE model, ${input.elementsPerSpan} beam elements per span, selectable continuous/simple/cantilever span systems, vertical supports at active span nodes with rotational spring fixities.`);
  lines.push(`Run sequence: built ${state.result.analysisModel.nodeCount}-node / ${state.result.analysisModel.elementCount}-element frame mesh, analysed all envelope cases, final status ${status.label}.`);
  lines.push(`Support fixities: ${formatSupportFixities(input)}.`);
  lines.push(input.ptEnabled ? `Post-tensioning: ${ptSummaryText(input)}. High points from top=${input.ptHighPoints.join(", ")} mm; low points from top=${input.ptLowPoints.join(", ")} mm.` : "Post-tensioning: not included.");
  lines.push(`Deflection model: ${sectionAnalysisLabel(input)} service stiffness through the FE mesh; short-term deflection is taken from the all-service envelope and long-term deflection adds sustained-load creep, shrinkage, temperature and wet-area parameter effects.`);
  lines.push(`Long-term parameters: creep factor=${input.creepFactor}, shrinkage=${input.shrinkageStrain} microstrain, temperature=${input.temperatureDelta} deg C, thermal coefficient=${input.thermalCoeff} microstrain/deg C, restraint=${input.temperatureRestraint}%, humidity factor=${input.humidityFactor}, resulting sustained multiplier=${longTermDeflectionMultiplier(input).toFixed(2)}.`);
  if (input.wetAreaEnabled) lines.push(`Wet-area load: ${input.wetLoadKpa} kPa over ${input.wetAreaPercent}% tributary area, included with permanent load factors as ${input.wetLineLoad.toFixed(2)} kN/m.`);
  lines.push(input.memberType === "slab" ? "AS 3600:2018 branch: one-way slab strip, main reinforcement per metre, secondary shrinkage/distribution reinforcement and concrete one-way shear check without ligatures." : "AS 3600:2018 branch: beam longitudinal reinforcement plus transverse shear fitment design using effective shear depth.");
  lines.push(`Strength combination: ${strengthCombo.name} = ${strengthCombo.sw}SW + ${strengthCombo.g}G + ${strengthCombo.q}Q`);
  lines.push(`Design envelope: all ULS combinations and live-load patterns are scanned at ${designPointStations(input).length} design stations, minimum 13 per span.`);
  lines.push("Envelope storage: moment-controlled M+ and M- envelopes keep co-existing shear; shear-controlled V+ and V- envelopes keep co-existing moment; reactions are enveloped separately.");
  lines.push(`Short-term deflection combination: ${serviceCombo.name} = ${serviceCombo.sw}SW + ${serviceCombo.g}G + ${serviceCombo.q}Q`);
  lines.push(`Sustained deflection combination: ${sustainedCombo.name} = ${sustainedCombo.sw}SW + ${sustainedCombo.g}G + ${sustainedCombo.q}Q`);
  if (strengthCombo.pattern) lines.push("Strength live load patterning: span-loaded/unloaded combinations are generated automatically for live load pattern envelopes.");
  lines.push(`AS 3600:2018 approximations: phi flexure=${flexurePhi(input).toFixed(2)}, phi shear=${shearPhi(input).toFixed(2)}, alpha2=${alpha2(input.fc).toFixed(3)}, gamma=${gammaBlock(input.fc).toFixed(3)}, rectangular stress block.`);
  lines.push("");
  lines.push("SPANS");
  input.spans.forEach((span, i) => lines.push(`  ${i + 1}: L=${span.length} m, ${spanSystemLabel(span.system)}, G=${span.g} kN/m, Q=${span.q} kN/m`));
  if (input.selfWeight) lines.push(`  Self-weight included: ${input.selfWeightLoad.toFixed(2)} kN/m`);
  lines.push("");
  lines.push("REINFORCEMENT INPUT");
  lines.push(`  Top face: ${formatRebarLayerSchedule(input, "top")} (${scheduledReoForFace(input, "top").as.toFixed(0)} ${input.memberType === "beam" ? "mm2" : "mm2/m"})`);
  lines.push(`  Bottom face: ${formatRebarLayerSchedule(input, "bottom")} (${scheduledReoForFace(input, "bottom").as.toFixed(0)} ${input.memberType === "beam" ? "mm2" : "mm2/m"})`);
  lines.push("");
  lines.push("LOAD COMBINATIONS");
  input.combinations.forEach((combo) => {
    lines.push(`  ${combo.name}: ${combo.type}, ${combo.sw}SW + ${combo.g}G + ${combo.q}Q${combo.pattern ? ", pattern live load" : ""}`);
  });
  lines.push("");
  lines.push("ANALYSIS RESULTS");
  lines.push(`  Max ULS moment: ${ultimate.maxMoment.value.toFixed(2)} kNm at x=${ultimate.maxMoment.x.toFixed(2)} m`);
  lines.push(`  Design envelope max moment: ${state.result.designEnvelope.maxMoment.value.toFixed(2)} kNm at x=${state.result.designEnvelope.maxMoment.x.toFixed(2)} m`);
  lines.push(`  Max ULS shear: ${ultimate.maxShear.value.toFixed(2)} kN at x=${ultimate.maxShear.x.toFixed(2)} m`);
  lines.push(`  Design envelope max shear: ${state.result.designEnvelope.maxShear.value.toFixed(2)} kN at x=${state.result.designEnvelope.maxShear.x.toFixed(2)} m`);
  lines.push(`  Selected service-case max deflection: ${(Math.abs(service.maxDefl.value) * 1000).toFixed(2)} mm at x=${service.maxDefl.x.toFixed(2)} m`);
  lines.push(`  Service envelope max short-term deflection: ${(Math.abs(deflection.shortMax.value) * 1000).toFixed(2)} mm at x=${deflection.shortMax.x.toFixed(2)} m`);
  lines.push(`  Max long-term deflection: ${(Math.abs(deflection.longMax.value) * 1000).toFixed(2)} mm at x=${deflection.longMax.x.toFixed(2)} m`);
  spanDeflectionLowPoints(input, deflection).forEach((point) => {
    lines.push(`  Span ${point.span} low-point deflection: short=${point.shortMm.toFixed(2)} mm, long=${point.longMm.toFixed(2)} mm at x=${point.x.toFixed(2)} m, limit=${point.limitMm.toFixed(1)} mm`);
  });
  const stress = stressSamples(input, service.samples);
  lines.push(`  Service stress checks: tension ${stress[0].tensileLimit.toFixed(2)} MPa, compression ${Math.abs(stress[0].compressionLimit).toFixed(2)} MPa`);
  lines.push(`  Max elastic top/bottom stress: ${maxAbs(stress, "top").value.toFixed(2)} / ${maxAbs(stress, "bottom").value.toFixed(2)} MPa`);
  lines.push("");
  lines.push("REINFORCEMENT DESIGN");
  design.forEach((row) => {
    const slabExtra = row.slabDetailing ? `, secondary ${row.slabDetailing.provided.text}` : "";
    const shearExtra = row.shear ? `, ${row.shear.provided}, Vu*=${row.shear.demand.toFixed(1)} kN, phiVu=${row.shear.phiVu.toFixed(1)} kN` : "";
    lines.push(`  ${row.zone} (${row.location}): Mu*=${row.Mu.toFixed(1)} kNm, As=${row.asReq.toFixed(0)} mm2, provide ${row.provided.text}${slabExtra}${shearExtra}, util=${(row.util * 100).toFixed(0)}%`);
  });
  lines.push("");
  lines.push("LIMITATIONS");
  lines.push("  Advanced design aid. Verify detailing, ductility, shear, torsion, anchorage, crack control, fire, durability and load combinations against the current licensed AS 3600 and project requirements.");
  lines.push(`  AS/NZS 1170 presets cover SW, G and Q only and use default psi_s=${DEFAULT_PSI_SHORT}, psi_l=${DEFAULT_PSI_LONG}; add and verify wind, earthquake, snow, liquid pressure, load reductions and project-specific actions separately.`);
  lines.push("  Program features implemented here are advanced workflow concepts: menu bar, control tree, message window, editable load cases/combinations, live-load envelopes, selectable deflection diagrams, design strips and report.");
  $("report").value = lines.join("\n");
}

function drawTwoWayModel() {
  const { input } = state.result;
  const canvas = $("modelCanvas");
  const ctx = canvas.getContext("2d");
  clear(ctx, canvas);
  const pad = 90;
  const w = canvas.width - 2 * pad;
  const h = canvas.height - 2 * pad;
  const scale = Math.min(w / input.panelX, h / input.panelY);
  const px = pad + (w - input.panelX * scale) / 2;
  const py = pad + (h - input.panelY * scale) / 2;
  const pw = input.panelX * scale;
  const ph = input.panelY * scale;
  ctx.strokeStyle = "#17211d";
  ctx.lineWidth = 4;
  ctx.strokeRect(px, py, pw, ph);
  const colW = (input.columnX / 1000) * scale;
  const colH = (input.columnY / 1000) * scale;
  drawTwoWayColumnStack(ctx, px, py, pw, ph, colW, colH);
  ctx.fillStyle = "#60706a";
  ctx.fillRect(px + pw / 2 - colW / 2, py + ph / 2 - colH / 2, colW, colH);
  ctx.strokeStyle = "#126b63";
  ctx.lineWidth = 2;
  const csx = pw * input.columnStripPercent / 100;
  const csy = ph * input.columnStripPercent / 100;
  ctx.strokeRect(px + pw / 2 - csx / 2, py, csx, ph);
  ctx.strokeRect(px, py + ph / 2 - csy / 2, pw, csy);
  ctx.fillStyle = "#17211d";
  ctx.font = "16px system-ui";
  ctx.fillText(`Two-way slab panel ${input.panelX} m x ${input.panelY} m`, pad, 42);
  ctx.fillStyle = "#60706a";
  ctx.fillText(`Full-width equivalent frame strips plus ${input.plateGrid} x ${input.plateGrid} plate deflection grid, column fixity ${input.columnFixity.toFixed(0)}%`, pad, 68);
  if (input.ptEnabled) {
    ctx.fillStyle = "#a16207";
    ctx.fillText(`PT tendon band: ${ptSummaryText(input)}`, pad, 94);
    drawTwoWayPtProfile(ctx, px, py, pw, ph, input);
  }
}

function drawTwoWayColumnStack(ctx, px, py, pw, ph, colW, colH) {
  const cx = px + pw / 2;
  const cy = py + ph / 2;
  const x = cx - colW / 2;
  const y = cy - colH / 2;
  ctx.save();
  ctx.setLineDash([8, 5]);
  ctx.strokeStyle = "#415f91";
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 9, y - 9, colW + 18, colH + 18);
  ctx.restore();
  ctx.fillStyle = "rgba(96,112,106,0.18)";
  ctx.fillRect(x + 9, y + 9, colW, colH);
  ctx.strokeStyle = "#60706a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 9, y + 9, colW, colH);
  drawColumnBarsPlan(ctx, x + 9, y + 9, colW, colH);
  ctx.fillStyle = "#415f91";
  ctx.font = "12px system-ui";
  ctx.fillText("column above", x + colW + 26, y - 5);
  ctx.fillStyle = "#60706a";
  ctx.fillText("column below", x + colW + 26, y + colH + 22);
}

function drawColumnBarsPlan(ctx, x, y, w, h) {
  const r = Math.max(3, Math.min(w, h) * 0.09);
  const pts = [
    [x + w * 0.24, y + h * 0.24],
    [x + w * 0.76, y + h * 0.24],
    [x + w * 0.24, y + h * 0.76],
    [x + w * 0.76, y + h * 0.76],
  ];
  pts.forEach(([px, py]) => drawBar(ctx, px, py, r, "#17211d"));
}

function drawTwoWayDiagrams() {
  const { input, twoWay } = state.result;
  const canvas = $("diagramCanvas");
  const ctx = canvas.getContext("2d");
  clear(ctx, canvas);
  drawBarDiagram(ctx, canvas, twoWay.strips, 70, 120, 220, "Column and middle strip moment demand / capacity", "Mu", "phiMu");
  const xProf = twoWay.plate.xProfile.map((p) => ({ x: p.x, defl: p.defl * 1000 }));
  const yProf = twoWay.plate.yProfile.map((p) => ({ x: p.x, defl: p.defl * 1000 }));
  drawDiagram(ctx, canvas, xProf, "defl", 70, 440, 160, `${sectionAnalysisShortLabel(input)} plate deflection profile along panel X midline (mm)`, "#415f91");
  drawDiagram(ctx, canvas, yProf, "defl", 70, 640, 120, `${sectionAnalysisShortLabel(input)} plate deflection profile along panel Y midline (mm)`, "#bd5b32");
}

function drawTwoWayLimitDiagrams() {
  const { input, twoWay } = state.result;
  const canvas = $("limitCanvas");
  const ctx = canvas.getContext("2d");
  clear(ctx, canvas);
  const limit = (Math.min(input.panelX, input.panelY) * 1000) / input.deflectionRatio;
  const xDefl = twoWay.shortPlate.xProfile.map((p, i) => ({ x: p.x, shortMm: p.defl * 1000, longMm: (twoWay.longPlate.xProfile[i]?.defl || p.defl) * 1000, limitMm: limit }));
  const yDefl = twoWay.shortPlate.yProfile.map((p, i) => ({ x: p.x, shortMm: p.defl * 1000, longMm: (twoWay.longPlate.yProfile[i]?.defl || p.defl) * 1000, limitMm: limit }));
  drawDeflectionComparisonDiagram(ctx, canvas, xDefl, 70, 170, 125, `Panel X midline ${sectionAnalysisShortLabel(input)} short-term / long-term deflection`, "#415f91", "#bd5b32");
  drawDeflectionComparisonDiagram(ctx, canvas, yDefl, 70, 390, 125, `Panel Y midline ${sectionAnalysisShortLabel(input)} short-term / long-term deflection`, "#126b63", "#bd5b32");
  drawBarDiagram(ctx, canvas, twoWay.supportShear, 70, 730, 105, "Two-way support shear utilisation by standard", "Mu", "phiMu");
}

function drawBarDiagram(ctx, canvas, rows, pad, axisY, height, title, demandKey, capacityKey) {
  const max = Math.max(1, ...rows.map((row) => Math.max(row[demandKey], row[capacityKey])));
  const barW = (canvas.width - 2 * pad) / rows.length;
  ctx.fillStyle = "#17211d";
  ctx.font = "15px system-ui";
  ctx.fillText(title, pad, axisY - height - 22);
  rows.forEach((row, i) => {
    const x = pad + i * barW + barW * 0.18;
    const demandH = (row[demandKey] / max) * height;
    const capH = (row[capacityKey] / max) * height;
    ctx.fillStyle = "#bd5b32";
    ctx.fillRect(x, axisY - demandH, barW * 0.24, demandH);
    ctx.fillStyle = "#126b63";
    ctx.fillRect(x + barW * 0.28, axisY - capH, barW * 0.24, capH);
    ctx.fillStyle = "#60706a";
    ctx.fillText(row.zone.replace("Column shear ", ""), x - 6, axisY + 24);
  });
  ctx.fillStyle = "#bd5b32";
  ctx.fillText("demand", pad, axisY + 52);
  ctx.fillStyle = "#126b63";
  ctx.fillText("capacity", pad + 86, axisY + 52);
}

function drawModel() {
  if (state.result.mode === "twoWay") {
    drawTwoWayModel();
    return;
  }
  const { input, strengthCombo, ultimate } = state.result;
  const canvas = $("modelCanvas");
  const ctx = canvas.getContext("2d");
  clear(ctx, canvas);
  const pad = 70;
  const y = 250;
  const scale = (canvas.width - 2 * pad) / ultimate.totalLength;
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#17211d";
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(canvas.width - pad, y);
  ctx.stroke();
  ctx.font = "14px system-ui";
  ctx.fillStyle = "#17211d";
  const boundarySupports = spanBoundarySupportStates(input);
  ultimate.x.forEach((x, i) => {
    const px = pad + x * scale;
    if (boundarySupports[i]) {
      drawSupportColumnStack(ctx, px, y, i, ultimate.x.length, supportFixityPercent(input, i));
      drawSupport(ctx, px, y + 7);
      ctx.fillText(`S${i + 1}`, px - 8, y + 58);
    } else {
      drawFreeTip(ctx, px, y);
      ctx.fillText(`free T${i + 1}`, px - 22, y + 58);
    }
  });
  input.spans.forEach((span, i) => {
    const x1 = pad + ultimate.x[i] * scale;
    const x2 = pad + ultimate.x[i + 1] * scale;
    ctx.strokeStyle = "#bd5b32";
    ctx.lineWidth = 2;
    for (let x = x1 + 16; x < x2 - 8; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, y - 70);
      ctx.lineTo(x, y - 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 25);
      ctx.lineTo(x, y - 18);
      ctx.lineTo(x + 4, y - 25);
      ctx.stroke();
    }
    ctx.fillStyle = "#17211d";
    ctx.textAlign = "center";
    ctx.fillText(`L=${span.length} m, ${spanSystemLabel(span.system)}`, (x1 + x2) / 2, y + 35);
    const wu = strengthCombo.sw * input.selfWeightLoad + strengthCombo.g * (span.g + input.wetLineLoad) + strengthCombo.q * span.q;
    ctx.fillText(`G=${span.g} Q=${span.q} kN/m`, (x1 + x2) / 2, y - 88);
    ctx.fillText(`${strengthCombo.name}: wu=${wu.toFixed(1)} kN/m`, (x1 + x2) / 2, y - 108);
  });
  ctx.textAlign = "left";
  ctx.fillStyle = "#60706a";
  ctx.fillText(`${input.memberType === "slab" ? "One-way slab strip" : "Beam"} ${input.b} x ${input.D} mm, Ec ${input.Ec} MPa`, pad, 60);
  ctx.fillText(input.memberType === "slab" ? "AS3600-2018 slab branch: per-metre bars, distribution steel, no shear ligs" : "AS3600-2018 beam branch: longitudinal bars plus shear fitments", pad, 84);
  ctx.fillText(`Solid column bars below; dashed column bars above. Fixity: ${formatSupportFixities(input)}.`, pad, 108);
  if (input.ptEnabled) {
    ctx.fillStyle = "#a16207";
    ctx.fillText(`PT profile active: ${ptSummaryText(input)}`, pad, 132);
    drawLinePtProfile(ctx, pad, y, scale, input, ultimate.x);
  }
}

function drawPtInputPreview() {
  const canvas = $("ptProfileCanvas");
  if (!canvas?.getContext) return;
  const ctx = canvas.getContext("2d");
  clear(ctx, canvas);
  const memberType = $("memberType")?.value || defaults.memberType;
  const D = Number($("depth")?.value || defaults.depth);
  const enabled = $("ptEnabled")?.checked;
  const profile = ptProfileForInput();
  const spans = memberType === "twoWay" ? [{ length: Number($("panelX")?.value || defaults.panelX) }] : state.spans;
  const total = spans.reduce((sum, span) => sum + Number(span.length || 0), 0) || 1;
  const pad = 70;
  const top = 74;
  const width = canvas.width - 2 * pad;
  const yScale = 120 / Math.max(D, 1);
  const xScale = width / total;

  ctx.fillStyle = "#17211d";
  ctx.font = "18px system-ui";
  ctx.fillText("Post-tensioning tendon profile preview", 36, 36);
  ctx.font = "13px system-ui";
  ctx.fillStyle = enabled ? "#a16207" : "#60706a";
  ctx.fillText(enabled ? "Editable high / low points are included in the analysis." : "Tendons are currently off; profile is shown for layout editing.", 36, 58);
  ctx.strokeStyle = "rgba(96,112,106,0.28)";
  ctx.fillStyle = "rgba(96,112,106,0.06)";
  ctx.fillRect(pad, top, width, D * yScale);
  ctx.strokeRect(pad, top, width, D * yScale);

  let x = pad;
  spans.forEach((span, i) => {
    const x1 = x;
    const x2 = x + span.length * xScale;
    const highA = profile.highPoints[i] ?? profile.highPoints[0] ?? defaultPtHighPoint();
    const highB = profile.highPoints[i + 1] ?? profile.highPoints[profile.highPoints.length - 1] ?? highA;
    const low = profile.lowPoints[i] ?? defaultPtLowPoint();
    drawPtCurve(ctx, x1, x2, top, yScale, D, highA, highB, low);
    ctx.fillStyle = "#60706a";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(memberType === "twoWay" ? `panel Lx ${span.length} m` : `span ${i + 1} L=${span.length} m`, (x1 + x2) / 2, top + D * yScale + 24);
    ctx.fillStyle = "#a16207";
    ctx.fillText(`low ${low.toFixed(0)} mm`, (x1 + x2) / 2, top + D * yScale + 42);
    x = x2;
  });
  profile.highPoints.forEach((high, i) => {
    const supportX = pad + spans.slice(0, i).reduce((sum, span) => sum + span.length, 0) * xScale;
    ctx.fillStyle = "#a16207";
    ctx.fillText(`H${i + 1} ${high.toFixed(0)}`, supportX, top - 12);
  });
  ctx.textAlign = "left";
}

function drawTwoWayPtProfile(ctx, px, py, pw, ph, input) {
  const highA = input.ptHighPoints[0] || defaultPtHighPoint();
  const highB = input.ptHighPoints[1] || highA;
  const low = input.ptLowPoints[0] || defaultPtLowPoint();
  const yScale = Math.min(0.7, ph / Math.max(input.D, 1));
  const baseY = py + ph / 2 - (input.D * yScale) / 2;
  drawPtCurve(ctx, px, px + pw, baseY, yScale, input.D, highA, highB, low);
  ctx.fillStyle = "#a16207";
  ctx.font = "12px system-ui";
  ctx.fillText(`H ${highA.toFixed(0)} / ${highB.toFixed(0)} mm`, px + 10, baseY - 8);
  ctx.fillText(`L ${low.toFixed(0)} mm`, px + pw / 2 - 24, baseY + input.D * yScale + 18);
}

function drawLinePtProfile(ctx, pad, beamY, xScale, input, supports) {
  const yScale = Math.min(0.45, 110 / Math.max(input.D, 1));
  const topY = beamY - 36;
  ctx.save();
  ctx.strokeStyle = "rgba(161,98,7,0.2)";
  ctx.fillStyle = "rgba(161,98,7,0.08)";
  ctx.fillRect(pad, topY, supports[supports.length - 1] * xScale, input.D * yScale);
  ctx.strokeRect(pad, topY, supports[supports.length - 1] * xScale, input.D * yScale);
  for (let i = 0; i < input.spans.length; i++) {
    const x1 = pad + supports[i] * xScale;
    const x2 = pad + supports[i + 1] * xScale;
    const highA = input.ptHighPoints[i] || defaultPtHighPoint();
    const highB = input.ptHighPoints[i + 1] || highA;
    const low = input.ptLowPoints[i] || defaultPtLowPoint();
    drawPtCurve(ctx, x1, x2, topY, yScale, input.D, highA, highB, low);
    ctx.fillStyle = "#a16207";
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`L${i + 1} ${low.toFixed(0)}`, (x1 + x2) / 2, topY + input.D * yScale + 14);
  }
  input.ptHighPoints.forEach((high, i) => {
    const x = pad + supports[i] * xScale;
    ctx.fillStyle = "#a16207";
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`H${i + 1} ${high.toFixed(0)}`, x, topY - 8);
  });
  ctx.restore();
}

function drawPtCurve(ctx, x1, x2, topY, yScale, depth, highA, highB, low) {
  ctx.save();
  ctx.strokeStyle = "#a16207";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let j = 0; j <= 32; j++) {
    const r = j / 32;
    const linear = highA + (highB - highA) * r;
    const midLinear = (highA + highB) / 2;
    const yFromTop = clamp(linear + 4 * (low - midLinear) * r * (1 - r), 0, depth);
    const x = x1 + (x2 - x1) * r;
    const y = topY + yFromTop * yScale;
    if (j === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSupportColumnStack(ctx, x, beamY, index, count, fixityPercent = 0) {
  const colW = 30;
  const belowTop = beamY + 18;
  const aboveBottom = beamY - 18;
  const belowH = 118;
  const aboveH = 92;
  ctx.save();
  ctx.fillStyle = "rgba(96,112,106,0.18)";
  ctx.strokeStyle = "#60706a";
  ctx.lineWidth = 2;
  roundRectPath(ctx, x - colW / 2, belowTop, colW, belowH, 4);
  ctx.fill();
  ctx.stroke();
  drawColumnLongitudinalBars(ctx, x, belowTop, colW, belowH, "#17211d");
  ctx.setLineDash([7, 5]);
  ctx.strokeStyle = "#415f91";
  roundRectPath(ctx, x - colW / 2, aboveBottom - aboveH, colW, aboveH, 4);
  ctx.stroke();
  ctx.setLineDash([]);
  drawColumnLongitudinalBars(ctx, x, aboveBottom - aboveH, colW, aboveH, "#415f91");
  if (index === 0) {
    ctx.fillStyle = "#415f91";
    ctx.font = "12px system-ui";
    ctx.fillText("columns above", x + 20, aboveBottom - aboveH + 18);
    ctx.fillStyle = "#60706a";
    ctx.fillText("columns below", x + 20, belowTop + belowH - 8);
  }
  if (index === count - 1) {
    ctx.fillStyle = "#60706a";
    ctx.font = "12px system-ui";
    ctx.textAlign = "right";
    ctx.fillText("current support / column arrangement", x - 22, beamY + 132);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = fixityPercent > 75 ? "#126b63" : fixityPercent > 25 ? "#a16207" : "#60706a";
  ctx.font = "11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`${fixityPercent.toFixed(0)}%`, x, beamY - aboveH - 36);
  ctx.beginPath();
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 2;
  ctx.arc(x, beamY - 28, 17, Math.PI * 0.2, Math.PI * (0.2 + 1.6 * (fixityPercent / 100)));
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.restore();
}

function drawColumnLongitudinalBars(ctx, x, y, w, h, color) {
  const barX = [x - w * 0.28, x + w * 0.28];
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  barX.forEach((bx) => {
    ctx.beginPath();
    ctx.moveTo(bx, y + 10);
    ctx.lineTo(bx, y + h - 10);
    ctx.stroke();
  });
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawDiagrams() {
  if (state.result.mode === "twoWay") {
    drawTwoWayDiagrams();
    return;
  }
  const { deflection, designEnvelope } = state.result;
  const canvas = $("diagramCanvas");
  const ctx = canvas.getContext("2d");
  clear(ctx, canvas);
  drawDiagram(ctx, canvas, designEnvelope.samples, "moment", 70, 110, 220, `All ULS bending moment design envelope (kNm)`, "#126b63");
  drawDiagram(ctx, canvas, designEnvelope.samples, "shear", 70, 350, 160, `All ULS shear design envelope (kN)`, "#bd5b32");
  drawDiagram(ctx, canvas, deflection.longSamples.map((s) => ({ ...s, defl: s.defl * 1000 })), "defl", 70, 560, 130, `All service envelopes long-term deflection by span (mm)`, "#415f91");
}

function drawEnvelopeDiagrams() {
  const canvas = $("envelopeCanvas");
  if (!canvas || !state.result) return;
  const ctx = canvas.getContext("2d");
  clear(ctx, canvas);
  if (state.result.mode === "twoWay") {
    const { combinationResults } = state.result;
    const rows = combinationResults.map(({ combo, analysis }) => ({
      zone: combo.name,
      Mu: Math.abs(analysis.maxMoment.value),
      phiMu: combo.type === "ULS" ? Math.max(Math.abs(analysis.maxMoment.value), 1) : 0,
      util: analysis.maxShear.value,
    }));
    const deflRows = combinationResults.map(({ combo, analysis }) => ({
      zone: combo.name,
      Mu: Math.abs(analysis.maxDefl.value) * 1000,
      phiMu: combo.type === "ULS" ? 0 : Math.max(Math.abs(analysis.maxDefl.value) * 1000, 1),
    }));
    drawBarDiagram(ctx, canvas, rows.slice(0, 8), 70, 300, 210, "Two-way strength envelope by combination", "Mu", "phiMu");
    drawBarDiagram(ctx, canvas, deflRows.slice(0, 8), 70, 650, 210, "Two-way deflection envelope by service combination", "Mu", "phiMu");
    return;
  }
  const { designEnvelope, serviceEnvelope } = state.result;
  drawEnvelopeBand(ctx, canvas, designEnvelope.samples, "momentMax", "momentMin", 70, 190, 250, "All ULS combinations: max/min moment envelope (kNm)", "#126b63", "#bd5b32");
  drawEnvelopeBand(ctx, canvas, designEnvelope.samples, "shearMax", "shearMin", 70, 500, 210, "All ULS combinations: max/min shear envelope (kN)", "#415f91", "#bd5b32");
  const serviceSamples = serviceEnvelope.samples.map((sample) => ({ ...sample, deflMaxMm: sample.deflAbs * 1000, zero: 0 }));
  drawEnvelopeBand(ctx, canvas, serviceSamples, "deflMaxMm", "zero", 70, 630, 82, `All service combinations: maximum ${sectionAnalysisShortLabel(state.result.input)} deflection envelope (mm)`, "#415f91", "#60706a");
}

function drawEnvelopeBand(ctx, canvas, samples, positiveKey, negativeKey, pad, axisY, height, title, posColor, negColor) {
  if (!samples?.length) return;
  if (/defl/i.test(positiveKey)) {
    drawDownwardEnvelope(ctx, canvas, samples, positiveKey, pad, axisY, height, title, posColor);
    return;
  }
  const total = Math.max(1e-9, samples[samples.length - 1].x);
  const max = Math.max(0.001, ...samples.flatMap((sample) => [Math.abs(sample[positiveKey] || 0), Math.abs(sample[negativeKey] || 0)]));
  const xScale = (canvas.width - 2 * pad) / total;
  const yScale = (height / 2) / max;
  ctx.strokeStyle = "#d7ddd8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, axisY);
  ctx.lineTo(canvas.width - pad, axisY);
  ctx.stroke();
  ctx.fillStyle = "#17211d";
  ctx.font = "15px system-ui";
  ctx.fillText(title, pad, axisY - height / 2 - 22);
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => axisY - (s[positiveKey] || 0) * yScale, posColor);
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => axisY - (s[negativeKey] || 0) * yScale, negColor);
  ctx.fillStyle = posColor;
  ctx.fillText("max", pad, axisY + height / 2 + 28);
  ctx.fillStyle = negColor;
  ctx.fillText("min", pad + 56, axisY + height / 2 + 28);
  ctx.fillStyle = "#60706a";
  ctx.fillText(`envelope max |value| ${max.toFixed(1)}`, canvas.width - pad - 180, axisY - height / 2 - 22);
}

function drawDownwardEnvelope(ctx, canvas, samples, key, pad, axisY, height, title, color) {
  const total = Math.max(1e-9, samples[samples.length - 1].x);
  const max = Math.max(1, ...samples.map((sample) => Math.abs(sample[key] || 0)));
  const xScale = (canvas.width - 2 * pad) / total;
  const yScale = height / max;
  ctx.strokeStyle = "#d7ddd8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, axisY);
  ctx.lineTo(canvas.width - pad, axisY);
  ctx.stroke();
  ctx.fillStyle = "#17211d";
  ctx.font = "15px system-ui";
  ctx.fillText(`${title} - plotted downward`, pad, axisY - 24);
  drawDeflectionSupportMarkers(ctx, state.result?.input, pad, axisY, height, xScale);
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => axisY + Math.abs(s[key] || 0) * yScale, color);
  drawDownIndicator(ctx, canvas.width - pad - 70, axisY + 8);
  ctx.fillStyle = "#60706a";
  ctx.fillText(`max downward ${max.toFixed(1)} mm`, pad, axisY + height + 28);
}

function drawLimitDiagrams() {
  if (state.result.mode === "twoWay") {
    drawTwoWayLimitDiagrams();
    return;
  }
  const { input, service, deflection } = state.result;
  const canvas = $("limitCanvas");
  const ctx = canvas.getContext("2d");
  clear(ctx, canvas);
  const stress = stressSamples(input, service.samples);
  const defl = deflection.longSamples.map((s, i) => ({ x: s.x, shortMm: Math.abs(deflection.shortSamples[i]?.shortDefl || service.samples[i]?.defl || 0) * 1000, longMm: Math.abs(s.defl) * 1000, limitMm: deflectionLimitAt(input, service.x, s.x) }));
  drawDeflectionComparisonDiagram(ctx, canvas, defl, 70, 155, 205, `All service envelopes ${sectionAnalysisShortLabel(input)} FE short-term / long-term deflection`, "#415f91", "#bd5b32", spanDeflectionLowPoints(input, deflection));
  drawStressLimitDiagram(ctx, canvas, stress, 70, 605, 240, `Selected service case elastic concrete stress checks`, "#126b63", "#bd5b32");
}

function stressSamples(input, samples) {
  const centroid = input.sectionCentroid || input.D / 2;
  const yTop = centroid;
  const yBottom = input.D - centroid;
  const tensileLimit = input.stressTensFactor * Math.sqrt(input.fc);
  const compressionLimit = -input.stressCompFactor * input.fc;
  const prestressForceN = ptEffectiveForce(input) * 1000;
  const area = Math.max(input.Agross || input.b * input.D, 1);
  return samples.map((s) => {
    const elasticTop = (s.moment * 1e6 * yTop) / input.Igross;
    const elasticBottom = (s.moment * 1e6 * yBottom) / input.Igross;
    const tendonY = tendonPointFromTop(input, s.x);
    const tendonE = tendonY - centroid;
    const uniformPrestress = input.ptEnabled ? -prestressForceN / area : 0;
    const topPrestress = input.ptEnabled ? uniformPrestress + (prestressForceN * tendonE * yTop) / input.Igross : 0;
    const bottomPrestress = input.ptEnabled ? uniformPrestress - (prestressForceN * tendonE * yBottom) / input.Igross : 0;
    return {
      x: s.x,
      top: -elasticTop + topPrestress,
      bottom: elasticBottom + bottomPrestress,
      tendonY,
      tensileLimit,
      compressionLimit,
    };
  });
}

function deflectionLimitAt(input, nodes, x) {
  const spanIndex = Math.min(input.spans.length - 1, Math.max(0, nodes.findIndex((node, i) => i > 0 && x <= node + 1e-9) - 1));
  return (input.spans[spanIndex].length * 1000) / input.deflectionRatio;
}

function drawDeflectionLimitDiagram(ctx, canvas, samples, pad, axisY, height, title, color) {
  const total = samples[samples.length - 1].x;
  const max = Math.max(1, ...samples.map((s) => Math.max(s.deflMm, s.limitMm)));
  const xScale = (canvas.width - 2 * pad) / total;
  const yScale = height / max;
  const ratio = state.result?.input?.deflectionRatio || "?";
  ctx.fillStyle = "#17211d";
  ctx.font = "15px system-ui";
  ctx.fillText(title, pad, axisY - height - 22);
  ctx.strokeStyle = "#d7ddd8";
  ctx.beginPath();
  ctx.moveTo(pad, axisY);
  ctx.lineTo(canvas.width - pad, axisY);
  ctx.stroke();
  drawDeflectionSupportMarkers(ctx, state.result?.input, pad, axisY, height, xScale);
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => axisY + s.limitMm * yScale, "#a16207", [8, 6]);
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => axisY + s.deflMm * yScale, color);
  drawDownIndicator(ctx, canvas.width - pad - 70, axisY + 8);
  ctx.fillStyle = "#60706a";
  ctx.fillText(`demand max ${Math.max(...samples.map((s) => s.deflMm)).toFixed(1)} mm downward`, pad, axisY + height + 28);
  ctx.fillText(`allowable deflection L/${ratio}`, pad + 250, axisY + height + 28);
}

function drawDeflectionComparisonDiagram(ctx, canvas, samples, pad, axisY, height, title, shortColor, longColor, lowPoints = []) {
  const total = Math.max(1e-9, samples[samples.length - 1].x);
  const max = Math.max(1, ...samples.map((s) => Math.max(s.shortMm, s.longMm, s.limitMm)));
  const xScale = (canvas.width - 2 * pad) / total;
  const yScale = height / max;
  const ratio = state.result?.input?.deflectionRatio || "?";
  ctx.fillStyle = "#17211d";
  ctx.font = "15px system-ui";
  ctx.fillText(title, pad, axisY - height - 22);
  ctx.strokeStyle = "#d7ddd8";
  ctx.beginPath();
  ctx.moveTo(pad, axisY);
  ctx.lineTo(canvas.width - pad, axisY);
  ctx.stroke();
  drawDeflectionSupportMarkers(ctx, state.result?.input, pad, axisY, height, xScale);
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => axisY + s.limitMm * yScale, "#a16207", [8, 6]);
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => axisY + s.shortMm * yScale, shortColor);
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => axisY + s.longMm * yScale, longColor);
  drawDeflectionLowPointMarkers(ctx, lowPoints, pad, axisY, height, xScale, yScale, longColor);
  drawDownIndicator(ctx, canvas.width - pad - 70, axisY + 8);
  ctx.fillStyle = "#60706a";
  ctx.fillText(`short max ${Math.max(...samples.map((s) => s.shortMm)).toFixed(1)} mm downward`, pad, axisY + height + 28);
  ctx.fillStyle = longColor;
  ctx.fillText(`long max ${Math.max(...samples.map((s) => s.longMm)).toFixed(1)} mm downward`, pad + 230, axisY + height + 28);
  ctx.fillStyle = "#a16207";
  ctx.fillText(`allowable L/${ratio}`, pad + 500, axisY + height + 28);
  ctx.fillStyle = "#60706a";
  ctx.fillText("zero line is the undeformed member; curves sag downward", pad + 650, axisY + height + 28);
}

function drawDeflectionLowPointMarkers(ctx, lowPoints, pad, axisY, height, xScale, yScale, color) {
  if (!lowPoints?.length) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.font = "11px system-ui";
  ctx.setLineDash([4, 5]);
  lowPoints.forEach((point) => {
    const x = pad + point.x * xScale;
    const y = axisY + point.longMm * yScale;
    ctx.beginPath();
    ctx.moveTo(x, axisY);
    ctx.lineTo(x, Math.min(axisY + height + 4, y + 8));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(`S${point.span} ${point.longMm.toFixed(1)} mm`, x + 6, Math.min(axisY + height - 6, y + 4));
    ctx.setLineDash([4, 5]);
  });
  ctx.restore();
}

function drawDeflectionSupportMarkers(ctx, input, pad, axisY, height, xScale) {
  if (!input?.spans?.length) return;
  const supports = spanSupportLocations(input);
  const supported = spanBoundarySupportStates(input);
  ctx.save();
  ctx.font = "11px system-ui";
  ctx.textAlign = "center";
  supports.forEach((supportX, i) => {
    const x = pad + supportX * xScale;
    ctx.strokeStyle = supported[i] ? "rgba(96,112,106,0.55)" : "rgba(189,91,50,0.7)";
    ctx.setLineDash(supported[i] ? [3, 5] : [2, 3]);
    ctx.beginPath();
    ctx.moveTo(x, axisY - 10);
    ctx.lineTo(x, axisY + height + 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = supported[i] ? "#60706a" : "#bd5b32";
    ctx.fillText(supported[i] ? `S${i + 1}` : "free", x, axisY - 16);
  });
  input.spans.forEach((span, i) => {
    const mid = pad + ((supports[i] + supports[i + 1]) / 2) * xScale;
    ctx.fillStyle = "#60706a";
    ctx.fillText(`Span ${i + 1}: ${spanSystemLabel(span.system)}`, mid, axisY + height + 46);
  });
  ctx.restore();
}

function drawDownIndicator(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = "#60706a";
  ctx.fillStyle = "#60706a";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 38);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 30);
  ctx.lineTo(x, y + 39);
  ctx.lineTo(x + 5, y + 30);
  ctx.stroke();
  ctx.font = "12px system-ui";
  ctx.fillText("down", x + 10, y + 25);
  ctx.restore();
}

function drawStressLimitDiagram(ctx, canvas, samples, pad, axisY, height, title, topColor, bottomColor) {
  const total = samples[samples.length - 1].x;
  const max = Math.max(1, ...samples.flatMap((s) => [Math.abs(s.top), Math.abs(s.bottom), Math.abs(s.tensileLimit), Math.abs(s.compressionLimit)]));
  const midY = axisY;
  const xScale = (canvas.width - 2 * pad) / total;
  const yScale = (height / 2) / max;
  ctx.fillStyle = "#17211d";
  ctx.font = "15px system-ui";
  ctx.fillText(title, pad, midY - height / 2 - 22);
  ctx.strokeStyle = "#d7ddd8";
  ctx.beginPath();
  ctx.moveTo(pad, midY);
  ctx.lineTo(canvas.width - pad, midY);
  ctx.stroke();
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => midY - s.tensileLimit * yScale, "#a16207", [8, 6]);
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => midY - s.compressionLimit * yScale, "#a16207", [8, 6]);
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => midY - s.top * yScale, topColor);
  drawPolyline(ctx, samples, (s) => pad + s.x * xScale, (s) => midY - s.bottom * yScale, bottomColor);
  ctx.fillStyle = "#60706a";
  ctx.fillText(`top face`, pad, midY + height / 2 + 28);
  ctx.fillStyle = topColor;
  ctx.fillText(`top`, pad + 72, midY + height / 2 + 28);
  ctx.fillStyle = bottomColor;
  ctx.fillText(`bottom`, pad + 116, midY + height / 2 + 28);
  ctx.fillStyle = "#60706a";
  ctx.fillText(`stress checks: tension ${samples[0].tensileLimit.toFixed(2)} MPa, compression ${Math.abs(samples[0].compressionLimit).toFixed(2)} MPa`, pad + 190, midY + height / 2 + 28);
}

function drawPolyline(ctx, samples, xFn, yFn, color, dash = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash(dash);
  ctx.beginPath();
  samples.forEach((sample, i) => {
    const x = xFn(sample);
    const y = yFn(sample);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawDiagram(ctx, canvas, samples, key, pad, axisY, height, title, color) {
  const total = samples[samples.length - 1].x;
  if (key === "defl") {
    drawDownwardDiagram(ctx, canvas, samples, key, pad, axisY, height, title, color);
    return;
  }
  const max = Math.max(0.001, ...samples.map((s) => Math.abs(s[key])));
  const xScale = (canvas.width - 2 * pad) / total;
  const yScale = (height / 2) / max;
  ctx.strokeStyle = "#d7ddd8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, axisY);
  ctx.lineTo(canvas.width - pad, axisY);
  ctx.stroke();
  ctx.fillStyle = "#17211d";
  ctx.font = "15px system-ui";
  ctx.fillText(title, pad, axisY - height / 2 - 18);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  samples.forEach((sample, i) => {
    const x = pad + sample.x * xScale;
    const y = axisY - sample[key] * yScale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = "#60706a";
  ctx.fillText(`max |value| ${max.toFixed(1)}`, canvas.width - pad - 130, axisY - height / 2 - 18);
}

function drawDownwardDiagram(ctx, canvas, samples, key, pad, axisY, height, title, color) {
  const total = Math.max(1e-9, samples[samples.length - 1].x);
  const max = Math.max(0.001, ...samples.map((s) => Math.abs(s[key])));
  const xScale = (canvas.width - 2 * pad) / total;
  const yScale = height / max;
  const zeroY = axisY - height / 2;
  ctx.strokeStyle = "#d7ddd8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, zeroY);
  ctx.lineTo(canvas.width - pad, zeroY);
  ctx.stroke();
  ctx.fillStyle = "#17211d";
  ctx.font = "15px system-ui";
  ctx.fillText(`${title} - plotted downward`, pad, zeroY - 18);
  drawDeflectionSupportMarkers(ctx, state.result?.input, pad, zeroY, height, xScale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  samples.forEach((sample, i) => {
    const x = pad + sample.x * xScale;
    const y = zeroY + Math.abs(sample[key]) * yScale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  drawDownIndicator(ctx, canvas.width - pad - 70, zeroY + 8);
  ctx.fillStyle = "#60706a";
  ctx.fillText(`zero line = undeformed member`, pad, zeroY + height + 28);
  ctx.fillText(`max downward ${max.toFixed(1)} mm`, canvas.width - pad - 170, zeroY - 18);
}

function drawSupport(ctx, x, y) {
  ctx.fillStyle = "#60706a";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 14, y + 26);
  ctx.lineTo(x + 14, y + 26);
  ctx.closePath();
  ctx.fill();
}

function drawFreeTip(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = "#bd5b32";
  ctx.fillStyle = "#bd5b32";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x, y + 22);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("free tip", x, y - 30);
  ctx.restore();
}

function makeMatrix(r, c) {
  return Array.from({ length: r }, () => Array(c).fill(0));
}

function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    const pivot = M[i][i] || 1e-12;
    for (let j = i; j <= n; j++) M[i][j] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = M[k][i];
      for (let j = i; j <= n; j++) M[k][j] -= factor * M[i][j];
    }
  }
  return M.map((row) => row[n]);
}

function multiplyMatrixVector(A, x) {
  return A.map((row) => row.reduce((sum, v, i) => sum + v * x[i], 0));
}

function subtract(a, b) {
  return a.map((v, i) => v - b[i]);
}

function maxAbs(items, key) {
  return items.reduce((best, item) => (Math.abs(item[key]) > Math.abs(best.value) ? { value: item[key], x: item.x } : best), { value: 0, x: 0 });
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function normaliseFixityPercent(value) {
  const numeric = Number(value);
  return clamp(Number.isFinite(numeric) ? numeric : 0, 0, 100);
}

function connectionFixityRatio(input) {
  return normaliseFixityPercent(input.columnFixity) / 100;
}

function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

function clear(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

window.runAiAdjustTool = runAiAdjustTool;
window.switchTab = switchTab;

init();
