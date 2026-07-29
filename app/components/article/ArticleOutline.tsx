import type { ArticleSection } from "@/app/lib/article-research";

type ArticleOutlineProps = {
  sections: ArticleSection[];
  selectedSectionId: string;
  sourceCount: number;
  onFocusSection: (section: ArticleSection) => void;
};

export function ArticleOutline({
  sections,
  selectedSectionId,
  sourceCount,
  onFocusSection,
}: ArticleOutlineProps) {
  return (
    <aside className="article-outline" aria-label="文章目录">
      <div className="outline-heading">
        <span>目录</span>
        <i>{sections.length.toString().padStart(2, "0")}</i>
      </div>
      <nav>
        {sections.map((section, index) => (
          <button
            type="button"
            key={section.id}
            className={
              selectedSectionId === section.id ? "outline-active" : ""
            }
            onClick={() => onFocusSection(section)}
            aria-current={
              selectedSectionId === section.id ? "location" : undefined
            }
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {section.title}
          </button>
        ))}
      </nav>
      <div className="outline-sync-state">
        <span className="sync-pulse" aria-hidden="true" />
        <div>
          <strong>随研究同步</strong>
          <span>{sourceCount} 张来源 Card 已编入当前版本</span>
        </div>
      </div>
    </aside>
  );
}
