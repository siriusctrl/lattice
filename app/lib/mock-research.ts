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
    blocks: [
      {
        kind: "paragraph",
        content: [
          "如果只按公司排列，马斯克的生平会像一串不相干的创业项目；按关键转折看，它更像几次连续换轨。他于 ",
          anchor("1971 年出生在比勒陀利亚", "origin", "从早年经历开始"),
          "，少年时期接触编程，1989 年离开南非，经加拿大进入北美教育体系。随后在 ",
          anchor("Queen’s 与宾夕法尼亚大学", "education", "教育、迁移与进入硅谷"),
          " 学习商业和物理；原本计划继续读博，却在 1995 年互联网商业化加速时转向创业。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "第一轮创业从为报纸制作在线城市指南的 ",
          anchor("Zip2", "zip2", "第一次创业"),
          " 开始。1999 年退出后，他把所得投入在线金融公司 ",
          anchor("X.com 与 PayPal", "paypal", "支付平台与控制权"),
          "。这两家公司让他完成从代码、产品到资本退出的闭环，也留下了被董事会解除 CEO 职务的控制权记忆。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "2002 年 PayPal 被收购后，他没有把退出所得主要用于分散风险，而是同时投入两个资本密集型系统：创建 ",
          anchor("SpaceX", "spacex", "可复用火箭与火星叙事"),
          "，并在 2004 年以早期投资者和董事长身份进入 ",
          anchor("Tesla", "tesla", "电动车与制造系统"),
          "。两家公司在 ",
          anchor("2008 年危机", "crisis", "技术、制造与资金同时受压"),
          " 中几乎同时走到现金与技术的悬崖边。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "危机之后，SpaceX 从 Falcon 1 扩展到 Falcon 9、Dragon、可重复使用火箭与 ",
          anchor("Starlink", "starlink", "从发射服务走向通信基础设施"),
          "；Tesla 则从 Roadster 走向 Model S、",
          anchor("Model 3 量产", "model3", "规模化制造与 production hell"),
          "，并通过 ",
          anchor("SolarCity 与储能", "energy", "汽车之外的能源系统"),
          " 把公司叙事扩展为发电、储能和交通的组合。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "2010 年代中后期，他又同时推进脑机接口公司 ",
          anchor("Neuralink", "neuralink", "从工程系统进入神经技术"),
          " 和隧道基础设施公司 ",
          anchor("The Boring Company", "boring", "城市交通问题的另一种解法"),
          "。它们规模和成熟度不同，却都延续了同一种做法：把一个长期愿景压缩成可以迅速验证的工程项目。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "2022 年收购 Twitter 后，他把早年的平台执念带入 ",
          anchor("Twitter 到 X", "x", "一个名字跨越二十年"),
          "；2023 年成立 ",
          anchor("xAI", "xai", "从 OpenAI 分歧到 Grok 与算力基础设施"),
          "，让模型、实时信息分发和算力基础设施逐渐进入同一张组织网络。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "因此，理解这段生平不能只统计成功公司，也要同时观察 ",
          anchor("管理方式与组织代价", "management", "高压节奏、直接控制与争议"),
          "，以及贯穿多个分支的 ",
          anchor("风险逻辑", "risk", "资本再投入、失败反馈与控制权"),
          "。他的优势常来自把遥远目标转成连续验证；相同机制也会把压力转移给员工、投资者、监管者和公共系统。",
        ],
      },
    ],
    position: { x: 7, y: 52 },
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
    position: { x: 18, y: 17 },
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
    position: { x: 32, y: 8 },
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
          "他先进入安大略省的 Queen’s University，之后转到 ",
          anchor("宾夕法尼亚大学", "education", "物理、经济学与硅谷入口"),
          "。迁移没有直接创造后来的公司，却改变了他能够接触的人、资本与技术市场。到 1995 年，他已经站在商业互联网扩张的入口，并与他人共同创建了 ",
          anchor("Zip2", "zip2", "进入第一次创业"),
          "。",
        ],
      },
    ],
    position: { x: 32, y: 18 },
  },
  education: {
    id: "education",
    shortTitle: "Queen’s / Penn",
    title: "物理、经济学与一次未继续的博士计划",
    year: "1989 - 1995",
    userPrompt: "他的大学经历和后来创业之间，真的有直接关系吗？",
    lead: "教育没有给出事业蓝图，但把技术判断与商业判断放进了同一个框架。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "马斯克在加拿大 Queen’s University 学习两年后转入宾夕法尼亚大学，完成物理学与经济学方向的学习。把这两条线并置，比把他简单称为“工程师”或“商人”更接近后来公司的决策方式。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "物理训练强调约束、数量级和系统边界；经济与商业训练则关注资本、市场和组织。后来无论是火箭成本、电池供应链还是平台网络效应，他经常同时使用这两种语言。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "1995 年他原本计划在 Stanford 继续与材料和能源相关的研究，但没有沿博士路径走下去，而是进入正在扩张的商业互联网。这一转折并不意味着放弃技术兴趣，而是把技术问题转移到公司中解决。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这个决定直接连接到 ",
          anchor("Zip2", "zip2", "第一家互联网公司"),
          "：先进入一个反馈速度更快的市场，再用创业积累的资本回到能源和太空等更慢、更重的系统。",
        ],
      },
    ],
    position: { x: 44, y: 18 },
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
    position: { x: 55, y: 18 },
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
    position: { x: 66, y: 18 },
  },
  spacex: {
    id: "spacex",
    shortTitle: "SpaceX",
    title: "把退出资本变成使命",
    year: "2002 -",
    userPrompt: "为什么刚从互联网公司退出，就去做火箭？",
    lead: "SpaceX 把个人资本、工程问题和文明级叙事锁在同一个组织里。",
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
      {
        kind: "paragraph",
        content: [
          "此后 Falcon 9 和 Dragon 把公司带入稳定的商业发射与 NASA 任务，可重复使用一级火箭又把“降低成本”从一次性的产品目标变成持续运营能力。SpaceX 的核心变化，是从证明火箭能飞，转向证明同一套系统可以高频、反复地飞。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "随后出现的 ",
          anchor("Starlink", "starlink", "卫星通信网络与发射能力的闭环"),
          " 又改变了商业模型：SpaceX 不只替客户发射载荷，也通过自己的星座运营通信服务。这让火箭、卫星制造、地面网络和持续现金流进入同一个系统。",
        ],
      },
    ],
    position: { x: 22, y: 39 },
  },
  tesla: {
    id: "tesla",
    shortTitle: "Tesla",
    title: "不是创办故事，而是接管故事",
    year: "2004 -",
    userPrompt: "马斯克和 Tesla 的关系，应该怎样准确理解？",
    lead: "他以早期投资者和董事长身份进入，最终把公司变成其最具规模的制造系统。",
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
      {
        kind: "paragraph",
        content: [
          "危机后，Model S 和 Model X 让 Tesla 从小众跑车公司走向高端整车制造商；真正改变规模的则是 ",
          anchor("Model 3 量产", "model3", "自动化、工厂与交付压力"),
          "。它把需求验证转化成生产系统、供应链和现金周转问题。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "Tesla 的边界也逐渐超出汽车。电池、超级充电网络，以及 ",
          anchor("SolarCity 与 Tesla Energy", "energy", "发电、储能和交通的一体化"),
          " 共同构成更大的能源叙事；与此同时，自动驾驶和机器人又把公司进一步推向软件与 AI。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这种扩张依赖非常直接的 ",
          anchor("管理方式", "management", "高压节奏与创始人控制"),
          "：目标可以被快速重写，组织可以在短时间内重排，但代价是极高的不确定性和持续的执行压力。",
        ],
      },
    ],
    position: { x: 22, y: 65 },
  },
  crisis: {
    id: "crisis",
    shortTitle: "2008 危机",
    title: "两家公司同时接近悬崖",
    year: "2008",
    userPrompt: "2008 年到底发生了什么，为什么它是一个交汇点？",
    lead: "技术失败、制造压力与全球金融危机，在同一年压缩了所有选择。",
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
    position: { x: 50, y: 47 },
  },
  falcon4: {
    id: "falcon4",
    shortTitle: "Falcon 1 Flight 4",
    title: "第四次发射改变了判断",
    year: "2008.09",
    userPrompt: "为什么第四次发射如此关键？",
    lead: "它让 SpaceX 从“可能无法做到”跨入“已经做到一次”。",
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
    position: { x: 68, y: 45 },
  },
  roadster: {
    id: "roadster",
    shortTitle: "Roadster",
    title: "第一场 production hell",
    year: "2006 - 2008",
    userPrompt: "Roadster 为什么差点拖垮 Tesla？",
    lead: "概念成立，并不意味着制造系统已经成立。",
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
          "Roadster 的经验并没有消除制造问题，而是给 Tesla 留下了一套不断升级的处理方式：把设计、供应商、软件和工厂更紧密地放进同一条反馈链。后来 ",
          anchor("Model 3", "model3", "规模扩大后的第二场 production hell"),
          " 把这套方法放大到大众车型的数量级。",
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
    position: { x: 37, y: 59 },
  },
  starlink: {
    id: "starlink",
    shortTitle: "Starlink",
    title: "发射能力开始服务自己的网络",
    year: "2015 -",
    userPrompt: "Starlink 为什么不只是 SpaceX 的一个附属产品？",
    lead: "它把火箭、卫星、地面网络和持续服务收入连接成了一个闭环。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "传统商业发射主要等待外部客户提供载荷。Starlink 改变了这个关系：SpaceX 可以为自己的低轨卫星星座持续安排发射，从而同时提高火箭复用频率、卫星制造速度和网络覆盖。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这是一种典型的纵向整合。火箭降低部署成本，批量卫星制造缩短更新周期，用户终端和网络运营则把一次性发射项目变成持续服务。每一层都为其他层创造需求。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "它也把 SpaceX 带入新的公共议题：频谱和各国监管、轨道拥挤、天文观测影响，以及通信基础设施在战争和灾害中的政治意义。工程规模越大，外部性就越难被当成边缘问题。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "因此 Starlink 既证明了马斯克擅长构造跨产品闭环，也提醒我们回到 ",
          anchor("风险逻辑", "risk", "系统收益与公共成本"),
          "：快速扩张得到的反馈和网络效应，往往伴随需要更慢处理的治理问题。",
        ],
      },
    ],
    position: { x: 39, y: 32 },
  },
  model3: {
    id: "model3",
    shortTitle: "Model 3",
    title: "需求成功之后是制造危机",
    year: "2016 - 2019",
    userPrompt: "Model 3 为什么会成为第二场 production hell？",
    lead: "产品需求已经成立，但工厂、自动化和现金流必须同时跨过数量级变化。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "Model 3 承担的是 Tesla 从高价低量车型走向更大市场的任务。发布后的需求并不是最难的问题，真正困难的是在极短时间内让电池、零部件、装配、软件和交付共同达到新的产量水平。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "早期方案一度高估自动化能够替代多少成熟制造经验。瓶颈迫使团队重新引入人工流程、快速改造产线，并把设计变更直接推进工厂。它说明“第一性原理”不能跳过制造现场积累的隐性知识。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这一阶段强化了 Tesla 的垂直整合倾向：软件、动力系统、工厂和销售交付越来越被视为同一个产品。好处是反馈速度快，代价则是任何局部瓶颈都可能迅速扩散到整个公司。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "Model 3 最终把 Tesla 推向全球规模，也把 ",
          anchor("高压管理", "management", "期限、组织重排与执行代价"),
          " 固化为外界理解公司的核心议题。它与早期 ",
          anchor("Roadster", "roadster", "第一次制造危机"),
          " 不是重复事件，而是相同组织机制在更大数量级上的测试。",
        ],
      },
    ],
    position: { x: 56, y: 69 },
  },
  energy: {
    id: "energy",
    shortTitle: "SolarCity / Energy",
    title: "从汽车公司扩展到能源系统",
    year: "2006 -",
    userPrompt: "SolarCity 和储能业务，在马斯克的整体布局里是什么位置？",
    lead: "它试图把发电、储能和用电放进一套共同的产品逻辑。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "SolarCity 由马斯克的亲属创办，马斯克长期担任董事长并提供支持。Tesla 在 2016 年完成对 SolarCity 的收购，把太阳能业务与车辆、电池和储能产品放进同一家公司。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "战略叙事很清楚：太阳能负责发电，Powerwall 与大型电池负责储能，电动车负责消费一部分电力。这样 Tesla 就不再只是汽车制造商，而是覆盖能源生产、存储和使用的系统公司。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "但这次收购也带来治理争议。关联关系、SolarCity 的财务状况以及交易是否真正服务 Tesla 股东，都让“统一愿景”与“利益冲突”成为同一个问题的两面。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "能源分支展示了马斯克扩张边界的典型方式：不是增加一个孤立产品，而是让多个业务互相解释。它既能创造协同，也会进一步提高对 ",
          anchor("集中控制", "management", "跨公司决策与治理"),
          " 的依赖。",
        ],
      },
    ],
    position: { x: 39, y: 79 },
  },
  neuralink: {
    id: "neuralink",
    shortTitle: "Neuralink",
    title: "从机器系统进入神经系统",
    year: "2016 -",
    userPrompt: "Neuralink 是马斯克版图中的旁支，还是一条核心线索？",
    lead: "它把高带宽接口、专用硬件和长期人机关系放到医疗试验的约束中。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "Neuralink 于 2016 年前后组建，目标是开发可植入的脑机接口及配套手术机器人。与汽车和火箭相比，它面对的是完全不同的安全标准、临床证据和监管节奏。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "近期最具体的目标不是抽象的“人机融合”，而是帮助严重运动障碍者通过神经信号控制外部设备。公司在获得临床研究许可后，于 2024 年完成首例人体植入并展示了设备控制。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "短期医疗用途与长期增强愿景之间存在巨大距离。植入可靠性、手术风险、数据权利、参与者长期支持和监管透明度，都不能用互联网产品的迭代速度来处理。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "Neuralink 因而是一个很好的对照分支：它检验马斯克惯用的快速工程反馈，能否适应一个必须把谨慎放在速度之前的领域。这也是理解 ",
          anchor("管理方式", "management", "同一套组织方法在不同产业中的边界"),
          " 的关键材料。",
        ],
      },
    ],
    position: { x: 87, y: 42 },
  },
  boring: {
    id: "boring",
    shortTitle: "Boring Company",
    title: "把交通拥堵重新定义成挖掘成本",
    year: "2016 -",
    userPrompt: "The Boring Company 为什么看起来既大胆又很奇怪？",
    lead: "它没有先重做整套公共交通，而是试图把隧道建造变成更快、更便宜的工程产品。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "The Boring Company 起源于对城市拥堵的直接不满。它把问题重新表述为：如果隧道可以更快、更低成本地施工，城市交通是否可以增加地下维度，而不只在地面争夺空间。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "公司在拉斯维加斯会展中心运营 Loop 系统，使用地下道路和车辆连接站点。它证明了项目可以实际运行，但这与建成覆盖整个城市、具有公共交通级容量的网络仍不是同一件事。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "争议也正来自这里：支持者关注施工速度、站点灵活性和私人融资，批评者则关注单位运力、安全、许可、环境影响，以及它与成熟轨道交通相比究竟解决了什么。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这个分支很好地体现了马斯克的产品化习惯：把基础设施拆成可以快速演示的最小系统，再尝试扩大网络。是否能从演示跨到城市尺度，则必须交给长期运营数据回答。",
        ],
      },
    ],
    position: { x: 23, y: 89 },
  },
  management: {
    id: "management",
    shortTitle: "管理方式",
    title: "速度、控制与组织代价",
    year: "跨公司",
    userPrompt: "不同公司背后，马斯克的管理方式有哪些稳定特征？",
    lead: "同一套方法可以压缩反馈周期，也可以把不确定性和压力集中到组织内部。",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "最稳定的特征不是某条口号，而是把技术目标、组织结构和期限同时当作可以重写的变量。团队会被要求直接追到物理约束或用户结果，而不是把既有流程当成不可改变的前提。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这种方式在关键瓶颈上可能非常有效：决策链短，创始人能够跨部门重新分配资源，失败也能迅速变成下一轮设计输入。SpaceX 的发射迭代与 Tesla 的工厂爬坡都展示了它的力量。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "代价同样真实。极短期限、频繁重排和高度个人化的决策，会增加返工、人员流失、安全与合规风险，也容易让组织把创始人的注意力当成最稀缺资源。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "因此，评价这种管理不能只看“是否最终成功”，还要区分技术结果、资本回报、员工成本和公共外部性。相同方法在火箭、汽车、社交平台和医疗设备上，并不必然得到相同的合理性。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这也是一个典型综合节点：从 ",
          anchor("PayPal 的控制权冲突", "paypal", "创始人、董事会与技术路线"),
          "、",
          anchor("Tesla 的量产压力", "model3", "工厂中的高频重排"),
          " 和 ",
          anchor("X 的组织重构", "x", "平台治理与集中决策"),
          " 都可以抵达这里。",
        ],
      },
    ],
    position: { x: 82, y: 72 },
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
      {
        kind: "paragraph",
        content: [
          "真正需要区分的是四类风险：创始人自己的资本风险、公司与投资者承担的财务风险、员工承担的组织风险，以及社会承担的安全与治理风险。把它们都写成“马斯克敢冒险”，会掩盖成本究竟落在谁身上。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这也是为什么风险分析必须与 ",
          anchor("管理方式", "management", "谁决定、谁执行、谁承担后果"),
          " 相连：快速反馈是一种能力，但只有同时记录失败成本和外部性，才是一套完整的解释。",
        ],
      },
    ],
    position: { x: 94, y: 53 },
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
          "2022 年收购完成后，Twitter 经历了大规模人员和产品调整，订阅、认证、广告关系与内容治理都被快速改写。平台同时是私人公司、公共讨论空间和实时信息基础设施，这让普通创业公司的集中决策产生了更广泛后果。",
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
      {
        kind: "paragraph",
        content: [
          "这个分支最值得研究的不只是改名，而是 ",
          anchor("管理与治理", "management", "高频重构在公共平台上的代价"),
          "：当产品方向、规则执行和创始人的个人表达高度重叠时，平台边界会变得更难区分。",
        ],
      },
    ],
    position: { x: 76, y: 23 },
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
          "马斯克曾在 2015 年参与创建 OpenAI，之后离开其董事会，并长期公开批评该机构后来的方向。xAI 于 2023 年成立并推出 Grok 系列模型，可以被看作他重新进入前沿 AI 组织竞争的一次直接尝试。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "单独看，xAI 是一家模型公司；放进整张图里，它更像一个会连接 X 的实时分发、超大规模算力基础设施和其他工程组织的新层。模型不只是一款聊天产品，也可能成为多个公司共同使用的能力。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "这里最值得继续追踪的不是产品列表，而是组织边界：数据来自哪里、模型服务于谁，以及不同公司之间如何共享资源和叙事。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "它与 ",
          anchor("Neuralink", "neuralink", "AI 与人机接口的另一条长期线索"),
          " 也形成概念上的远距离连接：一个扩展模型能力，一个研究人与计算机之间的接口。但两者的现实成熟度、监管要求和可验证目标完全不同。",
        ],
      },
      {
        kind: "paragraph",
        content: [
          "当多个公司逐渐共享模型、数据、算力和分发时，传统的单公司视角可能已经不足以解释决策；这也会把关联交易、资源分配和责任边界推到研究中心。",
        ],
      },
    ],
    position: { x: 85, y: 30 },
  },
};

export const ALL_POSSIBLE_EDGES: GraphEdge[] = [
  { from: "musk", to: "origin", kind: "fork" },
  { from: "musk", to: "education", kind: "fork" },
  { from: "musk", to: "zip2", kind: "fork" },
  { from: "musk", to: "paypal", kind: "fork" },
  { from: "musk", to: "spacex", kind: "fork" },
  { from: "musk", to: "tesla", kind: "fork" },
  { from: "musk", to: "crisis", kind: "fork" },
  { from: "musk", to: "starlink", kind: "fork" },
  { from: "musk", to: "model3", kind: "fork" },
  { from: "musk", to: "energy", kind: "fork" },
  { from: "musk", to: "neuralink", kind: "fork" },
  { from: "musk", to: "boring", kind: "fork" },
  { from: "musk", to: "x", kind: "fork" },
  { from: "musk", to: "xai", kind: "fork" },
  { from: "musk", to: "management", kind: "fork" },
  { from: "musk", to: "risk", kind: "fork" },
  { from: "origin", to: "blastar", kind: "fork" },
  { from: "origin", to: "migration", kind: "fork" },
  { from: "migration", to: "education", kind: "fork" },
  { from: "education", to: "zip2", kind: "fork" },
  { from: "migration", to: "zip2", kind: "fork" },
  { from: "zip2", to: "paypal", kind: "fork" },
  { from: "paypal", to: "x", kind: "fork" },
  { from: "paypal", to: "risk", kind: "synthesis" },
  { from: "paypal", to: "management", kind: "synthesis" },
  { from: "spacex", to: "crisis", kind: "fork" },
  { from: "spacex", to: "falcon4", kind: "fork" },
  { from: "spacex", to: "starlink", kind: "fork" },
  { from: "tesla", to: "roadster", kind: "fork" },
  { from: "tesla", to: "crisis", kind: "fork" },
  { from: "tesla", to: "model3", kind: "fork" },
  { from: "tesla", to: "energy", kind: "fork" },
  { from: "tesla", to: "management", kind: "synthesis" },
  { from: "crisis", to: "falcon4", kind: "fork" },
  { from: "crisis", to: "risk", kind: "synthesis" },
  { from: "falcon4", to: "risk", kind: "synthesis" },
  { from: "roadster", to: "crisis", kind: "fork" },
  { from: "roadster", to: "model3", kind: "fork" },
  { from: "model3", to: "management", kind: "synthesis" },
  { from: "energy", to: "management", kind: "synthesis" },
  { from: "x", to: "xai", kind: "fork" },
  { from: "x", to: "management", kind: "synthesis" },
  { from: "xai", to: "neuralink", kind: "fork" },
  { from: "neuralink", to: "management", kind: "synthesis" },
  { from: "blastar", to: "risk", kind: "synthesis" },
  { from: "management", to: "risk", kind: "synthesis" },
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
