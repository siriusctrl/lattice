import {
  buildSelectionNode,
  getFollowupAnswer,
} from "@/app/lib/research-workspace";
import type {
  LatticeHost,
  LatticeHostEvent,
  LatticeHostRequest,
  LatticeRun,
} from "@/app/lib/lattice-host";

type DemoHostOptions = {
  followupDelayMs?: number;
};

type PendingDelay = {
  finish: () => void;
};

export class DemoHost implements LatticeHost {
  readonly followupDelayMs: number;

  constructor({ followupDelayMs = 900 }: DemoHostOptions = {}) {
    this.followupDelayMs = followupDelayMs;
  }

  start(request: LatticeHostRequest): LatticeRun {
    let cancelled = false;
    let cancelReason: string | undefined;
    let pendingDelay: PendingDelay | null = null;

    const wait = (durationMs: number) =>
      new Promise<void>((resolve) => {
        if (durationMs <= 0 || cancelled) {
          resolve();
          return;
        }

        const timer = setTimeout(resolve, durationMs);
        pendingDelay = {
          finish: () => {
            clearTimeout(timer);
            resolve();
          },
        };
      }).finally(() => {
        pendingDelay = null;
      });

    const events = async function* (
      delayMs: number,
    ): AsyncGenerator<LatticeHostEvent> {
      yield { type: "status", status: "thinking" };

      if (request.kind === "followup") {
        await wait(delayMs);
      }

      if (cancelled) {
        yield { type: "cancelled", reason: cancelReason };
        return;
      }

      if (request.kind === "followup") {
        yield {
          type: "result",
          result: {
            kind: "followup",
            nodeId: request.nodeId,
            turn: {
              id: request.requestId,
              question: request.question,
              answer: getFollowupAnswer(request.nodeId),
            },
          },
        };
      } else {
        const node = buildSelectionNode({
          nodeId: request.suggestedNodeId,
          nodeIndex: request.selectionIndex,
          text: request.selectionText,
          source: request.sourceNode,
        });
        yield {
          type: "result",
          result: {
            kind: "selection_fork",
            sourceNodeId: request.sourceNode.id,
            node,
            edge: {
              from: request.sourceNode.id,
              to: node.id,
              kind: "fork",
            },
          },
        };
      }

      yield { type: "done" };
    };

    return {
      id: request.requestId,
      events: events(this.followupDelayMs),
      cancel: async (reason) => {
        cancelled = true;
        cancelReason = reason;
        pendingDelay?.finish();
      },
    };
  }
}

export function createDemoHost(options?: DemoHostOptions) {
  return new DemoHost(options);
}
