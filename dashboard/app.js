/* Command center — chunky actions (variant E) */

(function () {
  async function initFullBoot() {
    await loadCounts();
    await loadBudget();
    await loadWorkflowSettings();
    await loadLocationSettings();
    await loadRankSettings();
    await loadOptimizeLabSettings();
    await loadSchedule();
    await loadPrefixes();
    await refreshPanel();
    render();
    const jobs = await api("/api/jobs");
    if (jobs.running) startPolling();
  }

  const WORKFLOW_PANELS = new Set([
    "questions",
    "gaps",
    "skipped",
    "filmed",
    "written",
    "optimized",
    "replied",
    "first_page",
    "archived",
    "show_all",
  ]);

  function isWorkflowPanel(panel = state.panel) {
    return WORKFLOW_PANELS.has(panel);
  }

  const PANEL_ROUTES = {
    questions: "/questions",
    gaps: "/questions",
    skipped: "/skipped",
    filmed: "/filmed",
    written: "/written",
    optimized: "/optimized",
    replied: "/replied",
    first_page: "/first-page",
    archived: "/first-page",
    show_all: "/show-all",
    run: "/scouts",
    settings: "/settings",
    discovery: "/settings",
    optimize_lab: "/optimize-lab",
    optimize_lab_settings: "/optimize-lab/settings",
    optimize_lab_connections: "/optimize-lab/connections",
    brain: "/optimize-lab",
  };

  const ROUTE_PANEL = {
    questions: "questions",
    gaps: "questions",
    skipped: "skipped",
    filmed: "filmed",
    written: "written",
    optimized: "optimized",
    replied: "replied",
    "first-page": "first_page",
    archived: "first_page",
    "show-all": "show_all",
    run: "run",
    scout: "run",
    scouts: "run",
    jobs: "run",
    settings: "settings",
    discovery: "settings",
    "optimize-lab": "optimize_lab",
    brain: "optimize_lab",
  };

  const MODULE_LABELS = {
    keywords: "Keywords",
    competitors: "Competitors",
    system: "System",
  };

  function parseRoute() {
    const raw = window.location.pathname.replace(/^\/+|\/+$/g, "");
    if (!raw) return { panel: "questions" };
    if (raw === "competitor" || raw.startsWith("competitor/")) {
      return { panel: "questions", redirectFrom: window.location.pathname };
    }
    if (raw === "optimize-lab" || raw.startsWith("optimize-lab/")) {
      const sub = raw.split("/")[1] || "";
      if (sub === "settings") return { panel: "optimize_lab_settings" };
      if (sub === "connections") return { panel: "optimize_lab_connections" };
      return { panel: "optimize_lab" };
    }
    return { panel: ROUTE_PANEL[raw] || "questions" };
  }

  function pathToPanel() {
    return parseRoute().panel;
  }

  function panelToPath(panel) {
    return PANEL_ROUTES[panel] || "/questions";
  }

  function isSettingsPanel() {
    return state.panel === "settings" || state.panel === "discovery";
  }

  function navigateToPanel(panel) {
    const path = panelToPath(panel);
    if (window.location.pathname !== path) {
      history.pushState({ panel }, "", path);
    }
    state.panel = panel;
    state.search = "";
    if (!isSettingsPanel()) {
      state.focusEditRoot = null;
      state.editingSeedId = null;
      if (state.seedFinder.open) {
        state.seedFinder = defaultSeedFinderState();
      }
    }
    refreshPanel();
  }

  const SETTINGS_COLLAPSED_KEY = "ansaur_settings_collapsed";
  const RAIL_COLLAPSED_KEY = "ansaur_rail_collapsed";

  function loadRailCollapsed() {
    try {
      return localStorage.getItem(RAIL_COLLAPSED_KEY) === "1";
    } catch (_) {}
    return false;
  }

  function saveRailCollapsed(collapsed) {
    try {
      localStorage.setItem(RAIL_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch (_) {}
  }

  function railToggleLabel(collapsed) {
    return collapsed ? "Show sidebar" : "Hide sidebar";
  }

  function railToggleIcon(collapsed) {
    return collapsed ? "»" : "«";
  }

  function animateRailToggleIcon(icon) {
    if (!icon) return;
    icon.classList.remove("rail-toggle-icon--twist");
    void icon.offsetWidth;
    icon.classList.add("rail-toggle-icon--twist");
    icon.addEventListener(
      "animationend",
      () => icon.classList.remove("rail-toggle-icon--twist"),
      { once: true }
    );
  }

  function toggleRailCollapsed() {
    state.railCollapsed = !state.railCollapsed;
    saveRailCollapsed(state.railCollapsed);
    const shell = document.querySelector(".variant-a");
    if (shell) {
      shell.classList.toggle("is-rail-collapsed", state.railCollapsed);
    }
    document.querySelectorAll("[data-rail-toggle]").forEach((btn) => {
      const label = railToggleLabel(state.railCollapsed);
      btn.setAttribute("aria-expanded", state.railCollapsed ? "false" : "true");
      btn.setAttribute("aria-label", label);
      btn.setAttribute("data-tooltip", label);
      const icon = btn.querySelector(".rail-toggle-icon");
      if (icon) {
        icon.textContent = railToggleIcon(state.railCollapsed);
        animateRailToggleIcon(icon);
      }
    });
  }

  function defaultSeedFinderState() {
    return {
      open: false,
      step: 1,
      category: "",
      niche: "",
      words: "",
      topic: "",
      suggestions: [],
      selected: [],
      savedPhrases: [],
      savedAdded: 0,
      replaceExisting: false,
      labsUsed: false,
      llmUsed: false,
      loading: false,
      error: null,
    };
  }

  function loadSettingsCollapsed() {
    try {
      const raw = localStorage.getItem(SETTINGS_COLLAPSED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((id) => typeof id === "string");
      }
    } catch (_) {}
    return [];
  }

  function saveSettingsCollapsed(ids) {
    try {
      localStorage.setItem(SETTINGS_COLLAPSED_KEY, JSON.stringify(ids));
    } catch (_) {}
  }

  function isSettingsSectionCollapsed(id) {
    return state.settingsCollapsed.includes(id);
  }

  function toggleSettingsSection(id) {
    const idx = state.settingsCollapsed.indexOf(id);
    if (idx >= 0) state.settingsCollapsed.splice(idx, 1);
    else state.settingsCollapsed.push(id);
    saveSettingsCollapsed(state.settingsCollapsed);
  }

  function expandSettingsSection(id) {
    const idx = state.settingsCollapsed.indexOf(id);
    if (idx < 0) return;
    state.settingsCollapsed.splice(idx, 1);
    saveSettingsCollapsed(state.settingsCollapsed);
  }

  function syncSeedFinderSelection() {
    const sf = state.seedFinder;
    if (!sf.open || sf.step !== 2) return;
    const selected = [];
    document.querySelectorAll("[data-seed-pick-index]").forEach((el) => {
      if (!el.checked) return;
      const idx = Number(el.dataset.seedPickIndex);
      const item = sf.suggestions[idx];
      if (item?.text) selected.push(item.text);
    });
    sf.selected = selected;
  }

  function seedFinderKindLabel(kind) {
    if (kind === "topic_exact") return "Core topic";
    if (kind === "search_intent") return "Common search";
    if (kind === "problem_phrase") return "Problem people search";
    if (kind === "trade_term") return "Role or specialty";
    if (kind === "starter_word") return "You suggested this";
    if (kind === "search_demand") return "Has search volume";
    if (kind === "from_topic") return "From your niche";
    return "Suggested";
  }

  function seedFinderOverlay() {
    const sf = state.seedFinder;
    if (!sf.open || !isSettingsPanel()) return "";

    const step = sf.step;
    const title =
      step === 1
        ? "Find seed phrases"
        : step === 2
          ? "Choose phrases to save"
          : "Phrases saved";

    const stepLabel = step === 3 ? "Done" : `Step ${step} of 2`;

    let body = "";
    if (step === 1) {
      body = `
        <p class="seed-onboard-lead">
          <strong>Seed phrases</strong> are the short keywords inside real questions.
          People search <span class="mono">how to use vlookup in google sheets</span>;
          the seeds are <span class="mono">google sheets</span> and <span class="mono">vlookup</span>.
          Describe your niche and we will suggest phrases like those.
        </p>
        <div class="seed-finder-fields">
          <label class="seed-onboard-field">
            <span class="seed-onboard-label">Your niche</span>
            <span class="seed-onboard-field-hint">The topic you create about.</span>
            <input
              type="text"
              id="seed-finder-niche"
              class="seed-onboard-input"
              placeholder="e.g. google sheets, sourdough baking, dental implants"
              value="${esc(sf.niche || sf.topic)}"
            />
          </label>
          <label class="seed-onboard-field">
            <span class="seed-onboard-label">Category <span class="seed-onboard-optional">optional</span></span>
            <span class="seed-onboard-field-hint">Broader field your niche sits in.</span>
            <input
              type="text"
              id="seed-finder-category"
              class="seed-onboard-input"
              placeholder="e.g. software tools, personal finance, fitness"
              value="${esc(sf.category)}"
            />
          </label>
          <label class="seed-onboard-field">
            <span class="seed-onboard-label">Words you already know <span class="seed-onboard-optional">optional</span></span>
            <span class="seed-onboard-field-hint">Comma-separated. We will build on these.</span>
            <textarea
              id="seed-finder-words"
              class="seed-onboard-textarea"
              rows="2"
              placeholder="e.g. formula, pivot table, vlookup"
            >${esc(sf.words)}</textarea>
          </label>
        </div>
        ${sf.error ? `<p class="seed-onboard-error" role="alert">${esc(sf.error)}</p>` : ""}`;
    } else if (step === 2) {
      const rows = (sf.suggestions || [])
        .map((item, idx) => {
          const checked = sf.selected.includes(item.text);
          const vol =
            item.volume != null && item.volume > 1
              ? `<span class="seed-onboard-volume">${fmtVolTotal(item.volume)} / mo</span>`
              : "";
          return `<label class="seed-onboard-option${checked ? " seed-onboard-option--on" : ""}">
            <input type="checkbox" data-seed-pick-index="${idx}" ${checked ? "checked" : ""} />
            <span class="seed-onboard-option-body">
              <span class="seed-onboard-option-text mono">${esc(item.text)}</span>
              <span class="seed-onboard-option-meta">
                <span class="seed-onboard-kind">${esc(seedFinderKindLabel(item.kind))}</span>
                ${vol}
              </span>
            </span>
          </label>`;
        })
        .join("");
      const labsNote = sf.llmUsed
        ? "Some suggestions were expanded from your description."
        : sf.labsUsed
          ? "Monthly search volumes are from real Google data."
          : "Suggestions come from your inputs. Run Search on Scout to check live volume.";
      body = `
        <p class="seed-onboard-lead">
          Check the phrases that fit your niche, then save them.
          Ansaur pairs each seed with question starters
          (<span class="mono">how to …</span>, <span class="mono">can …</span>, <span class="mono">what is …</span>)
          to find questions with real search volume.
        </p>
        <p class="seed-onboard-topic-ref">Niche: <strong>${esc(sf.niche || sf.topic)}</strong>${sf.category ? ` · Category: <strong>${esc(sf.category)}</strong>` : ""}</p>
        <div class="seed-onboard-options">${rows || "<p class=\"seed-onboard-error\">No matches for that description. Go back and try a shorter niche, or add words you already know.</p>"}</div>
        <label class="seed-onboard-replace">
          <input type="checkbox" id="seed-finder-replace" ${sf.replaceExisting ? "checked" : ""} />
          Replace my current seed phrase list (don't add to it)
        </label>
        <p class="seed-onboard-footnote">${esc(labsNote)}</p>
        ${sf.error ? `<p class="seed-onboard-error" role="alert">${esc(sf.error)}</p>` : ""}`;
    } else {
      const addedNote =
        sf.savedAdded > 0
          ? `${sf.savedAdded} new phrase${sf.savedAdded === 1 ? "" : "s"} added.`
          : "Every selected phrase was already on your list.";
      body = `
        <p class="seed-onboard-lead">
          <strong>${sf.savedPhrases.length}</strong> phrase${sf.savedPhrases.length === 1 ? "" : "s"} saved.
          ${esc(addedNote)} Run Search on Scout when you are ready to hunt questions.
        </p>
        <ul class="seed-onboard-saved">${sf.savedPhrases.map((t) => `<li class="mono">${esc(t)}</li>`).join("")}</ul>`;
    }

    const primaryLabel =
      step === 1
        ? sf.loading
          ? "Looking for phrases…"
          : "Suggest phrases"
        : step === 2
          ? sf.loading
            ? "Saving…"
            : `Save ${sf.selected.length || ""} phrase${sf.selected.length === 1 ? "" : "s"}`.trim()
          : "Done";

    const primaryDisabled =
      sf.loading || (step === 2 && !sf.selected.length) ? "disabled" : "";

    const secondary =
      step === 1
        ? `<button type="button" class="btn-md btn-ghost" data-seed-finder-cancel>Cancel</button>`
        : step === 2
          ? `<button type="button" class="btn-md btn-ghost" data-seed-finder-back>Back</button>`
          : "";

    return `
      <div class="seed-onboard-backdrop" data-seed-finder-overlay role="dialog" aria-modal="true" aria-labelledby="seed-onboard-title">
        <div class="seed-onboard-card">
          <div class="seed-onboard-head">
            <p class="seed-onboard-kicker">${esc(stepLabel)}</p>
            <h2 id="seed-onboard-title" class="seed-onboard-title">${esc(title)}</h2>
          </div>
          <div class="seed-onboard-body">${body}</div>
          <div class="seed-onboard-actions">
            ${secondary}
            <button type="button" class="btn-md btn-primary" data-seed-finder-primary ${primaryDisabled}>${esc(primaryLabel)}</button>
          </div>
        </div>
      </div>`;
  }

  function openSeedFinder() {
    if (!isSettingsPanel()) return;
    expandSettingsSection("seed-phrases");
    state.seedFinder = {
      ...defaultSeedFinderState(),
      open: true,
      category: "",
      niche: "",
      words: "",
      topic: "",
      step: 1,
    };
    render();
    requestAnimationFrame(() => {
      const el = document.getElementById("seed-finder-niche") || document.getElementById("seed-finder-category");
      if (el) {
        el.focus();
        if (el.value) el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  function closeSeedFinder() {
    state.seedFinder = defaultSeedFinderState();
    render();
  }

  async function runSeedFinderSuggest() {
    const sf = state.seedFinder;
    const categoryEl = document.getElementById("seed-finder-category");
    const nicheEl = document.getElementById("seed-finder-niche");
    const wordsEl = document.getElementById("seed-finder-words");
    const category = (categoryEl?.value || sf.category || "").trim();
    const niche = (nicheEl?.value || sf.niche || sf.topic || "").trim();
    const words = (wordsEl?.value || sf.words || "").trim();
    if (!niche && !category) {
      sf.error = "Enter your niche or a category.";
      render();
      return;
    }
    sf.category = category;
    sf.niche = niche;
    sf.words = words;
    sf.topic = niche || category;
    sf.loading = true;
    sf.error = null;
    render();
    try {
      const data = await api("/api/seed-phrases/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, niche, words, topic: sf.topic }),
      });
      sf.suggestions = data.suggestions || [];
      sf.labsUsed = Boolean(data.labs_used);
      sf.llmUsed = Boolean(data.llm_used);
      sf.selected = (data.default_selected || []).filter((t) =>
        sf.suggestions.some((s) => s.text === t),
      );
      if (!sf.selected.length && sf.suggestions.length) {
        sf.selected = [sf.suggestions[0].text];
      }
      sf.step = 2;
    } catch (err) {
      sf.error = err.message || "Could not load suggestions. Try again.";
    } finally {
      sf.loading = false;
      render();
    }
  }

  async function runSeedFinderSave() {
    const sf = state.seedFinder;
    syncSeedFinderSelection();
    const phrases = [...sf.selected];
    if (!phrases.length) {
      sf.error = "Select at least one phrase.";
      render();
      return;
    }
    sf.loading = true;
    sf.error = null;
    render();
    try {
      const replace = Boolean(sf.replaceExisting);
      const before = new Set((state.prefixData?.seed_phrases || []).map((s) => s.text));
      const data = await api("/api/seed-phrases/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrases, replace }),
      });
      if (data.seed_phrases) {
        state.prefixData = { ...(state.prefixData || {}), seed_phrases: data.seed_phrases };
      } else {
        await loadPrefixes();
      }
      sf.savedPhrases = phrases;
      sf.savedAdded = phrases.filter((text) => !before.has(text)).length;
      sf.step = 3;
      expandSettingsSection("seed-phrases");
    } catch (err) {
      sf.error = err.message || "Could not save phrases. Try again.";
    } finally {
      sf.loading = false;
      render();
    }
  }

  function finishSeedFinder() {
    closeSeedFinder();
  }

  function bindSeedFinder() {
    const sf = state.seedFinder;
    if (!sf.open || !isSettingsPanel()) return;

    document.querySelector("[data-seed-finder-overlay]")?.addEventListener("click", (e) => {
      const live = state.seedFinder;
      if (e.target?.matches?.("[data-seed-finder-overlay]") && live.step === 1) {
        closeSeedFinder();
      }
    });

    document.querySelector("[data-seed-finder-cancel]")?.addEventListener("click", () => {
      closeSeedFinder();
    });

    document.querySelector("[data-seed-finder-back]")?.addEventListener("click", () => {
      state.seedFinder.step = 1;
      state.seedFinder.error = null;
      render();
    });

    document.querySelector("[data-seed-finder-primary]")?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const live = state.seedFinder;
      if (live.loading) return;
      if (live.step === 1) await runSeedFinderSuggest();
      else if (live.step === 2) await runSeedFinderSave();
      else finishSeedFinder();
    });

    document.querySelectorAll("[data-seed-pick-index]").forEach((el) => {
      el.addEventListener("change", () => {
        syncSeedFinderSelection();
        render();
      });
    });

    const replaceEl = document.getElementById("seed-finder-replace");
    if (replaceEl) {
      replaceEl.addEventListener("change", () => {
        state.seedFinder.replaceExisting = replaceEl.checked;
      });
    }

    const categoryEl = document.getElementById("seed-finder-category");
    const nicheEl = document.getElementById("seed-finder-niche");
    const wordsEl = document.getElementById("seed-finder-words");
    [categoryEl, nicheEl, wordsEl].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", () => {
        const live = state.seedFinder;
        if (el === categoryEl) live.category = categoryEl.value;
        if (el === nicheEl) live.niche = nicheEl.value;
        if (el === wordsEl) live.words = wordsEl.value;
        live.topic = (live.niche || live.category || "").trim();
        live.error = null;
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && el.tagName !== "TEXTAREA") {
          e.preventDefault();
          if (!state.seedFinder.loading) runSeedFinderSuggest();
        }
      });
    });
  }

  function settingsSection(id, title, body, opts = {}) {
    const collapsed = isSettingsSectionCollapsed(id);
    const headExtra = opts.headExtra || "";
    const sectionClass = opts.sectionClass ? ` ${opts.sectionClass}` : "";
    return `
        <section class="run-section settings-section${sectionClass}${collapsed ? " settings-section--collapsed" : ""}" data-settings-section="${esc(id)}">
          <div class="settings-section-head">
            <button type="button" class="settings-section-toggle" data-toggle-settings-section="${esc(id)}" aria-expanded="${collapsed ? "false" : "true"}" aria-controls="settings-section-${esc(id)}">
              <span class="settings-section-chevron" aria-hidden="true"></span>
              <span class="run-heading settings-section-title" role="heading" aria-level="3">${esc(title)}</span>
            </button>
            ${headExtra}
          </div>
          <div class="settings-section-body" id="settings-section-${esc(id)}" ${opts.bodyAttrs || ""} ${collapsed ? "hidden" : ""}>
            ${body}
          </div>
        </section>`;
  }

  const state = {
    panel: parseRoute().panel,
    search: "",
    questions: [],
    skipped: [],
    firstPage: [],
    filmed: [],
    written: [],
    optimized: [],
    replied: [],
    showAll: [],
    questionsCount: 0,
    skippedCount: 0,
    firstPageCount: 0,
    filmedCount: 0,
    writtenCount: 0,
    optimizedCount: 0,
    repliedCount: 0,
    showAllCount: 0,
    workflowAnimating: false,
    job: null,
    jobRunning: false,
    budget: null,
    pollTimer: null,
    prefixData: null,
    questionsSort: "volume",
    showAllSort: "volume",
    hiddenPrefixRoots: [],
    prefixHideOpen: false,
    workflowSettings: null,
    locationSettings: null,
    rankSettings: null,
    rankMatchSummary: null,
    volumeColumns: null,
    volumeTargetCount: 1,
    locationSearchTimer: null,
    locationSearchResults: {},
    countriesList: null,
    countriesLoading: false,
    settingsRenderPending: false,
    settingsBlurBound: false,
    citySearchCountryIso: "US",
    editingSeedId: null,
    seedSearchReminder: null,
    scrollScoutSearch: false,
    focusEditRoot: null,
    prefixSectionStatus: null,
    prefixSectionBusy: false,
    openPrefixRoots: [],
    brainCategory: "all",
    optLabMode: "enhance",
    optLabLastToolMode: "enhance",
    optLabInputMode: "paste",
    optLabUrl: "",
    optLabDraftTitle: "",
    optLabDraftText: "",
    optLabArticle: null,
    optLabScrapeLoading: false,
    optLabBlocks: [],
    optLabQueueDraining: false,
    optLabSessionKey: null,
    optLabFreshOutputId: null,
    optLabError: null,
    optLabArticleJustLoaded: false,
    optLabTipIndex: null,
    optLabInspectToolId: null,
    optLabSessions: [],
    optLabSourceArticle: null,
    optLabFreshDeskKey: null,
    optLabWellDragover: false,
    openaiConfigured: false,
    optLabSettings: { articles: [], videos: [], technique_notes: {} },
    schedule: null,
    jobHistory: [],
    creditEstimates: {},
    testResults: null,
    testRunning: false,
    settingsCollapsed: loadSettingsCollapsed(),
    railCollapsed: loadRailCollapsed(),
    seedFinder: defaultSeedFinderState(),
    topUpOpen: false,
    topUpLoading: false,
    topUpError: null,
    scoutScene: { crtPhase: "off", jobKey: null, poweredAt: null },
    scoutCrtTimer: null,
    scoutTown: null,
    scoutTownTimer: null,
    scoutDemo: false,
    scoutDemoTickTimer: null,
    brainFilterBound: false,
  };

  const SCOUT_WORLD_ZOOM = 3.0;
  const SCOUT_TOWN_WORLD_SRC = "/assets/scout-town-world.png?v=2";
  const SCOUT_CRT_FRAME_SRC = "/assets/scout-crt-desk-8bit.png?v=1";
  const SCOUT_WALK_MS = 480;
  const SCOUT_WALK_FRAMES = 6;
  const SCOUT_PAUSE_MS = 500;
  const SCOUT_DIALOGUE_MS = 3400;
  const SCOUT_TYPE_MS = 32;
  const SCOUT_CRT_POWER_MS = 3600;
  const SCOUT_CRT_ENTER_MS = 3400;
  const SCOUT_CRT_FS_EXIT_MS = 240;
  const SCOUT_DEMO_STEPS = [
    {
      message: "Search: can google sheets automate reports",
      keywords: ["can google sheets automate weekly reports"],
    },
    {
      message: "Search: how google sheets import csv",
      keywords: ["how to import csv into google sheets"],
    },
    {
      message: "Search: what google sheets arrayformula does",
      keywords: ["what does arrayformula do in google sheets"],
    },
    {
      message: "Search: why google sheets slow with large data",
      keywords: ["why is google sheets slow with lots of data"],
    },
    {
      message: "Search: does google sheets work offline",
      keywords: ["does google sheets work offline"],
    },
    {
      message: "Search: is google sheets free for business",
      keywords: ["is google sheets free for business use"],
    },
  ];

  const HIDE_ACTION_OPTIONS = [
    { id: "filmed", label: "Film it" },
    { id: "written", label: "Write" },
    { id: "optimized", label: "Optimize" },
    { id: "replied", label: "Reply" },
  ];

  function defaultHideFromQuestions() {
    return HIDE_ACTION_OPTIONS.map((o) => o.id);
  }

  function willHideFromQuestions(action) {
    const hide = state.workflowSettings?.hide_from_questions ?? defaultHideFromQuestions();
    if (!hide?.length) return false;
    if (action === "reply") return hide.includes("replied");
    if (ADDITIVE_ACTIONS.has(action)) return hide.includes(action);
    return false;
  }

  function workflowHideSection() {
    const hide = state.workflowSettings?.hide_from_questions ?? defaultHideFromQuestions();
    const checks = HIDE_ACTION_OPTIONS.map(
      (o) =>
        `<label class="workflow-hide-option"><input type="checkbox" data-hide-action="${o.id}" ${hide.includes(o.id) ? "checked" : ""} /> ${esc(o.label)}</label>`
    ).join("");
    return settingsSection(
      "questions-queue",
      "Questions queue",
      `
          <p class="disc-hint">Pick which actions remove a keyword from <strong>Questions</strong>. OR logic: if a keyword matches <em>any</em> checked action, it is hidden. It still appears in Filmed / Written / Optimized / Replied tabs.</p>
          <div class="workflow-hide-presets">
            <button type="button" class="btn-sm btn-ghost" id="hide-preset-any">Any action (default)</button>
            <button type="button" class="btn-sm btn-ghost" id="hide-preset-none">Never hide</button>
          </div>
          <div class="workflow-hide-options">${checks}</div>
          <div class="disc-rules" style="margin-top:12px">
            <button type="button" class="btn-md btn-black" id="save-workflow-settings">Save queue rules</button>
          </div>`
    );
  }

  function readHideFromQuestionsForm() {
    return [...document.querySelectorAll("[data-hide-action]")]
      .filter((el) => el.checked)
      .map((el) => el.dataset.hideAction);
  }

  function setHideFromQuestionsForm(actions) {
    const set = new Set(actions);
    document.querySelectorAll("[data-hide-action]").forEach((el) => {
      el.checked = set.has(el.dataset.hideAction);
    });
  }

  function secondarySearchTypes(kind) {
    return kind === "city" ? "City,DMA Region,Municipality" : "Country";
  }

  function countrySelectOptions(selectedCode) {
    const countries = state.countriesList || [];
    if (!countries.length) {
      return '<option value="">Loading countries…</option>';
    }
    const selected = selectedCode != null ? Number(selectedCode) : null;
    const opts = countries.map((c) => {
      const code = Number(c.location_code);
      const sel = selected === code ? " selected" : "";
      return `<option value="${code}"${sel}>${esc(c.location_name)}</option>`;
    });
    return `<option value="">Choose a country…</option>${opts.join("")}`;
  }

  function cityCountrySelectOptions(selectedIso) {
    const countries = state.countriesList || [];
    if (!countries.length) {
      return '<option value="US">United States</option>';
    }
    const selected = (selectedIso || "US").toUpperCase();
    return countries
      .map((c) => {
        const iso = (c.country_iso_code || "").toUpperCase();
        if (!iso) return "";
        const sel = selected === iso ? " selected" : "";
        return `<option value="${iso}"${sel}>${esc(c.location_name)}</option>`;
      })
      .filter(Boolean)
      .join("");
  }

  function locationPickerField(kind, ls) {
    if (kind === "city") {
      const countryIso = state.citySearchCountryIso || "US";
      return `
              <label class="location-picker-label" for="loc-city-country">Country</label>
              <select id="loc-city-country" class="search location-country-select">
                ${cityCountrySelectOptions(countryIso)}
              </select>
              <label class="location-picker-label" for="loc-city-search">City name</label>
              <div class="prefix-add">
                <input type="search" id="loc-city-search" class="search location-search-input" data-loc-target="secondary" data-loc-types="${secondarySearchTypes(kind)}" placeholder="e.g. Buffalo, Columbus, or London" autocomplete="off" />
              </div>
              <p class="disc-hint location-search-hint">Type the city name. Results are ranked by city first, not state. Add more letters to narrow a long list.</p>
              <div class="location-search-results" data-loc-results="secondary" hidden></div>`;
    }
    return `
              <label class="location-picker-label" for="loc-country-select">Country</label>
              <select id="loc-country-select" class="search location-country-select">
                ${countrySelectOptions(ls.secondary_location_code)}
              </select>`;
  }

  function rankTargetRow(value, index) {
    return `<tr>
      <td class="kw">${esc(value)}</td>
      <td class="actions-cell">
        <div class="action-groups action-chunky">
          <button type="button" class="btn-sm btn-ghost" data-remove-rank-target="${index}">Remove</button>
        </div>
      </td>
    </tr>`;
  }

  function rankSettingsSection() {
    const rs = state.rankSettings || {};
    const summary = state.rankMatchSummary || {};
    const matches = rs.rank_matches || (rs.rank_match ? [rs.rank_match] : ["bettersheets"]);
    const matchLabel = summary.label || matches.join(", ");
    const targetRows = matches.map((value, index) => rankTargetRow(value, index)).join("");
    return settingsSection(
      "rank-checking",
      "Rank checking",
      `
          <p class="disc-hint">When Scan scouts check Google page 1, they look for URLs from <strong>your</strong> site or YouTube channel. Add every company name, domain, or channel you want to count as a page 1 win.</p>
          <table class="data-table prefix-table">
            <thead><tr><th>Brand / domain / channel</th><th>Actions</th></tr></thead>
            <tbody>${targetRows || "<tr><td colspan='2'>No brands yet. Add one below.</td></tr>"}</tbody>
          </table>
          <div class="prefix-add">
            <input type="text" id="new-rank-target" class="search" placeholder="e.g. better sheets, bettersheets, or example.com" />
            <button type="button" class="btn-md btn-primary" id="add-rank-target-btn">Add</button>
          </div>
          <p class="disc-hint">Currently matching: <strong>${esc(matchLabel)}</strong></p>
          <div class="disc-rules" style="margin-top:12px">
            <button type="button" class="btn-md btn-black" id="save-rank-settings">Save rank settings</button>
          </div>`
    );
  }

  function locationSettingsSection() {
    const ls = state.locationSettings || {};
    const enabled = Boolean(ls.secondary_enabled);
    const kind = ls.secondary_kind === "city" ? "city" : "country";
    const hasPick = Boolean(ls.secondary_location_code && ls.secondary_location_name);
    const targetCount = state.volumeTargetCount || (enabled && hasPick ? 2 : 1);
    const pickLabel = hasPick ? ls.secondary_label || ls.secondary_location_name : "None selected";
    const pickDetail = hasPick ? ls.secondary_location_name : "";
    return settingsSection(
      "search-volume",
      "Search volume",
      `
          <p class="disc-hint">Questions shows <strong>Global</strong> search volume by default. Fast and useful everywhere. Turn on a second column if you also want volume for one country or city.</p>
          <div class="disc-rules location-toggles">
            <label><input type="checkbox" id="loc-secondary-enabled" ${enabled ? "checked" : ""} /> Add a second volume column</label>
          </div>
          <div class="location-secondary-panel" id="loc-secondary-panel" ${enabled ? "" : 'hidden'}>
            <p class="disc-hint">Pick <strong>one</strong> place. Find Volume will fetch global + this market (${targetCount}× API calls per batch).</p>
            <div class="location-kind-row">
              <span class="location-picker-label">Location type</span>
              <label class="location-kind-option"><input type="radio" name="loc-secondary-kind" value="country" ${kind === "country" ? "checked" : ""} /> Country</label>
              <label class="location-kind-option"><input type="radio" name="loc-secondary-kind" value="city" ${kind === "city" ? "checked" : ""} /> City</label>
            </div>
            <div class="location-picker" data-loc-target="secondary">
              <p class="disc-hint location-picker-current">Selected: <strong>${esc(pickLabel)}</strong>${pickDetail ? ` <span class="mono">(${esc(pickDetail)})</span>` : ""}</p>
              ${locationPickerField(kind, ls)}
              ${hasPick ? `<button type="button" class="btn-sm btn-ghost" id="loc-clear-secondary">Clear selection</button>` : ""}
            </div>
          </div>
          <div class="disc-rules" style="margin-top:12px">
            <button type="button" class="btn-md btn-black" id="save-location-settings">Save search volume</button>
          </div>`
    );
  }

  function applySecondaryLocation(loc) {
    if (!state.locationSettings) state.locationSettings = {};
    const kind =
      document.querySelector('input[name="loc-secondary-kind"]:checked')?.value ||
      state.locationSettings.secondary_kind ||
      "country";
    state.locationSettings.secondary_enabled = true;
    state.locationSettings.secondary_kind = kind;
    state.locationSettings.secondary_location_code = loc.location_code;
    state.locationSettings.secondary_location_name = loc.location_name;
    state.locationSettings.secondary_label = loc.label || loc.location_name.split(",")[0];
    state.locationSettings.secondary_location_type = loc.location_type || null;
    if (loc.country_iso_code) {
      state.citySearchCountryIso = String(loc.country_iso_code).toUpperCase();
    }
    render();
  }

  function clearSecondaryLocation() {
    if (!state.locationSettings) return;
    state.locationSettings.secondary_location_code = null;
    state.locationSettings.secondary_location_name = null;
    state.locationSettings.secondary_label = null;
    state.locationSettings.secondary_location_type = null;
    render();
  }
  const SHOW_TEST_SECTION = false;

  const TEST_JOBS = [
    { id: "verify_apis", name: "Verify APIs", desc: "DataForSEO auth, Labs, SERP, YouTube", job: true },
    { id: "mini_pipeline", name: "Mini pipeline", desc: "Harvest 10 keywords + SERP 3 → Questions/First Page", job: true },
  ];

  const SEARCH_RUN_JOBS = [
    {
      id: "volume_fill",
      name: "Find Volume",
      desc: "Fill global search volume, plus your optional local column.",
    },
    {
      id: "harvest_paa",
      name: "People Also Ask",
      desc: "Pull PAA questions from Google for each seed phrase.",
    },
  ];

  const SCAN_RUN_JOBS = [
    {
      id: "serp_all",
      name: "Scan all rankings",
      desc: "Check Google US page 1 for every discovered keyword. Fills Questions and First Page.",
      hero: true,
    },
    {
      id: "recheck_questions",
      name: "Re-check rankings",
      desc: "Scan Questions + Filmed again. Promote wins to First Page.",
    },
  ];

  /** Optional search tools */
  const SEARCH_EXTRA_JOBS = [
    {
      id: "harvest",
      name: "Search one phrase",
      outcome: "Keyword suggestions for a single prefix + seed combo",
      seed: true,
      seedLabel: "Search phrase",
      seedPlaceholder: "e.g. can google sheets",
    },
    {
      id: "harvest_related",
      name: "Related keywords",
      outcome: "Related keywords for your seed",
      seed: true,
      seedLabel: "Seed keyword",
      seedPlaceholder: "google sheets",
    },
    {
      id: "harvest_ideas",
      name: "Keyword ideas",
      outcome: "Keyword ideas from your seed",
      seed: true,
      seedLabel: "Seed keyword",
      seedPlaceholder: "google sheets",
    },
  ];

  const CREDIT_ESTIMATE_JOB_IDS = [
    ...TEST_JOBS.map((j) => j.id),
    ...SEARCH_RUN_JOBS.map((j) => j.id),
    ...SCAN_RUN_JOBS.map((j) => j.id),
    ...SEARCH_EXTRA_JOBS.map((j) => j.id),
  ];

  function patrolKind(taskId, task) {
    const k = task?.kind;
    if (k === "search" || k === "harvest") return "search";
    return "scan";
  }

  function fmtVol(n) {
    if (n == null) return "-";
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
    return String(n);
  }

  function activeVolumeColumns() {
    if (state.volumeColumns?.length) return state.volumeColumns;
    return [{ key: "global_volume", label: "Global", short: "Global" }];
  }

  function volumeHeaderCells() {
    return activeVolumeColumns()
      .map((c) => `<th title="${esc(c.label)}">${esc(c.short || c.label)}</th>`)
      .join("");
  }

  function volumeDataCells(row, { desktopOnly = false } = {}) {
    const extra = desktopOnly ? " is-desktop" : "";
    return activeVolumeColumns()
      .map((c) => `<td class="vol${extra}">${fmtVol(row[c.key])}</td>`)
      .join("");
  }

  function volumeSortOptions(selected) {
    return activeVolumeColumns()
      .map((c) => {
        const val =
          c.key === "global_volume" ? "volume" : c.key === "secondary_volume" ? "secondary_volume" : c.key;
        const label = `${c.short || c.label} volume ↓`;
        return `<option value="${val}" ${selected === val ? "selected" : ""}>${esc(label)}</option>`;
      })
      .join("");
  }

  function fmtVolTotal(n) {
    if (n == null) return "-";
    return n.toLocaleString();
  }

  function sumSearchVolumes(rows) {
    const cols = activeVolumeColumns();
    const totals = Object.fromEntries(cols.map((c) => [c.key, 0]));
    const known = Object.fromEntries(cols.map((c) => [c.key, 0]));
    for (const r of rows) {
      for (const c of cols) {
        if (r[c.key] != null) {
          totals[c.key] += r[c.key];
          known[c.key] += 1;
        }
      }
    }
    return { totals, known, count: rows.length, cols };
  }

  function startsWithPrefixRoot(keyword, root) {
    const r = String(root || "").trim().toLowerCase();
    if (!r) return false;
    const escaped = r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^\\s*${escaped}\\b`, "i").test(String(keyword || "").trim());
  }

  function singleWordPrefixRoots() {
    const roots = new Set();
    for (const p of state.prefixData?.prefixes || []) {
      if (isSingleWordPrefix(p.text)) {
        roots.add(prefixPhraseLabel(p.text).toLowerCase());
      }
    }
    return [...roots].sort((a, b) => a.localeCompare(b));
  }

  function isPrefixRootHidden(root) {
    return state.hiddenPrefixRoots.includes(String(root || "").toLowerCase());
  }

  function togglePrefixRootHidden(root) {
    const r = String(root || "").toLowerCase();
    const idx = state.hiddenPrefixRoots.indexOf(r);
    if (idx >= 0) state.hiddenPrefixRoots.splice(idx, 1);
    else state.hiddenPrefixRoots.push(r);
  }

  function visibleQuestions(rows) {
    const list = rows || [];
    if (!state.hiddenPrefixRoots.length) return list;
    return list.filter((r) => {
      for (const root of state.hiddenPrefixRoots) {
        if (startsWithPrefixRoot(r.keyword, root)) return false;
      }
      return true;
    });
  }

  function searchVolumeBar(rows, { showBulkActions = false } = {}) {
    const q = state.search.trim();
    if (!q) return "";
    const s = sumSearchVolumes(rows);
    if (s.count === 0) {
      return `<div class="search-volume-bar" role="status">
        <span class="search-volume-query">No matches for “${esc(q)}”</span>
      </div>`;
    }
    const parts = [];
    for (const c of s.cols) {
      if (s.known[c.key] > 0) {
        parts.push(`<strong>${fmtVolTotal(s.totals[c.key])}</strong> ${esc(c.short || c.label)}`);
      }
    }
    const totals = parts.length
      ? `<span class="search-volume-totals">${parts.join(" · ")} combined</span>`
      : `<span class="search-volume-totals">Volume not loaded yet</span>`;
    const missingGlobal = s.count - (s.known.global_volume || 0);
    const missingNote =
      missingGlobal > 0
        ? `<span class="search-volume-hint">${missingGlobal} match${missingGlobal === 1 ? "" : "es"} missing volume</span>`
        : "";
    const bulkActions =
      showBulkActions
        ? `<div class="search-bulk-actions" role="group" aria-label="Apply to all search matches">
            <button type="button" class="btn-sm btn-ghost search-bulk-action" data-bulk-action="written" title="Mark all matches as written">Write all</button>
            <button type="button" class="btn-sm btn-ghost search-bulk-action" data-bulk-action="reply" title="Mark all matches as replied">Reply all</button>
            <button type="button" class="btn-sm btn-ghost search-bulk-action" data-bulk-action="optimized" title="Mark all matches as optimized">Optimize all</button>
            <button type="button" class="btn-sm btn-ghost search-bulk-action" data-bulk-action="filmed" title="Mark all matches as filmed">Film all</button>
            <button type="button" class="btn-sm btn-ghost search-bulk-action" data-bulk-action="skip" title="Skip all matches">Skip all</button>
            <button type="button" class="btn-sm search-bulk-action search-bulk-action-delete" data-bulk-action="delete" title="Permanently delete all matches">Delete all</button>
          </div>`
        : "";
    return `<div class="search-volume-bar" role="status">
      <span class="search-volume-count">${s.count} match${s.count === 1 ? "" : "es"}</span>
      <span class="search-volume-sep" aria-hidden="true">·</span>
      ${totals}
      <span class="search-volume-sep" aria-hidden="true">·</span>
      <span class="search-volume-query">“${esc(q)}”</span>
      ${missingNote}
      ${bulkActions}
    </div>`;
  }

  function formatTestSteps(result) {
    if (!result || !result.steps || !result.steps.length) return "";
    const items = result.steps
      .map((s) => {
        const cls = s.ok ? "ok" : s.warning ? "warn" : "fail";
        const icon = s.ok ? "✓" : s.warning ? "!" : "✗";
        return `<li class="test-step ${cls}">
          <span class="test-step-icon">${icon}</span>
          <span class="test-step-name">${esc(s.name)}</span>
          <span class="test-step-msg">${esc(s.message)}</span>
        </li>`;
      })
      .join("");
    const summaryCls = result.ok ? "test-summary-ok" : "test-summary-fail";
    return `<div class="test-results">
      <p class="test-summary ${summaryCls}">${esc(result.summary || "")}</p>
      <ul class="test-steps">${items}</ul>
    </div>`;
  }

  function moduleBadge(module) {
    const label = MODULE_LABELS[module] || module || "Job";
    return `<span class="job-module-badge">${esc(label)}</span>`;
  }

  function scoutSceneTheme(job) {
    const id = job?.id || "";
    if (id.includes("serp") || id.includes("recheck")) return "scan";
    if (
      id.includes("competitor") ||
      id.includes("discover") ||
      id === "scan_competitor"
    ) {
      return "spy";
    }
    if (id.includes("paa")) return "questions";
    if (
      id.includes("smoke") ||
      id.includes("verify") ||
      id.includes("mini_pipeline") ||
      id === "refresh_catalog"
    ) {
      return "system";
    }
    if (job?.module === "competitors") return "spy";
    return "search";
  }

  function scoutSceneMission(theme) {
    const missions = {
      search: "Asking around town",
      scan: "Checking the town notice board",
      spy: "Watching the theater crowd",
      questions: "Listening at the fountain",
      system: "Running a quick systems check",
    };
    return missions[theme] || missions.search;
  }

  function scoutSceneGoal(theme) {
    const goals = {
      search: `
        <div class="scout-goal scout-goal-search" aria-hidden="true">
          <div class="scout-goal-search-bar">
            <span class="scout-goal-search-icon">⌕</span>
            <span class="scout-goal-search-text">keywords…</span>
          </div>
          <div class="scout-goal-bubbles">
            <span>how to…</span><span>best…</span><span>vs…</span>
          </div>
        </div>`,
      scan: `
        <div class="scout-goal scout-goal-scan" aria-hidden="true">
          <div class="scout-goal-serp">
            <div class="scout-goal-serp-row scout-goal-serp-row--you"><span>#1</span><i></i></div>
            <div class="scout-goal-serp-row"><span>#2</span><i></i></div>
            <div class="scout-goal-serp-row"><span>#3</span><i></i></div>
          </div>
        </div>`,
      spy: `
        <div class="scout-goal scout-goal-spy" aria-hidden="true">
          <div class="scout-goal-screen">
            <span class="scout-goal-play">▶</span>
            <span class="scout-goal-screen-title">Top videos</span>
          </div>
          <span class="scout-goal-binoculars" aria-hidden="true"><i></i><i></i></span>
        </div>`,
      questions: `
        <div class="scout-goal scout-goal-questions" aria-hidden="true">
          <span class="scout-goal-q">?</span>
          <span class="scout-goal-q scout-goal-q--sm">?</span>
          <span class="scout-goal-q scout-goal-q--lg">?</span>
        </div>`,
      system: `
        <div class="scout-goal scout-goal-system" aria-hidden="true">
          <svg class="scout-goal-gear" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path fill="currentColor" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm8.94-2.06a1 1 0 0 0-.26-1.09l-1.2-1.2a7.03 7.03 0 0 0 0-2.5l1.2-1.2a1 1 0 0 0 .26-1.09l-1.06-1.84a1 1 0 0 0-1-.49l-1.7.28a7.12 7.12 0 0 0-1.08-.62l-.42-1.66A1 1 0 0 0 14.5 2h-2.12a1 1 0 0 0-.97.76l-.42 1.66c-.38.15-.74.35-1.08.62l-1.7-.28a1 1 0 0 0-1 .49L5.32 6.35a1 1 0 0 0-.26 1.09l1.2 1.2a7.03 7.03 0 0 0 0 2.5l-1.2 1.2a1 1 0 0 0 .26 1.09l1.06 1.84c.26.45.74.62 1.2.49l1.7-.28c.34.27.7.47 1.08.62l.42 1.66c.13.5.6.84 1.1.84h2.12c.5 0 .97-.34 1.1-.84l.42-1.66c.38-.15.74-.35 1.08-.62l1.7.28c.46.13.94-.04 1.2-.49l1.06-1.84z"/>
          </svg>
        </div>`,
    };
    return goals[theme] || goals.search;
  }

  const SCOUT_TOWN_NPCS = [
    {
      id: "baker",
      shop: "Bakery",
      x: 23,
      y: 36,
      hue: 35,
      lines: [
        "Folks keep asking {prefix} to use {topic}…",
        "Someone wanted to know {prefix} {topic} works.",
      ],
    },
    {
      id: "librarian",
      shop: "Library",
      x: 14,
      y: 38,
      hue: 200,
      lines: [
        "Readers search {prefix} {topic} even means.",
        "A regular asked {prefix} happens with {topic}.",
      ],
    },
    {
      id: "detective",
      shop: "Detective",
      x: 55,
      y: 34,
      hue: 280,
      lines: [
        "{prefix} does everyone look up {topic}?",
        "I keep hearing {prefix} {topic} breaks.",
      ],
    },
    {
      id: "merchant",
      shop: "Market",
      x: 76,
      y: 34,
      hue: 85,
      lines: [
        "{prefix} you really do that in {topic}?",
        "Customers ask if {prefix} {topic} handle it.",
      ],
    },
    {
      id: "inventor",
      shop: "Inventor",
      x: 38,
      y: 38,
      hue: 120,
      lines: [
        "{prefix} {topic} even work that way?",
        "Tinkerers wonder {prefix} {topic} scale.",
      ],
    },
    {
      id: "clerk",
      shop: "Town Hall",
      x: 64,
      y: 36,
      hue: 0,
      lines: [
        "Checking who ranks for {keyword}…",
        "Does anyone show up for {keyword}?",
      ],
    },
    {
      id: "bard",
      shop: "Fountain",
      x: 50,
      y: 34,
      hue: 310,
      lines: [
        "The crowd keeps asking about {topic}…",
        "Overheard at the square: {keyword}",
      ],
    },
    {
      id: "director",
      shop: "Theater",
      x: 70,
      y: 36,
      hue: 160,
      lines: [
        "Creators are filming {keyword}…",
        "Top videos mention {topic} lately.",
      ],
    },
  ];

  const SCOUT_TOWN_VISIT_MIN = 3;
  const SCOUT_TOWN_VISIT_MAX = 5;

  function shuffleTownNpcs(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickRandomTownShops() {
    const span = SCOUT_TOWN_VISIT_MAX - SCOUT_TOWN_VISIT_MIN + 1;
    const count = SCOUT_TOWN_VISIT_MIN + Math.floor(Math.random() * span);
    return shuffleTownNpcs(SCOUT_TOWN_NPCS).slice(0, Math.min(count, SCOUT_TOWN_NPCS.length));
  }

  function nextTownNpcFromQueue() {
    const town = state.scoutTown;
    if (!town?.visitQueue?.length) {
      return SCOUT_TOWN_NPCS[Math.floor(Math.random() * SCOUT_TOWN_NPCS.length)];
    }
    const npc = town.visitQueue[town.visitQueueIdx % town.visitQueue.length];
    town.visitQueueIdx += 1;
    return npc;
  }

  function randomTownNpcNearby() {
    const town = state.scoutTown;
    const pool = town?.visitQueue?.length ? town.visitQueue : SCOUT_TOWN_NPCS;
    const shuffled = shuffleTownNpcs(pool);
    for (const candidate of shuffled) {
      if (!town || townDistance(town.atX, town.atY, candidate.x, candidate.y) >= 1.2) {
        return candidate;
      }
    }
    return shuffled[0] || SCOUT_TOWN_NPCS[0];
  }

  function scoutSeedTopic() {
    const pd = state.prefixData || {};
    const seed = pd.seed_phrases?.find((s) => s.enabled !== false);
    return (seed?.text || pd.discovery?.seed_phrase || "your topic").trim();
  }

  function prefixRootFromText(text) {
    return (text || "").trim().split(/\s+/)[0]?.toLowerCase().replace(/['']/g, "") || "";
  }

  function parseSearchMessage(msg) {
    const raw = (msg || "").trim();
    const m = /^Search:\s*(.+)$/i.exec(raw);
    if (m) return { seed: m[1].trim(), root: prefixRootFromText(m[1]) };
    if (raw && !raw.startsWith("ERR:") && raw !== "Done" && !raw.includes("Seed phrase:")) {
      return { seed: raw, root: prefixRootFromText(raw) };
    }
    return null;
  }

  function npcForJob() {
    return nextTownNpcFromQueue();
  }

  function buildNpcDialogue(npc, job) {
    const keywords = job?.last_keywords || [];
    if (keywords.length) return keywords[0];
    const parsed = parseSearchMessage(job?.message);
    const topic = parsed
      ? parsed.seed.split(/\s+/).slice(1).join(" ") || scoutSeedTopic()
      : scoutSeedTopic();
    const prefix = parsed?.root || prefixRootFromText(job?.message) || "how";
    const keyword = parsed?.seed || job?.message || topic;
    const lines = npc.lines || [];
    const tpl = lines[Math.floor(Math.random() * lines.length)] || "{keyword}";
    return tpl
      .replace(/\{prefix\}/g, prefix)
      .replace(/\{topic\}/g, topic)
      .replace(/\{keyword\}/g, keyword);
  }

  function stopScoutTown() {
    if (state.scoutTownTimer) {
      clearInterval(state.scoutTownTimer);
      state.scoutTownTimer = null;
    }
    state.scoutTown = null;
  }

  function resetScoutTown() {
    state.scoutTown = {
      atX: 12,
      atY: 34,
      waypointAt: 0,
      waypoints: [],
      frame: 0,
      phase: "pause",
      pauseUntil: 0,
      activeNpcId: null,
      bubbleLine: "",
      bubbleChars: 0,
      heardQuestions: [],
      lastJobMessage: "",
      lastKeywordsKey: "",
      visitQueue: pickRandomTownShops(),
      visitQueueIdx: 0,
      pendingNpc: null,
      pendingJob: null,
    };
  }

  const SCOUT_TOWN_PLAZA = { x: 50, y: 34 };

  function townDistance(ax, ay, bx, by) {
    return Math.hypot(bx - ax, by - ay);
  }

  function townRouteWaypoints(fromX, fromY, toX, toY) {
    const dist = townDistance(fromX, fromY, toX, toY);
    if (dist < 1.2) return [{ x: toX, y: toY }];
    const steps = Math.min(7, Math.max(3, Math.ceil(dist / 5)));
    const points = [];
    const viaPlaza =
      dist > 14 &&
      townDistance(fromX, fromY, SCOUT_TOWN_PLAZA.x, SCOUT_TOWN_PLAZA.y) > 4 &&
      townDistance(SCOUT_TOWN_PLAZA.x, SCOUT_TOWN_PLAZA.y, toX, toY) > 4;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      let x = fromX + (toX - fromX) * t;
      let y = fromY + (toY - fromY) * t;
      if (viaPlaza) {
        const plazaPull = Math.sin(t * Math.PI) * 0.42;
        x += (SCOUT_TOWN_PLAZA.x - x) * plazaPull;
        y += (SCOUT_TOWN_PLAZA.y - y) * plazaPull;
      }
      points.push({ x, y });
    }
    points[points.length - 1] = { x: toX, y: toY };
    return points;
  }

  function routeScoutToNpc(npc, job) {
    const town = state.scoutTown;
    if (!town || !npc) return;
    const dist = townDistance(town.atX, town.atY, npc.x, npc.y);
    town.pendingNpc = npc;
    town.pendingJob = job;
    town.waypoints = townRouteWaypoints(town.atX, town.atY, npc.x, npc.y);
    town.waypointAt = 0;
    town.activeNpcId = null;
    town.bubbleLine = "";
    town.bubbleChars = 0;
    if (dist < 1.2) {
      beginTownDialogue(npc, job);
      town.pendingNpc = null;
      town.pendingJob = null;
      town.waypoints = [];
      town.waypointAt = 0;
      return;
    }
    town.phase = "walk";
    town.frame = 0;
    town.pauseUntil = 0;
  }

  function applyTownKeywords(job) {
    const town = state.scoutTown;
    const kws = job?.last_keywords || [];
    if (!town || !kws.length) return;
    const key = kws.join("\n");
    if (key === town.lastKeywordsKey) return;
    town.lastKeywordsKey = key;
    const latest = kws[0];
    if (!latest) return;
    if (town.phase === "dialogue" && town.activeNpcId) {
      town.bubbleLine = latest;
      town.bubbleChars = 0;
      town.dialogueStartedAt = Date.now();
      if (!town.heardQuestions.includes(latest)) {
        town.heardQuestions.unshift(latest);
        if (town.heardQuestions.length > 5) town.heardQuestions.length = 5;
      }
    }
  }

  function scoutFacingBetween(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? "sw" : "se";
    }
    return dy >= 0 ? "nw" : "ne";
  }

  function scoutTownWaypoints() {
    const town = state.scoutTown;
    if (town?.waypoints?.length) return town.waypoints;
    return [];
  }

  function scoutTownPose() {
    const town = state.scoutTown || {
      atX: 50,
      atY: 32,
      waypointAt: 0,
      waypoints: [],
      frame: 0,
      phase: "pause",
    };
    const points = scoutTownWaypoints();
    const from = { x: town.atX, y: town.atY };
    const to = points[town.waypointAt % points.length] || from;
    if (town.phase === "walk") {
      const t = (town.frame + 1) / SCOUT_WALK_FRAMES;
      return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        facing: scoutFacingBetween(from, to),
        walking: true,
        walkFrame: town.frame,
      };
    }
    return {
      x: from.x,
      y: from.y,
      facing: scoutFacingBetween(from, to),
      walking: false,
      walkFrame: 0,
    };
  }

  function scoutWorldCameraX(x) {
    const center = 50 / SCOUT_WORLD_ZOOM;
    const min = 100 * (1 / SCOUT_WORLD_ZOOM - 1);
    return Math.min(0, Math.max(min, center - x));
  }

  function beginTownDialogue(npc, job) {
    const town = state.scoutTown;
    if (!town || !npc) return;
    const line = buildNpcDialogue(npc, job);
    town.dialogueStartedAt = Date.now();
    town.activeNpcId = npc.id;
    town.bubbleLine = line;
    town.bubbleChars = 0;
    town.phase = "dialogue";
    town.pauseUntil = Date.now() + SCOUT_DIALOGUE_MS;
    if (line && !town.heardQuestions.includes(line)) {
      town.heardQuestions.unshift(line);
      if (town.heardQuestions.length > 5) town.heardQuestions.length = 5;
    }
  }

  function queueIdleTownVisit() {
    const town = state.scoutTown;
    if (!town) return;
    const npc = randomTownNpcNearby();
    if (!npc) {
      town.phase = "pause";
      town.pauseUntil = Date.now() + SCOUT_PAUSE_MS * 2;
      return;
    }
    routeScoutToNpc(npc, state.job);
  }

  function syncScoutTownWithJob(job) {
    if (!state.scoutTown || !job) return;
    applyTownKeywords(job);
    const msgKey = job.message || "";
    if (msgKey === state.scoutTown.lastJobMessage) return;
    state.scoutTown.lastJobMessage = msgKey;
    if (!msgKey || msgKey === "Done") return;
    const npc = npcForJob(job);
    routeScoutToNpc(npc, job);
  }

  function syncScoutTownDom() {
    const layer = document.querySelector(".scout-hero-world-layer");
    const wrap = document.querySelector(".scout-hero-dino-wrap");
    if (!layer || !wrap) return;
    const pose = scoutTownPose();
    const town = state.scoutTown || {};
    layer.style.setProperty("--scout-cam-x", String(scoutWorldCameraX(pose.x)));
    wrap.style.setProperty("--scout-x", `${pose.x}%`);
    wrap.style.setProperty("--scout-y", `${pose.y}%`);
    wrap.classList.toggle("is-walking", pose.walking);
    wrap.classList.toggle("is-idle", !pose.walking);
    for (const dir of ["se", "sw", "ne", "nw"]) {
      wrap.classList.toggle(`scout-hero-dino-wrap--${dir}`, pose.facing === dir);
    }
    const sprite = wrap.querySelector(".scout-hero-sprite");
    if (sprite) sprite.style.setProperty("--walk-frame", String(pose.walkFrame));

    document.querySelectorAll(".scout-town-npc").forEach((el) => {
      el.classList.toggle(
        "is-talking",
        el.dataset.npcId === town.activeNpcId && town.phase === "dialogue"
      );
    });

    const messageBar = document.querySelector(".scout-town-message-bar");
    if (!messageBar) return;

    const activeNpc = town.activeNpcId ? scoutTownNpcById(town.activeNpcId) : null;
    const inDialogue = town.phase === "dialogue" && town.bubbleLine;
    const bubbleLine = town.bubbleLine || "";
    const bubbleChars = town.bubbleChars || 0;
    const typing = inDialogue && bubbleChars < bubbleLine.length;

    let speaker = "";
    let text = "";
    if (inDialogue && activeNpc) {
      speaker = activeNpc.shop;
      text = bubbleLine.slice(0, bubbleChars);
    } else if (town.heardQuestions?.length) {
      speaker = "Overheard";
      text = town.heardQuestions[0];
    } else {
      const job = state.job;
      const theme = job ? scoutSceneTheme(job) : "idle";
      speaker = "Scout";
      text =
        (job && scoutSceneMission(theme)) ||
        job?.message ||
        "Scout is patrolling town…";
    }

    const speakerEl = messageBar.querySelector(".scout-town-dialogue-speaker");
    const textEl = messageBar.querySelector(".scout-town-dialogue-text");
    const caretEl = messageBar.querySelector(".scout-town-dialogue-caret");

    if (speakerEl) {
      if (speaker) {
        speakerEl.textContent = speaker;
        speakerEl.hidden = false;
      } else {
        speakerEl.hidden = true;
      }
    }
    if (textEl) textEl.textContent = text;
    if (caretEl) caretEl.hidden = !typing;
  }

  function scoutTownTick() {
    if (state.scoutScene.crtPhase !== "on" || !state.jobRunning) {
      stopScoutTown();
      return;
    }
    if (
      state.scoutScene.poweredAt &&
      Date.now() - state.scoutScene.poweredAt < SCOUT_CRT_ENTER_MS
    ) {
      return;
    }
    if (!state.scoutTown) resetScoutTown();
    const town = state.scoutTown;
    const now = Date.now();
    const points = scoutTownWaypoints();
    const target = points[town.waypointAt] || { x: town.atX, y: town.atY };

    if (town.phase === "dialogue") {
      const lineLen = (town.bubbleLine || "").length;
      const elapsed = now - (town.dialogueStartedAt || now);
      town.bubbleChars = Math.min(lineLen, Math.floor(elapsed / SCOUT_TYPE_MS) + 1);
      if (now >= town.pauseUntil) {
        town.phase = "pause";
        town.pauseUntil = now + SCOUT_PAUSE_MS;
        town.activeNpcId = null;
        town.bubbleLine = "";
        town.bubbleChars = 0;
      }
      syncScoutTownDom();
      return;
    }

    if (town.phase === "pause") {
      if (!town.pauseUntil) town.pauseUntil = now + SCOUT_PAUSE_MS;
      if (now < town.pauseUntil) {
        syncScoutTownDom();
        return;
      }
      if (!town.waypoints.length) {
        queueIdleTownVisit();
        if (town.phase === "pause") {
          syncScoutTownDom();
          return;
        }
      }
      town.phase = "walk";
      town.frame = 0;
      town.pauseUntil = 0;
    } else if (town.phase === "walk" && points.length) {
      town.frame += 1;
      if (town.frame >= SCOUT_WALK_FRAMES) {
        town.atX = target.x;
        town.atY = target.y;
        if (town.waypointAt < town.waypoints.length - 1) {
          town.waypointAt += 1;
          town.frame = 0;
        } else if (town.pendingNpc) {
          beginTownDialogue(town.pendingNpc, town.pendingJob || state.job);
          applyTownKeywords(state.job);
          town.pendingNpc = null;
          town.pendingJob = null;
          town.waypoints = [];
          town.waypointAt = 0;
        } else {
          town.phase = "pause";
          town.pauseUntil = 0;
          town.waypoints = [];
          town.waypointAt = 0;
        }
        town.frame = 0;
      }
    } else if (town.phase !== "dialogue") {
      town.phase = "pause";
      town.pauseUntil = 0;
    }
    syncScoutTownDom();
  }

  function startScoutTownPatrol() {
    if (state.scoutTownTimer) return;
    if (!state.scoutTown) resetScoutTown();
    syncScoutTownWithJob(state.job);
    if (
      state.scoutTown &&
      !state.scoutTown.waypoints.length &&
      state.scoutTown.phase === "pause"
    ) {
      queueIdleTownVisit();
    }
    state.scoutTownTimer = setInterval(scoutTownTick, SCOUT_WALK_MS);
    scoutTownTick();
  }

  function stopScoutCrtDemo() {
    if (state.scoutDemoTickTimer) {
      clearInterval(state.scoutDemoTickTimer);
      state.scoutDemoTickTimer = null;
    }
    state.scoutDemo = false;
    state.jobRunning = false;
    state.job = null;
    if (state.scoutCrtTimer) {
      clearTimeout(state.scoutCrtTimer);
      state.scoutCrtTimer = null;
    }
    stopScoutTown();
    state.scoutScene = { crtPhase: "off", jobKey: null, poweredAt: null };
    resetScoutCrtFullscreen();
    render();
  }

  function scoutCrtFullscreenBtnLabel(open) {
    return open ? "exit full screen" : "full screen";
  }

  function scoutCrtCanFullscreen() {
    const phase = state.scoutScene.crtPhase;
    return phase === "on" || phase === "powering";
  }

  function scoutCrtFrameHome() {
    return document.querySelector(".scout-hero-crt-collapse-inner");
  }

  function returnScoutCrtFrameHome() {
    const portal = document.getElementById("scout-crt-fs-portal");
    const frameWrap =
      portal?.querySelector(".scout-hero-crt-frame-wrap") ||
      document.querySelector(".scout-hero-crt-frame-wrap");
    const home = scoutCrtFrameHome();
    if (frameWrap && home && frameWrap.parentElement !== home) {
      home.appendChild(frameWrap);
    }
  }

  function ensureScoutCrtFsPortal() {
    let portal = document.getElementById("scout-crt-fs-portal");
    if (!portal) {
      portal = document.createElement("div");
      portal.id = "scout-crt-fs-portal";
      portal.className = "scout-crt-fs-portal";
      portal.innerHTML =
        '<div class="scout-crt-fs-backdrop" aria-hidden="true"></div><div class="scout-crt-fs-stage"></div>';
      document.body.appendChild(portal);
      portal.querySelector(".scout-crt-fs-backdrop")?.addEventListener("click", () => {
        if (state.scoutCrtFullscreen && !state.scoutCrtFullscreenClosing) {
          closeScoutCrtFullscreen();
        }
      });
    }
    return portal;
  }

  function scoutCrtFullscreenBtnHtml() {
    const open = state.scoutCrtFullscreen;
    const text = scoutCrtFullscreenBtnLabel(open);
    const title = open ? "Exit full screen (Esc)" : "View CRT full screen";
    return `<button type="button" class="scout-crt-fs-btn" id="scout-crt-fs-toggle" data-scout-crt-fs-toggle aria-label="${esc(text)}" aria-pressed="${open ? "true" : "false"}" title="${esc(title)}">${esc(text)}</button>`;
  }

  function updateScoutCrtFullscreenBtn(open) {
    const btn = document.getElementById("scout-crt-fs-toggle");
    if (!btn) return;
    const text = scoutCrtFullscreenBtnLabel(open);
    const title = open ? "Exit full screen (Esc)" : "View CRT full screen";
    btn.setAttribute("aria-label", text);
    btn.setAttribute("aria-pressed", open ? "true" : "false");
    btn.title = title;
    btn.textContent = text;
  }

  function resetScoutCrtFullscreen() {
    if (state.scoutCrtFsExitTimer) {
      clearTimeout(state.scoutCrtFsExitTimer);
      state.scoutCrtFsExitTimer = null;
    }
    state.scoutCrtFullscreen = false;
    state.scoutCrtFullscreenClosing = false;
    document.body.classList.remove("scout-crt-fs-active");
    const portal = document.getElementById("scout-crt-fs-portal");
    portal?.classList.remove("is-open", "is-ready", "is-closing");
    returnScoutCrtFrameHome();
  }

  function syncScoutCrtFullscreenAfterRender() {
    if (!state.scoutCrtFullscreen || state.scoutCrtFullscreenClosing) return;
    if (!scoutCrtCanFullscreen()) {
      resetScoutCrtFullscreen();
      return;
    }
    const frameWrap = document.querySelector(".scout-hero .scout-hero-crt-frame-wrap");
    if (!frameWrap) return;
    const portal = ensureScoutCrtFsPortal();
    portal.querySelector(".scout-crt-fs-stage")?.appendChild(frameWrap);
    document.body.classList.add("scout-crt-fs-active");
    portal.classList.remove("is-closing");
    portal.classList.add("is-open", "is-ready");
    updateScoutCrtFullscreenBtn(true);
  }

  function openScoutCrtFullscreen() {
    if (state.scoutCrtFullscreen || state.scoutCrtFullscreenClosing) return;
    if (!scoutCrtCanFullscreen()) return;
    const frameWrap = document.querySelector(".scout-hero .scout-hero-crt-frame-wrap");
    if (!frameWrap) return;
    const portal = ensureScoutCrtFsPortal();
    state.scoutCrtFullscreen = true;
    document.body.classList.add("scout-crt-fs-active");
    portal.querySelector(".scout-crt-fs-stage")?.appendChild(frameWrap);
    portal.classList.remove("is-closing");
    portal.classList.add("is-open");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => portal.classList.add("is-ready"));
    });
    updateScoutCrtFullscreenBtn(true);
  }

  function closeScoutCrtFullscreen(opts = {}) {
    if (!state.scoutCrtFullscreen) return;
    if (opts.immediate) {
      resetScoutCrtFullscreen();
      updateScoutCrtFullscreenBtn(false);
      return;
    }
    if (state.scoutCrtFullscreenClosing) return;
    const portal = document.getElementById("scout-crt-fs-portal");
    state.scoutCrtFullscreenClosing = true;
    portal?.classList.remove("is-ready");
    portal?.classList.add("is-closing");
    if (state.scoutCrtFsExitTimer) clearTimeout(state.scoutCrtFsExitTimer);
    state.scoutCrtFsExitTimer = setTimeout(() => {
      state.scoutCrtFsExitTimer = null;
      resetScoutCrtFullscreen();
      updateScoutCrtFullscreenBtn(false);
    }, SCOUT_CRT_FS_EXIT_MS);
  }

  function toggleScoutCrtFullscreen() {
    if (state.scoutCrtFullscreen) closeScoutCrtFullscreen();
    else openScoutCrtFullscreen();
  }

  function bindScoutCrtFullscreen() {
    if (state.scoutCrtFsBound) return;
    state.scoutCrtFsBound = true;
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !state.scoutCrtFullscreen || state.scoutCrtFullscreenClosing) {
        return;
      }
      e.preventDefault();
      closeScoutCrtFullscreen();
    });
  }

  function scoutDemoJob(stepIndex = 0) {
    const step = SCOUT_DEMO_STEPS[stepIndex % SCOUT_DEMO_STEPS.length];
    const total = SCOUT_DEMO_STEPS.length;
    const done = Math.min(stepIndex + 1, total);
    return {
      id: "demo:search",
      name: "Search (preview)",
      status: "running",
      module: "search",
      done,
      total,
      message: step.message,
      last_keywords: step.keywords,
    };
  }

  function tickScoutCrtDemo() {
    if (!state.scoutDemo || !state.jobRunning) return;
    const nextIndex = (state.job?.done || 0) % SCOUT_DEMO_STEPS.length;
    state.job = scoutDemoJob(nextIndex);
    if (state.scoutScene.crtPhase === "on") syncScoutTownWithJob(state.job);
    render();
  }

  function startScoutCrtDemo() {
    if (state.jobRunning) return;
    if (state.scoutDemoTickTimer) {
      clearInterval(state.scoutDemoTickTimer);
      state.scoutDemoTickTimer = null;
    }
    state.scoutDemo = true;
    state.jobRunning = true;
    state.job = scoutDemoJob(0);
    if (state.scoutCrtTimer) clearTimeout(state.scoutCrtTimer);
    stopScoutTown();
    state.scoutScene = {
      crtPhase: "powering",
      jobKey: "demo:search",
      poweredAt: null,
    };
    render();
    state.scoutCrtTimer = setTimeout(() => {
      if (!state.scoutDemo || !state.jobRunning) return;
      state.scoutScene.crtPhase = "on";
      state.scoutScene.poweredAt = Date.now();
      state.scoutScene.jobKey = "demo:search";
      resetScoutTown();
      render();
      state.scoutDemoTickTimer = setInterval(tickScoutCrtDemo, 3200);
    }, SCOUT_CRT_POWER_MS);
  }

  function syncScoutCrtScene(running, job) {
    if (state.scoutDemo) return;
    const scene = state.scoutScene;
    if (running && job) {
      const jobKey = String(job.id || job.name || "job");
      if (scene.jobKey === jobKey) return;
      if (scene.crtPhase === "powering" && String(scene.jobKey || "").startsWith("pending:")) {
        state.scoutScene.jobKey = jobKey;
        return;
      }
      if (state.scoutCrtTimer) clearTimeout(state.scoutCrtTimer);
      stopScoutTown();
      state.scoutScene = { crtPhase: "powering", jobKey, poweredAt: null };
      state.scoutCrtTimer = setTimeout(() => {
        if (state.scoutScene.jobKey === jobKey && state.jobRunning) {
          state.scoutScene.crtPhase = "on";
          state.scoutScene.poweredAt = Date.now();
          resetScoutTown();
          if (state.panel === "run") render();
        }
        state.scoutCrtTimer = null;
      }, SCOUT_CRT_POWER_MS);
      return;
    }
    if (state.scoutCrtTimer) {
      clearTimeout(state.scoutCrtTimer);
      state.scoutCrtTimer = null;
    }
    stopScoutTown();
    if (scene.crtPhase !== "off") {
      state.scoutScene = { crtPhase: "off", jobKey: null, poweredAt: null };
    }
    closeScoutCrtFullscreen({ immediate: true });
  }

  function scoutTownNpcById(id) {
    return SCOUT_TOWN_NPCS.find((n) => n.id === id) || null;
  }

  function scoutTownNpcsHtml(town, crtOn) {
    if (!crtOn) return "";
    const activeId = town?.activeNpcId || "";
    return SCOUT_TOWN_NPCS.map((npc) => {
      const talking = activeId === npc.id && town?.phase === "dialogue";
      return `<div class="scout-town-npc${talking ? " is-talking" : ""}" data-npc-id="${esc(npc.id)}" style="left:${npc.x}%;bottom:${npc.y}%">
        <div class="scout-town-npc-sprite" style="--npc-hue:${npc.hue}deg" aria-hidden="true"></div>
        <span class="scout-town-npc-sign">${esc(npc.shop)}</span>
      </div>`;
    }).join("");
  }

  function scoutTownMessageBarHtml(town, crtOn, { msg = "", mission = "" } = {}) {
    if (!crtOn) return "";
    const activeNpc = town?.activeNpcId ? scoutTownNpcById(town.activeNpcId) : null;
    const inDialogue = town?.phase === "dialogue" && town.bubbleLine;
    const bubbleLine = town?.bubbleLine || "";
    const bubbleChars = town?.bubbleChars || 0;
    const bubbleSlice = bubbleLine.slice(0, bubbleChars);
    const typing = inDialogue && bubbleChars < bubbleLine.length;

    let speaker = "";
    let text = "";
    if (inDialogue && activeNpc) {
      speaker = activeNpc.shop;
      text = bubbleSlice;
    } else if (town?.heardQuestions?.length) {
      speaker = "Overheard";
      text = town.heardQuestions[0];
    } else if (mission) {
      speaker = "Scout";
      text = mission;
    } else if (msg) {
      speaker = "Scout";
      text = msg;
    } else {
      text = "Scout is patrolling town…";
    }

    return `<div class="scout-town-message-bar" role="status" aria-live="polite">
      ${speaker ? `<span class="scout-town-dialogue-speaker">${esc(speaker)}</span>` : ""}
      <p class="scout-town-dialogue-text">${esc(text)}</p>
      ${typing ? '<span class="scout-town-dialogue-caret" aria-hidden="true"></span>' : ""}
    </div>`;
  }

  function scoutCrtActionBarHtml(crtOn, { showCancel = false } = {}) {
    if (!crtOn) return "";
    const fsBtn = scoutCrtFullscreenBtnHtml();
    return `<div class="scout-crt-action-bar">
      ${fsBtn}
      ${showCancel ? '<button type="button" class="scout-crt-cancel btn-sm btn-ghost" id="cancel-job">Cancel</button>' : ""}
    </div>`;
  }


  function scoutIsoHero(job, running, failed) {
    syncScoutCrtScene(running, job);
    if (running && job && state.scoutTown) syncScoutTownWithJob(job);
    const crtPhase = state.scoutScene.crtPhase;
    const crtOn = crtPhase === "on";
    const crtActive = crtPhase === "on" || crtPhase === "powering";
    const theme = running && job ? scoutSceneTheme(job) : "idle";
    const town = state.scoutTown;
    const pose = scoutTownPose();
    const entering =
      crtOn &&
      state.scoutScene.poweredAt &&
      Date.now() - state.scoutScene.poweredAt < SCOUT_CRT_ENTER_MS;
    const camX = scoutWorldCameraX(pose.x);
    const mission =
      running && job ? scoutSceneMission(theme) : "";
    const msg =
      running && job
        ? job.message || mission
        : failed && job
          ? job.error || job.message || "Patrol failed"
          : "Scouts ready";
    const ariaLabel =
      running && job
        ? `${job.name || "Scout"} · ${job.done ?? 0} of ${job.total ?? 0}`
        : "Scout town patrol";

    const hud = running && job
      ? ""
      : failed && job
        ? `<div class="scout-hero-hud scout-hero-hud-failed">
            ${moduleBadge(job.module)}
            <strong>${esc(job.name)} failed</strong>
            <p class="job-msg">${esc(job.error || job.message || "")}</p>
          </div>`
        : `<div class="scout-hero-hud scout-hero-hud-idle scout-hero-hud-compact">
            <p class="scout-hero-hud-idle-msg"><span class="jobs-status-dot" aria-hidden="true"></span>${esc(msg)}</p>
          </div>`;

    return `
      <section class="scout-hero scout-hero--town scout-hero--${running ? "live" : failed ? "failed" : "idle"} scout-hero--${theme} scout-hero--crt-${crtPhase}" style="--scout-world-zoom:${SCOUT_WORLD_ZOOM}" aria-live="polite">
        <div class="scout-hero-crt-collapse">
          <div class="scout-hero-crt-collapse-inner">
            <div class="scout-hero-crt-frame-wrap">
              <div class="scout-hero-crt-frame">
                <img
                  class="scout-hero-crt-frame-art"
                  src="${SCOUT_CRT_FRAME_SRC}"
                  alt=""
                  width="1536"
                  height="1024"
                  decoding="async"
                />
                <div class="scout-hero-crt-screen-slot">
                  <div class="scout-hero-crt-screen">
                    ${scoutTownMessageBarHtml(town, crtOn, { msg, mission })}
                    <div class="scout-hero-crt-stage-wrap">
                      <div class="scout-hero-stage" role="img" aria-label="${esc(ariaLabel)}">
                        <div class="scout-hero-world-layer" style="--scout-cam-x:${camX}">
                          <img class="scout-hero-world" src="${SCOUT_TOWN_WORLD_SRC}" alt="" width="1536" height="548" decoding="async" />
                          <div class="scout-town-npcs" aria-hidden="true">${scoutTownNpcsHtml(town, crtOn)}</div>
                          ${
                            crtOn
                              ? `<div class="scout-hero-dino-wrap scout-hero-dino-wrap--${pose.facing} ${pose.walking ? "is-walking" : "is-idle"}${entering ? " is-entering" : ""}" style="--scout-x:${pose.x}%; --scout-y:${pose.y}%">
                                <div class="scout-hero-sprite" style="--walk-frame:${pose.walkFrame}" aria-hidden="true"></div>
                                <span class="scout-hero-dino-shadow"></span>
                              </div>`
                              : ""
                          }
                        </div>
                      </div>
                      <div class="scout-hero-crt-fx" aria-hidden="true">
                        <span class="scout-hero-crt-scanlines"></span>
                        <span class="scout-hero-crt-vignette"></span>
                        <span class="scout-hero-crt-glare"></span>
                      </div>
                    </div>
                    ${scoutCrtActionBarHtml(crtOn, { showCancel: !!(running && job && crtOn) })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        ${hud}
      </section>`;
  }

  function defaultHarvestSeed() {
    const preview = state.prefixData?.harvest_seeds_preview || [];
    const canSeed = preview.find((s) => s.toLowerCase().startsWith("can "));
    if (canSeed) return canSeed;
    const seeds = state.prefixData?.seed_phrases || [];
    const first = seeds.find((s) => s.enabled !== false);
    const phrase = first?.text || state.prefixData?.discovery?.seed_phrase || "google sheets";
    return `can ${phrase}`;
  }

  function jobsRunButton(jobId, running, { primary = false, label = "Run", ariaName = null } = {}) {
    const dis = running ? "disabled" : "";
    const cls = primary ? "btn-sm btn-primary" : "btn-sm btn-black";
    const est = creditEstimateFor(jobId);
    const balance = state.budget?.credit_balance;
    const over =
      est?.credits != null && balance != null && est.credits > balance;
    const title = est?.label
      ? over
        ? `Needs ~${est.label} credits · ${formatCredits(balance)} left`
        : `~${est.label} credits`
      : "";
    const titleAttr = title ? ` title="${esc(title)}"` : "";
    const runLabel = ariaName || jobId;
    return `<button type="button" class="${cls}${over ? " jobs-run-over" : ""}" data-job="${jobId}" ${dis}${titleAttr} aria-label="Run ${esc(runLabel)}">${esc(label)}</button>`;
  }

  function jobsHeroButton(jobId, running, label, variant = "primary") {
    const dis = running ? "disabled" : "";
    const cls = variant === "secondary" ? "btn-md btn-secondary" : "btn-md btn-primary";
    return `<button type="button" class="${cls} jobs-hero-btn" data-job="${jobId}" ${dis}>${esc(label)}</button>`;
  }

  function jobsTargetButton(jobId, running, label, dataAttrs = "") {
    const dis = running ? "disabled" : "";
    return `<button type="button" class="btn-sm btn-ghost jobs-target-btn" data-job="${jobId}" ${dataAttrs} ${dis}>${esc(label)}</button>`;
  }

  function seedFieldForJob(job, running) {
    if (!job.seed) return "";
    const disabled = running ? "disabled" : "";
    const seedVal =
      job.id === "harvest"
        ? defaultHarvestSeed()
        : (state.prefixData?.seed_phrases?.find((s) => s.enabled !== false)?.text
            || state.prefixData?.discovery?.seed_phrase
            || "google sheets");
    return `<label class="nb-field">
      <span class="nb-field-label">${esc(job.seedLabel || "Input")}</span>
      <input type="text" class="nb-input" data-seed-for="${job.id}" value="${esc(seedVal)}" placeholder="${esc(job.seedPlaceholder || "")}" ${disabled} />
    </label>`;
  }

  function isPrefixActive(p, pd) {
    pd = pd || state.prefixData || {};
    if (isPrefixExcluded(p)) return false;
    const root = (p.text || "").trim().split(/\s+/)[0]?.toLowerCase();
    const focus = pd.prefix_focus?.[root];
    if (focus && focus.length) {
      const label = (p.text || "").trim().toLowerCase();
      return focus.includes(label);
    }
    return true;
  }

  function isPrefixExcluded(p) {
    return Boolean(p?.excluded) || p?.enabled === false;
  }

  function harvestCounts() {
    const pd = state.prefixData || {};
    const seeds = pd.seed_phrases || [];
    const prefixes = pd.prefixes || [];
    const enabledSeeds = seeds.filter((s) => s.enabled !== false);
    const enabledPrefixes = prefixes.filter((p) => isPrefixActive(p, pd));
    return {
      seeds,
      prefixes,
      enabledSeeds,
      enabledPrefixes,
      comboCount: enabledSeeds.length * enabledPrefixes.length,
    };
  }

  function displaySeedPhrase(text) {
    const t = (text || "").trim();
    if (!t) return t;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function harvestSeedHeroRow(running) {
    const { seeds, enabledSeeds } = harvestCounts();
    if (!enabledSeeds.length) {
      const hasDisabled = seeds.some((s) => s.enabled === false);
      const hint = hasDisabled
        ? "No active seed phrases. Turn one on in Settings."
        : "Add a seed phrase in Settings, then run it here.";
      return `
        <div class="jobs-seed-hero">
          <p class="jobs-seed-empty">${esc(hint)} <button type="button" class="btn-sm btn-ghost" data-panel="settings">Seed phrases</button></p>
        </div>`;
    }
    const buttons = enabledSeeds
      .map((s) => {
        const dis = running ? "disabled" : "";
        const cr = creditEstimateLabel(`harvest_seed_phrase:${s.text}`);
        const label = displaySeedPhrase(s.text);
        const aria =
          cr && cr !== "…"
            ? `Search for questions: ${label}. About ${cr} credits.`
            : `Search for questions: ${label}`;
        return `<button type="button" class="btn-md btn-primary jobs-hero-btn jobs-seed-run-btn" data-job="harvest_seed_phrase" data-seed="${esc(s.text)}" ${dis} aria-label="${esc(aria)}">
          <span class="jobs-seed-run-phrase">${esc(label)}</span>
          <span class="jobs-seed-run-credits mono" aria-hidden="true">${esc(cr)}</span>
        </button>`;
      })
      .join("");
    return `
      <div class="jobs-seed-hero">
        <p class="jobs-seed-kicker">Seed phrases</p>
        ${buttons}
      </div>`;
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso.slice(0, 16);
    }
  }

  function formatScheduleWhen(task) {
    const h = String(task.hour ?? 6).padStart(2, "0");
    const m = String(task.minute ?? 0).padStart(2, "0");
    if (task.interval === "weekly") {
      const dow = (task.day_of_week || "sun").slice(0, 3);
      return `${dow} ${h}:${m}`;
    }
    return `Daily ${h}:${m}`;
  }

  function formatCredits(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return Number(n).toLocaleString("en-US");
  }

  function creditsAllowanceFoot(b) {
    const monthly = b.creator_monthly_credits ?? 5000;
    const allowance = b.credit_allowance ?? monthly;
    const spent = b.session_spent_credits ?? 0;
    return `${formatCredits(spent)} used · ${formatCredits(allowance)}`;
  }

  function creditEstimateFor(jobId) {
    return state.creditEstimates?.[jobId] || null;
  }

  function creditEstimateLabel(jobId) {
    const est = creditEstimateFor(jobId);
    if (!est) return "…";
    if (est.credits === 0) return "0";
    return est.label ? `~${est.label}` : formatCredits(est.credits);
  }

  function jobCreditsLabel(job) {
    return creditEstimateLabel(job.id);
  }

  function jobStatusBadge(status) {
    const s = (status || "").toLowerCase();
    const cls =
      s === "completed" || s === "started"
        ? "jobs-status-ok"
        : s === "failed"
          ? "jobs-status-fail"
          : "jobs-status-idle";
    const label =
      s === "completed" ? "Done" : s === "failed" ? "Failed" : s === "started" ? "Running" : status || "—";
    return `<span class="jobs-status ${cls}">${esc(label)}</span>`;
  }

  function jobsRunRow(job, running) {
    return `<tr>
      <td class="jobs-name-cell">
        <strong class="jobs-name">${esc(job.name)}</strong>
        <p class="jobs-desc">${esc(job.desc)}</p>
      </td>
      <td class="jobs-credits mono">${esc(jobCreditsLabel(job))}</td>
      <td class="jobs-action">${jobsRunButton(job.id, running, { primary: !!job.hero, ariaName: job.name })}</td>
    </tr>`;
  }

  function jobsRunTable(jobs, running) {
    const rows = jobs.map((j) => jobsRunRow(j, running)).join("");
    return `<table class="data-table jobs-table">
      <thead><tr><th>Scout</th><th>Credits</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function recentRunsSection(compact = false) {
    const runs = (state.jobHistory || []).slice(0, compact ? 8 : 20);
    if (!runs.length) {
      return `
        <div class="jobs-rail-panel">
          <h3 class="jobs-rail-title">Returns</h3>
          <p class="jobs-rail-empty">Nothing back yet. Send a scout on patrol to populate this log.</p>
        </div>`;
    }
    const rows = runs
      .map((r) => {
        const when = fmtDateTime(r.finished_at || r.started_at);
        const detail = r.status === "failed" ? r.error || r.summary : r.summary;
        if (compact) {
          return `<tr>
            <td class="mono jobs-when">${esc(when)}</td>
            <td><strong>${esc(r.name)}</strong> ${jobStatusBadge(r.status)}</td>
          </tr>`;
        }
        return `<tr>
          <td class="mono jobs-when">${esc(when)}</td>
          <td><strong>${esc(r.name)}</strong></td>
          <td>${jobStatusBadge(r.status)}</td>
          <td class="jobs-summary">${esc(detail || "—")}</td>
        </tr>`;
      })
      .join("");
    if (compact) {
      return `
        <div class="jobs-rail-panel">
          <h3 class="jobs-rail-title">Returns</h3>
          <div class="jobs-rail-scroll">
            <table class="data-table jobs-history-table jobs-history-compact">
              <thead><tr><th>When</th><th>Job</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }
    return `
      <section class="run-section jobs-desk-section">
        <header class="jobs-desk-header">
          <h3 class="jobs-desk-title">Returns</h3>
          <p class="jobs-desk-lead">Last ${runs.length} finished scouts, newest first.</p>
        </header>
        <table class="data-table jobs-history-table">
          <thead><tr><th>When</th><th>Job</th><th>Status</th><th>Result</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  }

  function automationRow(taskId, task, running) {
    const dis = running ? "disabled" : "";
    const when = formatScheduleWhen(task);
    const tz = state.schedule?.timezone || "";
    const last = task.last_run_at ? fmtDateTime(task.last_run_at) : "Never";
    const next = task.enabled ? fmtScheduleNext(task.next_run_at) : "Off";
    return `<tr>
      <td class="jobs-name-cell">
        <strong class="jobs-name">${esc(task.name || taskId)}</strong>
        <p class="jobs-desc">${esc(task.description || "")}</p>
      </td>
      <td class="mono jobs-sched-when">${esc(when)}<span class="jobs-tz">${esc(tz)}</span></td>
      <td class="mono">${esc(last)}</td>
      <td class="mono">${esc(next)}</td>
      <td>
        <label class="jobs-toggle">
          <input type="checkbox" data-sched-enable="${taskId}" ${task.enabled ? "checked" : ""} ${dis} />
          <span>On</span>
        </label>
      </td>
      <td class="jobs-action">
        <button type="button" class="btn-sm btn-ghost" data-sched-run="${taskId}" ${dis}>Run</button>
      </td>
    </tr>`;
  }

  function onPatrolSection(running) {
    const sch = state.schedule;
    if (!sch) return "";
    const tasks = sch.tasks || {};
    const searchIds = Object.keys(tasks).filter((id) => patrolKind(id, tasks[id]) === "search");
    const scanIds = Object.keys(tasks).filter((id) => patrolKind(id, tasks[id]) === "scan");
    const globalOn = sch.enabled !== false;
    const searchRows = searchIds.map((id) => automationRow(id, tasks[id], running)).join("");
    const scanRows = scanIds.map((id) => automationRow(id, tasks[id], running)).join("");
    return `
      <section class="run-section jobs-auto-section">
        <header class="jobs-zone-head jobs-auto-head">
          <div>
            <h3 class="jobs-zone-kicker">On Patrol</h3>
            <p class="jobs-zone-desc">Scheduled scouts while <code>serve.py</code> runs, or <code>scripts/run_scheduled.py</code> in crontab.</p>
          </div>
          <label class="jobs-global-toggle">
            <input type="checkbox" id="schedule-global-toggle" ${globalOn ? "checked" : ""} ${running ? "disabled" : ""} />
            <span>Patrols ${globalOn ? "on" : "off"}</span>
          </label>
        </header>
        <div class="jobs-auto-grid jobs-patrol-grid">
          <div class="jobs-auto-col">
            <h4 class="jobs-detail-label">Search</h4>
            <table class="data-table jobs-auto-table">
              <thead><tr><th>Scout</th><th>Schedule</th><th>Last</th><th>Next</th><th>On</th><th></th></tr></thead>
              <tbody>${searchRows || "<tr><td colspan='6'>None scheduled.</td></tr>"}</tbody>
            </table>
          </div>
          <div class="jobs-auto-col">
            <h4 class="jobs-detail-label">Scan</h4>
            <table class="data-table jobs-auto-table">
              <thead><tr><th>Scout</th><th>Schedule</th><th>Last</th><th>Next</th><th>On</th><th></th></tr></thead>
              <tbody>${scanRows || "<tr><td colspan='6'>None scheduled.</td></tr>"}</tbody>
            </table>
          </div>
        </div>
      </section>`;
  }

  function runSearchColumn(running) {
    const demoDis = running ? "disabled" : "";
    return `
      <section class="jobs-zone jobs-zone-search" aria-labelledby="jobs-zone-search">
        <header class="jobs-zone-head">
          <div class="jobs-zone-title-row">
            <h3 class="jobs-zone-kicker" id="jobs-zone-search">Search</h3>
            <button type="button" class="btn-sm btn-ghost jobs-crt-demo-btn" data-scout-crt-demo ${demoDis} title="Preview the CRT explore animation without using credits">Preview explore</button>
          </div>
          <p class="jobs-zone-desc">Click on a seed phrase to seek out new questions people search for.</p>
        </header>
        ${harvestSeedHeroRow(running)}
        <p class="jobs-zone-settings-link"><button type="button" class="btn-inline-link" data-panel="settings">Add more phrases</button></p>
      </section>`;
  }

  function runScanColumn(running) {
    const primary = SCAN_RUN_JOBS.filter((j) => j.hero);
    const secondary = SCAN_RUN_JOBS.filter((j) => !j.hero);
    const hero = primary.map((j) => jobsHeroButton(j.id, running, j.name)).join("");
    return `
      <section class="jobs-zone" aria-labelledby="jobs-zone-scan">
        <header class="jobs-zone-head">
          <h3 class="jobs-zone-kicker" id="jobs-zone-scan">Scan</h3>
          <p class="jobs-zone-desc">Check if you rank in search</p>
        </header>
        <div class="jobs-hero-row jobs-hero-row-single">${hero}</div>
        ${jobsRunTable(secondary, running)}
      </section>`;
  }

  function runProbeColumn() {
    return `
      <section class="jobs-zone jobs-zone-probe" aria-labelledby="jobs-zone-probe">
        <header class="jobs-zone-head">
          <h3 class="jobs-zone-kicker" id="jobs-zone-probe">Probe</h3>
          <p class="jobs-zone-desc">Find real questions people ask across platforms</p>
        </header>
        <div class="probe-soon-panel">
          <span class="probe-soon-badge">Coming soon</span>
          <p class="probe-soon-lead">Probe scouts listen where people ask out loud — not just what they type into Google. They surface exact questions from Reddit, X, LinkedIn, Quora, forums, and more, so you can answer where the conversation already started.</p>
          <ul class="probe-soon-list">
            <li>Real posts and threads, not keyword guesses</li>
            <li>Platforms you choose in <button type="button" class="btn-inline-link" data-panel="settings">Probe Settings</button></li>
            <li>Fresh threads you can still join — not year-old archives</li>
          </ul>
          <p class="jobs-soon">Configure platforms, reply limits, and post age in Settings when Probe ships.</p>
        </div>
      </section>`;
  }

  function probeSettingsSection() {
    const platforms = [
      { id: "reddit", label: "Reddit", checked: true },
      { id: "x", label: "X", checked: true },
      { id: "linkedin", label: "LinkedIn", checked: true },
      { id: "quora", label: "Quora", checked: false },
      { id: "stackoverflow", label: "Stack Overflow", checked: false },
      { id: "forums", label: "Forums & communities", checked: true },
    ];
    const platformChecks = platforms
      .map(
        (p) =>
          `<label class="probe-settings-option"><input type="checkbox" disabled ${p.checked ? "checked" : ""} /> ${esc(p.label)}</label>`
      )
      .join("");
    return settingsSection(
      "probe-settings",
      "Probe Settings",
      `
          <p class="disc-hint">Probe finds real questions on social and forum platforms. These controls preview what you will be able to tune. Nothing here is saved yet.</p>
          <fieldset class="probe-settings-block" disabled>
            <legend class="probe-settings-legend">Platforms to probe</legend>
            <p class="disc-hint">Choose where scouts listen for unanswered questions in your niche.</p>
            <div class="probe-settings-options">${platformChecks}</div>
          </fieldset>
          <fieldset class="probe-settings-block" disabled>
            <legend class="probe-settings-legend">Thread reply rules</legend>
            <p class="disc-hint">Prefer threads you can still add value to, not huge conversations where your reply gets buried.</p>
            <div class="probe-settings-options probe-settings-options--stack">
              <label class="probe-settings-option"><input type="radio" name="probe-reply-preview" disabled checked /> Unanswered only (0 replies)</label>
              <label class="probe-settings-option"><input type="radio" name="probe-reply-preview" disabled /> Up to 3 replies</label>
              <label class="probe-settings-option"><input type="radio" name="probe-reply-preview" disabled /> Up to 10 replies</label>
              <label class="probe-settings-option"><input type="radio" name="probe-reply-preview" disabled /> Any thread size</label>
            </div>
          </fieldset>
          <fieldset class="probe-settings-block" disabled>
            <legend class="probe-settings-legend">Post age limit</legend>
            <p class="disc-hint">Skip posts too old to comment on. Reddit archives threads after ~1 year, so replies are locked after that.</p>
            <div class="disc-rules probe-settings-age">
              <label>Max post age <input type="number" value="365" min="1" max="730" disabled /> days</label>
            </div>
            <p class="disc-hint probe-settings-footnote">Example: 365 days keeps results commentable on Reddit; lower values surface fresher threads only.</p>
          </fieldset>
          <div class="disc-rules probe-settings-actions">
            <button type="button" class="btn-md btn-black" disabled>Save probe settings</button>
          </div>`,
      {
        sectionClass: "probe-settings-section",
        headExtra: '<span class="probe-soon-badge">Coming soon</span>',
      }
    );
  }

  function jobsBudgetRail(b) {
    const spentCr = formatCredits(b.session_spent_credits ?? 0);
    const remaining = formatCredits(b.credit_balance);
    const monthly = formatCredits(b.creator_monthly_credits ?? 5000);
    const spentUsd = (b.session_spent_usd ?? 0).toFixed(2);
    const balanceUsd = b.balance_usd != null ? b.balance_usd.toFixed(2) : "—";
    return `
      <div class="jobs-rail-panel jobs-budget-rail">
        <h3 class="jobs-rail-title">Credits</h3>
        <dl class="jobs-budget-stats">
          <div class="jobs-budget-stat"><dt>Spent</dt><dd class="mono">${spentCr}</dd></div>
          <div class="jobs-budget-stat"><dt>Remaining</dt><dd class="mono">${remaining}</dd></div>
          <div class="jobs-budget-stat jobs-budget-stat-wide"><dt>Plan</dt><dd class="mono">${monthly} / mo</dd></div>
          <div class="jobs-budget-stat jobs-budget-stat-wide"><dt>API (internal)</dt><dd class="mono">$${spentUsd} spent · $${balanceUsd} DFS bal.</dd></div>
        </dl>
      </div>`;
  }


  function importKeywordsPanel() {
    const dis = state.jobRunning ? "disabled" : "";
    return `
          <p class="disc-hint">Paste or upload keywords you already have. No Scout credits used. Works with GSC exports, Keyword Planner, or plain keyword lists.</p>
          <div class="jobs-import-block">
            <label class="nb-field-label" for="paste-input">Paste keywords</label>
            <textarea class="search jobs-import-textarea" id="paste-input" rows="4" placeholder="one per line: keyword, global_vol, us_vol"></textarea>
            <div class="import-actions">
              <button type="button" class="btn-md btn-primary" id="paste-submit" ${dis}>Import paste</button>
              <button type="button" class="btn-md btn-secondary" id="seed-demo" ${dis}>Load sample data</button>
            </div>
          </div>
          <div class="jobs-import-block">
            <label class="nb-field-label" for="csv-upload">Upload CSV</label>
            <p class="import-file-hint">GSC, Keyword Planner, or keyword + volume columns</p>
            <input type="file" id="csv-upload" accept=".csv,.txt,text/csv" class="nb-file" />
            <button type="button" class="btn-md btn-primary" id="csv-submit" ${dis}>Import file</button>
          </div>
          <button type="button" class="btn-sm btn-ghost" id="restore-skipped" ${dis}>Restore skipped keywords</button>`;
  }

  function testRunSection(running) {
    const busy = state.testRunning || running;
    const dis = busy ? "disabled" : "";
    const results = state.testResults ? formatTestSteps(state.testResults) : "";
    return `
      <section class="run-section nb-surface">
        <h3 class="pipeline-header-title">Test &amp; verify</h3>
        <div class="import-actions">
          <button type="button" class="nb-btn nb-btn-white" id="quick-test-btn" ${dis}>Quick test</button>
          ${TEST_JOBS.map((j) => `<button type="button" class="nb-btn nb-btn-black" data-job="${j.id}" ${dis}>${esc(j.name)}</button>`).join("")}
        </div>
        <button type="button" class="nb-btn nb-btn-white nb-btn-sm" id="restore-skipped" ${dis}>Restore skipped</button>
        ${results}
      </section>`;
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function isOptimizeLabPanel(panel = state.panel) {
    return (
      panel === "optimize_lab" ||
      panel === "brain" ||
      panel === "optimize_lab_settings" ||
      panel === "optimize_lab_connections"
    );
  }

  function railShowsOptLabMascot() {
    return isOptimizeLabPanel();
  }

  function mascotLogo() {
    const hidden = railShowsOptLabMascot();
    return `<a class="app-logo app-logo--research" href="/questions" aria-label="Ansaur"${hidden ? ' tabindex="-1" aria-hidden="true"' : ""}>
      <img src="/assets/ansaur-mascot-white.png" alt="" />
    </a>`;
  }

  function writerMascotLogo() {
    const active = railShowsOptLabMascot();
    return `<a class="app-logo app-logo--writer" href="/optimize-lab" aria-label="Optimize Lab"${active ? "" : ' tabindex="-1" aria-hidden="true"'}>
      <img src="/assets/writer-dino.png" alt="" />
    </a>`;
  }

  function railMascotCorner() {
    return `<div class="rail-mascot-corner">${mascotLogo()}${writerMascotLogo()}</div>`;
  }

  function sidebarUsageStack() {
    return `<div class="rail-usage-stage">
      <div class="rail-usage-layer rail-usage-layer--credits">${sidebarCreditsBar()}</div>
      <div class="rail-usage-layer rail-usage-layer--generations">${sidebarWritersBar()}</div>
      ${railMascotCorner()}
    </div>`;
  }

  function gridContent(innerHtml) {
    return `<div class="content">${innerHtml}</div>`;
  }

  function gridExportBar(exportPath, filename) {
    return `<div class="grid-top-bar"><button type="button" class="btn-export" data-export="${exportPath}" data-export-filename="${esc(filename)}">Export CSV</button></div>`;
  }

  async function downloadCsvExport(path, filename) {
    const r = await fetch(path);
    const type = r.headers.get("Content-Type") || "";
    if (!r.ok || !type.includes("csv")) {
      const detail = await r.text();
      throw new Error(detail || `Export failed (${r.status})`);
    }
    const blob = await r.blob();
    const cd = r.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename=\"?([^\";]+)\"?/i);
    const name = match ? match[1] : filename;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadIcon() {
    return `<svg class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  }

  async function api(path, opts = {}) {
    const r = await fetch(path, opts);
    if (!r.ok) {
      const t = await r.text();
      let msg = t || r.statusText;
      try {
        const j = JSON.parse(t);
        if (typeof j.detail === "string") msg = j.detail;
        else if (Array.isArray(j.detail)) msg = j.detail.map((d) => d.msg || d).join("; ");
      } catch (_) { /* plain text */ }
      throw new Error(msg);
    }
    return r.json();
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function rowSubtitle(row) {
    const vol = row.querySelector(".vol")?.textContent?.trim();
    return vol && vol !== "-" ? `${vol} global` : "";
  }

  const WF_NAV_VARIANTS = {
    skip: { targetPanel: "skipped", badge: "SKIPPED", cardClass: "skip" },
    film: { targetPanel: "filmed", badge: "FILMED", cardClass: "film" },
    written: { targetPanel: "written", badge: "WRITTEN", cardClass: "written" },
    optimize: { targetPanel: "optimized", badge: "OPTIMIZED", cardClass: "optimize" },
    replied: { targetPanel: "replied", badge: "REPLIED", cardClass: "replied" },
    unskip: { targetPanel: "questions", badge: "QUESTIONS", cardClass: "unskip" },
  };

  const ADDITIVE_ACTIONS = new Set(["filmed", "written", "optimized"]);
  const REMOVE_ACTION_MAP = {
    unfilm: "filmed",
    unwrite: "written",
    unoptimize: "optimized",
    unplant: "optimized",
    unreply: "replied",
    unskip: "skip",
  };

  function hasStatus(row, action) {
    if (action === "skip") return !!row.skipped;
    if (action === "replied") return (row.social_platforms || []).length > 0;
    return (row.statuses || []).includes(action);
  }

  function actionBtnClass(row, action) {
    return hasStatus(row, action) ? "btn-sm btn-black is-on" : "btn-sm btn-ghost";
  }

  function parseRowData(tr) {
    return {
      statuses: (tr.dataset.statuses || "").split(",").filter(Boolean),
      skipped: tr.dataset.skipped === "1",
    };
  }

  function navItemEl(panel) {
    const scope = state.railCollapsed ? ".top-nav" : ".rail";
    return document.querySelector(`${scope} .nav-item[data-panel="${panel}"]`);
  }

  async function pulseNavBadge(variant) {
    const cfg = WF_NAV_VARIANTS[variant];
    if (!cfg || prefersReducedMotion()) return;
    const nav = navItemEl(cfg.targetPanel);
    if (!nav) return;
    nav.classList.add("wf-nav-pulse");
    setTimeout(() => nav.classList.remove("wf-nav-pulse"), 500);
  }

  const WF_ACTION_VARIANT = {
    filmed: "film",
    written: "written",
    optimized: "optimize",
  };

  const SOCIAL_PLATFORM_LABELS = {
    twitter: "Twitter",
    linkedin: "LinkedIn",
    reddit: "Reddit",
  };

  /** Row lifts, arcs to a sidebar nav item, and minimizes in. */
  async function animateRowToNav({ row, keyword, variant, subtitle, perform }) {
    if (state.workflowAnimating) return;
    const cfg = WF_NAV_VARIANTS[variant];
    if (!cfg) {
      await perform();
      return;
    }
    const nav = navItemEl(cfg.targetPanel);
    if (!nav || !row || prefersReducedMotion()) {
      await perform();
      return;
    }

    state.workflowAnimating = true;
    document.body.classList.add("wf-busy");

    const rowRect = row.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const startCX = rowRect.left + rowRect.width / 2;
    const startCY = rowRect.top + rowRect.height / 2;
    const endCX = navRect.left + navRect.width * 0.52;
    const endCY = navRect.top + navRect.height / 2;
    const dx = endCX - startCX;
    const dy = endCY - startCY;

    const overlay = document.createElement("div");
    overlay.className = "wf-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);

    const main = document.querySelector(".variant-a .main");
    if (main) main.classList.add("wf-main-dimmed");

    row.classList.add("wf-row-vacating");

    const flyer = document.createElement("div");
    flyer.className = `wf-card wf-card--${cfg.cardClass}`;
    flyer.innerHTML = `
      <div class="wf-card-body">
        <span class="wf-card-badge">${cfg.badge}</span>
        <span class="wf-card-kw">${esc(keyword)}</span>
        ${subtitle ? `<span class="wf-card-meta">${esc(subtitle)}</span>` : ""}
      </div>`;
    flyer.style.width = `${Math.min(rowRect.width, 560)}px`;
    flyer.style.left = `${startCX}px`;
    flyer.style.top = `${startCY}px`;
    document.body.appendChild(flyer);

    requestAnimationFrame(() => overlay.classList.add("is-active"));

    const apiPromise = perform();

    try {
      const lift = flyer.animate(
        [
          {
            transform: "translate(-50%, -50%) scale(1)",
            boxShadow: "0 6px 20px oklch(0.34 0.06 155 / 0.1)",
          },
          {
            transform: "translate(-50%, calc(-50% - 20px)) scale(1.04)",
            boxShadow: "0 24px 48px oklch(0.34 0.06 155 / 0.18), 0 0 0 1px oklch(0.46 0.075 155 / 0.2)",
          },
        ],
        { duration: 280, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
      );
      await lift.finished;

      flyer.classList.add("is-flying");

      const arcLift = Math.min(120, Math.max(48, Math.abs(dx) * 0.1));
      const midX = dx * 0.4;
      const midY = dy * 0.25 - arcLift;

      const flight = flyer.animate(
        [
          {
            transform: "translate(-50%, calc(-50% - 20px)) scale(1.04)",
            opacity: 1,
          },
          {
            transform: `translate(calc(-50% + ${midX}px), calc(-50% + ${midY}px)) scale(0.5)`,
            opacity: 1,
            offset: 0.55,
          },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.05)`,
            opacity: 0.2,
          },
        ],
        { duration: 720, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
      );

      nav.classList.add("wf-nav-landing");
      await wait(520);
      nav.classList.add("wf-nav-pulse");

      await flight.finished;
      await apiPromise.catch((err) => {
        alert(err.message || String(err));
      });
    } finally {
      flyer.remove();
      overlay.classList.remove("is-active");
      await wait(200);
      overlay.remove();
      if (main) main.classList.remove("wf-main-dimmed");
      nav.classList.remove("wf-nav-landing");
      setTimeout(() => nav.classList.remove("wf-nav-pulse"), 500);
      document.body.classList.remove("wf-busy");
      state.workflowAnimating = false;
    }
  }

  async function handleWorkflowAction(btn) {
    if (!btn?.dataset?.kw || !btn.dataset.action) return;
    if (btn.disabled || btn.classList.contains("is-pending")) return;

    const kw = decodeURIComponent(btn.dataset.kw);
    const action = btn.dataset.action;
    const row = btn.closest("tr");
    const rowData = row ? parseRowData(row) : {};

    const setPending = (on) => {
      btn.classList.toggle("is-pending", on);
      btn.disabled = on;
    };

    const toggleOnVisual = (on) => {
      if (!row || action === "reply") return;
      const siblings = row.querySelectorAll(`[data-action="${action}"][data-kw="${btn.dataset.kw}"]`);
      siblings.forEach((el) => {
        el.classList.toggle("is-on", on);
        el.classList.toggle("btn-black", on);
        el.classList.toggle("btn-ghost", !on);
      });
    };

    try {
      setPending(true);

      if (action === "skip" && row) {
        if (hasStatus(rowData, "skip")) {
          await setStatus(kw, "unskip");
          return;
        }
        if (state.panel === "questions" || state.panel === "gaps") {
          await animateRowToNav({
            row,
            keyword: kw,
            variant: "skip",
            subtitle: rowSubtitle(row),
            perform: () => setStatus(kw, "skip", { skipRefresh: true }),
          });
          await refreshPanel();
          return;
        }
        await setStatus(kw, "skip");
        return;
      }

      if (ADDITIVE_ACTIONS.has(action) && row) {
        const unAction = { filmed: "unfilm", written: "unwrite", optimized: "unoptimize" }[action];
        if (hasStatus(rowData, action)) {
          toggleOnVisual(false);
          await setStatus(kw, unAction);
          return;
        }
        toggleOnVisual(true);
        const badge = WF_ACTION_VARIANT[action];
        const leavingQuestions =
          (state.panel === "questions" || state.panel === "gaps") &&
          willHideFromQuestions(action) &&
          badge;

        if (leavingQuestions) {
          await animateRowToNav({
            row,
            keyword: kw,
            variant: badge,
            subtitle: rowSubtitle(row),
            perform: () => setStatus(kw, action, { skipRefresh: true }),
          });
          await refreshPanel();
          return;
        }
        await setStatus(kw, action);
        if (badge) await pulseNavBadge(badge);
        return;
      }

      if (action === "reply") {
        setPending(false);
        const platforms = (btn.dataset.platforms || "").split(",").filter(Boolean);
        showReplyPopover(btn, kw, platforms);
        return;
      }

      await setStatus(kw, action);
    } catch (e) {
      if (ADDITIVE_ACTIONS.has(action) && row && !hasStatus(rowData, action)) {
        toggleOnVisual(false);
      }
      alert(e.message || String(e));
    } finally {
      setPending(false);
    }
  }

  async function handleRankAction(btn) {
    const kw = decodeURIComponent(btn.dataset.kw);
    const action = btn.dataset.rank;
    const state = btn.dataset.state;
    if (action === "no") {
      await setManualRank(kw, false);
      return;
    }
    if (state === "yes") {
      await setManualRank(kw, false);
      return;
    }
    await setManualRank(kw, true);
  }

  function rankCell(row) {
    const enc = encodeURIComponent(row.keyword);
    const checked = !!row.serp_checked_at;
    const pending = !checked;
    const state = pending ? "pending" : "no";
    const label = pending ? "?" : "No";
    const title = pending ? "Am I on page 1?" : "Not on page 1. Click for Yes";
    return `<button type="button" class="rank-toggle-btn rank-toggle-ghost" data-rank="cycle" data-state="${state}" data-kw="${enc}" aria-label="Page 1 check for ${esc(row.keyword)}" title="${esc(title)}">${label}</button>`;
  }

  function firstPageRankCell(row) {
    const enc = encodeURIComponent(row.keyword);
    const pos = row.bettersheets_position;
    if (pos) {
      return `<div class="rank-on-page" role="group" aria-label="Page 1 status for ${esc(row.keyword)}">
        <span class="rank-pos-badge" aria-hidden="true">#${esc(String(pos))}</span>
        <button type="button" class="rank-toggle-btn rank-toggle-ghost" data-rank="no" data-state="no" data-kw="${enc}" title="Not on page 1. Moves back to Questions or Filmed">No</button>
      </div>`;
    }
    return `<button type="button" class="rank-toggle-btn rank-toggle-ghost" data-rank="cycle" data-state="yes" data-kw="${enc}" aria-label="Page 1 status for ${esc(row.keyword)}" title="On page 1. Click for No">Yes</button>`;
  }

  function rowSearch(keyword) {
    const q = encodeURIComponent(keyword);
    const yt = `https://www.youtube.com/results?search_query=${q}`;
    const google = `https://www.google.com/search?q=${q}&gl=us&hl=en`;
    const reddit = `https://www.reddit.com/search/?q=${q}`;
    const twitter = `https://x.com/search?q=${q}&f=live`;
    const linkedin = `https://www.linkedin.com/search/results/all/?keywords=${q}`;
    return `<div class="row-search-inline" role="group" aria-label="Search">
      <a class="btn-search btn-outline-sage" href="${yt}" target="_blank" rel="noopener">YouTube</a>
      <a class="btn-search btn-outline-sage" href="${google}" target="_blank" rel="noopener">Google</a>
      <a class="btn-search btn-outline-sage" href="${reddit}" target="_blank" rel="noopener">Reddit</a>
      <a class="btn-search btn-outline-sage" href="${twitter}" target="_blank" rel="noopener">Twitter</a>
      <a class="btn-search btn-outline-sage" href="${linkedin}" target="_blank" rel="noopener">LinkedIn</a>
    </div>`;
  }

  function socialBadges(row) {
    const platforms = row.social_platforms || [];
    if (!platforms.length) return "";
    const chips = platforms
      .map((p) => {
        const label = SOCIAL_PLATFORM_LABELS[p] || p;
        return `<span class="social-badge social-badge-${p}" title="Posted on ${esc(label)}">${esc(label.slice(0, 2))}</span>`;
      })
      .join("");
    return `<span class="social-badges" aria-label="Posted on ${platforms.map((p) => SOCIAL_PLATFORM_LABELS[p] || p).join(", ")}">${chips}</span>`;
  }

  function workflowButtons(row) {
    const keyword = row.keyword || row;
    const enc = encodeURIComponent(keyword);
    const platforms = row.social_platforms || [];
    const replyHint = platforms.length
      ? `Posted on ${platforms.map((p) => SOCIAL_PLATFORM_LABELS[p] || p).join(", ")}`
      : "Track which platforms you posted on";
    return `
        <button type="button" class="${actionBtnClass(row, "written")}" data-kw="${enc}" data-action="written" title="Published an article answering this">Write</button>
        <button type="button" class="${actionBtnClass(row, "replied")}" data-kw="${enc}" data-action="reply" data-platforms="${platforms.join(",")}" title="${esc(replyHint)}">Reply</button>
        <button type="button" class="${actionBtnClass(row, "optimized")}" data-kw="${enc}" data-action="optimized" title="Wove this keyword into your site. Check rankings later">Optimize</button>
        <button type="button" class="${actionBtnClass(row, "filmed")}" data-kw="${enc}" data-action="filmed" title="Filmed a YouTube video for this">Film it</button>
        <button type="button" class="${actionBtnClass(row, "skip")}" data-kw="${enc}" data-action="skip" title="Park this keyword in Skipped">Skip</button>`;
  }


  function rowTools(row) {
    return `<div class="row-tools">
      ${rowSearch(row.keyword)}
      <div class="row-tools-actions" role="group" aria-label="Actions">${workflowButtons(row)}</div>
    </div>`;
  }

  function rowMobilePack(row) {
    const volCount = activeVolumeColumns().length;
    const volLine = activeVolumeColumns()
      .map(
        (c) =>
          `<span class="vol"><span class="vol-label">${esc(c.short || c.label)}</span> ${fmtVol(row[c.key])}</span>`
      )
      .join("");
    return `<td class="row-mobile-pack is-mobile" colspan="${volCount + 2}">
      <div class="row-mobile-volumes">${volLine}<span class="rank-cell">${rankCellForRow(row)}</span></div>
      <div class="row-mobile-search">${rowSearch(row.keyword)}</div>
      <div class="row-mobile-actions"><div class="row-tools-actions" role="group" aria-label="Actions">${workflowButtons(row)}</div></div>
    </td>`;
  }

  function closeReplyPopover() {
    document.getElementById("reply-popover")?.remove();
    document.removeEventListener("click", onReplyPopoverOutside, true);
  }

  function onReplyPopoverOutside(e) {
    const pop = document.getElementById("reply-popover");
    if (
      !pop ||
      pop.contains(e.target) ||
      e.target.closest("[data-action='reply']") ||
      e.target.closest("[data-bulk-action='reply']")
    )
      return;
    closeReplyPopover();
  }

  function showReplyPopover(anchor, keyword, currentPlatforms) {
    closeReplyPopover();
    const pop = document.createElement("div");
    pop.className = "reply-popover";
    pop.id = "reply-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", `Platforms for ${keyword}`);
    const selected = new Set(currentPlatforms);
    const platforms = ["twitter", "linkedin", "reddit"];
    pop.innerHTML = `
      <p class="reply-popover-kw">${esc(keyword)}</p>
      <p class="reply-popover-title">Posted on</p>
      <div class="reply-platforms">
        ${platforms
          .map(
            (p) =>
              `<button type="button" class="reply-chip${selected.has(p) ? " is-on" : ""}" data-platform="${p}">${esc(SOCIAL_PLATFORM_LABELS[p])}</button>`
          )
          .join("")}
      </div>
      <div class="reply-popover-actions">
        <button type="button" class="btn-sm btn-ghost" id="reply-cancel">Cancel</button>
        <button type="button" class="btn-sm btn-black" id="reply-save">Save</button>
      </div>`;
    document.body.appendChild(pop);
    const rect = anchor.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popRect.width - 8));
    pop.style.top = `${rect.bottom + window.scrollY + 6}px`;
    pop.style.left = `${left + window.scrollX}px`;

    pop.querySelectorAll(".reply-chip").forEach((chip) => {
      chip.addEventListener("click", () => chip.classList.toggle("is-on"));
    });
    pop.querySelector("#reply-cancel").addEventListener("click", closeReplyPopover);
    pop.querySelector("#reply-save").addEventListener("click", async () => {
      const chosen = [...pop.querySelectorAll(".reply-chip.is-on")].map((c) => c.dataset.platform);
      await setSocialPlatforms(keyword, chosen);
      closeReplyPopover();
      await pulseNavBadge("replied");
      await loadCounts();
      await refreshPanel();
    });
    requestAnimationFrame(() => {
      document.addEventListener("click", onReplyPopoverOutside, true);
    });
  }

  function showBulkReplyPopover(anchor, keywords) {
    closeReplyPopover();
    const count = keywords.length;
    if (!count) return;
    const pop = document.createElement("div");
    pop.className = "reply-popover";
    pop.id = "reply-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", `Platforms for ${count} questions`);
    const platforms = ["twitter", "linkedin", "reddit"];
    pop.innerHTML = `
      <p class="reply-popover-kw">${count} question${count === 1 ? "" : "s"}</p>
      <p class="reply-popover-title">Posted on</p>
      <div class="reply-platforms">
        ${platforms
          .map((p) => `<button type="button" class="reply-chip" data-platform="${p}">${esc(SOCIAL_PLATFORM_LABELS[p])}</button>`)
          .join("")}
      </div>
      <div class="reply-popover-actions">
        <button type="button" class="btn-sm btn-ghost" id="reply-cancel">Cancel</button>
        <button type="button" class="btn-sm btn-black" id="reply-save">Apply to all</button>
      </div>`;
    document.body.appendChild(pop);
    const rect = anchor.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popRect.width - 8));
    pop.style.top = `${rect.bottom + window.scrollY + 6}px`;
    pop.style.left = `${left + window.scrollX}px`;

    pop.querySelectorAll(".reply-chip").forEach((chip) => {
      chip.addEventListener("click", () => chip.classList.toggle("is-on"));
    });
    pop.querySelector("#reply-cancel").addEventListener("click", closeReplyPopover);
    pop.querySelector("#reply-save").addEventListener("click", async () => {
      const chosen = [...pop.querySelectorAll(".reply-chip.is-on")].map((c) => c.dataset.platform);
      if (!chosen.length) {
        alert("Pick at least one platform.");
        return;
      }
      if (!confirm(`Mark ${count} question${count === 1 ? "" : "s"} as replied?`)) return;
      closeReplyPopover();
      await api("/api/keywords/action-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", keywords, platforms: chosen }),
      });
      await pulseNavBadge("replied");
      await refreshPanel();
    });
    requestAnimationFrame(() => {
      document.addEventListener("click", onReplyPopoverOutside, true);
    });
  }

  function ageClass(publishedAt) {
    if (!publishedAt) return "";
    const years = (Date.now() - new Date(publishedAt).getTime()) / (365.25 * 86400000);
    if (years < 1) return "age-fresh";
    if (years < 3) return "age-mid";
    return "age-stale";
  }

  function fmtDate(d) {
    if (!d) return "-";
    return d.slice(0, 10);
  }

  function fmtScheduleNext(iso) {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso.slice(0, 16);
    }
  }

  function openTopUp() {
    state.topUpOpen = true;
    state.topUpLoading = false;
    state.topUpError = null;
    render();
  }

  function closeTopUp() {
    state.topUpOpen = false;
    state.topUpLoading = false;
    state.topUpError = null;
    render();
  }

  function topUpOverlay() {
    if (!state.topUpOpen) return "";
    const b = state.budget || {};
    const topupCredits = formatCredits(b.topup_credits ?? 2000);
    const topupUsd = b.topup_usd ?? 10;
    const primaryDisabled = state.topUpLoading ? "disabled" : "";
    const primaryLabel = state.topUpLoading ? "Adding credits…" : "Top up";
    return `
      <div class="seed-onboard-backdrop" data-topup-overlay role="dialog" aria-modal="true" aria-labelledby="topup-title">
        <div class="seed-onboard-card topup-card">
          <div class="seed-onboard-head">
            <p class="seed-onboard-kicker">Research credits</p>
            <h2 id="topup-title" class="seed-onboard-title">$${topupUsd} for ${topupCredits} credits</h2>
          </div>
          <div class="seed-onboard-body">
            <p class="seed-onboard-lead">
              Adds <strong>${topupCredits}</strong> credits to your research allowance.
              Checkout is not live yet, so this tops you up instantly while you are on the early plan.
            </p>
            ${state.topUpError ? `<p class="seed-onboard-error" role="alert">${esc(state.topUpError)}</p>` : ""}
          </div>
          <div class="seed-onboard-actions">
            <button type="button" class="btn-md btn-ghost" data-topup-cancel ${primaryDisabled}>Cancel</button>
            <button type="button" class="btn-md btn-primary" data-topup-confirm ${primaryDisabled}>${esc(primaryLabel)}</button>
          </div>
        </div>
      </div>`;
  }

  async function runCreditTopUp() {
    if (state.topUpLoading) return;
    state.topUpLoading = true;
    state.topUpError = null;
    render();
    try {
      await api("/api/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      await loadBudget();
      closeTopUp();
    } catch (err) {
      state.topUpLoading = false;
      state.topUpError = err.message || "Top-up failed";
      render();
    }
  }

  function bindTopUp() {
    if (!state.topUpOpen) return;

    document.querySelector("[data-topup-overlay]")?.addEventListener("click", (e) => {
      if (e.target?.matches?.("[data-topup-overlay]") && !state.topUpLoading) {
        closeTopUp();
      }
    });

    document.querySelector("[data-topup-cancel]")?.addEventListener("click", () => {
      if (!state.topUpLoading) closeTopUp();
    });

    document.querySelector("[data-topup-confirm]")?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await runCreditTopUp();
    });
  }

  function sidebarCreditsBar() {
    const b = state.budget;
    if (!b) {
      return `
        <div class="rail-credits rail-credits--loading">
          <div class="rail-credits-head">
            <span class="rail-credits-label">Credits</span>
          </div>
          <div class="progress-track rail-credits-track"><div class="progress-fill rail-credits-fill" style="width:0%"></div></div>
        </div>`;
    }
    const monthly = b.creator_monthly_credits ?? 5000;
    const allowance = b.credit_allowance ?? monthly;
    const spent = b.session_spent_credits ?? 0;
    const remaining = b.credit_balance ?? Math.max(0, allowance - spent);
    const pct = allowance > 0 ? Math.min(100, Math.round((spent / allowance) * 100)) : 0;
    const empty = remaining <= 0;
    const low = empty || remaining < allowance * 0.1;
    const topUpAction = `<button type="button" class="rail-credits-topup" data-open-topup>Top up</button>`;
    const inner = `
        <div class="rail-credits-head">
          <span class="rail-credits-label">Credits</span>
          <span class="rail-credits-meta mono">${formatCredits(remaining)} left</span>
        </div>
        <div class="progress-track rail-credits-track" role="progressbar" aria-valuenow="${remaining}" aria-valuemin="0" aria-valuemax="${allowance}" aria-label="Credits used this session">
          <div class="progress-fill rail-credits-fill" style="width:${pct}%"></div>
        </div>
        <div class="rail-credits-foot-row">
          <p class="rail-credits-foot mono">${creditsAllowanceFoot(b)}</p>
          ${topUpAction}
        </div>`;
    const classes = `rail-credits${low && !empty ? " rail-credits--low" : ""}${empty ? " rail-credits--empty" : ""}`;
    return `<div class="${classes}">${inner}</div>`;
  }

  function optLabGenerationsData() {
    const g = optLabGenerationsStatus();
    if (!g) return null;
    const limit = g.limit ?? 50;
    const used = g.used ?? 0;
    const remaining = optLabGenerationsRemaining() ?? 0;
    const inFlight = state.panel === "optimize_lab" || state.panel === "brain" ? optLabGenerationsInFlight() : 0;
    const displayRemaining = Math.max(0, remaining - inFlight);
    const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const planLabel = g.plan === "pro" ? "Pro" : "Creator";
    const low = displayRemaining <= Math.ceil(limit * 0.1);
    const empty = displayRemaining <= 0;
    return { limit, used, remaining, displayRemaining, inFlight, pct, planLabel, low, empty };
  }

  function sidebarWritersBar() {
    const b = state.budget;
    if (!b) {
      return `
        <div class="rail-credits rail-credits--writers rail-credits--loading">
          <div class="rail-credits-head">
            <span class="rail-credits-label">Generations</span>
          </div>
          <div class="progress-track rail-credits-track"><div class="progress-fill rail-credits-fill" style="width:0%"></div></div>
        </div>`;
    }
    const data = optLabGenerationsData();
    if (!data) return sidebarCreditsBar();
    const { limit, used, displayRemaining, inFlight, pct, planLabel, low, empty } = data;
    const pendingNote = inFlight ? ` · ${inFlight} running` : "";
    const inner = `
        <div class="rail-credits-head">
          <span class="rail-credits-label">Generations</span>
          <span class="rail-credits-meta mono">${formatCredits(displayRemaining)} left</span>
        </div>
        <div class="progress-track rail-credits-track" role="progressbar" aria-valuenow="${used}" aria-valuemin="0" aria-valuemax="${limit}" aria-label="Optimize Lab generations used this month">
          <div class="progress-fill rail-credits-fill" style="width:${pct}%"></div>
        </div>
        <p class="rail-credits-foot mono">${formatCredits(used)} of ${formatCredits(limit)} this month · ${esc(planLabel)}${pendingNote} · resets 1st</p>`;
    const classes = `rail-credits rail-credits--writers${low && !empty ? " rail-credits--low" : ""}${empty ? " rail-credits--empty" : ""}`;
    return `<div class="${classes}">${inner}</div>`;
  }


  function railToggleButton(variant) {
    const collapsed = state.railCollapsed;
    const label = railToggleLabel(collapsed);
    const expanded = !collapsed;
    return `<button type="button" class="rail-toggle rail-toggle--${variant}" data-rail-toggle aria-expanded="${expanded}" aria-label="${label}" data-tooltip="${label}"><span class="rail-toggle-icon" aria-hidden="true">${railToggleIcon(collapsed)}</span></button>`;
  }

  function shellBrand() {
    return `<a class="shell-brand" href="/" aria-label="Ansaur home"><span class="shell-wordmark-brand">Ansaur</span><span class="shell-wordmark-tld">.com</span></a>`;
  }

  function sidebarNavGroups() {
    const questionSubPanels = [
      { id: "skipped", label: "Skipped", count: state.skippedCount },
      { id: "filmed", label: "Filmed", count: state.filmedCount },
      { id: "written", label: "Written", count: state.writtenCount },
      { id: "optimized", label: "Optimized", count: state.optimizedCount },
      { id: "replied", label: "Replied", count: state.repliedCount },
      { id: "first_page", label: "First Page", count: state.firstPageCount },
      { id: "show_all", label: "All Questions", count: state.showAllCount },
    ];
    const otherPanels = [
      { id: "run", label: "Scout" },
      { id: "settings", label: "Settings" },
    ];
    const keywordNav =
      navItem({ id: "questions", label: "Questions", count: state.questionsCount }) +
      questionSubPanels.map((p) => navItem(p, { sub: true })).join("") +
      otherPanels.map(navItem).join("");
    const brainNav = optimizeLabSidebarNav();
    return { keywordNav, brainNav };
  }

  function topNav() {
    const { keywordNav, brainNav } = sidebarNavGroups();
    return `
      <nav class="top-nav" aria-label="Main navigation">
        <div class="top-nav-inner">
          <div class="top-nav-items">
            ${keywordNav}
            <span class="top-nav-divider" role="separator" aria-hidden="true"></span>
            ${brainNav}
          </div>
        </div>
      </nav>`;
  }

  function sidebar() {
    const { keywordNav, brainNav } = sidebarNavGroups();
    return `
      <aside class="rail" aria-label="Main navigation">
        ${railToggleButton("mobile")}
        <div class="rail-head">
          ${sidebarUsageStack()}
        </div>
        <div class="rail-scroll">
          <div class="nav-group-label">QUESTION RESEARCH</div>
          ${keywordNav}
          <div class="nav-divider" role="separator"></div>
          <div class="nav-group-label">OPTIMIZE LAB</div>
          ${brainNav}
        </div>
      </aside>`;
  }

  function optimizeLabSidebarNav() {
    const items = [
      { id: "optimize_lab", label: "Optimize Lab" },
      { id: "optimize_lab_settings", label: "Settings" },
      { id: "optimize_lab_connections", label: "Connections", soon: true },
    ];
    return items
      .map((p) => {
        const active = state.panel === p.id ? " active" : "";
        const href = panelToPath(p.id);
        const soon = p.soon ? " nav-soon" : "";
        const badge = p.soon ? `<span class="soon-badge">Soon</span>` : "";
        return `<a class="nav-item nav-sub-item${soon}${active}" href="${href}" data-panel="${p.id}"><span class="nav-label">${p.label}</span>${badge}</a>`;
      })
      .join("");
  }

  function navItem(p, opts = {}) {
    const active = state.panel === p.id ? " active" : "";
    const sub = opts.sub ? " nav-sub-item" : "";
    const count =
      p.count != null && p.count > 0 ? `<span class="nav-count">${p.count}</span>` : "";
    const href = panelToPath(p.id);
    return `<a class="nav-item${sub}${active}" href="${href}" data-panel="${p.id}"><span class="nav-label">${p.label}</span>${count}</a>`;
  }

  function rankCellForRow(row) {
    if (row.bettersheets_ranks) return firstPageRankCell(row);
    return rankCell(row);
  }

  function rankCellTd(row) {
    return `<td class="rank-cell is-desktop">${rankCellForRow(row)}</td>`;
  }

  const BRAIN_INFO_ICON = `<svg class="rank-col-info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.2 4.2C4.1 4.6 3.4 5.6 3.4 6.8c0 .6.2 1.1.5 1.5-.6.4-1 1-1 1.8 0 1.2 1 2.2 2.2 2.2.4 0 .7-.1 1-.3"/><path d="M10.8 4.2c1.1.4 1.8 1.4 1.8 2.6 0 .6-.2 1.1-.5 1.5.6.4 1 1 1 1.8 0 1.2-1 2.2-2.2 2.2-.4 0-.7-.1-1-.3"/><path d="M8 3.8v8.2"/><path d="M6.2 7.6h3.6"/><path d="M5.6 4.2c0-1.2 1.1-2 2.4-2s2.4.8 2.4 2"/></svg>`;

  function rankColumnHeader() {
    return `<th class="th-rank"><span class="th-rank-inner"><span class="th-rank-label">Rank</span><button type="button" class="rank-col-info-btn" data-panel="optimize_lab" aria-label="Open Optimize Lab" title="Thicken posts that rank in Optimize Lab">${BRAIN_INFO_ICON}</button></span></th>`;
  }

  function keywordWorkflowTable(rows, emptyMessage = "No questions yet. Run Search on Scouts or paste keywords there.") {
    const body = rows
      .map((r) => {
        const skipped = r.skipped ? "1" : "";
        return `<tr class="question-row" data-statuses="${(r.statuses || []).join(",")}" data-skipped="${skipped}">
        <td class="kw">${esc(r.keyword)}${socialBadges(r)}</td>
        ${volumeDataCells(r, { desktopOnly: true })}
        ${rankCellTd(r)}
        <td class="row-tools-cell is-desktop">${rowTools(r)}</td>
        ${rowMobilePack(r)}
      </tr>`;
      })
      .join("");
    const colCount = activeVolumeColumns().length + 3;
    const emptyRow =
      !body && emptyMessage && !state.search.trim()
        ? `<tr><td colspan="${colCount}">${emptyMessage}</td></tr>`
        : "";
    return `<table class="data-table">
      <thead><tr>
        <th>Question</th>${volumeHeaderCells()}${rankColumnHeader()}<th>Search &amp; actions</th>
      </tr></thead>
      <tbody>${body || emptyRow}</tbody>
    </table>`;
  }

  function workflowSortSelect(id = "questions-sort") {
    return `<select class="sort-select sort-select--plain" id="${id}" aria-label="Sort questions">
      ${volumeSortOptions(state.questionsSort)}
    </select>`;
  }

  function workflowToolbar({ placeholder, sortId = "questions-sort", includeSort = true }) {
    return `
      <div class="toolbar">
        <div class="toolbar-filters">
          <input class="search" type="search" placeholder="${placeholder}" value="${esc(state.search)}" id="search-input" />
          ${includeSort ? workflowSortSelect(sortId) : ""}
        </div>
      </div>`;
  }

  function showAllPanel() {
    const rows = state.showAll;
    const total =
      state.showAllCount ||
      state.questionsCount + state.skippedCount + state.filmedCount + state.writtenCount + state.optimizedCount + state.repliedCount + state.firstPageCount;
    return `
      <div class="page-header">
        <h2 class="page-title">Show All</h2>
        <span class="page-meta">${total} questions across every section · filled red buttons show active actions</span>
      </div>
      <div class="toolbar">
        <div class="toolbar-filters">
          <input class="search" type="search" placeholder="Search all questions…" value="${esc(state.search)}" id="search-input" />
          <select class="sort-select sort-select--plain" id="show-all-sort" aria-label="Sort all questions">
            ${volumeSortOptions(state.showAllSort)}
            <option value="section" ${state.showAllSort === "section" ? "selected" : ""}>Section</option>
            <option value="keyword" ${state.showAllSort === "keyword" ? "selected" : ""}>Keyword A–Z</option>
          </select>
        </div>
      </div>
      ${searchVolumeBar(rows, { showBulkActions: true })}
      ${gridExportBar("/api/export/show-all", "all_questions.csv")}
      ${gridContent(keywordWorkflowTable(rows, "No questions yet. Run Search on Scouts or paste keywords there."))}`;
  }

  function questionsTable(rows) {
    return keywordWorkflowTable(rows);
  }

  function skippedPanel() {
    return `
      <div class="page-header">
        <h2 class="page-title">Skipped</h2>
        <span class="page-meta">${state.skippedCount} parked questions · click Skip again to unskip, or use any action without leaving this tab</span>
      </div>
      ${workflowToolbar({ placeholder: "Search skipped…" })}
      ${searchVolumeBar(state.skipped)}
      ${gridExportBar("/api/export/skipped", "skipped.csv")}
      ${gridContent(keywordWorkflowTable(state.skipped, "No skipped questions. Use Skip on the Questions tab to park keywords here."))}`;
  }

  function filmedPanel() {
    return `
      <div class="page-header">
        <h2 class="page-title">Filmed</h2>
        <span class="page-meta">${state.filmedCount} questions you’ve filmed · use Write or any action right here</span>
      </div>
      ${workflowToolbar({ placeholder: "Search filmed…", includeSort: false })}
      ${searchVolumeBar(state.filmed)}
      ${gridExportBar("/api/export/filmed", "filmed.csv")}
      ${gridContent(keywordWorkflowTable(state.filmed, "No filmed questions yet. Hit Film it on the Questions tab."))}`;
  }

  function writtenPanel() {
    return `
      <div class="page-header">
        <h2 class="page-title">Written</h2>
        <span class="page-meta">${state.writtenCount} questions you answered in an article · all actions stay available on every tab</span>
      </div>
      ${workflowToolbar({ placeholder: "Search written…", includeSort: false })}
      ${searchVolumeBar(state.written)}
      ${gridExportBar("/api/export/written", "written.csv")}
      ${gridContent(keywordWorkflowTable(state.written, "No written questions yet. Hit Write on any tab."))}`;
  }

  function optimizedPanel() {
    return `
      <div class="page-header">
        <h2 class="page-title">Optimized</h2>
        <span class="page-meta">${state.optimizedCount} keywords woven into your site · all actions stay available on every tab</span>
      </div>
      ${workflowToolbar({ placeholder: "Search optimized…", includeSort: false })}
      ${searchVolumeBar(state.optimized)}
      ${gridExportBar("/api/export/optimized", "optimized.csv")}
      ${gridContent(keywordWorkflowTable(state.optimized, "Nothing optimized yet. Hit Optimize on any tab."))}`;
  }

  function repliedPanel() {
    return `
      <div class="page-header">
        <h2 class="page-title">Replied</h2>
        <span class="page-meta">${state.repliedCount} questions you answered on social · same keyword can appear in multiple tabs</span>
      </div>
      ${workflowToolbar({ placeholder: "Search replied…", includeSort: false })}
      ${searchVolumeBar(state.replied)}
      ${gridExportBar("/api/export/replied", "replied.csv")}
      ${gridContent(keywordWorkflowTable(state.replied, "No replies yet. Hit Reply on any tab after posting on social."))}`;
  }

  function prefixHideDropdown() {
    const roots = singleWordPrefixRoots();
    const hiddenCount = state.questions.length - visibleQuestions(state.questions).length;
    const options = roots
      .map(
        (root) =>
          `<label class="prefix-hide-option"><input type="checkbox" data-hide-prefix-root="${esc(root)}" ${isPrefixRootHidden(root) ? "checked" : ""} /> ${esc(prefixRootLabel(root))}</label>`,
      )
      .join("");
    const label = hiddenCount > 0 ? `Hide (${hiddenCount})` : "Hide";
    return `
          <div class="prefix-hide-dropdown">
            <button
              type="button"
              class="btn-sm btn-ghost toolbar-filter-btn${state.prefixHideOpen ? " toolbar-filter-btn--open" : ""}"
              id="prefix-hide-toggle"
              aria-expanded="${state.prefixHideOpen ? "true" : "false"}"
              aria-haspopup="true"
            >${label}</button>
            <div class="prefix-hide-menu" id="prefix-hide-menu" ${state.prefixHideOpen ? "" : "hidden"}>
              ${options || '<p class="prefix-hide-empty">No single-word prefixes loaded.</p>'}
            </div>
          </div>`;
  }

  function questionsPanel() {
    const all = state.questions;
    const rows = visibleQuestions(all);
    return `
      <div class="page-header">
        <h2 class="page-title">Questions</h2>
      </div>
      <div class="toolbar">
        <div class="toolbar-filters">
          <button
            type="button"
            class="btn-sm btn-ghost toolbar-filter-btn"
            id="hide-how-btn"
            aria-pressed="${isPrefixRootHidden("how") ? "true" : "false"}"
          >Hide How</button>
          ${prefixHideDropdown()}
          <input class="search" type="search" placeholder="Search questions…" value="${esc(state.search)}" id="search-input" />
          ${workflowSortSelect("questions-sort")}
        </div>
      </div>
      ${searchVolumeBar(rows, { showBulkActions: true })}
      ${gridExportBar("/api/export/questions", "questions.csv")}
      ${gridContent(questionsTable(rows))}`;
  }

  function gapsPanel() {
    return questionsPanel();
  }

  function firstPagePanel() {
    return `
      <div class="page-header">
        <h2 class="page-title">First Page</h2>
        <span class="page-meta">${state.firstPageCount} questions where your video ranks on Google page 1 · all actions stay available on every tab</span>
      </div>
      <div class="toolbar">
        <div class="toolbar-filters">
          <input class="search" type="search" placeholder="Search questions…" value="${esc(state.search)}" id="search-input" />
        </div>
      </div>
      ${searchVolumeBar(state.firstPage)}
      ${gridExportBar("/api/export/first-page", "first_page.csv")}
      ${gridContent(keywordWorkflowTable(state.firstPage, "Nothing on First Page yet. Wins appear after Scan scouts."))}`;
  }

  function archivedPanel() {
    return firstPagePanel();
  }

  function seedPhraseRow(s) {
    if (state.editingSeedId === s.id) {
      return `<tr>
        <td class="kw">
          <input type="text" class="search prefix-edit-input" id="edit-seed-${esc(s.id)}" value="${esc(s.text.trim())}" />
        </td>
        <td class="actions-cell">
          <div class="action-groups action-chunky">
            <button type="button" class="btn-sm btn-black" data-save-seed="${esc(s.id)}">Save</button>
            <button type="button" class="btn-sm btn-ghost" data-cancel-seed="${esc(s.id)}">Cancel</button>
          </div>
        </td>
      </tr>`;
    }
    return `<tr>
      <td class="kw">${esc(s.text)}</td>
      <td class="actions-cell">
        <div class="action-groups action-chunky">
          <button type="button" class="btn-sm btn-ghost" data-edit-seed="${esc(s.id)}">Edit</button>
          <button type="button" class="btn-sm btn-ghost" data-del-seed="${esc(s.id)}">Delete</button>
        </div>
      </td>
    </tr>`;
  }

  function negativeRow(item) {
    return `<tr>
      <td class="kw">${esc(item.text)}</td>
      <td class="actions-cell">
        <div class="action-groups action-chunky">
          <button type="button" class="btn-sm btn-ghost" data-del-negative="${esc(item.id)}">Remove</button>
        </div>
      </td>
    </tr>`;
  }

  function seedAddReminderHtml() {
    const text = state.seedSearchReminder?.text;
    if (!text) return "";
    return `<p class="seed-add-reminder" role="status" aria-live="polite">
      Added <span class="mono">${esc(text)}</span>.
      <button type="button" class="link-btn" data-go-scout-search>Go to Scout Search</button>
    </p>`;
  }

  function scrollScoutSearchArea() {
    if (!state.scrollScoutSearch || state.panel !== "run") return;
    state.scrollScoutSearch = false;
    requestAnimationFrame(() => {
      const zone = document.querySelector(".jobs-zone-search");
      if (!zone) return;
      zone.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
      zone.classList.add("jobs-zone-search--highlight");
      setTimeout(() => zone.classList.remove("jobs-zone-search--highlight"), 2000);
    });
  }

  function prefixRootLabel(root) {
    if (!root) return "";
    return root.charAt(0).toUpperCase() + root.slice(1);
  }

  function setPrefixSectionStatus(type, message) {
    state.prefixSectionStatus = message ? { type, message } : null;
  }

  function syncOpenPrefixRootsFromDom() {
    const open = [];
    document.querySelectorAll(".prefix-root-group[data-prefix-root]").forEach((el) => {
      if (el.open) open.push(el.getAttribute("data-prefix-root"));
    });
    state.openPrefixRoots = open.filter(Boolean);
  }

  function ensurePrefixRootOpen(root) {
    if (root && !state.openPrefixRoots.includes(root)) {
      state.openPrefixRoots.push(root);
    }
  }

  function isPrefixRootOpen(root) {
    return state.openPrefixRoots.includes(root);
  }

  function togglePrefixRootPanel(root) {
    if (!root || state.prefixSectionBusy) return;
    if (isPrefixRootOpen(root)) {
      state.openPrefixRoots = state.openPrefixRoots.filter((r) => r !== root);
    } else {
      ensurePrefixRootOpen(root);
    }
    render();
  }

  function beginPrefixSectionBusy() {
    syncOpenPrefixRootsFromDom();
    state.prefixSectionBusy = true;
    render();
  }

  async function excludePrefixById(prefixId) {
    if (!prefixId || state.prefixSectionBusy) return;
    beginPrefixSectionBusy();
    try {
      await api(`/api/prefixes/${prefixId}`, { method: "DELETE" });
      setPrefixSectionStatus("success", "Phrase excluded from search.");
      await loadPrefixes();
    } catch (err) {
      setPrefixSectionStatus("error", err.message || "Could not exclude phrase. Try again.");
    } finally {
      state.prefixSectionBusy = false;
      render();
    }
  }

  async function restorePrefixById(prefixId) {
    if (!prefixId || state.prefixSectionBusy) return;
    beginPrefixSectionBusy();
    try {
      await api(`/api/prefixes/${prefixId}/restore`, { method: "POST" });
      setPrefixSectionStatus("success", "Phrase restored.");
      await loadPrefixes();
    } catch (err) {
      setPrefixSectionStatus("error", err.message || "Could not restore phrase. Try again.");
    } finally {
      state.prefixSectionBusy = false;
      render();
    }
  }

  function prefixSectionFeedbackHtml() {
    if (state.prefixSectionBusy) {
      return '<div id="prefix-section-status" class="prefix-section-status prefix-section-status--busy" role="status" aria-live="polite">Saving changes…</div>';
    }
    const s = state.prefixSectionStatus;
    if (!s) {
      return '<div id="prefix-section-status" class="prefix-section-status sr-only" aria-live="polite"></div>';
    }
    const role = s.type === "error" ? "alert" : "status";
    return `<div id="prefix-section-status" class="prefix-section-status prefix-section-status--${esc(s.type)}" role="${role}" aria-live="polite">${esc(s.message)}</div>`;
  }

  function prefixPhraseLabel(text) {
    return (text || "").trim();
  }

  function isSingleWordPrefix(text) {
    return prefixPhraseLabel(text).split(/\s+/).length === 1;
  }

  function prefixGroupTotals(phrases) {
    const counts = state.prefixData?.question_counts?.by_prefix || {};
    return (phrases || []).reduce(
      (acc, p) => {
        const c = counts[p.id] || { all: 0, first_page: 0 };
        acc.all += c.all;
        acc.first_page += c.first_page;
        return acc;
      },
      { all: 0, first_page: 0 },
    );
  }

  function prefixPhraseRow(p, group) {
    const pd = state.prefixData || {};
    const counts = pd.question_counts?.by_prefix?.[p.id] || { all: 0, first_page: 0 };
    const label = prefixPhraseLabel(p.text);
    const excluded = isPrefixExcluded(p);
    const active = isPrefixActive(p, pd);
    const off = active ? "" : " prefix-off";
    const focusEditing = state.focusEditRoot === group.root;
    const focusChecked = (group.focus || []).includes(label.toLowerCase()) || (active && !group.focus_active);
    const focusCell = focusEditing
      ? `<td class="prefix-focus-cell"><label class="prefix-focus-check" aria-label="Focus ${esc(label)}"><input type="checkbox" data-focus-phrase="${esc(group.root)}" value="${esc(label)}" ${focusChecked ? "checked" : ""} ${excluded ? "disabled" : ""} /></label></td>`
      : "";
    const actionBtn = excluded
      ? `<button type="button" class="btn-sm btn-ghost" data-restore-prefix="${esc(p.id)}" ${state.prefixSectionBusy ? "disabled" : ""}>Restore</button>`
      : `<button type="button" class="btn-sm btn-ghost" data-exclude-prefix="${esc(p.id)}" ${state.prefixSectionBusy ? "disabled" : ""}>Exclude</button>`;
    const excludedBadge = excluded
      ? ' <span class="prefix-badge prefix-badge-excluded">Excluded</span>'
      : "";
    const phraseToggleTitle = excluded ? "Click to restore this phrase" : "Click to exclude this phrase";
    return `<tr class="${off}${excluded ? " prefix-row-excluded" : ""}">
      ${focusCell}
      <td class="kw prefix-phrase-cell">
        <button type="button" class="prefix-phrase-btn${excluded ? " prefix-phrase-btn--excluded" : ""}" data-toggle-prefix="${esc(p.id)}" data-prefix-excluded="${excluded ? "1" : "0"}" aria-pressed="${excluded ? "true" : "false"}" title="${phraseToggleTitle}">${esc(label)}${isSingleWordPrefix(p.text) ? ' <span class="prefix-root-tag">root</span>' : ""}${excludedBadge}</button>
      </td>
      ${prefixCountCell(counts)}
      <td class="actions-cell">
        <div class="action-groups action-chunky">${actionBtn}</div>
      </td>
    </tr>`;
  }

  function prefixGroupCard(group) {
    const pd = state.prefixData || {};
    const phrases = [...(group.phrases || [])].sort((a, b) => {
      const aEx = isPrefixExcluded(a) ? 1 : 0;
      const bEx = isPrefixExcluded(b) ? 1 : 0;
      if (aEx !== bEx) return aEx - bEx;
      const aw = isSingleWordPrefix(a.text) ? 0 : 1;
      const bw = isSingleWordPrefix(b.text) ? 0 : 1;
      if (aw !== bw) return aw - bw;
      return prefixPhraseLabel(a.text).localeCompare(prefixPhraseLabel(b.text));
    });
    const activePhrases = phrases.filter((p) => isPrefixActive(p, pd));
    const totals = prefixGroupTotals(phrases);
    const focusEditing = state.focusEditRoot === group.root;
    const focusSummary = group.focus_active
      ? group.focus.map((f) => esc(f)).join(", ")
      : "All phrases";
    const phraseRows = phrases.map((p) => prefixPhraseRow(p, group)).join("");
    const focusCol = focusEditing ? "<th>Focus</th>" : "";
    const focusControls = focusEditing
      ? `<div class="prefix-focus-actions">
          <button type="button" class="btn-sm btn-secondary" data-save-focus="${esc(group.root)}" ${state.prefixSectionBusy ? "disabled" : ""}>Save focus</button>
          <button type="button" class="btn-sm btn-ghost" data-cancel-focus="${esc(group.root)}" ${state.prefixSectionBusy ? "disabled" : ""}>Cancel</button>
        </div>`
      : `<div class="prefix-focus-actions">
          <button type="button" class="btn-sm btn-ghost" data-edit-focus="${esc(group.root)}" ${state.prefixSectionBusy ? "disabled" : ""}>Focus selected phrases</button>
          ${group.focus_active ? `<button type="button" class="btn-sm btn-ghost" data-clear-focus="${esc(group.root)}" ${state.prefixSectionBusy ? "disabled" : ""}>Search all phrases</button>` : ""}
        </div>`;
    const focusNotice = focusEditing
      ? `<p class="prefix-focus-notice" id="prefix-focus-notice-${esc(group.root)}" role="status" aria-live="polite">Check the phrases to keep for <strong>${esc(prefixRootLabel(group.root))}</strong>, then save.</p>`
      : "";
    const detailsOpen = isPrefixRootOpen(group.root) || focusEditing;
    return `
      <details class="prefix-root-group" data-prefix-root="${esc(group.root)}"${detailsOpen ? " open" : ""}>
        <summary class="prefix-root-summary">
          <span class="prefix-root-name">${esc(prefixRootLabel(group.root))}</span>
          <span class="prefix-root-meta">${activePhrases.length} active · ${phrases.length} phrases · ${totals.all} questions</span>
          <span class="prefix-root-badges">
            ${group.focus_active ? `<span class="prefix-badge prefix-badge-focus">Focus: ${focusSummary}</span>` : ""}
            ${group.excluded_count ? `<span class="prefix-badge prefix-badge-excluded">${group.excluded_count} excluded</span>` : ""}
          </span>
        </summary>
        <div class="prefix-group-panel">
          ${focusNotice}
          ${focusControls}
          <div class="prefix-table-scroll" tabindex="0" role="region" aria-label="${esc(prefixRootLabel(group.root))} phrases">
            <table class="data-table prefix-table prefix-phrase-table">
              <thead><tr>${focusCol}<th>Phrase</th><th>All</th><th>First Page</th><th>Actions</th></tr></thead>
              <tbody>${phraseRows || "<tr><td colspan='5'>No phrases in this group.</td></tr>"}</tbody>
            </table>
          </div>
        </div>
      </details>`;
  }

  function buildPrefixQuestionCounts(rows, prefixes) {
    const labelToId = {};
    for (const p of prefixes || []) {
      const label = (p.text || "").trim().toLowerCase();
      if (label) labelToId[label] = p.id;
    }
    const byPrefix = {};
    for (const p of prefixes || []) {
      byPrefix[p.id] = { all: 0, first_page: 0 };
    }
    for (const row of rows || []) {
      const label = (row.question_prefix || "").trim().toLowerCase();
      const id = labelToId[label];
      if (!id) continue;
      byPrefix[id].all += 1;
      if (row.bettersheets_ranks) byPrefix[id].first_page += 1;
    }
    return {
      by_prefix: byPrefix,
      totals: {
        all: state.showAllCount || rows?.length || 0,
        first_page: state.firstPageCount || 0,
      },
    };
  }

  function prefixCountCell(counts) {
    const all = counts?.all ?? 0;
    const firstPage = counts?.first_page ?? 0;
    return `<td class="num">${all}</td><td class="num">${firstPage}</td>`;
  }

  function settingsPanel() {
    const pd = state.prefixData || { prefixes: [], seed_phrases: [], negatives: [], discovery: {} };
    const d = pd.discovery || {};
    const seedPhrases = pd.seed_phrases || [];
    const negatives = [...(pd.negatives || pd.excludes || [])].sort((a, b) => a.text.localeCompare(b.text));
    const seedSummary = seedPhrases.map((s) => s.text).join(", ") || d.seed_phrase || "google sheets";
    const seedRows = seedPhrases.map(seedPhraseRow).join("");
    const groups = pd.prefix_groups || [];
    const groupCards = groups.map(prefixGroupCard).join("");
    const negativeRows = negatives.map(negativeRow).join("");
    const negativeCount = negatives.length;
    const qTotals = pd.question_counts?.totals || {
      all: state.showAllCount || 0,
      first_page: state.firstPageCount || 0,
    };
    const yearRange =
      negativeCount > 0
        ? `${negatives[0]?.text}–${negatives[negatives.length - 1]?.text}`
        : "none";
    return `
      <div class="page-header">
        <h2 class="page-title">Settings</h2>
      </div>
      <div class="settings-panel">
        ${settingsSection(
          "seed-phrases",
          "Seed phrases",
          `
          <p class="disc-hint">Ansaur hunts questions by pairing starters (<span class="mono">how to</span>, <span class="mono">can</span>, <span class="mono">what is</span>) with your seed phrases (<span class="mono">google sheets</span>, <span class="mono">vlookup</span>). A keyword must include at least one seed phrase and start with a starter you keep enabled.</p>
          <p class="disc-hint">Not sure what to add? <button type="button" class="link-btn" data-open-seed-finder>Find seed phrases</button> for your niche.</p>
          <table class="data-table prefix-table">
            <thead><tr><th>Seed phrase</th><th>Actions</th></tr></thead>
            <tbody>${seedRows || `<tr><td colspan="2" class="seed-empty-cell">No seed phrases yet. <button type="button" class="link-btn" data-open-seed-finder>Find seed phrases</button> for your niche, or add one below.</td></tr>`}</tbody>
          </table>
          <div class="prefix-add">
            <input type="text" id="new-seed" class="search" placeholder="Add seed phrase e.g. google sheets" />
            <button type="button" class="btn-md btn-primary" id="add-seed-btn">Add seed phrase</button>
          </div>
          ${seedAddReminderHtml()}`
        )}
        ${settingsSection(
          "question-prefixes",
          "Question prefixes",
          `
          <p class="disc-hint">Your palette starts with single-word roots (<span class="mono">how</span>, <span class="mono">why</span>, <span class="mono">what</span>…). Expand a root to see longer phrases, <strong>focus</strong> on only the ones you want, or <strong>exclude</strong> phrases you do not want to search. Excluded phrases stay in the list with an <span class="prefix-badge prefix-badge-excluded">Excluded</span> badge: click the phrase to restore it. Current seeds: <strong>${esc(seedSummary)}</strong>. Found: <strong>${qTotals.all}</strong> all · <strong>${qTotals.first_page}</strong> first page.</p>
          <p class="prefix-table-scroll-hint">Swipe phrase tables sideways to see all columns.</p>
          ${prefixSectionFeedbackHtml()}
          <div class="prefix-root-list">${groupCards || "<p class=\"disc-hint\">No prefixes loaded.</p>"}</div>
          <div class="prefix-add">
            <label for="new-prefix" class="sr-only">Add custom question phrase</label>
            <input type="text" id="new-prefix" class="search" placeholder="Add custom phrase e.g. how come" aria-describedby="prefix-section-status" ${state.prefixSectionBusy ? "disabled" : ""} />
            <button type="button" class="btn-md btn-primary" id="add-prefix-btn" ${state.prefixSectionBusy ? "disabled" : ""}>Add phrase</button>
          </div>`,
          { bodyAttrs: `aria-busy="${state.prefixSectionBusy ? "true" : "false"}"` },
        )}
        ${settingsSection(
          "negative-list",
          "Negative List",
          `
          <p class="disc-hint">Keywords containing any negative term are removed from results, even if they match a prefix. Years use whole-word matching (e.g. <span class="mono">2024</span> blocks <span class="mono">google sheets 2024</span> but not <span class="mono">20240</span>). Default: last 10 years (${esc(yearRange)}).</p>
          <table class="data-table prefix-table">
            <thead><tr><th>Negative term</th><th>Actions</th></tr></thead>
            <tbody>${negativeRows || "<tr><td colspan='2'>No negatives. Add a year or phrase below.</td></tr>"}</tbody>
          </table>
          <div class="prefix-add">
            <input type="text" id="new-negative" class="search" placeholder="Add negative e.g. 2024 or competitor name" />
            <button type="button" class="btn-md btn-primary" id="add-negative-btn">Add negative</button>
          </div>`
        )}
        ${settingsSection("import-keywords", "Import keywords", importKeywordsPanel())}
        ${workflowHideSection()}
        ${rankSettingsSection()}
        ${locationSettingsSection()}
        ${settingsSection(
          "filter-rules",
          "Filter rules",
          `
          <div class="disc-rules">
            <label>Min global volume <input id="disc-min-vol" type="number" value="${d.min_global_volume ?? 10}" /></label>
            <button type="button" class="btn-md btn-black" id="save-discovery">Save rules</button>
          </div>
          <p class="disc-hint">Run a seed phrase on Scout Search (1 credit per prefix × seed phrase).</p>`
        )}
        ${probeSettingsSection()}
      </div>`;
  }

  function runPanel() {
    const j = state.job;
    const running = state.jobRunning && j && j.status === "running";
    const failed = j && j.status === "failed";
    const b = state.budget || {};

    return `
      <div class="page-header jobs-command-header">
        <div class="jobs-header-text">
          <h2 class="page-title">Scout</h2>
          <p class="page-meta">Send scouts out to find questions.</p>
        </div>
      </div>
      <div class="run-panel jobs-desk jobs-command">
        ${scoutIsoHero(j, running, failed)}
        <div class="jobs-command-body">
          <div class="jobs-command-primary">
            <div class="jobs-scout-grid">
              ${runSearchColumn(running)}
              ${runScanColumn(running)}
              ${runProbeColumn()}
            </div>
            ${onPatrolSection(running)}
            ${SHOW_TEST_SECTION ? testRunSection(running) : ""}
          </div>
          <aside class="jobs-command-rail" aria-label="Returns and budget">
            ${recentRunsSection(true)}
            ${jobsBudgetRail(b)}
          </aside>
        </div>
      </div>`;
  }

  /** Per-category totals for filter chips. */
  function brainCategoryCountsForChips() {
    const counts = { all: 0 };
    for (const t of workshopTechniques()) {
      counts.all++;
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return counts;
  }

  function brainCategoryLabel(id) {
    return workshopCategories()[id] || id;
  }

  const OPTLAB_STARTER_IDS_BY_MODE = {
    enhance: ["tldr", "faq-generator", "keyword-cloud", "use-cases", "suggest-more-of-mine"],
    ideas: ["draft-article", "pre-post", "idea-manipulator"],
  };
  function optLabMode() {
    if (state.optLabMode === "focus") return "focus";
    return state.optLabMode === "ideas" ? "ideas" : "enhance";
  }

  function optLabIsFocusMode() {
    return optLabMode() === "focus";
  }

  function optLabToPageMode(mode) {
    if (mode === "ideas") return "generate";
    if (mode === "focus") return "focus";
    return "enhance";
  }

  function optLabPageModeFromDom(page) {
    if (page?.classList.contains("brain-page--mode-focus")) return "focus";
    if (page?.classList.contains("brain-page--mode-generate")) return "generate";
    return "enhance";
  }

  function workshopTechniques(mode) {
    const active = mode || optLabMode();
    if (active === "focus") return [];
    return active === "ideas" ? window.IDEA_PLANNER_TECHNIQUES || [] : window.BRAIN_TECHNIQUES || [];
  }

  function allWorkshopTechniques() {
    return [...(window.BRAIN_TECHNIQUES || []), ...(window.IDEA_PLANNER_TECHNIQUES || [])];
  }

  function workshopCategories(mode) {
    const active = mode || optLabMode();
    return active === "ideas" ? window.IDEA_PLANNER_CATEGORIES || {} : window.BRAIN_CATEGORIES || {};
  }

  function optLabStarterIds() {
    return OPTLAB_STARTER_IDS_BY_MODE[optLabMode()] || OPTLAB_STARTER_IDS_BY_MODE.enhance;
  }

  function optLabModeHint() {
    return optLabMode() === "ideas"
      ? "Brainstorm follow-up articles, hub pages, and ways to repurpose this post."
      : "Each tool writes a section you paste into your published article.";
  }

  function optLabToolshelfLabel() {
    return optLabMode() === "ideas" ? "Planning tools" : "Section tools";
  }

  function optLabStarterHint() {
    return optLabMode() === "ideas"
      ? "One article can seed a queue of related posts and channel-specific versions."
      : "Run several on the same draft. A TL;DR up top, FAQs at the bottom, internal links in between.";
  }

  const OPTLAB_TIPS = [
    "FAQ Generator writes questions a beginner might have. You answer them.",
    "Stack tools on the same draft: TL;DR up top, FAQs at the bottom, internal links in between.",
    "Each tool reads your article and writes copy you paste in. Generate, copy, drop it into your post.",
    "Draft feels thin? Start with Suggest Multipliers for a checklist of what to add.",
    "Most creators run 3 to 5 tools per article. Your plan includes a monthly generation allowance.",
  ];

  function optLabTipText() {
    if (state.optLabTipIndex == null) {
      state.optLabTipIndex = Math.floor(Math.random() * OPTLAB_TIPS.length);
    }
    return OPTLAB_TIPS[state.optLabTipIndex % OPTLAB_TIPS.length];
  }

  function resetOptLabArticleSession() {
    state.optLabSessionTools = [];
    state.optLabBlocks = [];
    state.optLabQueueDraining = false;
    state.optLabSessionKey = null;
    state.optLabFreshOutputId = null;
    state.optLabTipIndex = Math.floor(Math.random() * OPTLAB_TIPS.length);
  }

  function syncOptLabSessionToolsFromBlocks() {
    state.optLabSessionTools = (state.optLabBlocks || [])
      .filter((b) => b.status === "ready" || b.status === "queued" || b.status === "running")
      .map((b) => b.technique_id);
  }

  function optLabBlockForTechnique(techniqueId) {
    return (state.optLabBlocks || []).find((b) => b.technique_id === techniqueId);
  }

  function optLabTechniqueGenStatus(techniqueId) {
    return optLabBlockForTechnique(techniqueId)?.status || null;
  }

  function optLabBlocksFromServer(outputs) {
    return [...(outputs || [])]
      .sort((a, b) => {
        const aTs = a.updated_at || a.created_at || "";
        const bTs = b.updated_at || b.created_at || "";
        return bTs.localeCompare(aTs);
      })
      .map((row) => ({ ...row, status: "ready" }));
  }

  function mergeOptLabBlocksWithInFlight(serverOutputs) {
    const inFlight = (state.optLabBlocks || []).filter(
      (b) => b.status === "queued" || b.status === "running" || b.status === "error"
    );
    return [...inFlight, ...optLabBlocksFromServer(serverOutputs)];
  }

  async function resolveOptLabSessionKey(article) {
    if (article?.session_key) return article.session_key;
    const data = await api("/api/optimize-lab/session-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: article?.url || "",
        article_text: article?.content || "",
      }),
    });
    return data.session_key;
  }

  async function loadOptLabOutputsForArticle(article) {
    if (!article?.content) {
      state.optLabBlocks = [];
      state.optLabSessionKey = null;
      syncOptLabSessionToolsFromBlocks();
      return;
    }
    try {
      const sessionKey = await resolveOptLabSessionKey(article);
      state.optLabSessionKey = sessionKey;
      article.session_key = sessionKey;
      const data = await api(`/api/optimize-lab/outputs/${encodeURIComponent(sessionKey)}`);
      state.optLabBlocks = optLabBlocksFromServer(data.outputs);
      syncOptLabSessionToolsFromBlocks();
    } catch (_) {
      state.optLabBlocks = [];
      syncOptLabSessionToolsFromBlocks();
    }
  }

  function optLabNormalizeNotes(notes) {
    return (notes || "").trim().replace(/\s+/g, " ");
  }

  function optLabHasDuplicateReadyOutput(techniqueId, notes) {
    const norm = optLabNormalizeNotes(notes);
    return (state.optLabBlocks || []).some(
      (b) =>
        b.technique_id === techniqueId &&
        b.status === "ready" &&
        optLabNormalizeNotes(b.technique_notes) === norm
    );
  }

  async function loadOptLabSessions() {
    try {
      const data = await api("/api/optimize-lab/sessions");
      state.optLabSessions = data.sessions || [];
    } catch (_) {
      state.optLabSessions = [];
    }
  }

  async function openOptLabDeskSession(sessionKey) {
    const row = (state.optLabSessions || []).find((s) => s.session_key === sessionKey);
    if (!row) return;
    state.optLabInspectToolId = null;
    state.optLabError = null;
    try {
      const data = await api(`/api/optimize-lab/sessions/${encodeURIComponent(sessionKey)}`);
      const content = (data.article_content || "").trim();
      const kind = data.session_kind || row.session_kind || "draft";
      state.optLabSessionKey = sessionKey;
      state.optLabArticle = {
        title: data.article_title || optLabDraftTitleFromContent(content),
        content,
        word_count: optLabWordCount(content),
        source: data.article_url ? "url" : "draft",
        session_kind: kind,
        session_key: sessionKey,
        url: data.article_url || row.article_url || undefined,
      };
      state.optLabDraftTitle = state.optLabArticle.title === optLabDraftTitleFromContent(content) ? "" : state.optLabArticle.title;
      state.optLabDraftText = content;
      state.optLabInputMode = data.article_url || row.article_url ? "url" : "paste";
      if (data.article_url || row.article_url) state.optLabUrl = data.article_url || row.article_url;
      if (kind === "draft") {
        state.optLabBlocks = optLabBlocksFromServer(data.outputs);
      } else {
        state.optLabBlocks = [];
      }
      syncOptLabSessionToolsFromBlocks();
      state.optLabArticleJustLoaded = true;
      render();
    } catch (e) {
      state.optLabError = e.message || "Could not open that draft.";
      render();
    }
  }

  async function setOptLabSessionArchived(sessionKey, archived) {
    if (!sessionKey) return;
    const row = (state.optLabSessions || []).find((s) => s.session_key === sessionKey);
    if (!row || Boolean(row.archived) === archived) return;
    try {
      const data = await api(`/api/optimize-lab/sessions/${encodeURIComponent(sessionKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      state.optLabSessions = data.sessions || state.optLabSessions;
      if (archived && state.optLabSessionKey === sessionKey) {
        state.optLabArticle = state.optLabSourceArticle ? { ...state.optLabSourceArticle } : null;
        state.optLabSessionKey = state.optLabSourceArticle?.session_key || null;
        if (state.optLabArticle) {
          await loadOptLabOutputsForArticle(state.optLabArticle);
        } else {
          state.optLabBlocks = [];
        }
      }
      if (archived && state.optLabFreshDeskKey === sessionKey) {
        state.optLabFreshDeskKey = null;
      }
      if (!archived) {
        state.optLabFreshDeskKey = sessionKey;
        window.setTimeout(() => {
          if (state.optLabFreshDeskKey === sessionKey) {
            state.optLabFreshDeskKey = null;
            render();
          }
        }, 1800);
      }
      render();
    } catch (e) {
      state.optLabError = e.message || (archived ? "Could not archive that draft." : "Could not restore that draft.");
      render();
    }
  }

  async function archiveOptLabDeskSession(sessionKey) {
    await setOptLabSessionArchived(sessionKey, true);
  }

  async function restoreOptLabDeskSession(sessionKey) {
    await setOptLabSessionArchived(sessionKey, false);
  }

  function rememberOptLabSourceArticle() {
    if (!state.optLabArticle?.content) return;
    if (state.optLabArticle.session_kind === "draft" || state.optLabArticle.session_kind === "idea") return;
    state.optLabSourceArticle = {
      ...state.optLabArticle,
      session_key: state.optLabSessionKey || state.optLabArticle.session_key || null,
    };
  }

  function showOptLabHandoffDialog() {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "optlab-handoff-backdrop";
      backdrop.innerHTML = `
        <div class="optlab-handoff" role="dialog" aria-labelledby="optlab-handoff-title" aria-modal="true">
          <h3 id="optlab-handoff-title" class="optlab-handoff-title">Draft ready</h3>
          <p class="optlab-handoff-text">Enhance this draft now, or keep generating from your source article.</p>
          <div class="optlab-handoff-actions">
            <button type="button" class="btn-md btn-black" data-optlab-handoff="enhance">Enhance now</button>
            <button type="button" class="btn-md btn-secondary" data-optlab-handoff="keep">Keep generating</button>
            <button type="button" class="btn-md btn-ghost" data-optlab-handoff="cancel">Cancel</button>
          </div>
        </div>`;
      const finish = (choice) => {
        backdrop.remove();
        resolve(choice);
      };
      backdrop.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-optlab-handoff]");
        if (btn) {
          finish(btn.getAttribute("data-optlab-handoff"));
          return;
        }
        if (e.target === backdrop) finish("cancel");
      });
      document.body.appendChild(backdrop);
    });
  }

  async function saveOptLabDraftArticle() {
    await persistOptLabArticleToDesk({ refreshOutputs: true });
    render();
  }

  async function promoteOptLabIdeaToDraft() {
    const article = state.optLabArticle;
    if (!article || article.session_kind !== "idea") return;
    const content = (article.content || "").trim();
    if (!content) return;
    try {
      const data = await api("/api/optimize-lab/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_title: article.title || optLabDraftTitleFromContent(content),
          article_content: content,
          session_kind: "draft",
        }),
      });
      state.optLabSessions = data.sessions || state.optLabSessions;
      state.optLabFreshDeskKey = data.session_key;
      await openOptLabDeskSession(data.session_key);
      const choice = await showOptLabHandoffDialog();
      if (choice === "enhance") {
        state.optLabMode = "enhance";
        optLabSetModeBackground("enhance");
        render();
      } else if (choice === "keep" && state.optLabSourceArticle) {
        state.optLabArticle = { ...state.optLabSourceArticle };
        state.optLabSessionKey = state.optLabSourceArticle.session_key || null;
        await loadOptLabOutputsForArticle(state.optLabArticle);
        render();
      }
    } catch (e) {
      state.optLabError = e.message || "Could not promote that idea.";
      render();
    }
  }

  async function switchOptLabSession(sessionKey) {
    const row = (state.optLabSessions || []).find((s) => s.session_key === sessionKey);
    if (!row) return;
    state.optLabInspectToolId = null;
    state.optLabError = null;
    if (row.article_url) {
      state.optLabUrl = row.article_url;
      state.optLabInputMode = "url";
      state.optLabScrapeLoading = true;
      render();
      try {
        const data = await api("/api/optimize-lab/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: row.article_url }),
        });
        state.optLabArticle = data;
        state.optLabSessionKey = sessionKey;
        data.session_key = sessionKey;
        const outputs = await api(`/api/optimize-lab/outputs/${encodeURIComponent(sessionKey)}`);
        state.optLabBlocks = optLabBlocksFromServer(outputs.outputs);
        syncOptLabSessionToolsFromBlocks();
        state.optLabArticleJustLoaded = true;
      } catch (e) {
        state.optLabError = e.message || "Could not reload that article.";
      } finally {
        state.optLabScrapeLoading = false;
        render();
      }
      return;
    }
    state.optLabSessionKey = sessionKey;
    try {
      const data = await api(`/api/optimize-lab/outputs/${encodeURIComponent(sessionKey)}`);
      state.optLabBlocks = optLabBlocksFromServer(data.outputs);
      syncOptLabSessionToolsFromBlocks();
    } catch (_) {
      state.optLabBlocks = [];
    }
    state.optLabError = "This session was from a pasted draft. Paste your article again to generate more.";
    render();
  }

  function optLabWelcomePanel() {
    if (state.optLabArticle) return "";
    return `
      <section class="optlab-welcome" aria-label="Welcome">
        <p class="optlab-welcome-text">Paste your article in the center well. Drag a tool onto it, or click a tool to inspect and generate.</p>
      </section>`;
  }

  function optLabStarterPanel() {
    if (!state.optLabArticle?.content) return "";
    const picks = optLabStarterIds().map((id) => workshopTechniques().find((t) => t.id === id)).filter(Boolean);
    return `
      <section class="optlab-starters" aria-label="Start here">
        <p class="optlab-starters-label">Start here</p>
        <div class="optlab-starters-row">
          ${picks
            .map(
              (t) =>
                `<button type="button" class="optlab-starter-chip" data-brain-starter="${esc(t.id)}">${esc(t.name)}</button>`
            )
            .join("")}
        </div>
        <p class="optlab-starters-hint">${esc(optLabStarterHint())}</p>
      </section>`;
  }

  function optLabSessionBanner() {
    if (optLabIsFocusMode()) return "";
    const ready = (state.optLabBlocks || []).filter((b) => b.status === "ready").length;
    const pending = (state.optLabBlocks || []).filter((b) => b.status === "queued" || b.status === "running").length;
    if (!state.optLabArticle || (ready === 0 && pending === 0)) return "";
    const remaining = Math.max(0, workshopTechniques().length - ready);
    const pendingNote = pending ? ` · ${pending} generating` : "";
    return `<p class="optlab-session-banner" role="status">${ready} section${ready === 1 ? "" : "s"} ready to paste${pendingNote}${remaining ? ` · ${remaining} more tools to try` : ready ? " · nice work!" : ""}</p>`;
  }

  function optLabTipsFooter() {
    return `<p class="optlab-tip" aria-live="polite"><span class="optlab-tip-mark" aria-hidden="true">?</span>${esc(optLabTipText())}</p>`;
  }

  function filteredBrainTechniques() {
    const cat = state.brainCategory || "all";
    const techniques = workshopTechniques();
    if (cat === "all") return techniques;
    return techniques.filter((t) => t.category === cat);
  }

  function brainCategoryChips() {
    const cats = workshopCategories();
    const counts = brainCategoryCountsForChips();
    const catFilter = state.brainCategory || "all";
    const allActive = catFilter === "all";
    const chips = [
      `<button type="button" class="btn-sm btn-ghost toolbar-filter-btn${allActive ? " toolbar-filter-btn--open" : ""}" data-brain-cat="all" aria-pressed="${allActive ? "true" : "false"}" aria-label="All categories, ${counts.all} tools">All <span class="brain-cat-count">${counts.all}</span></button>`,
    ];
    for (const [id, label] of Object.entries(cats)) {
      const n = counts[id] || 0;
      const active = catFilter === id;
      const muted = !allActive && !active;
      const mutedClass = muted ? " toolbar-filter-btn--muted" : "";
      const countHtml = n ? `<span class="brain-cat-count">${n}</span>` : "";
      chips.push(
        `<button type="button" class="btn-sm btn-ghost toolbar-filter-btn${active ? " toolbar-filter-btn--open" : ""}${mutedClass}" data-brain-cat="${esc(id)}" aria-pressed="${active ? "true" : "false"}" aria-label="${esc(label)}, ${n} tools${muted ? " (not showing)" : ""}"${n ? "" : " disabled"}>${esc(label)} ${countHtml}</button>`
      );
    }
    return chips.join("");
  }

  function optLabGenerationsStatus() {
    return state.budget?.optlab_generations || null;
  }

  function optLabGenerationsRemaining() {
    const g = optLabGenerationsStatus();
    if (!g || g.remaining == null) return null;
    return Math.max(0, g.remaining);
  }

  function optLabGenerationsInFlight() {
    return (state.optLabBlocks || []).filter((b) => b.status === "queued" || b.status === "running").length;
  }

  function optLabGenerationsSlotsLeft() {
    const remaining = optLabGenerationsRemaining();
    if (remaining == null) return null;
    return Math.max(0, remaining - optLabGenerationsInFlight());
  }

  function syncOptLabGenerationsFromResponse(data) {
    if (data?.optlab_generations && state.budget) {
      state.budget.optlab_generations = data.optlab_generations;
    }
  }

  function optLabGenerateTitle(hasArticle) {
    if (!hasArticle) return "Load an article on the left first";
    if (!state.openaiConfigured) return "Add OPENAI_API_KEY to .env.local and restart the server to enable generation";
    const slots = optLabGenerationsSlotsLeft();
    if (slots !== null && slots <= 0) {
      const limit = optLabGenerationsStatus()?.limit ?? 50;
      return `Monthly generation limit reached (${formatCredits(limit)} max). Resets on the 1st.`;
    }
    return "Generate a section from your article";
  }

  function brainEntry(t) {
    const needsArticles = t.id === "suggest-more-of-mine";
    const needsVideos = t.id === "suggest-videos-to-watch";
    const articlesCount = state.optLabSettings?.articles?.length || 0;
    const videosCount = state.optLabSettings?.videos?.length || 0;
    let hint = "";
    if (needsArticles && !articlesCount) {
      hint = `<p class="brain-hint"><strong>Suggest more of mine</strong> picks from your published articles. Add them in <button type="button" class="btn-inline-link" data-panel="optimize_lab_settings">Optimize Lab Settings</button> first.</p>`;
    } else if (needsVideos && !videosCount) {
      hint = `<p class="brain-hint"><strong>Suggest videos to watch</strong> picks from your YouTube library. Add videos in <button type="button" class="btn-inline-link" data-panel="optimize_lab_settings">Optimize Lab Settings</button> first.</p>`;
    } else if (t.placeholderHint) {
      hint = `<p class="brain-hint">${esc(t.placeholderHint)}</p>`;
    }
    const savedNotes = optLabTechniqueNotes(t.id);
    const notesPlaceholder =
      t.notesPlaceholder ||
      "Voice, length, audience, or format. e.g. Questions only. Write like a curious kid. Minimum 12 items.";
    const hasArticle = Boolean(state.optLabArticle?.content);
    const genStatus = optLabTechniqueGenStatus(t.id);
    const isRunning = genStatus === "running";
    const isQueued = genStatus === "queued";
    const slotsLeft = optLabGenerationsSlotsLeft();
    const atGenLimit = slotsLeft !== null && slotsLeft <= 0;
    const canGenerate = hasArticle && state.openaiConfigured && !isRunning && !isQueued && !atGenLimit;
    const generateLabel = isRunning ? "Generating…" : isQueued ? "Queued…" : "Generate";
    const generateBtn = `<button type="button" class="btn-sm btn-black brain-generate" data-brain-generate="${esc(t.id)}" ${canGenerate ? "" : "disabled"} title="${esc(optLabGenerateTitle(hasArticle))}">${esc(generateLabel)}</button>`;
    const used = optLabBlockForTechnique(t.id);
    const usedClass = used ? " brain-entry--used" : "";
    const catLabel = brainCategoryLabel(t.category);
    return `
      <details class="brain-entry brain-tool-card${usedClass}" id="${esc(t.id)}">
        <summary class="brain-entry-summary">
          <div class="brain-entry-hook">
            <span class="brain-cat-pill brain-cat-pill--${esc(t.category)}">${esc(catLabel)}</span>
            <span class="brain-entry-name">${esc(t.name)}</span>
            <span class="brain-entry-lead">${esc(t.shortDescription)}</span>
          </div>
          <div class="brain-entry-actions">
            ${generateBtn}
            <span class="brain-entry-chevron" aria-hidden="true"></span>
          </div>
        </summary>
        <div class="brain-entry-body">
          <div class="brain-facts-grid">
            <div class="brain-fact">
              <span class="brain-fact-label">Why it helps</span>
              <p>${esc(t.whyItHelps)}</p>
            </div>
            <div class="brain-fact">
              <span class="brain-fact-label">When to use</span>
              <p class="brain-when">${esc(t.whenToUse)}</p>
            </div>
          </div>
          <div class="brain-example">
            <span class="brain-example-label">Example output</span>
            <pre class="brain-example-body">${esc(t.example || "")}</pre>
          </div>
          ${hint}
          <div class="brain-notes-block">
            <label class="brain-notes-label" for="brain-notes-${esc(t.id)}">Your instructions</label>
            <p class="brain-notes-hint">Optional: tone, length, audience, or format. Applied when you generate and saved as you type.</p>
            <textarea class="search brain-notes-input" id="brain-notes-${esc(t.id)}" data-brain-notes="${esc(t.id)}" rows="3" placeholder="${esc(notesPlaceholder)}">${esc(savedNotes)}</textarea>
          </div>
        </div>
      </details>`;
  }

  function brainTechniqueGroups(rows) {
    if (!rows.length) {
      return `<p class="brain-empty">No tools in this category.</p>`;
    }
    const cat = state.brainCategory || "all";
    if (cat !== "all") {
      return `<div class="brain-index">${rows.map((t) => brainEntry(t)).join("")}</div>`;
    }
    const cats = workshopCategories();
    const byCat = {};
    for (const t of rows) {
      (byCat[t.category] ||= []).push(t);
    }
    return Object.entries(cats)
      .filter(([id]) => byCat[id]?.length)
      .map(
        ([id, label]) => {
          const items = byCat[id];
          return `
        <section class="brain-section" aria-labelledby="brain-cat-${esc(id)}">
          <h3 class="brain-section-title" id="brain-cat-${esc(id)}">
            <span class="brain-section-name">${esc(label)}</span>
            <span class="brain-section-count">${items.length} tools</span>
          </h3>
          <div class="brain-index">${items.map((t, i) => brainEntry(t, i)).join("")}</div>
        </section>`;
        }
      )
      .join("");
  }

  const OPTLAB_MAX_CHARS = 48000;
  const OPTLAB_MIN_CHARS = 80;
  const OPTLAB_SESSION_DRAG_MIME = "application/x-optlab-session";
  const OPTLAB_SESSION_DRAG_PREFIX = "optlab-session:";

  function optLabSessionDragPayload(sessionKey) {
    return `${OPTLAB_SESSION_DRAG_PREFIX}${sessionKey}`;
  }

  function optLabParseSessionDragPayload(value) {
    if (!value) return null;
    if (value.startsWith(OPTLAB_SESSION_DRAG_PREFIX)) {
      return value.slice(OPTLAB_SESSION_DRAG_PREFIX.length);
    }
    return null;
  }

  function optLabSetSessionDragData(dataTransfer, sessionKey) {
    dataTransfer.setData(OPTLAB_SESSION_DRAG_MIME, sessionKey);
    dataTransfer.setData("text/plain", optLabSessionDragPayload(sessionKey));
    dataTransfer.effectAllowed = "move";
  }

  function optLabReadSessionDragData(dataTransfer, fallbackKey) {
    return (
      dataTransfer.getData(OPTLAB_SESSION_DRAG_MIME) ||
      optLabParseSessionDragPayload(dataTransfer.getData("text/plain")) ||
      fallbackKey ||
      null
    );
  }

  function optLabSessionDragActive(dataTransfer, fallbackKey) {
    if (fallbackKey) return true;
    const types = [...(dataTransfer?.types || [])];
    return types.includes(OPTLAB_SESSION_DRAG_MIME) || types.includes("text/plain");
  }

  function optLabWordCount(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function optLabEnhancementWordCount() {
    if (optLabMode() !== "enhance") return 0;
    return (state.optLabBlocks || [])
      .filter((b) => b.status === "ready" && (b.output || "").trim())
      .reduce((sum, b) => sum + optLabWordCount(b.output), 0);
  }

  function optLabWordMetaText(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return "";
    const base = optLabWordCount(trimmed);
    const extra = optLabEnhancementWordCount();
    if (!extra) return `${base} words`;
    return `${base} + ${extra} = ${base + extra} words`;
  }

  function optLabDraftMetaText(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return "";
    if (trimmed.length < OPTLAB_MIN_CHARS) {
      return `${OPTLAB_MIN_CHARS - trimmed.length} more characters`;
    }
    return `${optLabWordCount(trimmed)} words`;
  }

  function optLabTechniqueOutputKind(techniqueId) {
    const t = allWorkshopTechniques().find((x) => x.id === techniqueId);
    return t?.outputKind || "section";
  }

  function optLabDeskSessions() {
    return (state.optLabSessions || []).filter(
      (s) => !s.archived && (s.session_kind === "draft" || s.session_kind === "idea")
    );
  }

  function optLabIsEditableArticle(article) {
    if (!article) return false;
    if (article.source === "draft" || article.source === "paste" || article.source === "url") return true;
    return article.session_kind === "draft" || article.session_kind === "idea";
  }

  function optLabDraftTitleFromContent(content) {
    const firstLine = (content || "").trim().split(/\n/)[0] || "";
    if (!firstLine) return "Untitled article";
    return firstLine.length > 120 ? firstLine.slice(0, 117).trim() + "…" : firstLine;
  }

  function optLabArticlePanel() {
    const article = state.optLabArticle;
    if (!article) return "";
    if (optLabIsEditableArticle(article)) {
      const ideaActions = article.session_kind === "idea"
        ? `<button type="button" class="btn-sm btn-black" id="optlab-use-idea-article">Use as article</button>`
        : "";
      const ideaHead = ideaActions
        ? `<div class="optlab-article-head optlab-article-head--actions-only">
          <div class="optlab-article-head-actions">${ideaActions}</div>
        </div>`
        : "";
      const urlBlock =
        state.optLabInputMode === "url"
          ? `<label class="optlab-load-label" for="optlab-url-input">Published URL</label>
        <input class="search optlab-url-input" type="url" id="optlab-url-input" placeholder="https://yoursite.com/blog/your-article" value="${esc(article.url || state.optLabUrl || "")}" ${state.optLabScrapeLoading ? "disabled" : ""} />
        <p class="optlab-hint">${state.optLabScrapeLoading ? "Loading page text…" : "Paste a URL and we pull the page text automatically."}</p>`
          : "";
      return `
      <section class="optlab-article optlab-article--editable" aria-label="Draft article">
        ${ideaHead}
        ${urlBlock}
        <label class="optlab-load-label" for="optlab-article-edit-title">Title</label>
        <input class="search optlab-draft-title" type="text" id="optlab-article-edit-title" value="${esc(article.title || "")}" />
        <label class="optlab-load-label optlab-load-label-spaced" for="optlab-article-edit-body">Article text</label>
        <textarea class="search optlab-draft-text optlab-article-edit-body" id="optlab-article-edit-body" rows="14">${esc(article.content || "")}</textarea>
        <div class="optlab-load-row optlab-load-row-end">
          <span class="optlab-draft-meta">${esc(optLabWordMetaText(article.content || ""))}</span>
        </div>
      </section>`;
    }

    const preview =
      article.content.length > 420
        ? article.content.slice(0, 420).trim() + "…"
        : article.content;
    const sourceMetaBase = optLabWordMetaText(article.content || "");
    const sourceMeta = article.url
      ? `${esc(sourceMetaBase)} · <a href="${esc(article.url)}" target="_blank" rel="noopener noreferrer">View page</a>`
      : `${esc(sourceMetaBase)} · Pasted draft`;
    const previewLabel = article.url ? "Preview scraped text" : "Preview article text";
    return `
      <section class="optlab-article" aria-label="Loaded article">
        <div class="optlab-article-head">
          <div>
            <h3 class="optlab-article-title">${esc(article.title || "Article")}</h3>
            <p class="optlab-article-meta">${sourceMeta}</p>
          </div>
        </div>
        <details class="optlab-article-preview">
          <summary>${previewLabel}</summary>
          <pre class="optlab-article-body">${esc(preview)}</pre>
        </details>
      </section>`;
  }

  function optLabOutputNotesLine(block) {
    const notes = (block.technique_notes || "").trim();
    if (!notes) return "";
    return `<p class="optlab-output-notes"><span class="optlab-output-notes-label">Your instructions</span> ${esc(notes)}</p>`;
  }

  function optLabArticleSectionBlock(block) {
    const t = allWorkshopTechniques().find((x) => x.id === block.technique_id);
    const name = block.technique_name || t?.name || "Optimization";
    const status = block.status || "ready";
    const freshClass = state.optLabFreshOutputId && block.id === state.optLabFreshOutputId ? " optlab-article-section--fresh" : "";
    const statusClass =
      status === "queued"
        ? " optlab-article-section--queued"
        : status === "running"
          ? " optlab-article-section--running"
          : status === "error"
            ? " optlab-article-section--error"
            : "";
    const cardId = block.queueId || block.id || "";

    if (status === "queued" || status === "running") {
      return `
      <article class="optlab-article-section${statusClass}${freshClass}" data-optlab-block-id="${esc(cardId)}" aria-label="${esc(name)} ${status}" aria-busy="${status === "running" ? "true" : "false"}">
        <div class="optlab-article-section-head">
          <h4 class="optlab-article-section-title">${esc(name)}</h4>
          ${status === "queued" ? `<button type="button" class="btn-sm btn-ghost" data-optlab-cancel-queue="${esc(block.queueId || "")}">Cancel</button>` : ""}
        </div>
        <div class="optlab-article-section-placeholder" role="status">
          <span class="optlab-output-spinner" aria-hidden="true"></span>
          <span>${status === "queued" ? "Waiting in line…" : "Writing this section…"}</span>
        </div>
        ${optLabOutputNotesLine(block)}
      </article>`;
    }

    if (status === "error") {
      return `
      <article class="optlab-article-section${statusClass}${freshClass}" data-optlab-block-id="${esc(cardId)}" aria-label="${esc(name)} error">
        <div class="optlab-article-section-head">
          <h4 class="optlab-article-section-title">${esc(name)}</h4>
          <div class="optlab-article-section-actions">
            <button type="button" class="btn-sm btn-black" data-brain-generate="${esc(block.technique_id)}">Retry</button>
            <button type="button" class="btn-sm btn-ghost" data-optlab-dismiss-block="${esc(block.queueId || block.id || "")}">Remove</button>
          </div>
        </div>
        <p class="optlab-article-section-error">${esc(block.error || "Generation failed. Try again in a moment.")}</p>
        ${optLabOutputNotesLine(block)}
      </article>`;
    }

    const revealClass = freshClass ? " optlab-article-section-body--reveal" : "";
    return `
      <article class="optlab-article-section${freshClass}" data-optlab-block-id="${esc(cardId)}" aria-label="${esc(name)} result">
        <div class="optlab-article-section-head">
          <h4 class="optlab-article-section-title">${esc(name)}</h4>
          <div class="optlab-article-section-actions">
            <button type="button" class="btn-sm btn-black" data-optlab-copy-output="${esc(block.id)}">Copy</button>
            <button type="button" class="btn-sm btn-ghost" data-optlab-del-output="${esc(block.id)}" aria-label="Remove ${esc(name)} result">Remove</button>
          </div>
        </div>
        ${optLabOutputNotesLine(block)}
        <pre class="optlab-article-section-body${revealClass}">${esc(block.output)}</pre>
      </article>`;
  }

  function optLabOutputCard(block) {
    const t = allWorkshopTechniques().find((x) => x.id === block.technique_id);
    const name = block.technique_name || t?.name || "Optimization";
    const status = block.status || "ready";
    const freshClass = state.optLabFreshOutputId && block.id === state.optLabFreshOutputId ? " optlab-output--fresh" : "";
    const statusClass =
      status === "queued"
        ? " optlab-output--queued"
        : status === "running"
          ? " optlab-output--running"
          : status === "error"
            ? " optlab-output--error"
            : "";
    const cardId = block.queueId || block.id || "";
    const label =
      status === "queued"
        ? "Queued"
        : status === "running"
          ? "Generating"
          : status === "error"
            ? "Failed"
            : "Ready to paste";

    if (status === "queued" || status === "running") {
      const skeleton = `
        <div class="optlab-output-skeleton" aria-hidden="true">
          <span class="optlab-output-skeleton-line"></span>
          <span class="optlab-output-skeleton-line"></span>
          <span class="optlab-output-skeleton-line"></span>
          <span class="optlab-output-skeleton-line"></span>
        </div>`;
      return `
      <article class="optlab-output${statusClass}${freshClass}" data-optlab-block-id="${esc(cardId)}" aria-label="${esc(name)} ${status}" aria-busy="${status === "running" ? "true" : "false"}">
        <div class="optlab-output-head">
          <div>
            <span class="optlab-output-label">${esc(label)}</span>
            <h3 class="optlab-output-title">${esc(name)}</h3>
          </div>
          ${status === "queued" ? `<button type="button" class="btn-sm btn-ghost" data-optlab-cancel-queue="${esc(block.queueId || "")}">Cancel</button>` : ""}
        </div>
        ${skeleton}
        <div class="optlab-output-placeholder" role="status">
          <span class="optlab-output-spinner" aria-hidden="true"></span>
          <span>${status === "queued" ? "Waiting in line…" : "Writing this section…"}</span>
        </div>
        ${optLabOutputNotesLine(block)}
      </article>`;
    }

    if (status === "error") {
      return `
      <article class="optlab-output${statusClass}${freshClass}" data-optlab-block-id="${esc(cardId)}" aria-label="${esc(name)} error">
        <div class="optlab-output-head">
          <div>
            <span class="optlab-output-label">${esc(label)}</span>
            <h3 class="optlab-output-title">${esc(name)}</h3>
          </div>
          <div class="optlab-output-actions">
            <button type="button" class="btn-sm btn-black" data-brain-generate="${esc(block.technique_id)}">Retry</button>
            <button type="button" class="btn-sm btn-ghost" data-optlab-dismiss-block="${esc(block.queueId || block.id || "")}">Dismiss</button>
          </div>
        </div>
        <p class="optlab-output-error">${esc(block.error || "Generation failed. Try again in a moment.")}</p>
        ${optLabOutputNotesLine(block)}
      </article>`;
    }

    const revealClass = freshClass ? " optlab-output-body--reveal" : "";
    return `
      <article class="optlab-output${freshClass}" data-optlab-block-id="${esc(cardId)}" aria-label="${esc(name)} result">
        <div class="optlab-output-head">
          <div>
            <span class="optlab-output-label">${esc(label)}</span>
            <h3 class="optlab-output-title">${esc(name)}</h3>
          </div>
          <div class="optlab-output-actions">
            <button type="button" class="btn-sm btn-black" data-optlab-copy-output="${esc(block.id)}">Copy text</button>
            <button type="button" class="btn-sm btn-ghost" data-optlab-del-output="${esc(block.id)}" aria-label="Remove ${esc(name)} result">Remove</button>
          </div>
        </div>
        ${optLabOutputNotesLine(block)}
        <pre class="optlab-output-body${revealClass}">${esc(block.output)}</pre>
      </article>`;
  }

  function optLabOutputsPanel() {
    const blocks = state.optLabBlocks || [];
    if (!blocks.length) return "";
    const ready = blocks.filter((b) => b.status === "ready").length;
    const pending = blocks.filter((b) => b.status === "queued" || b.status === "running").length;
    const countParts = [];
    if (ready) countParts.push(`${ready} ready`);
    if (pending) countParts.push(`${pending} in progress`);
    const countLabel = countParts.length ? countParts.join(" · ") : `${blocks.length} sections`;
    return `
      <section class="optlab-outputs" aria-label="Ready to paste">
        <div class="optlab-outputs-head">
          <h3 class="optlab-outputs-title">Ready to paste</h3>
          <span class="optlab-outputs-count">${esc(countLabel)}</span>
        </div>
        <div class="optlab-outputs-list">
          ${blocks.map((row) => optLabOutputCard(row)).join("")}
        </div>
      </section>`;
  }

  function optLabInputSection() {
    const loading = state.optLabScrapeLoading;
    const mode = state.optLabInputMode === "url" ? "url" : "paste";
    const err = state.optLabError && !state.optLabArticle
      ? `<p class="optlab-error" role="alert">${esc(state.optLabError)}</p>`
      : "";
    const aiNote = state.openaiConfigured
      ? ""
      : `<p class="optlab-hint optlab-hint-warn">Generation is not enabled on this server. Add <code>OPENAI_API_KEY</code> to <code>.env.local</code> and restart.</p>`;
    const urlPanel = `
        <label class="optlab-load-label" for="optlab-url-input">Published URL</label>
        <input class="search optlab-url-input" type="url" id="optlab-url-input" placeholder="https://yoursite.com/blog/your-article" value="${esc(state.optLabUrl)}" ${loading ? "disabled" : ""} />
        <p class="optlab-hint">${loading ? "Loading page text…" : "Paste a URL and we pull the page text automatically."}</p>`;
    const draftMeta = optLabWordMetaText(state.optLabDraftText);
    const pastePanel = `
        <label class="optlab-load-label" for="optlab-draft-title">Title</label>
        <input class="search optlab-draft-title" type="text" id="optlab-draft-title" placeholder="How to fix a leaky faucet" value="${esc(state.optLabDraftTitle)}" />
        <label class="optlab-load-label optlab-load-label-spaced" for="optlab-draft-text">Article text</label>
        <textarea class="search optlab-draft-text" id="optlab-draft-text" rows="10" placeholder="Paste your article here, or write a draft from scratch…">${esc(state.optLabDraftText)}</textarea>
        <div class="optlab-load-row optlab-load-row-end">
          <span class="optlab-draft-meta">${esc(draftMeta)}</span>
        </div>`;
    return `
      <section class="optlab-load" aria-label="Load article">
        ${mode === "url" ? urlPanel : pastePanel}
        ${aiNote}
        ${err}
      </section>`;
  }

  function optLabContentListText(items) {
    if (!items?.length) return "";
    return items
      .map((item) => {
        const title = (item.title || "").trim();
        const url = (item.url || "").trim();
        return url ? `${title} — ${url}` : title;
      })
      .join("\n");
  }

  function optLabTechniqueNotesMap() {
    return state.optLabSettings?.technique_notes || {};
  }

  function optLabTechniqueNotes(techniqueId) {
    return optLabTechniqueNotesMap()[techniqueId] || "";
  }

  function readOptLabTechniqueNotesFromDom(techniqueId) {
    const el = document.querySelector(`[data-brain-notes="${techniqueId}"]`);
    return (el?.value ?? optLabTechniqueNotes(techniqueId) ?? "").trim();
  }

  function appendBrainNotesToPrompt(prompt, notes) {
    const trimmed = (notes || "").trim();
    if (!trimmed) return prompt;
    return `${prompt}\n\nAuthor instructions (follow these over the default format when they conflict):\n${trimmed}`;
  }

  function resolveBrainPrompt(t, notes) {
    if (!t?.prompt) return "";
    let prompt = t.prompt;
    const settings = state.optLabSettings || { articles: [], videos: [] };
    if (t.id === "suggest-more-of-mine") {
      const list = optLabContentListText(settings.articles);
      const replacement = list || "[add published articles in Optimize Lab Settings — none added yet]";
      prompt = prompt.replace("[paste your article titles here]", replacement);
    }
    if (t.id === "suggest-videos-to-watch") {
      const list = optLabContentListText(settings.videos);
      const replacement = list || "[add published videos in Optimize Lab Settings — none added yet]";
      prompt = prompt.replace("[paste your video titles here]", replacement);
    }
    const flavor = notes !== undefined ? notes : optLabTechniqueNotes(t.id);
    return appendBrainNotesToPrompt(prompt, flavor);
  }

  let optLabNotesSaveTimer = null;
  let optLabAutoSaveTimer = null;
  let optLabUrlScrapeTimer = null;
  let optLabAutoSaveBusy = false;

  function optLabEditorFieldIds() {
    return ["optlab-draft-title", "optlab-draft-text", "optlab-article-edit-title", "optlab-article-edit-body"];
  }

  function readOptLabEditorFields() {
    const titleEl =
      document.getElementById("optlab-article-edit-title") || document.getElementById("optlab-draft-title");
    const bodyEl =
      document.getElementById("optlab-article-edit-body") || document.getElementById("optlab-draft-text");
    const title = (titleEl?.value ?? state.optLabDraftTitle ?? state.optLabArticle?.title ?? "").trim();
    const content = (bodyEl?.value ?? state.optLabDraftText ?? state.optLabArticle?.content ?? "").trim();
    const urlInput = document.getElementById("optlab-url-input");
    const url =
      state.optLabInputMode === "url"
        ? (urlInput?.value ?? state.optLabUrl ?? state.optLabArticle?.url ?? "").trim()
        : (state.optLabArticle?.url || "").trim();
    return { title, content, url };
  }

  function optLabTruncateArticleContent(content) {
    let text = (content || "").trim();
    if (!text) return "";
    if (text.length > OPTLAB_MAX_CHARS) {
      text = text.slice(0, OPTLAB_MAX_CHARS).trim() + "\n\n[… truncated for length …]";
    }
    return text;
  }

  function syncOptLabArticleLocalFromDom() {
    const { title, content, url } = readOptLabEditorFields();
    state.optLabDraftTitle = title;
    state.optLabDraftText = content;
    if (url) state.optLabUrl = url;
    const trimmed = optLabTruncateArticleContent(content);
    if (!trimmed) {
      state.optLabArticle = null;
      return;
    }
    state.optLabArticle = {
      title: title || optLabDraftTitleFromContent(trimmed),
      content: trimmed,
      word_count: optLabWordCount(trimmed),
      source: url ? "url" : "draft",
      session_kind: state.optLabArticle?.session_kind || "draft",
      session_key: state.optLabSessionKey || state.optLabArticle?.session_key || null,
      url: url || undefined,
    };
  }

  function updateOptLabWordMetaInDom() {
    const { content } = readOptLabEditorFields();
    document.querySelectorAll(".optlab-draft-meta").forEach((meta) => {
      meta.textContent = optLabWordMetaText(content);
    });
  }

  function optLabDeskSessionKeyForUrl(url) {
    const normalized = (url || "").trim().toLowerCase();
    if (!normalized) return null;
    const row = (state.optLabSessions || []).find(
      (s) =>
        !s.archived &&
        (s.session_kind === "draft" || s.session_kind === "idea") &&
        (s.article_url || "").trim().toLowerCase() === normalized
    );
    return row?.session_key || null;
  }

  async function persistOptLabArticleToDesk({ refreshOutputs = false } = {}) {
    if (optLabAutoSaveBusy) return;
    const { title, content, url } = readOptLabEditorFields();
    const trimmed = optLabTruncateArticleContent(content);
    if (!trimmed) return;

    syncOptLabArticleLocalFromDom();
    optLabAutoSaveBusy = true;
    const hadSession = Boolean(state.optLabSessionKey);
    try {
      let sessionKey =
        state.optLabSessionKey ||
        (url ? optLabDeskSessionKeyForUrl(url) : null);
      const isDeskDraft =
        state.optLabArticle?.session_kind === "draft" || state.optLabArticle?.session_kind === "idea";

      if (!sessionKey || !isDeskDraft) {
        const created = await api("/api/optimize-lab/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            article_title: title || optLabDraftTitleFromContent(trimmed),
            article_content: trimmed,
            article_url: url || "",
            session_kind: "draft",
          }),
        });
        sessionKey = created.session_key;
        state.optLabSessions = created.sessions || state.optLabSessions;
        if (!hadSession) state.optLabFreshDeskKey = sessionKey;
        refreshOutputs = true;
      } else {
        const data = await api(`/api/optimize-lab/sessions/${encodeURIComponent(sessionKey)}/draft`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            article_title: title,
            article_content: trimmed,
            article_url: url || "",
          }),
        });
        state.optLabSessions = data.sessions || state.optLabSessions;
      }

      state.optLabSessionKey = sessionKey;
      state.optLabArticle = {
        ...state.optLabArticle,
        title: title || optLabDraftTitleFromContent(trimmed),
        content: trimmed,
        word_count: optLabWordCount(trimmed),
        session_kind: "draft",
        source: url ? "url" : "draft",
        session_key: sessionKey,
        url: url || undefined,
      };
      rememberOptLabSourceArticle();
      if (refreshOutputs || !hadSession) {
        await loadOptLabOutputsForArticle(state.optLabArticle);
      }
      state.optLabError = null;
    } catch (e) {
      state.optLabError = e.message || "Could not save that draft.";
      render();
    } finally {
      optLabAutoSaveBusy = false;
    }
  }

  function scheduleOptLabAutoSave() {
    clearTimeout(optLabAutoSaveTimer);
    optLabAutoSaveTimer = setTimeout(() => {
      persistOptLabArticleToDesk();
    }, 700);
  }

  function optLabLooksLikeUrl(value) {
    const text = (value || "").trim();
    if (!text) return false;
    try {
      const parsed = new URL(text);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function scheduleOptLabUrlScrape() {
    clearTimeout(optLabUrlScrapeTimer);
    optLabUrlScrapeTimer = setTimeout(() => {
      scrapeOptLabArticle();
    }, 900);
  }

  function bindOptLabEditorAutoSave() {
    const onEdit = () => {
      syncOptLabArticleLocalFromDom();
      updateOptLabWordMetaInDom();
      scheduleOptLabAutoSave();
    };
    optLabEditorFieldIds().forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.optlabAutosaveBound === "1") return;
      el.dataset.optlabAutosaveBound = "1";
      el.addEventListener("input", onEdit);
    });
  }

  async function saveOptLabTechniqueNotes(techniqueId, notes) {
    if (!techniqueId) return;
    try {
      const data = await api("/api/optimize-lab/technique-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technique_id: techniqueId, notes: notes ?? "" }),
      });
      state.optLabSettings = data.settings || state.optLabSettings;
    } catch (_) {
      /* keep local draft; will retry on Generate */
    }
  }

  function optLabContentRow(item, kind) {
    const urlCell = item.url
      ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.url)}</a>`
      : "<span class=\"disc-hint\">No link saved</span>";
    return `<tr>
      <td>${esc(item.title)}</td>
      <td class="optlab-content-url">${urlCell}</td>
      <td><button type="button" class="btn-sm btn-ghost" data-del-optlab-${kind}="${esc(item.id)}">Remove</button></td>
    </tr>`;
  }

  function optimizeLabSettingsPanel() {
    const settings = state.optLabSettings || { articles: [], videos: [] };
    const articles = settings.articles || [];
    const videos = settings.videos || [];
    const articleRows = articles.map((a) => optLabContentRow(a, "article")).join("");
    const videoRows = videos.map((v) => optLabContentRow(v, "video")).join("");
    return `
      <div class="page-header">
        <h2 class="page-title">Optimize Lab Settings</h2>
        <p class="page-meta">Published posts and videos that power <strong>Suggest more of mine</strong> and <strong>Suggest videos to watch</strong>.</p>
      </div>
      <div class="settings-panel optlab-settings-panel">
        ${settingsSection(
          "optlab-articles",
          "Published articles",
          `
          <p class="disc-hint">Posts you have already published. <strong>Suggest more of mine</strong> picks from this list.</p>
          <table class="data-table prefix-table">
            <thead><tr><th>Title</th><th>Link</th><th><span class="sr-only">Remove</span></th></tr></thead>
            <tbody>${articleRows || "<tr><td colspan=\"3\">No articles yet. Add one below, import your blog feed, or upload a CSV.</td></tr>"}</tbody>
          </table>
          <div class="optlab-manual-add">
            <span class="optlab-csv-label">Add one article</span>
            <div class="prefix-add optlab-content-add">
              <input type="text" id="optlab-new-article-title" class="search" placeholder="Title, e.g. How to fix VLOOKUP" aria-label="Article title" />
              <input type="url" id="optlab-new-article-url" class="search" placeholder="Link (optional), e.g. https://yoursite.com/post" aria-label="Article link (optional)" />
              <button type="button" class="btn-md btn-primary" id="optlab-add-article-btn">Add article</button>
            </div>
          </div>
          <div class="optlab-feed-import">
            <label class="optlab-csv-label" for="optlab-rss-feed-url">Import from blog feed</label>
            <p class="disc-hint">Paste your RSS or Atom URL (often <span class="mono">/feed</span> or <span class="mono">/rss</span> on your site). We import up to 100 post titles and links.</p>
            <div class="prefix-add optlab-feed-import-row">
              <input type="url" id="optlab-rss-feed-url" class="search" placeholder="https://yoursite.com/feed.xml" aria-label="Blog feed URL" />
              <button type="button" class="btn-md btn-secondary" id="optlab-import-rss-btn">Import articles</button>
            </div>
          </div>
          <div class="optlab-csv-import">
            <label class="optlab-csv-label" for="optlab-articles-csv">Import from CSV</label>
            <p class="disc-hint">Two columns: <span class="mono">title</span> and <span class="mono">url</span>. Header row is optional.</p>
            <input type="file" id="optlab-articles-csv" accept=".csv,text/csv" aria-label="Choose a CSV file of articles" />
          </div>`
        )}
        ${settingsSection(
          "optlab-videos",
          "Published videos",
          `
          <p class="disc-hint">YouTube videos you have already published. <strong>Suggest videos to watch</strong> picks from this list.</p>
          <table class="data-table prefix-table">
            <thead><tr><th>Title</th><th>Link</th><th><span class="sr-only">Remove</span></th></tr></thead>
            <tbody>${videoRows || "<tr><td colspan=\"3\">No videos yet. Add one below, import your YouTube channel, or upload a CSV.</td></tr>"}</tbody>
          </table>
          <div class="optlab-manual-add">
            <span class="optlab-csv-label">Add one video</span>
            <div class="prefix-add optlab-content-add">
              <input type="text" id="optlab-new-video-title" class="search" placeholder="Title, e.g. VLOOKUP in 3 minutes" aria-label="Video title" />
              <input type="url" id="optlab-new-video-url" class="search" placeholder="YouTube link (optional), e.g. https://youtube.com/watch?v=…" aria-label="YouTube link (optional)" />
              <button type="button" class="btn-md btn-primary" id="optlab-add-video-btn">Add video</button>
            </div>
          </div>
          <div class="optlab-feed-import">
            <label class="optlab-csv-label" for="optlab-youtube-channel-url">Import from YouTube channel</label>
            <p class="disc-hint">Paste your channel URL (<span class="mono">youtube.com/@you</span> or <span class="mono">/channel/UC…</span>). We import public video titles and watch links (up to 100).</p>
            <div class="prefix-add optlab-feed-import-row">
              <input type="url" id="optlab-youtube-channel-url" class="search" placeholder="https://youtube.com/@yourchannel" aria-label="YouTube channel URL" />
              <button type="button" class="btn-md btn-secondary" id="optlab-import-youtube-btn">Import videos</button>
            </div>
          </div>
          <div class="optlab-csv-import">
            <label class="optlab-csv-label" for="optlab-videos-csv">Import from CSV</label>
            <p class="disc-hint">Two columns: <span class="mono">title</span> and <span class="mono">url</span>. Header row is optional.</p>
            <input type="file" id="optlab-videos-csv" accept=".csv,text/csv" aria-label="Choose a CSV file of videos" />
          </div>`
        )}
      </div>`;
  }

  function connectionPlatformRow(p) {
    return `
        <article class="connections-platform" aria-labelledby="conn-${esc(p.id)}">
          <div class="connections-platform-mark" aria-hidden="true">${esc(p.monogram)}</div>
          <div class="connections-platform-body">
            <div class="connections-platform-head">
              <h4 class="connections-platform-name" id="conn-${esc(p.id)}">${esc(p.name)}</h4>
              <span class="connections-platform-status">Planned</span>
            </div>
            <p class="connections-platform-desc">${esc(p.desc)}</p>
          </div>
          <button type="button" class="btn-md btn-secondary connections-platform-btn" disabled>Connect</button>
        </article>`;
  }

  function optimizeLabConnectionsPanel() {
    const groups = [
      {
        label: "Your blog & website",
        hint: "Owned content on your domain. The best fit for SEO: you control the URL, structure, and updates.",
        platforms: [
          {
            id: "wordpress",
            name: "WordPress",
            monogram: "W",
            desc: "The workhorse for expert blogs and tutorial sites. Load a post, thicken it for search, push the update live.",
          },
          {
            id: "ghost",
            name: "Ghost",
            monogram: "G",
            desc: "Clean publishing for writers, coaches, and membership sites who want a fast, SEO-friendly blog.",
          },
          {
            id: "webflow",
            name: "Webflow",
            monogram: "Wf",
            desc: "Design-led sites and CMS collections. Keep your Webflow look while Ansaur updates articles in place.",
          },
          {
            id: "wordpress-com",
            name: "WordPress.com",
            monogram: "Wc",
            desc: "Hosted WordPress.com blogs, from personal sites to larger publications, with formatting preserved on publish.",
          },
          {
            id: "framer",
            name: "Framer",
            monogram: "Fr",
            desc: "Framer-powered sites with synced articles that match your layout and field setup.",
          },
          {
            id: "nextjs-blog",
            name: "Next.js Blog",
            monogram: "Nx",
            desc: "Custom SSR blogs with article pages, tag pages, and a dynamic sitemap when you own the frontend.",
          },
          {
            id: "squarespace",
            name: "Squarespace",
            monogram: "Sq",
            desc: "Portfolio and small-business blogs where your how-to articles live beside your offer.",
          },
          {
            id: "wix",
            name: "Wix",
            monogram: "Wx",
            desc: "Simple site builders used by local experts, teachers, and consultants who blog on their business site.",
          },
          {
            id: "blogger",
            name: "Blogger",
            monogram: "Bg",
            desc: "Straightforward Google-hosted blogs still used by niche experts who want zero setup.",
          },
        ],
      },
      {
        label: "E-commerce",
        hint: "Store blogs and content hubs that drive organic traffic alongside your catalog.",
        platforms: [
          {
            id: "shopify",
            name: "Shopify",
            monogram: "Sh",
            desc: "Shopify blog posts and product-focused content optimized for search and regular publishing.",
          },
        ],
      },
      {
        label: "Newsletters & essays",
        hint: "Where writers build authority through email and public archive posts that also rank in search.",
        platforms: [
          {
            id: "substack",
            name: "Substack",
            monogram: "Su",
            desc: "Essay-style newsletters that double as web posts. A natural home for subject-matter experts.",
          },
          {
            id: "beehiiv",
            name: "Beehiiv",
            monogram: "B",
            desc: "Newsletter growth platform with a web archive. Optimize a published issue and send it back.",
          },
          {
            id: "medium",
            name: "Medium",
            monogram: "M",
            desc: "Hosted essays and publications for thought leadership that reaches readers outside your list.",
          },
          {
            id: "kit",
            name: "Kit",
            monogram: "K",
            desc: "Creator email platform (formerly ConvertKit) with landing pages and serialized teaching content.",
          },
        ],
      },
      {
        label: "Courses & memberships",
        hint: "Teachers and course sellers who publish lesson notes, guides, and supporter-only posts alongside their offer.",
        platforms: [
          {
            id: "teachable",
            name: "Teachable",
            monogram: "T",
            desc: "Course creators who publish supporting articles, sales pages, and lesson-adjacent content.",
          },
          {
            id: "kajabi",
            name: "Kajabi",
            monogram: "Kj",
            desc: "Experts who run courses, blogs, and email from one hub and need articles updated in place.",
          },
          {
            id: "thinkific",
            name: "Thinkific",
            monogram: "Th",
            desc: "Teachers and trainers with course sites that include blog or resource posts for students.",
          },
          {
            id: "podia",
            name: "Podia",
            monogram: "P",
            desc: "Creators selling courses and downloads who also publish blog posts to attract search traffic.",
          },
          {
            id: "patreon",
            name: "Patreon",
            monogram: "Pa",
            desc: "Membership posts and public updates from creators who teach through ongoing written content.",
          },
        ],
      },
      {
        label: "Expert publishing",
        hint: "Where professionals share depth without running a full blog stack.",
        platforms: [
          {
            id: "linkedin",
            name: "LinkedIn",
            monogram: "Li",
            desc: "Long-form articles from consultants, coaches, and practitioners building authority in their field.",
          },
          {
            id: "notion",
            name: "Notion",
            monogram: "N",
            desc: "Public pages and resource hubs many experts use as a lightweight publishing surface.",
          },
        ],
      },
      {
        label: "Developers & custom",
        hint: "When you run your own stack or need a bridge to any platform that accepts HTTP callbacks.",
        platforms: [
          {
            id: "webhook",
            name: "Webhook",
            monogram: "Wh",
            desc: "Custom integrations via secure webhook delivery when you need a platform we do not ship yet.",
          },
        ],
      },
    ];
    const steps = [
      { num: "1", title: "Connect", desc: "Authorize Ansaur to read and update posts on your site." },
      { num: "2", title: "Load article", desc: "Pick a live post. We pull the text into Optimize Lab." },
      { num: "3", title: "Publish", desc: "Run a tool and send the updated draft back to your site." },
    ];
    const stepItems = steps
      .map(
        (s) => `
        <li class="connections-step">
          <span class="connections-step-num" aria-hidden="true">${s.num}</span>
          <div class="connections-step-copy">
            <span class="connections-step-title">${esc(s.title)}</span>
            <span class="connections-step-desc">${esc(s.desc)}</span>
          </div>
        </li>`
      )
      .join("");
    const groupSections = groups
      .map(
        (g) => `
        <section class="connections-platforms" aria-label="${esc(g.label)}">
          <h3 class="connections-section-label">${esc(g.label)}</h3>
          <p class="connections-group-hint">${esc(g.hint)}</p>
          <div class="connections-platform-list">${g.platforms.map(connectionPlatformRow).join("")}</div>
        </section>`
      )
      .join("");
    return `
      <div class="connections-page">
        <div class="connections-page-inner">
          <header class="connections-header">
            <p class="connections-kicker">Optimize Lab</p>
            <div class="connections-title-row">
              <h2 class="page-title connections-title">Connections</h2>
              <span class="probe-soon-badge">Coming soon</span>
            </div>
            <p class="connections-lead">Ansaur will update your writing where you write it. No more copy and pasting back and forth.</p>
          </header>

          <section class="connections-hero" aria-label="Preview">
            <div class="connections-hero-mascot" aria-hidden="true">
              <img src="/assets/writer-dino.png" alt="" width="132" height="132" />
            </div>
            <div class="connections-hero-copy">
              <h3 class="connections-hero-title">Built for writers, not wireframes</h3>
              <p class="connections-hero-text">Connect the blog, store, or newsletter you already use: WordPress, Ghost, Webflow, Shopify, Notion, and more. Pull in a live post, improve it for search in Optimize Lab, then publish the update back to your site.</p>
            </div>
          </section>

          <section class="connections-flow" aria-label="How Connections will work">
            <h3 class="connections-section-label">How it will work</h3>
            <ol class="connections-steps">${stepItems}</ol>
          </section>

          ${groupSections}

          <footer class="connections-footer">
            <p class="connections-footer-text">Until Connections ships, paste your article or load a URL on <button type="button" class="btn-inline-link" data-panel="optimize_lab">Optimize Lab</button>.</p>
          </footer>
        </div>
      </div>`;
  }

  const OPTLAB_GRID_SLOTS = 18;

  const OPTLAB_ENHANCE_GRID_ORDER = [
    "tldr",
    "faq-generator",
    "keyword-cloud",
    "use-cases",
    "expert-quote",
    "suggest-more-of-mine",
    "key-terms-defined",
    "who-for",
    "what-not-to-do",
    "historical-context",
    "pre-requisites",
    "try-it-yourself",
    "common-pitfalls",
    "expert-panel",
    "socratic-debate",
    "quick-quiz",
    "suggest-videos-to-watch",
    "suggest-multipliers",
  ];

  function optLabGridMonogram(t) {
    if (!t?.name) return "";
    const words = t.name.replace(/[?]/g, "").split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return t.name.slice(0, 2).toUpperCase();
  }

  function optLabToolsBySlot(mode) {
    const active = mode || optLabMode();
    const techniques = workshopTechniques(active);
    const slots = Array(OPTLAB_GRID_SLOTS).fill(null);
    if (active === "ideas") {
      techniques.forEach((t, i) => {
        if (i < OPTLAB_GRID_SLOTS) slots[i] = t;
      });
      return slots;
    }
    const byId = Object.fromEntries(techniques.map((t) => [t.id, t]));
    OPTLAB_ENHANCE_GRID_ORDER.forEach((id, i) => {
      if (byId[id]) slots[i] = byId[id];
    });
    let fill = 0;
    for (const t of techniques) {
      if (!OPTLAB_ENHANCE_GRID_ORDER.includes(t.id)) {
        while (fill < OPTLAB_GRID_SLOTS && slots[fill]) fill++;
        if (fill < OPTLAB_GRID_SLOTS) slots[fill++] = t;
      }
    }
    return slots;
  }

  function optLabToolInspectHint(t) {
    const needsArticles = t.id === "suggest-more-of-mine";
    const needsVideos = t.id === "suggest-videos-to-watch";
    const articlesCount = state.optLabSettings?.articles?.length || 0;
    const videosCount = state.optLabSettings?.videos?.length || 0;
    if (needsArticles && !articlesCount) {
      return `<p class="brain-hint"><strong>Suggest more of mine</strong> picks from your published articles. Add them in <button type="button" class="btn-inline-link" data-panel="optimize_lab_settings">Optimize Lab Settings</button> first.</p>`;
    }
    if (needsVideos && !videosCount) {
      return `<p class="brain-hint"><strong>Suggest videos to watch</strong> picks from your YouTube library. Add videos in <button type="button" class="btn-inline-link" data-panel="optimize_lab_settings">Optimize Lab Settings</button> first.</p>`;
    }
    if (t.placeholderHint) {
      return `<p class="brain-hint">${esc(t.placeholderHint)}</p>`;
    }
    return "";
  }

  function optLabToolInspectBody(t) {
    const savedNotes = optLabTechniqueNotes(t.id);
    const notesPlaceholder =
      t.notesPlaceholder ||
      "Voice, length, audience, or format. e.g. Questions only. Write like a curious kid. Minimum 12 items.";
    const hasArticle = Boolean(state.optLabArticle?.content);
    const genStatus = optLabTechniqueGenStatus(t.id);
    const isRunning = genStatus === "running";
    const isQueued = genStatus === "queued";
    const slotsLeft = optLabGenerationsSlotsLeft();
    const atGenLimit = slotsLeft !== null && slotsLeft <= 0;
    const canGenerate = hasArticle && state.openaiConfigured && !isRunning && !isQueued && !atGenLimit;
    const generateLabel = isRunning ? "Generating…" : isQueued ? "Queued…" : "Generate";
    const generateBtn = `<button type="button" class="btn-sm btn-black brain-generate" data-brain-generate="${esc(t.id)}" ${canGenerate ? "" : "disabled"} title="${esc(optLabGenerateTitle(hasArticle))}">${esc(generateLabel)}</button>`;
    return `
      <div class="brain-facts-grid">
        <div class="brain-fact">
          <span class="brain-fact-label">Why it helps</span>
          <p>${esc(t.whyItHelps)}</p>
        </div>
        <div class="brain-fact">
          <span class="brain-fact-label">When to use</span>
          <p class="brain-when">${esc(t.whenToUse)}</p>
        </div>
      </div>
      <div class="brain-example">
        <span class="brain-example-label">Example output</span>
        <pre class="brain-example-body">${esc(t.example || "")}</pre>
      </div>
      ${optLabToolInspectHint(t)}
      <div class="brain-notes-block">
        <label class="brain-notes-label" for="brain-notes-${esc(t.id)}">Your instructions</label>
        <p class="brain-notes-hint">Optional: tone, length, audience, or format. Applied when you generate and saved as you type.</p>
        <textarea class="search brain-notes-input" id="brain-notes-${esc(t.id)}" data-brain-notes="${esc(t.id)}" rows="3" placeholder="${esc(notesPlaceholder)}">${esc(savedNotes)}</textarea>
      </div>
      <div class="optlab-grid-inspect-foot">${generateBtn}</div>`;
  }

  function optLabGridInspectPopover() {
    const toolId = state.optLabInspectToolId;
    if (!toolId) return "";
    const t = allWorkshopTechniques().find((x) => x.id === toolId);
    if (!t) return "";
    const catLabel = brainCategoryLabel(t.category);
    return `
      <div class="optlab-grid-inspect-backdrop" data-optlab-inspect-close role="presentation">
        <div class="optlab-grid-inspect" role="dialog" aria-labelledby="optlab-inspect-title" aria-modal="true" data-optlab-inspect-panel>
          <div class="optlab-grid-inspect-head">
            <div>
              <span class="brain-cat-pill brain-cat-pill--${esc(t.category)}">${esc(catLabel)}</span>
              <h3 class="optlab-grid-inspect-title" id="optlab-inspect-title">${esc(t.name)}</h3>
              <p class="optlab-grid-inspect-lead">${esc(t.shortDescription)}</p>
            </div>
            <button type="button" class="btn-sm btn-ghost" data-optlab-inspect-close aria-label="Close">Close</button>
          </div>
          ${optLabToolInspectBody(t)}
        </div>
      </div>`;
  }

  function optLabWrapToolSlot(innerHtml) {
    return `<div class="optlab-grid-tool-slot"><div class="optlab-grid-tool-turn"><div class="optlab-grid-tool-face optlab-grid-tool-face--front">${innerHtml}</div><div class="optlab-grid-tool-face optlab-grid-tool-face--back" aria-hidden="true"></div></div></div>`;
  }

  function optLabGridToolCard(t, slot) {
    const used = optLabBlockForTechnique(t.id);
    const usedClass = used ? " optlab-grid-tool--used" : "";
    const mono = optLabGridMonogram(t);
    return `
      <div class="optlab-grid-tool${usedClass}"
        draggable="true"
        role="button"
        tabindex="0"
        data-optlab-grid-tool="${esc(t.id)}"
        data-optlab-grid-slot="${slot}"
        title="${esc(t.name)} · ${esc(t.shortDescription)} · drag onto article or click to inspect">
        <span class="optlab-grid-tool-icon" aria-hidden="true">${esc(mono)}</span>
        <span class="optlab-grid-tool-name">${esc(t.name)}</span>
      </div>`;
  }

  function optLabGridPlaceholderCard(slot) {
    return `
      <div class="optlab-grid-tool optlab-grid-tool--placeholder" data-optlab-grid-slot="${slot}" aria-hidden="true">
        <span class="optlab-grid-tool-placeholder-label">Coming soon</span>
      </div>`;
  }

  function optLabGridToolCells(tools, startSlot) {
    return tools
      .map((t, i) =>
        optLabWrapToolSlot(
          t ? optLabGridToolCard(t, startSlot + i) : optLabGridPlaceholderCard(startSlot + i)
        )
      )
      .join("");
  }

  function optLabGridTopToolsHtml(tools) {
    return tools
      .map((t, i) => {
        const inner = optLabWrapToolSlot(
          t ? optLabGridToolCard(t, i) : optLabGridPlaceholderCard(i)
        );
        return `<div class="optlab-grid-top-cell" style="grid-column:${i + 1};grid-row:1">${inner}</div>`;
      })
      .join("");
  }

  function optLabGridLayout() {
    const bySlot = optLabToolsBySlot();
    const top = bySlot.slice(0, 6);
    const left = bySlot.slice(6, 12);
    const right = bySlot.slice(12, 18);
    const focusClass = optLabIsFocusMode() ? " optlab-grid-frame--focus" : "";
    return `
      <div class="optlab-grid-frame${focusClass}">
        ${optLabGridTopToolsHtml(top)}
        <div class="optlab-grid-flank optlab-grid-flank--left optlab-grid-flank--placed-left" aria-label="Tools left">
          <div class="optlab-grid-flank-tools">${optLabGridToolCells(left, 6)}</div>
          ${optLabGridSessionRail("left")}
        </div>
        <div class="optlab-grid-spine optlab-grid-spine--placed">
          ${optLabGridWell()}
        </div>
        <div class="optlab-grid-flank optlab-grid-flank--right optlab-grid-flank--placed-right" aria-label="Tools right">
          <div class="optlab-grid-flank-tools">${optLabGridToolCells(right, 12)}</div>
          ${optLabGridSessionRail("right")}
        </div>
      </div>`;
  }

  function optLabArticleSectionsPanel() {
    if (optLabMode() === "ideas" || optLabIsFocusMode()) return "";
    const blocks = (state.optLabBlocks || []).filter(
      (b) => (b.output_kind || optLabTechniqueOutputKind(b.technique_id)) === "section"
    );
    if (!blocks.length) return "";
    const ready = blocks.filter((b) => b.status === "ready").length;
    const pending = blocks.filter((b) => b.status === "queued" || b.status === "running").length;
    const countParts = [];
    if (ready) countParts.push(`${ready} ready`);
    if (pending) countParts.push(`${pending} in progress`);
    const countLabel = countParts.length ? countParts.join(" · ") : `${blocks.length} sections`;
    return `
      <div class="optlab-article-sections" aria-label="Sections to paste">
        <div class="optlab-article-sections-head">
          <h4 class="optlab-article-sections-title">Sections to paste</h4>
          <span class="optlab-article-sections-count">${esc(countLabel)}</span>
        </div>
        ${blocks.map((row) => optLabArticleSectionBlock(row)).join("")}
      </div>`;
  }

  function optLabGridDeskCard(s) {
    const active = s.session_key === state.optLabSessionKey ? " optlab-grid-session--active" : "";
    const fresh = s.session_key === state.optLabFreshDeskKey ? " optlab-grid-session--fresh" : "";
    const kindClass = s.session_kind === "draft" ? " optlab-grid-session--draft" : " optlab-grid-session--idea";
    const badge =
      s.session_kind === "draft"
        ? '<span class="optlab-grid-session-badge">Draft</span>'
        : '<span class="optlab-grid-session-badge optlab-grid-session-badge--idea">Idea</span>';
    const meta = s.word_count ? `${s.word_count} words` : s.session_kind === "draft" ? "Draft" : "Idea";
    return `<button type="button" class="optlab-grid-session${kindClass}${active}${fresh}" data-optlab-desk="${esc(s.session_key)}" draggable="true">
      ${badge}
      <span class="optlab-grid-session-title">${esc(s.article_title || "Untitled article")}</span>
      <span class="optlab-grid-session-meta">${esc(meta)}</span>
    </button>`;
  }

  function optLabGridSessionRail(side) {
    const archived = side === "right";
    if (archived) {
      const rows = (state.optLabSessions || []).filter((s) => Boolean(s.archived));
      const label = "Archived";
      return `
      <aside class="optlab-grid-rail optlab-grid-rail--${side} optlab-grid-rail--archive" aria-label="${esc(label)}" data-optlab-archive-rail>
        <p class="optlab-grid-rail-label">${esc(label)}</p>
        <div class="optlab-grid-rail-list">
          ${
            rows.length
              ? rows
                  .map((s) => {
                    const meta = s.word_count ? `${s.word_count} words` : `${s.output_count || 0} outputs`;
                    return `<button type="button" class="optlab-grid-session" data-optlab-desk="${esc(s.session_key)}" draggable="true">
                      <span class="optlab-grid-session-title">${esc(s.article_title || "Untitled article")}</span>
                      <span class="optlab-grid-session-meta">${esc(meta)}</span>
                    </button>`;
                  })
                  .join("")
              : `<p class="optlab-grid-rail-empty">Drop a desk card here to archive it.</p>`
          }
        </div>
      </aside>`;
    }
    const rows = optLabDeskSessions();
    const label = "Working desk";
    return `
      <aside class="optlab-grid-rail optlab-grid-rail--${side} optlab-grid-rail--desk" aria-label="${esc(label)}" data-optlab-desk-rail>
        <p class="optlab-grid-rail-label">${esc(label)}</p>
        <div class="optlab-grid-rail-list">
          ${
            rows.length
              ? rows.map((s) => optLabGridDeskCard(s)).join("")
              : `<p class="optlab-grid-rail-empty">Generated drafts land here.</p>`
          }
        </div>
      </aside>`;
  }

  function optLabFocusWellToolbar() {
    const article = state.optLabArticle;
    const hasDraft = Boolean((state.optLabDraftText || "").trim() || (state.optLabDraftTitle || "").trim());
    const canClear = !!article || hasDraft;
    return `
      <div class="optlab-mode-tabs optlab-grid-well-toolbar optlab-grid-well-toolbar--focus" role="group" aria-label="Writing actions">
        <button type="button" class="btn-sm btn-ghost" id="optlab-clear-article" ${canClear ? "" : "disabled"}>Clear</button>
      </div>`;
  }

  function optLabFocusWritingPanel() {
    const article = state.optLabArticle;
    if (article && optLabIsEditableArticle(article)) {
      return `
      <section class="optlab-article optlab-article--editable optlab-article--focus" aria-label="Focus writing">
        <label class="optlab-load-label" for="optlab-article-edit-title">Title</label>
        <input class="search optlab-draft-title" type="text" id="optlab-article-edit-title" value="${esc(article.title || "")}" />
        <label class="optlab-load-label optlab-load-label-spaced" for="optlab-article-edit-body">Article text</label>
        <textarea class="search optlab-draft-text optlab-draft-text--focus optlab-article-edit-body" id="optlab-article-edit-body" rows="20">${esc(article.content || "")}</textarea>
        <div class="optlab-load-row optlab-load-row-end">
          <span class="optlab-draft-meta">${esc(optLabWordMetaText(article.content || ""))}</span>
        </div>
      </section>`;
    }
    const draftMeta = optLabWordMetaText(state.optLabDraftText);
    return `
      <section class="optlab-article optlab-article--editable optlab-article--focus" aria-label="Focus writing">
        <label class="optlab-load-label" for="optlab-draft-title">Title</label>
        <input class="search optlab-draft-title" type="text" id="optlab-draft-title" placeholder="How to fix a leaky faucet" value="${esc(state.optLabDraftTitle)}" />
        <label class="optlab-load-label optlab-load-label-spaced" for="optlab-draft-text">Article text</label>
        <textarea class="search optlab-draft-text optlab-draft-text--focus" id="optlab-draft-text" rows="20" placeholder="Write your article here…">${esc(state.optLabDraftText)}</textarea>
        <div class="optlab-load-row optlab-load-row-end">
          <span class="optlab-draft-meta">${esc(draftMeta)}</span>
        </div>
      </section>`;
  }

  function optLabGridWellToolbar() {
    const mode = state.optLabInputMode === "url" ? "url" : "paste";
    const article = state.optLabArticle;
    const hasDraft = Boolean((state.optLabDraftText || "").trim() || (state.optLabDraftTitle || "").trim());
    const canClear = !!article || hasDraft;
    return `
      <div class="optlab-mode-tabs optlab-grid-well-toolbar" role="group" aria-label="Article actions">
        <button type="button" class="btn-sm btn-ghost toolbar-filter-btn" data-optlab-mode="paste" aria-pressed="${mode === "paste" ? "true" : "false"}">Write</button>
        <button type="button" class="btn-sm btn-ghost toolbar-filter-btn" data-optlab-mode="url" aria-pressed="${mode === "url" ? "true" : "false"}">URL</button>
        <button type="button" class="btn-sm btn-ghost" id="optlab-clear-article" ${canClear ? "" : "disabled"}>Clear</button>
      </div>`;
  }

  function optLabGridWellHeader() {
    if (optLabIsFocusMode()) {
      return `
      <div class="optlab-grid-well-header optlab-grid-well-header--focus">
        ${optLabFocusWellToolbar()}
        <div class="optlab-grid-well-header-actions">
          ${optLabGridModeToggle()}
        </div>
      </div>`;
    }
    return `
      <div class="optlab-grid-well-header">
        ${optLabGridWellToolbar()}
        <div class="optlab-grid-well-header-actions">
          ${optLabGridModeToggle()}
        </div>
      </div>`;
  }

  function optLabGridModeToggle() {
    const mode = optLabMode();
    const modeClass =
      mode === "ideas" ? " optlab-mode-magic--ideas" : mode === "focus" ? " optlab-mode-magic--focus" : " optlab-mode-magic--enhance";
    const srLabel =
      mode === "ideas" ? "Generate mode active" : mode === "focus" ? "Focus mode active" : "Enhance mode active";
    return `
      <div class="optlab-grid-well-mode-wrap">
        <div class="optlab-mode-magic${modeClass}" role="group" aria-label="Lab mode">
          <span class="optlab-mode-magic-track">
            <span class="optlab-mode-magic-thumb" aria-hidden="true"></span>
            <button type="button"
              class="optlab-mode-magic-face optlab-mode-magic-face--enhance"
              data-optlab-mode-set="enhance"
              aria-pressed="${mode === "enhance" ? "true" : "false"}"
              aria-label="Enhance mode">
              <span class="optlab-mode-magic-glyph" aria-hidden="true">⭐️</span>
              <span class="sr-only">Enhance</span>
            </button>
            <button type="button"
              class="optlab-mode-magic-face optlab-mode-magic-face--generate"
              data-optlab-mode-set="ideas"
              aria-pressed="${mode === "ideas" ? "true" : "false"}"
              aria-label="Generate mode">
              <span class="optlab-mode-magic-glyph" aria-hidden="true">🧠</span>
              <span class="sr-only">Generate</span>
            </button>
            <button type="button"
              class="optlab-mode-magic-face optlab-mode-magic-face--focus"
              data-optlab-mode-set="focus"
              aria-pressed="${mode === "focus" ? "true" : "false"}"
              aria-label="Focus mode">
              <span class="optlab-mode-magic-glyph" aria-hidden="true">✍️</span>
              <span class="sr-only">Focus</span>
            </button>
          </span>
          <span class="sr-only">${srLabel}</span>
        </div>
      </div>`;
  }

  function optLabGridWell() {
    const focus = optLabIsFocusMode();
    const wellReady = state.optLabArticleJustLoaded ? " optlab-grid-well--ready" : "";
    const dragover = !focus && state.optLabWellDragover ? " optlab-grid-well--dragover" : "";
    const focusClass = focus ? " optlab-grid-well--focus" : "";
    const genErr = state.optLabError
      ? `<p class="optlab-error" role="alert">${esc(state.optLabError)}</p>`
      : "";
    let articleBlock = "";
    if (focus) {
      articleBlock = optLabFocusWritingPanel();
    } else {
      const sectionsHtml = optLabArticleSectionsPanel();
      if (!state.optLabArticle) {
        articleBlock = optLabInputSection();
      } else if (optLabMode() !== "ideas") {
        articleBlock = `<div class="optlab-article-surface">${optLabArticlePanel()}${sectionsHtml}</div>`;
      } else {
        articleBlock = optLabArticlePanel();
      }
    }
    const dropzone = focus
      ? ""
      : `<div class="optlab-grid-well-dropzone" aria-hidden="true">
            <span class="optlab-grid-well-dropzone-ring" aria-hidden="true"></span>
            <span class="optlab-grid-well-dropzone-label">Drop to add this section</span>
            <span class="optlab-grid-well-dropzone-tool"></span>
          </div>`;
    const sessionBanner = focus ? "" : optLabSessionBanner();
    return `
      <div class="optlab-grid-well-stack">
        <div class="optlab-grid-well${wellReady}${dragover}${focusClass}" data-optlab-grid-well aria-label="${focus ? "Focus writing" : "Article well"}">
          ${optLabGridWellHeader()}
          ${dropzone}
          <div class="optlab-grid-well-content">
        ${articleBlock}
        ${genErr}
        ${sessionBanner}
        </div>
      </div>
      </div>`;
  }

  function brainPanel() {
    const mode = optLabToPageMode(optLabMode());
    const modeClass = ` brain-page--mode-${mode}`;
    const tips = optLabIsFocusMode() ? "" : optLabTipsFooter();
    return `
      <div class="brain-page brain-page--grid${modeClass}">
        <div class="optlab-mode-bg-wipe" aria-hidden="true"></div>
        <div class="brain-page-inner">
          <h2 class="sr-only">Optimize Lab</h2>
          ${optLabGridLayout()}
          ${tips}
        </div>
        ${optLabGridInspectPopover()}
      </div>`;
  }

  function scrollBrainHash() {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || state.panel !== "optimize_lab") return;
    const t = allWorkshopTechniques().find((x) => x.id === hash);
    if (t) {
      state.optLabInspectToolId = hash;
      render();
      return;
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(hash);
      if (!el) return;
      if (el.tagName === "DETAILS") el.open = true;
      el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      el.classList.add("brain-entry--highlight");
      setTimeout(() => el.classList.remove("brain-entry--highlight"), 2000);
    });
  }

  async function scrapeOptLabArticle() {
    const url = readOptLabEditorFields().url;
    if (!optLabLooksLikeUrl(url)) return;
    if (state.optLabScrapeLoading) return;
    if (state.optLabArticle?.url === url && state.optLabSessionKey && state.optLabArticle?.content) return;

    state.optLabUrl = url;
    state.optLabScrapeLoading = true;
    state.optLabError = null;
    render();

    try {
      const data = await api("/api/optimize-lab/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const content = (data.content || "").trim();
      if (!content) {
        throw new Error("That page did not return any article text.");
      }
      state.optLabDraftTitle = data.title || "";
      state.optLabDraftText = content;
      resetOptLabArticleSession();
      state.optLabSessionKey = null;
      state.optLabArticle = {
        title: data.title || optLabDraftTitleFromContent(content),
        content,
        word_count: optLabWordCount(content),
        source: "url",
        session_kind: "draft",
        url,
      };
      await persistOptLabArticleToDesk({ refreshOutputs: true });
      state.optLabArticleJustLoaded = true;
      state.optLabError = null;
    } catch (e) {
      state.optLabError = e.message || "Could not load that page. Check the URL is public and try again.";
    } finally {
      state.optLabScrapeLoading = false;
      await loadOptLabSessions();
      render();
    }
  }

  function enqueueOptLabGenerate(techniqueId, notesOverride) {
    const t = allWorkshopTechniques().find((x) => x.id === techniqueId);
    const notes =
      notesOverride !== undefined ? optLabNormalizeNotes(notesOverride) : readOptLabTechniqueNotesFromDom(techniqueId);
    const prompt = resolveBrainPrompt(t, notes);
    if (!prompt) return false;
    if (!state.optLabArticle?.content) {
      state.optLabError = "Load an article in the center well before generating.";
      render();
      return false;
    }
    if (!state.openaiConfigured) {
      state.optLabError = "Generation is not enabled. Add OPENAI_API_KEY to .env.local and restart the server.";
      render();
      return false;
    }
    const slots = optLabGenerationsSlotsLeft();
    if (slots !== null && slots <= 0) {
      const limit = optLabGenerationsStatus()?.limit ?? 50;
      state.optLabError = `Monthly generation limit reached (${formatCredits(limit)} max). Resets on the 1st.`;
      render();
      return false;
    }
    const inflight = state.optLabBlocks.find(
      (b) => b.technique_id === techniqueId && (b.status === "queued" || b.status === "running")
    );
    if (inflight) return false;

    if (optLabHasDuplicateReadyOutput(techniqueId, notes) && optLabTechniqueOutputKind(techniqueId) === "section") {
      window.alert("You already have this output with the same instructions. Change your notes or run a fresh generation.");
      return false;
    }

    rememberOptLabSourceArticle();
    const outputKind = optLabTechniqueOutputKind(techniqueId);
    const queueId = `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const block = {
      queueId,
      technique_id: techniqueId,
      technique_name: t.name,
      technique_notes: notes,
      output_kind: outputKind,
      status: "queued",
      output: "",
      error: null,
      id: null,
    };
    state.optLabBlocks.unshift(block);

    state.optLabError = null;
    syncOptLabSessionToolsFromBlocks();
    if (!state.optLabSettings) state.optLabSettings = { articles: [], videos: [], technique_notes: {} };
    if (!state.optLabSettings.technique_notes) state.optLabSettings.technique_notes = {};
    state.optLabSettings.technique_notes[techniqueId] = notes;
    saveOptLabTechniqueNotes(techniqueId, notes);
    render();
    if (outputKind === "section") {
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-optlab-block-id="${queueId}"]`)
          ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" });
      });
    }
    drainOptLabGenQueue();
    return true;
  }

  async function drainOptLabGenQueue() {
    if (state.optLabQueueDraining) return;
    const job = state.optLabBlocks.find((b) => b.status === "queued");
    if (!job) return;

    state.optLabQueueDraining = true;
    job.status = "running";
    render();

    const t = allWorkshopTechniques().find((x) => x.id === job.technique_id);
    const notes = job.technique_notes ?? readOptLabTechniqueNotesFromDom(job.technique_id);
    const prompt = resolveBrainPrompt(t, notes);
    const article = state.optLabArticle;
    const outputKind = job.output_kind || optLabTechniqueOutputKind(job.technique_id);

    try {
      const data = await api("/api/optimize-lab/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technique_id: t.id,
          technique_name: t.name,
          prompt,
          article_text: article.content,
          article_url: article.url || "",
          article_title: article.title || "",
          session_key: state.optLabSessionKey || article.session_key || "",
          technique_notes: notes,
          output_kind: outputKind,
        }),
      });
      state.optLabError = null;
      syncOptLabGenerationsFromResponse(data);

      if (outputKind === "draft" || outputKind === "idea") {
        state.optLabBlocks = state.optLabBlocks.filter((b) => b.queueId !== job.queueId);
        syncOptLabSessionToolsFromBlocks();
        state.optLabFreshDeskKey = data.session_key || null;
        await loadOptLabSessions();
        await openOptLabDeskSession(data.session_key);
        if (outputKind === "draft") {
          const choice = await showOptLabHandoffDialog();
          if (choice === "enhance") {
            state.optLabMode = "enhance";
            optLabSetModeBackground("enhance");
          } else if (choice === "keep" && state.optLabSourceArticle) {
            state.optLabArticle = { ...state.optLabSourceArticle };
            state.optLabSessionKey = state.optLabSourceArticle.session_key || null;
            await loadOptLabOutputsForArticle(state.optLabArticle);
          }
        }
        if (state.optLabFreshDeskKey) {
          window.setTimeout(() => {
            state.optLabFreshDeskKey = null;
            render();
          }, 1800);
        }
      } else {
        if (article && !article.session_kind) {
          state.optLabSessionKey = data.session_key || state.optLabSessionKey;
          article.session_key = state.optLabSessionKey;
        }
        const saved = data.output || {};
        const idx = state.optLabBlocks.findIndex((b) => b.queueId === job.queueId);
        if (idx >= 0) {
          state.optLabBlocks[idx] = { ...saved, status: "ready", queueId: job.queueId };
        }
        state.optLabFreshOutputId = saved.id || null;
        syncOptLabSessionToolsFromBlocks();
        await loadOptLabSessions();
      }
    } catch (e) {
      job.status = "error";
      job.error = e.message || "Generate failed. Try again in a moment.";
    } finally {
      state.optLabQueueDraining = false;
      render();
      if (state.optLabFreshOutputId) {
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-optlab-block-id="${state.optLabFreshOutputId}"]`)
            ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" });
        });
      }
      drainOptLabGenQueue();
    }
  }

  function generateOptLab(techniqueId) {
    enqueueOptLabGenerate(techniqueId);
  }

  function cancelOptLabQueuedBlock(queueId) {
    if (!queueId) return;
    const idx = state.optLabBlocks.findIndex((b) => b.queueId === queueId && b.status === "queued");
    if (idx < 0) return;
    state.optLabBlocks.splice(idx, 1);
    syncOptLabSessionToolsFromBlocks();
    render();
  }

  function dismissOptLabBlock(token) {
    if (!token) return;
    const idx = state.optLabBlocks.findIndex((b) => (b.queueId || b.id) === token);
    if (idx < 0) return;
    state.optLabBlocks.splice(idx, 1);
    syncOptLabSessionToolsFromBlocks();
    render();
  }

  async function copyOptLabOutput(outputId) {
    const row = (state.optLabBlocks || []).find((item) => item.id === outputId && item.status === "ready");
    const text = row?.output;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  async function deleteOptLabOutput(outputId) {
    const sessionKey = state.optLabSessionKey;
    if (!outputId) return;
    const block = (state.optLabBlocks || []).find((item) => item.id === outputId);
    if (!block || block.status !== "ready") return;
    if (!sessionKey) {
      state.optLabBlocks = state.optLabBlocks.filter((item) => item.id !== outputId);
      syncOptLabSessionToolsFromBlocks();
      render();
      return;
    }
    try {
      const data = await api(
        `/api/optimize-lab/outputs/${encodeURIComponent(sessionKey)}/${encodeURIComponent(outputId)}`,
        { method: "DELETE" }
      );
      state.optLabBlocks = mergeOptLabBlocksWithInFlight(data.outputs);
      syncOptLabSessionToolsFromBlocks();
      if (state.optLabFreshOutputId === outputId) state.optLabFreshOutputId = null;
      render();
    } catch (e) {
      state.optLabError = e.message || "Could not remove that block.";
      render();
    }
  }

  function optLabImportAlert({ label, added, fetched, source }) {
    if (!fetched) {
      alert(`Nothing to import. Check the ${source} URL and try again.`);
      return;
    }
    if (added) {
      alert(`Added ${added} ${label}${added === 1 ? "" : "s"} from ${source} (${fetched} found).`);
      return;
    }
    alert(`Found ${fetched} ${label}${fetched === 1 ? "" : "s"} in ${source}, but they are already in your library.`);
  }

  function bindOptLabSettingsPanel() {
    const addArticle = document.getElementById("optlab-add-article-btn");
    if (addArticle) {
      addArticle.addEventListener("click", async () => {
        const title = document.getElementById("optlab-new-article-title")?.value?.trim();
        const url = document.getElementById("optlab-new-article-url")?.value?.trim() || "";
        if (!title) {
          alert("Enter a title before adding the article.");
          return;
        }
        try {
          const data = await api("/api/optimize-lab/articles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, url }),
          });
          state.optLabSettings = data.settings;
          render();
        } catch (err) {
          alert(err.message || "Could not add that article. Check the title and try again.");
        }
      });
    }

    const addVideo = document.getElementById("optlab-add-video-btn");
    if (addVideo) {
      addVideo.addEventListener("click", async () => {
        const title = document.getElementById("optlab-new-video-title")?.value?.trim();
        const url = document.getElementById("optlab-new-video-url")?.value?.trim() || "";
        if (!title) {
          alert("Enter a title before adding the video.");
          return;
        }
        try {
          const data = await api("/api/optimize-lab/videos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, url }),
          });
          state.optLabSettings = data.settings;
          render();
        } catch (err) {
          alert(err.message || "Could not add that video. Check the title and try again.");
        }
      });
    }

    document.querySelectorAll("[data-del-optlab-article]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const data = await api(`/api/optimize-lab/articles/${btn.getAttribute("data-del-optlab-article")}`, {
            method: "DELETE",
          });
          state.optLabSettings = data.settings;
          render();
        } catch (err) {
          alert(err.message || "Could not remove that article.");
        }
      });
    });

    document.querySelectorAll("[data-del-optlab-video]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const data = await api(`/api/optimize-lab/videos/${btn.getAttribute("data-del-optlab-video")}`, {
            method: "DELETE",
          });
          state.optLabSettings = data.settings;
          render();
        } catch (err) {
          alert(err.message || "Could not remove that video.");
        }
      });
    });

    async function importOptLabCsv(input, kind) {
      const file = input?.files?.[0];
      if (!file) return;
      const form = new FormData();
      form.append("file", file);
      try {
        const data = await api(`/api/optimize-lab/import-csv?kind=${kind}`, {
          method: "POST",
          body: form,
        });
        state.optLabSettings = data.settings;
        input.value = "";
        render();
        if (data.added) {
          alert(`Added ${data.added} ${kind === "articles" ? "article" : "video"}${data.added === 1 ? "" : "s"} from your CSV.`);
        } else {
          alert("Nothing new to add. Those titles and links are already in your library.");
        }
      } catch (err) {
        alert(err.message || "Could not read that CSV. Use title and url columns, UTF-8 encoding.");
      }
    }

    const articlesCsv = document.getElementById("optlab-articles-csv");
    if (articlesCsv) {
      articlesCsv.addEventListener("change", () => importOptLabCsv(articlesCsv, "articles"));
    }
    const videosCsv = document.getElementById("optlab-videos-csv");
    if (videosCsv) {
      videosCsv.addEventListener("change", () => importOptLabCsv(videosCsv, "videos"));
    }

    const importRss = document.getElementById("optlab-import-rss-btn");
    if (importRss) {
      importRss.addEventListener("click", async () => {
        const url = document.getElementById("optlab-rss-feed-url")?.value?.trim();
        if (!url) {
          alert("Paste your blog feed URL first.");
          return;
        }
        importRss.disabled = true;
        const prev = importRss.textContent;
        importRss.textContent = "Importing…";
        try {
          const data = await api("/api/optimize-lab/import-rss", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          state.optLabSettings = data.settings;
          render();
          optLabImportAlert({
            label: "article",
            added: data.added || 0,
            fetched: data.fetched || 0,
            source: "your feed",
          });
        } catch (err) {
          alert(err.message || "Could not import from that feed. Check the URL loads in your browser.");
        } finally {
          importRss.disabled = false;
          importRss.textContent = prev;
        }
      });
    }

    const importYoutube = document.getElementById("optlab-import-youtube-btn");
    if (importYoutube) {
      importYoutube.addEventListener("click", async () => {
        const url = document.getElementById("optlab-youtube-channel-url")?.value?.trim();
        if (!url) {
          alert("Paste your YouTube channel URL first.");
          return;
        }
        importYoutube.disabled = true;
        const prev = importYoutube.textContent;
        importYoutube.textContent = "Importing…";
        try {
          const data = await api("/api/optimize-lab/import-youtube-channel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          state.optLabSettings = data.settings;
          render();
          optLabImportAlert({
            label: "video",
            added: data.added || 0,
            fetched: data.fetched || 0,
            source: "your channel",
          });
        } catch (err) {
          const msg = String(err.message || "");
          if (msg.includes("YOUTUBE_API_KEY")) {
            alert("YouTube import is not set up on this server. Add YOUTUBE_API_KEY to .env.local and restart, or add videos manually.");
          } else {
            alert(msg || "Could not import from that channel. Use a public channel URL like youtube.com/@yourchannel.");
          }
        } finally {
          importYoutube.disabled = false;
          importYoutube.textContent = prev;
        }
      });
    }
  }

  function bindBrainPanel() {
    document.querySelectorAll("[data-brain-generate]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        generateOptLab(btn.dataset.brainGenerate);
      });
    });
    document.querySelectorAll("[data-brain-notes]").forEach((el) => {
      el.addEventListener("input", () => {
        const techniqueId = el.getAttribute("data-brain-notes");
        if (!techniqueId) return;
        if (!state.optLabSettings) state.optLabSettings = { articles: [], videos: [], technique_notes: {} };
        if (!state.optLabSettings.technique_notes) state.optLabSettings.technique_notes = {};
        state.optLabSettings.technique_notes[techniqueId] = el.value;
        clearTimeout(optLabNotesSaveTimer);
        optLabNotesSaveTimer = setTimeout(() => {
          saveOptLabTechniqueNotes(techniqueId, el.value);
        }, 700);
      });
      el.addEventListener("click", (e) => e.stopPropagation());
    });
    document.querySelectorAll("[data-optlab-cancel-queue]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        cancelOptLabQueuedBlock(btn.getAttribute("data-optlab-cancel-queue"));
      });
    });
    document.querySelectorAll("[data-optlab-dismiss-block]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dismissOptLabBlock(btn.getAttribute("data-optlab-dismiss-block"));
      });
    });
    document.querySelectorAll("[data-optlab-copy-output]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await copyOptLabOutput(btn.getAttribute("data-optlab-copy-output"));
        const label = btn.textContent;
        btn.textContent = "Copied!";
        btn.classList.add("is-copied");
        setTimeout(() => {
          btn.textContent = label;
          btn.classList.remove("is-copied");
        }, 1500);
      });
    });
    document.querySelectorAll("[data-optlab-del-output]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteOptLabOutput(btn.getAttribute("data-optlab-del-output"));
      });
    });
    const urlInput = document.getElementById("optlab-url-input");
    if (urlInput) {
      urlInput.addEventListener("input", () => {
        state.optLabUrl = urlInput.value;
        state.optLabError = null;
        scheduleOptLabUrlScrape();
      });
    }
    document.querySelectorAll("[data-optlab-mode-set]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wrap = btn.closest(".optlab-mode-magic");
        if (wrap?.dataset.optlabModeAnimating === "1") return;
        const next = btn.getAttribute("data-optlab-mode-set");
        runOptLabModeChange(next, btn);
      });
    });
    document.querySelectorAll("[data-optlab-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.optLabInputMode = btn.dataset.optlabMode === "url" ? "url" : "paste";
        state.optLabError = null;
        render();
        if (state.optLabInputMode === "url" && optLabLooksLikeUrl(state.optLabUrl)) {
          scheduleOptLabUrlScrape();
        }
      });
    });
    bindOptLabEditorAutoSave();
    document.getElementById("optlab-use-idea-article")?.addEventListener("click", promoteOptLabIdeaToDraft);
    document.getElementById("optlab-clear-article")?.addEventListener("click", () => {
      const article = state.optLabArticle;
      if (article && !article.url) {
        state.optLabDraftText = article.content;
        state.optLabDraftTitle = article.title === optLabDraftTitleFromContent(article.content)
          ? ""
          : (article.title || "");
        state.optLabInputMode = "paste";
      } else if (article?.url) {
        state.optLabInputMode = "url";
      }
      if (optLabIsFocusMode() || !article) {
        state.optLabDraftTitle = "";
        state.optLabDraftText = "";
      }
      state.optLabArticle = null;
      state.optLabBlocks = [];
      state.optLabSessionKey = null;
      state.optLabDraftTitle = "";
      state.optLabDraftText = "";
      state.optLabQueueDraining = false;
      state.optLabError = null;
      state.optLabSessionTools = [];
      state.optLabFreshOutputId = null;
      state.optLabArticleJustLoaded = false;
      render();
    });
    document.querySelectorAll("[data-brain-starter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.brainStarter;
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === "DETAILS") el.open = true;
        el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" });
        el.classList.add("brain-entry--highlight");
        setTimeout(() => el.classList.remove("brain-entry--highlight"), 2000);
      });
    });
    const workbench = document.querySelector(".optlab-grid-well");
    if (workbench && state.optLabArticleJustLoaded) {
      state.optLabArticleJustLoaded = false;
      setTimeout(() => workbench.classList.remove("optlab-grid-well--ready"), 1200);
    }
    bindOptLabGrid();
    if (state.optLabFreshOutputId) {
      state.optLabFreshOutputId = null;
    }
    scrollBrainHash();
  }

  function optLabToolMeta(techniqueId) {
    return allWorkshopTechniques().find((x) => x.id === techniqueId);
  }

  function optLabClearGridDrag() {
    document.body.classList.remove("optlab-grid-drag-active");
    document.querySelectorAll(".optlab-grid-tool--dragging").forEach((el) => {
      el.classList.remove("optlab-grid-tool--dragging");
    });
    const well = document.querySelector("[data-optlab-grid-well]");
    if (well) {
      well.classList.remove("optlab-grid-well--dragover", "optlab-grid-well--landed", "optlab-grid-well--deny-shake");
      const dropzone = well.querySelector(".optlab-grid-well-dropzone");
      if (dropzone) {
        dropzone.classList.remove("is-visible", "is-ready", "is-deny");
        const toolEl = dropzone.querySelector(".optlab-grid-well-dropzone-tool");
        if (toolEl) toolEl.textContent = "";
      }
    }
    state.optLabWellDragover = false;
  }

  function optLabUpdateWellDropzone(well, techniqueId) {
    const t = optLabToolMeta(techniqueId);
    const dropzone = well.querySelector(".optlab-grid-well-dropzone");
    if (!dropzone) return;
    const toolEl = dropzone.querySelector(".optlab-grid-well-dropzone-tool");
    const labelEl = dropzone.querySelector(".optlab-grid-well-dropzone-label");
    const hasArticle = Boolean(state.optLabArticle?.content);
    if (toolEl) toolEl.textContent = t?.name || "";
    if (labelEl) {
      labelEl.textContent = hasArticle ? "Drop to add this section" : "Paste your article first";
    }
    dropzone.classList.toggle("is-ready", hasArticle);
    dropzone.classList.toggle("is-deny", !hasArticle);
  }

  function optLabFlashWellDrop(well, ok) {
    if (!well || prefersReducedMotion()) return;
    well.classList.add(ok ? "optlab-grid-well--landed" : "optlab-grid-well--deny-shake");
    window.setTimeout(
      () => well.classList.remove("optlab-grid-well--landed", "optlab-grid-well--deny-shake"),
      ok ? 520 : 420
    );
  }

  const OPTLAB_FLIP_DURATION_MS = 1200;
  const OPTLAB_FLIP_STAGGER_MS = 100;
  const OPTLAB_FLIP_EASE = "cubic-bezier(0.77, 0, 0.175, 1)";

  function optLabPrepareFlipTimings(count) {
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const delays = Array(count).fill(0);
    order.forEach((cardIndex, waveIndex) => {
      delays[cardIndex] = waveIndex * OPTLAB_FLIP_STAGGER_MS;
    });
    return delays.map((delay) => ({
      delay,
      duration: OPTLAB_FLIP_DURATION_MS,
    }));
  }

  const OPTLAB_MODE_WIPE_CORNERS = ["bl", "tr", "br", "tl"];
  const OPTLAB_MODE_WIPE_EASE = "cubic-bezier(0.77, 0, 0.175, 1)";

  function optLabReadModeTokens(page, pageMode) {
    const probe = document.createElement("div");
    probe.className = `brain-page brain-page--grid brain-page--mode-${pageMode}`;
    probe.setAttribute("aria-hidden", "true");
    Object.assign(probe.style, {
      position: "absolute",
      width: "0",
      height: "0",
      overflow: "hidden",
      visibility: "hidden",
      pointerEvents: "none",
    });
    page.appendChild(probe);
    const style = getComputedStyle(probe);
    const tokens = {
      bg: style.getPropertyValue("--optlab-mode-bg").trim(),
      ring: style.getPropertyValue("--optlab-mode-ring").trim(),
    };
    probe.remove();
    return tokens;
  }

  function optLabApplyModeClasses(page, pageMode) {
    page.classList.toggle("brain-page--mode-enhance", pageMode === "enhance");
    page.classList.toggle("brain-page--mode-generate", pageMode === "generate");
    page.classList.toggle("brain-page--mode-focus", pageMode === "focus");
  }

  function optLabRandomModeWipeCorner() {
    return OPTLAB_MODE_WIPE_CORNERS[Math.floor(Math.random() * OPTLAB_MODE_WIPE_CORNERS.length)];
  }

  function optLabClearModeWipeCorner(wipe) {
    if (!wipe) return;
    OPTLAB_MODE_WIPE_CORNERS.forEach((corner) => {
      wipe.classList.remove(`optlab-mode-bg-wipe--from-${corner}`);
    });
  }

  function optLabBindGridTools() {
    if (optLabIsFocusMode()) {
      return { getDragTechniqueId: () => null, setDragTechniqueId: () => {} };
    }
    const DRAG_THRESHOLD = 8;
    const pointerStart = new WeakMap();
    let dragTechniqueId = null;

    document.querySelectorAll("[data-optlab-grid-tool]").forEach((el) => {
      el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        pointerStart.set(el, { x: e.clientX, y: e.clientY, id: el.dataset.optlabGridTool });
      });
      el.addEventListener("pointerup", (e) => {
        const start = pointerStart.get(el);
        pointerStart.delete(el);
        if (!start) return;
        const dx = Math.abs(e.clientX - start.x);
        const dy = Math.abs(e.clientY - start.y);
        if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
          state.optLabInspectToolId = start.id;
          render();
        }
      });
      el.addEventListener("dragstart", (e) => {
        const id = el.dataset.optlabGridTool;
        if (!id) return;
        const t = optLabToolMeta(id);
        dragTechniqueId = id;
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "copy";
        el.classList.add("optlab-grid-tool--dragging");
        document.body.classList.add("optlab-grid-drag-active");
        const ghost = optLabCreateDragGhost(el, t?.name);
        e.dataTransfer.setDragImage(ghost, Math.round(ghost.offsetWidth / 2), Math.round(ghost.offsetHeight / 2));
        requestAnimationFrame(() => ghost.remove());
      });
      el.addEventListener("dragend", () => {
        dragTechniqueId = null;
        optLabClearGridDrag();
      });
    });

    return { getDragTechniqueId: () => dragTechniqueId, setDragTechniqueId: (id) => { dragTechniqueId = id; } };
  }

  function optLabSettleModeWipe(wipe, page, { animate = true } = {}) {
    if (!wipe) {
      page?.classList.remove("brain-page--mode-transitioning");
      return;
    }

    const settle = () => {
      page?.classList.remove("brain-page--mode-transitioning");
      wipe.classList.remove("optlab-mode-bg-wipe--active", "optlab-mode-bg-wipe--settling");
      optLabClearModeWipeCorner(wipe);
      wipe.style.removeProperty("opacity");
      wipe.style.removeProperty("transition");
      wipe.style.removeProperty("clip-path");
      wipe.style.removeProperty("--optlab-wipe-from");
      wipe.style.removeProperty("--optlab-wipe-to");
    };

    if (!animate || prefersReducedMotion()) {
      settle();
      return;
    }

    wipe.classList.add("optlab-mode-bg-wipe--settling");
    wipe.style.transition = `opacity 420ms ${OPTLAB_MODE_WIPE_EASE}`;
    requestAnimationFrame(() => {
      wipe.style.opacity = "0";
    });

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      settle();
    };

    wipe.addEventListener(
      "transitionend",
      (e) => {
        if (e.propertyName === "opacity") finish();
      },
      { once: true }
    );
    window.setTimeout(finish, 480);
  }

  function optLabSetModeBackground(nextMode) {
    const page = document.querySelector(".brain-page--grid");
    if (!page) return;

    const wipe = page.querySelector(".optlab-mode-bg-wipe");
    const fromPageMode = optLabPageModeFromDom(page);
    const toPageMode = optLabToPageMode(nextMode);
    const fromTokens = optLabReadModeTokens(page, fromPageMode);
    const toTokens = optLabReadModeTokens(page, toPageMode);

    if (!wipe || prefersReducedMotion()) {
      optLabApplyModeClasses(page, toPageMode);
      optLabSettleModeWipe(wipe, page, { animate: false });
      return;
    }

    page.classList.add("brain-page--mode-transitioning");
    optLabApplyModeClasses(page, toPageMode);

    const corner = optLabRandomModeWipeCorner();
    wipe.style.opacity = "1";
    wipe.style.removeProperty("transition");
    wipe.style.setProperty("--optlab-wipe-from", fromTokens.ring);
    wipe.style.setProperty("--optlab-wipe-to", toTokens.ring);
    wipe.classList.remove("optlab-mode-bg-wipe--active", "optlab-mode-bg-wipe--settling");
    optLabClearModeWipeCorner(wipe);
    void wipe.offsetWidth;
    wipe.classList.add("optlab-mode-bg-wipe--active", `optlab-mode-bg-wipe--from-${corner}`);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      optLabSettleModeWipe(wipe, page, { animate: true });
    };

    wipe.addEventListener(
      "animationend",
      (e) => {
        if (e.target !== wipe) return;
        if (String(e.animationName || "").startsWith("optlab-mode-bg-wipe-")) finish();
      },
      { once: true }
    );
    window.setTimeout(finish, 2100);
  }

  function optLabGridToolCardsWithSlots(frame) {
    if (!frame) return [];
    const cards = [];
    frame.querySelectorAll(".optlab-grid-top-cell .optlab-grid-tool-turn").forEach((el, i) => {
      cards.push({ el, slot: i });
    });
    const left = frame.querySelector(".optlab-grid-flank--left .optlab-grid-flank-tools");
    left?.querySelectorAll(".optlab-grid-tool-turn").forEach((el, i) => {
      cards.push({ el, slot: 6 + i });
    });
    const right = frame.querySelector(".optlab-grid-flank--right .optlab-grid-flank-tools");
    right?.querySelectorAll(".optlab-grid-tool-turn").forEach((el, i) => {
      cards.push({ el, slot: 12 + i });
    });
    return cards;
  }

  function optLabMountToolCard(el, tool, slot) {
    const html = tool ? optLabGridToolCard(tool, slot) : optLabGridPlaceholderCard(slot);
    const wrap = document.createElement("div");
    wrap.innerHTML = html.trim();
    const fresh = wrap.firstElementChild;
    const frontFace = el.closest(".optlab-grid-tool-face--front");
    if (frontFace && el.classList.contains("optlab-grid-tool")) {
      el.replaceWith(fresh);
      return fresh;
    }
    const turn = el.closest(".optlab-grid-tool-turn");
    if (turn && el.classList.contains("optlab-grid-tool")) {
      let face = turn.querySelector(".optlab-grid-tool-face--front");
      if (!face) {
        face = document.createElement("div");
        face.className = "optlab-grid-tool-face optlab-grid-tool-face--front";
        turn.replaceChildren(face);
        const back = document.createElement("div");
        back.className = "optlab-grid-tool-face optlab-grid-tool-face--back";
        back.setAttribute("aria-hidden", "true");
        turn.appendChild(back);
      }
      const existing = face.querySelector(".optlab-grid-tool");
      if (existing) existing.replaceWith(fresh);
      else face.appendChild(fresh);
      return fresh;
    }
    const slotEl = el.closest(".optlab-grid-tool-slot");
    if (slotEl) {
      slotEl.innerHTML = optLabWrapToolSlot(html);
      return slotEl.querySelector(".optlab-grid-tool");
    }
    const shell = document.createElement("div");
    shell.innerHTML = optLabWrapToolSlot(html);
    el.replaceWith(shell.firstElementChild);
    return shell.querySelector(".optlab-grid-tool");
  }

  function optLabFinishFlipTurn(turn) {
    const frontFace = turn.querySelector(".optlab-grid-tool-face--front");
    const backFace = turn.querySelector(".optlab-grid-tool-face--back");
    const anims = typeof turn.getAnimations === "function" ? turn.getAnimations() : [];

    anims.forEach((anim) => {
      try {
        anim.commitStyles?.();
      } catch (_) {
        /* commitStyles unsupported in older browsers */
      }
    });

    if (frontFace && backFace) {
      frontFace.innerHTML = backFace.innerHTML;
      backFace.innerHTML = "";
      backFace.setAttribute("aria-hidden", "true");
    }

    anims.forEach((anim) => anim.cancel());
    delete turn._optlabFlipAnim;

    turn.classList.remove("optlab-grid-tool-turn--flipping");
    turn.style.transform = "rotateY(0deg)";
    void turn.offsetWidth;
    turn.style.removeProperty("transform");
    turn.style.removeProperty("transition-property");
    turn.style.removeProperty("transition-duration");
    turn.style.removeProperty("transition-delay");
    turn.style.removeProperty("transition-timing-function");
    turn.style.removeProperty("will-change");
  }

  function optLabFlipOneCard(turn, tool, slot, timing, onDone) {
    const frontFace = turn.querySelector(".optlab-grid-tool-face--front");
    const backFace = turn.querySelector(".optlab-grid-tool-face--back");
    if (!frontFace || !backFace) {
      onDone();
      return;
    }

    const html = tool ? optLabGridToolCard(tool, slot) : optLabGridPlaceholderCard(slot);
    backFace.innerHTML = html;
    backFace.setAttribute("aria-hidden", "false");
    turn.classList.add("optlab-grid-tool-turn--flipping");
    turn.style.willChange = "transform";

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      optLabFinishFlipTurn(turn);
      onDone();
    };

    if (typeof turn.animate === "function") {
      const anim = turn.animate(
        [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }],
        {
          duration: timing.duration,
          delay: timing.delay,
          easing: OPTLAB_FLIP_EASE,
          fill: "forwards",
        }
      );
      turn._optlabFlipAnim = anim;
      anim.finished.then(finish).catch(finish);
      window.setTimeout(finish, timing.delay + timing.duration + 80);
      return;
    }

    turn.style.transitionProperty = "transform";
    turn.style.transitionDuration = `${timing.duration}ms`;
    turn.style.transitionDelay = `${timing.delay}ms`;
    turn.style.transitionTimingFunction = OPTLAB_FLIP_EASE;
    requestAnimationFrame(() => {
      turn.style.transform = "rotateY(180deg)";
    });
    const onEnd = (e) => {
      if (e.propertyName !== "transform") return;
      turn.removeEventListener("transitionend", onEnd);
      finish();
    };
    turn.addEventListener("transitionend", onEnd);
    window.setTimeout(() => {
      turn.removeEventListener("transitionend", onEnd);
      finish();
    }, timing.delay + timing.duration + 80);
  }

  function updateOptLabModeToggle(wrap, mode) {
    if (!wrap) return;
    wrap.classList.remove("optlab-mode-magic--enhance", "optlab-mode-magic--ideas", "optlab-mode-magic--focus");
    const active = mode === "ideas" ? "ideas" : mode === "focus" ? "focus" : "enhance";
    wrap.classList.add(`optlab-mode-magic--${active}`);
    wrap.querySelectorAll("[data-optlab-mode-set]").forEach((btn) => {
      const segment = btn.getAttribute("data-optlab-mode-set");
      btn.setAttribute("aria-pressed", segment === mode ? "true" : "false");
    });
    const sr = wrap.querySelector(":scope > .sr-only");
    if (sr) {
      sr.textContent =
        mode === "ideas" ? "Generate mode active" : mode === "focus" ? "Focus mode active" : "Enhance mode active";
    }
  }

  function optLabFocusWritingField() {
    requestAnimationFrame(() => {
      const field =
        document.getElementById("optlab-article-edit-body") ||
        document.getElementById("optlab-draft-text");
      field?.focus({ preventScroll: true });
    });
  }

  function optLabAnimateSpineFlip(beforeRect, onDone) {
    const frame = document.querySelector(".optlab-grid-frame");
    const spine = frame?.querySelector(".optlab-grid-spine--placed");
    if (!spine || !beforeRect) {
      onDone();
      return;
    }
    const afterRect = spine.getBoundingClientRect();
    if (!afterRect.width || !afterRect.height) {
      onDone();
      return;
    }
    const dx = beforeRect.left - afterRect.left;
    const dy = beforeRect.top - afterRect.top;
    const sx = beforeRect.width / afterRect.width;
    const sy = beforeRect.height / afterRect.height;
    spine.classList.add("optlab-grid-spine--expanding");
    spine.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    spine.style.transformOrigin = "top left";
    requestAnimationFrame(() => {
      spine.style.transition = `transform 420ms var(--ease-out-quart)`;
      spine.style.transform = "none";
    });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      spine.classList.remove("optlab-grid-spine--expanding");
      spine.style.removeProperty("transform");
      spine.style.removeProperty("transform-origin");
      spine.style.removeProperty("transition");
      onDone();
    };
    spine.addEventListener(
      "transitionend",
      (e) => {
        if (e.propertyName === "transform") finish();
      },
      { once: true }
    );
    window.setTimeout(finish, 480);
  }

  function runOptLabEnhanceGenerateFlip(nextMode, wrap, finish) {
    const isIdeas = nextMode === "ideas";
    updateOptLabModeToggle(wrap, nextMode);
    optLabSetModeBackground(nextMode);

    const frame = document.querySelector(".optlab-grid-frame");
    if (!frame || prefersReducedMotion()) {
      state.optLabMode = nextMode;
      state.brainCategory = "all";
      state.optLabInspectToolId = null;
      render();
      finish();
      return;
    }

    const cards = optLabGridToolCardsWithSlots(frame);
    const nextTools = optLabToolsBySlot(nextMode);
    const timings = optLabPrepareFlipTimings(cards.length);

    state.optLabMode = nextMode;
    state.brainCategory = "all";
    state.optLabInspectToolId = null;

    frame.classList.add("optlab-grid-frame--flipping");
    let remaining = cards.length;
    if (!remaining) {
      render();
      finish();
      return;
    }

    cards.forEach(({ el, slot }, i) => {
      optLabFlipOneCard(el, nextTools[slot], slot, timings[i], () => {
        remaining -= 1;
        if (remaining === 0) {
          frame.classList.remove("optlab-grid-frame--flipping");
          render();
          optLabBindGridTools();
          finish();
        }
      });
    });
  }

  function runOptLabFocusTransition(nextMode, wrap, finish) {
    const frame = document.querySelector(".optlab-grid-frame");
    const spine = frame?.querySelector(".optlab-grid-spine--placed");
    const beforeRect = spine?.getBoundingClientRect();

    updateOptLabModeToggle(wrap, nextMode);
    optLabSetModeBackground(nextMode);
    state.optLabMode = nextMode;
    state.brainCategory = "all";
    state.optLabInspectToolId = null;
    render();

    if (!beforeRect || prefersReducedMotion()) {
      finish();
      if (nextMode === "focus") optLabFocusWritingField();
      return;
    }

    optLabAnimateSpineFlip(beforeRect, () => {
      finish();
      if (nextMode === "focus") optLabFocusWritingField();
    });
  }

  function runOptLabModeChange(nextMode, triggerEl) {
    if (!["enhance", "ideas", "focus"].includes(nextMode)) return;
    if (state.optLabMode === nextMode) return;

    const wrap = triggerEl?.closest?.(".optlab-mode-magic");
    if (wrap?.dataset.optlabModeAnimating === "1") return;
    if (wrap) wrap.dataset.optlabModeAnimating = "1";

    if (nextMode === "focus" && state.optLabMode !== "focus") {
      state.optLabLastToolMode = state.optLabMode === "ideas" ? "ideas" : "enhance";
    } else if (nextMode !== "focus") {
      state.optLabLastToolMode = nextMode;
    }

    const wasFocus = state.optLabMode === "focus";
    const willFocus = nextMode === "focus";
    const finish = () => {
      if (wrap) delete wrap.dataset.optlabModeAnimating;
    };

    if (wasFocus || willFocus) {
      runOptLabFocusTransition(nextMode, wrap, finish);
      return;
    }

    runOptLabEnhanceGenerateFlip(nextMode, wrap, finish);
  }

  function optLabCreateDragGhost(el, name) {
    const ghost = document.createElement("div");
    ghost.className = "optlab-grid-drag-ghost";
    const mono = el.querySelector(".optlab-grid-tool-icon")?.textContent || "";
    ghost.innerHTML = `<span class="optlab-grid-drag-ghost-icon">${esc(mono)}</span><span class="optlab-grid-drag-ghost-name">${esc(name || "Tool")}</span>`;
    const page = document.querySelector(".brain-page--grid");
    const ring = page ? getComputedStyle(page).getPropertyValue("--optlab-mode-ring").trim() : "";
    if (ring) ghost.style.borderColor = ring;
    document.body.appendChild(ghost);
    return ghost;
  }

  function bindOptLabGrid() {
    const toolDrag = optLabBindGridTools();
    const dragTechniqueId = {
      get: toolDrag.getDragTechniqueId,
      set: toolDrag.setDragTechniqueId,
    };
    let dragSessionKey = null;

    const well = document.querySelector("[data-optlab-grid-well]");
    if (well && !optLabIsFocusMode()) {
      const showDropzone = () => {
        const dropzone = well.querySelector(".optlab-grid-well-dropzone");
        dropzone?.classList.add("is-visible");
        if (dragTechniqueId.get()) optLabUpdateWellDropzone(well, dragTechniqueId.get());
        if (!state.optLabWellDragover) {
          state.optLabWellDragover = true;
          well.classList.add("optlab-grid-well--dragover");
        }
      };
      const hideDropzone = () => {
        state.optLabWellDragover = false;
        well.classList.remove("optlab-grid-well--dragover");
        const dropzone = well.querySelector(".optlab-grid-well-dropzone");
        dropzone?.classList.remove("is-visible", "is-ready", "is-deny");
      };

      well.addEventListener("dragenter", (e) => {
        e.preventDefault();
        showDropzone();
      });
      well.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = state.optLabArticle?.content ? "copy" : "none";
        showDropzone();
      });
      well.addEventListener("dragleave", (e) => {
        if (!well.contains(e.relatedTarget)) hideDropzone();
      });
      well.addEventListener("drop", (e) => {
        e.preventDefault();
        hideDropzone();
        document.body.classList.remove("optlab-grid-drag-active");
        const techniqueId = e.dataTransfer.getData("text/plain") || dragTechniqueId.get();
        dragTechniqueId.set(null);
        document.querySelectorAll(".optlab-grid-tool--dragging").forEach((el) => {
          el.classList.remove("optlab-grid-tool--dragging");
        });
        if (!techniqueId) return;
        const queued = enqueueOptLabGenerate(techniqueId);
        optLabFlashWellDrop(well, queued);
      });
    }

    document.querySelectorAll("[data-optlab-inspect-close]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.optLabInspectToolId = null;
        render();
      });
    });
    const backdrop = document.querySelector(".optlab-grid-inspect-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          state.optLabInspectToolId = null;
          render();
        }
      });
    }
    const panel = document.querySelector("[data-optlab-inspect-panel]");
    if (panel) {
      panel.addEventListener("click", (e) => e.stopPropagation());
    }

    document.querySelectorAll("[data-optlab-desk]").forEach((btn) => {
      const sessionKey = btn.getAttribute("data-optlab-desk");
      btn.addEventListener("click", () => {
        if (btn.dataset.optlabDeskDragging === "1") return;
        const row = (state.optLabSessions || []).find((s) => s.session_key === sessionKey);
        if (row?.archived) {
          openOptLabDeskSession(sessionKey);
          return;
        }
        openOptLabDeskSession(sessionKey);
      });
      btn.addEventListener("dragstart", (e) => {
        if (!btn.hasAttribute("draggable")) return;
        btn.dataset.optlabDeskDragging = "1";
        dragSessionKey = sessionKey;
        optLabSetSessionDragData(e.dataTransfer, sessionKey);
        btn.classList.add("optlab-grid-session--dragging");
      });
      btn.addEventListener("dragend", () => {
        delete btn.dataset.optlabDeskDragging;
        dragSessionKey = null;
        btn.classList.remove("optlab-grid-session--dragging");
        document.querySelector("[data-optlab-archive-rail]")?.classList.remove("optlab-grid-rail--dragover");
        document.querySelector("[data-optlab-desk-rail]")?.classList.remove("optlab-grid-rail--dragover");
      });
    });

    const archiveRail = document.querySelector("[data-optlab-archive-rail]");
    if (archiveRail) {
      archiveRail.addEventListener("dragover", (e) => {
        if (!optLabSessionDragActive(e.dataTransfer, dragSessionKey)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        archiveRail.classList.add("optlab-grid-rail--dragover");
      });
      archiveRail.addEventListener("dragleave", (e) => {
        if (!archiveRail.contains(e.relatedTarget)) {
          archiveRail.classList.remove("optlab-grid-rail--dragover");
        }
      });
      archiveRail.addEventListener("drop", async (e) => {
        e.preventDefault();
        archiveRail.classList.remove("optlab-grid-rail--dragover");
        const sessionKey = optLabReadSessionDragData(e.dataTransfer, dragSessionKey);
        dragSessionKey = null;
        if (sessionKey) await archiveOptLabDeskSession(sessionKey);
      });
    }

    const deskRail = document.querySelector("[data-optlab-desk-rail]");
    if (deskRail) {
      deskRail.addEventListener("dragover", (e) => {
        if (!optLabSessionDragActive(e.dataTransfer, dragSessionKey)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        deskRail.classList.add("optlab-grid-rail--dragover");
      });
      deskRail.addEventListener("dragleave", (e) => {
        if (!deskRail.contains(e.relatedTarget)) {
          deskRail.classList.remove("optlab-grid-rail--dragover");
        }
      });
      deskRail.addEventListener("drop", async (e) => {
        e.preventDefault();
        deskRail.classList.remove("optlab-grid-rail--dragover");
        const sessionKey = optLabReadSessionDragData(e.dataTransfer, dragSessionKey);
        dragSessionKey = null;
        if (sessionKey) await restoreOptLabDeskSession(sessionKey);
      });
    }
  }


  function mainContent() {
    switch (state.panel) {
      case "questions":
      case "gaps":
        return questionsPanel();
      case "skipped":
        return skippedPanel();
      case "filmed":
        return filmedPanel();
      case "written":
        return writtenPanel();
      case "optimized":
        return optimizedPanel();
      case "replied":
        return repliedPanel();
      case "first_page":
      case "archived":
        return firstPagePanel();
      case "show_all":
        return showAllPanel();
      case "run":
        return runPanel();
      case "settings":
      case "discovery":
        return settingsPanel();
      case "optimize_lab":
      case "brain":
        return brainPanel();
      case "optimize_lab_settings":
        return optimizeLabSettingsPanel();
      case "optimize_lab_connections":
        return optimizeLabConnectionsPanel();
      default:
        return questionsPanel();
    }
  }

  function captureFormFocus() {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    const id = el.id;
    if (!id) return null;
    const tag = el.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return null;
    const snap = { id, value: el.value };
    if (typeof el.selectionStart === "number" && typeof el.selectionEnd === "number") {
      snap.selectionStart = el.selectionStart;
      snap.selectionEnd = el.selectionEnd;
    }
    return snap;
  }

  function restoreFormFocus(snap) {
    if (!snap?.id) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(snap.id);
      if (!el) return;
      if (snap.value != null && el.value !== snap.value) el.value = snap.value;
      el.focus({ preventScroll: true });
      if (
        typeof snap.selectionStart === "number" &&
        typeof snap.selectionEnd === "number" &&
        typeof el.setSelectionRange === "function"
      ) {
        try {
          el.setSelectionRange(snap.selectionStart, snap.selectionEnd);
        } catch (_) {
          /* number inputs and similar */
        }
      }
    });
  }

  function settingsFormFocused() {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const tag = el.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return false;
    return Boolean(
      el.closest(".settings-panel, .optlab-settings-panel, .seed-onboard-card"),
    );
  }

  function markSettingsRenderPending() {
    state.settingsRenderPending = true;
  }

  function flushPendingSettingsRender() {
    if (!state.settingsRenderPending) return;
    state.settingsRenderPending = false;
    render();
  }

  function bindSettingsRenderFlush() {
    if (state.settingsBlurBound) return;
    state.settingsBlurBound = true;
    document.addEventListener(
      "focusout",
      () => {
        if (settingsFormFocused()) return;
        flushPendingSettingsRender();
      },
      true,
    );
  }

  function applyRailOptLabTransition() {
    const root = document.querySelector(".variant-a");
    if (!root) return;
    root.classList.toggle("is-optlab-panel", isOptimizeLabPanel());
  }

  function render() {
    const focusSnap = captureFormFocus();
    if (state.seedFinder?.open && !isSettingsPanel()) {
      state.seedFinder = defaultSeedFinderState();
    }
    const railOptLabClass = isOptimizeLabPanel() ? " is-optlab-panel" : "";
    document.getElementById("app").innerHTML = `
      <div class="variant-a${state.railCollapsed ? " is-rail-collapsed" : ""}${railOptLabClass}">
        ${railToggleButton("shell")}
        ${shellBrand()}
        ${topNav()}
        ${sidebar()}
        <div class="main${isWorkflowPanel() ? " panel-workflow" : ""}" data-panel="${state.panel}">
          ${mainContent()}
        </div>
      </div>
      ${seedFinderOverlay()}
      ${topUpOverlay()}`;
    bind();
    bindSettingsRenderFlush();
    applyRailOptLabTransition();
    restoreFormFocus(focusSnap);
    scrollScoutSearchArea();
    if (window.OPLAB_BREWERY_PROTOTYPE?.isActive?.()) {
      window.OPLAB_BREWERY_PROTOTYPE.bindSwitcher?.();
    }
  }

  window.__optlabProtoRerender = render;

  function bind() {
    document.querySelectorAll("[data-export]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const path = btn.dataset.export;
        const filename = btn.dataset.exportFilename || "export.csv";
        btn.disabled = true;
        try {
          await downloadCsvExport(path, filename);
        } catch (err) {
          alert(err.message || "Export failed");
        } finally {
          btn.disabled = false;
        }
      });
    });

    document.querySelectorAll("[data-panel]:not(.main)").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("a.btn-search[href]")) return;
        e.preventDefault();
        navigateToPanel(el.dataset.panel);
      });
    });

    document.querySelectorAll("[data-rail-toggle]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleRailCollapsed();
      });
    });

    if (!state.popstateBound) {
      state.popstateBound = true;
      window.addEventListener("popstate", () => {
        const route = parseRoute();
        state.panel = route.panel;
        state.search = "";
        refreshPanel();
      });
    }

    const search = document.getElementById("search-input");
    if (search) {
      search.addEventListener("input", () => {
        state.search = search.value;
        clearTimeout(state.searchDebounce);
        state.searchDebounce = setTimeout(() => refreshPanel(), 200);
      });
    }

    const questionsSort = document.getElementById("questions-sort");
    if (questionsSort) {
      questionsSort.addEventListener("change", () => {
        state.questionsSort = questionsSort.value;
        refreshPanel();
      });
    }

    const showAllSort = document.getElementById("show-all-sort");
    if (showAllSort) {
      showAllSort.addEventListener("change", () => {
        state.showAllSort = showAllSort.value;
        refreshPanel();
      });
    }

    const hideHowBtn = document.getElementById("hide-how-btn");
    if (hideHowBtn) {
      hideHowBtn.addEventListener("click", () => {
        togglePrefixRootHidden("how");
        render();
      });
    }

    const prefixHideToggle = document.getElementById("prefix-hide-toggle");
    const prefixHideMenu = document.getElementById("prefix-hide-menu");
    if (prefixHideToggle && prefixHideMenu) {
      prefixHideToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        state.prefixHideOpen = !state.prefixHideOpen;
        prefixHideMenu.hidden = !state.prefixHideOpen;
        prefixHideToggle.setAttribute("aria-expanded", state.prefixHideOpen ? "true" : "false");
        prefixHideToggle.classList.toggle("toolbar-filter-btn--open", state.prefixHideOpen);
      });
      prefixHideMenu.addEventListener("click", (e) => e.stopPropagation());
    }

    document.querySelectorAll("[data-hide-prefix-root]").forEach((el) => {
      el.addEventListener("change", () => {
        const root = el.dataset.hidePrefixRoot;
        if (el.checked) {
          if (!isPrefixRootHidden(root)) state.hiddenPrefixRoots.push(root);
        } else {
          state.hiddenPrefixRoots = state.hiddenPrefixRoots.filter((r) => r !== root);
        }
        render();
      });
    });

    if (!state.prefixHideDocBound) {
      state.prefixHideDocBound = true;
      document.addEventListener("click", () => {
        if (!state.prefixHideOpen) return;
        state.prefixHideOpen = false;
        const menu = document.getElementById("prefix-hide-menu");
        const toggle = document.getElementById("prefix-hide-toggle");
        if (menu) menu.hidden = true;
        if (toggle) {
          toggle.setAttribute("aria-expanded", "false");
          toggle.classList.remove("toolbar-filter-btn--open");
        }
      });
    }

    document.querySelectorAll("[data-bulk-action]").forEach((btn) => {
      btn.addEventListener("click", () => bulkApplySearchMatches(btn.dataset.bulkAction, btn));
    });

    document.querySelectorAll("[data-job]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const opts = {};
        if (btn.dataset.seed) opts.seed = btn.dataset.seed;
        if (btn.dataset.prefix) opts.prefix = btn.dataset.prefix;
        startJob(btn.dataset.job, opts);
      });
    });

    const scheduleGlobal = document.getElementById("schedule-global-toggle");
    if (scheduleGlobal) {
      scheduleGlobal.addEventListener("change", async () => {
        await api("/api/schedule", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: scheduleGlobal.checked }),
        });
        await loadSchedule();
        render();
      });
    }

    document.querySelectorAll("[data-sched-enable]").forEach((input) => {
      input.addEventListener("change", async () => {
        const taskId = input.getAttribute("data-sched-enable");
        await api(`/api/schedule/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: input.checked }),
        });
        await loadSchedule();
        render();
      });
    });

    document.querySelectorAll("[data-sched-auto-add]").forEach((input) => {
      input.addEventListener("change", async () => {
        const taskId = input.getAttribute("data-sched-auto-add");
        await api(`/api/schedule/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auto_add_discovered: input.checked }),
        });
        await loadSchedule();
        render();
      });
    });

    document.querySelectorAll("[data-sched-run]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = btn.getAttribute("data-sched-run");
        try {
          await api(`/api/schedule/tasks/${taskId}/run`, { method: "POST" });
          startPolling();
        } catch (e) {
          alert(e.message);
        }
      });
    });

    const quickTest = document.getElementById("quick-test-btn");
    if (quickTest) {
      quickTest.addEventListener("click", () => runQuickTest());
    }

    const restoreSkipped = document.getElementById("restore-skipped");
    if (restoreSkipped) {
      restoreSkipped.addEventListener("click", async () => {
        const r = await api("/api/keywords/restore-skipped", { method: "POST" });
        await loadCounts();
        await loadQuestions();
        alert(`Restored ${r.restored} skipped questions · ${r.gaps ?? r.questions ?? "?"} now in Questions`);
        render();
      });
    }

    const cancel = document.getElementById("cancel-job");
    if (cancel) {
      cancel.addEventListener("click", () => {
        if (state.scoutDemo) {
          stopScoutCrtDemo();
          return;
        }
        api("/api/jobs/cancel", { method: "POST" });
      });
    }

    document.querySelectorAll("[data-scout-crt-demo]").forEach((btn) => {
      btn.addEventListener("click", () => startScoutCrtDemo());
    });

    const pasteBtn = document.getElementById("paste-submit");
    if (pasteBtn) {
      pasteBtn.addEventListener("click", async () => {
        const text = document.getElementById("paste-input").value;
        await api("/api/import/paste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        await loadCounts();
        if (state.panel === "questions" || state.panel === "gaps") await loadQuestions();
        alert("Imported.");
      });
    }

    const seedBtn = document.getElementById("seed-demo");
    if (seedBtn) {
      seedBtn.addEventListener("click", async () => {
        await api("/api/seed-demo", { method: "POST" });
        await loadCounts();
        await loadQuestions();
        alert("Sample keywords loaded.");
      });
    }

    const csvBtn = document.getElementById("csv-submit");
    if (csvBtn) {
      csvBtn.addEventListener("click", async () => {
        const input = document.getElementById("csv-upload");
        if (!input || !input.files || !input.files[0]) {
          alert("Choose a CSV file first.");
          return;
        }
        const fd = new FormData();
        fd.append("file", input.files[0]);
        const r = await fetch("/api/import/upload", { method: "POST", body: fd });
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || r.statusText);
        }
        const result = await r.json();
        await loadCounts();
        if (state.panel === "questions" || state.panel === "gaps") await loadQuestions();
        alert(`Imported ${result.imported} keywords (${result.total} total).`);
        input.value = "";
      });
    }

    document.querySelectorAll("[data-exclude-prefix]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await excludePrefixById(btn.getAttribute("data-exclude-prefix"));
      });
    });

    document.querySelectorAll("[data-restore-prefix]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await restorePrefixById(btn.getAttribute("data-restore-prefix"));
      });
    });

    document.querySelectorAll("[data-toggle-prefix]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-toggle-prefix");
        if (btn.getAttribute("data-prefix-excluded") === "1") {
          await restorePrefixById(id);
        } else {
          await excludePrefixById(id);
        }
      });
    });

    document.querySelectorAll("[data-edit-focus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const root = btn.getAttribute("data-edit-focus");
        syncOpenPrefixRootsFromDom();
        ensurePrefixRootOpen(root);
        state.focusEditRoot = root;
        setPrefixSectionStatus("info", `Select phrases to keep for "${root}", then save focus.`);
        render();
      });
    });

    document.querySelectorAll("[data-cancel-focus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        syncOpenPrefixRootsFromDom();
        state.focusEditRoot = null;
        setPrefixSectionStatus(null, null);
        render();
      });
    });

    document.querySelectorAll("[data-clear-focus]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (state.prefixSectionBusy) return;
        const root = btn.getAttribute("data-clear-focus");
        beginPrefixSectionBusy();
        try {
          await api("/api/prefixes/focus", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ root, phrases: null }),
          });
          state.focusEditRoot = null;
          setPrefixSectionStatus("success", "Searching all phrases in this root again.");
          await loadPrefixes();
        } catch (err) {
          setPrefixSectionStatus("error", err.message || "Could not clear focus. Try again.");
        } finally {
          state.prefixSectionBusy = false;
          render();
        }
      });
    });

    document.querySelectorAll("[data-save-focus]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (state.prefixSectionBusy) return;
        const root = btn.getAttribute("data-save-focus");
        const phrases = Array.from(
          document.querySelectorAll(`input[data-focus-phrase="${root}"]:checked`),
        ).map((el) => el.value);
        if (!phrases.length) {
          setPrefixSectionStatus("error", "Select at least one phrase, then save focus.");
          render();
          return;
        }
        beginPrefixSectionBusy();
        try {
          await api("/api/prefixes/focus", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ root, phrases }),
          });
          state.focusEditRoot = null;
          setPrefixSectionStatus("success", "Focus saved. Search will use the selected phrases only.");
          await loadPrefixes();
        } catch (err) {
          setPrefixSectionStatus("error", err.message || "Could not save focus. Try again.");
        } finally {
          state.prefixSectionBusy = false;
          render();
        }
      });
    });

    document.querySelectorAll(".prefix-root-summary").forEach((summary) => {
      summary.addEventListener("click", (e) => {
        if (state.prefixSectionBusy) return;
        const details = summary.closest(".prefix-root-group");
        const root = details?.getAttribute("data-prefix-root");
        if (!root) return;
        e.preventDefault();
        togglePrefixRootPanel(root);
      });
    });

    document.querySelectorAll(".prefix-root-group[data-prefix-root]").forEach((el) => {
      el.addEventListener("toggle", () => {
        const root = el.getAttribute("data-prefix-root");
        if (!root) return;
        if (el.open) ensurePrefixRootOpen(root);
        else state.openPrefixRoots = state.openPrefixRoots.filter((r) => r !== root);
      });
    });

    const addPrefix = document.getElementById("add-prefix-btn");
    if (addPrefix) {
      addPrefix.addEventListener("click", async () => {
        if (state.prefixSectionBusy) return;
        const input = document.getElementById("new-prefix");
        const text = input?.value || "";
        if (!text.trim()) {
          setPrefixSectionStatus("error", "Type a phrase first, e.g. how come.");
          render();
          input?.focus();
          return;
        }
        beginPrefixSectionBusy();
        try {
          await api("/api/prefixes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (input) input.value = "";
          setPrefixSectionStatus("success", "Phrase added.");
          await loadPrefixes();
        } catch (err) {
          setPrefixSectionStatus("error", err.message || "Could not add phrase. Try again.");
        } finally {
          state.prefixSectionBusy = false;
          render();
        }
      });
    }

    document.querySelectorAll("[data-toggle-settings-section]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.toggleSettingsSection;
        toggleSettingsSection(id);
        const collapsed = isSettingsSectionCollapsed(id);
        const section = btn.closest(".settings-section");
        const body = document.getElementById(`settings-section-${id}`);
        section?.classList.toggle("settings-section--collapsed", collapsed);
        if (body) body.hidden = collapsed;
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      });
    });

    document.querySelectorAll("[data-del-seed]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api(`/api/seed-phrases/${btn.getAttribute("data-del-seed")}`, { method: "DELETE" });
          await loadPrefixes();
          render();
        } catch (err) {
          alert(err.message || "Could not delete seed phrase");
        }
      });
    });

    document.querySelectorAll("[data-harvest-seed]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const phrase = btn.getAttribute("data-harvest-seed");
        await harvestSeedPhrase(phrase);
      });
    });

    document.querySelectorAll("[data-edit-seed]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.editingSeedId = btn.getAttribute("data-edit-seed");
        render();
        const input = document.getElementById(`edit-seed-${state.editingSeedId}`);
        input?.focus();
        input?.select();
      });
    });

    document.querySelectorAll("[data-cancel-seed]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.editingSeedId = null;
        render();
      });
    });

    document.querySelectorAll("[data-save-seed]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-save-seed");
        const input = document.getElementById(`edit-seed-${id}`);
        const text = input?.value?.trim();
        if (!text) return;
        try {
          await api(`/api/seed-phrases/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          state.editingSeedId = null;
          await loadPrefixes();
          render();
        } catch (err) {
          alert(err.message || "Could not save seed phrase");
        }
      });
    });

    const editSeedInput = document.querySelector("#edit-seed-" + state.editingSeedId);
    if (editSeedInput) {
      editSeedInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          document.querySelector(`[data-save-seed="${state.editingSeedId}"]`)?.click();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          state.editingSeedId = null;
          render();
        }
      });
    }

    document.querySelectorAll("[data-go-scout-search]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        state.seedSearchReminder = null;
        state.scrollScoutSearch = true;
        navigateToPanel("run");
      });
    });

    const addSeed = document.getElementById("add-seed-btn");
    if (addSeed) {
      addSeed.addEventListener("click", async () => {
        const text = document.getElementById("new-seed").value.trim();
        if (!text) return;
        try {
          await api("/api/seed-phrases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          document.getElementById("new-seed").value = "";
          expandSettingsSection("seed-phrases");
          state.seedSearchReminder = { text };
          await loadPrefixes();
          render();
        } catch (err) {
          alert(err.message || "Could not add seed phrase");
        }
      });
    }

    const newSeedInput = document.getElementById("new-seed");
    if (newSeedInput) {
      newSeedInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          document.getElementById("add-seed-btn")?.click();
        }
      });
    }

    const harvestNewSeed = document.getElementById("harvest-new-seed-btn");
    if (harvestNewSeed) {
      harvestNewSeed.addEventListener("click", async () => {
        const text = document.getElementById("new-seed")?.value || "";
        await ensureSeedPhraseAndHarvest(text);
      });
    }

    document.querySelectorAll("[data-del-negative]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api(`/api/negatives/${btn.getAttribute("data-del-negative")}`, { method: "DELETE" });
          await loadPrefixes();
          render();
        } catch (err) {
          alert(err.message || "Could not remove negative term");
        }
      });
    });

    const addNegative = document.getElementById("add-negative-btn");
    if (addNegative) {
      addNegative.addEventListener("click", async () => {
        const text = document.getElementById("new-negative").value;
        if (!text.trim()) return;
        try {
          await api("/api/negatives", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          document.getElementById("new-negative").value = "";
          await loadPrefixes();
          render();
        } catch (err) {
          alert(err.message || "Could not add negative term");
        }
      });
    }

    const newNegativeInput = document.getElementById("new-negative");
    if (newNegativeInput) {
      newNegativeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          document.getElementById("add-negative-btn")?.click();
        }
      });
    }

    const saveDisc = document.getElementById("save-discovery");
    if (saveDisc) {
      saveDisc.addEventListener("click", async () => {
        await api("/api/discovery", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            min_global_volume: parseInt(document.getElementById("disc-min-vol").value, 10),
          }),
        });
        await loadPrefixes();
        render();
        alert("Filter rules saved.");
      });
    }

    const hidePresetAny = document.getElementById("hide-preset-any");
    if (hidePresetAny) {
      hidePresetAny.addEventListener("click", () => setHideFromQuestionsForm(defaultHideFromQuestions()));
    }
    const hidePresetNone = document.getElementById("hide-preset-none");
    if (hidePresetNone) {
      hidePresetNone.addEventListener("click", () => setHideFromQuestionsForm([]));
    }
    const saveWorkflow = document.getElementById("save-workflow-settings");
    if (saveWorkflow) {
      saveWorkflow.addEventListener("click", async () => {
        const data = await api("/api/workflow/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hide_from_questions: readHideFromQuestionsForm() }),
        });
        state.workflowSettings = data.settings;
        await loadCounts();
        if (state.panel === "questions" || state.panel === "gaps") await loadQuestions();
        render();
        alert("Questions queue rules saved.");
      });
    }

    const addRankTarget = document.getElementById("add-rank-target-btn");
    if (addRankTarget) {
      addRankTarget.addEventListener("click", () => {
        const val = document.getElementById("new-rank-target")?.value?.trim() || "";
        if (!val) {
          alert("Enter a company name, website domain, or YouTube channel.");
          return;
        }
        if (!state.rankSettings) state.rankSettings = { rank_matches: [] };
        const list = [...(state.rankSettings.rank_matches || [])];
        if (list.some((item) => item.toLowerCase() === val.toLowerCase())) {
          alert("That brand is already in the list.");
          return;
        }
        list.push(val);
        state.rankSettings.rank_matches = list;
        render();
      });
    }

    document.querySelectorAll("[data-remove-rank-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.dataset.removeRankTarget);
        if (!state.rankSettings?.rank_matches || Number.isNaN(index)) return;
        const list = [...state.rankSettings.rank_matches];
        list.splice(index, 1);
        state.rankSettings.rank_matches = list;
        render();
      });
    });

    const saveRank = document.getElementById("save-rank-settings");
    if (saveRank) {
      saveRank.addEventListener("click", async () => {
        const rankMatches = [...(state.rankSettings?.rank_matches || [])];
        if (!rankMatches.length) {
          alert("Add at least one company name, website domain, or YouTube channel.");
          return;
        }
        const data = await api("/api/rank/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rank_matches: rankMatches }),
        });
        state.rankSettings = data.settings;
        state.rankMatchSummary = data.match_summary;
        render();
        alert("Rank settings saved. Run Scan all rankings to refresh page 1 checks.");
      });
    }

    const saveLocation = document.getElementById("save-location-settings");
    if (saveLocation) {
      saveLocation.addEventListener("click", async () => {
        const ls = state.locationSettings || {};
        const enabled = Boolean(document.getElementById("loc-secondary-enabled")?.checked);
        const kind =
          document.querySelector('input[name="loc-secondary-kind"]:checked')?.value ||
          ls.secondary_kind ||
          "country";
        if (enabled && !ls.secondary_location_code) {
          alert("Pick a country or city for your second volume column, or turn the option off.");
          return;
        }
        const data = await api("/api/location/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secondary_enabled: enabled,
            secondary_kind: enabled ? kind : null,
            secondary_location_code: enabled ? ls.secondary_location_code : null,
            secondary_location_name: enabled ? ls.secondary_location_name : null,
            secondary_label: enabled ? ls.secondary_label : null,
            secondary_location_type: enabled ? ls.secondary_location_type : null,
          }),
        });
        state.locationSettings = data.settings;
        state.volumeColumns = data.volume_columns;
        state.volumeTargetCount = data.volume_target_count;
        await loadCreditEstimates();
        if (state.panel === "questions" || state.panel === "gaps") await loadQuestions();
        render();
        alert("Search volume settings saved.");
      });
    }

    const secondaryEnabled = document.getElementById("loc-secondary-enabled");
    if (secondaryEnabled) {
      secondaryEnabled.addEventListener("change", () => {
        if (!state.locationSettings) state.locationSettings = {};
        state.locationSettings.secondary_enabled = secondaryEnabled.checked;
        if (!secondaryEnabled.checked) clearSecondaryLocation();
        else render();
      });
    }

    document.querySelectorAll('input[name="loc-secondary-kind"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!state.locationSettings) state.locationSettings = {};
        state.locationSettings.secondary_kind = radio.value;
        clearSecondaryLocation();
      });
    });

    const clearSecondaryBtn = document.getElementById("loc-clear-secondary");
    if (clearSecondaryBtn) {
      clearSecondaryBtn.addEventListener("click", clearSecondaryLocation);
    }

    const countrySelect = document.getElementById("loc-country-select");
    if (countrySelect) {
      countrySelect.addEventListener("change", () => {
        const code = parseInt(countrySelect.value, 10);
        if (!code) {
          clearSecondaryLocation();
          return;
        }
        const loc = (state.countriesList || []).find((c) => Number(c.location_code) === code);
        if (loc) applySecondaryLocation(loc);
      });
    }

    const cityCountrySelect = document.getElementById("loc-city-country");
    if (cityCountrySelect) {
      cityCountrySelect.addEventListener("change", () => {
        state.citySearchCountryIso = cityCountrySelect.value || "US";
        const resultsEl = document.querySelector('[data-loc-results="secondary"]');
        const input = document.getElementById("loc-city-search");
        if (resultsEl) {
          resultsEl.hidden = true;
          resultsEl.innerHTML = "";
        }
        if (input) input.focus();
      });
    }

    document.querySelectorAll(".location-search-input").forEach((input) => {
      input.addEventListener("input", () => {
        const target = input.dataset.locTarget;
        const resultsEl = document.querySelector(`[data-loc-results="${target}"]`);
        const q = input.value.trim();
        if (!q || q.length < 2) {
          if (resultsEl) {
            resultsEl.hidden = true;
            resultsEl.innerHTML = "";
          }
          return;
        }
        clearTimeout(state.locationSearchTimer);
        state.locationSearchTimer = setTimeout(async () => {
          try {
            const types = input.dataset.locTypes || "";
            const countryIso =
              document.getElementById("loc-city-country")?.value ||
              state.citySearchCountryIso ||
              "US";
            const params = new URLSearchParams({ q, limit: "50", country: countryIso });
            if (types) params.set("types", types);
            const data = await api(`/api/locations/search?${params}`);
            if (!resultsEl) return;
            state.locationSearchResults = state.locationSearchResults || {};
            state.locationSearchResults[target] = data.results || [];
            const items = (data.results || [])
              .map(
                (loc, idx) =>
                  `<button type="button" class="location-search-hit" data-pick-loc="${target}" data-loc-idx="${idx}">${esc(loc.location_name)} <span class="mono">${esc(loc.location_type || "")}</span></button>`
              )
              .join("");
            const truncatedHint =
              data.truncated && data.total_matches
                ? `<p class="disc-hint location-search-more">Showing ${data.results.length} of ${data.total_matches} matches. Type more of the city name to narrow.</p>`
                : "";
            resultsEl.innerHTML =
              (items || `<p class="disc-hint">No matches.</p>`) + truncatedHint;
            resultsEl.hidden = !items && !truncatedHint;
            resultsEl.querySelectorAll("[data-pick-loc]").forEach((hit) => {
              hit.addEventListener("click", () => {
                const list = state.locationSearchResults[hit.dataset.pickLoc] || [];
                const loc = list[parseInt(hit.dataset.locIdx, 10)];
                if (!loc) return;
                applySecondaryLocation(loc);
                input.value = "";
                resultsEl.hidden = true;
                resultsEl.innerHTML = "";
              });
            });
          } catch (e) {
            if (resultsEl) {
              resultsEl.hidden = false;
              resultsEl.innerHTML = `<p class="disc-hint">${esc(e.message)}</p>`;
            }
          }
        }, 280);
      });
    });

    bindBrainPanel();
    bindOptLabSettingsPanel();
    bindSeedFinder();
    bindTopUp();

    document.querySelectorAll("[data-open-topup]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openTopUp();
      });
    });

    bindScoutCrtFullscreen();
    syncScoutCrtFullscreenAfterRender();
    const scoutCrtFsBtn = document.getElementById("scout-crt-fs-toggle");
    if (scoutCrtFsBtn) {
      scoutCrtFsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleScoutCrtFullscreen();
      });
    }

    if (
      state.panel === "run" &&
      state.scoutScene.crtPhase === "on" &&
      state.jobRunning &&
      document.querySelector(".scout-hero-dino-wrap")
    ) {
      if (state.scoutTownTimer) syncScoutTownDom();
      else startScoutTownPatrol();
    }
  }

  async function setManualRank(keyword, ranks, { skipRefresh = false } = {}) {
    await api(`/api/keywords/${encodeURIComponent(keyword)}/rank`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ranks }),
    });
    if (!skipRefresh) await refreshPanel();
  }

  async function setStatus(keyword, action, { skipRefresh = false } = {}) {
    const removeAction = REMOVE_ACTION_MAP[action];
    if (removeAction) {
      await api(
        `/api/keywords/${encodeURIComponent(keyword)}/status?action=${encodeURIComponent(removeAction)}`,
        { method: "DELETE" }
      );
    } else {
      await api(`/api/keywords/${encodeURIComponent(keyword)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    }
    if (!skipRefresh) await refreshPanel();
  }

  async function setSocialPlatforms(keyword, platforms) {
    await api(`/api/keywords/${encodeURIComponent(keyword)}/social`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platforms }),
    });
  }

  function getSearchMatchRows() {
    if (!state.search.trim()) return [];
    if (state.panel === "questions" || state.panel === "gaps") {
      return visibleQuestions(state.questions);
    }
    if (state.panel === "show_all") {
      return state.showAll || [];
    }
    return [];
  }

  const BULK_ACTION_CONFIRM = {
    written: "written",
    optimized: "optimized",
    filmed: "filmed",
    skip: "skipped",
  };

  async function bulkApplySearchMatches(action, anchorBtn) {
    const rows = getSearchMatchRows();
    const count = rows.length;
    if (!count) return;

    if (action === "reply") {
      showBulkReplyPopover(anchorBtn, rows.map((r) => r.keyword));
      return;
    }

    if (action === "delete") {
      const ok = confirm(
        `Permanently delete ${count} question${count === 1 ? "" : "s"}? This removes them from the database and cannot be undone.`
      );
      if (!ok) return;
      await api("/api/keywords/delete-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: rows.map((r) => r.keyword) }),
      });
      await refreshPanel();
      return;
    }

    const label = BULK_ACTION_CONFIRM[action] || action;
    const message =
      action === "skip"
        ? `Skip ${count} question${count === 1 ? "" : "s"}?`
        : `Mark ${count} question${count === 1 ? "" : "s"} as ${label}?`;
    if (!confirm(message)) return;

    await api("/api/keywords/action-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        keywords: rows.map((r) => r.keyword),
      }),
    });
    const badge = action === "skip" ? "skip" : WF_ACTION_VARIANT[action];
    if (badge) await pulseNavBadge(badge);
    await refreshPanel();
  }

  async function loadQuestions() {
    const params = new URLSearchParams({ sort: state.questionsSort || "volume" });
    if (state.search) params.set("search", state.search);
    const data = await api(`/api/questions?${params}`);
    state.questions = data.rows;
    state.questionsCount = data.count;
  }

  async function loadGaps() {
    return loadQuestions();
  }

  async function loadFirstPage() {
    const q = state.search ? `?search=${encodeURIComponent(state.search)}` : "";
    const data = await api(`/api/first-page${q}`);
    state.firstPage = data.rows;
    state.firstPageCount = data.count;
  }

  async function loadArchived() {
    return loadFirstPage();
  }

  async function loadSkipped() {
    const params = new URLSearchParams({ sort: state.questionsSort || "volume" });
    if (state.search) params.set("search", state.search);
    const data = await api(`/api/skipped?${params}`);
    state.skipped = data.rows;
    state.skippedCount = data.count;
  }

  async function loadFilmed() {
    const q = state.search ? `?search=${encodeURIComponent(state.search)}` : "";
    const data = await api(`/api/filmed${q}`);
    state.filmed = data.rows;
    state.filmedCount = data.count;
  }

  async function loadWritten() {
    const q = state.search ? `?search=${encodeURIComponent(state.search)}` : "";
    const data = await api(`/api/written${q}`);
    state.written = data.rows;
    state.writtenCount = data.count;
  }

  async function loadOptimized() {
    const q = state.search ? `?search=${encodeURIComponent(state.search)}` : "";
    const data = await api(`/api/optimized${q}`);
    state.optimized = data.rows;
    state.optimizedCount = data.count;
  }

  async function loadReplied() {
    const q = state.search ? `?search=${encodeURIComponent(state.search)}` : "";
    const data = await api(`/api/replied${q}`);
    state.replied = data.rows;
    state.repliedCount = data.count;
  }

  function sortShowAllRows(rows, sort) {
    const list = rows.slice();
    if (sort === "keyword") {
      list.sort((a, b) => a.keyword.localeCompare(b.keyword));
    } else if (sort === "section") {
      const order = { questions: 0, skipped: 1, filmed: 2, first_page: 3 };
      list.sort((a, b) => {
        const sa = order[a.section] ?? 9;
        const sb = order[b.section] ?? 9;
        if (sa !== sb) return sa - sb;
        return (
          (b.global_volume || 0) - (a.global_volume || 0) ||
          a.keyword.localeCompare(b.keyword)
        );
      });
    } else if (sort === "us_volume" || sort === "secondary_volume") {
      list.sort(
        (a, b) => (b.secondary_volume || b.us_volume || 0) - (a.secondary_volume || a.us_volume || 0)
      );
    } else {
      list.sort((a, b) => (b.global_volume || 0) - (a.global_volume || 0));
    }
    return list;
  }

  async function loadShowAllFromParts() {
    const sort = state.showAllSort || "volume";
    const volumeSort = sort === "section" || sort === "keyword" ? "volume" : sort;
    const params = new URLSearchParams({ sort: volumeSort });
    if (state.search) params.set("search", state.search);
    const q = state.search ? `?search=${encodeURIComponent(state.search)}` : "";
    const [questions, skipped, filmed, firstPage] = await Promise.all([
      api(`/api/questions?${params}`),
      api(`/api/skipped?${params}`),
      api(`/api/filmed${q}`),
      api(`/api/first-page${q}`),
    ]);
    const rows = sortShowAllRows(
      [
        ...questions.rows.map((r) => ({ ...r, section: "questions" })),
        ...skipped.rows.map((r) => ({ ...r, section: "skipped" })),
        ...filmed.rows.map((r) => ({ ...r, section: "filmed" })),
        ...firstPage.rows.map((r) => ({ ...r, section: "first_page" })),
      ],
      sort
    );
    state.showAll = rows;
    state.showAllCount = rows.length;
  }

  async function loadShowAll() {
    const params = new URLSearchParams({ sort: state.showAllSort || "volume" });
    if (state.search) params.set("search", state.search);
    try {
      const data = await api(`/api/show-all?${params}`);
      state.showAll = data.rows;
      state.showAllCount = data.count;
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes("Not Found") || msg.includes("404")) {
        await loadShowAllFromParts();
        return;
      }
      throw e;
    }
  }

  async function loadCounts() {
    const questions = await api("/api/questions");
    const skipped = await api("/api/skipped");
    const filmed = await api("/api/filmed");
    const written = await api("/api/written");
    const optimized = await api("/api/optimized");
    const replied = await api("/api/replied");
    const firstPage = await api("/api/first-page");
    state.questionsCount = questions.count;
    state.skippedCount = skipped.count;
    state.filmedCount = filmed.count;
    state.writtenCount = written.count;
    state.optimizedCount = optimized.count;
    state.repliedCount = replied.count;
    state.firstPageCount = firstPage.count;
    state.showAllCount =
      questions.count +
      skipped.count +
      filmed.count +
      written.count +
      optimized.count +
      replied.count +
      firstPage.count;
  }

  async function loadSchedule() {
    state.schedule = await api("/api/schedule");
  }

  async function loadWorkflowSettings() {
    const data = await api("/api/workflow/settings");
    state.workflowSettings = data.settings;
  }

  async function loadOptimizeLabSettings() {
    try {
      const data = await api("/api/optimize-lab/settings");
      state.optLabSettings = data.settings || { articles: [], videos: [], technique_notes: {} };
      if (!state.optLabSettings.technique_notes) state.optLabSettings.technique_notes = {};
    } catch (_) {
      state.optLabSettings = state.optLabSettings || { articles: [], videos: [], technique_notes: {} };
      if (!state.optLabSettings.technique_notes) state.optLabSettings.technique_notes = {};
    }
  }

  async function loadRankSettings() {
    try {
      const data = await api("/api/rank/settings");
      state.rankSettings = data.settings;
      state.rankMatchSummary = data.match_summary;
    } catch (_) {
      state.rankSettings = state.rankSettings || { rank_matches: ["bettersheets"] };
      state.rankMatchSummary = state.rankMatchSummary || null;
    }
  }

  async function loadLocationSettings() {
    try {
      const data = await api("/api/location/settings");
      state.locationSettings = data.settings;
      state.volumeColumns = data.volume_columns;
      state.volumeTargetCount = data.volume_target_count || 1;
    } catch (_) {
      state.locationSettings = state.locationSettings || null;
      state.volumeColumns = state.volumeColumns || null;
    }
    loadCountries();
  }

  async function loadCountries() {
    if (state.countriesList || state.countriesLoading) return;
    state.countriesLoading = true;
    try {
      const data = await api("/api/locations/countries");
      state.countriesList = data.countries || [];
      if (state.panel === "settings") {
        if (settingsFormFocused()) markSettingsRenderPending();
        else render();
      }
    } catch (_) {
      state.countriesList = [];
    } finally {
      state.countriesLoading = false;
    }
  }

  async function loadCreditEstimates() {
    const jobs = [...CREDIT_ESTIMATE_JOB_IDS];
    const ctx = {};
    const pd = state.prefixData;
    if (pd) {
      for (const s of pd.seed_phrases || []) {
        const key = `harvest_seed_phrase:${s.text}`;
        jobs.push(key);
        ctx[key] = { seed_phrase: s.text };
      }
      for (const p of pd.prefixes || []) {
        const text = (p.text || "").trim();
        if (!text) continue;
        const key = `harvest_prefix:${text}`;
        jobs.push(key);
        ctx[key] = { prefix: text };
      }
    }
    try {
      const data = await api("/api/credits/estimate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs, ctx }),
      });
      state.creditEstimates = data.estimates || {};
    } catch (_) {
      state.creditEstimates = {};
    }
  }

  async function loadPrefixes() {
    state.prefixData = await api("/api/prefixes");
    for (const p of state.prefixData.prefixes || []) {
      if (isPrefixExcluded(p)) {
        p.excluded = true;
        p.enabled = false;
      }
    }
    for (const group of state.prefixData.prefix_groups || []) {
      for (const p of group.phrases || []) {
        if (isPrefixExcluded(p)) {
          p.excluded = true;
          p.enabled = false;
        }
      }
    }
    if (!state.prefixData.question_counts) {
      const data = await api("/api/show-all?sort=keyword");
      state.prefixData.question_counts = buildPrefixQuestionCounts(
        data.rows,
        state.prefixData.prefixes,
      );
    }
    if (state.panel === "run") {
      await loadCreditEstimates();
    }
  }

  async function loadJobHistory() {
    const data = await api("/api/jobs/history");
    state.jobHistory = data.runs || [];
  }

  async function loadBudget() {
    state.budget = await api("/api/budget");
  }

  async function pollJob() {
    if (state.scoutDemo) return;
    const data = await api("/api/jobs");
    state.jobRunning = data.running;
    state.job = data.job || null;
    if (state.jobRunning) {
      state.testRunning = ["smoke_test", "verify_apis", "mini_pipeline"].includes(state.job?.id);
      if (settingsFormFocused()) markSettingsRenderPending();
      else render();
      return;
    }
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    if (
      state.job &&
      ["smoke_test", "verify_apis", "mini_pipeline"].includes(state.job.id) &&
      state.job.result?.steps
    ) {
      state.testResults = state.job.result;
    }
    state.testRunning = false;
    await loadBudget();
    await loadCounts();
    await loadQuestions();
    await loadSkipped();
    await loadFilmed();
    await loadWritten();
    await loadOptimized();
    await loadReplied();
    await loadFirstPage();
    if (state.panel === "show_all") await loadShowAll();
    if (state.panel === "run" || state.panel === "settings" || state.panel === "discovery") {
      await loadPrefixes();
    }
    if (state.panel === "run") {
      await loadSchedule();
      await loadJobHistory();
    }
    if (settingsFormFocused()) markSettingsRenderPending();
    else render();
  }

  function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(pollJob, 1200);
    pollJob();
  }

  async function runQuickTest() {
    state.testRunning = true;
    render();
    try {
      const result = await api("/api/test/smoke", { method: "POST" });
      state.testResults = result;
      await loadCounts();
    if (state.panel === "questions" || state.panel === "gaps") await loadQuestions();
    if (state.panel === "skipped") await loadSkipped();
    if (state.panel === "filmed") await loadFilmed();
    if (state.panel === "written") await loadWritten();
    if (state.panel === "optimized") await loadOptimized();
    if (state.panel === "replied") await loadReplied();
    if (state.panel === "first_page" || state.panel === "archived") await loadFirstPage();
    if (state.panel === "show_all") await loadShowAll();
    } catch (e) {
      const msg = String(e.message || e);
      state.testResults = {
        ok: false,
        summary: "Quick test failed. Restart the server (Ctrl+C then ./dev.sh)",
        steps: [{ name: "Error", ok: false, message: msg }],
      };
    }
    state.testRunning = false;
    await loadCounts();
    await loadQuestions();
    await loadSkipped();
    await loadFilmed();
    await loadWritten();
    await loadOptimized();
    await loadReplied();
    await loadFirstPage();
    render();
  }

  async function startJob(jobId, opts = {}) {
    try {
      if (state.panel === "run") {
        if (state.scoutCrtTimer) clearTimeout(state.scoutCrtTimer);
        state.scoutScene = { crtPhase: "powering", jobKey: `pending:${jobId}`, poweredAt: null };
        render();
      }
      const body = { job: jobId };
      if (opts.seed) {
        body.seed = opts.seed;
      } else {
        const seedEl = document.querySelector(`[data-seed-for="${jobId}"]`);
        if (seedEl && seedEl.value.trim()) {
          body.seed = seedEl.value.trim();
        }
      }
      if (opts.prefix) body.prefix = opts.prefix;
      await api("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      startPolling();
    } catch (e) {
      alert(e.message);
    }
  }

  async function refreshPanel() {
    await loadBudget();
    if (state.panel === "questions" || state.panel === "gaps") {
      await loadQuestions();
    } else if (state.panel === "skipped") await loadSkipped();
    else if (state.panel === "filmed") await loadFilmed();
    else if (state.panel === "written") await loadWritten();
    else if (state.panel === "optimized") await loadOptimized();
    else if (state.panel === "replied") await loadReplied();
    else if (state.panel === "first_page" || state.panel === "archived") await loadFirstPage();
    else if (state.panel === "show_all") await loadShowAll();
    else if (state.panel === "run") {
      await loadPrefixes();
      await loadCreditEstimates();
      await loadSchedule();
      await loadJobHistory();
    }
    else if (state.panel === "settings" || state.panel === "discovery") {
      await loadWorkflowSettings();
      await loadRankSettings();
      await loadLocationSettings();
      await loadPrefixes();
    }
    else if (state.panel === "optimize_lab" || state.panel === "brain") {
      await loadOptimizeLabSettings();
      try {
        const health = await api("/api/health");
        state.openaiConfigured = Boolean(health.openai);
      } catch (_) {
        state.openaiConfigured = false;
      }
      await loadOptLabSessions();
    }
    else if (state.panel === "optimize_lab_settings") {
      await loadOptimizeLabSettings();
    }
    else if (state.panel === "optimize_lab_connections") {
      /* preview only */
    }
    render();
  }

  function bindSeedFinderTriggers() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open-seed-finder]");
      if (!btn || !isSettingsPanel()) return;
      e.preventDefault();
      e.stopPropagation();
      openSeedFinder();
    });
  }

  function bindBrainFilterDelegation() {
    if (state.brainFilterBound) return;
    state.brainFilterBound = true;

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".brain-filter-group [data-brain-cat]");
      if (!btn?.closest(".brain-page")) return;
      e.preventDefault();
      e.stopPropagation();
      const cat = btn.getAttribute("data-brain-cat");
      if (!cat || state.brainCategory === cat) return;
      state.brainCategory = cat;
      render();
    });
  }

  function bindWorkflowDelegation() {
    if (state.workflowDelegationBound) return;
    state.workflowDelegationBound = true;

    document.addEventListener("click", (e) => {
      const rankBtn = e.target.closest("[data-rank]");
      if (rankBtn?.closest(".panel-workflow")) {
        handleRankAction(rankBtn).catch((err) => alert(err.message || String(err)));
        return;
      }

      const actionBtn = e.target.closest("[data-action]");
      if (!actionBtn) return;
      if (!actionBtn.closest(".panel-workflow") && !actionBtn.closest(".reply-popover")) return;
      handleWorkflowAction(actionBtn).catch((err) => alert(err.message || String(err)));
    });
  }

  async function init() {
    bindSeedFinderTriggers();
    bindBrainFilterDelegation();
    bindWorkflowDelegation();
    try {
      // Normalize bare / to /questions in the address bar
      if (window.location.pathname === "/" || window.location.pathname === "") {
        history.replaceState({ panel: "questions" }, "", "/questions");
        state.panel = "questions";
      } else {
        const route = parseRoute();
        state.panel = route.panel;
        if (route.redirectFrom) {
          history.replaceState({ panel: "questions" }, "", "/questions");
        }
      }

      render();
      await initFullBoot();
    } catch (e) {
      document.getElementById("app").textContent = "Failed to load: " + e.message;
    }
  }

  window.ansaurRefresh = async function () {
    await loadCounts();
    await refreshPanel();
  };

  init();
})();
