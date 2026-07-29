import {
  ArrowSquareOut,
  CardsThree,
  LinkSimple,
} from "@phosphor-icons/react";
import type { ArticleSection } from "@/app/lib/article-research";
import type { ResearchNode } from "@/app/lib/mock-research";

type ArticleSourcesProps = {
  nodes: Record<string, ResearchNode>;
  section: ArticleSection | undefined;
  onOpenSource: (nodeId: string) => void;
};

export function ArticleSources({
  nodes,
  section,
  onOpenSource,
}: ArticleSourcesProps) {
  const sources =
    section?.sourceIds
      .map((id) => nodes[id])
      .filter((node): node is ResearchNode => Boolean(node)) ?? [];

  return (
    <aside
      className="article-sources"
      aria-label="当前段落来源"
      data-testid="article-sources"
    >
      <header>
        <div>
          <LinkSimple size={15} weight="bold" aria-hidden="true" />
          <span>段落来源</span>
        </div>
        <span>{sources.length.toString().padStart(2, "0")}</span>
      </header>

      {section ? (
        <>
          <div className="source-section-title">
            <span>{section.eyebrow}</span>
            <strong>{section.title}</strong>
          </div>
          <div className="source-list">
            {sources.map((node) => (
              <button
                type="button"
                key={node.id}
                data-source-node={node.id}
                onClick={() => onOpenSource(node.id)}
              >
                <span className="source-card-icon" aria-hidden="true">
                  <CardsThree size={15} weight="fill" />
                </span>
                <span className="source-card-copy">
                  <i>{node.year}</i>
                  <strong>{node.shortTitle}</strong>
                  <small>{node.lead}</small>
                </span>
                <ArrowSquareOut size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        </>
      ) : null}

      <footer>
        <span>每一段都保留对话出处</span>
        <p>点击来源即可回到原始 Card，并恢复创建这段内容时的研究上下文。</p>
      </footer>
    </aside>
  );
}
