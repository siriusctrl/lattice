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
        {view === "explore" ? (
          <div className="breadcrumb" aria-label="当前研究路径">
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
          </div>
        ) : (
          <div className="article-context" aria-label="当前成稿">
            <span>动态成稿</span>
            <i aria-hidden="true">/</i>
            <strong>埃隆·马斯克</strong>
            <small>{sourceCount} 张来源 Card</small>
          </div>
        )}
      </div>

      <div className="topbar-actions">
        {view === "explore" && !graphVisible ? (
          <button
            type="button"
            className="toolbar-button"
            onClick={onShowGraph}
          >
            <Graph size={16} weight="bold" />
            <span>研究图</span>
          </button>
        ) : null}
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
          <AnimatePresence mode="wait" initial={false}>
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
      </div>
    </header>
  );
}
