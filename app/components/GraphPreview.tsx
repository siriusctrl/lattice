"use client";

import {
  ArrowsInSimple,
  ArrowsOutSimple,
  Graph,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  buildResearchLayout,
  getDisplayEdges,
  getGraphEdgePath,
  getGraphHoverLabel,
  graphEdgeKey,
} from "@/app/lib/graph-layout";
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
      ? getGraphHoverLabel(hoveredNode, hoveredPoint)
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
              const primary = primaryKeys.has(graphEdgeKey(edge));
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
                  key={graphEdgeKey(edge)}
                  data-edge-from={edge.from}
                  data-edge-to={edge.to}
                  data-edge-start-x={fromPoint.x}
                  data-edge-start-y={fromPoint.y}
                  data-edge-end-x={toPoint.x}
                  data-edge-end-y={toPoint.y}
                  d={getGraphEdgePath(edge, fromPoint, toPoint)}
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
        <strong>{nodes[activeId]?.shortTitle}</strong>
        <span className="graph-node-total">
          {discoveredIds.size} 个节点
        </span>
      </div>
    </motion.aside>
  );
}
