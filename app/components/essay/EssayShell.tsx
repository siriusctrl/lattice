import Link from "next/link";
import { ConversationShapeHero } from "@/app/components/essay/ConversationShapeHero";
import { EssayDocumentLanguage } from "@/app/components/essay/EssayDocumentLanguage";
import { EssayThemeToggle } from "@/app/components/essay/EssayThemeToggle";
import styles from "@/app/components/essay/EssayPage.module.css";
import type { EssayContent } from "@/app/content/beyond-linear-chat";
import { essayPaths, toSitePath } from "@/app/lib/site-paths";

export function EssayShell({ content }: { content: EssayContent }) {
  const chineseHref = toSitePath(essayPaths.zh);
  const englishHref = toSitePath(essayPaths.en);
  const demoHref = toSitePath("/");

  return (
    <div className={styles.shell} data-testid="essay-shell">
      <EssayDocumentLanguage language={content.htmlLang} />
      <a className={styles.skipLink} href="#essay-main">
        {content.language === "zh" ? "跳到正文" : "Skip to the essay"}
      </a>

      <header className={styles.masthead}>
        <Link className={styles.brandLink} href={demoHref} aria-label="Lattice">
          <span className={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 32 32" width="19" height="19">
              <path d="M7 10.6 16 6l9 4.6-9 4.7-9-4.7Z" fill="currentColor" />
              <path
                d="m7 15.4 9 4.7 9-4.7M7 20.2l9 4.7 9-4.7"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
              />
            </svg>
          </span>
          <span>Lattice</span>
        </Link>

        <div className={styles.mastheadActions}>
          <nav
            className={styles.languageSwitch}
            aria-label={content.languageLabel}
          >
            <Link
              href={chineseHref}
              lang="zh-CN"
              aria-current={content.language === "zh" ? "page" : undefined}
            >
              {content.chineseLabel}
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              href={englishHref}
              lang="en"
              aria-current={content.language === "en" ? "page" : undefined}
            >
              {content.englishLabel}
            </Link>
          </nav>
          <EssayThemeToggle language={content.language} />
        </div>
      </header>

      <main id="essay-main">
        <article className={styles.essay} lang={content.htmlLang}>
          <header className={styles.hero}>
            <div className={styles.heroMeta}>
              <span>{content.kicker}</span>
              <span>
                {content.published} · {content.readingTime}
              </span>
            </div>
            <h1>{content.title}</h1>
            <p className={styles.subtitle}>{content.subtitle}</p>
            <ConversationShapeHero
              language={content.language}
              diagramTitle={content.diagramTitle}
              diagramDescription={content.diagramDescription}
            />
            <div className={styles.introduction}>
              {content.intro.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </header>

          <div className={styles.triad} aria-label={content.diagramTitle}>
            {content.triad.map((item, index) => (
              <div key={item.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.label}</strong>
                <p>{item.structure}</p>
                <small>{item.purpose}</small>
              </div>
            ))}
          </div>

          <div className={styles.readingGrid}>
            <aside className={styles.contents}>
              <span>{content.contentsLabel}</span>
              <nav aria-label={content.contentsLabel}>
                {content.sections.map((section, index) => (
                  <a href={`#${section.id}`} key={section.id}>
                    <i>{String(index + 1).padStart(2, "0")}</i>
                    {section.title}
                  </a>
                ))}
              </nav>
            </aside>

            <div className={styles.body}>
              {content.sections.map((section, index) => (
                <section
                  id={section.id}
                  className={styles.section}
                  key={section.id}
                >
                  <div className={styles.sectionHeading}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h2>{section.title}</h2>
                  </div>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.quote ? (
                    <blockquote>{section.quote}</blockquote>
                  ) : null}
                </section>
              ))}

              <section className={`${styles.section} ${styles.closing}`}>
                <div className={styles.sectionHeading}>
                  <span>→</span>
                  <h2>{content.closingTitle}</h2>
                </div>
                {content.closing.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            </div>
          </div>
        </article>
      </main>

      <footer className={styles.footer} lang={content.htmlLang}>
        <p>{content.footerNote}</p>
        <div>
          <Link href={demoHref}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                d="M19 12H5m6-6-6 6 6 6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            {content.demoLabel}
          </Link>
          <a href="https://github.com/siriusctrl/lattice">
            {content.sourceLabel}
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M7 17 17 7m-8 0h8v8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
}
