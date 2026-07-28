import type { GraphEdge } from "@/app/lib/mock-research";

export type ArticleSectionStatus =
  | "foundation"
  | "compiled"
  | "converged"
  | "developing";

export type ArticleSection = {
  id: string;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  sourceIds: string[];
  status: ArticleSectionStatus;
  statusLabel: string;
};

type BuildArticleInput = {
  discoveredIds: Set<string>;
  edges: GraphEdge[];
  followupNodeIds: Set<string>;
};

const SECTION_BY_NODE: Record<string, string> = {
  musk: "overview",
  origin: "early-life",
  blastar: "early-life",
  migration: "early-life",
  education: "early-life",
  zip2: "capital",
  paypal: "capital",
  spacex: "industrial-bets",
  tesla: "industrial-bets",
  falcon4: "industrial-bets",
  roadster: "industrial-bets",
  starlink: "scale-systems",
  model3: "scale-systems",
  energy: "scale-systems",
  neuralink: "new-frontiers",
  boring: "new-frontiers",
  crisis: "crisis",
  risk: "risk-pattern",
  management: "risk-pattern",
  x: "platforms",
  xai: "platforms",
};

function discoveredSources(
  discoveredIds: Set<string>,
  candidates: string[],
) {
  return candidates.filter((id) => discoveredIds.has(id));
}

function hasEdge(edges: GraphEdge[], from: string, to: string) {
  return edges.some((edge) => edge.from === from && edge.to === to);
}

export function getArticleSectionForNode(nodeId: string) {
  if (nodeId.startsWith("selection-")) return "research-notes";
  return SECTION_BY_NODE[nodeId] ?? "overview";
}

export function buildArticleSections({
  discoveredIds,
  edges,
  followupNodeIds,
}: BuildArticleInput): ArticleSection[] {
  const sections: ArticleSection[] = [
    {
      id: "overview",
      eyebrow: "概览",
      title: "把上一场胜利押进下一场未知",
      paragraphs: [
        "埃隆·马斯克的职业路径并不是一份彼此独立的公司清单。更连贯的读法，是观察他如何反复把资本、控制权和声誉投入尚未被证明的技术系统。",
        "从互联网支付到火箭、电动车、信息平台与人工智能，这些选择跨越不同产业，却持续围绕同一个问题展开：一个人愿意为了更长的技术时间尺度承担多大的当期风险。",
      ],
      sourceIds: ["musk"],
      status: "foundation",
      statusLabel: "基础段落",
    },
  ];

  const earlySources = discoveredSources(discoveredIds, [
    "origin",
    "blastar",
    "migration",
    "education",
  ]);
  if (earlySources.length > 0) {
    sections.push({
      id: "early-life",
      eyebrow: "1971 至 1995",
      title: "离开原有系统",
      paragraphs: [
        "马斯克在南非比勒陀利亚长大。阅读、编程与迁移经常被包装成后来成功的预言，但它们更适合被看作早期行动样本：学习一个系统，做出可运行的东西，然后寻找一个更大的机会环境。",
        "1989 年移居加拿大，之后进入美国教育与创业网络，是他第一次主动更换系统。这一步没有直接创造后来的公司，却改变了他可以接触的人、资本和技术市场。",
      ],
      sourceIds: earlySources,
      status: "compiled",
      statusLabel: "已整理",
    });
  }

  const capitalSources = discoveredSources(discoveredIds, ["zip2", "paypal"]);
  if (capitalSources.length > 0) {
    sections.push({
      id: "capital",
      eyebrow: "1995 至 2002",
      title: "第一次资本循环",
      paragraphs: [
        "Zip2 与 PayPal 阶段建立了马斯克后来反复使用的资本循环：先通过软件产品获得退出收益，再把这笔收益投入资本需求更高、失败代价也更大的新系统。",
        "这一阶段同样暴露出控制权问题。公司合并、管理权变化和董事会冲突，使控制权不再只是个人偏好，而成为之后创业结构中的核心变量。",
      ],
      sourceIds: capitalSources,
      status: "compiled",
      statusLabel: "已整理",
    });
  }

  const industrialSources = discoveredSources(discoveredIds, [
    "spacex",
    "tesla",
    "falcon4",
    "roadster",
  ]);
  if (industrialSources.length > 0) {
    const hasSpaceX = discoveredIds.has("spacex");
    const hasTesla = discoveredIds.has("tesla");
    const opening =
      hasSpaceX && hasTesla
        ? "2000 年代，马斯克同时进入火箭与电动车两个重资产系统。SpaceX 必须证明低成本发射可以通过快速工程迭代实现，Tesla 则必须把有吸引力的电动车概念转化为稳定的制造与交付。"
        : hasSpaceX
          ? "SpaceX 把一个遥远使命拆成连续的工程验证。每次发射不仅要证明技术，也要换回足够的信息、资本与时间，让下一次尝试仍然成立。"
          : "Tesla 的困难不止是证明电动车具有吸引力，而是让供应链、成本和交付同时进入一个可以持续扩张的制造系统。";

    sections.push({
      id: "industrial-bets",
      eyebrow: "2002 至 2008",
      title: "把退出所得投入工业系统",
      paragraphs: [
        opening,
        "这不是从软件到硬件的简单跨界。它意味着更长的反馈周期、更高的固定成本，以及在失败时很难快速撤回的组织承诺。",
      ],
      sourceIds: industrialSources,
      status: hasSpaceX && hasTesla ? "compiled" : "developing",
      statusLabel: hasSpaceX && hasTesla ? "双线已整理" : "仍在生长",
    });
  }

  const scaleSources = discoveredSources(discoveredIds, [
    "starlink",
    "model3",
    "energy",
  ]);
  if (scaleSources.length > 0) {
    sections.push({
      id: "scale-systems",
      eyebrow: "2009 以后",
      title: "从产品证明走向规模系统",
      paragraphs: [
        "Falcon 1 与 Roadster 证明了最小系统能够成立；Starlink、Model 3 和 Tesla Energy 则要求火箭复用、卫星制造、工厂、供应链、发电与储能在更大规模上共同运行。",
        "这一阶段的核心不再是单次技术突破，而是组织能否长期重复同一结果。规模带来现金流和网络效应，也放大治理、劳动、安全与公共基础设施问题。",
      ],
      sourceIds: scaleSources,
      status: "compiled",
      statusLabel: "规模化材料",
    });
  }

  if (discoveredIds.has("crisis")) {
    const fromSpaceX = hasEdge(edges, "spacex", "crisis");
    const fromTesla = hasEdge(edges, "tesla", "crisis");
    const converged = fromSpaceX && fromTesla;
    const crisisSources = [
      "crisis",
      ...(fromSpaceX ? ["spacex"] : []),
      ...(fromTesla ? ["tesla"] : []),
    ];

    sections.push({
      id: "crisis",
      eyebrow: "2008",
      title: converged
        ? "两家公司在同一条现金边缘汇合"
        : "一条路径先抵达现金边缘",
      paragraphs: [
        converged
          ? "2008 年，SpaceX 与 Tesla 的问题在同一个资金约束中汇合。前三次 Falcon 1 发射失败，Roadster 又经历延期与成本压力，两家公司都逼近无法继续运转的边缘。"
          : "当前研究已经抵达 2008 年危机，但仍只从一条公司路径进入。文章先保留这个段落，同时等待另一条路径提供能够相互校验的材料。",
        converged
          ? "第四次 Falcon 1 发射成功、NASA 合同与 Tesla 的融资共同改变了结果。这个节点的意义不只是一次绝境反转，而是两条独立探索路径形成了同一个综合判断。"
          : "这个段落被标记为仍在生长。它不会假装已经拥有完整结论，也不会阻止用户继续阅读当前成稿。",
      ],
      sourceIds: crisisSources,
      status: converged ? "converged" : "developing",
      statusLabel: converged ? "双路径综合" : "等待交叉验证",
    });
  }

  const riskSources = new Set(
    discoveredSources(discoveredIds, [
      "risk",
      "management",
      "crisis",
      "falcon4",
    ]),
  );
  for (const nodeId of followupNodeIds) {
    if (["spacex", "tesla", "crisis", "risk"].includes(nodeId)) {
      riskSources.add(nodeId);
    }
  }
  if (discoveredIds.has("risk") || followupNodeIds.size > 0) {
    sections.push({
      id: "risk-pattern",
      eyebrow: "综合判断",
      title: "风险不是性格标签",
      paragraphs: [
        "把这些选择概括成大胆或鲁莽都不够。更有解释力的框架，是区分技术不确定性、资本暴露和组织代价，并观察每一次实验究竟换回了多少可用于下一步的信息。",
        "高频验证可以压缩技术不确定性，但也可能把压力转移给员工、投资者与公共系统。最终文章保留这种张力，而不是替用户提前做出单一评价。",
      ],
      sourceIds:
        riskSources.size > 0 ? [...riskSources] : [ROOT_FALLBACK_SOURCE],
      status: "compiled",
      statusLabel: "由追问补充",
    });
  }

  const platformSources = discoveredSources(discoveredIds, ["x", "xai"]);
  if (platformSources.length > 0) {
    sections.push({
      id: "platforms",
      eyebrow: "2022 以后",
      title: "平台边界再次扩张",
      paragraphs: [
        "从 Twitter 到 X，再到 xAI，早年的平台执念以新的形式出现。信息分发、模型能力、数据与基础设施被放进同一个更大的产品边界。",
        "这一部分仍然处于快速变化中，因此文章把它标记为可更新章节，而不是已经封闭的历史结论。",
      ],
      sourceIds: platformSources,
      status: "developing",
      statusLabel: "持续更新",
    });
  }

  const frontierSources = discoveredSources(discoveredIds, [
    "neuralink",
    "boring",
  ]);
  if (frontierSources.length > 0) {
    sections.push({
      id: "new-frontiers",
      eyebrow: "2016 以后",
      title: "同一套方法进入新的约束",
      paragraphs: [
        "Neuralink 与 The Boring Company 都从一个极大的长期问题出发，再把它压缩成可以演示和验证的工程项目。但医疗设备与城市基础设施拥有比互联网产品更慢的证据周期和更重的公共责任。",
        "这些分支因此不是简单的公司扩张，而是对同一套管理与风险方法的边界测试：速度何时创造信息，何时又会跳过不能被压缩的安全、监管与治理过程。",
      ],
      sourceIds: frontierSources,
      status: "developing",
      statusLabel: "持续验证",
    });
  }

  if ([...discoveredIds].some((id) => id.startsWith("selection-"))) {
    const selectionSources = [...discoveredIds].filter((id) =>
      id.startsWith("selection-"),
    );
    sections.push({
      id: "research-notes",
      eyebrow: "研究笔记",
      title: "用户圈出的待展开线索",
      paragraphs: [
        "这些材料来自用户在原始 Card 中主动圈出的文字。它们暂时保留为研究笔记，不会在证据不足时被强行改写成正文结论。",
      ],
      sourceIds: selectionSources,
      status: "developing",
      statusLabel: "等待整理",
    });
  }

  return sections;
}

const ROOT_FALLBACK_SOURCE = "musk";
