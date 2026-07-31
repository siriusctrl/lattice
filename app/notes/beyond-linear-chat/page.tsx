import type { Metadata } from "next";
import { EssayShell } from "@/app/components/essay/EssayShell";
import { chineseEssay } from "@/app/content/beyond-linear-chat";
import {
  essayPaths,
  toAbsoluteSiteUrl,
} from "@/app/lib/site-paths";

export const dynamic = "force-static";

const canonical = toAbsoluteSiteUrl(essayPaths.zh);
const englishUrl = toAbsoluteSiteUrl(essayPaths.en);
const imageUrl = toAbsoluteSiteUrl("/beyond-linear-chat.png");

export const metadata: Metadata = {
  title: `${chineseEssay.title} | Lattice`,
  description: chineseEssay.subtitle,
  alternates: {
    canonical,
    languages: {
      "zh-CN": canonical,
      en: englishUrl,
      "x-default": canonical,
    },
  },
  openGraph: {
    type: "article",
    locale: "zh_CN",
    alternateLocale: ["en_US"],
    url: canonical,
    title: chineseEssay.title,
    description: chineseEssay.subtitle,
    publishedTime: "2026-07-31T00:00:00+08:00",
    images: [
      {
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: chineseEssay.diagramTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: chineseEssay.title,
    description: chineseEssay.subtitle,
    images: [imageUrl],
  },
};

export default function BeyondLinearChatChinesePage() {
  return <EssayShell content={chineseEssay} />;
}
