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
  potentialIds: Set<string>;
  edges: GraphEdge[];
  activeId: string;
  expanded: boolean;
  visible: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onVisibleChange: (visible: boolean) => void;
  onFocusNode: (nodeId: string) => void;
  reduceMotion: boolean;
};

function edgeKey(edge: GraphEdge) {
  return `${edge.from}:${edge.to}:${edge.kind}`;
}

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
  potentialIds,
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

  const visibleIds = new Set(
    expanded
      ? [...discoveredIds, ...potentialIds]
      : [...discoveredIds],
  );
  const visibleNodes = [...visibleIds]
    .map((id) => nodes[id])
    .filter((node): node is ResearchNode => Boolean(node));
  const edgeMap = new Map(edges.map((edge) => [edgeKey(edge), edge]));
  const incomingCounts = new Map<string, number>();
  for (const edge of edges) {
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
  }

  const candidateEdges: GraphEdge[] = [];
  for (const edge of edges) {
    if (visibleIds.has(edge.from) && visibleIds.has(edge.to)) {
      candidateEdges.push(edge);
    }
  }

  if (expanded) {
    for (const to of potentialIds) {
      const possible = {
        from: activeId,
        to,
        kind: "fork" as const,
      };
      if (
        nodes[activeId] &&
        nodes[to] &&
        !candidateEdges.some(
          (edge) => edge.from === activeId && edge.to === to,
        )
      ) {
        candidateEdges.push(possible);
      }
    }
  }

  const layout = buildDynamicLayout(visibleNodes, candidateEdges);
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
          <span className="graph-count">{discoveredIds.size} 个节点</span>
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
          aria-label={`已发现 ${discoveredIds.size} 个研究节点`}
        >
          <g className="graph-edges">
            {candidateEdges.map((edge) => {
              const from = nodes[edge.from];
              const to = nodes[edge.to];
              const fromPoint = layout.get(edge.from);
              const toPoint = layout.get(edge.to);
              if (!from || !to || !fromPoint || !toPoint) return null;
              const actual = edgeMap.has(edgeKey(edge));
              const converging =
                actual && (incomingCounts.get(edge.to) ?? 0) > 1;
              return (
                <motion.line
                  key={`${edge.from}-${edge.to}-${actual ? "actual" : "hint"}`}
                  data-edge-from={edge.from}
                  data-edge-to={edge.to}
                  x1={fromPoint.x}
                  y1={fromPoint.y}
                  x2={toPoint.x}
                  y2={toPoint.y}
                  className={[
                    "graph-edge",
                    actual ? "graph-edge-discovered" : "graph-edge-potential",
                    edge.kind === "synthesis" ? "graph-edge-synthesis" : "",
                    converging ? "graph-edge-convergence" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: actual ? 0.92 : 0.25 }}
                  transition={{ duration: 0.24 }}
                />
              );
            })}
          </g>

          <g className="graph-nodes">
            {visibleNodes.map((node) => {
              const isDiscovered = discoveredIds.has(node.id);
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
                    isDiscovered
                      ? "graph-node-discovered"
                      : "graph-node-potential",
                    isActive ? "graph-node-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  transform={`translate(${point.x} ${point.y})`}
                  role={isDiscovered ? "button" : undefined}
                  tabIndex={isDiscovered ? 0 : undefined}
                  aria-label={
                    isDiscovered ? `打开节点：${node.shortTitle}` : undefined
                  }
                  onClick={() => {
                    if (isDiscovered) onFocusNode(node.id);
                  }}
                  onKeyDown={(event) => {
                    if (
                      isDiscovered &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onFocusNode(node.id);
                    }
                  }}
                >
                  <title>{node.shortTitle}</title>
                  <motion.circle
                    r={isActive ? 4.2 : isDiscovered ? 2.8 : 2.5}
                    initial={reduceMotion ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 360,
                      damping: 24,
                    }}
                  />
                  {expanded && isDiscovered ? (
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
            已探索
          </span>
          <span>
            <i className="legend-mark legend-mark-potential" />
            可分支
          </span>
        </div>
      ) : null}
    </motion.aside>
  );
}
