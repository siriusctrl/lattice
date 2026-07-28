"use client";

import {
  ArrowLeft,
  ArrowRight,
  CursorClick,
  Graph,
  Moon,
  Stack,
  Sun,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphPreview } from "@/app/components/GraphPreview";
import {
  FollowupTurn,
  ResearchCard,
  TextSelection,
} from "@/app/components/ResearchCard";
import {
  ALL_POSSIBLE_EDGES,
  getNodeAnchorTargets,
  GraphEdge,
  MOCK_RESEARCH_NODES,
  ResearchNode,
  ROOT_NODE_ID,
} from "@/app/lib/mock-research";

type Theme = "light" | "dark";

type SelectionState = TextSelection & {
  nodeId: string;
};

const FOLLOWUP_ANSWERS: Record<string, string> = {
  musk: "从整张人生图看，最稳定的线索不是某一家公司的成功，而是资本再投入、控制权与技术时间尺度三者不断重新组合。",
  origin:
    "这段经历更适合作为后续问题的来源，而不是性格决定论。它能解释迁移为何很早成为一个可执行动作，却不能单独解释后来的商业选择。",
  spacex:
    "SpaceX 把一个遥远使命拆成了连续工程验证。每次失败都必须换回足够多的信息，否则下一次尝试就失去资金与时间依据。",
  tesla:
    "Tesla 分支的关键在于从产品愿景进入制造系统。真正困难的不是证明电动车有吸引力，而是让供应链、成本和交付同时成立。",
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
  const [stack, setStack] = useState<string[]>([ROOT_NODE_ID]);
  const [forwardStack, setForwardStack] = useState<string[]>([]);
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(
    () => new Set([ROOT_NODE_ID]),
  );
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [customNodes, setCustomNodes] = useState<
    Record<string, ResearchNode>
  >({});
  const [followups, setFollowups] = useState<
    Record<string, FollowupTurn[]>
  >({});
  const [thinkingNodeId, setThinkingNodeId] = useState<string | null>(null);
  const [forkingTargetId, setForkingTargetId] = useState<string | null>(null);
  const [graphVisible, setGraphVisible] = useState(true);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const followupCounter = useRef(0);
  const customNodeCounter = useRef(0);
  const forkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nodes = useMemo(
    () => ({ ...MOCK_RESEARCH_NODES, ...customNodes }),
    [customNodes],
  );
  const activeId = stack[stack.length - 1] ?? ROOT_NODE_ID;
  const activeNode = nodes[activeId] ?? nodes[ROOT_NODE_ID];
  const potentialIds = useMemo(() => {
    const targets = getNodeAnchorTargets(activeNode);
    return new Set(targets.filter((id) => !discoveredIds.has(id)));
  }, [activeNode, discoveredIds]);

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
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("lattice-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.latticeReady = "true";
    return () => {
      delete document.documentElement.dataset.latticeReady;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, [contenteditable='true']")) return;
      if (event.altKey && event.key === "ArrowLeft" && stack.length > 1) {
        event.preventDefault();
        const popped = stack[stack.length - 1];
        setStack(stack.slice(0, -1));
        setForwardStack([popped, ...forwardStack]);
        setSelection(null);
      }
      if (
        event.altKey &&
        event.key === "ArrowRight" &&
        forwardStack.length > 0
      ) {
        event.preventDefault();
        const [next, ...rest] = forwardStack;
        setStack([...stack, next]);
        setForwardStack(rest);
        setSelection(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [forwardStack, stack]);

  useEffect(
    () => () => {
      if (forkTimer.current) clearTimeout(forkTimer.current);
      if (askTimer.current) clearTimeout(askTimer.current);
    },
    [],
  );

  const openNode = useCallback(
    (targetId: string) => {
      if (!nodes[targetId] || targetId === activeId || forkingTargetId) return;
      setSelection(null);
      setForkingTargetId(targetId);

      const commitFork = () => {
        const knownRelation = ALL_POSSIBLE_EDGES.find(
          (edge) => edge.from === activeId && edge.to === targetId,
        );

        if (knownRelation || targetId.startsWith("selection-")) {
          setEdges((current) =>
            uniqueEdge(current, {
              from: activeId,
              to: targetId,
              kind: knownRelation?.kind ?? "fork",
            }),
          );
        }

        setDiscoveredIds((current) => {
          const next = new Set(current);
          next.add(targetId);
          return next;
        });

        const existingIndex = stack.lastIndexOf(targetId);
        setStack(
          existingIndex >= 0
            ? stack.slice(0, existingIndex + 1)
            : [...stack, targetId],
        );
        setForwardStack([]);
        setForkingTargetId(null);
      };

      if (reduceMotion) {
        commitFork();
      } else {
        forkTimer.current = setTimeout(commitFork, 430);
      }
    },
    [activeId, forkingTargetId, nodes, reduceMotion, stack],
  );

  function goBack() {
    if (stack.length <= 1 || forkingTargetId) return;
    const popped = stack[stack.length - 1];
    setStack(stack.slice(0, -1));
    setForwardStack([popped, ...forwardStack]);
    setSelection(null);
  }

  function goForward() {
    if (forwardStack.length === 0 || forkingTargetId) return;
    const [next, ...rest] = forwardStack;
    setStack([...stack, next]);
    setForwardStack(rest);
    setSelection(null);
  }

  function focusFromGraph(nodeId: string) {
    if (!discoveredIds.has(nodeId) || nodeId === activeId) return;
    const existingIndex = stack.lastIndexOf(nodeId);
    if (existingIndex >= 0) {
      setStack(stack.slice(0, existingIndex + 1));
      setForwardStack([]);
      return;
    }

    const path = getPathToNode(nodeId, edges);
    setStack(path ?? [ROOT_NODE_ID, nodeId]);
    setForwardStack([]);
    setSelection(null);
    if (window.innerWidth < 760) setGraphExpanded(false);
  }

  function focusBreadcrumb(index: number) {
    if (index >= stack.length - 1) return;
    setStack(stack.slice(0, index + 1));
    setForwardStack([]);
    setSelection(null);
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
    setStack([...stack, nodeId]);
    setForwardStack([]);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
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
    <main className="workspace-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Stack size={19} weight="fill" />
          </span>
          <span>Lattice</span>
        </div>

        <nav className="history-controls" aria-label="节点浏览历史">
          <button
            type="button"
            className="icon-button"
            onClick={goBack}
            disabled={stack.length <= 1}
            aria-label="返回上一层"
            title="返回上一层"
          >
            <ArrowLeft size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={goForward}
            disabled={forwardStack.length === 0}
            aria-label="前进"
            title="前进"
          >
            <ArrowRight size={17} />
          </button>
        </nav>

        <div className="breadcrumb" aria-label="当前研究路径">
          {stack.map((nodeId, index) => {
            const node = nodes[nodeId];
            if (!node) return null;
            const hidden = stack.length > 4 && index > 0 && index < stack.length - 3;
            if (hidden) {
              return index === 1 ? (
                <span className="breadcrumb-ellipsis" key="ellipsis">
                  …
                </span>
              ) : null;
            }
            return (
              <span className="breadcrumb-segment" key={`${nodeId}-${index}`}>
                {index > 0 && !(stack.length > 4 && index === stack.length - 3) ? (
                  <i aria-hidden="true">/</i>
                ) : null}
                <button
                  type="button"
                  onClick={() => focusBreadcrumb(index)}
                  aria-current={index === stack.length - 1 ? "page" : undefined}
                >
                  {node.shortTitle}
                </button>
              </span>
            );
          })}
        </div>

        <div className="topbar-actions">
          {!graphVisible ? (
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

      <section className="workspace-stage" aria-label="卡片研究空间">
        <div className="workspace-topic" aria-hidden="true">
          <span>当前研究</span>
          <strong>Elon Musk</strong>
          <i>{discoveredIds.size.toString().padStart(2, "0")} nodes</i>
        </div>

        <div className="deck-wrap">
          <div className="deck-shadow deck-shadow-one" aria-hidden="true" />
          <div className="deck-shadow deck-shadow-two" aria-hidden="true" />
          <AnimatePresence initial={false}>
            {stack.map((nodeId, index) => {
              const node = nodes[nodeId];
              if (!node) return null;
              const layerIndex = stack.length - 1 - index;
              return (
                <ResearchCard
                  key={`${nodeId}-${index}`}
                  node={node}
                  active={index === stack.length - 1}
                  layerIndex={layerIndex}
                  sourceTitle={
                    index > 0 ? nodes[stack[index - 1]]?.shortTitle : undefined
                  }
                  followups={followups[nodeId] ?? []}
                  thinking={thinkingNodeId === nodeId}
                  onAnchor={openNode}
                  onAsk={askFollowup}
                  onTextSelection={updateSelection}
                  reduceMotion={reduceMotion}
                />
              );
            })}
          </AnimatePresence>

          <AnimatePresence>
            {forkingTargetId ? (
              <motion.div
                className="forking-card"
                initial={
                  reduceMotion
                    ? false
                    : { opacity: 0, x: 88, y: 38, scale: 0.96, rotate: 1.4 }
                }
                animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
                role="status"
                aria-live="polite"
              >
                <div className="forking-trace">
                  <span />
                  <span />
                  <span />
                </div>
                <p>正在展开新的研究节点</p>
                <strong>{nodes[forkingTargetId]?.shortTitle}</strong>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="selection-hint">
          <CursorClick size={16} weight="bold" aria-hidden="true" />
          <span>点击高亮，或直接选中文字</span>
        </div>
      </section>

      <AnimatePresence>
        {graphVisible ? (
          <GraphPreview
            nodes={nodes}
            discoveredIds={discoveredIds}
            potentialIds={potentialIds}
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
    </main>
  );
}
