"use client";

import {
  CursorClick,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArticleView } from "@/app/components/ArticleView";
import { GraphPreview } from "@/app/components/GraphPreview";
import {
  WorkspaceTopbar,
  type WorkspaceTheme,
  type WorkspaceView,
} from "@/app/components/WorkspaceTopbar";
import {
  FollowupTurn,
  ResearchCard,
  TextSelection,
} from "@/app/components/ResearchCard";
import { useMobileDeck } from "@/app/hooks/use-mobile-deck";
import { getArticleSectionForNode } from "@/app/lib/article-research";
import {
  DeckHintSide,
  getCardMotionState,
} from "@/app/lib/deck-motion";
import {
  ALL_POSSIBLE_EDGES,
  MOCK_RESEARCH_NODES,
  ResearchNode,
  ROOT_NODE_ID,
} from "@/app/lib/mock-research";
import type { GraphEdge } from "@/app/lib/mock-research";
import {
  appendUniqueEdge,
  buildSelectionNode,
  getFollowupAnswer,
  getPathToNode,
} from "@/app/lib/research-workspace";

type SelectionState = TextSelection & {
  nodeId: string;
};

export function ResearchWorkspace() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [theme, setTheme] = useState<WorkspaceTheme>("light");
  const [workspaceView, setWorkspaceView] =
    useState<WorkspaceView>("explore");
  const [articleFocusSectionId, setArticleFocusSectionId] =
    useState("overview");
  const [stack, setStack] = useState<string[]>([ROOT_NODE_ID]);
  const [activeDeckIndex, setActiveDeckIndex] = useState(0);
  const [deckProgress, setDeckProgress] = useState(0);
  const [deckHintSide, setDeckHintSide] =
    useState<DeckHintSide | null>(null);
  const [deckPreviewIndex, setDeckPreviewIndex] = useState(0);
  const [deckHoverIndex, setDeckHoverIndex] = useState<number | null>(
    null,
  );
  const [deckPreviewFocused, setDeckPreviewFocused] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(
    () => new Set(Object.keys(MOCK_RESEARCH_NODES)),
  );
  const [edges, setEdges] = useState<GraphEdge[]>(ALL_POSSIBLE_EDGES);
  const [customNodes, setCustomNodes] = useState<
    Record<string, ResearchNode>
  >({});
  const [followups, setFollowups] = useState<
    Record<string, FollowupTurn[]>
  >({});
  const [thinkingNodeId, setThinkingNodeId] = useState<string | null>(null);
  const [graphVisible, setGraphVisible] = useState(true);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const followupCounter = useRef(0);
  const customNodeCounter = useRef(0);
  const askTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deckPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const deckLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const clearDeckSelection = useCallback(() => setSelection(null), []);

  const nodes = useMemo(
    () => ({ ...MOCK_RESEARCH_NODES, ...customNodes }),
    [customNodes],
  );
  const activeIndex = Math.min(activeDeckIndex, stack.length - 1);
  const activeId = stack[activeIndex] ?? ROOT_NODE_ID;
  const activeNode = nodes[activeId] ?? nodes[ROOT_NODE_ID];
  const compactDeck = viewportWidth <= 720;
  const deckHinted = deckHintSide !== null;
  const deckMode =
    !compactDeck && stack.length > 1 && deckProgress > 0.035;
  const previewIndex = Math.min(deckPreviewIndex, stack.length - 1);
  const {
    beginDeckSwipe,
    cancelDeckSwipe,
    finishDeckSwipe,
    handleMobileDeckSelection,
    loseDeckPointerCapture,
    mobileDeckPreview,
    mobileSwipeDelta,
    mobileSwiping,
    openMobileDeckPreview,
    resetMobileDeck,
    updateDeckSwipe,
  } = useMobileDeck({
    activeIndex,
    compact: compactDeck,
    onClearSelection: clearDeckSelection,
    previewIndex,
    setPreviewIndex: setDeckPreviewIndex,
    stackLength: stack.length,
    viewportWidth,
  });
  const deckNavigationMode = deckMode || mobileDeckPreview;
  const captionIndex = deckHoverIndex ?? previewIndex;
  const captionNode = nodes[stack[captionIndex]] ?? activeNode;
  const estimatedDeckWidth =
    viewportWidth > 1120
      ? Math.min(760, viewportWidth - 420)
      : viewportWidth > 900
        ? Math.min(730, viewportWidth - 330)
        : Math.min(700, viewportWidth - 42);
  const desktopSpreadRoom = Math.max(
    120,
    Math.min(760, viewportWidth - estimatedDeckWidth - 80),
  );
  const desktopDeckGap =
    stack.length <= 1
      ? 0
      : Math.min(
          156,
          Math.max(54, desktopSpreadRoom / (stack.length - 1)),
        );

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("lattice-theme");
    const systemDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const nextTheme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : systemDark
          ? "dark"
          : "light";
    const frame = window.requestAnimationFrame(() => setTheme(nextTheme));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      setViewportWidth(width);
      if (width <= 720) {
        setDeckProgress(0);
        setDeckHintSide(null);
        setDeckHoverIndex(null);
        setDeckPreviewFocused(false);
      }
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!deckMode) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDeckProgress(0);
      setDeckPreviewIndex(activeIndex);
      setDeckHoverIndex(null);
      setDeckPreviewFocused(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeIndex, deckMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("lattice-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.latticeReady = "true";
    return () => {
      delete document.documentElement.dataset.latticeReady;
    };
  }, []);

  useEffect(
    () => () => {
      if (askTimer.current) clearTimeout(askTimer.current);
      if (deckPreviewTimer.current) {
        clearTimeout(deckPreviewTimer.current);
      }
      if (deckLeaveTimer.current) clearTimeout(deckLeaveTimer.current);
    },
    [],
  );

  const collapseDeckTo = useCallback((index: number) => {
    if (deckPreviewTimer.current) {
      clearTimeout(deckPreviewTimer.current);
      deckPreviewTimer.current = null;
    }
    if (deckLeaveTimer.current) {
      clearTimeout(deckLeaveTimer.current);
      deckLeaveTimer.current = null;
    }
    setActiveDeckIndex(index);
    setDeckPreviewIndex(index);
    setDeckHoverIndex(null);
    setDeckPreviewFocused(false);
    setDeckHintSide(null);
    setDeckProgress(0);
    resetMobileDeck();
    setSelection(null);
  }, [resetMobileDeck]);

  const openNode = useCallback(
    (targetId: string) => {
      if (!nodes[targetId] || targetId === activeId) return;
      setSelection(null);
      const activePath = stack.slice(0, activeIndex + 1);
      const existingIndex = stack.lastIndexOf(targetId);
      const nextStack =
        existingIndex >= 0
          ? stack
          : [...activePath, targetId];
      const nextIndex =
        existingIndex >= 0 ? existingIndex : nextStack.length - 1;
      setStack(nextStack);
      collapseDeckTo(nextIndex);
    },
    [activeId, activeIndex, collapseDeckTo, nodes, stack],
  );

  function closeActiveBranch(event: ReactMouseEvent<HTMLButtonElement>) {
    if (activeIndex <= 0) return;
    const nextIndex = activeIndex - 1;
    setStack((current) => current.slice(0, activeIndex));
    collapseDeckTo(nextIndex);
    if (event.detail === 0) {
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLInputElement>(
            `[data-deck-index="${nextIndex}"] .card-composer input`,
          )
          ?.focus();
      });
    }
  }

  function focusFromGraph(nodeId: string) {
    if (!discoveredIds.has(nodeId) || nodeId === activeId) return;
    const existingIndex = stack.lastIndexOf(nodeId);
    if (existingIndex >= 0) {
      collapseDeckTo(existingIndex);
      return;
    }

    const path = getPathToNode(nodeId, edges);
    const nextStack = path ?? [ROOT_NODE_ID, nodeId];
    setStack(nextStack);
    collapseDeckTo(nextStack.length - 1);
    if (window.innerWidth < 760) setGraphExpanded(false);
  }

  function focusBreadcrumb(index: number) {
    if (index === activeIndex) return;
    collapseDeckTo(index);
  }

  function openArticleForNode(nodeId: string) {
    setArticleFocusSectionId(getArticleSectionForNode(nodeId));
    setGraphExpanded(false);
    resetMobileDeck();
    setDeckPreviewIndex(activeIndex);
    setSelection(null);
    setWorkspaceView("article");
  }

  function openSourceCard(nodeId: string) {
    setWorkspaceView("explore");
    setGraphExpanded(false);
    setSelection(null);
    if (nodeId !== activeId) focusFromGraph(nodeId);
  }

  function askFollowup(nodeId: string, question: string) {
    if (thinkingNodeId) return;
    setThinkingNodeId(nodeId);
    followupCounter.current += 1;
    const turnId = `followup-${followupCounter.current}`;

    const commitAnswer = () => {
      setFollowups((current) => ({
        ...current,
        [nodeId]: [
          ...(current[nodeId] ?? []),
          {
            id: turnId,
            question,
            answer: getFollowupAnswer(nodeId),
          },
        ],
      }));
      setThinkingNodeId(null);
    };

    if (reduceMotion) {
      commitAnswer();
    } else {
      askTimer.current = setTimeout(commitAnswer, 900);
    }
  }

  function updateSelection(next: TextSelection | null) {
    setSelection(next ? { ...next, nodeId: activeId } : null);
  }

  function forkSelection() {
    if (!selection) return;
    customNodeCounter.current += 1;
    const nodeIndex = customNodeCounter.current;
    const nodeId = `selection-${nodeIndex}`;
    const source = nodes[selection.nodeId] ?? activeNode;
    const nextNode = buildSelectionNode({
      nodeId,
      nodeIndex,
      text: selection.text,
      source,
    });

    setCustomNodes((current) => ({ ...current, [nodeId]: nextNode }));
    setDiscoveredIds((current) => new Set([...current, nodeId]));
    setEdges((current) =>
      appendUniqueEdge(current, {
        from: selection.nodeId,
        to: nodeId,
        kind: "fork",
      }),
    );
    const nextStack = [...stack.slice(0, activeIndex + 1), nodeId];
    setStack(nextStack);
    collapseDeckTo(nextStack.length - 1);
    window.getSelection()?.removeAllRanges();
  }

  function openDeckSpread() {
    if (compactDeck || stack.length <= 1) return;
    setDeckPreviewIndex(activeIndex);
    setDeckHoverIndex(null);
    setDeckPreviewFocused(false);
    setDeckHintSide(null);
    setDeckProgress(1);
    setSelection(null);
  }

  function hintDeck(side: DeckHintSide) {
    if (compactDeck || deckMode || stack.length <= 1) return;
    if (side === "left" && activeIndex <= 0) return;
    if (side === "right" && activeIndex >= stack.length - 1) return;
    setDeckHintSide(side);
  }

  function unhintDeck(side: DeckHintSide) {
    if (deckMode) return;
    setDeckHintSide((current) => (current === side ? null : current));
  }

  function selectDeckCard(index: number) {
    if (handleMobileDeckSelection(index)) return;
    collapseDeckTo(index);
  }

  function previewDeckCard(index: number) {
    if (!deckMode) return;
    if (deckLeaveTimer.current) {
      clearTimeout(deckLeaveTimer.current);
      deckLeaveTimer.current = null;
    }
    setDeckHoverIndex(index);
    if (deckPreviewTimer.current) {
      clearTimeout(deckPreviewTimer.current);
    }
    deckPreviewTimer.current = setTimeout(() => {
      setDeckPreviewIndex(index);
      setDeckPreviewFocused(true);
      deckPreviewTimer.current = null;
    }, reduceMotion ? 0 : 520);
  }

  function endDeckCardPreview(index: number) {
    if (deckHoverIndex !== index) return;
    if (deckPreviewTimer.current) {
      clearTimeout(deckPreviewTimer.current);
      deckPreviewTimer.current = null;
    }
    setDeckHoverIndex(null);
  }

  function leaveDeckSpread() {
    if (!deckMode) return;
    if (deckPreviewTimer.current) {
      clearTimeout(deckPreviewTimer.current);
      deckPreviewTimer.current = null;
    }
    if (deckLeaveTimer.current) clearTimeout(deckLeaveTimer.current);
    deckLeaveTimer.current = setTimeout(() => {
      setDeckHoverIndex(null);
      setDeckPreviewFocused(false);
      setDeckPreviewIndex(activeIndex);
      deckLeaveTimer.current = null;
    }, reduceMotion ? 0 : 240);
  }

  function reenterDeckSpread() {
    if (!deckMode || !deckLeaveTimer.current) return;
    clearTimeout(deckLeaveTimer.current);
    deckLeaveTimer.current = null;
  }

  const selectionLeft = selection
    ? Math.max(
        104,
        Math.min(
          typeof window === "undefined" ? 800 : window.innerWidth - 104,
          selection.rect.left + selection.rect.width / 2,
        ),
      )
    : 0;

  return (
    <main
      className={`workspace-shell ${
        deckMode ? "workspace-deck-open" : ""
      } ${mobileDeckPreview ? "workspace-mobile-deck-preview" : ""}`}
    >
      <WorkspaceTopbar
        view={workspaceView}
        theme={theme}
        stack={stack}
        nodes={nodes}
        activeIndex={activeIndex}
        activeId={activeId}
        sourceCount={discoveredIds.size}
        graphVisible={graphVisible}
        reduceMotion={reduceMotion}
        onExplore={() => setWorkspaceView("explore")}
        onOpenArticle={openArticleForNode}
        onFocusBreadcrumb={focusBreadcrumb}
        onShowGraph={() => setGraphVisible(true)}
        onToggleTheme={() =>
          setTheme((current) =>
            current === "light" ? "dark" : "light",
          )
        }
      />

      {workspaceView === "explore" ? (
        <>
          <section className="workspace-stage" aria-label="卡片研究空间">
            <div
              className={`deck-wrap ${
                deckMode ? "deck-wrap-spread" : ""
              } ${deckHinted ? "deck-wrap-hinted" : ""} ${
                mobileSwiping ? "deck-wrap-swiping" : ""
              } ${
                mobileDeckPreview ? "deck-wrap-mobile-preview" : ""
              }`}
              data-testid="research-deck"
              data-deck-mode={
                deckMode
                  ? "spread"
                  : mobileDeckPreview
                    ? "preview"
                    : "stacked"
              }
              data-deck-size={stack.length}
              data-deck-hint={deckHintSide ?? "none"}
              data-deck-preview={
                mobileDeckPreview || deckPreviewFocused
                  ? String(previewIndex)
                  : "none"
              }
              aria-label={
                mobileDeckPreview
                  ? `Card 折叠预览，${captionNode.shortTitle}，第 ${previewIndex + 1} 张，共 ${stack.length} 张`
                  : undefined
              }
              onPointerDown={beginDeckSwipe}
              onPointerMove={updateDeckSwipe}
              onPointerUp={finishDeckSwipe}
              onPointerCancel={cancelDeckSwipe}
              onLostPointerCapture={loseDeckPointerCapture}
              onPointerEnter={reenterDeckSpread}
              onPointerLeave={leaveDeckSpread}
            >
              <AnimatePresence>
                {deckMode &&
                (deckHoverIndex !== null || deckPreviewFocused) ? (
                  <motion.div
                    className="deck-spread-caption"
                    data-testid="deck-spread-caption"
                    role="status"
                    aria-live="polite"
                    initial={
                      reduceMotion ? false : { opacity: 0, y: 8 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18 }}
                  >
                    <strong>{captionNode.shortTitle}</strong>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {stack.map((nodeId, index) => {
                  const node = nodes[nodeId];
                  if (!node) return null;
                  return (
                    <ResearchCard
                      key={`${nodeId}-${index}`}
                      node={node}
                      active={index === activeIndex}
                      deckIndex={index}
                      deckMode={deckNavigationMode}
                      mobilePreview={mobileDeckPreview}
                      deckPickable={
                        deckMode ||
                        (mobileDeckPreview &&
                          Math.abs(index - previewIndex) <= 1)
                      }
                      deckPreviewed={
                        (deckMode && index === captionIndex) ||
                        (mobileDeckPreview && index === previewIndex)
                      }
                      motionState={getCardMotionState(index, {
                        activeIndex,
                        stackLength: stack.length,
                        compact: compactDeck,
                        mobilePreview: mobileDeckPreview,
                        mobileSwipeDelta,
                        viewportWidth,
                        hintSide: deckHintSide,
                        previewFocused: deckPreviewFocused,
                        previewIndex,
                        hoverIndex: deckHoverIndex,
                        desktopGap: desktopDeckGap,
                        progress: deckProgress,
                        spread: deckMode,
                      })}
                      draggingDeck={mobileSwiping}
                      followups={followups[nodeId] ?? []}
                      thinking={thinkingNodeId === nodeId}
                      onAnchor={openNode}
                      onAsk={askFollowup}
                      onDeckPreview={previewDeckCard}
                      onDeckPreviewEnd={endDeckCardPreview}
                      onDeckSelect={selectDeckCard}
                      onTextSelection={updateSelection}
                      reduceMotion={reduceMotion}
                    />
                  );
                })}
              </AnimatePresence>

              {mobileDeckPreview ? (
                <span
                  className="visually-hidden"
                  role="status"
                  aria-live="polite"
                >
                  正在预览 {captionNode.shortTitle}，第 {previewIndex + 1} 张，
                  共 {stack.length} 张。左右滑动切换，点击中间 Card 打开。
                </span>
              ) : null}

              <AnimatePresence>
                {stack.length > 1 && !compactDeck && !deckMode ? (
                  <>
                    {activeIndex > 0 ? (
                      <motion.button
                        type="button"
                        className="deck-edge-trigger deck-edge-trigger-left"
                        onClick={openDeckSpread}
                        onPointerEnter={() => hintDeck("left")}
                        onPointerLeave={() => unhintDeck("left")}
                        onFocus={() => hintDeck("left")}
                        onBlur={() => unhintDeck("left")}
                        aria-label="从左侧展开 Card 路径"
                        initial={
                          reduceMotion ? false : { opacity: 0 }
                        }
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.18 }}
                      />
                    ) : null}
                    {activeIndex < stack.length - 1 ? (
                      <motion.button
                        type="button"
                        className="deck-edge-trigger deck-edge-trigger-right"
                        onClick={openDeckSpread}
                        onPointerEnter={() => hintDeck("right")}
                        onPointerLeave={() => unhintDeck("right")}
                        onFocus={() => hintDeck("right")}
                        onBlur={() => unhintDeck("right")}
                        aria-label="从右侧展开 Card 路径"
                        initial={
                          reduceMotion ? false : { opacity: 0 }
                        }
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.18 }}
                      />
                    ) : null}
                  </>
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {stack.length > 1 &&
                compactDeck &&
                !mobileDeckPreview ? (
                  <>
                    {activeIndex > 0 ? (
                      <motion.button
                        type="button"
                        className="mobile-deck-edge-trigger mobile-deck-edge-trigger-left"
                        onClick={(event) =>
                          openMobileDeckPreview(
                            "left",
                            event.detail === 0,
                          )
                        }
                        aria-label="从左侧查看 Card 路径"
                        initial={
                          reduceMotion ? false : { opacity: 0 }
                        }
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.18,
                        }}
                      />
                    ) : null}
                    {activeIndex < stack.length - 1 ? (
                      <motion.button
                        type="button"
                        className="mobile-deck-edge-trigger mobile-deck-edge-trigger-right"
                        onClick={(event) =>
                          openMobileDeckPreview(
                            "right",
                            event.detail === 0,
                          )
                        }
                        aria-label="从右侧查看 Card 路径"
                        initial={
                          reduceMotion ? false : { opacity: 0 }
                        }
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.18,
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {activeIndex > 0 && !deckNavigationMode ? (
                  <motion.button
                    type="button"
                    className="branch-close-button"
                    onClick={closeActiveBranch}
                    aria-label="关闭当前分支"
                    title="关闭当前分支"
                    initial={
                      reduceMotion ? false : { opacity: 0, scale: 0.88 }
                    }
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: reduceMotion ? 0 : 0.16 }}
                  >
                    <X size={15} weight="bold" aria-hidden="true" />
                  </motion.button>
                ) : null}
              </AnimatePresence>
            </div>
          </section>

          <AnimatePresence>
            {graphVisible && !mobileDeckPreview ? (
              <GraphPreview
                nodes={nodes}
                discoveredIds={discoveredIds}
                edges={edges}
                activeId={activeId}
                expanded={graphExpanded}
                visible={graphVisible}
                onExpandedChange={setGraphExpanded}
                onVisibleChange={setGraphVisible}
                onFocusNode={focusFromGraph}
                reduceMotion={reduceMotion}
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {selection ? (
              <motion.div
                className="selection-menu"
                style={{
                  left: selectionLeft,
                  top: Math.max(78, selection.rect.top - 50),
                }}
                initial={
                  reduceMotion ? false : { opacity: 0, y: 7, scale: 0.96 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 360, damping: 27 }}
              >
                <button type="button" onClick={forkSelection}>
                  <CursorClick size={15} weight="bold" />
                  从选区分叉
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      ) : (
        <ArticleView
          nodes={nodes}
          discoveredIds={discoveredIds}
          edges={edges}
          followups={followups}
          focusSectionId={articleFocusSectionId}
          onOpenSource={openSourceCard}
          reduceMotion={reduceMotion}
        />
      )}
    </main>
  );
}
