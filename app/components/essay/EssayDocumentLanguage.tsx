"use client";

import { useEffect } from "react";
import type { EssayContent } from "@/app/content/beyond-linear-chat";

export function EssayDocumentLanguage({
  language,
}: {
  language: EssayContent["htmlLang"];
}) {
  useEffect(() => {
    const root = document.documentElement;
    const previousLanguage = root.lang;
    root.lang = language;

    return () => {
      root.lang = previousLanguage;
    };
  }, [language]);

  return null;
}
