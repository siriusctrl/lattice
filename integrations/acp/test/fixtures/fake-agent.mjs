#!/usr/bin/env node

import { createInterface } from "node:readline";

const reader = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

let sessionCounter = 0;
let permissionCounter = 900;
const promptBySession = new Map();
const permissionById = new Map();

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function update(sessionId, update) {
  write({
    jsonrpc: "2.0",
    method: "session/update",
    params: { sessionId, update },
  });
}

function requestPermission(sessionId, promptId, waitingForCancel) {
  const permissionId = permissionCounter++;
  permissionById.set(permissionId, { sessionId, promptId, waitingForCancel });
  write({
    jsonrpc: "2.0",
    id: permissionId,
    method: "session/request_permission",
    params: {
      sessionId,
      toolCall: {
        toolCallId: `tool-${promptId}`,
        title: "Fake write",
        kind: "edit",
      },
      options: [
        {
          optionId: "allow-once",
          name: "Allow once",
          kind: "allow_once",
        },
        {
          optionId: "reject-once",
          name: "Reject",
          kind: "reject_once",
        },
      ],
    },
  });
}

function finishPrompt(sessionId, stopReason) {
  const pending = promptBySession.get(sessionId);
  if (!pending || pending.finished) {
    return;
  }
  pending.finished = true;
  write({
    jsonrpc: "2.0",
    id: pending.promptId,
    result: { stopReason },
  });
  promptBySession.delete(sessionId);
}

reader.on("line", (line) => {
  const message = JSON.parse(line);

  if (message.method === "initialize") {
    write({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: 1,
        agentCapabilities: {},
        agentInfo: {
          name: "lattice-fake-agent",
          version: "1.0.0",
        },
        authMethods: [],
      },
    });
    return;
  }

  if (message.method === "session/new") {
    write({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        sessionId: `fake-session-${++sessionCounter}`,
        _meta: {
          mcpServerCount: message.params.mcpServers.length,
        },
      },
    });
    return;
  }

  if (message.method === "session/prompt") {
    const sessionId = message.params.sessionId;
    const text = message.params.prompt
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    if (text.includes("malformed-response")) {
      write({
        jsonrpc: "2.0",
        id: message.id,
        result: { unexpected: true },
      });
      return;
    }
    if (text.includes("flood-events")) {
      for (let index = 0; index < 3_000; index++) {
        update(sessionId, {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text: `${index}:${"x".repeat(4096)}`,
          },
        });
      }
      write({
        jsonrpc: "2.0",
        id: message.id,
        result: { stopReason: "end_turn" },
      });
      return;
    }
    const waitingForCancel = text.includes("wait-for-cancel");
    const exitOnPermission = text.includes("exit-on-permission");
    promptBySession.set(sessionId, {
      promptId: message.id,
      waitingForCancel,
      exitOnPermission,
      cancelled: false,
      permissionDone: false,
      finished: false,
    });
    update(sessionId, {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "fake stream" },
    });
    setTimeout(
      () => {
        requestPermission(sessionId, message.id, waitingForCancel);
        if (exitOnPermission) {
          setTimeout(() => process.exit(7), 10);
        }
      },
      5,
    );
    return;
  }

  if (message.method === "test/never") {
    return;
  }

  if (message.method === "session/cancel") {
    const pending = promptBySession.get(message.params.sessionId);
    if (pending) {
      pending.cancelled = true;
      if (pending.permissionDone) {
        finishPrompt(message.params.sessionId, "cancelled");
      }
    }
    return;
  }

  if (
    Object.hasOwn(message, "id") &&
    !Object.hasOwn(message, "method") &&
    permissionById.has(message.id)
  ) {
    const permission = permissionById.get(message.id);
    permissionById.delete(message.id);
    const pending = promptBySession.get(permission.sessionId);
    if (!pending) {
      return;
    }
    pending.permissionDone = true;
    update(permission.sessionId, {
      sessionUpdate: "tool_call_update",
      toolCallId: `tool-${permission.promptId}`,
      status: "completed",
      permissionOutcome: message.result,
    });
    if (pending.waitingForCancel) {
      if (pending.cancelled) {
        finishPrompt(permission.sessionId, "cancelled");
      }
    } else {
      finishPrompt(permission.sessionId, "end_turn");
    }
  }
});

reader.on("close", () => {
  process.exit(0);
});
