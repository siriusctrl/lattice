import type { EssayContent } from "@/app/content/beyond-linear-chat";
import styles from "@/app/components/essay/EssayPage.module.css";

type ConversationShapeHeroProps = Pick<
  EssayContent,
  "diagramTitle" | "diagramDescription" | "language"
>;

export function ConversationShapeHero({
  diagramTitle,
  diagramDescription,
  language,
}: ConversationShapeHeroProps) {
  const desktopTitleId = `essay-diagram-title-${language}-desktop`;
  const desktopDescriptionId = `essay-diagram-description-${language}-desktop`;
  const mobileTitleId = `essay-diagram-title-${language}-mobile`;
  const mobileDescriptionId = `essay-diagram-description-${language}-mobile`;

  return (
    <figure className={styles.heroFigure}>
      <svg
        className={`${styles.diagram} ${styles.diagramDesktop}`}
        data-testid="essay-diagram-desktop"
        viewBox="0 0 1200 420"
        role="img"
        aria-labelledby={`${desktopTitleId} ${desktopDescriptionId}`}
      >
        <title id={desktopTitleId}>{diagramTitle}</title>
        <desc id={desktopDescriptionId}>{diagramDescription}</desc>

        <g className={styles.diagramQuiet}>
          <path d="M92 69V345" />
          <circle cx="92" cy="78" r="5" />
          <circle cx="92" cy="143" r="5" />
          <circle cx="92" cy="219" r="5" />
          <circle cx="92" cy="298" r="5" />
          <path d="M118 70H248" />
          <path d="M118 84H212" />
          <path d="M118 135H276" />
          <path d="M118 149H234" />
          <path d="M118 211H258" />
          <path d="M118 225H198" />
          <path d="M118 290H230" />
          <path d="M118 304H266" />
        </g>

        <path className={styles.diagramAccent} d="M177 231H258" />
        <path
          className={styles.diagramLine}
          d="M258 231C308 231 311 190 356 190"
        />

        <g className={styles.diagramLine}>
          <rect x="332" y="125" width="292" height="214" rx="22" />
          <rect x="350" y="108" width="292" height="214" rx="22" />
          <rect x="368" y="91" width="292" height="214" rx="22" />
          <path d="M401 128H538" />
          <path d="M401 148H580" />
          <path d="M401 194H608" />
          <path d="M401 214H558" />
          <path d="M401 260H518" />
        </g>

        <circle className={styles.diagramAccentFill} cx="603" cy="194" r="6" />
        <g className={styles.diagramLine}>
          <path d="M603 194C674 194 671 104 746 104" />
          <path d="M603 194C674 194 693 188 774 188" />
          <path d="M518 260C626 260 650 302 742 302" />
          <path d="M746 104C803 104 810 164 855 188" />
          <path d="M774 188H855" />
          <path d="M742 302C804 302 810 220 855 188" />
          <circle cx="746" cy="104" r="7" />
          <circle cx="774" cy="188" r="7" />
          <circle cx="742" cy="302" r="7" />
          <circle cx="855" cy="188" r="8" />
          <path d="M863 188C902 188 905 160 936 160" />
          <path d="M936 104V319" />
          <path d="M968 119H1101" />
          <path d="M968 139H1062" />
          <path d="M968 184H1110" />
          <path d="M968 204H1088" />
          <path d="M968 224H1038" />
          <path d="M968 269H1092" />
          <path d="M968 289H1068" />
        </g>
        <path className={styles.diagramAccent} d="M936 104V151" />
      </svg>

      <svg
        className={`${styles.diagram} ${styles.diagramMobile}`}
        data-testid="essay-diagram-mobile"
        viewBox="0 0 360 430"
        role="img"
        aria-labelledby={`${mobileTitleId} ${mobileDescriptionId}`}
      >
        <title id={mobileTitleId}>{diagramTitle}</title>
        <desc id={mobileDescriptionId}>{diagramDescription}</desc>

        <g className={styles.diagramQuiet}>
          <path d="M44 34V124" />
          <circle cx="44" cy="42" r="4" />
          <circle cx="44" cy="80" r="4" />
          <circle cx="44" cy="118" r="4" />
          <path d="M62 36H175" />
          <path d="M62 48H139" />
          <path d="M62 74H201" />
          <path d="M62 86H156" />
          <path d="M62 112H181" />
        </g>
        <path className={styles.diagramAccent} d="M119 123H181" />
        <path
          className={styles.diagramLine}
          d="M181 123C181 148 153 146 153 169"
        />

        <g className={styles.diagramLine}>
          <rect x="83" y="177" width="194" height="125" rx="17" />
          <rect x="94" y="166" width="194" height="125" rx="17" />
          <rect x="105" y="155" width="194" height="125" rx="17" />
          <path d="M128 184H213" />
          <path d="M128 198H248" />
          <path d="M128 226H258" />
          <path d="M128 240H220" />
          <path d="M258 226C299 226 297 194 322 194" />
          <path d="M258 226C300 226 300 258 324 258" />
          <path d="M322 194C340 194 340 226 345 226" />
          <path d="M324 258C340 258 340 232 345 226" />
          <circle cx="322" cy="194" r="5" />
          <circle cx="324" cy="258" r="5" />
          <circle cx="345" cy="226" r="6" />
        </g>
        <circle className={styles.diagramAccentFill} cx="258" cy="226" r="5" />
        <path
          className={styles.diagramLine}
          d="M345 226C345 315 215 302 184 326"
        />
        <g className={styles.diagramLine}>
          <path d="M57 326V407" />
          <path d="M78 337H265" />
          <path d="M78 351H232" />
          <path d="M78 374H276" />
          <path d="M78 388H244" />
          <path d="M78 402H207" />
        </g>
        <path className={styles.diagramAccent} d="M57 326V349" />
      </svg>
    </figure>
  );
}
