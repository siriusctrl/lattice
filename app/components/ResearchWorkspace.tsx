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
import { useDeckTransition } from "@/app/hooks/use-deck-transition";
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
  const deckHoverLeaveTimer = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const deckPointerPosition = useRef<{
    x: number;
    y: number;
    index: number;
  } | null>(null);
  const deckLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const themeTransitionTimer = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
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
    mobileTransition,
    openMobileDeckPreview,
    resetMobileDeck,
    updateDeckSwipe,
  } = useMobileDeck({
    activeIndex,
    compact: compactDeck,
    onClearSelection: clearDeckSelection,
    previewIndex,
    reduceMotion,
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
      if (deckHoverLeaveTimer.current) {
        clearTimeout(deckHoverLeaveTimer.current);
      }
      if (deckLeaveTimer.current) clearTimeout(deckLeaveTimer.current);
      if (themeTransitionTimer.current) {
        clearTimeout(themeTransitionTimer.current);
      }
      delete document.documentElement.dataset.themeTransition;
    },
    [],
  );

  const collapseDeckTo = useCallback((index: number) => {
    if (deckPreviewTimer.current) {
      clearTimeout(deckPreviewTimer.current);
      deckPreviewTimer.current = null;
    }
    if (deckHoverLeaveTimer.current) {
      clearTimeout(deckHoverLeaveTimer.current);
      deckHoverLeaveTimer.current = null;
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
    deckPointerPosition.current = null;
    resetMobileDeck();
    setSelection(null);
  }, [resetMobileDeck]);

  const { beginDeckTransition, deckTransition } = useDeckTransition({
    collapseDeckTo,
    reduceMotion,
    setStack,
    stackLength: stack.length,
  });

  const openNode = useCallback(
    (targetId: string) => {
      if (
        deckTransition ||
        !nodes[targetId] ||
        targetId === activeId
      ) {
        return;
      }
      setSelection(null);
      const activePath = stack.slice(0, activeIndex + 1);
      const existingIndex = stack.lastIndexOf(targetId);
      if (existingIndex >= 0) {
        collapseDeckTo(existingIndex);
        return;
      }

      const nextStack = [...activePath, targetId];
      beginDeckTransition({
        removingFromIndex: activeIndex + 1,
        nextStack,
        nextActiveIndex: nextStack.length - 1,
        activeIndexDuringExit: activeIndex,
      });
    },
    [
      activeId,
      activeIndex,
      beginDeckTransition,
      collapseDeckTo,
      deckTransition,
      nodes,
      stack,
    ],
  );

  function closeActiveBranch(event: ReactMouseEvent<HTMLButtonElement>) {
    if (activeIndex <= 0 || deckTransition) return;
    const nextIndex = activeIndex - 1;
    beginDeckTransition({
      removingFromIndex: activeIndex,
      nextStack: stack.slice(0, activeIndex),
      nextActiveIndex: nextIndex,
      activeIndexDuringExit: nextIndex,
      focusComposerAfter: event.detail === 0,
    });
  }

  function focusFromGraph(nodeId: string) {
    if (
      deckTransition ||
      !discoveredIds.has(nodeId) ||
      nodeId === activeId
    ) {
      return;
    }
    const existingIndex = stack.lastIndexOf(nodeId);
    if (existingIndex >= 0) {
      collapseDeckTo(existingIndex);
      return;
    }

    const path = getPathToNode(nodeId, edges);
    const nextStack = path ?? [ROOT_NODE_ID, nodeId];
    let sharedPrefixLength = 0;
    while (
      sharedPrefixLength < stack.length &&
      sharedPrefixLength < nextStack.length &&
      stack[sharedPrefixLength] === nextStack[sharedPrefixLength]
    ) {
      sharedPrefixLength += 1;
    }
    const removingFromIndex = Math.max(1, sharedPrefixLength);
    beginDeckTransition({
      removingFromIndex,
      nextStack,
      nextActiveIndex: nextStack.length - 1,
      activeIndexDuringExit: Math.max(0, removingFromIndex - 1),
    });
    if (window.innerWidth < 760) setGraphExpanded(false);
  }

  function focusBreadcrumb(index: number) {
    if (deckTransition || index === activeIndex) return;
    collapseDeckTo(index);
  }

  function openArticleForNode(nodeId: string) {
    if (deckTransition) return;
    setArticleFocusSectionId(getArticleSectionForNode(nodeId));
    setGraphExpanded(false);
    resetMobileDeck();
    setDeckPreviewIndex(activeIndex);
    setSelection(null);
    setWorkspaceView("article");
  }

  function openSourceCard(nodeId: string) {
    if (deckTransition) return;
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
    if (!selection || deckTransition) return;
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
    beginDeckTransition({
      removingFromIndex: activeIndex + 1,
      nextStack,
      nextActiveIndex: nextStack.length - 1,
      activeIndexDuringExit: activeIndex,
    });
    window.getSelection()?.removeAllRanges();
  }

  function openDeckSpread() {
    if (deckTransition || compactDeck || stack.length <= 1) return;
    setDeckPreviewIndex(activeIndex);
    setDeckHoverIndex(null);
    setDeckPreviewFocused(false);
    setDeckHintSide(null);
    setDeckProgress(1);
    setSelection(null);
  }

  function hintDeck(side: DeckHintSide) {
    if (
      deckTransition ||
      compactDeck ||
      deckMode ||
      stack.length <= 1
    ) {
      return;
    }
    if (side === "left" && activeIndex <= 0) return;
    if (side === "right" && activeIndex >= stack.length - 1) return;
    setDeckHintSide(side);
  }

  function unhintDeck(side: DeckHintSide) {
    if (deckMode) return;
    setDeckHintSide((current) => (current === side ? null : current));
  }

  function selectDeckCard(index: number) {
    if (deckTransition) return;
    if (handleMobileDeckSelection(index)) return;
    collapseDeckTo(index);
  }

  function previewDeckCard(
    index: number,
    pointer?: { x: number; y: number },
  ) {
    if (!deckMode) return;
    if (pointer) {
      const previous = deckPointerPosition.current;
      const moved =
        !previous ||
        Math.hypot(pointer.x - previous.x, pointer.y - previous.y) > 1.5;
      if (!moved) return;
      deckPointerPosition.current = { ...pointer, index };
    } else {
      deckPointerPosition.current = null;
    }
    if (deckHoverLeaveTimer.current) {
      clearTimeout(deckHoverLeaveTimer.current);
      deckHoverLeaveTimer.current = null;
    }
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
    if (deckHoverLeaveTimer.current) {
      clearTimeout(deckHoverLeaveTimer.current);
    }
    deckHoverLeaveTimer.current = setTimeout(() => {
      setDeckHoverIndex((current) => (current === index ? null : current));
      deckHoverLeaveTimer.current = null;
    }, reduceMotion ? 0 : 120);
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

  function toggleTheme() {
    document.documentElement.dataset.themeTransition = "true";
    if (themeTransitionTimer.current) {
      clearTimeout(themeTransitionTimer.current);
    }
    setTheme((current) => (current === "light" ? "dark" : "light"));
    themeTransitionTimer.current = setTimeout(() => {
      delete document.documentElement.dataset.themeTransition;
      themeTransitionTimer.current = null;
    }, 320);
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
  const topbarStack = deckTransition
    ? stack.slice(0, deckTransition.removingFromIndex)
    : stack;

  return (
    <main
      className={`workspace-shell ${
        deckMode ? "workspace-deck-open" : ""
      } ${mobileDeckPreview ? "workspace-mobile-deck-preview" : ""} ${
        deckTransition ? "workspace-deck-transitioning" : ""
      }`}
    >
      <WorkspaceTopbar
        view={workspaceView}
        theme={theme}
        stack={topbarStack}
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
        onToggleTheme={toggleTheme}
      />

      <div
        className="workspace-view-layer workspace-view-explore"
        data-testid="workspace-view-explore"
        data-view-active={workspaceView === "explore" ? "true" : "false"}
        aria-hidden={workspaceView !== "explore"}
        inert={workspaceView !== "explore" ? true : undefined}
      >
          <section className="workspace-stage" aria-label="卡片研究空间">
            <div
              className={`deck-wrap ${
                deckMode ? "deck-wrap-spread" : ""
              } ${deckHinted ? "deck-wrap-hinted" : ""} ${
                mobileSwiping ? "deck-wrap-swiping" : ""
              } ${
                mobileDeckPreview ? "deck-wrap-mobile-preview" : ""
              } ${
                mobileTransition ? "deck-wrap-mobile-transitioning" : ""
              } ${
                deckTransition ? "deck-wrap-transitioning" : ""
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
              data-deck-transition={
                deckTransition ? "removing-suffix" : "idle"
              }
              data-deck-hint={deckHintSide ?? "none"}
              data-deck-preview={
                mobileDeckPreview || deckPreviewFocused
                  ? String(previewIndex)
                  : "none"
              }
              data-mobile-transition={
                mobileTransition
                  ? `${mobileTransition.fromIndex}:${mobileTransition.toIndex}`
                  : "idle"
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
                        !deckTransition &&
                        !mobileTransition &&
                        (deckMode ||
                          (mobileDeckPreview &&
                            Math.abs(index - previewIndex) <= 1))
                      }
                      deckPreviewed={
                        (deckMode && index === captionIndex) ||
                        (mobileDeckPreview &&
                          index ===
                            (mobileTransition?.fromIndex ?? previewIndex))
                      }
                      mobileOutgoing={
                        mobileTransition?.fromIndex === index
                      }
                      mobileIncoming={
                        mobileTransition?.toIndex === index
                      }
                      mobileGestureParticipant={
                        mobileDeckPreview &&
                        (mobileTransition
                          ? index === mobileTransition.fromIndex ||
                            index === mobileTransition.toIndex
                          : Math.abs(index - previewIndex) <= 1)
                      }
                      mobileTransitioning={
                        mobileTransition !== null &&
                        (index === mobileTransition.fromIndex ||
                          index === mobileTransition.toIndex)
                      }
                      leavingDeck={
                        deckTransition !== null &&
                        index >= deckTransition.removingFromIndex
                      }
                      leavingOrder={
                        deckTransition
                          ? Math.max(
                              0,
                              index - deckTransition.removingFromIndex,
                            )
                          : 0
                      }
                      motionState={getCardMotionState(index, {
                        activeIndex,
                        stackLength: stack.length,
                        compact: compactDeck,
                        mobilePreview: mobileDeckPreview,
                        mobileSwipeDelta,
                        mobileTransition,
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
                {stack.length > 1 &&
                !deckTransition &&
                !compactDeck &&
                !deckMode ? (
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
                !deckTransition &&
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
                {activeIndex > 0 &&
                !deckTransition &&
                !deckNavigationMode ? (
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
            {graphVisible ? (
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
      </div>

      <div
        className="workspace-view-layer workspace-view-article"
        data-testid="workspace-view-article"
        data-view-active={workspaceView === "article" ? "true" : "false"}
        aria-hidden={workspaceView !== "article"}
        inert={workspaceView !== "article" ? true : undefined}
      >
        <ArticleView
          nodes={nodes}
          discoveredIds={discoveredIds}
          edges={edges}
          followups={followups}
          focusSectionId={articleFocusSectionId}
          onOpenSource={openSourceCard}
          reduceMotion={reduceMotion}
        />
      </div>
    </main>
  );
}
