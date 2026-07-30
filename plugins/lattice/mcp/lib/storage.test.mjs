import assert from "node:assert/strict";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyLatticePatch,
  createLatticeWorkspace,
  emptyWorkspace,
  listLatticeWorkspaces,
  readLatticeState,
  saveLatticeUiState,
} from "./storage.mjs";

function rootPatch(id, title, completeRequestId = undefined) {
  return {
    addNodes: [
      {
        id,
        title,
        turns: [
          { id: `${id}-user`, role: "user", content: `Question about ${title}` },
          {
            id: `${id}-assistant`,
            role: "assistant",
            content: `Research about ${title}`,
          },
        ],
      },
    ],
    rootNodeId: id,
    activeNodeId: id,
    ...(completeRequestId ? { completeRequestId } : {}),
  };
}

async function temporaryProject(t) {
  const projectDir = await mkdtemp(path.join(tmpdir(), "lattice-storage-test-"));
  t.after(() => rm(projectDir, { recursive: true, force: true }));
  return projectDir;
}

test("creates, lists, selects, and isolates multiple project workspaces", async (t) => {
  const projectDir = await temporaryProject(t);

  const fresh = await readLatticeState({ projectDir });
  assert.equal(fresh.workspaceId, null);
  assert.equal(fresh.activeWorkspaceId, null);
  assert.equal(fresh.storage, "empty");
  assert.deepEqual(fresh.workspaces, []);

  const first = await createLatticeWorkspace({
    projectDir,
    workspaceId: "topic-one",
    title: "First topic",
    origin: "conversation",
  });
  assert.equal(first.workspaceId, "topic-one");
  assert.equal(first.activeWorkspaceId, "topic-one");
  assert.equal(first.workspace.revision, 0);

  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await createLatticeWorkspace({
    projectDir,
    workspaceId: "topic-two",
    title: "Second topic",
    origin: "blank",
  });
  assert.equal(second.activeWorkspaceId, "topic-two");
  assert.equal(second.workspaces.length, 2);

  const selected = await readLatticeState({ projectDir });
  assert.equal(selected.workspaceId, "topic-two");
  assert.equal(selected.workspace.revision, 0);

  const firstPatch = await applyLatticePatch({
    projectDir,
    workspaceId: "topic-one",
    expectedRevision: 0,
    patch: rootPatch("first-root", "First topic", "first-request"),
  });
  assert.equal(firstPatch.workspaceId, "topic-one");
  assert.equal(firstPatch.workspace.revision, 1);

  const firstState = await readLatticeState({
    projectDir,
    workspaceId: "topic-one",
  });
  const secondState = await readLatticeState({
    projectDir,
    workspaceId: "topic-two",
  });
  assert.equal(firstState.workspace.nodes[0].id, "first-root");
  assert.equal(secondState.workspace.nodes.length, 0);
  assert.equal(secondState.workspace.revision, 0);

  const savedUi = await saveLatticeUiState({
    projectDir,
    workspaceId: "topic-one",
    uiState: {
      activeNodeId: "first-root",
      view: "explore",
      deckNodeIds: ["first-root"],
    },
  });
  assert.equal(savedUi.workspaceId, "topic-one");
  assert.equal(savedUi.uiState.activeNodeId, "first-root");
  assert.equal(
    (
      await readLatticeState({
        projectDir,
        workspaceId: "topic-two",
      })
    ).uiState.activeNodeId,
    null,
  );

  const catalog = JSON.parse(
    await readFile(path.join(projectDir, ".lattice", "workspaces.json"), "utf8"),
  );
  assert.equal(catalog.activeWorkspaceId, "topic-one");
  assert.deepEqual(
    catalog.workspaces.map((workspace) => workspace.id),
    ["topic-one", "topic-two"],
  );
  assert.ok(
    Date.parse(catalog.workspaces[0].updatedAt) >=
      Date.parse(catalog.workspaces[0].createdAt),
  );
  assert.equal(
    JSON.parse(
      await readFile(
        path.join(
          projectDir,
          ".lattice",
          "workspaces",
          "topic-one",
          "workspace.json",
        ),
        "utf8",
      ),
    ).revision,
    1,
  );
  assert.equal(
    JSON.parse(
      await readFile(
        path.join(
          projectDir,
          ".lattice",
          "workspaces",
          "topic-two",
          "workspace.json",
        ),
        "utf8",
      ),
    ).revision,
    0,
  );
});

test("rejects unknown workspace ids and duplicate or reserved ids", async (t) => {
  const projectDir = await temporaryProject(t);
  await createLatticeWorkspace({
    projectDir,
    workspaceId: "known",
    title: "Known",
    origin: "blank",
  });

  await assert.rejects(
    readLatticeState({ projectDir, workspaceId: "missing" }),
    /Unknown Lattice workspaceId: missing/,
  );
  await assert.rejects(
    applyLatticePatch({
      projectDir,
      workspaceId: "missing",
      expectedRevision: 0,
      patch: {},
    }),
    /Unknown Lattice workspaceId: missing/,
  );
  await assert.rejects(
    saveLatticeUiState({
      projectDir,
      workspaceId: "missing",
      uiState: {},
    }),
    /Unknown Lattice workspaceId: missing/,
  );
  await assert.rejects(
    createLatticeWorkspace({
      projectDir,
      workspaceId: "known",
      title: "Duplicate",
      origin: "blank",
    }),
    /already exists/,
  );
  await assert.rejects(
    createLatticeWorkspace({
      projectDir,
      workspaceId: "legacy",
      title: "Reserved",
      origin: "blank",
    }),
    /reserved/,
  );
  await assert.rejects(
    createLatticeWorkspace({
      projectDir,
      title: "Invalid origin",
      origin: "import",
    }),
    /origin must be conversation or blank/,
  );

  const defaultTitle = await createLatticeWorkspace({
    projectDir,
    workspaceId: "untitled",
    origin: "blank",
  });
  assert.equal(
    defaultTitle.workspaces.find((workspace) => workspace.id === "untitled")
      ?.title,
    "Untitled research",
  );
});

test("requires an explicit workspace id for every mutation", async (t) => {
  const projectDir = await temporaryProject(t);
  await assert.rejects(
    applyLatticePatch({
      projectDir,
      expectedRevision: 0,
      patch: {},
    }),
    /workspaceId is required for Lattice mutations/,
  );
  await assert.rejects(
    saveLatticeUiState({
      projectDir,
      uiState: {},
    }),
    /workspaceId is required for Lattice mutations/,
  );
  const listing = await listLatticeWorkspaces({ projectDir });
  assert.deepEqual(listing.workspaces, []);
  assert.equal(listing.activeWorkspaceId, null);
});

test("keeps flat storage as an in-place legacy workspace beside new workspaces", async (t) => {
  const projectDir = await temporaryProject(t);
  await mkdir(path.join(projectDir, ".lattice"), { mode: 0o700 });
  await writeFile(
    path.join(projectDir, ".lattice", "workspace.json"),
    `${JSON.stringify(emptyWorkspace(), null, 2)}\n`,
    { mode: 0o600 },
  );
  const legacyPatch = await applyLatticePatch({
    projectDir,
    workspaceId: "legacy",
    expectedRevision: 0,
    patch: rootPatch("legacy-root", "Existing research"),
  });
  assert.equal(legacyPatch.workspaceId, "legacy");
  const legacyWorkspacePath = path.join(
    projectDir,
    ".lattice",
    "workspace.json",
  );
  assert.equal(JSON.parse(await readFile(legacyWorkspacePath, "utf8")).revision, 1);

  const created = await createLatticeWorkspace({
    projectDir,
    workspaceId: "new-research",
    title: "New research",
    origin: "conversation",
  });
  assert.equal(created.activeWorkspaceId, "new-research");

  const listing = await listLatticeWorkspaces({ projectDir });
  assert.equal(listing.activeWorkspaceId, "new-research");
  assert.deepEqual(
    listing.workspaces.map(({ id, origin, legacy }) => ({ id, origin, legacy })),
    [
      { id: "new-research", origin: "conversation", legacy: false },
      { id: "legacy", origin: "legacy", legacy: true },
    ],
  );

  const legacy = await readLatticeState({
    projectDir,
    workspaceId: "legacy",
  });
  assert.equal(legacy.workspace.nodes[0].id, "legacy-root");
  assert.equal(JSON.parse(await readFile(legacyWorkspacePath, "utf8")).revision, 1);
  assert.equal((await readLatticeState({ projectDir })).workspaceId, "new-research");

  const selectedLegacy = await saveLatticeUiState({
    projectDir,
    workspaceId: "legacy",
    uiState: {},
  });
  assert.equal(selectedLegacy.changed, false);
  assert.equal(
    (await listLatticeWorkspaces({ projectDir })).activeWorkspaceId,
    "legacy",
  );
  assert.equal((await readLatticeState({ projectDir })).workspaceId, "legacy");
});

test("idempotent UI saves select a nested workspace without making reads write", async (t) => {
  const projectDir = await temporaryProject(t);
  await createLatticeWorkspace({
    projectDir,
    workspaceId: "first",
    title: "First",
    origin: "blank",
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await createLatticeWorkspace({
    projectDir,
    workspaceId: "second",
    title: "Second",
    origin: "blank",
  });
  const before = await readFile(
    path.join(projectDir, ".lattice", "workspaces.json"),
    "utf8",
  );
  await readLatticeState({ projectDir, workspaceId: "first" });
  assert.equal(
    await readFile(path.join(projectDir, ".lattice", "workspaces.json"), "utf8"),
    before,
  );

  const saved = await saveLatticeUiState({
    projectDir,
    workspaceId: "first",
    uiState: {},
  });
  assert.equal(saved.changed, false);
  const listing = await listLatticeWorkspaces({ projectDir });
  assert.equal(listing.activeWorkspaceId, "first");
  assert.equal((await readLatticeState({ projectDir })).workspaceId, "first");
});

test("rejects oversized workspace patches before committing", async (t) => {
  const projectDir = await temporaryProject(t);
  await createLatticeWorkspace({
    projectDir,
    workspaceId: "size-limited",
    title: "Size limited",
    origin: "blank",
  });
  const oversizedNodes = Array.from({ length: 36 }, (_, index) => ({
    id: `large-${index}`,
    title: `Large node ${index}`,
    turns: [
      {
        id: `large-turn-${index}`,
        role: "assistant",
        content: "x".repeat(119_900),
      },
    ],
  }));
  await assert.rejects(
    applyLatticePatch({
      projectDir,
      workspaceId: "size-limited",
      expectedRevision: 0,
      patch: {
        addNodes: oversizedNodes,
        rootNodeId: "large-0",
        activeNodeId: "large-0",
      },
    }),
    /Lattice workspace file exceeds the 4194304 byte limit/,
  );
  const state = await readLatticeState({
    projectDir,
    workspaceId: "size-limited",
  });
  assert.equal(state.workspace.revision, 0);
  assert.deepEqual(state.workspace.nodes, []);
});

test("does not complete a new request from an already persisted assistant turn", async (t) => {
  const projectDir = await temporaryProject(t);
  await createLatticeWorkspace({
    projectDir,
    workspaceId: "request-integrity",
    title: "Request integrity",
    origin: "conversation",
  });
  await applyLatticePatch({
    projectDir,
    workspaceId: "request-integrity",
    expectedRevision: 0,
    patch: rootPatch("request-root", "Request integrity", "initial-request"),
  });

  await assert.rejects(
    applyLatticePatch({
      projectDir,
      workspaceId: "request-integrity",
      expectedRevision: 1,
      patch: rootPatch(
        "request-root",
        "Request integrity",
        "unanswered-request",
      ),
    }),
    /completeRequestId requires a newly persisted assistant answer/,
  );

  const state = await readLatticeState({
    projectDir,
    workspaceId: "request-integrity",
  });
  assert.equal(state.workspace.revision, 1);
  assert.deepEqual(state.workspace.completedRequestIds, ["initial-request"]);
});

test("serializes same-revision writes and keeps workspace CAS independent", async (t) => {
  const projectDir = await temporaryProject(t);
  for (const workspaceId of ["parallel-a", "parallel-b"]) {
    await createLatticeWorkspace({
      projectDir,
      workspaceId,
      title: workspaceId,
      origin: "blank",
    });
  }

  const sameWorkspaceResults = await Promise.allSettled([
    applyLatticePatch({
      projectDir,
      workspaceId: "parallel-a",
      expectedRevision: 0,
      patch: rootPatch("root-a1", "First winner"),
    }),
    applyLatticePatch({
      projectDir,
      workspaceId: "parallel-a",
      expectedRevision: 0,
      patch: rootPatch("root-a2", "Second winner"),
    }),
  ]);
  assert.equal(
    sameWorkspaceResults.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    sameWorkspaceResults.filter((result) => result.status === "rejected").length,
    1,
  );

  const independent = await applyLatticePatch({
    projectDir,
    workspaceId: "parallel-b",
    expectedRevision: 0,
    patch: rootPatch("root-b", "Independent workspace"),
  });
  assert.equal(independent.workspace.revision, 1);
});

test("rejects hard-linked nested event logs before committing a patch", async (t) => {
  const projectDir = await temporaryProject(t);
  await createLatticeWorkspace({
    projectDir,
    workspaceId: "secure",
    title: "Secure",
    origin: "blank",
  });
  await applyLatticePatch({
    projectDir,
    workspaceId: "secure",
    expectedRevision: 0,
    patch: rootPatch("secure-root", "Secure"),
  });

  const eventsPath = path.join(
    projectDir,
    ".lattice",
    "workspaces",
    "secure",
    "events.ndjson",
  );
  const victimPath = path.join(projectDir, "victim.txt");
  await unlink(eventsPath);
  await writeFile(victimPath, "do not modify\n");
  await link(victimPath, eventsPath);

  await assert.rejects(
    applyLatticePatch({
      projectDir,
      workspaceId: "secure",
      expectedRevision: 1,
      patch: {
        appendTurns: [
          {
            nodeId: "secure-root",
            turns: [{ id: "unsafe-turn", role: "user", content: "Reject this." }],
          },
        ],
      },
    }),
    /must not be a hard link/,
  );
  assert.equal(await readFile(victimPath, "utf8"), "do not modify\n");
  assert.equal(
    (
      await readLatticeState({
        projectDir,
        workspaceId: "secure",
      })
    ).workspace.revision,
    1,
  );
});

test("rejects a linked workspaces directory", async (t) => {
  const projectDir = await temporaryProject(t);
  const outside = await mkdtemp(path.join(tmpdir(), "lattice-storage-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await mkdir(path.join(projectDir, ".lattice"), { mode: 0o700 });
  await symlink(outside, path.join(projectDir, ".lattice", "workspaces"));

  await assert.rejects(
    createLatticeWorkspace({
      projectDir,
      workspaceId: "linked",
      title: "Linked",
      origin: "blank",
    }),
    /must not be a symbolic link/,
  );
});
