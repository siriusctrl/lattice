export type EssayLanguage = "zh" | "en";

export type EssaySection = {
  id: string;
  title: string;
  paragraphs: string[];
  quote?: string;
};

export type EssayContent = {
  language: EssayLanguage;
  htmlLang: "zh-CN" | "en";
  kicker: string;
  title: string;
  subtitle: string;
  published: string;
  readingTime: string;
  intro: string[];
  triad: Array<{
    label: string;
    structure: string;
    purpose: string;
  }>;
  contentsLabel: string;
  languageLabel: string;
  chineseLabel: string;
  englishLabel: string;
  demoLabel: string;
  sourceLabel: string;
  sections: EssaySection[];
  closingTitle: string;
  closing: string[];
  footerNote: string;
  diagramTitle: string;
  diagramDescription: string;
};

export const chineseEssay: EssayContent = {
  language: "zh",
  htmlLang: "zh-CN",
  kicker: "Lattice Notes 01",
  title: "对话会分叉，阅读仍应成篇",
  subtitle:
    "关于线性 AI 对话、Card、图谱，以及一次交流如何逐渐成为可复用的知识。",
  published: "2026.07.31",
  readingTime: "约 8 分钟",
  intro: [
    "和 AI 的交流经常从一个简单问题开始。回答里出现一个陌生概念，我们顺手追问；新的答案又带出另一个方向。几分钟后，旁支已经解释清楚，原来的问题却被埋在很长的聊天记录里。我们得到了一组答案，但失去了这段研究原本的结构。",
    "这并不是对话本身出了问题。对话本来就按时间发生。问题在于，我们让同一条时间线同时记录交流过程、表达探索关系，并充当最后的知识产物。它很自然地保存了先说什么、后说什么，却很难保存一个问题从哪里分出去，又如何回到原处。",
  ],
  triad: [
    {
      label: "对话",
      structure: "按时间发生",
      purpose: "维持眼前的注意力",
    },
    {
      label: "Card 与图",
      structure: "按关系保存",
      purpose: "保留分支、路径与出处",
    },
    {
      label: "文章",
      structure: "按编辑结构呈现",
      purpose: "成为可连续阅读的结果",
    },
  ],
  contentsLabel: "本文",
  languageLabel: "语言",
  chineseLabel: "中文",
  englishLabel: "English",
  demoLabel: "打开交互 Demo",
  sourceLabel: "查看 GitHub 源码",
  sections: [
    {
      id: "timeline",
      title: "线性没有错，只是承担了太多",
      paragraphs: [
        "线性对话有明确的价值。它几乎不要求学习成本，可以自然地维持共同注意力，也让每一次回应都有清楚的前因。对于一个短问题，一条时间线通常就是最合适的界面。",
        "困难出现在研究开始产生岔路的时候。用户可能只是想弄清一个术语、一家公司或一个背景事件，然后继续原来的问题。现在的聊天产品通常把这次绕行永久插入主记录。内容越长，时间位置越不能代表语义位置，滚动和搜索也只能帮我们找到一句话，不能恢复它当时属于哪条思路。",
        "因此需要区分三件事：聊天记录保存事情如何发生，研究结构保存问题如何展开，阅读产物负责把已经获得的内容重新组织。把它们压成同一条时间线，看起来最简单，长期使用时却把整理成本推给了用户。",
      ],
      quote: "时间顺序是一种可靠的记录方式，却不是完整的知识结构。",
    },
    {
      id: "branching",
      title: "分叉应当自然发生，不应由用户管理",
      paragraphs: [
        "一个分支最自然的起点，往往只是一次点击。模型在回答中标出一个可以继续解释的 anchor，用户点击它；或者用户选中一段文字，问一个新的问题。这些动作已经足够表达我想从这里向外探索。产品可以据此记录来源关系，而不需要先弹出创建节点、选择父级或命名分支的表单。",
        "同样，用户也不应该负责 merge back。探索结束后，哪些上下文需要带回当前回答，哪些材料应进入最终文章，应由模型与产品的上下文编译层处理。界面可以让用户返回、关闭或重新进入一个分支，但不应要求他们维护一套版本控制术语。",
        "自动化并不意味着可以随意改写历史。更稳妥的底层是追加式记录：保存用户做过什么、从哪里发起问题、模型使用了哪些来源。模型可以选择上下文和生成新的阅读版本，但原始对话与关系仍可追溯。结构可以自动形成，证据不应因此消失。",
      ],
    },
    {
      id: "cards",
      title: "Card 给局部问题一个可以返回的位置",
      paragraphs: [
        "如果图里的每一个节点都对应单条消息，结构很快就会比对话本身更难理解。更合适的单位是一段局部交流：一个来源问题、一段回答、若干本地 follow-up，以及回答里可以继续展开的 anchor。我们把这个单位称为 Card。",
        "Card 的正文仍然应该像普通 chat 一样从上到下阅读。它不需要额外的回答标题、暂时结论、继续阅读或摘要栏。节点标题可以在分叉时生成一次，作为导航元数据存在，但不必侵入对话。这样既保留交流的自然，也让一个局部问题拥有稳定的位置。",
        "Card 叠起来形成当前研究路径。新的 Card 覆盖在旧的 Card 上，表示从这里继续深入；关闭它，下面的上下文重新成为当前内容；摊开这叠 Card，则可以快速回到路径中的任意位置。空间关系只有在表达语义关系时才有价值。堆叠不是装饰，而是对当前路径的一种可操作表示。",
      ],
      quote: "Card 的价值不在于像纸，而在于让一个局部问题有地址。",
    },
    {
      id: "graph",
      title: "图谱负责方向与出处，不负责正文",
      paragraphs: [
        "当探索积累到一定规模，用户需要一个全局视角：我从哪里来到这里，还有哪些方向，两条看似独立的路径是否指向同一个事件。图在这些问题上比聊天记录更准确。它也允许多个分支汇合到同一个节点，因此长期研究通常更接近有向无环图（DAG），而不是不断复制内容的树。",
        "但图谱非常容易失控。节点多了以后，标题、连线和区域会争夺注意力；如果再让模型自动生成分区名称和分类体系，界面很快会出现一套并非来自真实交流的第二结构。图的目标不是把所有知识同时摆在屏幕上，而是帮助用户定位、回访和理解出处。",
        "因此图应该保持次要和克制。几何位置尽量稳定，节点标题只在需要时出现，放大只是 semantic zoom，而不是生成更多摘要。完整内容仍然留在 Card 中。图适合回答关系问题，不适合承载完整叙述。",
      ],
    },
    {
      id: "article",
      title: "为什么最后仍然需要一篇平铺文章",
      paragraphs: [
        "批评线性聊天，并不等于拒绝线性阅读。探索结构和阅读结构本来就不是同一个结构。研究过程可能从童年跳到公司治理，再回到技术路线；一篇好文章却需要按时间、主题或论证关系重新编排，让没有参与探索的人也能从头读懂。",
        "这也是为什么最终产物更接近 Wikipedia 式的平铺页面，而不是把图谱原样打印出来。文章可以综合多个 Card，一张 Card 也不必机械地对应一个章节。随着研究增加，系统重新编译当前版本，但读者始终看到一份完整成稿，而不是暂时结论、尚未完成或正在整理的内部状态。",
        "文章也不能覆盖原始研究。每个段落应保留到来源 Card 的连接，让读者能返回当时的问题、回答和上下文。这样，文章是一个适合阅读的投影，图谱是关系与出处的投影，Card 则保留交流本身。三种表示可以来自同一份研究，却不必争夺同一种形式。",
      ],
      quote: "非线性的生产过程，最终可以形成线性的阅读体验。",
    },
    {
      id: "knowledge",
      title: "知识管理应同时保留过程、结构与结果",
      paragraphs: [
        "传统 chat 擅长保存过程，但很难留下可复用的产物。传统笔记工具擅长保存结果，却经常要求用户在工作之外再做一次整理。更有意思的方向，是让自然发生的交流逐渐沉淀出三个彼此关联的表示：原始行为与对话、局部 Card 与探索 DAG、持续编译的平铺文章。",
        "底层可以是本地文件、Markdown 和类似双向链接的关系，也可以由不同的 agent harness 驱动。关键不是让用户直接操作文件系统，而是让这些文件成为可靠、可迁移的知识基底。界面负责探索与阅读，模型负责按需要加载相关上下文，文件则保留长期所有权。",
        "这也改变了所谓自动整理的含义。目标不再是把每次聊天切成一堆笔记，而是同时保留发生过的过程、问题之间的关系，以及一份能继续阅读和修改的综合结果。知识不必在对话结束后才被整理，它可以在交流进行时逐渐形成。",
      ],
    },
    {
      id: "limits",
      title: "图不是答案，它只是一个需要验证的界面假设",
      paragraphs: [
        "并不是每一次聊天都需要图，也不是分支越多越好。一个简单问题应该继续停留在简单对话里。只有当用户真的点击 anchor、选择文字或沿历史 Card 继续追问时，结构才应该生长。图应由实际行为形成，而不是为了显得聪明而预先生成。",
        "自动上下文管理也有风险。模型可能错误地判断两个概念相关，生成含混的节点标题，或在重写文章时过度压缩细节。产品需要明确的来源、可撤销的操作、稳定的历史，以及让用户看见当前上下文来自哪里的方式。没有这些约束，图只会把聊天里的混乱换一种形式保存。",
        "所以这不是一个已经被证明的终局，而是一组可以被测试的产品判断：用户是否更容易回到原来的问题，是否能理解 Card 堆叠与研究路径的关系，图谱在多大规模后开始失去价值，自动成稿是否真的减少整理负担。界面的质感重要，但最终仍要由这些问题来判断它是否成立。",
      ],
    },
  ],
  closingTitle: "让交流留下可以继续使用的东西",
  closing: [
    "一个更好的界面不需要要求用户像图一样思考。用户仍然可以像现在一样提问、追问、离开话题，再回到原来的问题。不同的是，产品记住了这些动作之间的关系。",
    "对话保留事情如何发生，Card 和图谱保留探索如何展开，文章则把已经获得的内容重新组织成可以阅读的整体。三者不必互相取代。",
    "或许知识管理真正需要自动化的，不是写下更多笔记，而是让一次普通交流结束之后，仍然留下清楚的结构和可继续使用的结果。",
  ],
  footerNote: "这篇文章来自 Lattice 交互原型的持续设计讨论。",
  diagramTitle: "从线性对话到 Card、关系图与平铺文章",
  diagramDescription:
    "左侧的时间线对话从一个选中片段分叉，中间形成 Card 与小型关系图，最后在右侧收束为连续文章。",
};

export const englishEssay: EssayContent = {
  language: "en",
  htmlLang: "en",
  kicker: "Lattice Notes 01",
  title: "A chat log is not a knowledge structure",
  subtitle:
    "On cards, graphs, and turning AI dialogue into durable knowledge.",
  published: "July 31, 2026",
  readingTime: "8 min read",
  intro: [
    "A research conversation often leaves its original path for a good reason. An unfamiliar term deserves a question. That answer reveals another connection. By the time the detour is resolved, the first line of inquiry is still somewhere above, buried in the transcript.",
    "Nothing is wrong with conversation being chronological. The problem is asking one timeline to serve as transcript, research structure, and finished document at the same time. It records what happened next. It does not necessarily preserve how the ideas relate.",
  ],
  triad: [
    {
      label: "Conversation",
      structure: "Happens in time",
      purpose: "Maintains immediate attention",
    },
    {
      label: "Cards and graph",
      structure: "Persist as relationships",
      purpose: "Preserve branches, paths, and sources",
    },
    {
      label: "Article",
      structure: "Takes an editorial form",
      purpose: "Becomes coherent enough to read",
    },
  ],
  contentsLabel: "In this note",
  languageLabel: "Language",
  chineseLabel: "中文",
  englishLabel: "English",
  demoLabel: "Open the interactive demo",
  sourceLabel: "View the source on GitHub",
  sections: [
    {
      id: "timeline",
      title: "The timeline is not the enemy",
      paragraphs: [
        "Linear chat has real advantages. It is immediately legible, keeps two participants focused on the same moment, and gives each response an obvious local context. For a short question, a chronological thread is usually the right interface.",
        "The trouble begins when inquiry branches. A reader pauses on a company, a technical term, or a background event, follows that question for a while, and then wants to return. Most chat products insert the detour permanently into the main transcript. The answer is useful, but the original line of inquiry loses its place.",
        "Search can recover a sentence. Scrolling can recover a time. Neither reliably recovers the role that a question played in the investigation. As a session grows, chronology becomes a weaker proxy for meaning. The interface has confused the order in which ideas appeared with the structure they eventually formed.",
      ],
      quote:
        "Chronology is a good record of interaction. It is not a complete model of knowledge.",
    },
    {
      id: "branching",
      title: "Branching should be a gesture, not a management task",
      paragraphs: [
        "A branch can begin with an ordinary action. The model marks a phrase that can be explored, and the user opens it. Or the user selects a passage and asks a question. That gesture already says enough: continue from here. The product can record a new node and its source without asking the user to create a folder, name a branch, or choose a parent.",
        "The same principle applies when the detour ends. People should not have to merge context by hand. The system can decide which material belongs in the next answer and which evidence should inform the reading view. Users need clear ways to return, close, revisit, and undo. They do not need the vocabulary of version control in the middle of a conversation.",
        "Automation still needs a stable substrate. User actions and source relationships should be appended, not silently rewritten. A model may compile a new article or select a relevant context window, while the original exchanges remain available for inspection. The graph is trustworthy only when its edges can be traced back to something that actually happened.",
      ],
    },
    {
      id: "cards",
      title: "A card gives local attention an address",
      paragraphs: [
        "Making every message a graph node would produce structure faster than understanding. A more useful unit is a bounded local exchange: one source question, its answer, a few follow-ups, and the anchors that can lead elsewhere. In Lattice, that unit is a Card.",
        "The Card should still read like chat. It does not need a summary header, a temporary conclusion, or a strip of suggested reading. A short title can be generated once when the branch is created and stored as navigation metadata. The conversation itself should remain natural.",
        "Cards also make a path spatial. A new Card sits above the context from which it opened. Closing it returns to the sheet underneath. Spreading the Deck exposes earlier positions in the current line of inquiry. The paper quality is not the point. The useful part is giving return, depth, and current path a consistent physical expression.",
      ],
      quote:
        "The Card matters because a local question becomes somewhere you can return to.",
    },
    {
      id: "graph",
      title: "The graph is for orientation and provenance",
      paragraphs: [
        "Once an investigation has several branches, a global view becomes valuable. Where did this idea come from? Which paths remain unexplored? Did two independent lines of inquiry converge on the same event? A graph can answer these questions more faithfully than a transcript.",
        "Convergence is one reason the structure is better described as a directed acyclic graph, or DAG, than a tree. Two branches may reach the same crisis, company, or interpretation. They should point to one shared node instead of duplicating the material and allowing two versions to drift apart.",
        "Graphs also fail quickly when asked to do too much. Permanent labels compete with edges. Automatic regions invent a taxonomy that the conversation never produced. Dense networks can offer the feeling of total knowledge while making every individual relationship harder to read. The graph should stay secondary, keep its geometry stable, and reveal labels or connections only when they help with orientation.",
        "Complete prose belongs in Cards and in the reading view. The graph is a map of relation and provenance, not another place to read the entire argument.",
      ],
    },
    {
      id: "article",
      title: "Reading needs a different projection",
      paragraphs: [
        "Rejecting a single chat timeline does not mean rejecting linear reading. The path taken during research and the order needed by a reader are different things. Inquiry may jump from childhood to corporate control and back to technical strategy. A good article must reorganize that material by chronology, theme, or argument.",
        "The final reading view should therefore look closer to a continuous reference article than to a printed graph. A section may synthesize several Cards. One Card does not need to become one heading. As research grows, the system can recompile the current edition, but the reader should always meet a complete document rather than internal labels such as unfinished, processing, or provisional conclusion.",
        "That article is not the new source of truth. Each passage should retain links to the Cards that informed it, allowing a reader to return to the original question and its context. The article is an editorial projection. The graph is a relational projection. The Cards preserve the conversation. Their value comes from coexisting.",
      ],
      quote:
        "A nonlinear process can still produce a deliberately linear reading experience.",
    },
    {
      id: "knowledge",
      title: "From session history to durable knowledge",
      paragraphs: [
        "Chat products preserve process but often leave little that can be reused. Note-taking products preserve outcomes but usually ask people to perform a second job after the real work is done. A better system could let ordinary conversation accumulate into three connected representations: the original actions and exchanges, local Cards and an exploration graph, and a continuously compiled article.",
        "The durable layer might be local Markdown, bidirectional links, or another portable file format. Different agent harnesses could operate on the same material. But the filesystem should be the substrate, not the interface. People should explore and read in a product designed for those activities, while retaining ownership of files that can outlive any one model or vendor.",
        "This changes what automatic organization means. The goal is not to split every conversation into a larger pile of notes. It is to preserve the process, the relationships, and a coherent result without requiring the user to rebuild those connections after the session ends.",
      ],
    },
    {
      id: "limits",
      title: "A useful hypothesis, with limits",
      paragraphs: [
        "Not every chat needs a graph. A simple question should remain simple. Structure should grow only when a person opens an anchor, selects a passage, revisits a historical Card, or otherwise makes a relationship meaningful through action. A graph generated in advance for visual effect is just another form of clutter.",
        "Automatic context management can also be wrong. Models may infer a false relationship, produce a vague node title, or compress away an important qualification while rewriting the article. Provenance, undo, stable history, and a visible account of current context are product requirements, not implementation details.",
        "This leaves a set of hypotheses to test. Do people return to the original question more reliably? Does a Deck feel like a path rather than an animation? At what scale does the graph stop helping? Does the compiled article reduce real organization work? Visual polish matters, but these are the questions that determine whether the interface earns its complexity.",
      ],
    },
  ],
  closingTitle: "Let conversation leave something worth returning to",
  closing: [
    "A better interface does not ask people to think in graphs. They should still be able to ask, follow up, wander, and return without maintaining a structure by hand.",
    "The conversation can preserve what happened. Cards and the graph can preserve how the inquiry unfolded. The article can turn the accumulated material into something coherent enough to read and reuse. None of these views needs to replace the others.",
    "The useful promise of AI knowledge tools may be less about generating more notes, and more about letting an ordinary exchange leave behind a structure and a result worth continuing.",
  ],
  footerNote:
    "This essay grew out of the ongoing interaction design work behind the Lattice prototype.",
  diagramTitle: "From linear conversation to Cards, a graph, and a flat article",
  diagramDescription:
    "A chronological conversation branches from one selected phrase, becomes a small Card graph, and converges into a continuous article.",
};
