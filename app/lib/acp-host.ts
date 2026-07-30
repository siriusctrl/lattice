import type {
  GraphPosition,
  InlineText,
  ResearchBlock,
  ResearchNode,
} from "@/app/lib/mock-research";
import type {
  LatticeHost,
  LatticeHostEvent,
  LatticeHydration,
  LatticeHostRequest,
  LatticeRun,
  LatticeUiState,
  FollowupTurn,
  ResearchAnchor,
} from "@/app/lib/lattice-host";

type FetchLike = typeof fetch;

export type AcpHostOptions = {
  baseUrl: string;
  token: string;
  cwd: string;
  workspaceId?: string;
  additionalDirectories?: string[];
  fetch?: FetchLike;
  requestTimeoutMs?: number;
  allowRemote?: boolean;
};

type SidecarEvent = {
  sequence: number;
  type: string;
  sessionId?: string;
  turnId?: string;
  data?: unknown;
};

type SelectionEnvelope = {
  title?: unknown;
  shortTitle?: unknown;
  year?: unknown;
  lead?: unknown;
  paragraphs?: unknown;
  insight?: unknown;
  anchors?: unknown;
};

type RootEnvelope = {
  title?: unknown;
  shortTitle?: unknown;
  year?: unknown;
  lead?: unknown;
  answer?: unknown;
};

type DurableAnchor = {
  label: string;
  targetNodeId: string;
  hint: string;
};

type DurableTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  anchors: DurableAnchor[];
};

type DurableNode = {
  id: string;
  title: string;
  shortTitle: string;
  lead: string;
  year: string;
  position: GraphPosition | null;
  turns: DurableTurn[];
};

type DurableWorkspace = {
  revision: number;
  rootNodeId: string | null;
  activeNodeId: string | null;
  nodes: DurableNode[];
  edges: Array<{
    from: string;
    to: string;
    kind: "fork" | "synthesis";
  }>;
  completedRequestIds: string[];
};

type DurableState = {
  workspaceId: string;
  storage: "project" | "empty";
  workspace: DurableWorkspace;
  uiState: {
    activeNodeId: string | null;
    view: "explore" | "article";
    deckNodeIds: string[];
  };
};

const SELECTION_START = "<lattice-node>";
const SELECTION_END = "</lattice-node>";
const ROOT_START = "<lattice-root>";
const ROOT_END = "</lattice-root>";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function messageOf(value: unknown, fallback: string) {
  const object = record(value);
  const error = record(object?.error);
  return typeof error?.message === "string"
    ? error.message
    : fallback;
}

function text(value: unknown, fallback = "", maximum = 120_000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maximum)
    : fallback;
}

function selectionPosition(
  source: ResearchNode,
  selectionIndex: number,
): GraphPosition {
  const offsets = [-16, 18, -24, 25];
  return {
    x: Math.min(92, source.position.x + 17 + (selectionIndex % 2) * 4),
    y: Math.max(
      8,
      Math.min(
        92,
        source.position.y +
          offsets[(selectionIndex - 1) % offsets.length],
      ),
    ),
  };
}

function parseSelectionEnvelope(output: string): SelectionEnvelope | null {
  const start = output.lastIndexOf(SELECTION_START);
  const end = output.indexOf(SELECTION_END, start + SELECTION_START.length);
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(
      output.slice(start + SELECTION_START.length, end).trim(),
    ) as SelectionEnvelope;
  } catch {
    return null;
  }
}

function parseRootEnvelope(output: string): RootEnvelope | null {
  const start = output.lastIndexOf(ROOT_START);
  const end = output.indexOf(ROOT_END, start + ROOT_START.length);
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(
      output.slice(start + ROOT_START.length, end).trim(),
    ) as RootEnvelope;
  } catch {
    return null;
  }
}

function researchBlocks(
  content: string,
  anchors: ResearchAnchor[] = [],
): ResearchBlock[] {
  const blocks: ResearchBlock[] = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 24)
    .map((paragraph) => ({
      kind: "paragraph" as const,
      content: [paragraph],
    }));
  if (anchors.length > 0) {
    const anchorContent: InlineText[] = ["继续查看："];
    anchors.forEach((anchor, index) => {
      if (index > 0) anchorContent.push("、");
      anchorContent.push(anchor);
    });
    blocks.push({ kind: "paragraph", content: anchorContent });
  }
  return blocks.length > 0
    ? blocks
    : [{ kind: "paragraph", content: ["研究结果为空。"] }];
}

function durableAnchors(anchors: ResearchAnchor[] = []): DurableAnchor[] {
  return anchors.map((anchor) => ({
    label: anchor.label,
    targetNodeId: anchor.target,
    hint: anchor.hint,
  }));
}

function browserAnchors(anchors: DurableAnchor[] = []): ResearchAnchor[] {
  return anchors.map((anchor) => ({
    kind: "anchor",
    label: anchor.label,
    target: anchor.targetNodeId,
    hint: anchor.hint,
  }));
}

function durableNodeToResearchNode(
  node: DurableNode,
  index: number,
): ResearchNode {
  const firstUser = node.turns.find((turn) => turn.role === "user");
  const firstAssistant = node.turns.find((turn) => turn.role === "assistant");
  const anchors = browserAnchors(firstAssistant?.anchors);
  return {
    id: node.id,
    title: node.title,
    shortTitle: node.shortTitle,
    year: node.year,
    userPrompt: firstUser?.content ?? "继续研究这个节点。",
    lead: node.lead,
    blocks: researchBlocks(firstAssistant?.content ?? node.lead, anchors),
    position: node.position ?? {
      x: 14 + (index % 5) * 18,
      y: 18 + (Math.floor(index / 5) % 4) * 22,
    },
  };
}

function followupsFromNode(node: DurableNode): FollowupTurn[] {
  const turns = node.turns;
  const firstAssistantIndex = turns.findIndex(
    (turn) => turn.role === "assistant",
  );
  if (firstAssistantIndex < 0) return [];
  const followups: FollowupTurn[] = [];
  for (let index = firstAssistantIndex + 1; index < turns.length; index += 1) {
    const question = turns[index];
    const answer = turns[index + 1];
    if (question?.role !== "user" || answer?.role !== "assistant") continue;
    const anchors = browserAnchors(answer.anchors);
    followups.push({
      id: answer.id,
      question: question.content,
      answer: answer.content,
      ...(anchors.length > 0 ? { anchors } : {}),
    });
    index += 1;
  }
  return followups;
}

function emptyHydration(
  workspaceId: string,
  view: "explore" | "article" = "explore",
): LatticeHydration {
  return {
    workspaceId,
    revision: 0,
    rootNodeId: null,
    activeNodeId: null,
    storage: "empty",
    nodes: {},
    edges: [],
    followups: {},
    deckNodeIds: [],
    view,
  };
}

function hydrationFromState(state: DurableState): LatticeHydration {
  if (
    state.workspace.revision === 0 ||
    !state.workspace.rootNodeId ||
    state.workspace.nodes.length === 0
  ) {
    return emptyHydration(state.workspaceId, state.uiState.view);
  }
  const nodes = Object.fromEntries(
    state.workspace.nodes.map((node, index) => [
      node.id,
      durableNodeToResearchNode(node, index),
    ]),
  );
  const followups = Object.fromEntries(
    state.workspace.nodes
      .map((node) => [node.id, followupsFromNode(node)] as const)
      .filter(([, turns]) => turns.length > 0),
  );
  const rootNodeId = state.workspace.rootNodeId;
  const activeNodeId =
    state.uiState.activeNodeId ??
    state.workspace.activeNodeId ??
    rootNodeId;
  return {
    workspaceId: state.workspaceId,
    revision: state.workspace.revision,
    rootNodeId,
    activeNodeId: nodes[activeNodeId] ? activeNodeId : rootNodeId,
    nodes,
    edges: state.workspace.edges,
    followups,
    deckNodeIds: state.uiState.deckNodeIds.filter((id) => nodes[id]),
    view: state.uiState.view,
    storage: state.storage,
  };
}

function parseDurableState(
  value: unknown,
  fallbackWorkspaceId?: string,
): DurableState {
  const outer = record(value);
  const state = record(outer?.data);
  const workspace = record(state?.workspace);
  const uiState = record(state?.uiState);
  const workspaceId =
    typeof state?.workspaceId === "string" && state.workspaceId
      ? state.workspaceId
      : fallbackWorkspaceId;
  if (
    !workspaceId ||
    (state?.storage !== "project" && state?.storage !== "empty") ||
    !workspace ||
    !uiState ||
    !Number.isInteger(workspace.revision) ||
    !Array.isArray(workspace.nodes) ||
    !Array.isArray(workspace.edges)
  ) {
    throw new Error("ACP sidecar returned invalid Lattice state.");
  }
  return {
    ...(state as unknown as DurableState),
    workspaceId,
  };
}

function buildSelectionResult(
  request: Extract<LatticeHostRequest, { kind: "selection_fork" }>,
  output: string,
) {
  const envelope = parseSelectionEnvelope(output);
  const excerpt =
    request.selectionText.length > 20
      ? `${request.selectionText.slice(0, 20)}…`
      : request.selectionText;
  const allowedTargets = new Set(request.contextNodeIds);
  const anchors: ResearchAnchor[] = Array.isArray(envelope?.anchors)
    ? envelope.anchors.flatMap((candidate) => {
        const value = record(candidate);
        const target = text(value?.target, "", 128);
        const label = text(value?.label, "", 160);
        if (!target || !label || !allowedTargets.has(target)) return [];
        return [{
          kind: "anchor" as const,
          label,
          target,
          hint: text(value?.hint, "", 300),
        }];
      })
    : [];
  const paragraphs = Array.isArray(envelope?.paragraphs)
    ? envelope.paragraphs
        .map((paragraph) => text(paragraph))
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const fallbackAnswer = output
    .replace(SELECTION_START, "")
    .replace(SELECTION_END, "")
    .trim();
  const blocks: ResearchBlock[] = (
    paragraphs.length > 0
      ? paragraphs
      : [
          fallbackAnswer ||
            `这条研究分支来自“${request.sourceNode.shortTitle}”中的选中文本。`,
        ]
  ).map((paragraph) => ({
    kind: "paragraph",
    content: [paragraph],
  }));
  if (anchors.length > 0) {
    const content: InlineText[] = ["继续查看："];
    anchors.forEach((anchor, index) => {
      if (index > 0) content.push("、");
      content.push(anchor);
    });
    blocks.push({ kind: "paragraph", content });
  }
  const insight = record(envelope?.insight);
  const insightContent = text(insight?.content);
  if (insightContent) {
    blocks.push({
      kind: "insight",
      label: text(insight?.label, "研究线索", 80),
      content: insightContent,
    });
  }

  const node: ResearchNode = {
    id: request.suggestedNodeId,
    shortTitle: text(envelope?.shortTitle, `选中：${excerpt}`, 80),
    title: text(envelope?.title, "选中的研究线索", 240),
    year: text(envelope?.year, "用户选中", 80),
    userPrompt: `解释这段内容，并说明为什么它值得成为独立研究节点：“${request.selectionText}”`,
    lead: text(envelope?.lead, `“${request.selectionText.slice(0, 64)}”`, 1200),
    blocks,
    position: selectionPosition(request.sourceNode, request.selectionIndex),
  };
  return {
    kind: "selection_fork" as const,
    sourceNodeId: request.sourceNode.id,
    node,
    edge: {
      from: request.sourceNode.id,
      to: node.id,
      kind: "fork" as const,
    },
  };
}

function buildPrompt(request: LatticeHostRequest, createRoot: boolean) {
  if (request.kind === "followup") {
    if (createRoot) {
      return [
        "You are creating the root Card of a new Lattice repository research workspace.",
        "Research the current repository and answer the user's question. You own the stable node title and short title. End with exactly one strict JSON object between the sentinels. Do not put markdown fences around it.",
        `${ROOT_START}{"title":"...","shortTitle":"...","year":"Repository research","lead":"...","answer":"complete reader-facing answer"}${ROOT_END}`,
        JSON.stringify({
          kind: "root_research",
          question: request.question,
          contextNodeIds: request.contextNodeIds,
        }),
      ].join("\n\n");
    }
    return [
      "You are researching inside Lattice. Answer the follow-up using the current repository and the supplied Card context.",
      "Return only the reader-facing answer. Do not describe this protocol and do not wrap the answer in JSON.",
      JSON.stringify({
        kind: request.kind,
        question: request.question,
        activeCard: request.sourceNode ?? { id: request.nodeId },
        contextNodeIds: request.contextNodeIds,
      }),
    ].join("\n\n");
  }
  return [
    "You are creating one sourced Lattice research Card from selected text.",
    "Research the current repository when relevant. End with exactly one strict JSON object between the sentinels below. Do not put markdown fences around it.",
    `${SELECTION_START}{"title":"...","shortTitle":"...","year":"...","lead":"...","paragraphs":["..."],"insight":{"label":"...","content":"..."},"anchors":[{"label":"...","target":"an existing contextNodeId","hint":"..."}]}${SELECTION_END}`,
    JSON.stringify({
      selectedText: request.selectionText,
      sourceCard: request.sourceNode,
      contextNodeIds: request.contextNodeIds,
    }),
  ].join("\n\n");
}

async function* parseSse(
  response: Response,
  signal: AbortSignal,
): AsyncGenerator<SidecarEvent> {
  if (!response.body) throw new Error("ACP sidecar returned an empty event stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary).replaceAll("\r", "");
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) {
          const parsed = JSON.parse(data) as unknown;
          const valueRecord = record(parsed);
          if (
            valueRecord &&
            Number.isInteger(valueRecord.sequence) &&
            typeof valueRecord.type === "string"
          ) {
            yield parsed as SidecarEvent;
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export class AcpHost implements LatticeHost {
  readonly baseUrl: string;
  readonly token: string;
  readonly cwd: string;
  readonly workspaceId?: string;
  readonly additionalDirectories: string[];
  readonly requestTimeoutMs: number;

  #fetch: FetchLike;
  #sessionPromise: Promise<string> | null = null;
  #statePromise: Promise<DurableState> | null = null;
  #state: DurableState | null = null;
  #lastSequence = 0;
  #activeRunId: string | null = null;

  constructor(options: AcpHostOptions) {
    const parsed = new URL(options.baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("ACP sidecar baseUrl must use http or https.");
    }
    const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
    if (!options.allowRemote && !loopbackHosts.has(parsed.hostname)) {
      throw new Error(
        "ACP sidecar must use a loopback address unless allowRemote is explicitly enabled.",
      );
    }
    if (!options.token.trim()) throw new Error("ACP sidecar token is required.");
    if (!options.cwd.trim()) throw new Error("ACP working directory is required.");
    this.baseUrl = parsed.toString().replace(/\/$/, "");
    this.token = options.token;
    this.cwd = options.cwd;
    this.workspaceId = options.workspaceId?.trim() || undefined;
    this.additionalDirectories = options.additionalDirectories ?? [];
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.#fetch =
      options.fetch ??
      ((input, init) => globalThis.fetch(input, init));
  }

  async load(): Promise<LatticeHydration> {
    return hydrationFromState(await this.#workspaceState());
  }

  async saveUiState(uiState: LatticeUiState): Promise<void> {
    await this.#json("/v1/lattice/ui-state", {
      method: "POST",
      body: JSON.stringify({
        ...(this.workspaceId ? { workspaceId: this.workspaceId } : {}),
        uiState,
      }),
    });
    if (this.#state) {
      this.#state = {
        ...this.#state,
        uiState: {
          activeNodeId: uiState.activeNodeId,
          view: uiState.view,
          deckNodeIds: uiState.deckNodeIds,
        },
      };
      this.#statePromise = Promise.resolve(this.#state);
    }
  }

  start(request: LatticeHostRequest): LatticeRun {
    if (this.#activeRunId) {
      throw new Error("This ACP session already has a Lattice request in progress.");
    }
    this.#activeRunId = request.requestId;
    const controller = new AbortController();
    let sessionId: string | null = null;
    const events = this.#run(request, controller, (value) => {
      sessionId = value;
    });
    return {
      id: request.requestId,
      events,
      cancel: async () => {
        controller.abort();
        this.#sessionPromise = null;
        if (this.#activeRunId === request.requestId) {
          this.#activeRunId = null;
        }
        if (!sessionId) return;
        await this.#json(
          `/v1/sessions/${encodeURIComponent(sessionId)}/cancel`,
          { method: "POST", body: "{}" },
        ).catch(() => undefined);
      },
    };
  }

  async *#run(
    request: LatticeHostRequest,
    controller: AbortController,
    onSession: (sessionId: string) => void,
  ): AsyncGenerator<LatticeHostEvent> {
    let answer = "";
    let turnId = "";
    let eventResponse: Response | null = null;
    yield { type: "status", status: "queued" };
    try {
      const initialState = await this.#workspaceState();
      const createRoot =
        request.kind === "followup" &&
        (!initialState.workspace.rootNodeId ||
          initialState.workspace.revision === 0);
      const sessionId = await this.#session();
      onSession(sessionId);
      if (controller.signal.aborted) {
        yield { type: "cancelled" };
        return;
      }
      const eventUrl =
        `/v1/events?after=${this.#lastSequence}` +
        `&sessionId=${encodeURIComponent(sessionId)}`;
      eventResponse = await this.#fetch(`${this.baseUrl}${eventUrl}`, {
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${this.token}`,
        },
        signal: controller.signal,
      });
      if (!eventResponse.ok) {
        throw new Error(
          messageOf(await eventResponse.json().catch(() => null), "Could not open ACP event stream."),
        );
      }
      yield { type: "status", status: "thinking" };
      const promptResult = await this.#json(
        `/v1/sessions/${encodeURIComponent(sessionId)}/prompts`,
        {
          method: "POST",
          body: JSON.stringify({ text: buildPrompt(request, createRoot) }),
          signal: controller.signal,
        },
      );
      const promptData = record(record(promptResult)?.data);
      if (typeof promptData?.turnId !== "string") {
        throw new Error("ACP sidecar returned an invalid prompt response.");
      }
      turnId = promptData.turnId;

      for await (const event of parseSse(eventResponse, controller.signal)) {
        this.#lastSequence = Math.max(this.#lastSequence, event.sequence);
        if (event.sessionId && event.sessionId !== sessionId) continue;
        if (event.turnId && event.turnId !== turnId) continue;
        if (event.type === "session.update") {
          const update = record(event.data);
          const updateType = update?.sessionUpdate;
          if (updateType === "agent_message_chunk") {
            const content = record(update?.content);
            if (content?.type === "text" && typeof content.text === "string") {
              answer += content.text;
              if (request.kind === "followup" && !createRoot) {
                yield { type: "text_delta", text: content.text };
              }
            }
          } else if (
            updateType === "tool_call" ||
            updateType === "tool_call_update"
          ) {
            yield { type: "status", status: "running_tool" };
          }
          continue;
        }
        if (event.type === "turn.failed") {
          throw new Error(messageOf(event.data, "ACP research turn failed."));
        }
        if (event.type === "turn.completed") {
          const completion = record(event.data);
          if (completion?.stopReason === "cancelled") {
            yield { type: "cancelled" };
            return;
          }
          yield { type: "status", status: "finalizing" };
          if (request.kind === "selection_fork") {
            const result = buildSelectionResult(request, answer);
            await this.#persistSelection(request, result.node);
            yield {
              type: "result",
              result,
            };
          } else {
            if (!answer.trim()) {
              throw new Error("ACP agent completed without an answer.");
            }
            if (createRoot) {
              await this.#persistRoot(request, answer);
              yield {
                type: "workspace",
                hydration: hydrationFromState(await this.#workspaceState(true)),
              };
            } else {
              await this.#persistFollowup(request, answer);
            }
          }
          yield { type: "done" };
          return;
        }
      }
      throw new Error("ACP event stream ended before the turn completed.");
    } catch (error) {
      if (controller.signal.aborted) {
        yield { type: "cancelled" };
        return;
      }
      yield {
        type: "error",
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: "acp_host_error",
          retryable: true,
        },
      };
    } finally {
      if (this.#activeRunId === request.requestId) {
        this.#activeRunId = null;
      }
      if (eventResponse?.body && !eventResponse.body.locked) {
        await eventResponse.body.cancel().catch(() => undefined);
      }
    }
  }

  async #session() {
    if (!this.#sessionPromise) {
      this.#sessionPromise = this.#json("/v1/sessions", {
        method: "POST",
        body: JSON.stringify({
          cwd: this.cwd,
          additionalDirectories: this.additionalDirectories,
        }),
      })
        .then((value) => {
          const data = record(record(value)?.data);
          if (typeof data?.sessionId !== "string" || !data.sessionId) {
            throw new Error("ACP sidecar returned an invalid session.");
          }
          return data.sessionId;
        })
        .catch((error) => {
          this.#sessionPromise = null;
          throw error;
        });
    }
    return this.#sessionPromise;
  }

  async #workspaceState(refresh = false): Promise<DurableState> {
    if (refresh) {
      this.#state = null;
      this.#statePromise = null;
    }
    if (this.#state) return this.#state;
    if (!this.#statePromise) {
      this.#statePromise = this.#json("/v1/lattice/state", {
        method: "POST",
        body: JSON.stringify(
          this.workspaceId ? { workspaceId: this.workspaceId } : {},
        ),
      })
        .then((value) => {
          const state = parseDurableState(value, this.workspaceId);
          this.#state = state;
          return state;
        })
        .catch((error) => {
          this.#statePromise = null;
          throw error;
        });
    }
    return this.#statePromise;
  }

  async #applyPatch(
    expectedRevision: number,
    patch: Record<string, unknown>,
  ) {
    const apply = async (revision: number) => {
      const value = await this.#json("/v1/lattice/patch", {
        method: "POST",
        body: JSON.stringify({
          ...(this.workspaceId ? { workspaceId: this.workspaceId } : {}),
          expectedRevision: revision,
          patch,
        }),
      });
      const outer = record(value);
      const result = record(outer?.data);
      const workspace = record(result?.workspace);
      if (!workspace) {
        throw new Error("ACP sidecar returned an invalid Lattice patch result.");
      }
      this.#state = {
        workspaceId:
          typeof result?.workspaceId === "string"
            ? result.workspaceId
            : this.#state?.workspaceId ?? this.workspaceId ?? "",
        storage: Number(workspace.revision) > 0 ? "project" : "empty",
        workspace: workspace as unknown as DurableWorkspace,
        uiState: this.#state?.uiState ?? {
          activeNodeId: null,
          view: "explore",
          deckNodeIds: [],
        },
      };
      this.#statePromise = Promise.resolve(this.#state);
    };
    try {
      await apply(expectedRevision);
    } catch (error) {
      let refreshed: DurableState;
      try {
        refreshed = await this.#workspaceState(true);
      } catch {
        throw error;
      }
      const requestId =
        typeof patch.completeRequestId === "string"
          ? patch.completeRequestId
          : null;
      if (
        requestId &&
        refreshed.workspace.completedRequestIds.includes(requestId)
      ) {
        return;
      }
      if (!(error instanceof Error) || !/Revision conflict:/.test(error.message)) {
        throw error;
      }
      throw new Error(
        `Lattice changed in another process at revision ${refreshed.workspace.revision}. Reload the workspace before retrying.`,
      );
    }
  }

  async #persistRoot(
    request: Extract<LatticeHostRequest, { kind: "followup" }>,
    output: string,
  ) {
    const state = await this.#workspaceState();
    const envelope = parseRootEnvelope(output);
    const answer = text(
      envelope?.answer,
      output.replace(ROOT_START, "").replace(ROOT_END, "").trim(),
    );
    if (!answer) throw new Error("ACP root research did not include an answer.");
    const title = text(envelope?.title, request.question, 240);
    const node: DurableNode = {
      id: request.nodeId,
      title,
      shortTitle: text(envelope?.shortTitle, title, 80),
      year: text(envelope?.year, "Repository research", 80),
      lead: text(envelope?.lead, answer.slice(0, 180), 1200),
      position: request.sourceNode?.position ?? { x: 50, y: 50 },
      turns: [
        {
          id: `${request.requestId}-user`,
          role: "user",
          content: request.question,
          anchors: [],
        },
        {
          id: `${request.requestId}-assistant`,
          role: "assistant",
          content: answer,
          anchors: [],
        },
      ],
    };
    await this.#applyPatch(state.workspace.revision, {
      addNodes: [node],
      rootNodeId: node.id,
      activeNodeId: node.id,
      completeRequestId: request.requestId,
    });
  }

  async #persistFollowup(
    request: Extract<LatticeHostRequest, { kind: "followup" }>,
    answer: string,
  ) {
    const state = await this.#workspaceState();
    await this.#applyPatch(state.workspace.revision, {
      appendTurns: [{
        nodeId: request.nodeId,
        turns: [
          {
            id: `${request.requestId}-user`,
            role: "user",
            content: request.question,
          },
          {
            id: `${request.requestId}-assistant`,
            role: "assistant",
            content: answer.trim(),
          },
        ],
      }],
      activeNodeId: request.nodeId,
      completeRequestId: request.requestId,
    });
  }

  async #persistSelection(
    request: Extract<LatticeHostRequest, { kind: "selection_fork" }>,
    node: ResearchNode,
  ) {
    const state = await this.#workspaceState();
    const assistantContent = node.blocks
      .filter((block) =>
        block.kind !== "paragraph" ||
        !block.content.some((part) => typeof part !== "string"),
      )
      .map((block) => {
        if (block.kind === "paragraph") {
          return block.content
            .map((part) => typeof part === "string" ? part : part.label)
            .join("");
        }
        if (block.kind === "insight") {
          return `${block.label}：${block.content}`;
        }
        return block.content;
      })
      .filter(Boolean)
      .join("\n\n");
    const anchors = node.blocks.flatMap((block) =>
      block.kind === "paragraph"
        ? block.content.flatMap((part) =>
            typeof part === "string" ? [] : [part],
          )
        : [],
    );
    await this.#applyPatch(state.workspace.revision, {
      addNodes: [{
        id: node.id,
        title: node.title,
        shortTitle: node.shortTitle,
        lead: node.lead,
        year: node.year,
        position: node.position,
        turns: [
          {
            id: `${request.requestId}-user`,
            role: "user",
            content: node.userPrompt,
          },
          {
            id: `${request.requestId}-assistant`,
            role: "assistant",
            content: assistantContent,
            anchors: durableAnchors(anchors),
          },
        ],
      }],
      addEdges: [{
        from: request.sourceNode.id,
        to: node.id,
        kind: "fork",
      }],
      activeNodeId: node.id,
      completeRequestId: request.requestId,
    });
  }

  async #json(pathname: string, init: RequestInit) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.requestTimeoutMs);
    const suppliedSignal = init.signal;
    const abort = () => timeout.abort();
    if (suppliedSignal?.aborted) {
      timeout.abort();
    } else {
      suppliedSignal?.addEventListener("abort", abort, { once: true });
    }
    try {
      const response = await this.#fetch(`${this.baseUrl}${pathname}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        signal: timeout.signal,
      });
      const value = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(messageOf(value, `ACP sidecar request failed (${response.status}).`));
      }
      return value;
    } finally {
      clearTimeout(timer);
      suppliedSignal?.removeEventListener("abort", abort);
    }
  }
}
