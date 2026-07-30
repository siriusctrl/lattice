(() => {
  "use strict";

  const elements = {
    shell: document.querySelector(".shell"),
    status: document.getElementById("status"),
    workspaceSelect: document.getElementById("workspaceSelect"),
    viewSwitch: document.querySelector(".view-switch"),
    graphPanel: document.querySelector(".graph-panel"),
    graph: document.getElementById("graph"),
    deck: document.getElementById("deck"),
    blank: document.getElementById("blankSurface"),
    explore: document.getElementById("exploreView"),
    article: document.getElementById("articleView"),
    articleTitle: document.getElementById("articleTitle"),
    articleBody: document.getElementById("articleBody"),
    articleSources: document.getElementById("articleSources"),
    composer: document.getElementById("composer"),
    prompt: document.getElementById("prompt"),
    submit: document.getElementById("submitButton"),
    viewButtons: [...document.querySelectorAll("[data-view]")],
  };

  const state = {
    projectDir: null,
    workspaceId: null,
    workspaces: [],
    workspace: null,
    uiState: null,
    activeNodeId: null,
    view: "explore",
    loading: false,
    reloadRequested: false,
    loadGeneration: 0,
    pendingRequest: null,
    lastToolRevision: -1,
  };

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function toolPayload(result) {
    return result?._meta?.widgetData || result?.structuredContent || result || {};
  }

  function workspaceEntries(payload) {
    const entries = payload?.workspaces || payload?.catalog?.workspaces;
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((entry) => entry && typeof entry.id === "string")
      .map((entry) => ({
        id: entry.id,
        title: entry.title || entry.id,
        origin: entry.origin || "blank",
        updatedAt: entry.updatedAt || entry.createdAt || "",
      }));
  }

  function acceptWorkspaceMetadata(payload, { acceptActive = false } = {}) {
    const workspaces = workspaceEntries(payload);
    if (
      workspaces.length ||
      Array.isArray(payload?.workspaces) ||
      Array.isArray(payload?.catalog?.workspaces)
    ) {
      state.workspaces = workspaces;
    }
    const selectedId =
      payload?.workspaceId ||
      (acceptActive && (payload?.activeWorkspaceId || payload?.catalog?.activeWorkspaceId));
    if (typeof selectedId === "string" && selectedId) {
      state.workspaceId = selectedId;
    }
  }

  function renderWorkspaceSelector() {
    const select = elements.workspaceSelect;
    select.replaceChildren();
    const workspaces = [...state.workspaces];
    if (
      state.workspaceId &&
      !workspaces.some((workspace) => workspace.id === state.workspaceId)
    ) {
      workspaces.unshift({ id: state.workspaceId, title: state.workspaceId });
    }
    if (!workspaces.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Workspace";
      select.append(option);
    } else {
      workspaces.forEach((workspace) => {
        const option = document.createElement("option");
        option.value = workspace.id;
        option.textContent = workspace.title;
        select.append(option);
      });
    }
    select.value = state.workspaceId || "";
    select.disabled = state.loading || Boolean(state.pendingRequest) || workspaces.length < 2;
  }

  async function callTool(name, args) {
    const bridge = window.latticeMcp;
    if (!bridge?.callServerTool) throw new Error("Lattice host bridge is not connected.");
    const result = await bridge.callServerTool({ name, arguments: args });
    if (result?.isError) {
      const text = result.content?.find((item) => item.type === "text")?.text;
      throw new Error(text || `${name} failed.`);
    }
    return toolPayload(result);
  }

  async function refreshWorkspaceList() {
    if (!state.projectDir) return null;
    const projectDir = state.projectDir;
    const result = await callTool("list_lattice_workspaces", {
      projectDir,
    });
    if (state.projectDir !== projectDir) return null;
    acceptWorkspaceMetadata(result, { acceptActive: !state.workspaceId });
    renderWorkspaceSelector();
    return result;
  }

  async function loadWorkspace({ announce = true } = {}) {
    if (!state.projectDir) return null;
    if (state.loading) {
      state.loadGeneration += 1;
      state.reloadRequested = true;
      return null;
    }
    const generation = ++state.loadGeneration;
    const projectDir = state.projectDir;
    const workspaceId = state.workspaceId;
    state.loading = true;
    renderWorkspaceSelector();
    if (announce) setStatus("Loading research");
    try {
      const args = {
        projectDir,
      };
      if (workspaceId) args.workspaceId = workspaceId;
      const result = await callTool("get_lattice_workspace", args);
      if (
        generation !== state.loadGeneration ||
        state.projectDir !== projectDir ||
        state.workspaceId !== workspaceId
      ) {
        return null;
      }
      acceptWorkspaceMetadata(result, { acceptActive: true });
      state.workspace = result.workspace || null;
      state.uiState = result.uiState || null;
      const nodeIds = new Set((state.workspace?.nodes || []).map((node) => node.id));
      state.activeNodeId =
        (nodeIds.has(state.uiState?.activeNodeId) && state.uiState.activeNodeId) ||
        (nodeIds.has(state.workspace?.activeNodeId) && state.workspace.activeNodeId) ||
        state.workspace?.rootNodeId ||
        state.workspace?.nodes?.[0]?.id ||
        null;
      state.view = nodeIds.size > 0 ? state.uiState?.view || "explore" : "explore";
      state.lastToolRevision = state.workspace?.revision || 0;
      render();
      setStatus(
        state.workspace?.revision
          ? `Revision ${state.workspace.revision}`
          : state.workspaceId
            ? "Ready"
            : "Create a workspace in Codex",
      );
      return state.lastToolRevision;
    } catch (error) {
      if (
        generation !== state.loadGeneration ||
        state.projectDir !== projectDir ||
        state.workspaceId !== workspaceId
      ) {
        return null;
      }
      setStatus(error.message || String(error));
      throw error;
    } finally {
      state.loading = false;
      renderWorkspaceSelector();
      if (state.reloadRequested) {
        state.reloadRequested = false;
        queueMicrotask(() => void loadWorkspace({ announce: false }).catch(() => undefined));
      }
    }
  }

  async function initializeWorkspace() {
    if (!state.projectDir) return;
    setStatus("Loading research");
    try {
      await refreshWorkspaceList();
      await loadWorkspace({ announce: false });
    } catch (error) {
      setStatus(error.message || String(error));
    }
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value || "");
    return div.innerHTML;
  }

  function escapeAttribute(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function renderGraph() {
    const nodes = state.workspace?.nodes || [];
    elements.graph.innerHTML = nodes
      .map(
        (node) => `
          <button class="graph-node ${node.id === state.activeNodeId ? "active" : ""}"
            type="button" data-node-id="${escapeAttribute(node.id)}" title="${escapeAttribute(node.title)}">
            <span class="graph-dot"></span>
            <span class="graph-label">${escapeHtml(node.shortTitle || node.title)}</span>
          </button>
        `,
      )
      .join("");
    elements.graph.querySelectorAll("[data-node-id]").forEach((button) => {
      button.addEventListener("click", () => focusNode(button.dataset.nodeId));
    });
  }

  function renderTurn(turn) {
    const anchors = (turn.anchors || [])
      .map(
        (anchor) => `
          <button class="anchor" type="button"
            data-anchor-target="${escapeAttribute(anchor.targetNodeId)}"
            title="${escapeAttribute(anchor.hint)}">${escapeHtml(anchor.label)}</button>
        `,
      )
      .join("");
    const sources = (turn.sources || [])
      .map((source) =>
        source.url
          ? `<a class="source" href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>`
          : `<span class="source">${escapeHtml(source.label)} · ${escapeHtml(source.path || "")}</span>`,
      )
      .join("");
    return `
      <section class="turn ${turn.role}">
        <div>${escapeHtml(turn.content)}</div>
        ${anchors ? `<div class="anchors">${anchors}</div>` : ""}
        ${sources ? `<div class="sources">${sources}</div>` : ""}
      </section>
    `;
  }

  function renderDeck() {
    const nodes = state.workspace?.nodes || [];
    const activeIndex = Math.max(0, nodes.findIndex((node) => node.id === state.activeNodeId));
    const visible = nodes.slice(Math.max(0, activeIndex - 2), activeIndex + 1);
    elements.blank.hidden = nodes.length > 0;
    elements.deck.innerHTML = visible
      .map(
        (node) => `
          <article class="card ${node.id === state.activeNodeId ? "active" : ""}" data-card-id="${escapeAttribute(node.id)}">
            <header class="card-header">
              <div class="eyebrow">${escapeHtml(node.year || "Research Card")}</div>
              <h1>${escapeHtml(node.title)}</h1>
              ${node.lead ? `<p class="lead">${escapeHtml(node.lead)}</p>` : ""}
            </header>
            ${(node.turns || []).map(renderTurn).join("")}
          </article>
        `,
      )
      .join("");
    elements.deck.querySelectorAll("[data-anchor-target]").forEach((button) => {
      button.addEventListener("click", () => focusNode(button.dataset.anchorTarget));
    });
  }

  function renderArticle() {
    const article = state.workspace?.article;
    elements.articleTitle.textContent = article?.title || "";
    elements.articleBody.textContent = article?.markdown || "";
    elements.articleSources.innerHTML = (article?.citations || [])
      .map(
        (citation) => `
          <button type="button" data-citation-node="${escapeAttribute(citation.nodeId)}">
            ${escapeHtml(citation.label)}
          </button>
        `,
      )
      .join("");
    elements.articleSources.querySelectorAll("[data-citation-node]").forEach((button) => {
      button.addEventListener("click", () => {
        setView("explore");
        focusNode(button.dataset.citationNode);
      });
    });
  }

  function render() {
    const hasNodes = (state.workspace?.nodes || []).length > 0;
    const articleVisible = hasNodes && state.view === "article";
    elements.shell.classList.toggle("empty-workspace", !hasNodes);
    elements.viewSwitch.hidden = !hasNodes;
    elements.graphPanel.hidden = !hasNodes;
    elements.explore.hidden = articleVisible;
    elements.article.hidden = !articleVisible;
    elements.viewButtons.forEach((button) => {
      button.classList.toggle("selected", button.dataset.view === state.view);
    });
    renderGraph();
    renderDeck();
    renderArticle();
    renderWorkspaceSelector();
    const composerDisabled =
      !state.workspaceId || state.loading || Boolean(state.pendingRequest);
    elements.prompt.disabled = composerDisabled;
    elements.submit.disabled = composerDisabled;
  }

  async function persistUiState() {
    if (!state.projectDir || !state.workspaceId) return;
    const deckNodeIds = state.activeNodeId ? [state.activeNodeId] : [];
    try {
      await callTool("save_lattice_ui_state", {
        projectDir: state.projectDir,
        workspaceId: state.workspaceId,
        uiState: {
          activeNodeId: state.activeNodeId,
          view: state.view,
          deckNodeIds,
        },
      });
    } catch (error) {
      setStatus(error.message || String(error));
    }
  }

  function focusNode(nodeId) {
    if (!(state.workspace?.nodes || []).some((node) => node.id === nodeId)) return;
    state.activeNodeId = nodeId;
    render();
    persistUiState();
  }

  function setView(view) {
    state.view = view;
    render();
    persistUiState();
  }

  function buildAgentPrompt(question, requestId) {
    const activeNode = state.workspace?.nodes?.find((node) => node.id === state.activeNodeId);
    const request = {
      source: "lattice-widget",
      projectDir: state.projectDir,
      workspaceId: state.workspaceId,
      intent: activeNode ? "followup" : "root-research",
      activeNodeId: activeNode?.id || null,
      expectedRevision: state.workspace?.revision || 0,
      requestId,
      question,
    };
    return [
      "Continue this Lattice research request.",
      "Read the exact workspace with get_lattice_workspace using Request.projectDir and Request.workspaceId, do the necessary project or web research, then persist the completed answer with apply_lattice_research_patch using the same workspaceId.",
      "Do not only answer in the Codex transcript. For an existing Card append the user and assistant turns to that node. For an empty workspace add the root node and set rootNodeId and activeNodeId.",
      "Set patch.completeRequestId to Request.requestId only in the same patch that contains the completed assistant answer. Never mark the request complete after a user-only, focus-only, or Article-only update.",
      `Request: ${JSON.stringify(request)}`,
    ].join("\n");
  }

  async function waitForRequest(
    projectDir,
    workspaceId,
    baseRevision,
    requestId,
    timeoutMs = 180000,
  ) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (state.projectDir !== projectDir || state.workspaceId !== workspaceId) {
        throw new Error("The active Lattice workspace changed before the request completed.");
      }
      const revision = await loadWorkspace({ announce: false });
      const requestCompleted =
        (revision ?? state.lastToolRevision) > baseRevision &&
        (state.workspace?.completedRequestIds || []).includes(requestId);
      if (requestCompleted) return;
      setStatus("Waiting for Codex to commit this Card");
      await new Promise((resolve) => setTimeout(resolve, 1250));
    }
    throw new Error(
      "Codex accepted the request but did not commit a Lattice Card in time. Your question is still here so you can retry.",
    );
  }

  async function submitQuestion(event) {
    event.preventDefault();
    const question = elements.prompt.value.trim();
    if (!question || !state.projectDir || !state.workspaceId) return;
    if (state.pendingRequest) return;
    const pending = {
      projectDir: state.projectDir,
      workspaceId: state.workspaceId,
      baseRevision: state.workspace?.revision || 0,
      requestId: `widget-${Date.now()}-${crypto.randomUUID()}`,
      question,
    };
    state.pendingRequest = pending;
    elements.submit.disabled = true;
    elements.prompt.disabled = true;
    renderWorkspaceSelector();
    setStatus("Codex is researching");
    try {
      await window.latticeMcp.sendMessage({
        prompt: buildAgentPrompt(question, pending.requestId),
      });
      setStatus("Waiting for Codex to commit the Card");
      await waitForRequest(
        pending.projectDir,
        pending.workspaceId,
        pending.baseRevision,
        pending.requestId,
      );
      elements.prompt.value = "";
      setStatus(`Revision ${state.lastToolRevision}`);
    } catch (error) {
      setStatus(error.message || String(error));
    } finally {
      state.pendingRequest = null;
      render();
      elements.prompt.focus();
    }
  }

  function acceptHostGlobals(globals) {
    const output = globals?.toolOutput;
    const nextProjectDir = output?.projectDir;
    if (nextProjectDir && nextProjectDir !== state.projectDir) {
      state.loadGeneration += 1;
      state.projectDir = nextProjectDir;
      state.workspaceId = output?.workspaceId || null;
      state.workspaces = [];
      state.workspace = null;
      state.uiState = null;
      state.activeNodeId = null;
      state.lastToolRevision = -1;
      acceptWorkspaceMetadata(output, { acceptActive: true });
      render();
      void initializeWorkspace();
      return;
    }
    const previousWorkspaceId = state.workspaceId;
    acceptWorkspaceMetadata(output);
    renderWorkspaceSelector();
    if (
      output?.workspaceId &&
      output.workspaceId !== previousWorkspaceId &&
      !state.pendingRequest
    ) {
      state.loadGeneration += 1;
      state.workspaceId = output.workspaceId;
      void loadWorkspace({ announce: false }).catch(() => undefined);
      return;
    }
    const revision = output?.workspace?.revision;
    if (
      state.projectDir &&
      Number.isInteger(revision) &&
      revision > state.lastToolRevision
    ) {
      void loadWorkspace({ announce: false }).catch(() => undefined);
    }
  }

  elements.viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  elements.workspaceSelect.addEventListener("change", () => {
    const workspaceId = elements.workspaceSelect.value;
    if (!workspaceId || workspaceId === state.workspaceId || state.pendingRequest) {
      renderWorkspaceSelector();
      return;
    }
    state.loadGeneration += 1;
    state.workspaceId = workspaceId;
    state.workspace = null;
    state.uiState = null;
    state.activeNodeId = null;
    state.lastToolRevision = -1;
    render();
    void loadWorkspace()
      .then((revision) => {
        if (revision !== null) return persistUiState();
        return undefined;
      })
      .catch(() => undefined);
  });
  elements.composer.addEventListener("submit", submitQuestion);
  elements.prompt.addEventListener("input", () => {
    elements.prompt.style.height = "auto";
    elements.prompt.style.height = `${Math.min(112, elements.prompt.scrollHeight)}px`;
  });
  elements.prompt.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.composer.requestSubmit();
    }
  });
  window.addEventListener("openai:set_globals", (event) => {
    acceptHostGlobals(event.detail?.globals);
  });

  acceptHostGlobals(window.openai || {});
  render();
  if (!state.projectDir) setStatus("Waiting for project context");
})();
