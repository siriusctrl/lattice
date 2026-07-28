"use client";

import {
  ArrowSquareOut,
  Article,
  CardsThree,
  CheckCircle,
  ClockCounterClockwise,
  LinkSimple,
  Sparkle,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  buildArticleSections,
  type ArticleSection,
} from "@/app/lib/article-research";
import type { FollowupTurn } from "@/app/components/ResearchCard";
import type {
  GraphEdge,
  ResearchNode,
} from "@/app/lib/mock-research";

type ArticleViewProps = {
  nodes: Record<string, ResearchNode>;
  discoveredIds: Set<string>;
  edges: GraphEdge[];
  followups: Record<string, FollowupTurn[]>;
  focusSectionId: string;
  onOpenSource: (nodeId: string) => void;
  reduceMotion: boolean;
};

function sectionStatusIcon(section: ArticleSection) {
  if (section.status === "converged") {
    return <Sparkle size={13} weight="fill" aria-hidden="true" />;
  }
  if (section.status === "developing") {
    return <ClockCounterClockwise size={13} aria-hidden="true" />;
  }
  return <CheckCircle size={13} weight="fill" aria-hidden="true" />;
}

function visibleSourceNodes(
  section: ArticleSection,
  nodes: Record<string, ResearchNode>,
) {
  return section.sourceIds
    .map((id) => nodes[id])
    .filter((node): node is ResearchNode => Boolean(node));
}

export function ArticleView({
  nodes,
  discoveredIds,
  edges,
  followups,
  focusSectionId,
  onOpenSource,
  reduceMotion,
}: ArticleViewProps) {
  const followupNodeIds = useMemo(
    () =>
      new Set(
        Object.entries(followups)
          .filter(([, turns]) => turns.length > 0)
          .map(([nodeId]) => nodeId),
      ),
    [followups],
  );
  const sections = useMemo(
    () =>
      buildArticleSections({
        discoveredIds,
        edges,
        followupNodeIds,
      }),
    [discoveredIds, edges, followupNodeIds],
  );
  const availableFocus = sections.some(
    (section) => section.id === focusSectionId,
  )
    ? focusSectionId
    : sections.at(-1)?.id ?? "overview";
  const [selectedSectionId, setSelectedSectionId] =
    useState(availableFocus);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSelectedSectionId(availableFocus);
      document
        .getElementById(`article-section-${availableFocus}`)
        ?.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [availableFocus, reduceMotion]);

  const selectedSection =
    sections.find((section) => section.id === selectedSectionId) ??
    sections[0];
  const selectedSources = selectedSection
    ? visibleSourceNodes(selectedSection, nodes)
    : [];
  const characterCount = sections.reduce(
    (total, section) =>
      total +
      section.title.length +
      section.paragraphs.reduce(
        (sectionTotal, paragraph) => sectionTotal + paragraph.length,
        0,
      ),
    0,
  );
  const roundedCharacterCount = Math.max(
    400,
    Math.round(characterCount / 100) * 100,
  );
  const converged = sections.some(
    (section) => section.status === "converged",
  );

  function focusSection(sectionId: string) {
    setSelectedSectionId(sectionId);
    document
      .getElementById(`article-section-${sectionId}`)
      ?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
  }

  return (
    <motion.section
      className="article-workspace"
      data-testid="article-view"
      aria-label="动态成稿"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <aside className="article-outline" aria-label="文章目录">
        <div className="outline-heading">
          <span>目录</span>
          <i>{sections.length.toString().padStart(2, "0")}</i>
        </div>
        <nav>
          {sections.map((section, index) => (
            <button
              type="button"
              key={section.id}
              className={
                selectedSectionId === section.id ? "outline-active" : ""
              }
              onClick={() => focusSection(section.id)}
              aria-current={
                selectedSectionId === section.id ? "location" : undefined
              }
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {section.title}
            </button>
          ))}
        </nav>
        <div className="outline-compile-state">
          <span className="compile-pulse" aria-hidden="true" />
          <div>
            <strong>自动整理中</strong>
            <span>{discoveredIds.size} 张 Card 已进入素材池</span>
          </div>
        </div>
      </aside>

      <div className="article-scroll">
        <article className="wiki-paper">
          <header className="wiki-hero">
            <div className="wiki-kicker">
              <Article size={15} weight="fill" aria-hidden="true" />
              <span>动态成稿</span>
              <i>根据当前探索自动编译</i>
            </div>
            <h1>Elon Musk</h1>
            <p className="wiki-dek">
              从互联网创业到火箭、电动车与人工智能，一篇随着研究路径持续生长的人物文章。
            </p>
            <dl className="wiki-stats">
              <div>
                <dt>章节</dt>
                <dd>{sections.length}</dd>
              </div>
              <div>
                <dt>来源 Card</dt>
                <dd>{discoveredIds.size}</dd>
              </div>
              <div>
                <dt>当前篇幅</dt>
                <dd>约 {roundedCharacterCount} 字</dd>
              </div>
              <div>
                <dt>综合状态</dt>
                <dd>{converged ? "已形成交叉结论" : "仍在探索"}</dd>
              </div>
            </dl>
          </header>

          <div className="wiki-body">
            {sections.map((section, sectionIndex) => {
              const sources = visibleSourceNodes(section, nodes);
              return (
                <motion.section
                  id={`article-section-${section.id}`}
                  data-testid={`article-section-${section.id}`}
                  className={`wiki-section wiki-section-${section.status}`}
                  key={section.id}
                  initial={
                    reduceMotion ? false : { opacity: 0, y: 16 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: Math.min(sectionIndex * 0.035, 0.18),
                    duration: 0.32,
                  }}
                  onMouseEnter={() => setSelectedSectionId(section.id)}
                >
                  <div className="wiki-section-heading">
                    <div>
                      <span className="wiki-section-eyebrow">
                        {section.eyebrow}
                      </span>
                      <h2>{section.title}</h2>
                    </div>
                    <div className="wiki-section-meta">
                      <span
                        className={`section-status section-status-${section.status}`}
                      >
                        {sectionStatusIcon(section)}
                        {section.statusLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedSectionId(section.id)}
                        aria-label={`查看“${section.title}”的来源 Card`}
                      >
                        <LinkSimple size={12} weight="bold" />
                        {sources.length} 个来源
                      </button>
                    </div>
                  </div>
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={`${section.id}-${paragraphIndex}`}>
                      {paragraph}
                      {paragraphIndex === section.paragraphs.length - 1 &&
                      sources.length > 0 ? (
                        <button
                          type="button"
                          className="wiki-citation"
                          onClick={() => setSelectedSectionId(section.id)}
                          aria-label={`查看“${section.title}”的出处`}
                        >
                          [{sectionIndex + 1}]
                        </button>
                      ) : null}
                    </p>
                  ))}
                </motion.section>
              );
            })}

            <section className="wiki-open-questions">
              <span>仍待研究</span>
              <h2>文章不会假装已经完成</h2>
              <ul>
                <li>个人资本与公司融资在关键时点如何相互影响？</li>
                <li>技术迭代速度带来的组织代价应该如何评价？</li>
                <li>平台、数据与模型能力最终会形成怎样的公司边界？</li>
              </ul>
            </section>
          </div>
        </article>
      </div>

      <aside
        className="article-sources"
        aria-label="当前段落来源"
        data-testid="article-sources"
      >
        <header>
          <div>
            <LinkSimple size={15} weight="bold" aria-hidden="true" />
            <span>段落来源</span>
          </div>
          <span>{selectedSources.length.toString().padStart(2, "0")}</span>
        </header>

        {selectedSection ? (
          <>
            <div className="source-section-title">
              <span>{selectedSection.eyebrow}</span>
              <strong>{selectedSection.title}</strong>
            </div>
            <div className="source-list">
              {selectedSources.map((node) => (
                <button
                  type="button"
                  key={node.id}
                  data-source-node={node.id}
                  onClick={() => onOpenSource(node.id)}
                >
                  <span className="source-card-icon" aria-hidden="true">
                    <CardsThree size={15} weight="fill" />
                  </span>
                  <span className="source-card-copy">
                    <i>{node.year}</i>
                    <strong>{node.shortTitle}</strong>
                    <small>{node.lead}</small>
                  </span>
                  <ArrowSquareOut size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          </>
        ) : null}

        <footer>
          <span>原文不会被成稿覆盖</span>
          <p>点击来源会回到对应 Card，并恢复当时的探索上下文。</p>
        </footer>
      </aside>
    </motion.section>
  );
}
