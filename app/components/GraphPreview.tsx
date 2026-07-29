"use client";

import {
  ArrowsInSimple,
  ArrowsOutSimple,
  Graph,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type {
  GraphEdge,
  ResearchNode,
} from "@/app/lib/mock-research";

type GraphPreviewProps = {
  nodes: Record<string, ResearchNode>;
  discoveredIds: Set<string>;
  edges: GraphEdge[];
  activeId: string;
  expanded: boolean;
  visible: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onVisibleChange: (visible: boolean) => void;
  onFocusNode: (nodeId: string) => void;
  reduceMotion: boolean;
};

type LayoutPoint = {
  x: number;
  y: number;
  depth: number;
};

type HoverLabelLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
};

function getGraphDepths(
  visibleNodes: ResearchNode[],
  visibleEdges: GraphEdge[],
) {
  const nodeById = new Map(visibleNodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  const depth = new Map<string, number>();

  for (const node of visibleNodes) {
    outgoing.set(node.id, []);
    indegree.set(node.id, 0);
    depth.set(node.id, 0);
  }

  for (const edge of visibleEdges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) continue;
    outgoing.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue = visibleNodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort((a, b) => {
      if (a.id === "musk") return -1;
      if (b.id === "musk") return 1;
      return a.position.y - b.position.y;
    })
    .map((node) => node.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) break;
    visited.add(nodeId);

    for (const nextId of outgoing.get(nodeId) ?? []) {
      depth.set(
        nextId,
        Math.max(depth.get(nextId) ?? 0, (depth.get(nodeId) ?? 0) + 1),
      );
      const nextIndegree = (indegree.get(nextId) ?? 1) - 1;
      indegree.set(nextId, nextIndegree);
      if (nextIndegree === 0) queue.push(nextId);
    }
  }

  for (const node of visibleNodes) {
    if (!visited.has(node.id)) {
      depth.set(node.id, Math.max(1, Math.round(node.position.x / 18)));
    }
  }

  return depth;
}

function buildResearchLayout(
  visibleNodes: ResearchNode[],
  visibleEdges: GraphEdge[],
) {
  const depth = getGraphDepths(visibleNodes, visibleEdges);
  return new Map(
    visibleNodes.map((node) => [
      node.id,
      {
        x: node.position.x,
        y: node.position.y,
        depth: depth.get(node.id) ?? 0,
      },
    ]),
  );
}

function edgeKey(edge: GraphEdge) {
  return `${edge.from}-${edge.to}-${edge.kind}`;
}

function hasAlternatePath(
  targetEdge: GraphEdge,
  visibleEdges: GraphEdge[],
) {
  const queue = [targetEdge.from];
  const visited = new Set(queue);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    for (const edge of visibleEdges) {
      if (edge === targetEdge || edge.from !== current) continue;
      if (edge.to === targetEdge.to) return true;
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      queue.push(edge.to);
    }
  }

  return false;
}

function getDisplayEdges(
  visibleEdges: GraphEdge[],
  activeId: string,
  hoveredId: string | null,
) {
  const primaryEdges = visibleEdges.filter(
    (edge) => !hasAlternatePath(edge, visibleEdges),
  );
  const primaryKeys = new Set(primaryEdges.map(edgeKey));
  const focusIds = new Set(
    [activeId, hoveredId].filter(
      (nodeId): nodeId is string =>
        Boolean(nodeId) && nodeId !== "musk",
    ),
  );
  const contextualEdges = visibleEdges.filter(
    (edge) =>
      !primaryKeys.has(edgeKey(edge)) &&
      (focusIds.has(edge.from) || focusIds.has(edge.to)),
  );

  return {
    primaryKeys,
    displayEdges: [...primaryEdges, ...contextualEdges],
  };
}

function getEdgePath(
  edge: GraphEdge,
  fromPoint: LayoutPoint,
  toPoint: LayoutPoint,
) {
  if (edge.from === "blastar" && edge.to === "risk") {
    return [
      `M ${fromPoint.x} ${fromPoint.y}`,
      `C 55 0, 91 5, ${toPoint.x} ${toPoint.y}`,
    ].join(" ");
  }

  const deltaX = toPoint.x - fromPoint.x;
  const direction = deltaX >= 0 ? 1 : -1;
  const handle = Math.min(15, Math.max(4, Math.abs(deltaX) * 0.44));
  return [
    `M ${fromPoint.x} ${fromPoint.y}`,
    `C ${fromPoint.x + handle * direction} ${fromPoint.y},`,
    `${toPoint.x - handle * direction} ${toPoint.y},`,
    `${toPoint.x} ${toPoint.y}`,
  ].join(" ");
}

function getHoverLabelLayout(
  node: ResearchNode,
  point: LayoutPoint,
): HoverLabelLayout {
  const titleCharacters = Array.from(node.shortTitle);
  const visibleCharacters =
    titleCharacters.length > 18
      ? [...titleCharacters.slice(0, 17), "…"]
      : titleCharacters;
  const title = visibleCharacters.join("");
  const width = Math.min(
    38,
    Math.max(
      12,
      visibleCharacters.reduce(
        (total, character) =>
          total + (character.charCodeAt(0) > 255 ? 2.65 : 1.48),
        0,
      ) + 4.6,
    ),
  );
  const height = 7.4;
  const gap = 4;
  const placeOnLeft = point.x > 64 || point.x + gap + width > 98;
  const preferredX = placeOnLeft
    ? point.x - gap - width
    : point.x + gap;

  return {
    x: Math.max(2, Math.min(98 - width, preferredX)),
    y: Math.max(2, Math.min(98 - height, point.y - height / 2)),
    width,
    height,
    title,
  };
}

export function GraphPreview({
  nodes,
  discoveredIds,
  edges,
  activeId,
  expanded,
  visible,
  onExpandedChange,
  onVisibleChange,
  onFocusNode,
  reduceMotion,
}: GraphPreviewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!visible) return null;

  const visibleIds = new Set(discoveredIds);
  const visibleNodes = [...visibleIds]
    .map((id) => nodes[id])
    .filter((node): node is ResearchNode => Boolean(node));
  const visibleEdges = edges.filter(
    (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to),
  );
  const visibleHoverId = expanded ? hoveredId : null;
  const { displayEdges, primaryKeys } = getDisplayEdges(
    visibleEdges,
    activeId,
    visibleHoverId,
  );
  const incomingCounts = new Map<string, number>();
  for (const edge of visibleEdges) {
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
  }

  const layout = buildResearchLayout(visibleNodes, visibleEdges);
  const activePoint = layout.get(activeId);
  const hoveredNode = visibleHoverId ? nodes[visibleHoverId] : null;
  const hoveredPoint = visibleHoverId
    ? layout.get(visibleHoverId)
    : null;
  const hoverLabel =
    hoveredNode && hoveredPoint
      ? getHoverLabelLayout(hoveredNode, hoveredPoint)
      : null;

  return (
    <motion.aside
      layout
      data-testid="graph-preview"
      className={`graph-preview ${expanded ? "graph-preview-expanded" : ""}`}
      initial={false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 260, damping: 27 }}
      aria-label="研究图预览"
      data-semantic-edge-count={visibleEdges.length}
      data-primary-edge-count={primaryKeys.size}
    >
      <div className="graph-preview-header">
        <div className="graph-preview-title">
          <Graph size={16} weight="bold" aria-hidden="true" />
          <span>研究图</span>
        </div>
        <div className="graph-preview-actions">
          <button
            type="button"
            className="icon-button icon-button-small"
            onClick={() => {
              setHoveredId(null);
              onExpandedChange(!expanded);
            }}
            aria-label={expanded ? "缩小研究图" : "展开研究图"}
            title={expanded ? "缩小" : "展开"}
          >
            {expanded ? (
              <ArrowsInSimple size={15} />
            ) : (
              <ArrowsOutSimple size={15} />
            )}
          </button>
          <button
            type="button"
            className="icon-button icon-button-small"
            onClick={() => {
              setHoveredId(null);
              onVisibleChange(false);
            }}
            aria-label="关闭研究图"
            title="关闭"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="graph-canvas">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`完整研究图，共 ${discoveredIds.size} 个节点`}
        >
          <g className="graph-edges">
            {displayEdges.map((edge) => {
              const from = nodes[edge.from];
              const to = nodes[edge.to];
              const fromPoint = layout.get(edge.from);
              const toPoint = layout.get(edge.to);
              if (!from || !to || !fromPoint || !toPoint) return null;
              const primary = primaryKeys.has(edgeKey(edge));
              const converging =
                (incomingCounts.get(edge.to) ?? 0) > 1;
              const activeConnection =
                edge.from === activeId || edge.to === activeId;
              const hoverConnection =
                visibleHoverId !== null &&
                (edge.from === visibleHoverId ||
                  edge.to === visibleHoverId);
              const mutedByHover =
                visibleHoverId !== null && !hoverConnection;
              const opacity = visibleHoverId
                ? hoverConnection
                  ? 0.98
                  : 0.12
                : activeConnection
                  ? 0.96
                  : 0.56;
              return (
                <motion.path
                  key={edgeKey(edge)}
                  data-edge-from={edge.from}
                  data-edge-to={edge.to}
                  data-edge-start-x={fromPoint.x}
                  data-edge-start-y={fromPoint.y}
                  data-edge-end-x={toPoint.x}
                  data-edge-end-y={toPoint.y}
                  d={getEdgePath(edge, fromPoint, toPoint)}
                  className={[
                    "graph-edge",
                    "graph-edge-discovered",
                    primary ? "graph-edge-primary" : "graph-edge-context",
                    edge.kind === "synthesis" ? "graph-edge-synthesis" : "",
                    converging ? "graph-edge-convergence" : "",
                    activeConnection ? "graph-edge-active" : "",
                    hoverConnection ? "graph-edge-hovered" : "",
                    mutedByHover ? "graph-edge-muted" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                />
              );
            })}
          </g>

          {activePoint ? (
            <motion.circle
              className="graph-active-orbit"
              r={4.8}
              initial={false}
              animate={{ cx: activePoint.x, cy: activePoint.y }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      type: "spring",
                      stiffness: 190,
                      damping: 24,
                      mass: 0.75,
                    }
              }
            />
          ) : null}

          <g className="graph-nodes">
            {visibleNodes.map((node) => {
              const isActive = node.id === activeId;
              const isHovered = node.id === visibleHoverId;
              const point = layout.get(node.id);
              if (!point) return null;
              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  data-layout-depth={point.depth}
                  className={[
                    "graph-node",
                    "graph-node-discovered",
                    isActive ? "graph-node-active" : "",
                    isHovered ? "graph-node-hovered" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  transform={`translate(${point.x} ${point.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`打开节点：${node.shortTitle}`}
                  onMouseEnter={() => {
                    if (expanded) setHoveredId(node.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredId((current) =>
                      current === node.id ? null : current,
                    );
                  }}
                  onFocus={() => {
                    if (expanded) setHoveredId(node.id);
                  }}
                  onBlur={() => {
                    setHoveredId((current) =>
                      current === node.id ? null : current,
                    );
                  }}
                  onClick={() => onFocusNode(node.id)}
                  onKeyDown={(event) => {
                    if (
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onFocusNode(node.id);
                    }
                  }}
                >
                  <motion.circle
                    r={isActive ? 2.8 : 1.9}
                    initial={reduceMotion ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 360,
                      damping: 24,
                    }}
                  />
                </g>
              );
            })}
          </g>

          <AnimatePresence>
            {expanded && hoverLabel ? (
              <motion.g
                key={visibleHoverId}
                className="graph-hover-label"
                transform={`translate(${hoverLabel.x} ${hoverLabel.y})`}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.14 }}
                aria-hidden="true"
              >
                <rect
                  width={hoverLabel.width}
                  height={hoverLabel.height}
                  rx="2"
                />
                <text x="2.3" y="4.85">
                  {hoverLabel.title}
                </text>
              </motion.g>
            ) : null}
          </AnimatePresence>
        </svg>
      </div>

      <div
        className={`graph-focus-bar ${
          expanded ? "graph-focus-bar-expanded" : ""
        }`}
        aria-label={`当前节点：${nodes[activeId]?.shortTitle}`}
        aria-live="polite"
      >
        <i aria-hidden="true" />
        <motion.strong
          key={activeId}
          initial={reduceMotion ? false : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          {nodes[activeId]?.shortTitle}
        </motion.strong>
        <span className="graph-node-total">
          {discoveredIds.size} 个节点
        </span>
      </div>
    </motion.aside>
  );
}
