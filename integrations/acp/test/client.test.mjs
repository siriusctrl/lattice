import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  AcpClient,
  AcpProtocolError,
  AcpRequestTimeoutError,
} from "../dist/client.js";

const fakeAgent = fileURLToPath(
  new URL("./fixtures/fake-agent.mjs", import.meta.url),
);
const closedStdinAgent = fileURLToPath(
  new URL("./fixtures/closed-stdin-agent.mjs", import.meta.url),
);
const malformedAgent = fileURLToPath(
  new URL("./fixtures/malformed-agent.mjs", import.meta.url),
);

test("ACP client initializes, streams updates, and rejects permission safely", async () => {
  const client = await AcpClient.start({
    command: process.execPath,
    args: [fakeAgent],
    cwd: process.cwd(),
  });

  try {
    assert.equal(client.initialized.protocolVersion, 1);
    assert.equal(client.initialized.agentInfo.name, "lattice-fake-agent");

    const session = await client.newSession({
      cwd: process.cwd(),
      mcpServers: [],
    });
    const updates = [];
    client.on("sessionUpdate", (update) => updates.push(update));

    const result = await client.prompt(session.sessionId, [
      { type: "text", text: "research this repository" },
    ]);

    assert.equal(result.stopReason, "end_turn");
    assert.equal(updates[0].update.sessionUpdate, "agent_message_chunk");
    const toolUpdate = updates.find(
      (entry) => entry.update.sessionUpdate === "tool_call_update",
    );
    assert.equal(
      toolUpdate.update.permissionOutcome.outcome.optionId,
      "reject-once",
    );
  } finally {
    await client.shutdown();
  }
});

test("ACP cancellation aborts a pending permission and completes the turn", async () => {
  let permissionStarted;
  const permissionSeen = new Promise((resolve) => {
    permissionStarted = resolve;
  });
  let permissionSignal;
  const client = await AcpClient.start({
    command: process.execPath,
    args: [fakeAgent],
    cwd: process.cwd(),
    permissionHandler: (_request, context) => {
      permissionSignal = context.signal;
      permissionStarted();
      return new Promise(() => {});
    },
  });

  try {
    const session = await client.newSession({
      cwd: process.cwd(),
      mcpServers: [],
    });
    const resultPromise = client.prompt(session.sessionId, [
      { type: "text", text: "wait-for-cancel" },
    ]);
    await permissionSeen;
    client.cancelSession(session.sessionId);
    const result = await resultPromise;

    assert.equal(permissionSignal.aborted, true);
    assert.equal(result.stopReason, "cancelled");
  } finally {
    const exit = once(client, "exit");
    await client.shutdown();
    await exit;
  }
});

test("missing agent executable rejects promptly instead of hanging", async () => {
  const startedAt = Date.now();
  await assert.rejects(
    within(
      AcpClient.start({
        command: `/definitely/missing/lattice-acp-${process.pid}`,
        startupTimeoutMs: 5_000,
        shutdownTimeoutMs: 25,
      }),
      750,
    ),
    /ENOENT/,
  );
  assert.ok(Date.now() - startedAt < 750);
});

test("stdin EPIPE rejects pending RPC without crashing the client process", async () => {
  const client = await AcpClient.start({
    command: process.execPath,
    args: [closedStdinAgent],
    requestTimeoutMs: 2_000,
    shutdownTimeoutMs: 100,
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 25));
    await assert.rejects(
      within(
        client.newSession({ cwd: process.cwd(), mcpServers: [] }),
        1_000,
      ),
      /EPIPE|stdin is not writable|agent exited/i,
    );
  } finally {
    await client.shutdown();
  }
});

test("agent exit aborts and settles a pending permission handler", async () => {
  let permissionSeen;
  const seen = new Promise((resolve) => {
    permissionSeen = resolve;
  });
  let signal;
  const client = await AcpClient.start({
    command: process.execPath,
    args: [fakeAgent],
    permissionHandler: (_request, context) => {
      signal = context.signal;
      permissionSeen();
      return new Promise(() => {});
    },
  });

  const session = await client.newSession({
    cwd: process.cwd(),
    mcpServers: [],
  });
  const prompt = client.prompt(session.sessionId, [
    { type: "text", text: "exit-on-permission" },
  ]);
  await seen;
  await assert.rejects(within(prompt, 1_000), /exited with code 7/);
  assert.equal(signal.aborted, true);
  assert.equal(client.running, false);
});

test("all RPCs have finite timeouts", async () => {
  const client = await AcpClient.start({
    command: process.execPath,
    args: [fakeAgent],
    requestTimeoutMs: 25,
  });

  try {
    await assert.rejects(
      client.request("test/never", {}, 0),
      /timeout must be a positive integer/,
    );
    await assert.rejects(
      client.request("test/never", {}),
      (error) =>
        error instanceof AcpRequestTimeoutError &&
        error.method === "test/never",
    );
  } finally {
    await client.shutdown();
  }
});

test("outbound session and prompt payloads are runtime validated", async () => {
  const client = await AcpClient.start({
    command: process.execPath,
    args: [fakeAgent],
  });

  try {
    await assert.rejects(
      client.newSession({
        cwd: process.cwd(),
        mcpServers: [{ name: "bad", command: process.execPath, url: "x" }],
      }),
      /mcpServers entries/,
    );
    const session = await client.newSession({
      cwd: process.cwd(),
      mcpServers: [],
    });
    await assert.rejects(
      client.prompt(session.sessionId, [{ type: "text" }]),
      /valid v1 content blocks/,
    );
  } finally {
    await client.shutdown();
  }
});

test("malformed initialize and prompt responses fail runtime validation", async () => {
  await assert.rejects(
    within(
      AcpClient.start({
        command: process.execPath,
        args: [malformedAgent],
        startupTimeoutMs: 2_000,
        shutdownTimeoutMs: 100,
      }),
      1_000,
    ),
    AcpProtocolError,
  );

  const client = await AcpClient.start({
    command: process.execPath,
    args: [fakeAgent],
    shutdownTimeoutMs: 100,
  });
  const session = await client.newSession({
    cwd: process.cwd(),
    mcpServers: [],
  });
  await assert.rejects(
    client.prompt(session.sessionId, [
      { type: "text", text: "malformed-response" },
    ]),
    AcpProtocolError,
  );
  await client.shutdown();
});

async function within(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`operation timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
