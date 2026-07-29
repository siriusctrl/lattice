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

function buildDynamicLayout(
  visibleNodes: ResearchNode[],
  visibleEdges: GraphEdge[],
) {
  const nodeById = new Map(visibleNodes.map((node) => [node.id, node]));
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  const depth = new Map<string, number>();

  for (const node of visibleNodes) {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
    indegree.set(node.id, 0);
    depth.set(node.id, 0);
  }

  for (const edge of visibleEdges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) continue;
    outgoing.get(edge.from)?.push(edge.to);
    incoming.get(edge.to)?.push(edge.from);
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

  const maxDepth = Math.max(0, ...depth.values());
  const layers = new Map<number, ResearchNode[]>();
  for (const node of visibleNodes) {
    const nodeDepth = depth.get(node.id) ?? 0;
    layers.set(nodeDepth, [...(layers.get(nodeDepth) ?? []), node]);
  }

  const positions = new Map<string, LayoutPoint>();
  for (let layer = 0; layer <= maxDepth; layer += 1) {
    const layerNodes = layers.get(layer) ?? [];
    layerNodes.sort((a, b) => {
      const predecessorY = (node: ResearchNode) => {
        const positionedParents = (incoming.get(node.id) ?? [])
          .map((id) => positions.get(id)?.y)
          .filter((value): value is number => value !== undefined);
        if (positionedParents.length === 0) return node.position.y;
        return (
          positionedParents.reduce((sum, value) => sum + value, 0) /
          positionedParents.length
        );
      };
      return predecessorY(a) - predecessorY(b);
    });

    const padding = layerNodes.length > 10 ? 5 : layerNodes.length > 6 ? 7 : 10;
    const availableHeight = 100 - padding * 2;
    layerNodes.forEach((node, index) => {
      positions.set(node.id, {
        x:
          maxDepth === 0
            ? 50
            : 8 + (layer / Math.max(1, maxDepth)) * 84,
        y:
          layerNodes.length === 1
            ? 50
            : padding +
              (index / Math.max(1, layerNodes.length - 1)) * availableHeight,
        depth: layer,
      });
    });
  }

  return positions;
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
  const incomingCounts = new Map<string, number>();
  for (const edge of visibleEdges) {
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
  }

  const layout = buildDynamicLayout(visibleNodes, visibleEdges);
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
          <g className="graph-edges">
            {visibleEdges.map((edge) => {
              const from = nodes[edge.from];
              const to = nodes[edge.to];
              const fromPoint = layout.get(edge.from);
              const toPoint = layout.get(edge.to);
              if (!from || !to || !fromPoint || !toPoint) return null;
              const converging =
                (incomingCounts.get(edge.to) ?? 0) > 1;
              const activeConnection =
                edge.from === activeId || edge.to === activeId;
              return (
                <motion.line
                  key={`${edge.from}-${edge.to}-${edge.kind}`}
                  data-edge-from={edge.from}
                  data-edge-to={edge.to}
                  x1={fromPoint.x}
                  y1={fromPoint.y}
                  x2={toPoint.x}
                  y2={toPoint.y}
                  className={[
                    "graph-edge",
                    "graph-edge-discovered",
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
              r={6.1}
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
              const labelOnLeft = point.x > 76;
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
                    r={isActive ? 4.2 : 2.8}
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
                        crowdedLabels && !isActive
                          ? "graph-node-label-crowded"
                          : undefined
                      }
                      x={labelOnLeft ? -5 : 5}
                      y={-4}
                      textAnchor={labelOnLeft ? "end" : "start"}
                    >
                      {node.shortTitle}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>

        {!expanded ? (
          <div className="graph-active-label" aria-hidden="true">
            <span>当前位置</span>
            <strong>{nodes[activeId]?.shortTitle}</strong>
          </div>
        ) : null}
      </div>

      {expanded ? (
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
      ) : null}
    </motion.aside>
  );
}
