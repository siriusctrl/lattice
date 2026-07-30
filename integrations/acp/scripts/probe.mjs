#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const fakeAgent = fileURLToPath(
  new URL("../test/fixtures/fake-agent.mjs", import.meta.url),
);
const token = "lattice-acp-probe";
const probeProjectDir = await mkdtemp(
  path.join(tmpdir(), "lattice-acp-probe-"),
);
const child = spawn(
  process.execPath,
  [
    cli,
    "--agent-command",
    process.execPath,
    "--agent-arg",
    fakeAgent,
    "--token",
    token,
    "--port",
    "0",
    "--cwd",
    probeProjectDir,
    "--lattice-url",
    "http://localhost:3000/",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
child.stderr.pipe(process.stderr);

try {
  const ready = await readReady(child);
  const workspaceUrl = new URL(ready.workspaceUrl);
  const encodedConfig = workspaceUrl.hash.replace(/^#acp=/, "");
  const workspaceConfig = JSON.parse(
    Buffer.from(encodedConfig, "base64url").toString("utf8"),
  );
  if (
    workspaceUrl.origin !== "http://localhost:3000" ||
    workspaceConfig.baseUrl !== ready.baseUrl ||
    workspaceConfig.token !== token ||
    workspaceConfig.cwd !== probeProjectDir ||
    workspaceConfig.workspaceId !== ready.workspaceId
  ) {
    throw new Error("CLI did not produce a usable fragment-only Lattice workspace URL");
  }
  const headers = { Authorization: `Bearer ${token}` };
  const abortEvents = new AbortController();
  const events = readSseEvents(
    `${ready.baseUrl}/v1/events`,
    headers,
    abortEvents.signal,
  );

  const session = await request(`${ready.baseUrl}/v1/sessions`, headers, {
    cwd: probeProjectDir,
  });
  const sessionId = session.data.sessionId;
  await request(
    `${ready.baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/prompts`,
    headers,
    { text: "probe the ACP bridge" },
  );
  const completed = await nextEvent(events, "turn.completed");
  if (completed.data.stopReason !== "end_turn") {
    throw new Error(`Unexpected stop reason: ${completed.data.stopReason}`);
  }

  const status = await fetch(`${ready.baseUrl}/v1/status`, { headers }).then(
    (response) => response.json(),
  );
  if (!status.ok || status.data.agent.agentInfo.name !== "lattice-fake-agent") {
    throw new Error("Status endpoint did not report the initialized fake agent");
  }

  abortEvents.abort();
  await request(`${ready.baseUrl}/v1/shutdown`, headers, {});
  const exit = await waitForExit(child, 5_000);
  if (exit.code !== 0) {
    throw new Error(`Sidecar exited with code ${exit.code}`);
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      protocolVersion: status.data.agent.protocolVersion,
      sessionId,
      stopReason: completed.data.stopReason,
    })}\n`,
  );
  await rm(probeProjectDir, { recursive: true, force: true });
} catch (error) {
  child.kill("SIGKILL");
  await rm(probeProjectDir, { recursive: true, force: true });
  throw error;
}

async function readReady(process_) {
  const lines = createInterface({ input: process_.stdout, crlfDelay: Infinity });
  return new Promise((resolve, reject) => {
    const onExit = (code) => {
      reject(new Error(`Sidecar exited before ready with code ${code}`));
    };
    process_.once("exit", onExit);
    lines.once("line", (line) => {
      process_.off("exit", onExit);
      resolve(JSON.parse(line));
    });
  });
}

async function request(url, headers, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function* readSseEvents(url, headers, signal) {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    throw new Error(`SSE connection failed with HTTP ${response.status}`);
  }
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
    const { done, value } = await events.next();
    if (done) {
      throw new Error(`SSE stream ended before ${type}`);
    }
    if (value.type === type) {
      return value;
    }
  }
}

async function waitForExit(process_, timeoutMs) {
  if (process_.exitCode !== null) {
    return { code: process_.exitCode, signal: process_.signalCode };
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Sidecar did not exit within ${timeoutMs}ms`));
    }, timeoutMs);
    process_.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}
