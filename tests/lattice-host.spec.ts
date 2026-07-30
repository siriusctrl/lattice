import { expect, test } from "@playwright/test";
import { getFollowupInlineContent } from "@/app/components/ResearchCard";
import { AcpHost } from "@/app/lib/acp-host";
import { DemoHost } from "@/app/lib/demo-host";
import {
  cancelLatticeRun,
  consumeFollowupRun,
  LatticeNavigationGeneration,
  recoverComposerQuestion,
  startLatticeRun,
  type FollowupTurn,
  type LatticeAskOutcome,
  type LatticeHost,
  type LatticeHostEvent,
  type LatticeHydration,
  type LatticeRun,
} from "@/app/lib/lattice-host";
import {
  MOCK_RESEARCH_NODES,
  ROOT_NODE_ID,
} from "@/app/lib/mock-research";

async function collect(events: AsyncIterable<LatticeHostEvent>) {
  const collected: LatticeHostEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(events: unknown[]) {
  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    },
  );
}

function durableStateResponse() {
  return jsonResponse({
    ok: true,
    data: {
      workspaceId: "workspace-test",
      storage: "project",
      projectDir: "/repo",
      latticeDir: "/repo/.lattice",
      workspace: {
        version: 1,
        revision: 1,
        rootNodeId: ROOT_NODE_ID,
        activeNodeId: ROOT_NODE_ID,
        nodes: [{
          id: ROOT_NODE_ID,
          title: "Root",
          shortTitle: "Root",
          lead: "Root lead",
          year: "Repository research",
          position: { x: 50, y: 50 },
          turns: [
            { id: "root-user", role: "user", content: "Root question", anchors: [] },
            { id: "root-assistant", role: "assistant", content: "Root answer", anchors: [] },
          ],
        }],
        edges: [],
        article: null,
        completedRequestIds: [],
        updatedAt: "2026-07-30T00:00:00.000Z",
      },
      uiState: {
        version: 1,
        activeNodeId: ROOT_NODE_ID,
        view: "explore",
        deckNodeIds: [ROOT_NODE_ID],
        updatedAt: null,
      },
    },
  });
}

function patchResponse(revision = 2) {
  return jsonResponse({
    ok: true,
    data: {
      ok: true,
      changed: true,
      workspaceId: "workspace-test",
      workspace: {
        version: 1,
        revision,
        rootNodeId: ROOT_NODE_ID,
        activeNodeId: ROOT_NODE_ID,
        nodes: [],
        edges: [],
        article: null,
        completedRequestIds: [],
        updatedAt: "2026-07-30T00:00:00.000Z",
      },
    },
  });
}

function emptyDurableStateResponse() {
  return jsonResponse({
    ok: true,
    data: {
      workspaceId: "workspace-test",
      storage: "empty",
      projectDir: "/repo",
      latticeDir: "/repo/.lattice",
      workspace: {
        version: 1,
        revision: 0,
        rootNodeId: null,
        activeNodeId: null,
        nodes: [],
        edges: [],
        article: null,
        completedRequestIds: [],
        updatedAt: null,
      },
      uiState: {
        version: 1,
        activeNodeId: null,
        view: "explore",
        deckNodeIds: [],
        updatedAt: null,
      },
    },
  });
}

test("AcpHost rejects non-loopback sidecars unless explicitly trusted", () => {
  expect(() => new AcpHost({
    baseUrl: "https://agent.example.com",
    token: "secret",
    cwd: "/repo",
  })).toThrow(/loopback/);
});

test("AcpHost serializes one ACP session and closes SSE after prompt rejection", async () => {
  let streamCancelled = false;
  const stream = new ReadableStream({
    cancel: () => {
      streamCancelled = true;
    },
  });
  const mockFetch = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/v1/lattice/state")) {
      return durableStateResponse();
    }
    if (url.endsWith("/v1/sessions")) {
      return jsonResponse({ ok: true, data: { sessionId: "session-busy" } }, 201);
    }
    if (url.includes("/v1/events?")) {
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    if (url.endsWith("/v1/sessions/session-busy/prompts")) {
      return jsonResponse({
        ok: false,
        error: { message: "This session already has a prompt in progress" },
      }, 409);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const host = new AcpHost({
    baseUrl: "http://127.0.0.1:43118",
    token: "secret",
    cwd: "/repo",
    fetch: mockFetch as typeof fetch,
  });
  const first = host.start({
    kind: "followup",
    requestId: "acp-busy-1",
    nodeId: ROOT_NODE_ID,
    question: "first",
    contextNodeIds: [ROOT_NODE_ID],
  });
  expect(() => host.start({
    kind: "followup",
    requestId: "acp-busy-2",
    nodeId: ROOT_NODE_ID,
    question: "second",
    contextNodeIds: [ROOT_NODE_ID],
  })).toThrow(/already has/);

  const events = await collect(first.events);
  expect(events.at(-1)).toMatchObject({
    type: "error",
    error: { message: "This session already has a prompt in progress" },
  });
  expect(streamCancelled).toBe(true);
});

test("AcpHost maps sidecar streaming updates into Lattice events", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const mockFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/v1/lattice/state")) {
      return durableStateResponse();
    }
    if (url.endsWith("/v1/lattice/patch")) {
      return patchResponse();
    }
    if (url.endsWith("/v1/sessions")) {
      return jsonResponse({ ok: true, data: { sessionId: "session-1" } }, 201);
    }
    if (url.includes("/v1/events?")) {
      return sseResponse([
        {
          sequence: 1,
          type: "session.update",
          sessionId: "session-1",
          turnId: "turn-1",
          data: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "先读代码，" },
          },
        },
        {
          sequence: 2,
          type: "session.update",
          sessionId: "session-1",
          turnId: "turn-1",
          data: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "再给结论。" },
          },
        },
        {
          sequence: 3,
          type: "turn.completed",
          sessionId: "session-1",
          turnId: "turn-1",
          data: { stopReason: "end_turn" },
        },
      ]);
    }
    if (url.endsWith("/v1/sessions/session-1/prompts")) {
      return jsonResponse({ ok: true, data: { turnId: "turn-1" } }, 202);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const host = new AcpHost({
    baseUrl: "http://127.0.0.1:43119",
    token: "secret",
    cwd: "/repo",
    fetch: mockFetch as typeof fetch,
  });

  const events = await collect(host.start({
    kind: "followup",
    requestId: "acp-followup",
    nodeId: ROOT_NODE_ID,
    sourceNode: MOCK_RESEARCH_NODES[ROOT_NODE_ID],
    question: "核心机制是什么？",
    contextNodeIds: [ROOT_NODE_ID],
  }).events);

  expect(events).toContainEqual({ type: "text_delta", text: "先读代码，" });
  expect(events).toContainEqual({ type: "text_delta", text: "再给结论。" });
  expect(events.at(-1)).toEqual({ type: "done" });
  const sessionCall = calls.find((call) => call.url.endsWith("/v1/sessions"));
  const sessionBody = JSON.parse(String(sessionCall?.init?.body));
  expect(sessionBody).not.toHaveProperty("mcpServers");
  const promptCall = calls.find((call) => call.url.endsWith("/prompts"));
  expect(String(promptCall?.init?.body)).toContain("核心机制是什么");
});

test("AcpHost confirms an ambiguous patch response against completed request ids", async () => {
  let committed = false;
  let stateReads = 0;
  const mockFetch = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/v1/lattice/state")) {
      stateReads += 1;
      const payload = await durableStateResponse().json() as {
        data: {
          workspace: {
            revision: number;
            completedRequestIds: string[];
          };
        };
      };
      if (committed) {
        payload.data.workspace.revision = 2;
        payload.data.workspace.completedRequestIds = ["ambiguous-request"];
      }
      return jsonResponse(payload);
    }
    if (url.endsWith("/v1/sessions")) {
      return jsonResponse({ ok: true, data: { sessionId: "session-ambiguous" } }, 201);
    }
    if (url.includes("/v1/events?")) {
      return sseResponse([
        {
          sequence: 1,
          type: "session.update",
          sessionId: "session-ambiguous",
          turnId: "turn-ambiguous",
          data: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "Durable answer." },
          },
        },
        {
          sequence: 2,
          type: "turn.completed",
          sessionId: "session-ambiguous",
          turnId: "turn-ambiguous",
          data: { stopReason: "end_turn" },
        },
      ]);
    }
    if (url.endsWith("/v1/sessions/session-ambiguous/prompts")) {
      return jsonResponse({
        ok: true,
        data: { turnId: "turn-ambiguous" },
      }, 202);
    }
    if (url.endsWith("/v1/lattice/patch")) {
      committed = true;
      throw new TypeError("Connection closed after commit.");
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const host = new AcpHost({
    baseUrl: "http://127.0.0.1:43123",
    token: "secret",
    cwd: "/repo",
    fetch: mockFetch as typeof fetch,
  });

  const events = await collect(host.start({
    kind: "followup",
    requestId: "ambiguous-request",
    nodeId: ROOT_NODE_ID,
    sourceNode: MOCK_RESEARCH_NODES[ROOT_NODE_ID],
    question: "Persist this once.",
    contextNodeIds: [ROOT_NODE_ID],
  }).events);

  expect(stateReads).toBe(2);
  expect(events.at(-1)).toEqual({ type: "done" });
  expect(events.some((event) => event.type === "error")).toBe(false);
});

test("AcpHost uses a fresh ACP session after cancelling a turn", async () => {
  let sessionCount = 0;
  let openFirstStream!: () => void;
  const firstStreamOpened = new Promise<void>((resolve) => {
    openFirstStream = resolve;
  });
  const mockFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    if (url.endsWith("/v1/lattice/state")) {
      return durableStateResponse();
    }
    if (url.endsWith("/v1/sessions")) {
      sessionCount += 1;
      return jsonResponse({
        ok: true,
        data: { sessionId: `session-cancel-${sessionCount}` },
      }, 201);
    }
    if (url.includes("/v1/events?") && url.includes("session-cancel-1")) {
      return new Response(new ReadableStream({
        start(controller) {
          openFirstStream();
          init?.signal?.addEventListener("abort", () => {
            controller.error(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        },
      }), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    if (url.includes("/v1/events?") && url.includes("session-cancel-2")) {
      return sseResponse([
        {
          sequence: 1,
          type: "session.update",
          sessionId: "session-cancel-2",
          turnId: "turn-after-cancel",
          data: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "Second session answer." },
          },
        },
        {
          sequence: 2,
          type: "turn.completed",
          sessionId: "session-cancel-2",
          turnId: "turn-after-cancel",
          data: { stopReason: "end_turn" },
        },
      ]);
    }
    if (url.endsWith("/v1/sessions/session-cancel-1/prompts")) {
      return jsonResponse({ ok: true, data: { turnId: "turn-cancelled" } }, 202);
    }
    if (url.endsWith("/v1/sessions/session-cancel-1/cancel")) {
      return jsonResponse({ ok: true, data: {} }, 202);
    }
    if (url.endsWith("/v1/sessions/session-cancel-2/prompts")) {
      return jsonResponse({
        ok: true,
        data: { turnId: "turn-after-cancel" },
      }, 202);
    }
    if (url.endsWith("/v1/lattice/patch")) {
      return patchResponse();
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const host = new AcpHost({
    baseUrl: "http://127.0.0.1:43124",
    token: "secret",
    cwd: "/repo",
    fetch: mockFetch as typeof fetch,
  });
  const first = host.start({
    kind: "followup",
    requestId: "cancel-first",
    nodeId: ROOT_NODE_ID,
    question: "Cancel me.",
    contextNodeIds: [ROOT_NODE_ID],
  });
  const firstEvents = collect(first.events);
  await firstStreamOpened;
  await first.cancel();
  await firstEvents;

  const secondEvents = await collect(host.start({
    kind: "followup",
    requestId: "after-cancel",
    nodeId: ROOT_NODE_ID,
    question: "Try again.",
    contextNodeIds: [ROOT_NODE_ID],
  }).events);

  expect(sessionCount).toBe(2);
  expect(secondEvents.at(-1)).toEqual({ type: "done" });
});

test("AcpHost turns a structured selection response into a sourced Card", async () => {
  const envelope =
    '<lattice-node>{"title":"验证边界","shortTitle":"边界","year":"代码研究","lead":"从选区追到实现。","paragraphs":["这段代码把浏览器与进程控制隔开。"],"anchors":[{"label":"回到根节点","target":"musk","hint":"查看来源"}]}</lattice-node>';
  const mockFetch = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/v1/lattice/state")) {
      return durableStateResponse();
    }
    if (url.endsWith("/v1/lattice/patch")) {
      return patchResponse();
    }
    if (url.endsWith("/v1/sessions")) {
      return jsonResponse({ ok: true, data: { sessionId: "session-2" } }, 201);
    }
    if (url.includes("/v1/events?")) {
      return sseResponse([
        {
          sequence: 1,
          type: "session.update",
          sessionId: "session-2",
          turnId: "turn-2",
          data: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: envelope },
          },
        },
        {
          sequence: 2,
          type: "turn.completed",
          sessionId: "session-2",
          turnId: "turn-2",
          data: { stopReason: "end_turn" },
        },
      ]);
    }
    if (url.endsWith("/v1/sessions/session-2/prompts")) {
      return jsonResponse({ ok: true, data: { turnId: "turn-2" } }, 202);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const host = new AcpHost({
    baseUrl: "http://127.0.0.1:43120",
    token: "secret",
    cwd: "/repo",
    fetch: mockFetch as typeof fetch,
  });
  const events = await collect(host.start({
    kind: "selection_fork",
    requestId: "acp-selection",
    sourceNode: MOCK_RESEARCH_NODES[ROOT_NODE_ID],
    selectionText: "浏览器与进程控制隔开",
    suggestedNodeId: "selection-acp",
    selectionIndex: 1,
    contextNodeIds: [ROOT_NODE_ID],
  }).events);
  const result = events.find((event) => event.type === "result");

  expect(result).toMatchObject({
    type: "result",
    result: {
      kind: "selection_fork",
      sourceNodeId: ROOT_NODE_ID,
      node: {
        id: "selection-acp",
        title: "验证边界",
        blocks: expect.arrayContaining([
          {
            kind: "paragraph",
            content: ["这段代码把浏览器与进程控制隔开。"],
          },
        ]),
      },
    },
  });
});

test("AcpHost hydrates a durable workspace and its saved reading position", async () => {
  const host = new AcpHost({
    baseUrl: "http://127.0.0.1:43121",
    token: "secret",
    cwd: "/repo",
    fetch: (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/v1/lattice/state")) {
        return durableStateResponse();
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch,
  });

  const hydration = await host.load();

  expect(hydration).toMatchObject({
    revision: 1,
    rootNodeId: ROOT_NODE_ID,
    activeNodeId: ROOT_NODE_ID,
    storage: "project",
    deckNodeIds: [ROOT_NODE_ID],
    nodes: {
      [ROOT_NODE_ID]: {
        title: "Root",
        userPrompt: "Root question",
        blocks: [{ kind: "paragraph", content: ["Root answer"] }],
      },
    },
  });
});

test("AcpHost creates and persists an agent-owned root Card for an empty repo", async () => {
  const envelope =
    '<lattice-root>{"title":"Lattice runtime","shortTitle":"Runtime","year":"Repository research","lead":"A shared durable graph.","answer":"ACP and the Codex plugin write the same project-local schema."}</lattice-root>';
  let stored: Record<string, unknown> | null = null;
  let patchBody: Record<string, unknown> | null = null;
  const mockFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    if (url.endsWith("/v1/lattice/state")) {
      if (!stored) return emptyDurableStateResponse();
      return jsonResponse({
        ok: true,
        data: {
          workspaceId: "workspace-test",
          storage: "project",
          projectDir: "/repo",
          latticeDir: "/repo/.lattice",
          workspace: stored,
          uiState: {
            version: 1,
            activeNodeId: "lattice-root",
            view: "explore",
            deckNodeIds: ["lattice-root"],
            updatedAt: null,
          },
        },
      });
    }
    if (url.endsWith("/v1/sessions")) {
      return jsonResponse({ ok: true, data: { sessionId: "session-root" } }, 201);
    }
    if (url.includes("/v1/events?")) {
      return sseResponse([
        {
          sequence: 1,
          type: "session.update",
          sessionId: "session-root",
          turnId: "turn-root",
          data: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: envelope },
          },
        },
        {
          sequence: 2,
          type: "turn.completed",
          sessionId: "session-root",
          turnId: "turn-root",
          data: { stopReason: "end_turn" },
        },
      ]);
    }
    if (url.endsWith("/v1/sessions/session-root/prompts")) {
      return jsonResponse({ ok: true, data: { turnId: "turn-root" } }, 202);
    }
    if (url.endsWith("/v1/lattice/patch")) {
      patchBody = JSON.parse(String(init?.body));
      const patch = patchBody?.patch as {
        addNodes: unknown[];
        rootNodeId: string;
        activeNodeId: string;
        completeRequestId: string;
      };
      stored = {
        version: 1,
        revision: 1,
        rootNodeId: patch.rootNodeId,
        activeNodeId: patch.activeNodeId,
        nodes: patch.addNodes,
        edges: [],
        article: null,
        completedRequestIds: [patch.completeRequestId],
        updatedAt: "2026-07-30T00:00:00.000Z",
      };
      return jsonResponse({
        ok: true,
        data: {
          ok: true,
          changed: true,
          workspaceId: "workspace-test",
          workspace: stored,
        },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const host = new AcpHost({
    baseUrl: "http://127.0.0.1:43122",
    token: "secret",
    cwd: "/repo",
    workspaceId: "workspace-test",
    fetch: mockFetch as typeof fetch,
  });

  const initial = await host.load();
  expect(initial.storage).toBe("empty");
  expect(initial.rootNodeId).toBeNull();
  expect(initial.activeNodeId).toBeNull();
  expect(initial.nodes).toEqual({});

  const events = await collect(host.start({
    kind: "followup",
    requestId: "root-request",
    nodeId: "lattice-root",
    question: "How does the runtime work?",
    contextNodeIds: [],
  }).events);

  expect(events.some((event) => event.type === "text_delta")).toBe(false);
  expect(events).toContainEqual(expect.objectContaining({
    type: "workspace",
    hydration: expect.objectContaining({
      storage: "project",
      rootNodeId: "lattice-root",
      nodes: expect.objectContaining({
        "lattice-root": expect.objectContaining({
          title: "Lattice runtime",
          shortTitle: "Runtime",
        }),
      }),
    }),
  }));
  expect(events.at(-1)).toEqual({ type: "done" });
  expect(patchBody).toMatchObject({
    workspaceId: "workspace-test",
    expectedRevision: 0,
    patch: {
      rootNodeId: "lattice-root",
      completeRequestId: "root-request",
    },
  });
});

test("an empty ACP workspace renders only the blank research composer", async ({
  page,
}) => {
  const baseUrl = "http://127.0.0.1:43125";
  await page.route(`${baseUrl}/v1/lattice/state`, async (route) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: await emptyDurableStateResponse().text(),
    });
  });
  const config = Buffer.from(JSON.stringify({
    baseUrl,
    token: "secret",
    cwd: "/repo",
    workspaceId: "workspace-test",
  })).toString("base64url");

  await page.goto(`/#acp=${config}`);

  await expect(page.getByTestId("empty-research-workspace")).toBeVisible();
  await expect(page.getByLabel("研究问题")).toBeVisible();
  await expect(page.locator(".empty-research-error")).toHaveCount(0);
  await expect(page.locator(".research-card")).toHaveCount(0);
  await expect(page.locator(".graph-preview")).toHaveCount(0);
  await expect(page.locator(".topbar")).toHaveCount(0);
});

test("DemoHost returns the deterministic followup through the host protocol", async () => {
  const host = new DemoHost({ followupDelayMs: 0 });
  const run = host.start({
    kind: "followup",
    requestId: "followup-test",
    nodeId: "spacex",
    question: "为什么连续验证重要？",
    contextNodeIds: [ROOT_NODE_ID, "spacex"],
  });

  const events = await collect(run.events);

  expect(events[0]).toEqual({ type: "status", status: "thinking" });
  expect(events.at(-1)).toEqual({ type: "done" });
  expect(events).toContainEqual({
    type: "result",
    result: {
      kind: "followup",
      nodeId: "spacex",
      turn: {
        id: "followup-test",
        question: "为什么连续验证重要？",
        answer:
          "SpaceX 把一个遥远使命拆成了连续工程验证。每次失败都必须换回足够多的信息，否则下一次尝试就失去资金与时间依据。",
      },
    },
  });
});

test("DemoHost returns a complete sourced selection fork", async () => {
  const host = new DemoHost({ followupDelayMs: 0 });
  const sourceNode = MOCK_RESEARCH_NODES.spacex;
  const run = host.start({
    kind: "selection_fork",
    requestId: "selection-fork-test",
    sourceNode,
    selectionText: "连续工程验证",
    suggestedNodeId: "selection-test",
    selectionIndex: 1,
    contextNodeIds: [ROOT_NODE_ID, sourceNode.id],
  });

  const events = await collect(run.events);
  const resultEvent = events.find((event) => event.type === "result");

  expect(resultEvent).toMatchObject({
    type: "result",
    result: {
      kind: "selection_fork",
      sourceNodeId: sourceNode.id,
      node: {
        id: "selection-test",
        lead: "“连续工程验证”",
      },
      edge: {
        from: sourceNode.id,
        to: "selection-test",
        kind: "fork",
      },
    },
  });
});

test("DemoHost cancellation interrupts a pending followup", async () => {
  const host = new DemoHost({ followupDelayMs: 60_000 });
  const run = host.start({
    kind: "followup",
    requestId: "followup-cancel",
    nodeId: ROOT_NODE_ID,
    question: "取消这次运行",
    contextNodeIds: [ROOT_NODE_ID],
  });
  const eventsPromise = collect(run.events);

  await Promise.resolve();
  await run.cancel("test_cancelled");

  await expect(eventsPromise).resolves.toEqual([
    { type: "status", status: "thinking" },
    { type: "cancelled", reason: "test_cancelled" },
  ]);
});

test("stream deltas and anchors become one complete followup at EOF", async () => {
  const events = async function* (): AsyncGenerator<LatticeHostEvent> {
    yield { type: "status", status: "thinking" };
    yield { type: "text_delta", text: "先验证" };
    yield { type: "text_delta", text: "，再扩展。" };
    yield {
      type: "anchor",
      anchor: {
        kind: "anchor",
        label: "风险逻辑",
        target: "risk",
        hint: "查看综合节点",
      },
    };
  };
  const run: LatticeRun = {
    id: "stream-test",
    events: events(),
    cancel: async () => undefined,
  };
  const drafts: string[] = [];
  const results: FollowupTurn[] = [];

  const outcome = await consumeFollowupRun(
    run,
    "spacex",
    "应该如何扩展？",
    {
      onDraft: (turn) => {
        if (turn) drafts.push(turn.answer);
      },
      onResult: (turn) => results.push(turn),
    },
  );

  expect(outcome).toEqual({ status: "completed" });
  expect(drafts).toEqual(["先验证", "先验证，再扩展。", "先验证，再扩展。"]);
  expect(results).toEqual([
    {
      id: "stream-test",
      question: "应该如何扩展？",
      answer: "先验证，再扩展。",
      anchors: [
        {
          kind: "anchor",
          label: "风险逻辑",
          target: "risk",
          hint: "查看综合节点",
        },
      ],
    },
  ]);

  expect(getFollowupInlineContent(results[0])).toEqual([
    "先验证，再扩展。",
    " ",
    {
      kind: "anchor",
      label: "风险逻辑",
      target: "risk",
      hint: "查看综合节点",
    },
  ]);
});

test("a durable workspace replacement completes the first repository question", async () => {
  const hydration = {
    revision: 1,
    rootNodeId: "lattice-root",
    activeNodeId: "lattice-root",
    nodes: {
      "lattice-root": {
        id: "lattice-root",
        title: "Repository runtime",
        shortTitle: "Runtime",
        year: "Repository research",
        userPrompt: "How does it work?",
        lead: "A durable root.",
        blocks: [{ kind: "paragraph" as const, content: ["Shared storage."] }],
        position: { x: 50, y: 50 },
      },
    },
    edges: [],
    followups: {},
    storage: "project" as const,
  };
  const events = async function* (): AsyncGenerator<LatticeHostEvent> {
    yield { type: "workspace", hydration };
    yield { type: "done" };
  };
  let received: LatticeHydration | null = null;

  const outcome = await consumeFollowupRun(
    {
      id: "root-request",
      events: events(),
      cancel: async () => {},
    },
    "lattice-root",
    "How does it work?",
    {
      onDraft: () => {},
      onResult: () => {
        throw new Error("Root creation must not duplicate the answer as a follow-up.");
      },
      onWorkspace: (next) => {
        received = next;
      },
    },
  );

  expect(outcome).toEqual({ status: "completed" });
  expect(received).toEqual(hydration);
});

test("empty EOF is a recoverable failure and restores the composer draft", async () => {
  const run: LatticeRun = {
    id: "empty-eof",
    events: (async function* () {
      yield { type: "status", status: "thinking" } as const;
    })(),
    cancel: async () => undefined,
  };

  const outcome = await consumeFollowupRun(
    run,
    ROOT_NODE_ID,
    "不要丢掉我",
    {
      onDraft: () => undefined,
      onResult: () => {
        throw new Error("Unexpected result");
      },
    },
  );

  expect(outcome.status).toBe("failed");
  expect(recoverComposerQuestion("", "不要丢掉我", outcome)).toBe(
    "不要丢掉我",
  );
});

test("throwing streams fail cleanly and preserve newer composer text", async () => {
  const throwingHost: LatticeHost = {
    start: () => ({
      id: "throwing-stream",
      events: (async function* () {
        throw new Error("transport unavailable");
      })(),
      cancel: async () => undefined,
    }),
  };
  const run = throwingHost.start({
    kind: "followup",
    requestId: "throwing-stream",
    nodeId: ROOT_NODE_ID,
    question: "原始问题",
    contextNodeIds: [ROOT_NODE_ID],
  });

  const outcome = await consumeFollowupRun(
    run,
    ROOT_NODE_ID,
    "原始问题",
    {
      onDraft: () => undefined,
      onResult: () => undefined,
    },
  );

  expect(outcome).toEqual({
    status: "failed",
    message: "transport unavailable",
  });
  expect(recoverComposerQuestion("", "原始问题", outcome)).toBe(
    "原始问题",
  );
  expect(recoverComposerQuestion("新的草稿", "原始问题", outcome)).toBe(
    "新的草稿",
  );
});

test("a synchronously throwing host reports a recoverable start failure", () => {
  const throwingHost: LatticeHost = {
    start: () => {
      throw new Error("host did not start");
    },
  };
  const started = startLatticeRun(throwingHost, {
    kind: "followup",
    requestId: "throwing-start",
    nodeId: ROOT_NODE_ID,
    question: "保留问题",
    contextNodeIds: [ROOT_NODE_ID],
  });

  expect(started).toEqual({
    ok: false,
    message: "host did not start",
  });
  if (started.ok) throw new Error("Expected start failure");
  expect(
    recoverComposerQuestion("", "保留问题", {
      status: "failed",
      message: started.message,
    }),
  ).toBe("保留问题");
});

test("a slow fork cannot commit after its navigation generation changes", async () => {
  let release: (() => void) | undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const slowHost: LatticeHost = {
    start: (request) => ({
      id: request.requestId,
      events: (async function* () {
        await released;
        yield {
          type: "result",
          result: {
            kind: "selection_fork",
            sourceNodeId: ROOT_NODE_ID,
            node: MOCK_RESEARCH_NODES.risk,
            edge: {
              from: ROOT_NODE_ID,
              to: "risk",
              kind: "fork",
            },
          },
        } satisfies LatticeHostEvent;
      })(),
      cancel: async () => undefined,
    }),
  };
  const generation = new LatticeNavigationGeneration();
  const snapshot = generation.snapshot();
  const run = slowHost.start({
    kind: "selection_fork",
    requestId: "slow-fork",
    sourceNode: MOCK_RESEARCH_NODES[ROOT_NODE_ID],
    selectionText: "风险",
    suggestedNodeId: "selection-slow",
    selectionIndex: 1,
    contextNodeIds: [ROOT_NODE_ID],
  });
  let commits = 0;
  const consume = (async () => {
    for await (const event of run.events) {
      if (
        event.type === "result" &&
        generation.isCurrent(snapshot)
      ) {
        commits += 1;
      }
    }
  })();

  generation.invalidate();
  release?.();
  await consume;

  expect(commits).toBe(0);
});

test("cancellation rejection is swallowed", async () => {
  const run: LatticeRun = {
    id: "rejecting-cancel",
    events: (async function* () {})(),
    cancel: async () => {
      throw new Error("already closed");
    },
  };

  await expect(
    cancelLatticeRun(run, "test_navigation"),
  ).resolves.toBeUndefined();
});

test("explicit error outcomes restore the submitted composer question", () => {
  const outcome: LatticeAskOutcome = {
    status: "failed",
    message: "host failed to start",
  };
  expect(recoverComposerQuestion("", "保留这条问题", outcome)).toBe(
    "保留这条问题",
  );
});
