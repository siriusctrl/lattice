"use client";

import {
  ArrowUpRight,
  PaperPlaneTilt,
  Quotes,
  SpinnerGap,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import {
  FormEvent,
  MouseEvent,
  PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  recoverComposerQuestion,
  type FollowupTurn,
  type LatticeAskOutcome,
} from "@/app/lib/lattice-host";
import type {
  InlineText,
  ResearchNode,
} from "@/app/lib/mock-research";
import {
  DECK_SUFFIX_EXIT_DURATION_SECONDS,
  MOBILE_DECK_HANDOFF_DURATION_SECONDS,
  type CardMotionState,
} from "@/app/lib/deck-motion";
import type { DeckExitOrigin } from "@/app/hooks/use-deck-transition";

export type { FollowupTurn } from "@/app/lib/lattice-host";

export type TextSelection = {
  text: string;
  rect: {
    top: number;
    left: number;
    width: number;
  };
};

type ResearchCardProps = {
  node: ResearchNode;
  active: boolean;
  deckIndex: number;
  deckMode: boolean;
  mobilePreview: boolean;
  deckPickable: boolean;
  deckPreviewed: boolean;
  mobileOutgoing: boolean;
  mobileIncoming: boolean;
  mobileGestureParticipant: boolean;
  mobileTransitioning: boolean;
  leavingDeck: boolean;
  deckExitOrigin: DeckExitOrigin | null;
  leavingOrder: number;
  motionState: CardMotionState;
  draggingDeck: boolean;
  followups: FollowupTurn[];
  streamingFollowup: FollowupTurn | null;
  thinking: boolean;
  askError: string | null;
  onAnchor: (targetId: string) => void;
  onAsk: (
    nodeId: string,
    question: string,
  ) => Promise<LatticeAskOutcome>;
  onDeckPreview: (
    index: number,
    pointer?: { x: number; y: number },
  ) => void;
  onDeckPreviewEnd: (index: number) => void;
  onDeckSelect: (index: number) => void;
  onDeckExitComplete: () => void;
  onDeckExitStart: () => void;
  onTextSelection: (selection: TextSelection | null) => void;
  reduceMotion: boolean;
};

function InlineContent({
  content,
  onAnchor,
}: {
  content: InlineText[];
  onAnchor: (targetId: string) => void;
}) {
  return content.map((part, index) => {
    if (typeof part === "string") {
      return <span key={`${part.slice(0, 12)}-${index}`}>{part}</span>;
    }

    return (
      <button
        key={`${part.target}-${index}`}
        type="button"
        className="inline-anchor"
        data-anchor-target={part.target}
        onClick={() => onAnchor(part.target)}
        aria-label={`${part.label}：${part.hint}`}
      >
        <span>{part.label}</span>
        <ArrowUpRight size={12} weight="bold" aria-hidden="true" />
      </button>
    );
  });
}

export function getFollowupInlineContent(turn: FollowupTurn) {
  const content: InlineText[] = [turn.answer];
  for (const anchor of turn.anchors ?? []) {
    if (content.length > 0) content.push(" ");
    content.push(anchor);
  }
  return content;
}

export function FollowupAnswerContent({
  turn,
  onAnchor,
}: {
  turn: FollowupTurn;
  onAnchor: (targetId: string) => void;
}) {
  const content = getFollowupInlineContent(turn);
  return <InlineContent content={content} onAnchor={onAnchor} />;
}

function FollowupTurnView({
  turn,
  onAnchor,
  streaming = false,
}: {
  turn: FollowupTurn;
  onAnchor: (targetId: string) => void;
  streaming?: boolean;
}) {
  return (
    <div
      className="followup-turn"
      data-followup-streaming={streaming ? "true" : "false"}
    >
      <div className="followup-question">
        <span aria-hidden="true">你</span>
        <p>{turn.question}</p>
      </div>
      <div className="followup-answer">
        <span className="assistant-mark" aria-hidden="true">
          L
        </span>
        <p>
          <FollowupAnswerContent turn={turn} onAnchor={onAnchor} />
        </p>
      </div>
    </div>
  );
}

export function ResearchCard({
  node,
  active,
  deckIndex,
  deckMode,
  mobilePreview,
  deckPickable,
  deckPreviewed,
  mobileOutgoing,
  mobileIncoming,
  mobileGestureParticipant,
  mobileTransitioning,
  leavingDeck,
  deckExitOrigin,
  leavingOrder,
  motionState,
  draggingDeck,
  followups,
  streamingFollowup,
  thinking,
  askError,
  onAnchor,
  onAsk,
  onDeckPreview,
  onDeckPreviewEnd,
  onDeckSelect,
  onDeckExitComplete,
  onDeckExitStart,
  onTextSelection,
  reduceMotion,
}: ResearchCardProps) {
  const [question, setQuestion] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousTurnCount = useRef(followups.length);

  useEffect(() => {
    const receivedAnswer = followups.length > previousTurnCount.current;
    previousTurnCount.current = followups.length;
    if (!active || (!thinking && !receivedAnswer)) return;

    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [
    active,
    followups.length,
    reduceMotion,
    streamingFollowup?.anchors?.length,
    streamingFollowup?.answer.length,
    thinking,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || thinking) return;
    setQuestion("");
    let outcome: LatticeAskOutcome;
    try {
      outcome = await onAsk(node.id, trimmed);
    } catch {
      outcome = {
        status: "failed",
        message: "回答运行失败，请重试。",
      };
    }
    setQuestion((current) =>
      recoverComposerQuestion(current, trimmed, outcome),
    );
  }

  function handleMouseUp(event: MouseEvent<HTMLElement>) {
    if (!active) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!selection || selection.isCollapsed || text.length < 2) {
      onTextSelection(null);
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("button, input, a")) {
      onTextSelection(null);
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    onTextSelection({
      text: text.slice(0, 180),
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
      },
    });
  }

  const cardClassName = `research-card ${
    active ? "research-card-active" : ""
  } ${deckMode ? "research-card-deck-mode" : ""} ${
    deckPreviewed ? "research-card-deck-previewed" : ""
  } ${
    mobileOutgoing ? "research-card-mobile-outgoing" : ""
  } ${
    mobileIncoming ? "research-card-mobile-incoming" : ""
  }`;
  const settledTransition = mobilePreview
    ? {
        duration: 0.24,
        ease: [0.22, 0.82, 0.24, 1] as [
          number,
          number,
          number,
          number,
        ],
      }
    : {
        type: "spring" as const,
        stiffness: 275,
        damping: 29,
        mass: 0.86,
      };
  const fanTransition = {
    duration: reduceMotion ? 0 : 0.54,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  };
  const leavingEase = [0.22, 1, 0.36, 1] as [
    number,
    number,
    number,
    number,
  ];
  const leavingPrimary = leavingOrder === 0;
  const leavingTarget = {
    x:
      leavingPrimary && deckExitOrigin
        ? deckExitOrigin.x
        : motionState.x,
    y:
      leavingPrimary && deckExitOrigin
        ? deckExitOrigin.y + 16
        : motionState.y + (leavingPrimary ? 16 : 0),
    scale: leavingPrimary ? 0.972 : motionState.scale,
    rotate: motionState.baseRotate + (leavingPrimary ? 0.35 : 0),
    opacity: leavingPrimary ? 1 : 0,
    zIndex: leavingPrimary ? 70 : 60,
  };
  const leavingTransition = reduceMotion
    ? { duration: 0 }
    : leavingPrimary
      ? {
          duration: DECK_SUFFIX_EXIT_DURATION_SECONDS,
          ease: leavingEase,
          zIndex: {
            duration: 0,
            delay: 0.24,
          },
        }
      : { duration: 0 };

  return (
    <motion.div
      className="research-card-motion"
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              x: 84,
              y: 34,
              scale: 0.965,
              rotate: 1.2,
            }
      }
      animate={
        leavingDeck
          ? leavingTarget
          : {
              x: motionState.x,
              y: motionState.y,
              scale: motionState.scale,
              rotate: motionState.baseRotate,
              opacity: motionState.opacity,
            }
      }
      exit={
        reduceMotion
          ? { opacity: 0 }
          : leavingDeck
            ? leavingTarget
            : { opacity: 0, x: 92, y: 38, scale: 0.96, rotate: 1.5 }
      }
      transition={
        leavingDeck
          ? leavingTransition
          : draggingDeck || reduceMotion
            ? { duration: 0 }
            : mobileTransitioning
              ? {
                  duration: MOBILE_DECK_HANDOFF_DURATION_SECONDS,
                  ease: [0.22, 0.86, 0.24, 1],
                }
              : mobilePreview && !mobileGestureParticipant
                ? { duration: 0 }
              : settledTransition
      }
      onAnimationStart={() => {
        if (leavingDeck && leavingPrimary) onDeckExitStart();
      }}
      onAnimationComplete={() => {
        if (leavingDeck && leavingPrimary) onDeckExitComplete();
      }}
      style={{
        zIndex: leavingDeck
          ? leavingPrimary
            ? 130
            : 119 - Math.min(leavingOrder, 20)
          : motionState.zIndex,
        pointerEvents:
          !leavingDeck && (active || deckMode) ? "auto" : "none",
        transformOrigin: leavingDeck ? "50% 72%" : undefined,
        willChange:
          (leavingDeck && leavingPrimary) ||
          (mobilePreview && mobileGestureParticipant)
            ? "transform"
            : undefined,
        backfaceVisibility:
          (leavingDeck && leavingPrimary) ||
          (mobilePreview && mobileGestureParticipant)
            ? "hidden"
            : undefined,
        WebkitBackfaceVisibility:
          mobilePreview && mobileGestureParticipant ? "hidden" : undefined,
      }}
    >
      <motion.div
        className="research-card-fan research-card-fan-left"
        animate={{ rotate: leavingDeck ? 0 : motionState.leftFanRotate }}
        transition={leavingDeck ? { duration: 0 } : fanTransition}
      >
        <motion.div
          className="research-card-fan research-card-fan-right"
          animate={{ rotate: leavingDeck ? 0 : motionState.rightFanRotate }}
          transition={leavingDeck ? { duration: 0 } : fanTransition}
        >
          <article
            className={cardClassName}
            data-testid={`research-card-${node.id}`}
            data-active={active ? "true" : "false"}
            data-deck-index={deckIndex}
            data-deck-leaving={leavingDeck ? "true" : "false"}
            data-deck-leaving-primary={
              leavingDeck && leavingPrimary ? "true" : "false"
            }
            data-mobile-outgoing={mobileOutgoing ? "true" : "false"}
            data-mobile-incoming={mobileIncoming ? "true" : "false"}
            data-left-fan-rotate={motionState.leftFanRotate.toFixed(3)}
            data-right-fan-rotate={motionState.rightFanRotate.toFixed(3)}
            inert={!active || deckMode ? true : undefined}
            aria-hidden={!active || deckMode}
            style={{
              boxShadow:
                leavingDeck && leavingPrimary
                  ? "var(--card-shadow)"
                  : undefined,
              filter: leavingDeck ? "none" : undefined,
            }}
          >
            <div
              ref={scrollRef}
              className="card-scroll"
              onMouseUp={handleMouseUp}
            >
              <div className="prompt-block">
                <span className="prompt-avatar" aria-hidden="true">
                  你
                </span>
                <p>{node.userPrompt}</p>
              </div>

              <div className="research-copy">
                {node.blocks.map((block, index) => {
                  if (block.kind === "paragraph") {
                    return (
                      <p key={`${node.id}-paragraph-${index}`}>
                        <InlineContent
                          content={block.content}
                          onAnchor={onAnchor}
                        />
                      </p>
                    );
                  }

                  if (block.kind === "quote") {
                    return (
                      <blockquote key={`${node.id}-quote-${index}`}>
                        <Quotes size={18} weight="fill" aria-hidden="true" />
                        <p>{block.content}</p>
                      </blockquote>
                    );
                  }

                  return (
                    <p
                      className="chat-plain-paragraph"
                      key={`${node.id}-insight-${index}`}
                    >
                      {block.content}
                    </p>
                  );
                })}
              </div>

              {followups.length > 0 || streamingFollowup ? (
                <div
                  className="followup-thread"
                  aria-label="当前节点的继续追问"
                  data-testid={`followup-thread-${node.id}`}
                >
                  {followups.map((turn) => (
                    <FollowupTurnView
                      key={turn.id}
                      turn={turn}
                      onAnchor={onAnchor}
                    />
                  ))}
                  {streamingFollowup ? (
                    <FollowupTurnView
                      turn={streamingFollowup}
                      onAnchor={onAnchor}
                      streaming
                    />
                  ) : null}
                </div>
              ) : null}

              {thinking ? (
                <div
                  className="thinking-block"
                  role="status"
                  aria-live="polite"
                >
                  <SpinnerGap size={16} className="thinking-spinner" />
                  <div>
                    <span>正在沿当前节点思考</span>
                    <i />
                    <i />
                  </div>
                </div>
              ) : null}

              {askError ? (
                <div className="ask-error" role="alert">
                  {askError}
                </div>
              ) : null}
            </div>

            <form className="card-composer" onSubmit={handleSubmit}>
              <label htmlFor={`ask-${node.id}`}>发消息</label>
              <input
                id={`ask-${node.id}`}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="继续问..."
                autoComplete="off"
                disabled={!active || thinking}
              />
              <button
                type="submit"
                className="send-button"
                disabled={!question.trim() || thinking}
                aria-label="发送追问"
              >
                <PaperPlaneTilt size={17} weight="fill" />
              </button>
            </form>
          </article>

          {deckPickable ? (
            <button
              type="button"
              className="deck-card-picker"
              data-deck-index={deckIndex}
              aria-label={`打开 Card：${node.shortTitle}`}
              onClick={() => onDeckSelect(deckIndex)}
              onFocus={() => onDeckPreview(deckIndex)}
              onBlur={() => onDeckPreviewEnd(deckIndex)}
              onPointerMove={(event: PointerEvent<HTMLButtonElement>) =>
                onDeckPreview(deckIndex, {
                  x: event.clientX,
                  y: event.clientY,
                })
              }
              onPointerLeave={() => onDeckPreviewEnd(deckIndex)}
            />
          ) : null}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
