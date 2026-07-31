"use client";

import {
  Article as ArticleIcon,
  ChatsCircle,
  Graph,
  Moon,
  Stack,
  Sun,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import type { ResearchNode } from "@/app/lib/mock-research";

export type WorkspaceTheme = "light" | "dark";
export type WorkspaceView = "explore" | "article";

type WorkspaceTopbarProps = {
  view: WorkspaceView;
  theme: WorkspaceTheme;
  stack: string[];
  nodes: Record<string, ResearchNode>;
  activeIndex: number;
  activeId: string;
  sourceCount: number;
  graphVisible: boolean;
  reduceMotion: boolean;
  onExplore: () => void;
  onOpenArticle: (nodeId: string) => void;
  onFocusBreadcrumb: (index: number) => void;
  onShowGraph: () => void;
  onToggleTheme: () => void;
};

export function WorkspaceTopbar({
  view,
  theme,
  stack,
  nodes,
  activeIndex,
  activeId,
  sourceCount,
  graphVisible,
  reduceMotion,
  onExplore,
  onOpenArticle,
  onFocusBreadcrumb,
  onShowGraph,
  onToggleTheme,
}: WorkspaceTopbarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Stack size={19} weight="fill" />
        </span>
        <span>Lattice</span>
      </div>

      <nav className="view-switch" aria-label="工作区视图">
        <button
          type="button"
          className={view === "explore" ? "view-active" : ""}
          onClick={onExplore}
          aria-pressed={view === "explore"}
          aria-label="Explore"
        >
          <ChatsCircle size={15} weight="fill" aria-hidden="true" />
          <span>Explore</span>
        </button>
        <button
          type="button"
          className={view === "article" ? "view-active" : ""}
          onClick={() => onOpenArticle(activeId)}
          aria-pressed={view === "article"}
          aria-label="Article"
        >
          <ArticleIcon size={15} weight="fill" aria-hidden="true" />
          <span>Article</span>
        </button>
      </nav>

      <div className="topbar-context">
        <AnimatePresence initial={false} mode="popLayout">
          {view === "explore" ? (
            <motion.div
              key="explore-context"
              className="breadcrumb"
              aria-label="当前研究路径"
              initial={reduceMotion ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{
                duration: reduceMotion ? 0 : 0.18,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {stack.map((nodeId, index) => {
                const node = nodes[nodeId];
                if (!node) return null;
                const hidden =
                  stack.length > 4 &&
                  index > 0 &&
                  index < stack.length - 3;
                if (hidden) {
                  return index === 1 ? (
                    <span className="breadcrumb-ellipsis" key="ellipsis">
                      …
                    </span>
                  ) : null;
                }
                return (
                  <span
                    className="breadcrumb-segment"
                    key={`${nodeId}-${index}`}
                  >
                    {index > 0 &&
                    !(stack.length > 4 && index === stack.length - 3) ? (
                      <i aria-hidden="true">/</i>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onFocusBreadcrumb(index)}
                      aria-current={
                        index === activeIndex ? "page" : undefined
                      }
                    >
                      {node.shortTitle}
                    </button>
                  </span>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="article-context"
              className="article-context"
              aria-label="当前成稿"
              initial={reduceMotion ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{
                duration: reduceMotion ? 0 : 0.18,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span>动态成稿</span>
              <i aria-hidden="true">/</i>
              <strong>埃隆·马斯克</strong>
              <small>{sourceCount} 张来源 Card</small>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        className="topbar-actions"
        layout
        transition={{
          layout: {
            type: "spring",
            stiffness: 360,
            damping: 32,
          },
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {view === "explore" && !graphVisible ? (
            <motion.button
              key="show-graph"
              type="button"
              className="toolbar-button"
              onClick={onShowGraph}
              initial={
                reduceMotion ? false : { opacity: 0, scale: 0.94, x: 6 }
              }
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.94, x: 6 }}
              transition={{
                duration: reduceMotion ? 0 : 0.18,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Graph size={16} weight="bold" />
              <span>研究图</span>
            </motion.button>
          ) : null}
        </AnimatePresence>
        <button
          type="button"
          className="icon-button"
          onClick={onToggleTheme}
          aria-label={
            theme === "light" ? "切换到深色模式" : "切换到浅色模式"
          }
          title={theme === "light" ? "深色模式" : "浅色模式"}
          data-testid="theme-toggle"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={theme}
              initial={
                reduceMotion ? false : { opacity: 0, rotate: -30 }
              }
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 30 }}
              transition={{ duration: 0.18 }}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </motion.span>
          </AnimatePresence>
        </button>
      </motion.div>
    </header>
  );
}
