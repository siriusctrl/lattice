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
              if (!from || !to) return null;
              const actual = edgeMap.has(edgeKey(edge));
              const converging =
                actual && (incomingCounts.get(edge.to) ?? 0) > 1;
              return (
                <motion.line
                  key={`${edge.from}-${edge.to}-${actual ? "actual" : "hint"}`}
                  data-edge-from={edge.from}
                  data-edge-to={edge.to}
                  x1={from.position.x}
                  y1={from.position.y}
                  x2={to.position.x}
                  y2={to.position.y}
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
              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  className={[
                    "graph-node",
                    isDiscovered
                      ? "graph-node-discovered"
                      : "graph-node-potential",
                    isActive ? "graph-node-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  transform={`translate(${node.position.x} ${node.position.y})`}
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
                      x={node.position.x > 76 ? -5 : 5}
                      y={-4}
                      textAnchor={node.position.x > 76 ? "end" : "start"}
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
