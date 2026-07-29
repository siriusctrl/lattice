"use client";

import {
  ArrowsInSimple,
  ArrowsOutSimple,
  Graph,
  X,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
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

const LANDMARK_NODE_IDS = new Set([
  "musk",
  "origin",
  "spacex",
  "tesla",
  "crisis",
  "x",
  "management",
  "risk",
]);

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
) {
  const primaryEdges = visibleEdges.filter(
    (edge) => !hasAlternatePath(edge, visibleEdges),
  );
  const primaryKeys = new Set(primaryEdges.map(edgeKey));
  const contextualEdges =
    activeId === "musk"
      ? []
      : visibleEdges.filter(
          (edge) =>
            !primaryKeys.has(edgeKey(edge)) &&
            (edge.from === activeId || edge.to === activeId),
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

function getLabelPlacement(nodeId: string, point: LayoutPoint) {
  if (nodeId === "tesla") {
    return { x: 4.6, y: 6.7, textAnchor: "start" as const };
  }
  if (nodeId === "management") {
    return { x: -4.8, y: 7.2, textAnchor: "end" as const };
  }
  if (point.x > 76) {
    return { x: -4.8, y: -4.1, textAnchor: "end" as const };
  }
  return { x: 4.8, y: -4.1, textAnchor: "start" as const };
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
  if (!visible) return null;

  const visibleIds = new Set(discoveredIds);
  const visibleNodes = [...visibleIds]
    .map((id) => nodes[id])
    .filter((node): node is ResearchNode => Boolean(node));
  const visibleEdges = edges.filter(
    (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to),
  );
  const { displayEdges, primaryKeys } = getDisplayEdges(
    visibleEdges,
    activeId,
  );
  const incomingCounts = new Map<string, number>();
  for (const edge of visibleEdges) {
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
  }

  const layout = buildResearchLayout(visibleNodes, visibleEdges);
  const activePoint = layout.get(activeId);
  const crowdedLabels = visibleNodes.length > 7;

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
          <span className="graph-count">
            完整图谱 · {discoveredIds.size} 个节点
          </span>
        </div>
        <div className="graph-preview-actions">
          <button
            type="button"
            className="icon-button icon-button-small"
            onClick={() => onExpandedChange(!expanded)}
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
            onClick={() => onVisibleChange(false)}
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
          {expanded ? (
            <g className="graph-regions" aria-hidden="true">
              <text x="19" y="5.5">早期与互联网</text>
              <text x="22" y="31">航天系统</text>
              <text x="22" y="75">汽车与能源</text>
              <text x="77" y="93">综合判断</text>
            </g>
          ) : null}

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
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: activeConnection ? 0.96 : 0.56 }}
                  transition={{ duration: reduceMotion ? 0 : 0.28 }}
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
              const point = layout.get(node.id);
              if (!point) return null;
              const label = getLabelPlacement(node.id, point);
              const labelIsSecondary =
                crowdedLabels &&
                !isActive &&
                !LANDMARK_NODE_IDS.has(node.id);
              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  data-layout-depth={point.depth}
                  className={[
                    "graph-node",
                    "graph-node-discovered",
                    isActive ? "graph-node-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  transform={`translate(${point.x} ${point.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`打开节点：${node.shortTitle}`}
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
                  <title>{node.shortTitle}</title>
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
                  {expanded ? (
                    <text
                      className={
                        labelIsSecondary
                          ? "graph-node-label-crowded"
                          : undefined
                      }
                      x={label.x}
                      y={label.y}
                      textAnchor={label.textAnchor}
                    >
                      {node.shortTitle}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {!expanded ? (
        <div
          className="graph-focus-bar"
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
        </div>
      ) : (
        <div className="graph-legend" aria-hidden="true">
          <span>
            <i className="legend-mark legend-mark-current" />
            当前
          </span>
          <span>
            <i className="legend-mark legend-mark-discovered" />
            研究节点
          </span>
        </div>
      )}
    </motion.aside>
  );
}
