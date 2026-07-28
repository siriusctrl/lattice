"use client";

import {
  ArrowUpRight,
  PaperPlaneTilt,
  Quotes,
  SpinnerGap,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { FormEvent, MouseEvent, useMemo, useState } from "react";
import Image from "next/image";
import type {
  InlineText,
  ResearchNode,
} from "@/app/lib/mock-research";

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
  layerIndex: number;
  followups: FollowupTurn[];
  thinking: boolean;
  onAnchor: (targetId: string) => void;
  onAsk: (nodeId: string, question: string) => void;
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
        <span className="anchor-tooltip" role="tooltip">
          {part.hint}
        </span>
      </button>
    );
  });
}

export function ResearchCard({
  node,
  active,
  layerIndex,
  followups,
  thinking,
  onAnchor,
  onAsk,
  onTextSelection,
  reduceMotion,
}: ResearchCardProps) {
  const [question, setQuestion] = useState("");

  const cardTransform = useMemo(() => {
    const distance = Math.min(layerIndex, 5);
    return {
      x: -distance * 16,
      y: distance * 9,
      scale: 1 - distance * 0.014,
      rotate: distance * -0.46,
      opacity: distance > 4 ? 0 : 1,
    };
  }, [layerIndex]);

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

  return (
    <motion.article
      className={`research-card ${active ? "research-card-active" : ""}`}
      data-testid={`research-card-${node.id}`}
      data-active={active ? "true" : "false"}
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
      animate={cardTransform}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, x: 92, y: 38, scale: 0.96, rotate: 1.5 }
      }
      transition={{
        type: "spring",
        stiffness: 275,
        damping: 29,
        mass: 0.86,
      }}
      style={{
        zIndex: 20 - layerIndex,
        pointerEvents: active ? "auto" : "none",
      }}
      aria-hidden={!active}
    >
      <div className="card-scroll" onMouseUp={handleMouseUp}>
        <div className="prompt-block">
          <span className="prompt-avatar" aria-hidden="true">
            你
          </span>
          <p>{node.userPrompt}</p>
        </div>

        {node.image?.tone === "portrait" ? (
          <figure className="card-image card-image-chat-portrait">
            <Image
              src={node.image.src}
              alt={node.image.alt}
              fill
              priority={node.id === "musk"}
              sizes="(max-width: 720px) 104px, 150px"
              unoptimized
            />
            {node.image.credit ? (
              <figcaption>
                <a
                  href={node.image.creditUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {node.image.credit}
                </a>
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        {node.image?.tone === "landscape" ? (
          <figure className="card-image card-image-landscape">
            <Image
              src={node.image.src}
              alt={node.image.alt}
              fill
              sizes="(max-width: 720px) calc(100vw - 62px), 680px"
              unoptimized
            />
          </figure>
        ) : null}

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
          <div className="followup-thread" aria-label="当前节点的继续追问">
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
          <div className="thinking-block" role="status" aria-live="polite">
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
    </motion.article>
  );
}
