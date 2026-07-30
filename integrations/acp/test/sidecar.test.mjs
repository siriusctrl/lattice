import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { AcpSidecar } from "../dist/sidecar.js";

const fakeAgent = fileURLToPath(
  new URL("./fixtures/fake-agent.mjs", import.meta.url),
);

test("sidecar persists ACP research in the fixed project .lattice store", async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), "lattice-acp-storage-"));
  const sidecar = await AcpSidecar.start({
    agent: {
      command: process.execPath,
      args: [fakeAgent],
      cwd: projectDir,
    },
    projectDir,
    token: "storage-token",
  });
  const authorization = { Authorization: "Bearer storage-token" };

  try {
    assert.equal(sidecar.info.projectDir, projectDir);
    const empty = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/lattice/state`,
      {
        method: "POST",
        headers: authorization,
        body: "{}",
      },
    );
    assert.equal(empty.response.status, 200);
    assert.equal(empty.body.data.storage, "empty");
    assert.equal(empty.body.data.workspaceId, sidecar.info.workspaceId);
    assert.equal(empty.body.data.workspace.revision, 0);

    const listed = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/lattice/workspaces`,
      {
        method: "POST",
        headers: authorization,
        body: "{}",
      },
    );
    assert.equal(listed.response.status, 200);
    assert.equal(listed.body.data.activeWorkspaceId, sidecar.info.workspaceId);
    assert.equal(listed.body.data.workspaces.length, 1);
    assert.equal(listed.body.data.workspaces[0].origin, "blank");

    const created = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/lattice/workspaces/create`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({
          title: "Second graph",
          origin: "conversation",
        }),
      },
    );
    assert.equal(created.response.status, 201);
    assert.notEqual(created.body.data.workspaceId, sidecar.info.workspaceId);
    assert.equal(
      created.body.data.workspaces.find(
        (workspace) => workspace.id === created.body.data.workspaceId,
      ).title,
      "Second graph",
    );

    const mismatchedSession = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/sessions`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({ cwd: process.cwd() }),
      },
    );
    assert.equal(mismatchedSession.response.status, 403);
    assert.equal(
      mismatchedSession.body.error.code,
      "session_project_mismatch",
    );

    const patch = {
      addNodes: [{
        id: "root",
        title: "Repository architecture",
        shortTitle: "Architecture",
        lead: "A durable root Card.",
        year: "Repository research",
        position: { x: 50, y: 50 },
        turns: [
          { id: "request-user", role: "user", content: "How does it work?" },
          {
            id: "request-assistant",
            role: "assistant",
            content: "The sidecar and plugin share one store.",
          },
        ],
      }],
      rootNodeId: "root",
      activeNodeId: "root",
      completeRequestId: "request",
    };
    const missingRevision = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/lattice/patch`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({ patch }),
      },
    );
    assert.equal(missingRevision.response.status, 400);
    assert.equal(missingRevision.body.error.code, "invalid_body");

    const missingWorkspace = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/lattice/patch`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({ expectedRevision: 0, patch }),
      },
    );
    assert.equal(missingWorkspace.response.status, 400);
    assert.equal(missingWorkspace.body.error.code, "invalid_body");

    const applied = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/lattice/patch`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({
          workspaceId: sidecar.info.workspaceId,
          expectedRevision: 0,
          patch,
        }),
      },
    );
    assert.equal(applied.response.status, 200);
    assert.equal(applied.body.data.workspace.revision, 1);
    assert.equal(applied.body.data.workspace.rootNodeId, "root");

    const conflict = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/lattice/patch`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({
          workspaceId: sidecar.info.workspaceId,
          expectedRevision: 0,
          patch,
        }),
      },
    );
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.body.error.code, "revision_conflict");

    const savedUi = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/lattice/ui-state`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({
          uiState: {
            activeNodeId: "root",
            view: "explore",
            deckNodeIds: ["root"],
          },
          workspaceId: sidecar.info.workspaceId,
        }),
      },
    );
    assert.equal(savedUi.response.status, 200);

    const missingUiWorkspace = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/lattice/ui-state`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({
          uiState: {
            activeNodeId: "root",
            view: "explore",
            deckNodeIds: ["root"],
          },
        }),
      },
    );
    assert.equal(missingUiWorkspace.response.status, 400);
    assert.equal(missingUiWorkspace.body.error.code, "invalid_body");

    const workspace = JSON.parse(
      await readFile(
        path.join(
          projectDir,
          ".lattice",
          "workspaces",
          sidecar.info.workspaceId,
          "workspace.json",
        ),
        "utf8",
      ),
    );
    assert.equal(workspace.nodes[0].turns[1].content,
      "The sidecar and plugin share one store.");
  } finally {
    await sidecar.shutdown();
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("HTTP/SSE sidecar exposes sessions, manual permissions, streaming, cancel, and shutdown", async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), "lattice-acp-http-"));
  const sidecar = await AcpSidecar.start({
    agent: {
      command: process.execPath,
      args: [fakeAgent],
      cwd: projectDir,
    },
    projectDir,
    token: "test-token",
    permissionMode: "manual",
    permissionTimeoutMs: 5_000,
  });
  const authorization = { Authorization: "Bearer test-token" };
  const abortEvents = new AbortController();

  try {
    const unauthorized = await fetch(`${sidecar.info.baseUrl}/v1/status`);
    assert.equal(unauthorized.status, 401);

    const events = readSseEvents(
      `${sidecar.info.baseUrl}/v1/events`,
      authorization,
      abortEvents.signal,
    );

    const deniedMcp = await jsonFetch(`${sidecar.info.baseUrl}/v1/sessions`, {
      method: "POST",
        headers: authorization,
        body: JSON.stringify({
          cwd: projectDir,
          mcpServers: [
          {
            name: "untrusted",
            command: process.execPath,
            args: [fakeAgent],
          },
        ],
      }),
    });
    assert.equal(deniedMcp.response.status, 403);
    assert.equal(
      deniedMcp.body.error.code,
      "client_mcp_servers_forbidden",
    );

    const invalidDirectories = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/sessions`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({
          cwd: projectDir,
          additionalDirectories: [42],
        }),
      },
    );
    assert.equal(invalidDirectories.response.status, 400);

    const invalidPath = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/sessions/%E0%A4%A/prompts`,
      {
        method: "POST",
        headers: authorization,
      },
    );
    assert.equal(invalidPath.response.status, 400);
    assert.equal(invalidPath.body.error.code, "invalid_path_encoding");

    const created = await jsonFetch(`${sidecar.info.baseUrl}/v1/sessions`, {
      method: "POST",
      headers: authorization,
      body: JSON.stringify({ cwd: projectDir }),
    });
    assert.equal(created.response.status, 201);
    const sessionId = created.body.data.sessionId;

    const invalidCursor = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/events?after=not-a-number`,
      { headers: authorization },
    );
    assert.equal(invalidCursor.response.status, 400);
    assert.equal(invalidCursor.body.error.code, "invalid_event_cursor");

    const invalidPrompt = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/sessions/${sessionId}/prompts`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({ prompt: [{ type: "text" }] }),
      },
    );
    assert.equal(invalidPrompt.response.status, 400);

    const prompted = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/sessions/${sessionId}/prompts`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({ text: "normal turn" }),
      },
    );
    assert.equal(prompted.response.status, 202);

    const permission = await nextEvent(events, "permission.requested");
    assert.equal(permission.sessionId, sessionId);
    const permissionId = permission.data.permissionId;

    const resolved = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/permissions/${permissionId}/resolve`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({ optionId: "reject-once" }),
      },
    );
    assert.equal(resolved.response.status, 200);
    const completed = await nextEvent(events, "turn.completed");
    assert.equal(completed.data.stopReason, "end_turn");

    await jsonFetch(
      `${sidecar.info.baseUrl}/v1/sessions/${sessionId}/prompts`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({ text: "wait-for-cancel" }),
      },
    );
    await nextEvent(events, "permission.requested");
    const cancelled = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/sessions/${sessionId}/cancel`,
      {
        method: "POST",
        headers: authorization,
      },
    );
    assert.equal(cancelled.response.status, 202);
    const cancelledTurn = await nextEvent(events, "turn.completed");
    assert.equal(cancelledTurn.data.stopReason, "cancelled");

    const status = await jsonFetch(`${sidecar.info.baseUrl}/v1/status`, {
      headers: authorization,
    });
    assert.equal(status.body.data.running, true);
    assert.deepEqual(status.body.data.sessions, [sessionId]);
  } finally {
    abortEvents.abort();
    await sidecar.shutdown();
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("trusted opt-in permits validated client MCP server definitions", async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), "lattice-acp-trusted-"));
  const sidecar = await AcpSidecar.start({
    agent: {
      command: process.execPath,
      args: [fakeAgent],
      cwd: projectDir,
    },
    projectDir,
    token: "trusted-token",
    allowClientMcpServers: true,
  });
  const authorization = { Authorization: "Bearer trusted-token" };

  try {
    const invalid = await jsonFetch(`${sidecar.info.baseUrl}/v1/sessions`, {
      method: "POST",
      headers: authorization,
      body: JSON.stringify({
        cwd: projectDir,
        mcpServers: [{ name: "invalid", command: process.execPath, url: "x" }],
      }),
    });
    assert.equal(invalid.response.status, 400);

    const created = await jsonFetch(`${sidecar.info.baseUrl}/v1/sessions`, {
      method: "POST",
      headers: authorization,
      body: JSON.stringify({
        cwd: projectDir,
        mcpServers: [
          {
            name: "trusted-stdio",
            command: process.execPath,
            args: [fakeAgent],
            env: [],
          },
        ],
      }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data._meta.mcpServerCount, 1);

    const status = await jsonFetch(`${sidecar.info.baseUrl}/v1/status`, {
      headers: authorization,
    });
    assert.equal(status.body.data.allowClientMcpServers, true);
  } finally {
    await sidecar.shutdown();
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("SSE disconnects a backpressured client without blocking the sidecar", async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), "lattice-acp-sse-"));
  const sidecar = await AcpSidecar.start({
    agent: {
      command: process.execPath,
      args: [fakeAgent],
      cwd: projectDir,
    },
    projectDir,
    token: "slow-token",
    sseClientQueueBytes: 1_024,
    eventHistoryLimit: 10,
  });
  const authorization = { Authorization: "Bearer slow-token" };
  let slowRequest;

  try {
    const slow = await openPausedSse(
      `${sidecar.info.baseUrl}/v1/events`,
      authorization,
    );
    slowRequest = slow.request;

    const created = await jsonFetch(`${sidecar.info.baseUrl}/v1/sessions`, {
      method: "POST",
      headers: authorization,
      body: JSON.stringify({ cwd: projectDir }),
    });
    const sessionId = created.body.data.sessionId;
    const prompted = await jsonFetch(
      `${sidecar.info.baseUrl}/v1/sessions/${sessionId}/prompts`,
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({ text: "flood-events" }),
      },
    );
    assert.equal(prompted.response.status, 202);
    await waitFor(async () => {
      const status = await jsonFetch(`${sidecar.info.baseUrl}/v1/status`, {
        headers: authorization,
      });
      return status.body.data.sseSubscribers === 0;
    }, 5_000);

    const status = await jsonFetch(`${sidecar.info.baseUrl}/v1/status`, {
      headers: authorization,
    });
    assert.equal(status.response.status, 200);
    assert.equal(status.body.data.running, true);
  } finally {
    slowRequest?.destroy();
    await sidecar.shutdown();
    await rm(projectDir, { recursive: true, force: true });
  }
});

async function jsonFetch(url, init) {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, { ...init, headers });
  return { response, body: await response.json() };
}

async function* readSseEvents(url, headers, signal) {
  const response = await fetch(url, { headers, signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return;
    }
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n");
      if (data) {
        yield JSON.parse(data);
      }
    }
  }
}

async function nextEvent(events, type) {
  while (true) {
    const { done, value: event } = await events.next();
    if (done) {
      throw new Error(`SSE stream ended before ${type}`);
    }
    if (event.type === type) {
      return event;
    }
  }
}

function openPausedSse(url, headers) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers }, (response) => {
      response.pause();
      response.on("error", () => {});
      resolve({ request, response });
    });
    request.once("error", reject);
  });
}

async function waitFor(check, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`condition not met within ${timeoutMs}ms`);
}
