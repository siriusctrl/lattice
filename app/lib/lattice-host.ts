import type {
  GraphEdge,
  InlineText,
  ResearchNode,
} from "@/app/lib/mock-research";

export type ResearchAnchor = Extract<
  InlineText,
  { kind: "anchor" }
>;

export type FollowupTurn = {
  id: string;
  question: string;
  answer: string;
  anchors?: ResearchAnchor[];
};

export type LatticeHydration = {
  workspaceId?: string;
  revision: number;
  rootNodeId: string | null;
  activeNodeId: string | null;
  nodes: Record<string, ResearchNode>;
  edges: GraphEdge[];
  followups: Record<string, FollowupTurn[]>;
  deckNodeIds?: string[];
  view?: "explore" | "article";
  storage: "project" | "empty";
};

export type LatticeUiState = {
  activeNodeId: string;
  view: "explore" | "article";
  deckNodeIds: string[];
};

export type LatticeHostRequest =
  | {
      kind: "followup";
      requestId: string;
      nodeId: string;
      sourceNode?: ResearchNode;
      question: string;
      contextNodeIds: string[];
    }
  | {
      kind: "selection_fork";
      requestId: string;
      sourceNode: ResearchNode;
      selectionText: string;
      suggestedNodeId: string;
      selectionIndex: number;
      contextNodeIds: string[];
    };

export type LatticeHostResult =
  | {
      kind: "followup";
      nodeId: string;
      turn: FollowupTurn;
    }
  | {
      kind: "selection_fork";
      sourceNodeId: string;
      node: ResearchNode;
      edge: GraphEdge;
    };

export type LatticeHostStatus =
  | "queued"
  | "thinking"
  | "running_tool"
  | "finalizing";

export type LatticeHostEvent =
  | {
      type: "status";
      status: LatticeHostStatus;
      message?: string;
    }
  | {
      type: "text_delta";
      text: string;
    }
  | {
      type: "anchor";
      anchor: ResearchAnchor;
    }
  | {
      type: "result";
      result: LatticeHostResult;
    }
  | {
      type: "workspace";
      hydration: LatticeHydration;
    }
  | {
      type: "done";
    }
  | {
      type: "cancelled";
      reason?: string;
    }
  | {
      type: "error";
      error: {
        message: string;
        code?: string;
        retryable?: boolean;
      };
    };

export type LatticeRun = {
  id: string;
  events: AsyncIterable<LatticeHostEvent>;
  cancel: (reason?: string) => Promise<void>;
};

export async function cancelLatticeRun(
  run: LatticeRun | null,
  reason: string,
) {
  if (!run) return;
  try {
    await run.cancel(reason);
  } catch {
    // Cancellation is best effort. The request generation still prevents a
    // stale result from committing after navigation.
  }
}

export class LatticeNavigationGeneration {
  private generation = 0;

  snapshot() {
    return this.generation;
  }

  invalidate() {
    this.generation += 1;
  }

  isCurrent(snapshot: number) {
    return snapshot === this.generation;
  }
}

export type LatticeAskOutcome =
  | {
      status: "completed";
    }
  | {
      status: "cancelled" | "failed";
      message: string;
    };

type FollowupRunCallbacks = {
  onDraft: (turn: FollowupTurn | null) => void;
  onResult: (turn: FollowupTurn) => void;
  onWorkspace?: (hydration: LatticeHydration) => void;
  onStatus?: (status: LatticeHostStatus) => void;
};

export function latticeErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "回答运行失败，请重试。";
}

/**
 * Consumes both complete-result and streaming hosts. A stream that ends
 * naturally is terminal: accumulated content is committed, while an empty EOF
 * becomes a recoverable failure.
 */
export async function consumeFollowupRun(
  run: LatticeRun,
  nodeId: string,
  question: string,
  { onDraft, onResult, onWorkspace, onStatus }: FollowupRunCallbacks,
): Promise<LatticeAskOutcome> {
  let answer = "";
  let anchors: ResearchAnchor[] = [];
  let committed = false;
  let terminalOutcome: LatticeAskOutcome | null = null;

  const currentTurn = (): FollowupTurn => ({
    id: run.id,
    question,
    answer,
    ...(anchors.length > 0 ? { anchors } : {}),
  });

  const commitStream = () => {
    if (committed || (!answer && anchors.length === 0)) return false;
    onResult(currentTurn());
    onDraft(null);
    committed = true;
    return true;
  };

  try {
    for await (const event of run.events) {
      if (event.type === "status") {
        onStatus?.(event.status);
        continue;
      }

      if (event.type === "text_delta") {
        answer += event.text;
        onDraft(currentTurn());
        continue;
      }

      if (event.type === "anchor") {
        anchors = [...anchors, event.anchor];
        onDraft(currentTurn());
        continue;
      }

      if (
        event.type === "result" &&
        event.result.kind === "followup" &&
        event.result.nodeId === nodeId
      ) {
        onResult(event.result.turn);
        onDraft(null);
        committed = true;
        continue;
      }

      if (event.type === "workspace") {
        onWorkspace?.(event.hydration);
        onDraft(null);
        committed = true;
        continue;
      }

      if (event.type === "done") {
        commitStream();
        terminalOutcome = committed
          ? { status: "completed" }
          : {
              status: "failed",
              message: "本次回答没有返回内容，请重试。",
            };
        break;
      }

      if (event.type === "cancelled") {
        terminalOutcome = committed
          ? { status: "completed" }
          : {
              status: "cancelled",
              message: event.reason || "本次回答已取消，请重试。",
            };
        break;
      }

      if (event.type === "error") {
        terminalOutcome = committed
          ? { status: "completed" }
          : {
              status: "failed",
              message: event.error.message,
            };
        break;
      }
    }
  } catch (error) {
    terminalOutcome = committed
      ? { status: "completed" }
      : {
          status: "failed",
          message: latticeErrorMessage(error),
        };
  }

  if (!terminalOutcome) {
    commitStream();
    terminalOutcome = committed
      ? { status: "completed" }
      : {
          status: "failed",
          message: "本次回答提前结束，请重试。",
        };
  }

  if (terminalOutcome.status !== "completed") onDraft(null);
  return terminalOutcome;
}

export function recoverComposerQuestion(
  currentQuestion: string,
  submittedQuestion: string,
  outcome: LatticeAskOutcome,
) {
  return outcome.status === "completed" || currentQuestion.trim()
    ? currentQuestion
    : submittedQuestion;
}

/**
 * Browser-safe boundary between Lattice interaction state and an agent host.
 *
 * Implementations may run a deterministic in-memory demo, bridge to a Codex
 * MCP App, or proxy an ACP session. Process control and credentials stay
 * behind the implementation rather than entering the React component tree.
 */
export interface LatticeHost {
  load?(): Promise<LatticeHydration>;
  saveUiState?(state: LatticeUiState): Promise<void>;
  start(request: LatticeHostRequest): LatticeRun;
}

export function startLatticeRun(
  host: LatticeHost,
  request: LatticeHostRequest,
):
  | { ok: true; run: LatticeRun }
  | { ok: false; message: string } {
  try {
    return { ok: true, run: host.start(request) };
  } catch (error) {
    return { ok: false, message: latticeErrorMessage(error) };
  }
}
