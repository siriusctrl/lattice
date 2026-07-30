import {
  open,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const STORAGE_VERSION = 1;
const LATTICE_DIR_NAME = ".lattice";
const CATALOG_FILE_NAME = "workspaces.json";
const WORKSPACES_DIR_NAME = "workspaces";
const WORKSPACE_FILE_NAME = "workspace.json";
const UI_STATE_FILE_NAME = "ui-state.json";
const EVENTS_FILE_NAME = "events.ndjson";
const LOCK_FILE_NAME = ".write.lock";
const LEGACY_WORKSPACE_ID = "legacy";
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const MAX_CATALOG_BYTES = 1024 * 1024;
const MAX_CATALOG_WORKSPACES = 1000;
const MAX_WORKSPACE_BYTES = 4 * 1024 * 1024;
const MAX_UI_STATE_BYTES = 256 * 1024;
const MAX_EVENT_LOG_BYTES = 8 * 1024 * 1024;
const LOCK_TIMEOUT_MS = 5_000;
const STALE_LOCK_MS = 60_000;
const projectWriteQueues = new Map();

export function emptyWorkspace() {
  return {
    version: STORAGE_VERSION,
    revision: 0,
    rootNodeId: null,
    activeNodeId: null,
    nodes: [],
    edges: [],
    article: null,
    completedRequestIds: [],
    updatedAt: null,
  };
}

export function emptyUiState() {
  return {
    version: STORAGE_VERSION,
    activeNodeId: null,
    view: "explore",
    deckNodeIds: [],
    updatedAt: null,
  };
}

function requireNonEmptyString(value, label, maximum = 20000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  if (value.length > maximum) {
    throw new Error(`${label} exceeds the ${maximum} character limit.`);
  }
  return value.trim();
}

function assertId(value, label) {
  const id = requireNonEmptyString(value, label, 128);
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      `${label} must start with an alphanumeric character and contain only letters, numbers, dot, underscore, colon, or hyphen.`,
    );
  }
  return id;
}

function normalizePosition(position) {
  if (position == null) return null;
  const x = Number(position.x);
  const y = Number(position.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("Node position must contain finite x and y values.");
  }
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

function normalizeAnchors(anchors = []) {
  if (!Array.isArray(anchors)) throw new Error("Turn anchors must be an array.");
  return anchors.map((anchor, index) => ({
    label: requireNonEmptyString(anchor?.label, `anchors[${index}].label`, 160),
    targetNodeId: assertId(anchor?.targetNodeId, `anchors[${index}].targetNodeId`),
    hint: typeof anchor?.hint === "string" ? anchor.hint.trim().slice(0, 300) : "",
  }));
}

function normalizeSources(sources = []) {
  if (!Array.isArray(sources)) throw new Error("Turn sources must be an array.");
  return sources.map((source, index) => {
    const normalized = {
      label: requireNonEmptyString(source?.label, `sources[${index}].label`, 300),
    };
    if (source?.url != null) {
      const value = requireNonEmptyString(source.url, `sources[${index}].url`, 4000);
      let url;
      try {
        url = new URL(value);
      } catch {
        throw new Error(`sources[${index}].url must be an absolute http(s) URL.`);
      }
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error(`sources[${index}].url must use http or https.`);
      }
      normalized.url = url.toString();
    }
    if (source?.path != null) {
      normalized.path = requireNonEmptyString(source.path, `sources[${index}].path`, 2000);
    }
    return normalized;
  });
}

function normalizeTurn(turn, label) {
  const role = turn?.role;
  if (!["user", "assistant"].includes(role)) {
    throw new Error(`${label}.role must be user or assistant.`);
  }
  return {
    id: assertId(turn?.id, `${label}.id`),
    role,
    content: requireNonEmptyString(turn?.content, `${label}.content`, 120000),
    anchors: role === "assistant" ? normalizeAnchors(turn?.anchors) : [],
    sources: role === "assistant" ? normalizeSources(turn?.sources) : [],
    createdAt:
      typeof turn?.createdAt === "string" && !Number.isNaN(Date.parse(turn.createdAt))
        ? new Date(turn.createdAt).toISOString()
        : new Date().toISOString(),
  };
}

function normalizeNode(node, label) {
  const turns = Array.isArray(node?.turns)
    ? node.turns.map((turn, index) => normalizeTurn(turn, `${label}.turns[${index}]`))
    : [];
  if (turns.length === 0) throw new Error(`${label}.turns must not be empty.`);
  return {
    id: assertId(node?.id, `${label}.id`),
    title: requireNonEmptyString(node?.title, `${label}.title`, 240),
    shortTitle: requireNonEmptyString(
      node?.shortTitle || node?.title,
      `${label}.shortTitle`,
      80,
    ),
    lead: typeof node?.lead === "string" ? node.lead.trim().slice(0, 1200) : "",
    year: typeof node?.year === "string" ? node.year.trim().slice(0, 80) : "",
    position: normalizePosition(node?.position),
    turns,
    createdAt:
      typeof node?.createdAt === "string" && !Number.isNaN(Date.parse(node.createdAt))
        ? new Date(node.createdAt).toISOString()
        : new Date().toISOString(),
  };
}

function normalizeEdge(edge, label) {
  const kind = edge?.kind || "fork";
  if (!["fork", "synthesis"].includes(kind)) {
    throw new Error(`${label}.kind must be fork or synthesis.`);
  }
  const from = assertId(edge?.from, `${label}.from`);
  const to = assertId(edge?.to, `${label}.to`);
  if (from === to) throw new Error(`${label} cannot connect a node to itself.`);
  return { from, to, kind };
}

function normalizeArticle(article) {
  if (article == null) return null;
  const citations = Array.isArray(article.citations)
    ? article.citations.map((citation, index) => ({
        nodeId: assertId(citation?.nodeId, `article.citations[${index}].nodeId`),
        label: requireNonEmptyString(
          citation?.label,
          `article.citations[${index}].label`,
          300,
        ),
      }))
    : [];
  return {
    title: requireNonEmptyString(article.title, "article.title", 300),
    markdown: requireNonEmptyString(article.markdown, "article.markdown", 240000),
    citations,
  };
}

async function assertOrdinaryDirectory(directory, label) {
  let info;
  try {
    info = await lstat(directory);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (info.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link.`);
  if (!info.isDirectory()) throw new Error(`${label} must be a directory.`);
  return true;
}

async function assertOrdinaryFile(filePath, label) {
  try {
    const info = await lstat(filePath);
    if (info.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link.`);
    if (!info.isFile()) throw new Error(`${label} must be a regular file.`);
    if (info.nlink !== 1) throw new Error(`${label} must not be a hard link.`);
    return info;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function resolveProjectPaths(input = {}, { create = false } = {}) {
  const rawProjectDir = requireNonEmptyString(input.projectDir, "projectDir", 4096);
  if (!path.isAbsolute(rawProjectDir)) {
    throw new Error("projectDir must be an absolute path.");
  }

  const projectInfo = await stat(rawProjectDir).catch((error) => {
    if (error?.code === "ENOENT") throw new Error(`projectDir does not exist: ${rawProjectDir}`);
    throw error;
  });
  if (!projectInfo.isDirectory()) throw new Error("projectDir must point to a directory.");

  const projectDir = await realpath(rawProjectDir);
  const latticeDir = path.join(projectDir, LATTICE_DIR_NAME);
  const exists = await assertOrdinaryDirectory(latticeDir, ".lattice");
  if (create && !exists) {
    try {
      await mkdir(latticeDir, { mode: 0o700 });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    await assertOrdinaryDirectory(latticeDir, ".lattice");
  }
  if (exists || create) {
    const resolvedLatticeDir = await realpath(latticeDir);
    if (resolvedLatticeDir !== latticeDir) {
      throw new Error(".lattice must resolve inside the active project without links.");
    }
  }

  return {
    projectDir,
    latticeDir,
    catalogPath: path.join(latticeDir, CATALOG_FILE_NAME),
    workspacesDir: path.join(latticeDir, WORKSPACES_DIR_NAME),
    workspacePath: path.join(latticeDir, WORKSPACE_FILE_NAME),
    uiStatePath: path.join(latticeDir, UI_STATE_FILE_NAME),
    eventsPath: path.join(latticeDir, EVENTS_FILE_NAME),
    lockPath: path.join(latticeDir, LOCK_FILE_NAME),
  };
}

function emptyCatalog() {
  return {
    version: STORAGE_VERSION,
    activeWorkspaceId: null,
    workspaces: [],
  };
}

function validateCatalog(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Lattice workspace catalog must contain an object.");
  }
  if (value.version !== STORAGE_VERSION) {
    throw new Error(`Unsupported Lattice workspace catalog version: ${String(value.version)}.`);
  }
  if (!Array.isArray(value.workspaces)) {
    throw new Error("Lattice workspace catalog workspaces must be an array.");
  }
  if (value.workspaces.length > MAX_CATALOG_WORKSPACES) {
    throw new Error(
      `Lattice workspace catalog exceeds the ${MAX_CATALOG_WORKSPACES} workspace limit.`,
    );
  }
  const workspaces = value.workspaces.map((workspace, index) => {
    const id = assertId(workspace?.id, `catalog.workspaces[${index}].id`);
    if (id === LEGACY_WORKSPACE_ID) {
      throw new Error(`catalog.workspaces[${index}].id uses the reserved legacy id.`);
    }
    if (!["conversation", "blank"].includes(workspace?.origin)) {
      throw new Error(
        `catalog.workspaces[${index}].origin must be conversation or blank.`,
      );
    }
    return {
      id,
      title: requireNonEmptyString(
        workspace?.title,
        `catalog.workspaces[${index}].title`,
        240,
      ),
      origin: workspace.origin,
      createdAt: requireStoredTimestamp(
        workspace?.createdAt,
        `catalog.workspaces[${index}].createdAt`,
      ),
      updatedAt: requireStoredTimestamp(
        workspace?.updatedAt,
        `catalog.workspaces[${index}].updatedAt`,
      ),
    };
  });
  const ids = new Set();
  for (const workspace of workspaces) {
    if (ids.has(workspace.id)) {
      throw new Error(`Duplicate catalog workspace id: ${workspace.id}.`);
    }
    ids.add(workspace.id);
  }
  const activeWorkspaceId =
    value.activeWorkspaceId == null
      ? null
      : assertId(value.activeWorkspaceId, "catalog.activeWorkspaceId");
  if (
    activeWorkspaceId &&
    activeWorkspaceId !== LEGACY_WORKSPACE_ID &&
    !ids.has(activeWorkspaceId)
  ) {
    throw new Error("catalog.activeWorkspaceId references a missing workspace.");
  }
  return {
    version: STORAGE_VERSION,
    activeWorkspaceId,
    workspaces,
  };
}

async function readJsonFile(filePath, fallback, label, maximumBytes, validate) {
  const info = await assertOrdinaryFile(filePath, label);
  if (!info) return structuredClone(fallback);
  if (info.size > maximumBytes) {
    throw new Error(`${label} exceeds the ${maximumBytes} byte limit.`);
  }
  const text = await readFile(filePath, "utf8");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON: ${filePath}`);
  }
  return validate(value);
}

async function atomicWriteJson(filePath, value) {
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(tempPath, formatJson(value), {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(tempPath, filePath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertJsonSize(value, label, maximumBytes) {
  const size = Buffer.byteLength(formatJson(value), "utf8");
  if (size > maximumBytes) {
    throw new Error(`${label} exceeds the ${maximumBytes} byte limit.`);
  }
}

async function atomicWriteText(filePath, text) {
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(tempPath, text, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(tempPath, filePath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

function requireStoredTimestamp(value, label, { nullable = false } = {}) {
  if (nullable && value == null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp.`);
  }
  return new Date(value).toISOString();
}

function validateWorkspace(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Lattice workspace file must contain an object.");
  }
  if (value.version !== STORAGE_VERSION) {
    throw new Error(`Unsupported Lattice workspace version: ${String(value.version)}.`);
  }
  if (!Number.isInteger(value.revision) || value.revision < 0) {
    throw new Error("Lattice workspace revision must be a non-negative integer.");
  }
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error("Lattice workspace nodes and edges must be arrays.");
  }
  const nodes = value.nodes.map((node, index) => {
    requireStoredTimestamp(node?.createdAt, `workspace.nodes[${index}].createdAt`);
    if (!Array.isArray(node?.turns)) {
      throw new Error(`workspace.nodes[${index}].turns must be an array.`);
    }
    node.turns.forEach((turn, turnIndex) => {
      requireStoredTimestamp(
        turn?.createdAt,
        `workspace.nodes[${index}].turns[${turnIndex}].createdAt`,
      );
    });
    return normalizeNode(node, `workspace.nodes[${index}]`);
  });
  const nodeIds = new Set();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) throw new Error(`Duplicate stored node id: ${node.id}.`);
    nodeIds.add(node.id);
    const turnIds = new Set();
    for (const turn of node.turns) {
      if (turnIds.has(turn.id)) {
        throw new Error(`Duplicate stored turn id ${turn.id} in node ${node.id}.`);
      }
      turnIds.add(turn.id);
    }
  }
  const edges = value.edges.map((edge, index) =>
    normalizeEdge(edge, `workspace.edges[${index}]`),
  );
  const rootNodeId =
    value.rootNodeId == null ? null : assertId(value.rootNodeId, "workspace.rootNodeId");
  const activeNodeId =
    value.activeNodeId == null
      ? null
      : assertId(value.activeNodeId, "workspace.activeNodeId");
  if (rootNodeId && !nodeIds.has(rootNodeId)) {
    throw new Error("Stored rootNodeId references a missing node.");
  }
  if (activeNodeId && !nodeIds.has(activeNodeId)) {
    throw new Error("Stored activeNodeId references a missing node.");
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Stored edge ${edge.from} -> ${edge.to} references a missing node.`);
    }
  }
  const article = normalizeArticle(value.article);
  if (article) {
    for (const citation of article.citations) {
      if (!nodeIds.has(citation.nodeId)) {
        throw new Error(`Stored Article citation references missing node ${citation.nodeId}.`);
      }
    }
  }
  assertAcyclic(edges);
  const completedRequestIds = Array.isArray(value.completedRequestIds)
    ? value.completedRequestIds.map((requestId, index) =>
        assertId(requestId, `workspace.completedRequestIds[${index}]`),
      )
    : [];
  if (new Set(completedRequestIds).size !== completedRequestIds.length) {
    throw new Error("Stored completedRequestIds must be unique.");
  }
  return {
    version: STORAGE_VERSION,
    revision: value.revision,
    rootNodeId,
    activeNodeId,
    nodes,
    edges,
    article,
    completedRequestIds: completedRequestIds.slice(-100),
    updatedAt: requireStoredTimestamp(value.updatedAt, "workspace.updatedAt", {
      nullable: value.revision === 0,
    }),
  };
}

function validateUiState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Lattice UI state file must contain an object.");
  }
  if (value.version !== STORAGE_VERSION) {
    throw new Error(`Unsupported Lattice UI state version: ${String(value.version)}.`);
  }
  const activeNodeId =
    value.activeNodeId == null ? null : assertId(value.activeNodeId, "uiState.activeNodeId");
  if (!["explore", "article"].includes(value.view)) {
    throw new Error("Stored uiState.view must be explore or article.");
  }
  if (!Array.isArray(value.deckNodeIds)) {
    throw new Error("Stored uiState.deckNodeIds must be an array.");
  }
  return {
    version: STORAGE_VERSION,
    activeNodeId,
    view: value.view,
    deckNodeIds: value.deckNodeIds.map((id, index) =>
      assertId(id, `uiState.deckNodeIds[${index}]`),
    ),
    updatedAt: requireStoredTimestamp(value.updatedAt, "uiState.updatedAt", {
      nullable: true,
    }),
  };
}

function assertAcyclic(edges) {
  const outgoing = new Map();
  for (const edge of edges) {
    const targets = outgoing.get(edge.from) ?? [];
    targets.push(edge.to);
    outgoing.set(edge.from, targets);
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (nodeId) => {
    if (visiting.has(nodeId)) {
      throw new Error("Lattice research edges must form an acyclic graph.");
    }
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    for (const target of outgoing.get(nodeId) ?? []) visit(target);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  for (const nodeId of outgoing.keys()) visit(nodeId);
}

async function acquireProjectLock(lockPath) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < LOCK_TIMEOUT_MS) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(
        `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`,
        "utf8",
      );
      await handle.close();
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await unlink(lockPath).catch((error) => {
          if (error?.code !== "ENOENT") throw error;
        });
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const info = await lstat(lockPath).catch(() => null);
      if (
        info &&
        !info.isSymbolicLink() &&
        info.isFile() &&
        info.nlink === 1 &&
        Date.now() - info.mtimeMs > STALE_LOCK_MS
      ) {
        await unlink(lockPath).catch(() => undefined);
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 15 + Math.floor(Math.random() * 20)));
    }
  }
  throw new Error("Timed out waiting for another Lattice writer.");
}

async function withProjectWrite(paths, operation) {
  const previous = projectWriteQueues.get(paths.projectDir) ?? Promise.resolve();
  const queued = previous
    .catch(() => undefined)
    .then(async () => {
      const release = await acquireProjectLock(paths.lockPath);
      try {
        return await operation();
      } finally {
        await release();
      }
    });
  projectWriteQueues.set(paths.projectDir, queued);
  try {
    return await queued;
  } finally {
    if (projectWriteQueues.get(paths.projectDir) === queued) {
      projectWriteQueues.delete(paths.projectDir);
    }
  }
}

async function readEventLog(filePath) {
  const info = await assertOrdinaryFile(filePath, "Lattice event log");
  if (!info) return "";
  if (info.size > MAX_EVENT_LOG_BYTES) {
    throw new Error(`Lattice event log exceeds the ${MAX_EVENT_LOG_BYTES} byte limit.`);
  }
  return readFile(filePath, "utf8");
}

async function readCatalog(paths) {
  return readJsonFile(
    paths.catalogPath,
    emptyCatalog(),
    "Lattice workspace catalog",
    MAX_CATALOG_BYTES,
    validateCatalog,
  );
}

async function assertNestedWorkspaceDirectory(paths, workspaceId) {
  const workspaceDir = path.join(paths.workspacesDir, workspaceId);
  const workspacesExist = await assertOrdinaryDirectory(
    paths.workspacesDir,
    "Lattice workspaces directory",
  );
  if (!workspacesExist) {
    throw new Error(`Workspace ${workspaceId} is listed but its directory is missing.`);
  }
  const exists = await assertOrdinaryDirectory(
    workspaceDir,
    `Lattice workspace directory ${workspaceId}`,
  );
  if (!exists) {
    throw new Error(`Workspace ${workspaceId} is listed but its directory is missing.`);
  }
  const resolvedWorkspaceDir = await realpath(workspaceDir);
  if (resolvedWorkspaceDir !== workspaceDir) {
    throw new Error(`Lattice workspace directory ${workspaceId} must not contain links.`);
  }
  return workspaceDir;
}

async function ensureWorkspacesDirectory(paths) {
  const exists = await assertOrdinaryDirectory(
    paths.workspacesDir,
    "Lattice workspaces directory",
  );
  if (!exists) {
    try {
      await mkdir(paths.workspacesDir, { mode: 0o700 });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    await assertOrdinaryDirectory(paths.workspacesDir, "Lattice workspaces directory");
  }
  const resolvedWorkspacesDir = await realpath(paths.workspacesDir);
  if (resolvedWorkspacesDir !== paths.workspacesDir) {
    throw new Error("Lattice workspaces directory must not contain links.");
  }
}

function workspacePathsForId(paths, workspaceId) {
  if (workspaceId === LEGACY_WORKSPACE_ID) {
    return {
      workspaceId,
      workspaceDir: paths.latticeDir,
      workspacePath: paths.workspacePath,
      uiStatePath: paths.uiStatePath,
      eventsPath: paths.eventsPath,
    };
  }
  const workspaceDir = path.join(paths.workspacesDir, workspaceId);
  return {
    workspaceId,
    workspaceDir,
    workspacePath: path.join(workspaceDir, WORKSPACE_FILE_NAME),
    uiStatePath: path.join(workspaceDir, UI_STATE_FILE_NAME),
    eventsPath: path.join(workspaceDir, EVENTS_FILE_NAME),
  };
}

async function readLegacyWorkspaceMetadata(paths) {
  const labelsAndPaths = [
    ["Lattice legacy workspace file", paths.workspacePath],
    ["Lattice legacy UI state file", paths.uiStatePath],
    ["Lattice legacy event log", paths.eventsPath],
  ];
  const files = [];
  for (const [label, filePath] of labelsAndPaths) {
    const info = await assertOrdinaryFile(filePath, label);
    if (info) files.push(info);
  }
  if (files.length === 0) return null;

  const workspace = await readJsonFile(
    paths.workspacePath,
    emptyWorkspace(),
    "Lattice legacy workspace file",
    MAX_WORKSPACE_BYTES,
    validateWorkspace,
  );
  const createdAtMs = Math.min(
    ...files.map((info) =>
      Number.isFinite(info.birthtimeMs) && info.birthtimeMs > 0
        ? info.birthtimeMs
        : info.ctimeMs,
    ),
  );
  const updatedAtMs = Math.max(...files.map((info) => info.mtimeMs));
  return {
    id: LEGACY_WORKSPACE_ID,
    title: workspace.nodes[0]?.title || "Legacy workspace",
    origin: "legacy",
    createdAt: new Date(createdAtMs).toISOString(),
    updatedAt: workspace.updatedAt || new Date(updatedAtMs).toISOString(),
    legacy: true,
  };
}

async function readWorkspaceListing(paths, catalog = undefined) {
  const storedCatalog = catalog ?? (await readCatalog(paths));
  const legacy = await readLegacyWorkspaceMetadata(paths);
  for (const workspace of storedCatalog.workspaces) {
    await assertNestedWorkspaceDirectory(paths, workspace.id);
  }
  const workspaces = [
    ...storedCatalog.workspaces.map((workspace) => ({ ...workspace, legacy: false })),
    ...(legacy ? [legacy] : []),
  ];
  const availableIds = new Set(workspaces.map((workspace) => workspace.id));
  const activeWorkspaceId =
    storedCatalog.activeWorkspaceId &&
    availableIds.has(storedCatalog.activeWorkspaceId)
      ? storedCatalog.activeWorkspaceId
      : legacy?.id ?? null;
  return {
    activeWorkspaceId,
    workspaces,
  };
}

async function resolveWorkspaceSelection(
  input,
  paths,
) {
  const catalog = await readCatalog(paths);
  const listing = await readWorkspaceListing(paths, catalog);
  let workspaceId = null;
  if (input.workspaceId != null) {
    workspaceId = assertId(input.workspaceId, "workspaceId");
    if (!listing.workspaces.some((workspace) => workspace.id === workspaceId)) {
      throw new Error(`Unknown Lattice workspaceId: ${workspaceId}.`);
    }
  } else {
    workspaceId = listing.activeWorkspaceId;
  }
  if (workspaceId && workspaceId !== LEGACY_WORKSPACE_ID) {
    await assertNestedWorkspaceDirectory(paths, workspaceId);
  }
  return {
    catalog,
    listing,
    workspaceId,
    workspacePaths: workspaceId ? workspacePathsForId(paths, workspaceId) : null,
  };
}

export async function listLatticeWorkspaces(input = {}) {
  const paths = await resolveProjectPaths(input);
  const listing = await readWorkspaceListing(paths);
  return {
    projectDir: paths.projectDir,
    latticeDir: paths.latticeDir,
    activeWorkspaceId: listing.activeWorkspaceId,
    workspaces: listing.workspaces,
  };
}

export async function createLatticeWorkspace(input = {}) {
  const paths = await resolveProjectPaths(input, { create: true });
  return withProjectWrite(paths, () => createLatticeWorkspaceLocked(input, paths));
}

async function createLatticeWorkspaceLocked(input, paths) {
  if (!["conversation", "blank"].includes(input.origin)) {
    throw new Error("origin must be conversation or blank.");
  }
  const title = requireNonEmptyString(
    input.title ??
      (input.origin === "conversation"
        ? "Conversation research"
        : "Untitled research"),
    "title",
    240,
  );
  const catalog = await readCatalog(paths);
  const existingListing = await readWorkspaceListing(paths, catalog);
  if (catalog.workspaces.length >= MAX_CATALOG_WORKSPACES) {
    throw new Error(
      `Lattice workspace catalog exceeds the ${MAX_CATALOG_WORKSPACES} workspace limit.`,
    );
  }
  await ensureWorkspacesDirectory(paths);

  let workspaceId;
  if (input.workspaceId != null) {
    workspaceId = assertId(input.workspaceId, "workspaceId");
    if (workspaceId === LEGACY_WORKSPACE_ID) {
      throw new Error(`workspaceId ${LEGACY_WORKSPACE_ID} is reserved.`);
    }
  } else {
    do {
      workspaceId = `workspace-${randomUUID()}`;
    } while (catalog.workspaces.some((workspace) => workspace.id === workspaceId));
  }
  if (catalog.workspaces.some((workspace) => workspace.id === workspaceId)) {
    throw new Error(`Lattice workspace ${workspaceId} already exists.`);
  }

  const workspacePaths = workspacePathsForId(paths, workspaceId);
  const existingDirectory = await assertOrdinaryDirectory(
    workspacePaths.workspaceDir,
    `Lattice workspace directory ${workspaceId}`,
  );
  if (existingDirectory) {
    throw new Error(`Lattice workspace directory ${workspaceId} already exists.`);
  }
  try {
    await mkdir(workspacePaths.workspaceDir, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(`Lattice workspace directory ${workspaceId} already exists.`);
    }
    throw error;
  }
  await assertNestedWorkspaceDirectory(paths, workspaceId);

  const workspace = emptyWorkspace();
  const uiState = emptyUiState();
  let catalogCommitted = false;
  try {
    await atomicWriteJson(workspacePaths.workspacePath, workspace);
    await atomicWriteJson(workspacePaths.uiStatePath, uiState);
    await atomicWriteText(workspacePaths.eventsPath, "");

    const now = new Date().toISOString();
    const metadata = {
      id: workspaceId,
      title,
      origin: input.origin,
      createdAt: now,
      updatedAt: now,
    };
    const nextCatalog = {
      version: STORAGE_VERSION,
      activeWorkspaceId: workspaceId,
      workspaces: [...catalog.workspaces, metadata],
    };
    assertJsonSize(nextCatalog, "Lattice workspace catalog", MAX_CATALOG_BYTES);
    await atomicWriteJson(paths.catalogPath, nextCatalog);
    catalogCommitted = true;
    return {
      ok: true,
      changed: true,
      projectDir: paths.projectDir,
      latticeDir: paths.latticeDir,
      workspaceId,
      activeWorkspaceId: workspaceId,
      workspaces: [
        ...nextCatalog.workspaces.map((entry) => ({ ...entry, legacy: false })),
        ...existingListing.workspaces.filter((entry) => entry.legacy),
      ],
      workspace,
      uiState,
    };
  } catch (error) {
    if (!catalogCommitted) {
      await rm(workspacePaths.workspaceDir, {
        recursive: true,
        force: true,
      }).catch(() => undefined);
    }
    throw error;
  }
}

export async function readLatticeState(input = {}) {
  const paths = await resolveProjectPaths(input);
  const selection = await resolveWorkspaceSelection(input, paths);
  if (!selection.workspacePaths) {
    return {
      storage: "empty",
      projectDir: paths.projectDir,
      latticeDir: paths.latticeDir,
      workspaceId: null,
      activeWorkspaceId: selection.listing.activeWorkspaceId,
      workspaces: selection.listing.workspaces,
      workspace: emptyWorkspace(),
      uiState: emptyUiState(),
    };
  }
  const workspace = await readJsonFile(
    selection.workspacePaths.workspacePath,
    emptyWorkspace(),
    "Lattice workspace file",
    MAX_WORKSPACE_BYTES,
    validateWorkspace,
  );
  const uiState = await readJsonFile(
    selection.workspacePaths.uiStatePath,
    emptyUiState(),
    "Lattice UI state file",
    MAX_UI_STATE_BYTES,
    validateUiState,
  );
  return {
    storage: workspace.revision > 0 ? "project" : "empty",
    projectDir: paths.projectDir,
    latticeDir: paths.latticeDir,
    workspaceId: selection.workspaceId,
    activeWorkspaceId: selection.listing.activeWorkspaceId,
    workspaces: selection.listing.workspaces,
    workspace,
    uiState,
  };
}

function assertExistingOrNewNodeIds(workspace, newNodes, patch) {
  const ids = new Set([...workspace.nodes.map((node) => node.id), ...newNodes.map((node) => node.id)]);
  for (const edge of patch.addEdges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      throw new Error(`Edge ${edge.from} -> ${edge.to} references a missing node.`);
    }
  }
  for (const node of newNodes) {
    for (const turn of node.turns) {
      for (const anchor of turn.anchors) {
        if (!ids.has(anchor.targetNodeId)) {
          throw new Error(`Anchor ${anchor.label} references missing node ${anchor.targetNodeId}.`);
        }
      }
    }
  }
  for (const addition of patch.appendTurns) {
    if (!ids.has(addition.nodeId)) {
      throw new Error(`Cannot append turns to missing node ${addition.nodeId}.`);
    }
    for (const turn of addition.turns) {
      for (const anchor of turn.anchors) {
        if (!ids.has(anchor.targetNodeId)) {
          throw new Error(`Anchor ${anchor.label} references missing node ${anchor.targetNodeId}.`);
        }
      }
    }
  }
  if (patch.rootNodeId && !ids.has(patch.rootNodeId)) {
    throw new Error(`rootNodeId references missing node ${patch.rootNodeId}.`);
  }
  if (patch.activeNodeId && !ids.has(patch.activeNodeId)) {
    throw new Error(`activeNodeId references missing node ${patch.activeNodeId}.`);
  }
  if (patch.article) {
    for (const citation of patch.article.citations) {
      if (!ids.has(citation.nodeId)) {
        throw new Error(`Article citation references missing node ${citation.nodeId}.`);
      }
    }
  }
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function omitCreatedAt(value) {
  if (Array.isArray(value)) return value.map(omitCreatedAt);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "createdAt")
      .map(([key, child]) => [key, omitCreatedAt(child)]),
  );
}

function equalImmutableContent(left, right) {
  return equalJson(omitCreatedAt(left), omitCreatedAt(right));
}

export async function applyLatticePatch(input = {}) {
  if (input.workspaceId == null) {
    throw new Error("workspaceId is required for Lattice mutations.");
  }
  const paths = await resolveProjectPaths(input, { create: true });
  return withProjectWrite(paths, () => applyLatticePatchLocked(input, paths));
}

async function applyLatticePatchLocked(input, paths) {
  const selection = await resolveWorkspaceSelection(input, paths);
  const workspacePaths = selection.workspacePaths;
  const workspace = await readJsonFile(
    workspacePaths.workspacePath,
    emptyWorkspace(),
    "Lattice workspace file",
    MAX_WORKSPACE_BYTES,
    validateWorkspace,
  );
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  ) {
    throw new Error("expectedRevision is required and must be a non-negative integer.");
  }
  if (input.expectedRevision !== workspace.revision) {
    throw new Error(
      `Revision conflict: expected ${input.expectedRevision}, current revision is ${workspace.revision}.`,
    );
  }

  const rawPatch = input.patch || {};
  const patch = {
    addNodes: Array.isArray(rawPatch.addNodes)
      ? rawPatch.addNodes.map((node, index) => normalizeNode(node, `patch.addNodes[${index}]`))
      : [],
    appendTurns: Array.isArray(rawPatch.appendTurns)
      ? rawPatch.appendTurns.map((addition, index) => ({
          nodeId: assertId(addition?.nodeId, `patch.appendTurns[${index}].nodeId`),
          turns: Array.isArray(addition?.turns)
            ? addition.turns.map((turn, turnIndex) =>
                normalizeTurn(turn, `patch.appendTurns[${index}].turns[${turnIndex}]`),
              )
            : [],
        }))
      : [],
    addEdges: Array.isArray(rawPatch.addEdges)
      ? rawPatch.addEdges.map((edge, index) => normalizeEdge(edge, `patch.addEdges[${index}]`))
      : [],
    rootNodeId: rawPatch.rootNodeId == null
      ? null
      : assertId(rawPatch.rootNodeId, "patch.rootNodeId"),
    activeNodeId: rawPatch.activeNodeId == null
      ? null
      : assertId(rawPatch.activeNodeId, "patch.activeNodeId"),
    article: rawPatch.article === undefined ? undefined : normalizeArticle(rawPatch.article),
    completeRequestId:
      rawPatch.completeRequestId == null
        ? null
        : assertId(rawPatch.completeRequestId, "patch.completeRequestId"),
  };

  if (patch.appendTurns.some((addition) => addition.turns.length === 0)) {
    throw new Error("Every appendTurns entry must contain at least one turn.");
  }

  assertExistingOrNewNodeIds(workspace, patch.addNodes, patch);

  let changed = false;
  let addedAssistantTurn = false;
  const nodes = structuredClone(workspace.nodes);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  for (const node of patch.addNodes) {
    const existing = nodesById.get(node.id);
    if (existing) {
      if (!equalImmutableContent(existing, node)) {
        throw new Error(
          `Node ${node.id} already exists. Node titles and past answers are immutable; append turns instead.`,
        );
      }
      continue;
    }
    nodes.push(node);
    nodesById.set(node.id, node);
    if (node.turns.some((turn) => turn.role === "assistant")) {
      addedAssistantTurn = true;
    }
    changed = true;
  }

  for (const addition of patch.appendTurns) {
    const node = nodesById.get(addition.nodeId);
    const turnsById = new Map(node.turns.map((turn) => [turn.id, turn]));
    for (const turn of addition.turns) {
      const existing = turnsById.get(turn.id);
      if (existing) {
        if (!equalImmutableContent(existing, turn)) {
          throw new Error(`Turn ${turn.id} already exists with different content.`);
        }
        continue;
      }
      node.turns.push(turn);
      turnsById.set(turn.id, turn);
      if (turn.role === "assistant") {
        addedAssistantTurn = true;
      }
      changed = true;
    }
  }
  const edges = structuredClone(workspace.edges);
  for (const edge of patch.addEdges) {
    if (
      !edges.some(
        (existing) =>
          existing.from === edge.from &&
          existing.to === edge.to &&
          existing.kind === edge.kind,
      )
    ) {
      edges.push(edge);
      changed = true;
    }
  }
  assertAcyclic(edges);

  const rootNodeId = patch.rootNodeId ?? workspace.rootNodeId ?? patch.addNodes[0]?.id ?? null;
  const activeNodeId =
    patch.activeNodeId ?? workspace.activeNodeId ?? rootNodeId;
  const article = patch.article === undefined ? workspace.article : patch.article;
  let completedRequestIds = [...(workspace.completedRequestIds ?? [])];
  if (
    patch.completeRequestId &&
    !completedRequestIds.includes(patch.completeRequestId)
  ) {
    if (!addedAssistantTurn) {
      throw new Error(
        "completeRequestId requires a newly persisted assistant answer in the same patch.",
      );
    }
    completedRequestIds = [
      ...completedRequestIds,
      patch.completeRequestId,
    ].slice(-100);
    changed = true;
  }
  if (
    rootNodeId !== workspace.rootNodeId ||
    activeNodeId !== workspace.activeNodeId ||
    !equalJson(article, workspace.article)
  ) {
    changed = true;
  }

  if (!changed) {
    return {
      ok: true,
      changed: false,
      projectDir: paths.projectDir,
      latticeDir: paths.latticeDir,
      workspaceId: selection.workspaceId,
      workspace,
    };
  }

  const now = new Date().toISOString();
  const nextWorkspace = {
    version: STORAGE_VERSION,
    revision: workspace.revision + 1,
    rootNodeId,
    activeNodeId,
    nodes,
    edges,
    article,
    completedRequestIds,
    updatedAt: now,
  };
  assertJsonSize(nextWorkspace, "Lattice workspace file", MAX_WORKSPACE_BYTES);
  const previousEvents = await readEventLog(workspacePaths.eventsPath);
  await atomicWriteJson(workspacePaths.workspacePath, nextWorkspace);
  const event = `${JSON.stringify({
      id: randomUUID(),
      type: "research_patch_applied",
      revision: nextWorkspace.revision,
      at: now,
      summary: {
        addedNodeIds: patch.addNodes.map((node) => node.id),
        appendedTurnIds: patch.appendTurns.flatMap((addition) =>
          addition.turns.map((turn) => turn.id),
        ),
        addedEdges: patch.addEdges,
        articleUpdated: patch.article !== undefined,
        completedRequestId: patch.completeRequestId,
      },
    })}\n`;
  let eventLogWarning;
  try {
    const nextEvents = `${previousEvents}${event}`;
    if (Buffer.byteLength(nextEvents) > MAX_EVENT_LOG_BYTES) {
      throw new Error(`Lattice event log exceeds the ${MAX_EVENT_LOG_BYTES} byte limit.`);
    }
    await atomicWriteText(workspacePaths.eventsPath, nextEvents);
  } catch (error) {
    // workspace.json is the durable source of truth. Once its atomic rename has
    // committed, returning an error would make a safe retry look like a CAS
    // conflict. Report audit-log degradation without misreporting the commit.
    eventLogWarning = error instanceof Error ? error.message : String(error);
  }
  let catalogWarning;
  if (selection.workspaceId !== LEGACY_WORKSPACE_ID) {
    const metadataIndex = selection.catalog.workspaces.findIndex(
      (metadata) => metadata.id === selection.workspaceId,
    );
    if (metadataIndex < 0) {
      catalogWarning = `Workspace committed; catalog metadata for ${selection.workspaceId} is missing.`;
    } else {
      const nextCatalog = structuredClone(selection.catalog);
      nextCatalog.workspaces[metadataIndex].updatedAt = now;
      try {
        await atomicWriteJson(paths.catalogPath, nextCatalog);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        catalogWarning = `Workspace committed; catalog timestamp not updated: ${message}`;
      }
    }
  }
  const warnings = [eventLogWarning, catalogWarning].filter(Boolean);

  return {
    ok: true,
    changed: true,
    projectDir: paths.projectDir,
    latticeDir: paths.latticeDir,
    workspaceId: selection.workspaceId,
    workspace: nextWorkspace,
    ...(warnings.length > 0
      ? {
          warning: [
            ...(eventLogWarning
              ? [`Workspace committed; event log not updated: ${eventLogWarning}`]
              : []),
            ...(catalogWarning ? [catalogWarning] : []),
          ].join(" "),
        }
      : {}),
  };
}

export async function saveLatticeUiState(input = {}) {
  if (input.workspaceId == null) {
    throw new Error("workspaceId is required for Lattice mutations.");
  }
  const paths = await resolveProjectPaths(input, { create: true });
  return withProjectWrite(paths, () => saveLatticeUiStateLocked(input, paths));
}

async function saveLatticeUiStateLocked(input, paths) {
  const selection = await resolveWorkspaceSelection(input, paths);
  const workspacePaths = selection.workspacePaths;
  const workspace = await readJsonFile(
    workspacePaths.workspacePath,
    emptyWorkspace(),
    "Lattice workspace file",
    MAX_WORKSPACE_BYTES,
    validateWorkspace,
  );
  const rawState = input.uiState || {};
  const activeNodeId =
    rawState.activeNodeId == null
      ? null
      : assertId(rawState.activeNodeId, "uiState.activeNodeId");
  if (activeNodeId && !workspace.nodes.some((node) => node.id === activeNodeId)) {
    throw new Error(`uiState.activeNodeId references missing node ${activeNodeId}.`);
  }
  const view = rawState.view || "explore";
  if (!["explore", "article"].includes(view)) {
    throw new Error("uiState.view must be explore or article.");
  }
  const deckNodeIds = Array.isArray(rawState.deckNodeIds)
    ? rawState.deckNodeIds.map((id, index) => assertId(id, `uiState.deckNodeIds[${index}]`))
    : [];
  if (deckNodeIds.some((id) => !workspace.nodes.some((node) => node.id === id))) {
    throw new Error("uiState.deckNodeIds contains a missing node.");
  }
  const previousUiState = await readJsonFile(
    workspacePaths.uiStatePath,
    emptyUiState(),
    "Lattice UI state file",
    MAX_UI_STATE_BYTES,
    validateUiState,
  );
  const stableUiState = {
    version: STORAGE_VERSION,
    activeNodeId,
    view,
    deckNodeIds,
  };
  const changed = !equalJson(
    stableUiState,
    {
      version: previousUiState.version,
      activeNodeId: previousUiState.activeNodeId,
      view: previousUiState.view,
      deckNodeIds: previousUiState.deckNodeIds,
    },
  );
  const now = new Date().toISOString();
  const uiState = changed
    ? {
        ...stableUiState,
        updatedAt: now,
      }
    : previousUiState;
  if (changed) {
    assertJsonSize(uiState, "Lattice UI state file", MAX_UI_STATE_BYTES);
    await atomicWriteJson(workspacePaths.uiStatePath, uiState);
  }

  let catalogWarning;
  const nextCatalog = structuredClone(selection.catalog);
  nextCatalog.activeWorkspaceId = selection.workspaceId;
  if (selection.workspaceId !== LEGACY_WORKSPACE_ID) {
    const metadataIndex = selection.catalog.workspaces.findIndex(
      (metadata) => metadata.id === selection.workspaceId,
    );
    if (metadataIndex < 0) {
      catalogWarning = `UI state committed; catalog metadata for ${selection.workspaceId} is missing.`;
    } else {
      nextCatalog.workspaces[metadataIndex].updatedAt = now;
    }
  }
  if (!catalogWarning) {
    try {
      assertJsonSize(nextCatalog, "Lattice workspace catalog", MAX_CATALOG_BYTES);
      await atomicWriteJson(paths.catalogPath, nextCatalog);
    } catch (error) {
      if (!changed) throw error;
      const message = error instanceof Error ? error.message : String(error);
      catalogWarning = `UI state committed; catalog state not updated: ${message}`;
    }
  }
  return {
    ok: true,
    changed,
    projectDir: paths.projectDir,
    latticeDir: paths.latticeDir,
    workspaceId: selection.workspaceId,
    uiState,
    ...(catalogWarning ? { warning: catalogWarning } : {}),
  };
}
