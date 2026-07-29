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
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  InlineText,
  ResearchNode,
} from "@/app/lib/mock-research";
import type { CardMotionState } from "@/app/lib/deck-motion";

export type FollowupTurn = {
  id: string;
  question: string;
  answer: string;
};

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
  motionState: CardMotionState;
  draggingDeck: boolean;
  followups: FollowupTurn[];
  thinking: boolean;
  onAnchor: (targetId: string) => void;
  onAsk: (nodeId: string, question: string) => void;
  onDeckPreview: (index: number) => void;
  onDeckPreviewEnd: (index: number) => void;
  onDeckSelect: (index: number) => void;
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

export function ResearchCard({
  node,
  active,
  deckIndex,
  deckMode,
  mobilePreview,
  deckPickable,
  deckPreviewed,
  motionState,
  draggingDeck,
  followups,
  thinking,
  onAnchor,
  onAsk,
  onDeckPreview,
  onDeckPreviewEnd,
  onDeckSelect,
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
  }, [active, followups.length, reduceMotion, thinking]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || thinking) return;
    onAsk(node.id, trimmed);
    setQuestion("");
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
  }`;
  const settledTransition = {
    type: "spring" as const,
    stiffness: mobilePreview ? 260 : 275,
    damping: mobilePreview ? 32 : 29,
    mass: 0.86,
  };
  const fanTransition = {
    duration: reduceMotion ? 0 : 0.54,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  };

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
      animate={{
        x: motionState.x,
        y: motionState.y,
        scale: motionState.scale,
        rotate: motionState.baseRotate,
        opacity: motionState.opacity,
      }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, x: 92, y: 38, scale: 0.96, rotate: 1.5 }
      }
      transition={
        draggingDeck || reduceMotion
          ? { duration: 0 }
          : settledTransition
      }
      style={{
        zIndex: motionState.zIndex,
        pointerEvents: active || deckMode ? "auto" : "none",
      }}
    >
      <motion.div
        className="research-card-fan research-card-fan-left"
        animate={{ rotate: motionState.leftFanRotate }}
        transition={fanTransition}
      >
        <motion.div
          className="research-card-fan research-card-fan-right"
          animate={{ rotate: motionState.rightFanRotate }}
          transition={fanTransition}
        >
          <article
            className={cardClassName}
            data-testid={`research-card-${node.id}`}
            data-active={active ? "true" : "false"}
            data-deck-index={deckIndex}
            data-left-fan-rotate={motionState.leftFanRotate.toFixed(3)}
            data-right-fan-rotate={motionState.rightFanRotate.toFixed(3)}
            inert={!active || deckMode ? true : undefined}
            aria-hidden={!active || deckMode}
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

              {followups.length > 0 ? (
                <div
                  className="followup-thread"
                  aria-label="当前节点的继续追问"
                  data-testid={`followup-thread-${node.id}`}
                >
                  {followups.map((turn) => (
                    <div className="followup-turn" key={turn.id}>
                      <div className="followup-question">
                        <span aria-hidden="true">你</span>
                        <p>{turn.question}</p>
                      </div>
                      <div className="followup-answer">
                        <span className="assistant-mark" aria-hidden="true">
                          L
                        </span>
                        <p>{turn.answer}</p>
                      </div>
                    </div>
                  ))}
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
              onPointerEnter={() => onDeckPreview(deckIndex)}
              onPointerLeave={() => onDeckPreviewEnd(deckIndex)}
            />
          ) : null}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
