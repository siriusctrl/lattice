export type GraphPosition = {
  x: number;
  y: number;
};

export type InlineText =
  | string
  | {
      kind: "anchor";
      label: string;
      target: string;
      hint: string;
    };

export type ResearchBlock =
  | {
      kind: "paragraph";
      content: InlineText[];
    }
  | {
      kind: "quote";
      content: string;
    }
  | {
      kind: "insight";
      label: string;
      content: string;
    };

export type ResearchNode = {
  id: string;
  shortTitle: string;
  title: string;
  year: string;
  userPrompt: string;
  lead: string;
  blocks: ResearchBlock[];
  image?: {
    src: string;
    alt: string;
    tone: "portrait" | "landscape";
    credit?: string;
    creditUrl?: string;
  };
  position: GraphPosition;
};

export type GraphEdge = {
  from: string;
  to: string;
  kind: "fork" | "synthesis";
};

const anchor = (
  label: string,
  target: string,
  hint: string,
): InlineText => ({
  kind: "anchor",
  label,
  target,
  hint,
});

export const ROOT_NODE_ID = "musk";

export const MOCK_RESEARCH_NODES: Record<string, ResearchNode> = {
  musk: {
    id: "musk",
    shortTitle: "Elon Musk",
    title: "Elon Musk",
    year: "1971 -",
    userPrompt: "介绍一下马斯克。不要只列公司，重点讲清他人生中的关键转折。",
    lead: "一段不断把上一场胜利押进下一场未知的人生。",
    image: {
      src: "/assets/elon-musk-portrait.webp",
      alt: "Elon Musk 的黑白肖像",
      tone: "portrait",
      credit: "The Royal Society / Debbie Rowe, CC BY-SA 4.0",
      creditUrl:
        "https://commons.wikimedia.org/wiki/File:Elon_Musk_(cropped).jpg",
    },
    blocks: [
      {
        kind: "paragraph",
        content: [
          "马斯克的经历很难被压缩成一条顺滑的成功曲线。他于 ",
          anchor("1971 年出生在比勒陀利亚", "origin", "从早年经历开始"),
          "，后来经加拿大前往美国。真正贯穿其人生的，是一次次把已有资本、控制权和声誉重新投入高风险系统。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "第一阶段从 ",
          anchor("Zip2", "zip2", "第一次创业"),
          " 开始，随后进入 ",
          anchor("X.com 与 PayPal", "paypal", "支付平台与控制权"),
          "。退出所得并没有变成安全垫，而是成为第二阶段的燃料。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "2000 年代，他同时押注 ",
          anchor("SpaceX", "spacex", "可复用火箭与火星叙事"),
          " 和 ",
          anchor("Tesla", "tesla", "电动车与制造系统"),
          "。这两家公司在 2008 年几乎同时走到现金与技术的悬崖边。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "后来，他又把早年的平台执念带入 ",
          anchor("Twitter 到 X", "x", "一个名字跨越二十年"),
          "，并通过 ",
          anchor("xAI", "xai", "AI 时代的新一轮组织重叠"),
          " 继续扩张公司之间的边界。",
        ],
      },
      {
        kind: "insight",
        label: "读法",
        content:
          "与其把这段生平看成公司清单，不如追踪三个反复出现的变量：控制权、资本再投入，以及对技术时间尺度的判断。",
      },
    ],
    position: { x: 10, y: 50 },
  },
  origin: {
    id: "origin",
    shortTitle: "比勒陀利亚",
    title: "局外人的起点",
    year: "1971 - 1989",
    userPrompt: "他的南非成长经历，后来留下了什么？",
    lead: "早年经历不是命运解释，但它提供了理解迁移与自我构建的第一条线索。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "马斯克在南非比勒陀利亚长大。公开叙述常强调他大量阅读、较早接触计算机，以及在学校中的孤立感。更谨慎的理解是：这些经历让“离开现有环境”很早就成为一种可执行选项。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "他十二岁时制作并出售了一款名为 ",
          anchor("Blastar", "blastar", "早期编程故事"),
          " 的简单游戏代码。这件事的意义不在于证明天才，而在于他很早就体验了从抽象想法到可交换成果的完整闭环。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "1989 年，他 ",
          anchor("移居加拿大", "migration", "迁移路径"),
          "，之后进入美国教育与创业网络。这次地理迁移也是他人生中第一次主动更换系统。",
        ],
      },
      {
        kind: "insight",
        label: "暂时结论",
        content:
          "“局外人”不是性格标签，而是一种持续寻找新系统、再试图获得系统控制权的行动模式。",
      },
    ],
    position: { x: 27, y: 14 },
  },
  blastar: {
    id: "blastar",
    shortTitle: "Blastar",
    title: "Blastar 并不是传奇证据",
    year: "1983",
    userPrompt: "十二岁写游戏这件事，真的能解释他后来的人生吗？",
    lead: "它更像一个早期样本，而不是一条决定论证据。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "把 Blastar 直接解释成“创业天赋”会过度简化。更有价值的是过程：自己学习、构建一个可以运行的系统，再把代码变成外部认可。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这种反馈回路后来反复出现。先做出可运行原型，再借由原型吸引资本、人才与更大的叙事。它与后来强调的 ",
          anchor("第一性原理与风险压缩", "risk", "跨分支综合节点"),
          " 有相似结构，但不能被简单画上等号。",
        ],
      },
      {
        kind: "quote",
        content:
          "一个童年故事最可靠的用途，不是预测未来，而是帮助我们提出更好的后续问题。",
      },
    ],
    position: { x: 45, y: 8 },
  },
  migration: {
    id: "migration",
    shortTitle: "迁往加拿大",
    title: "迁移是一项策略",
    year: "1989 - 1995",
    userPrompt: "为什么先去加拿大，这一步重要吗？",
    lead: "这是从个人处境进入北美技术与资本网络的过渡。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "1989 年，马斯克凭借母亲的加拿大背景移居加拿大，之后继续前往美国学习。这段经历经常被快速带过，但它连接了两个完全不同的机会系统。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "迁移没有直接创造后来的公司，却改变了他能够接触的人、资本与技术市场。到 1995 年，他已经站在商业互联网扩张的入口，并与他人共同创建了 ",
          anchor("Zip2", "zip2", "进入第一次创业"),
          "。",
        ],
      },
    ],
    position: { x: 45, y: 22 },
  },
  zip2: {
    id: "zip2",
    shortTitle: "Zip2",
    title: "第一次把代码变成资本",
    year: "1995 - 1999",
    userPrompt: "Zip2 对马斯克而言，真正改变了什么？",
    lead: "它完成了第一次从工程能力、商业分发到资本退出的闭环。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "Zip2 为报纸提供在线城市指南、地图和商业目录工具。它属于互联网早期一个非常具体的问题：传统媒体如何把本地信息搬到网页上。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "1999 年 Compaq 收购 Zip2，马斯克从交易中获得了第一笔足以改变其选择空间的资本。更重要的是，他也第一次经历了董事会、职业经理人和创始人控制权之间的张力。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这笔退出资金很快进入 ",
          anchor("X.com", "paypal", "下一次更大的平台押注"),
          "。从这里开始，“退出”对他而言往往不是结束，而是下一次风险预算。",
        ],
      },
    ],
    position: { x: 28, y: 35 },
  },
  paypal: {
    id: "paypal",
    shortTitle: "X.com / PayPal",
    title: "平台执念与控制权",
    year: "1999 - 2002",
    userPrompt: "PayPal 阶段最重要的冲突是什么？",
    lead: "这段经历同时提供了资本、失去控制权的记忆，以及一个长期未完成的名字。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "1999 年，马斯克参与创建在线金融服务公司 X.com。它后来与 Confinity 合并，并逐渐以 PayPal 品牌为核心。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "2000 年，董事会在他出行期间更换了 CEO。这个节点值得单独看，因为它让“技术路线争论”与“创始人控制权”直接重叠，也可能帮助解释他后来对组织控制的高度重视。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "2002 年 eBay 收购 PayPal。退出资本随后进入 SpaceX 与 Tesla。二十年后，",
          anchor("X 这个名字重新出现", "x", "从金融平台到公共信息平台"),
          "，说明这里还有一个长期未关闭的叙事。",
        ],
      },
      {
        kind: "insight",
        label: "连接",
        content:
          "这一阶段连接了两个后来反复出现的主题：控制权不可轻易外包，以及平台应覆盖尽可能多的用户行为。",
      },
    ],
    position: { x: 46, y: 34 },
  },
  spacex: {
    id: "spacex",
    shortTitle: "SpaceX",
    title: "把退出资本变成使命",
    year: "2002 -",
    userPrompt: "为什么刚从互联网公司退出，就去做火箭？",
    lead: "SpaceX 把个人资本、工程问题和文明级叙事锁在同一个组织里。",
    image: {
      src: "/assets/falcon-editorial.webp",
      alt: "一枚早期商业火箭从热带发射场升空的单色编辑影像",
      tone: "landscape",
    },
    blocks: [
      {
        kind: "paragraph",
        content: [
          "2002 年，马斯克创建 SpaceX。最初的问题不是“如何经营一家成熟航天公司”，而是能否通过垂直整合和快速迭代，显著降低进入轨道的成本。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "Falcon 1 的 ",
          anchor("前三次发射都失败", "crisis", "进入 2008 双重危机"),
          "。对一家主要依靠创始人资本维持的公司而言，技术失败很快就会变成时间与现金问题。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "2008 年 9 月，",
          anchor("第四次 Falcon 1 发射", "falcon4", "最后一次可承受的尝试"),
          " 成功进入轨道。它没有自动解决所有问题，却改变了客户与投资者对公司能否成立的判断。",
        ],
      },
    ],
    position: { x: 46, y: 56 },
  },
  tesla: {
    id: "tesla",
    shortTitle: "Tesla",
    title: "不是创办故事，而是接管故事",
    year: "2004 -",
    userPrompt: "马斯克和 Tesla 的关系，应该怎样准确理解？",
    lead: "他以早期投资者和董事长身份进入，最终把公司变成其最具规模的制造系统。",
    image: {
      src: "/assets/roadster-editorial.webp",
      alt: "一辆早期电动跑车停在深夜厂房中的单色编辑影像",
      tone: "landscape",
    },
    blocks: [
      {
        kind: "paragraph",
        content: [
          "Tesla 在马斯克加入前已经成立。他在 2004 年领投早期融资并担任董事长，随后越来越深地参与产品方向与融资，2008 年成为 CEO。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "第一款 Roadster 证明高性能电动车可以具有吸引力，但开发与制造过程也带来了严重的成本和交付压力。这个阶段形成了后来反复出现的 ",
          anchor("production hell", "roadster", "Roadster 的制造困境"),
          "。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "到 2008 年，Tesla 与 SpaceX ",
          anchor("同时逼近资金悬崖", "crisis", "两个分支汇入同一节点"),
          "。这是理解他风险偏好的关键交汇点。",
        ],
      },
    ],
    position: { x: 46, y: 77 },
  },
  crisis: {
    id: "crisis",
    shortTitle: "2008 危机",
    title: "两家公司同时接近悬崖",
    year: "2008",
    userPrompt: "2008 年到底发生了什么，为什么它是一个交汇点？",
    lead: "技术失败、制造压力与全球金融危机，在同一年压缩了所有选择。",
    image: {
      src: "/assets/roadster-editorial.webp",
      alt: "一辆早期电动跑车停在空旷厂房中的单色编辑影像",
      tone: "landscape",
    },
    blocks: [
      {
        kind: "paragraph",
        content: [
          "SpaceX 已经历三次 Falcon 1 失败，Tesla 则面对 Roadster 成本、交付与融资压力。与此同时，金融危机让外部资本更加难以获得。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "马斯克需要在两家公司之间分配所剩资源。SpaceX 的 ",
          anchor("第四次发射", "falcon4", "技术拐点"),
          " 成功进入轨道，Tesla 也在年底前完成关键融资。两个结果共同延长了系统的生存时间。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这个节点同时来自 SpaceX 与 Tesla 两条路径，因此在研究图中拥有多个父节点。它也自然导向一个综合问题：",
          anchor("这究竟是莽撞，还是一种风险压缩方法", "risk", "自动综合多个分支"),
          "？",
        ],
      },
      {
        kind: "insight",
        label: "DAG 节点",
        content:
          "当你从不同分支抵达这里，系统不会复制两份内容，而是为同一研究节点增加新的来源边。",
      },
    ],
    position: { x: 66, y: 63 },
  },
  falcon4: {
    id: "falcon4",
    shortTitle: "Falcon 1 Flight 4",
    title: "第四次发射改变了判断",
    year: "2008.09",
    userPrompt: "为什么第四次发射如此关键？",
    lead: "它让 SpaceX 从“可能无法做到”跨入“已经做到一次”。",
    image: {
      src: "/assets/falcon-editorial.webp",
      alt: "一枚黑白火箭离开发射台的单色编辑影像",
      tone: "landscape",
    },
    blocks: [
      {
        kind: "paragraph",
        content: [
          "2008 年 9 月，Falcon 1 第四次飞行成功进入轨道。这是首枚由私人开发的液体燃料火箭进入轨道，也是在前三次失败之后的一次生存性验证。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "真正改变公司的不只是一次飞行数据，而是可信度。技术结果让后续合同、人才与资本可以围绕一个已经成立的事实重新定价。",
        ],
      },
      {
        kind: "quote",
        content:
          "在高风险工程中，一次成功不会抹去三次失败，但会彻底改变第五次尝试是否存在。",
      },
      {
        kind: "paragraph",
        content: [
          "它也是理解 ",
          anchor("马斯克风险逻辑", "risk", "综合多个分支"),
          " 的最好样本之一。",
        ],
      },
    ],
    position: { x: 83, y: 48 },
  },
  roadster: {
    id: "roadster",
    shortTitle: "Roadster",
    title: "第一场 production hell",
    year: "2006 - 2008",
    userPrompt: "Roadster 为什么差点拖垮 Tesla？",
    lead: "概念成立，并不意味着制造系统已经成立。",
    image: {
      src: "/assets/roadster-editorial.webp",
      alt: "早期电动跑车置于空旷工业厂房中的单色编辑影像",
      tone: "landscape",
    },
    blocks: [
      {
        kind: "paragraph",
        content: [
          "Roadster 证明了电动车不必只以节能为卖点，但从原型走向量产暴露了成本估算、供应链与工程变更之间的耦合。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "当交付承诺早于制造能力成熟，团队会同时承受技术问题、客户预期和现金消耗。这种模式后来在 Model 3 阶段以更大规模重现。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "Roadster 分支最终汇入 ",
          anchor("2008 双重危机", "crisis", "与 SpaceX 分支交汇"),
          "，因为制造问题只有放进当时的融资环境中才完整。",
        ],
      },
    ],
    position: { x: 83, y: 80 },
  },
  risk: {
    id: "risk",
    shortTitle: "风险逻辑",
    title: "风险不是一个性格形容词",
    year: "综合节点",
    userPrompt: "把这些分支放在一起，怎样理解他的风险偏好？",
    lead: "关键不是他愿意承担多少风险，而是他如何重新定义失败、时间和控制权。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "从 Zip2、PayPal、SpaceX、Tesla 到 X，可以看到一种重复结构：先形成足够大的目标，再把技术、资本和组织压缩进非常短的验证周期。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这并不等于风险被消除。相反，很多风险被集中到了组织、员工、投资者和公共系统身上。因此，“敢于冒险”不足以构成完整评价。",
        ],
      },
      {
        kind: "insight",
        label: "综合",
        content:
          "更准确的说法是：他倾向于接受局部失败，只要这些失败仍能换取足够快的信息，并保留对最终系统的控制权。",
      },
      {
        kind: "paragraph",
        content: [
          "这个结论来自多个父节点。以后无论从 ",
          anchor("PayPal", "paypal", "回看控制权"),
          "、",
          anchor("SpaceX", "spacex", "回看工程验证"),
          " 还是 ",
          anchor("Tesla", "tesla", "回看制造系统"),
          " 进入，系统都会复用同一个综合节点。",
        ],
      },
    ],
    position: { x: 91, y: 63 },
  },
  x: {
    id: "x",
    shortTitle: "Twitter / X",
    title: "一个名字跨越二十年",
    year: "1999 / 2022 -",
    userPrompt: "为什么 X 这个名字对他一直重要？",
    lead: "它从金融平台的名字，变成了公共信息与服务平台的容器。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "X 最早出现在 1999 年的 X.com。PayPal 阶段结束后，这个名字并没有消失。马斯克后来重新取得域名，并在收购 Twitter 后于 2023 年将其改名为 X。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "从金融服务到社交网络，表面上业务不同，底层愿景却类似：建立一个覆盖更多行为的平台，并尽可能减少平台边界。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "X 又与 ",
          anchor("xAI", "xai", "信息平台与模型能力"),
          " 建立联系，使内容分发、实时数据与生成式模型进入同一个组织叙事。",
        ],
      },
    ],
    position: { x: 66, y: 28 },
  },
  xai: {
    id: "xai",
    shortTitle: "xAI",
    title: "公司边界再次重叠",
    year: "2023 -",
    userPrompt: "xAI 在这整张人生图里扮演什么角色？",
    lead: "它延续了一个熟悉模式：把模型能力嵌入已有数据、分发与基础设施。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "xAI 于 2023 年成立，并推出 Grok 系列模型。单独看，它是一家 AI 公司；放进整张图里，它更像一个会连接 X、算力基础设施和其他工程组织的新层。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这里最值得继续追踪的不是产品列表，而是组织边界：数据来自哪里、模型服务于谁，以及不同公司之间如何共享资源和叙事。",
        ],
      },
      {
        kind: "insight",
        label: "开放问题",
        content:
          "当多个公司逐渐共享模型、数据和基础设施时，传统的单公司视角可能已经不足以解释决策。",
      },
    ],
    position: { x: 87, y: 26 },
  },
};

export const ALL_POSSIBLE_EDGES: GraphEdge[] = [
  { from: "musk", to: "origin", kind: "fork" },
  { from: "musk", to: "zip2", kind: "fork" },
  { from: "musk", to: "paypal", kind: "fork" },
  { from: "musk", to: "spacex", kind: "fork" },
  { from: "musk", to: "tesla", kind: "fork" },
  { from: "musk", to: "x", kind: "fork" },
  { from: "musk", to: "xai", kind: "fork" },
  { from: "origin", to: "blastar", kind: "fork" },
  { from: "origin", to: "migration", kind: "fork" },
  { from: "migration", to: "zip2", kind: "fork" },
  { from: "zip2", to: "paypal", kind: "fork" },
  { from: "paypal", to: "x", kind: "fork" },
  { from: "paypal", to: "risk", kind: "synthesis" },
  { from: "spacex", to: "crisis", kind: "fork" },
  { from: "spacex", to: "falcon4", kind: "fork" },
  { from: "tesla", to: "roadster", kind: "fork" },
  { from: "tesla", to: "crisis", kind: "fork" },
  { from: "crisis", to: "falcon4", kind: "fork" },
  { from: "crisis", to: "risk", kind: "synthesis" },
  { from: "falcon4", to: "risk", kind: "synthesis" },
  { from: "roadster", to: "crisis", kind: "fork" },
  { from: "x", to: "xai", kind: "fork" },
  { from: "blastar", to: "risk", kind: "synthesis" },
];

export function getNodeAnchorTargets(node: ResearchNode): string[] {
  const targets = new Set<string>();
  for (const block of node.blocks) {
    if (block.kind !== "paragraph") continue;
    for (const part of block.content) {
      if (typeof part !== "string" && part.kind === "anchor") {
        targets.add(part.target);
      }
    }
  }
  return [...targets];
}
