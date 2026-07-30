"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { ArticleOutline } from "@/app/components/article/ArticleOutline";
import { ArticlePaper } from "@/app/components/article/ArticlePaper";
import { ArticleSources } from "@/app/components/article/ArticleSources";
import {
  buildArticleSections,
  buildRepositoryArticleSections,
  type ArticleSection,
} from "@/app/lib/article-research";
import type { FollowupTurn } from "@/app/lib/lattice-host";
import type {
  GraphEdge,
  ResearchNode,
} from "@/app/lib/mock-research";

type ArticleViewProps = {
  nodes: Record<string, ResearchNode>;
  discoveredIds: Set<string>;
  edges: GraphEdge[];
  followups: Record<string, FollowupTurn[]>;
  rootNodeId: string;
  focusSectionId: string;
  onOpenSource: (nodeId: string) => void;
  reduceMotion: boolean;
};

export function ArticleView({
  nodes,
  discoveredIds,
  edges,
  followups,
  rootNodeId,
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
      rootNodeId === "musk"
        ? buildArticleSections({
            discoveredIds,
            edges,
            followupNodeIds,
          })
        : buildRepositoryArticleSections({
            nodes,
            discoveredIds,
            rootNodeId,
            followups,
          }),
    [
      discoveredIds,
      edges,
      followupNodeIds,
      followups,
      nodes,
      rootNodeId,
    ],
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
      if (availableFocus === "overview") {
        document.querySelector(".article-scroll")?.scrollTo({
          top: 0,
          behavior: reduceMotion ? "auto" : "smooth",
        });
        return;
      }
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

  function focusSection(section: ArticleSection) {
    setSelectedSectionId(section.id);
    document
      .getElementById(`article-section-${section.id}`)
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
      <ArticleOutline
        sections={sections}
        selectedSectionId={selectedSectionId}
        sourceCount={discoveredIds.size}
        onFocusSection={focusSection}
      />
      <ArticlePaper
        sections={sections}
        sourceCount={discoveredIds.size}
        reduceMotion={reduceMotion}
        onInspectSection={setSelectedSectionId}
      />
      <ArticleSources
        nodes={nodes}
        section={selectedSection}
        onOpenSource={onOpenSource}
      />
    </motion.section>
  );
}
