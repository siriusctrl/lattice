import { Article as ArticleIcon, LinkSimple } from "@phosphor-icons/react";
import { motion } from "motion/react";
import type { ArticleSection } from "@/app/lib/article-research";

type ArticlePaperProps = {
  sections: ArticleSection[];
  sourceCount: number;
  reduceMotion: boolean;
  onInspectSection: (sectionId: string) => void;
};

export function ArticlePaper({
  sections,
  sourceCount,
  reduceMotion,
  onInspectSection,
}: ArticlePaperProps) {
  const characterCount = sections.reduce(
    (total, section) =>
      total +
      section.title.length +
      section.paragraphs.reduce(
        (sectionTotal, paragraph) => sectionTotal + paragraph.length,
        0,
      ),
    0,
  );
  const roundedCharacterCount = Math.max(
    800,
    Math.round(characterCount / 100) * 100,
  );

  return (
    <div className="article-scroll">
      <article className="wiki-paper">
        <header className="wiki-hero">
          <div className="wiki-kicker">
            <ArticleIcon size={15} weight="fill" aria-hidden="true" />
            <span>人物研究</span>
            <i>随探索实时重写</i>
          </div>
          <h1>埃隆·马斯克</h1>
          <p className="wiki-dek">
            从互联网创业到火箭、电动车、信息平台与人工智能，理解一套不断扩大系统边界的职业方法。
          </p>
          <dl className="wiki-stats">
            <div>
              <dt>章节</dt>
              <dd>{sections.length}</dd>
            </div>
            <div>
              <dt>来源 Card</dt>
              <dd>{sourceCount}</dd>
            </div>
            <div>
              <dt>当前篇幅</dt>
              <dd>约 {roundedCharacterCount} 字</dd>
            </div>
            <div>
              <dt>更新方式</dt>
              <dd>随研究实时重写</dd>
            </div>
          </dl>
        </header>

        <div className="wiki-body">
          {sections.map((section, sectionIndex) => (
            <motion.section
              id={`article-section-${section.id}`}
              data-testid={`article-section-${section.id}`}
              className="wiki-section"
              key={section.id}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: Math.min(sectionIndex * 0.035, 0.18),
                duration: 0.32,
              }}
              onMouseEnter={() => onInspectSection(section.id)}
            >
              <div className="wiki-section-heading">
                <div>
                  <span className="wiki-section-eyebrow">
                    {section.eyebrow}
                  </span>
                  <h2>{section.title}</h2>
                </div>
                <button
                  type="button"
                  className="wiki-source-count"
                  onClick={() => onInspectSection(section.id)}
                  aria-label={`查看“${section.title}”的来源 Card`}
                >
                  <LinkSimple size={12} weight="bold" />
                  {section.sourceIds.length} 个来源
                </button>
              </div>
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={`${section.id}-${paragraphIndex}`}>
                  {paragraph}
                  {paragraphIndex === section.paragraphs.length - 1 &&
                  section.sourceIds.length > 0 ? (
                    <button
                      type="button"
                      className="wiki-citation"
                      onClick={() => onInspectSection(section.id)}
                      aria-label={`查看“${section.title}”的出处`}
                    >
                      [{sectionIndex + 1}]
                    </button>
                  ) : null}
                </p>
              ))}
            </motion.section>
          ))}
        </div>
      </article>
    </div>
  );
}
