"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import type { EssayLanguage } from "@/app/content/beyond-linear-chat";
import styles from "@/app/components/essay/EssayPage.module.css";

export function EssayThemeToggle({
  language,
}: {
  language: EssayLanguage;
}) {
  function toggleTheme() {
    const currentTheme =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.dataset.themeTransition = "true";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("lattice-theme", nextTheme);
    window.setTimeout(() => {
      delete document.documentElement.dataset.themeTransition;
    }, 300);
  }

  const label =
    language === "zh" ? "切换明暗主题" : "Toggle color theme";

  return (
    <button
      type="button"
      className={styles.themeButton}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <Moon
        className={styles.themeLightIcon}
        size={17}
        aria-hidden="true"
      />
      <Sun
        className={styles.themeDarkIcon}
        size={17}
        aria-hidden="true"
      />
    </button>
  );
}
