"use client";

import {
  Article as ArticleIcon,
  ChatsCircle,
  CursorClick,
  DotsSixVertical,
  Graph,
  Moon,
  Stack,
  Sun,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArticleView } from "@/app/components/ArticleView";
import { GraphPreview } from "@/app/components/GraphPreview";
import {
  FollowupTurn,
  ResearchCard,
  TextSelection,
} from "@/app/components/ResearchCard";
import {
  ALL_POSSIBLE_EDGES,
  GraphEdge,
  MOCK_RESEARCH_NODES,
  ResearchNode,
  ROOT_NODE_ID,
} from "@/app/lib/mock-research";
import { getArticleSectionForNode } from "@/app/lib/article-research";

type Theme = "light" | "dark";
type WorkspaceView = "explore" | "article";

type SelectionState = TextSelection & {
  nodeId: string;
};

type DeckDragState = {
  pointerId: number;
  startX: number;
  startProgress: number;
  moved: boolean;
};

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

const FOLLOWUP_ANSWERS: Record<string, string> = {
  musk: "从整张人生图看，最稳定的线索不是某一家公司的成功，而是资本再投入、控制权与技术时间尺度三者不断重新组合。",
  origin:
    "这段经历更适合作为后续问题的来源，而不是性格决定论。它能解释迁移为何很早成为一个可执行动作，却不能单独解释后来的商业选择。",
  education:
    "物理和经济学并没有直接生成某一家公司的计划，但它们解释了为什么他后来总把技术约束、资本需求与市场结构放在同一张草图里。",
  spacex:
    "SpaceX 把一个遥远使命拆成了连续工程验证。每次失败都必须换回足够多的信息，否则下一次尝试就失去资金与时间依据。",
  starlink:
    "Starlink 的关键不只是卫星数量，而是它让发射、卫星制造和网络运营互相创造需求，也让 SpaceX 第一次直接运营面向终端用户的基础设施。",
  tesla:
    "Tesla 分支的关键在于从产品愿景进入制造系统。真正困难的不是证明电动车有吸引力，而是让供应链、成本和交付同时成立。",
  model3:
    "Model 3 说明需求成功并不等于商业系统成功。产线、供应链、软件、交付与现金周转必须在同一时间跨过规模门槛。",
  energy:
    "能源业务让 Tesla 的系统边界更完整，也让治理问题更复杂：产品之间确实可能协同，但关联交易不能只用长期愿景来证明合理。",
  neuralink:
    "Neuralink 当前最可验证的价值仍在辅助技术与临床研究。更远的人机融合叙事，必须与医疗证据、长期安全和参与者权益分开讨论。",
  boring:
    "Loop 已经证明小范围系统可以运行，但从示范线路扩展到城市交通网络，还需要用容量、安全、成本和公共价值持续验证。",
  management:
    "这套管理方式的力量来自压缩决策与反馈，风险则来自把期限、返工和外部性压给组织。不同产业对这种交换的容忍度并不相同。",
  crisis:
    "2008 年之所以重要，是因为两条独立公司路径在同一个资金约束中汇合。这个节点改变的不是单次结果，而是之后承担风险的方式。",
  risk:
    "更准确的判断需要同时保留收益与外部成本。高频验证可以压缩技术不确定性，但也可能把压力转移给员工、投资者和公共系统。",
  x: "X 延续的是平台边界不断扩大的想法。金融、信息分发和模型能力看似不同，但都在争夺用户行为发生的入口。",
  xai: "把 xAI 单独看会漏掉它与数据、分发和基础设施之间的关系。这个节点值得持续更新，因为组织边界仍在变化。",
};

function getFollowupAnswer(nodeId: string) {
  return (
    FOLLOWUP_ANSWERS[nodeId] ??
    "这轮追问已保留在当前节点。它会作为局部上下文参与之后的回答，并在你切换分支时由系统自动判断是否相关。"
  );
}

function uniqueEdge(edges: GraphEdge[], next: GraphEdge) {
  return edges.some(
    (edge) =>
      edge.from === next.from &&
      edge.to === next.to &&
      edge.kind === next.kind,
  )
    ? edges
    : [...edges, next];
}

function getPathToNode(
  targetId: string,
  edges: GraphEdge[],
): string[] | null {
  if (targetId === ROOT_NODE_ID) return [ROOT_NODE_ID];

  const queue: string[][] = [[ROOT_NODE_ID]];
  const visited = new Set<string>([ROOT_NODE_ID]);

  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) break;
    const current = path[path.length - 1];
    const nextIds = edges
      .filter((edge) => edge.from === current)
      .map((edge) => edge.to);

    for (const nextId of nextIds) {
      if (nextId === targetId) return [...path, nextId];
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      queue.push([...path, nextId]);
    }
  }

  return null;
}

export function ResearchWorkspace() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [workspaceView, setWorkspaceView] =
    useState<WorkspaceView>("explore");
  const [articleFocusSectionId, setArticleFocusSectionId] =
    useState("overview");
  const [stack, setStack] = useState<string[]>([ROOT_NODE_ID]);
  const [activeDeckIndex, setActiveDeckIndex] = useState(0);
  const [deckProgress, setDeckProgress] = useState(0);
  const [deckDragging, setDeckDragging] = useState(false);
  const [deckDragOriginOpen, setDeckDragOriginOpen] = useState(false);
  const [deckPreviewIndex, setDeckPreviewIndex] = useState(0);
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
  const deckDrag = useRef<DeckDragState | null>(null);
  const deckSwipe = useRef<{ pointerId: number; startX: number } | null>(
    null,
  );
  const suppressDeckClick = useRef(false);

  const nodes = useMemo(
    () => ({ ...MOCK_RESEARCH_NODES, ...customNodes }),
    [customNodes],
  );
  const activeIndex = Math.min(activeDeckIndex, stack.length - 1);
  const activeId = stack[activeIndex] ?? ROOT_NODE_ID;
  const activeNode = nodes[activeId] ?? nodes[ROOT_NODE_ID];
  const deckMode = stack.length > 1 && deckProgress > 0.035;
  const deckOpen = deckProgress > 0.5;
  const compactDeck = viewportWidth <= 720;
  const previewIndex = Math.min(deckPreviewIndex, stack.length - 1);
  const previewNode = nodes[stack[previewIndex]] ?? activeNode;
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
  const desktopDeckSpan = desktopDeckGap * Math.max(0, stack.length - 1);
  const dockHandleToSpreadEdge = deckDragging
    ? deckDragOriginOpen
    : deckOpen;
  const deckHandleOffset =
    !compactDeck && dockHandleToSpreadEdge
      ? -desktopDeckSpan / 2 + 58
      : 0;

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
    const updateViewport = () => setViewportWidth(window.innerWidth);
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
    },
    [],
  );

  const openNode = useCallback(
    (targetId: string) => {
      if (!nodes[targetId] || targetId === activeId) return;
      setSelection(null);
      const activePath = stack.slice(0, activeIndex + 1);
      const existingIndex = activePath.lastIndexOf(targetId);
      const nextStack =
        existingIndex >= 0
          ? stack
          : [...activePath, targetId];
      const nextIndex =
        existingIndex >= 0 ? existingIndex : nextStack.length - 1;
      setStack(nextStack);
      setActiveDeckIndex(nextIndex);
      setDeckPreviewIndex(nextIndex);
      setDeckProgress(0);
    },
    [activeId, activeIndex, nodes, stack],
  );

  function closeActiveBranch() {
    if (activeIndex <= 0) return;
    const nextIndex = activeIndex - 1;
    setActiveDeckIndex(nextIndex);
    setDeckPreviewIndex(nextIndex);
    setDeckProgress(0);
    setSelection(null);
  }

  function focusFromGraph(nodeId: string) {
    if (!discoveredIds.has(nodeId) || nodeId === activeId) return;
    const existingIndex = stack.lastIndexOf(nodeId);
    if (existingIndex >= 0) {
      setActiveDeckIndex(existingIndex);
      setDeckPreviewIndex(existingIndex);
      setDeckProgress(0);
      return;
    }

    const path = getPathToNode(nodeId, edges);
    const nextStack = path ?? [ROOT_NODE_ID, nodeId];
    setStack(nextStack);
    setActiveDeckIndex(nextStack.length - 1);
    setDeckPreviewIndex(nextStack.length - 1);
    setDeckProgress(0);
    setSelection(null);
    if (window.innerWidth < 760) setGraphExpanded(false);
  }

  function focusBreadcrumb(index: number) {
    if (index === activeIndex) return;
    setActiveDeckIndex(index);
    setDeckPreviewIndex(index);
    setDeckProgress(0);
    setSelection(null);
  }

  function openArticleForNode(nodeId: string) {
    setArticleFocusSectionId(getArticleSectionForNode(nodeId));
    setGraphExpanded(false);
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
    const excerpt =
      selection.text.length > 20
        ? `${selection.text.slice(0, 20)}…`
        : selection.text;
    const leadExcerpt =
      selection.text.length > 64
        ? `${selection.text.slice(0, 64)}…`
        : selection.text;
    const verticalOffsets = [-16, 18, -24, 25];
    const position = {
      x: Math.min(92, source.position.x + 17 + (nodeIndex % 2) * 4),
      y: Math.max(
        8,
        Math.min(
          92,
          source.position.y +
            verticalOffsets[(nodeIndex - 1) % verticalOffsets.length],
        ),
      ),
    };

    const nextNode: ResearchNode = {
      id: nodeId,
      shortTitle: `选中：${excerpt}`,
      title: "选中的研究线索",
      year: "用户选中",
      userPrompt: `解释这段内容，并说明为什么它值得成为独立研究节点：“${selection.text}”`,
      lead: `“${leadExcerpt}”`,
      blocks: [
        {
          kind: "paragraph",
          content: [
            `你从“${source.shortTitle}”节点中圈出了这段内容。系统保留了原始文字、来源节点和创建时间，因此它可以继续生长，而不会打断原来的阅读路径。`,
          ],
        },
        {
          kind: "paragraph",
          content: [
            "在真实模型接入后，这里会生成针对选区的解释，并判断它是否需要连接已有节点。这个原型把它连接到 ",
            {
              kind: "anchor",
              label: "风险逻辑",
              target: "risk",
              hint: "查看跨分支综合节点",
            },
            "，用于演示用户选区如何进入同一张研究图。",
          ],
        },
        {
          kind: "insight",
          label: "来源",
          content: `选自“${source.shortTitle}”。原始文本始终可追溯。`,
        },
      ],
      position,
    };

    setCustomNodes((current) => ({ ...current, [nodeId]: nextNode }));
    setDiscoveredIds((current) => new Set([...current, nodeId]));
    setEdges((current) =>
      uniqueEdge(current, {
        from: selection.nodeId,
        to: nodeId,
        kind: "fork",
      }),
    );
    const nextStack = [...stack.slice(0, activeIndex + 1), nodeId];
    setStack(nextStack);
    setActiveDeckIndex(nextStack.length - 1);
    setDeckPreviewIndex(nextStack.length - 1);
    setDeckProgress(0);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  function setDeckExpanded(expanded: boolean) {
    setDeckPreviewIndex(activeIndex);
    setDeckProgress(expanded ? 1 : 0);
    setSelection(null);
  }

  function beginDeckDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (stack.length <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    deckDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startProgress: deckProgress,
      moved: false,
    };
    setDeckDragOriginOpen(deckProgress > 0.5);
    setDeckDragging(true);
  }

  function updateDeckDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = deckDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const travel = Math.min(340, Math.max(180, viewportWidth * 0.42));
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 3) drag.moved = true;
    setDeckProgress(clamp(drag.startProgress + delta / travel));
  }

  function finishDeckDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = deckDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const travel = Math.min(340, Math.max(180, viewportWidth * 0.42));
    const progress = clamp(
      drag.startProgress + (event.clientX - drag.startX) / travel,
    );
    suppressDeckClick.current = drag.moved;
    if (drag.moved) {
      window.setTimeout(() => {
        suppressDeckClick.current = false;
      }, 0);
    }
    setDeckProgress(progress >= 0.45 ? 1 : 0);
    setDeckPreviewIndex(activeIndex);
    setDeckDragging(false);
    deckDrag.current = null;
  }

  function toggleDeck() {
    if (suppressDeckClick.current) {
      suppressDeckClick.current = false;
      return;
    }
    setDeckExpanded(!deckOpen);
  }

  function selectDeckCard(index: number) {
    if (suppressDeckClick.current) {
      suppressDeckClick.current = false;
      return;
    }
    setActiveDeckIndex(index);
    setDeckPreviewIndex(index);
    setDeckProgress(0);
    setSelection(null);
  }

  function previewDeckCard(index: number) {
    setDeckPreviewIndex(index);
  }

  function beginDeckSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    if (!deckMode || !compactDeck) return;
    const target = event.target as HTMLElement;
    if (target.closest(".deck-spread-handle")) return;
    deckSwipe.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
    };
  }

  function finishDeckSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    const swipe = deckSwipe.current;
    if (
      !swipe ||
      swipe.pointerId !== event.pointerId ||
      !deckMode ||
      !compactDeck
    ) {
      return;
    }
    const delta = event.clientX - swipe.startX;
    deckSwipe.current = null;
    if (Math.abs(delta) < 42) return;
    const nextIndex = clamp(
      previewIndex + (delta < 0 ? 1 : -1),
      0,
      stack.length - 1,
    );
    suppressDeckClick.current = true;
    setDeckPreviewIndex(nextIndex);
    window.setTimeout(() => {
      suppressDeckClick.current = false;
    }, 0);
  }

  function getCardMotionState(index: number) {
    const distanceFromActive = Math.abs(index - activeIndex);
    const directionFromActive = Math.sign(index - activeIndex);
    const collapsedDistance = Math.min(distanceFromActive, 5);
    const collapsed = {
      x: directionFromActive * collapsedDistance * 16,
      y: collapsedDistance * 9,
      scale: 1 - collapsedDistance * 0.014,
      rotate:
        directionFromActive * collapsedDistance * 0.46,
      opacity: distanceFromActive > 4 ? 0 : 1,
      zIndex: 60 - distanceFromActive,
    };

    let spread;
    if (compactDeck) {
      const previewDistance = index - previewIndex;
      const absolutePreviewDistance = Math.abs(previewDistance);
      spread = {
        x: previewDistance * 64,
        y: 25 + absolutePreviewDistance * 9,
        scale: Math.max(0.68, 0.82 - absolutePreviewDistance * 0.045),
        rotate: previewDistance * 0.8,
        opacity: absolutePreviewDistance > 4 ? 0 : 1,
        zIndex: 100 - absolutePreviewDistance,
      };
    } else {
      const center = (stack.length - 1) / 2;
      const centerDistance = index - center;
      spread = {
        x: centerDistance * desktopDeckGap,
        y: 13 + Math.abs(centerDistance) * 2.4,
        scale: index === previewIndex ? 0.965 : 0.945,
        rotate: centerDistance * 0.52,
        opacity: 1,
        zIndex: 40 + index,
      };
    }

    return {
      x: mix(collapsed.x, spread.x, deckProgress),
      y: mix(collapsed.y, spread.y, deckProgress),
      scale: mix(collapsed.scale, spread.scale, deckProgress),
      rotate: mix(collapsed.rotate, spread.rotate, deckProgress),
      opacity: mix(collapsed.opacity, spread.opacity, deckProgress),
      zIndex: deckMode ? spread.zIndex : collapsed.zIndex,
    };
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
      }`}
    >
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
            className={workspaceView === "explore" ? "view-active" : ""}
            onClick={() => setWorkspaceView("explore")}
            aria-pressed={workspaceView === "explore"}
            aria-label="Explore"
          >
            <ChatsCircle size={15} weight="fill" aria-hidden="true" />
            <span>Explore</span>
          </button>
          <button
            type="button"
            className={workspaceView === "article" ? "view-active" : ""}
            onClick={() => openArticleForNode(activeId)}
            aria-pressed={workspaceView === "article"}
            aria-label="Article"
          >
            <ArticleIcon size={15} weight="fill" aria-hidden="true" />
            <span>Article</span>
          </button>
        </nav>

        <div className="topbar-context">
          {workspaceView === "explore" ? (
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
                      onClick={() => focusBreadcrumb(index)}
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
              <strong>Elon Musk</strong>
              <small>{discoveredIds.size} 张来源 Card</small>
            </div>
          )}
        </div>

        <div className="topbar-actions">
          {workspaceView === "explore" && !graphVisible ? (
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setGraphVisible(true)}
            >
              <Graph size={16} weight="bold" />
              <span>研究图</span>
            </button>
          ) : null}
          <button
            type="button"
            className="icon-button"
            onClick={() =>
              setTheme((current) =>
                current === "light" ? "dark" : "light",
              )
            }
            aria-label={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}
            title={theme === "light" ? "深色模式" : "浅色模式"}
            data-testid="theme-toggle"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={reduceMotion ? false : { opacity: 0, rotate: -30 }}
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

      {workspaceView === "explore" ? (
        <>
          <section className="workspace-stage" aria-label="卡片研究空间">
            <div
              className={`deck-wrap ${
                deckMode ? "deck-wrap-spread" : ""
              }`}
              data-testid="research-deck"
              data-deck-mode={deckMode ? "spread" : "stacked"}
              data-deck-size={stack.length}
              style={
                { "--deck-progress": deckProgress } as CSSProperties
              }
              onPointerDown={beginDeckSwipe}
              onPointerUp={finishDeckSwipe}
              onPointerCancel={() => {
                deckSwipe.current = null;
              }}
            >
              <div
                className="deck-shadow deck-shadow-one"
                aria-hidden="true"
              />
              <div
                className="deck-shadow deck-shadow-two"
                aria-hidden="true"
              />

              <AnimatePresence>
                {deckMode ? (
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
                    <span>
                      {String(previewIndex + 1).padStart(2, "0")} /{" "}
                      {String(stack.length).padStart(2, "0")}
                    </span>
                    <strong>{previewNode.shortTitle}</strong>
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
                      deckSize={stack.length}
                      deckMode={deckMode}
                      deckPreviewed={
                        deckMode && index === previewIndex
                      }
                      motionState={getCardMotionState(index)}
                      draggingDeck={deckDragging}
                      followups={followups[nodeId] ?? []}
                      thinking={thinkingNodeId === nodeId}
                      onAnchor={openNode}
                      onAsk={askFollowup}
                      onDeckPreview={previewDeckCard}
                      onDeckSelect={selectDeckCard}
                      onTextSelection={updateSelection}
                      reduceMotion={reduceMotion}
                    />
                  );
                })}
              </AnimatePresence>

              <AnimatePresence>
                {stack.length > 1 ? (
                  <motion.button
                    type="button"
                    className="deck-spread-handle"
                    data-open={deckOpen ? "true" : "false"}
                    onClick={toggleDeck}
                    onPointerDown={beginDeckDrag}
                    onPointerMove={updateDeckDrag}
                    onPointerUp={finishDeckDrag}
                    onPointerCancel={finishDeckDrag}
                    onKeyDown={(event) => {
                      if (!deckMode) return;
                      if (
                        event.key !== "ArrowLeft" &&
                        event.key !== "ArrowRight"
                      ) {
                        return;
                      }
                      event.preventDefault();
                      setDeckPreviewIndex((current) =>
                        clamp(
                          current + (event.key === "ArrowRight" ? 1 : -1),
                          0,
                          stack.length - 1,
                        ),
                      );
                    }}
                    aria-label={
                      deckOpen
                        ? `收拢 ${stack.length} 张 Card`
                        : `摊开 ${stack.length} 张 Card`
                    }
                    aria-pressed={deckOpen}
                    title={deckOpen ? "向左拖动收拢" : "向右拖动摊开"}
                    initial={
                      reduceMotion ? false : { opacity: 0, x: 7, scale: 0.9 }
                    }
                    animate={{
                      opacity: 1,
                      x: deckHandleOffset,
                      scale: 1,
                    }}
                    exit={{ opacity: 0, x: 5, scale: 0.9 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            type: "spring",
                            stiffness: 380,
                            damping: 28,
                          }
                    }
                  >
                    <DotsSixVertical
                      size={16}
                      weight="bold"
                      aria-hidden="true"
                    />
                    <span>{stack.length}</span>
                  </motion.button>
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {activeIndex > 0 && !deckMode ? (
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
                    transition={{ duration: 0.16 }}
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
