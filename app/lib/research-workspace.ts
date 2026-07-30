import type {
  GraphEdge,
  ResearchNode,
} from "@/app/lib/mock-research";
import { ROOT_NODE_ID } from "@/app/lib/mock-research";

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

export function getFollowupAnswer(nodeId: string) {
  return (
    FOLLOWUP_ANSWERS[nodeId] ??
    "这轮追问已保留在当前节点。它会作为局部上下文参与之后的回答，并在你切换分支时由系统自动判断是否相关。"
  );
}

export function appendUniqueEdge(edges: GraphEdge[], next: GraphEdge) {
  return edges.some(
    (edge) =>
      edge.from === next.from &&
      edge.to === next.to &&
      edge.kind === next.kind,
  )
    ? edges
    : [...edges, next];
}

export function getPathToNode(
  targetId: string,
  edges: GraphEdge[],
  rootNodeId = ROOT_NODE_ID,
): string[] | null {
  if (targetId === rootNodeId) return [rootNodeId];

  const queue: string[][] = [[rootNodeId]];
  const visited = new Set<string>([rootNodeId]);

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

type BuildSelectionNodeInput = {
  nodeId: string;
  nodeIndex: number;
  text: string;
  source: ResearchNode;
};

export function buildSelectionNode({
  nodeId,
  nodeIndex,
  text,
  source,
}: BuildSelectionNodeInput): ResearchNode {
  const excerpt = text.length > 20 ? `${text.slice(0, 20)}…` : text;
  const leadExcerpt = text.length > 64 ? `${text.slice(0, 64)}…` : text;
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

  return {
    id: nodeId,
    shortTitle: `选中：${excerpt}`,
    title: "选中的研究线索",
    year: "用户选中",
    userPrompt: `解释这段内容，并说明为什么它值得成为独立研究节点：“${text}”`,
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
}
