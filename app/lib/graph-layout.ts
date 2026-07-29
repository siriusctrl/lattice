import type {
  GraphEdge,
  ResearchNode,
} from "@/app/lib/mock-research";

export type GraphLayoutPoint = {
  x: number;
  y: number;
  depth: number;
};

export type GraphHoverLabel = {
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

export function buildResearchLayout(
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

export function graphEdgeKey(edge: GraphEdge) {
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

export function getDisplayEdges(
  visibleEdges: GraphEdge[],
  activeId: string,
  hoveredId: string | null,
) {
  const primaryEdges = visibleEdges.filter(
    (edge) => !hasAlternatePath(edge, visibleEdges),
  );
  const primaryKeys = new Set(primaryEdges.map(graphEdgeKey));
  const focusIds = new Set(
    [activeId, hoveredId].filter(
      (nodeId): nodeId is string =>
        Boolean(nodeId) && nodeId !== "musk",
    ),
  );
  const contextualEdges = visibleEdges.filter(
    (edge) =>
      !primaryKeys.has(graphEdgeKey(edge)) &&
      (focusIds.has(edge.from) || focusIds.has(edge.to)),
  );

  return {
    primaryKeys,
    displayEdges: [...primaryEdges, ...contextualEdges],
  };
}

export function getGraphEdgePath(
  edge: GraphEdge,
  fromPoint: GraphLayoutPoint,
  toPoint: GraphLayoutPoint,
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

export function getGraphHoverLabel(
  node: ResearchNode,
  point: GraphLayoutPoint,
): GraphHoverLabel {
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
