import type { GraphEdge } from "@/app/lib/mock-research";

export type ArticleSection = {
  id: string;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  sourceIds: string[];
};

type BuildArticleInput = {
  discoveredIds: Set<string>;
  edges: GraphEdge[];
  followupNodeIds: Set<string>;
};

const ROOT_SOURCE_ID = "musk";

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
  falcon4: "crisis",
  roadster: "crisis",
  crisis: "crisis",
  starlink: "scale-systems",
  model3: "scale-systems",
  energy: "scale-systems",
  neuralink: "new-frontiers",
  boring: "new-frontiers",
  x: "platforms",
  xai: "platforms",
  management: "operating-system",
  risk: "operating-system",
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
        "埃隆·马斯克的职业路径很难用一份公司清单解释。更连贯的读法，是看他如何把一轮创业积累的资本、控制权经验和工程信心，继续投入反馈周期更长、失败代价更高的系统。",
        "这条路径从互联网城市指南和在线支付出发，随后进入火箭、电动车、能源、卫星通信、公共信息平台与人工智能。行业不断变化，反复出现的却是同一组动作：把宏大目标压缩成工程节点，用高频试验换取信息，再用下一轮资本延长技术时间尺度。",
        "它同时制造了一个无法回避的张力。快速集中决策可以让组织穿过传统公司不愿承担的风险，也会把期限、返工、治理和公共影响压到更多人身上。理解马斯克，需要把工程结果与这些组织代价放在同一篇叙事里。",
      ],
      sourceIds: [ROOT_SOURCE_ID],
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
      title: "迁移先于事业发生",
      paragraphs: [
        "马斯克在南非比勒陀利亚长大。阅读、科幻和编程后来常被写成成功的预兆，但更可靠的意义在于，他很早就习惯把抽象兴趣变成可以运行的东西。少年时期制作并出售简单游戏 Blastar，是这套行动方式最早的可见样本。",
        "1989 年移居加拿大，之后进入美国教育与创业网络，是他第一次主动更换机会系统。迁移本身没有直接创造公司，却改变了他可以接触的大学、合作者、资本和快速扩张的技术市场。",
        "在 Queen’s University 与宾夕法尼亚大学学习之后，他原本计划继续深造，却在 1995 年互联网商业化加速时转向创业。这个选择奠定了此后反复出现的节奏：当技术窗口打开，先进入现场，再在行动中补齐资源与组织。",
      ],
      sourceIds: earlySources,
    });
  }

  const capitalSources = discoveredSources(discoveredIds, ["zip2", "paypal"]);
  if (capitalSources.length > 0) {
    sections.push({
      id: "capital",
      eyebrow: "1995 至 2002",
      title: "互联网创业建立第一轮资本循环",
      paragraphs: [
        "Zip2 为报纸提供在线城市指南。它不是马斯克后来最知名的公司，却让他第一次完整经历从产品、销售到被收购的创业闭环。1999 年的退出，使个人技术兴趣第一次转化成可以重新配置的资本。",
        "随后成立的 X.com 把目标从媒体工具扩大到在线金融服务。公司与 Confinity 合并后逐渐以 PayPal 品牌为核心，产品方向、技术路线与管理权也发生激烈冲突。2000 年董事会更换 CEO，让控制权成为马斯克之后设计公司结构时很难忽略的变量。",
        "2002 年 eBay 收购 PayPal。更重要的不是又一次退出本身，而是退出所得没有被分散保存，而是迅速进入 SpaceX 与 Tesla。由此形成的资本循环贯穿之后二十年：上一家公司提供的现金与信誉，被用来购买下一项长期实验所需的时间。",
      ],
      sourceIds: capitalSources,
    });
  }

  const industrialSources = discoveredSources(discoveredIds, [
    "spacex",
    "tesla",
  ]);
  if (industrialSources.length > 0) {
    const hasSpaceX = discoveredIds.has("spacex");
    const hasTesla = discoveredIds.has("tesla");
    const opening =
      hasSpaceX && hasTesla
        ? "2000 年代初，马斯克几乎同时进入火箭与电动车两个重资产系统。SpaceX 要证明低成本发射可以通过垂直整合和快速迭代实现，Tesla 则要把有吸引力的电动车概念变成稳定的制造、供应链与交付能力。"
        : hasSpaceX
          ? "SpaceX 把降低进入轨道成本的长期使命拆成连续工程验证。每次发射既要证明技术，也要换回足够的信息、资本与时间，让下一次尝试仍然成立。"
          : "Tesla 的挑战并不止于证明电动车具有吸引力，而是让电池、供应链、软件、工厂、成本和交付同时进入一个可以持续扩张的制造系统。";

    sections.push({
      id: "industrial-bets",
      eyebrow: "2002 至 2008",
      title: "从软件产品进入工业系统",
      paragraphs: [
        opening,
        "这不是一次简单的行业跨越。软件创业允许快速发布和低成本修正，火箭与汽车则拥有更长的反馈周期、更高的固定投入，以及失败后很难撤回的组织承诺。产品判断必须与材料、工艺、监管和现金流同时成立。",
        "两家公司由此发展出相似的工程文化：尽量缩短信息路径，让设计与制造彼此靠近，用真实硬件尽早暴露问题。它提高了试验速度，也让时间压力与集中决策成为日常管理的一部分。",
      ],
      sourceIds: industrialSources,
    });
  }

  if (discoveredIds.has("crisis")) {
    const fromSpaceX = hasEdge(edges, "spacex", "crisis");
    const fromTesla = hasEdge(edges, "tesla", "crisis");
    const crisisSources = discoveredSources(discoveredIds, [
      "crisis",
      ...(fromSpaceX ? ["spacex"] : []),
      ...(fromTesla ? ["tesla"] : []),
      "falcon4",
      "roadster",
    ]);

    sections.push({
      id: "crisis",
      eyebrow:
        fromSpaceX && fromTesla ? "2008 · 双路径综合" : "2008",
      title: "技术失败最终汇合成同一个现金问题",
      paragraphs: [
        "2008 年，SpaceX 的前三次 Falcon 1 发射失败，Tesla Roadster 又经历延期、成本上升与管理重组。两家公司面对的工程问题不同，却在资金约束中汇合：如果下一次验证不能及时改变外部判断，组织就可能失去继续试验的机会。",
        "第四次 Falcon 1 发射成功，随后获得的 NASA 合同改善了 SpaceX 的生存条件。Tesla 同期完成关键融资并继续推进交付。这并非单一英雄时刻，而是技术结果、客户承诺、融资安排与个人资本暴露共同改变了时间表。",
        "双路径综合让 2008 年成为整篇经历的枢纽。它既强化了马斯克对快速验证和控制权的依赖，也解释了为什么后来的公司更强调垂直整合、内部制造和直接掌握关键基础设施。",
      ],
      sourceIds:
        crisisSources.length > 0 ? crisisSources : [ROOT_SOURCE_ID],
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
      eyebrow: "2009 至今",
      title: "证明产品之后，还要证明系统能够重复",
      paragraphs: [
        "Falcon 1 与 Roadster 证明了最小系统可以成立；Falcon 9、可重复使用一级火箭、Starlink、Model 3 与 Tesla Energy 则要求同一结果在更大规模上反复出现。核心问题从单次突破转向制造节拍、设备利用率、供应链与现场运营。",
        "Starlink 把发射、卫星制造和终端网络连接成一个内部需求循环。Model 3 则表明，强劲需求并不会自动变成健康的商业系统，产线、质量、软件、物流与现金周转必须同时跨过规模门槛。",
        "能源业务又把汽车公司的边界扩大到发电、储能与电网协调。规模带来现金流、数据和网络效应，也同步放大劳动、安全、治理与公共基础设施责任。技术系统越成功，评价它的尺度就越不能只停留在产品层面。",
      ],
      sourceIds: scaleSources,
    });
  }

  const frontierSources = discoveredSources(discoveredIds, [
    "neuralink",
    "boring",
  ]);
  if (frontierSources.length > 0) {
    sections.push({
      id: "new-frontiers",
      eyebrow: "2016 至今",
      title: "同一套工程方法进入更慢的证据周期",
      paragraphs: [
        "Neuralink 与 The Boring Company 都从一个巨大的长期问题出发，再把它压缩成可展示、可试验的工程项目。前者关注脑机接口，后者试图重新设计地下交通施工与运营。",
        "它们延续了 SpaceX 和 Tesla 的做法：让关键环节尽量靠近组织内部，通过原型快速暴露瓶颈。但医疗设备和城市基础设施拥有更慢的证据周期，临床安全、参与者权益、运输容量与公共价值都不能只靠更快迭代解决。",
        "这些分支因此提供了一次边界测试。速度在何时创造高质量信息，又在何时跳过无法压缩的监管、伦理与治理过程，是判断这套方法能否迁移到新产业的关键。",
      ],
      sourceIds: frontierSources,
    });
  }

  const platformSources = discoveredSources(discoveredIds, ["x", "xai"]);
  if (platformSources.length > 0) {
    sections.push({
      id: "platforms",
      eyebrow: "2022 至今",
      title: "X 把平台、数据与模型放进同一个边界",
      paragraphs: [
        "Twitter 被收购并更名为 X，使一个跨越二十多年的平台构想重新出现。早年的 X.com 希望覆盖更广泛的金融行为，今天的 X 则把公共信息、创作者关系、支付设想与实时产品实验放在同一个入口。",
        "快速裁员、产品重写、认证变化、广告关系与内容治理争议表明，集中决策在公共信息平台上拥有比普通创业公司更广的外部影响。用户体验、商业模式与社会基础设施角色在这里很难彼此分开。",
        "xAI 又把生成式模型、实时数据、分发入口和计算基础设施接入这条叙事。它延续的并不是某个单独产品，而是一个更大的组织倾向：持续扩大系统边界，让更多关键能力在内部相互供给。",
      ],
      sourceIds: platformSources,
    });
  }

  const operatingSources = new Set(
    discoveredSources(discoveredIds, [
      "management",
      "risk",
      "crisis",
      "paypal",
      "model3",
      "x",
    ]),
  );
  for (const nodeId of followupNodeIds) {
    operatingSources.add(nodeId);
  }
  if (operatingSources.size > 0) {
    const paragraphs = [
      "贯穿这些公司的不是一套固定行业知识，而是一套组织操作系统：把目标转成可测量的第一性约束，压缩汇报层级，让设计者靠近制造和现场，并以异常紧凑的期限推动决策。",
      "它的优势与代价来自同一个来源。直接控制可以快速排除协调成本，高频试验可以压缩技术不确定性；但期限、返工与公开压力也可能被转移给员工、供应商、投资者和公共系统。大胆或鲁莽都不足以概括这种交换。",
      "更完整的评价需要逐次区分技术不确定性、资本暴露、组织代价与公共影响，并追问每次试验究竟换回了多少可用于下一步的信息。马斯克最重要的能力，也许不是单次预测未来，而是不断为高风险系统争取下一轮验证时间。",
    ];
    if (followupNodeIds.size > 0) {
      paragraphs.push(
        "Card 内的局部追问进一步补充了这套判断。它们保留在各自原始语境中，同时被编入这篇综合叙事，使管理、风险和工程结果之间的联系可以持续细化。",
      );
    }

    sections.push({
      id: "operating-system",
      eyebrow: "综合",
      title: "速度、控制权与风险共同构成组织方法",
      paragraphs,
      sourceIds: [...operatingSources],
    });
  }

  const selectionSources = [...discoveredIds].filter((id) =>
    id.startsWith("selection-"),
  );
  if (selectionSources.length > 0) {
    sections.push({
      id: "research-notes",
      eyebrow: "补充研究",
      title: "用户圈出的线索进入正文版本",
      paragraphs: [
        "用户从原始对话中圈出的材料会保留出处、原文和创建时的 Card 语境。Article 将这些线索编入当前版本，使新的问题能够扩展人物叙事，同时继续保持来源可追溯。",
      ],
      sourceIds: selectionSources,
    });
  }

  return sections;
}
