"use client";

import {
  ArrowUp,
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
  ResearchCard,
  TextSelection,
} from "@/app/components/ResearchCard";
import {
  type BeginDeckTransitionInput,
  useDeckTransition,
} from "@/app/hooks/use-deck-transition";
import { useMobileDeck } from "@/app/hooks/use-mobile-deck";
import { getArticleSectionForNode } from "@/app/lib/article-research";
import {
  DeckHintSide,
  getCardMotionState,
  MOBILE_DECK_VISIBLE_PILE_DEPTH,
} from "@/app/lib/deck-motion";
import { createDemoHost } from "@/app/lib/demo-host";
import {
  cancelLatticeRun,
  consumeFollowupRun,
  type FollowupTurn,
  type LatticeAskOutcome,
  type LatticeHost,
  type LatticeHydration,
  type LatticeRun,
  LatticeNavigationGeneration,
  startLatticeRun,
} from "@/app/lib/lattice-host";
import {
  ALL_POSSIBLE_EDGES,
  MOCK_RESEARCH_NODES,
  ResearchNode,
  ROOT_NODE_ID,
} from "@/app/lib/mock-research";
import type { GraphEdge } from "@/app/lib/mock-research";
import {
  appendUniqueEdge,
  getPathToNode,
} from "@/app/lib/research-workspace";

type SelectionState = TextSelection & {
  nodeId: string;
};

type StreamingFollowup = {
  nodeId: string;
  turn: FollowupTurn;
};

const EMPTY_ROOT_NODE_ID = "lattice-root";

export type ResearchWorkspaceProps = {
  host?: LatticeHost;
};

export function ResearchWorkspace({ host }: ResearchWorkspaceProps = {}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [theme, setTheme] = useState<WorkspaceTheme>("light");
  const [workspaceView, setWorkspaceView] =
    useState<WorkspaceView>("explore");
  const [articleFocusSectionId, setArticleFocusSectionId] =
    useState("overview");
  const [rootNodeId, setRootNodeId] = useState(ROOT_NODE_ID);
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
  const [preparedNodes, setPreparedNodes] = useState<
    Record<string, ResearchNode>
  >(MOCK_RESEARCH_NODES);
  const [customNodes, setCustomNodes] = useState<
    Record<string, ResearchNode>
  >({});
  const [followups, setFollowups] = useState<
    Record<string, FollowupTurn[]>
  >({});
  const [streamingFollowup, setStreamingFollowup] =
    useState<StreamingFollowup | null>(null);
  const [askErrors, setAskErrors] = useState<
    Record<string, string | undefined>
  >({});
  const [thinkingNodeId, setThinkingNodeId] = useState<string | null>(null);
  const [graphVisible, setGraphVisible] = useState(true);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [selectionPending, setSelectionPending] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [blankQuestion, setBlankQuestion] = useState("");
  const followupCounter = useRef(0);
  const customNodeCounter = useRef(0);
  const askRun = useRef<LatticeRun | null>(null);
  const selectionRun = useRef<LatticeRun | null>(null);
  const navigationGeneration = useRef(new LatticeNavigationGeneration());
  const workspaceMounted = useRef(true);
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
  const demoHost = useMemo(
    () => createDemoHost({ followupDelayMs: reduceMotion ? 0 : 900 }),
    [reduceMotion],
  );
  const activeHost: LatticeHost = host ?? demoHost;
  const [hostHydrated, setHostHydrated] = useState(!activeHost.load);
  const [hostLoadError, setHostLoadError] = useState<string | null>(null);
  const invalidateSelectionRun = useCallback((reason: string) => {
    navigationGeneration.current.invalidate();
    const run = selectionRun.current;
    selectionRun.current = null;
    void cancelLatticeRun(run, reason);
  }, []);

  const nodes = useMemo(
    () => ({ ...preparedNodes, ...customNodes }),
    [customNodes, preparedNodes],
  );
  const activeIndex = Math.min(activeDeckIndex, stack.length - 1);
  const activeId = stack[activeIndex] ?? rootNodeId;
  const activeNode =
    nodes[activeId] ??
    nodes[rootNodeId] ??
    Object.values(nodes)[0];
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

  const applyHydration = useCallback(
    (
      hydration: LatticeHydration,
      preserveActiveRun = false,
    ) => {
      const availableIds = new Set(Object.keys(hydration.nodes));
      const hydratedRootNodeId =
        hydration.rootNodeId && availableIds.has(hydration.rootNodeId)
          ? hydration.rootNodeId
          : null;
      const hydratedActiveNodeId =
        hydration.activeNodeId &&
        availableIds.has(hydration.activeNodeId)
          ? hydration.activeNodeId
          : hydratedRootNodeId;
      if (!hydratedRootNodeId || !hydratedActiveNodeId) {
        navigationGeneration.current.invalidate();
        if (!preserveActiveRun) {
          void cancelLatticeRun(askRun.current, "workspace_hydrated");
          void cancelLatticeRun(selectionRun.current, "workspace_hydrated");
          askRun.current = null;
          selectionRun.current = null;
        }
        setRootNodeId(EMPTY_ROOT_NODE_ID);
        setPreparedNodes({});
        setCustomNodes({});
        setEdges([]);
        setDiscoveredIds(new Set());
        setFollowups({});
        setStack([]);
        setActiveDeckIndex(0);
        setDeckPreviewIndex(0);
        setWorkspaceView("explore");
        setStreamingFollowup(null);
        setThinkingNodeId(null);
        setSelection(null);
        setSelectionPending(false);
        setSelectionError(null);
        setAskErrors({});
        setHostHydrated(true);
        return;
      }
      const storedDeck = (hydration.deckNodeIds ?? []).filter((nodeId) =>
        availableIds.has(nodeId),
      );
      const path =
        getPathToNode(
          hydratedActiveNodeId,
          hydration.edges,
          hydratedRootNodeId,
        ) ?? [hydratedRootNodeId];
      const nextStack =
        storedDeck[0] === hydratedRootNodeId &&
        storedDeck.includes(hydratedActiveNodeId)
          ? storedDeck
          : path;
      const nextActiveIndex = Math.max(
        0,
        nextStack.lastIndexOf(hydratedActiveNodeId),
      );

      navigationGeneration.current.invalidate();
      if (!preserveActiveRun) {
        void cancelLatticeRun(askRun.current, "workspace_hydrated");
        void cancelLatticeRun(selectionRun.current, "workspace_hydrated");
        askRun.current = null;
        selectionRun.current = null;
      }
      setRootNodeId(hydratedRootNodeId);
      setPreparedNodes(hydration.nodes);
      setCustomNodes({});
      setEdges(hydration.edges);
      setDiscoveredIds(new Set(availableIds));
      setFollowups(hydration.followups);
      setStack(nextStack);
      setActiveDeckIndex(nextActiveIndex);
      setDeckPreviewIndex(nextActiveIndex);
      setWorkspaceView(hydration.view ?? "explore");
      setStreamingFollowup(null);
      setThinkingNodeId(null);
      setSelection(null);
      setSelectionPending(false);
      setSelectionError(null);
      setAskErrors({});
      setBlankQuestion("");
      setHostLoadError(null);
      setHostHydrated(true);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    if (!activeHost.load) {
      queueMicrotask(() => {
        if (!cancelled) setHostHydrated(true);
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (!cancelled) {
        setHostHydrated(false);
        setHostLoadError(null);
      }
    });
    void activeHost.load()
      .then((hydration) => {
        if (!cancelled && workspaceMounted.current) {
          applyHydration(hydration);
        }
      })
      .catch((error) => {
        if (cancelled || !workspaceMounted.current) return;
        setPreparedNodes({});
        setCustomNodes({});
        setEdges([]);
        setDiscoveredIds(new Set());
        setStack([]);
        setHostLoadError(
          error instanceof Error
            ? error.message
            : "无法读取 .lattice 研究数据。",
        );
        setHostHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activeHost, applyHydration]);

  useEffect(() => {
    if (!hostHydrated || !activeHost.saveUiState || !activeNode) return;
    const timer = window.setTimeout(() => {
      void activeHost.saveUiState?.({
        activeNodeId: activeId,
        view: workspaceView,
        deckNodeIds: stack,
      }).catch(() => {
        // Research truth is already durable. UI position persistence remains
        // best effort so navigation never becomes unusable during shutdown.
      });
    }, 160);
    return () => window.clearTimeout(timer);
  }, [
    activeHost,
    activeId,
    activeNode,
    hostHydrated,
    stack,
    workspaceView,
  ]);

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
    () => {
      workspaceMounted.current = true;
      return () => {
        workspaceMounted.current = false;
        void cancelLatticeRun(askRun.current, "workspace_unmounted");
        void cancelLatticeRun(selectionRun.current, "workspace_unmounted");
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
      };
    },
    [],
  );

  const collapseDeckTo = useCallback((index: number) => {
    invalidateSelectionRun("deck_navigation");
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
  }, [invalidateSelectionRun, resetMobileDeck]);

  const {
    beginDeckTransition,
    deckTransition,
    markDeckExitComplete,
    markDeckExitStarted,
  } = useDeckTransition({
    collapseDeckTo,
    reduceMotion,
    setStack,
    stackLength: stack.length,
  });
  const beginManagedDeckTransition = useCallback(
    (input: BeginDeckTransitionInput) => {
      invalidateSelectionRun("deck_transition");
      const primaryCard = document.querySelector<HTMLElement>(
        `[data-testid="research-deck"] [data-deck-index="${input.removingFromIndex}"]`,
      );
      const motionLayer =
        primaryCard?.closest<HTMLElement>(".research-card-motion");
      const transform = motionLayer
        ? getComputedStyle(motionLayer).transform
        : "none";
      let exitOrigin = null;
      if (transform !== "none") {
        try {
          const matrix = new DOMMatrixReadOnly(transform);
          exitOrigin = { x: matrix.m41, y: matrix.m42 };
        } catch {
          // The current browser transform is only an enhancement to preserve
          // an interrupted spread position. The managed exit still works from
          // its computed Deck geometry if the matrix cannot be read.
        }
      }
      beginDeckTransition({ ...input, exitOrigin });
    },
    [beginDeckTransition, invalidateSelectionRun],
  );

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
      beginManagedDeckTransition({
        removingFromIndex: activeIndex + 1,
        nextStack,
        nextActiveIndex: nextStack.length - 1,
        activeIndexDuringExit: activeIndex,
      });
    },
    [
      activeId,
      activeIndex,
      beginManagedDeckTransition,
      collapseDeckTo,
      deckTransition,
      nodes,
      stack,
    ],
  );

  function closeActiveBranch(event: ReactMouseEvent<HTMLButtonElement>) {
    if (activeIndex <= 0 || deckTransition) return;
    const nextIndex = activeIndex - 1;
    beginManagedDeckTransition({
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

    const path = getPathToNode(nodeId, edges, rootNodeId);
    const nextStack = path ?? [rootNodeId, nodeId];
    let sharedPrefixLength = 0;
    while (
      sharedPrefixLength < stack.length &&
      sharedPrefixLength < nextStack.length &&
      stack[sharedPrefixLength] === nextStack[sharedPrefixLength]
    ) {
      sharedPrefixLength += 1;
    }
    const removingFromIndex = Math.max(1, sharedPrefixLength);
    beginManagedDeckTransition({
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
    invalidateSelectionRun("workspace_view_changed");
    setArticleFocusSectionId(
      getArticleSectionForNode(nodeId, rootNodeId),
    );
    setGraphExpanded(false);
    resetMobileDeck();
    setDeckPreviewIndex(activeIndex);
    setSelection(null);
    setWorkspaceView("article");
  }

  function openSourceCard(nodeId: string) {
    if (deckTransition) return;
    invalidateSelectionRun("workspace_view_changed");
    setWorkspaceView("explore");
    setGraphExpanded(false);
    setSelection(null);
    if (nodeId !== activeId) focusFromGraph(nodeId);
  }

  async function askFollowup(
    nodeId: string,
    question: string,
  ): Promise<LatticeAskOutcome> {
    if (thinkingNodeId || askRun.current) {
      return {
        status: "failed",
        message: "当前回答仍在进行，请稍后重试。",
      };
    }
    setAskErrors((current) => ({ ...current, [nodeId]: undefined }));
    setThinkingNodeId(nodeId);
    followupCounter.current += 1;
    const requestId = `followup-${crypto.randomUUID()}`;
    const started = startLatticeRun(activeHost, {
      kind: "followup",
      requestId,
      nodeId,
      sourceNode: nodes[nodeId],
      question,
      contextNodeIds: stack.slice(0, activeIndex + 1),
    });
    if (!started.ok) {
      const message = started.message;
      setThinkingNodeId(null);
      setAskErrors((current) => ({ ...current, [nodeId]: message }));
      return { status: "failed", message };
    }
    const run = started.run;
    askRun.current = run;

    let outcome: LatticeAskOutcome;
    try {
      outcome = await consumeFollowupRun(run, nodeId, question, {
        onDraft: (turn) => {
          if (!workspaceMounted.current || askRun.current !== run) return;
          setStreamingFollowup(turn ? { nodeId, turn } : null);
        },
        onResult: (turn) => {
          if (!workspaceMounted.current || askRun.current !== run) return;
          setFollowups((current) => {
            const nodeTurns = current[nodeId] ?? [];
            const existingIndex = nodeTurns.findIndex(
              (candidate) => candidate.id === turn.id,
            );
            const nextTurns =
              existingIndex < 0
                ? [...nodeTurns, turn]
                : nodeTurns.map((candidate, index) =>
                    index === existingIndex ? turn : candidate,
                  );
            return { ...current, [nodeId]: nextTurns };
          });
        },
        onWorkspace: (hydration) => applyHydration(hydration, true),
      });
    } catch (error) {
      outcome = {
        status: "failed",
        message:
          error instanceof Error && error.message
            ? error.message
            : "回答运行失败，请重试。",
      };
    } finally {
      if (askRun.current === run) {
        askRun.current = null;
        if (workspaceMounted.current) {
          setThinkingNodeId((current) =>
            current === nodeId ? null : current,
          );
          setStreamingFollowup((current) =>
            current?.nodeId === nodeId ? null : current,
          );
        }
      }
    }

    if (
      workspaceMounted.current &&
      outcome.status !== "completed"
    ) {
      setAskErrors((current) => ({
        ...current,
        [nodeId]: outcome.message,
      }));
    }
    return outcome;
  }

  function updateSelection(next: TextSelection | null) {
    setSelectionError(null);
    setSelection(next ? { ...next, nodeId: activeId } : null);
  }

  function forkSelection() {
    if (!selection || deckTransition || selectionRun.current) return;
    if (askRun.current || thinkingNodeId) {
      setSelectionError("请等待当前回答完成后再从选区分叉。");
      return;
    }
    setSelectionError(null);
    customNodeCounter.current += 1;
    const nodeIndex = customNodeCounter.current;
    const suggestedNodeId = `selection-${crypto.randomUUID()}`;
    const source = nodes[selection.nodeId] ?? activeNode;
    const sourceNodeId = selection.nodeId;
    const requestGeneration = navigationGeneration.current.snapshot();
    const started = startLatticeRun(activeHost, {
      kind: "selection_fork",
      requestId: `selection-fork-${crypto.randomUUID()}`,
      sourceNode: source,
      selectionText: selection.text,
      suggestedNodeId,
      selectionIndex: nodeIndex,
      contextNodeIds: stack.slice(0, activeIndex + 1),
    });
    if (!started.ok) {
      setSelectionError(started.message);
      return;
    }
    const run = started.run;
    selectionRun.current = run;
    setSelectionPending(true);
    window.getSelection()?.removeAllRanges();

    void (async () => {
      try {
        for await (const event of run.events) {
          const requestIsCurrent =
            workspaceMounted.current &&
            selectionRun.current === run &&
            navigationGeneration.current.isCurrent(requestGeneration);
          if (!requestIsCurrent) {
            void cancelLatticeRun(run, "stale_selection_fork");
            return;
          }
          if (
            event.type === "done" ||
            event.type === "cancelled"
          ) {
            return;
          }
          if (event.type === "error") {
            setSelectionError(event.error.message);
            return;
          }
          if (
            event.type !== "result" ||
            event.result.kind !== "selection_fork" ||
            event.result.sourceNodeId !== sourceNodeId
          ) {
            continue;
          }

          const result = event.result;
          selectionRun.current = null;
          setSelection(null);
          setSelectionError(null);
          setCustomNodes((current) => ({
            ...current,
            [result.node.id]: result.node,
          }));
          setDiscoveredIds(
            (current) => new Set([...current, result.node.id]),
          );
          setEdges((current) => appendUniqueEdge(current, result.edge));
          const nextStack = [
            ...stack.slice(0, activeIndex + 1),
            result.node.id,
          ];
          beginManagedDeckTransition({
            removingFromIndex: activeIndex + 1,
            nextStack,
            nextActiveIndex: nextStack.length - 1,
            activeIndexDuringExit: activeIndex,
          });
          return;
        }
      } catch (error) {
        if (workspaceMounted.current) {
          setSelectionError(
            error instanceof Error ? error.message : "选区研究失败，请重试。",
          );
        }
      } finally {
        if (selectionRun.current === run) selectionRun.current = null;
        if (workspaceMounted.current) setSelectionPending(false);
      }
    })();
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
  const workspaceEmpty = hostHydrated && Object.keys(nodes).length === 0;

  async function askBlankWorkspace() {
    const question = blankQuestion.trim();
    if (!question || thinkingNodeId || askRun.current) return;
    setBlankQuestion("");
    const outcome = await askFollowup(EMPTY_ROOT_NODE_ID, question);
    if (
      outcome.status !== "completed" &&
      workspaceMounted.current
    ) {
      setBlankQuestion((current) => current || question);
    }
  }

  if (!hostHydrated && activeHost.load) {
    return (
      <main
        className="workspace-shell workspace-shell-empty"
        data-testid="empty-research-workspace"
        aria-busy="true"
      />
    );
  }

  if (workspaceEmpty) {
    return (
      <main
        className="workspace-shell workspace-shell-empty"
        data-testid="empty-research-workspace"
      >
        <form
          className="empty-research-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void askBlankWorkspace();
          }}
        >
          <textarea
            value={blankQuestion}
            onChange={(event) => setBlankQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="提出一个研究问题"
            aria-label="研究问题"
            rows={1}
            disabled={thinkingNodeId !== null}
          />
          <button
            type="submit"
            aria-label="开始研究"
            disabled={!blankQuestion.trim() || thinkingNodeId !== null}
          >
            <ArrowUp size={17} weight="bold" aria-hidden="true" />
          </button>
          {hostLoadError || askErrors[EMPTY_ROOT_NODE_ID] ? (
            <p className="empty-research-error" role="alert">
              {hostLoadError ?? askErrors[EMPTY_ROOT_NODE_ID]}
            </p>
          ) : null}
        </form>
      </main>
    );
  }

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
                  const mobileGestureParticipant =
                    mobileDeckPreview &&
                    Math.abs(index - previewIndex) <=
                      MOBILE_DECK_VISIBLE_PILE_DEPTH + 1;
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
                        mobileGestureParticipant
                      }
                      mobileTransitioning={
                        mobileTransition !== null &&
                        mobileGestureParticipant
                      }
                      leavingDeck={
                        deckTransition !== null &&
                        index >= deckTransition.removingFromIndex
                      }
                      deckExitOrigin={
                        deckTransition && index === deckTransition.removingFromIndex
                          ? deckTransition.exitOrigin
                          : null
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
                      streamingFollowup={
                        streamingFollowup?.nodeId === nodeId
                          ? streamingFollowup.turn
                          : null
                      }
                      thinking={thinkingNodeId === nodeId}
                      askError={askErrors[nodeId] ?? null}
                      onAnchor={openNode}
                      onAsk={askFollowup}
                      onDeckPreview={previewDeckCard}
                      onDeckPreviewEnd={endDeckCardPreview}
                      onDeckExitComplete={markDeckExitComplete}
                      onDeckExitStart={markDeckExitStarted}
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
                <button
                  type="button"
                  onClick={forkSelection}
                  disabled={selectionPending}
                >
                  <CursorClick size={15} weight="bold" />
                  {selectionPending ? "正在研究选区" : "从选区分叉"}
                </button>
                {selectionError ? (
                  <span className="selection-error" role="alert">
                    {selectionError}
                  </span>
                ) : null}
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
                rootNodeId={rootNodeId}
                focusSectionId={articleFocusSectionId}
          onOpenSource={openSourceCard}
          reduceMotion={reduceMotion}
        />
      </div>
    </main>
  );
}
