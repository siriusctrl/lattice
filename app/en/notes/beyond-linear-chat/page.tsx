import type { Metadata } from "next";
import { EssayShell } from "@/app/components/essay/EssayShell";
import { englishEssay } from "@/app/content/beyond-linear-chat";
import {
  essayPaths,
  toAbsoluteSiteUrl,
} from "@/app/lib/site-paths";

export const dynamic = "force-static";

const canonical = toAbsoluteSiteUrl(essayPaths.en);
const chineseUrl = toAbsoluteSiteUrl(essayPaths.zh);
const imageUrl = toAbsoluteSiteUrl("/beyond-linear-chat.png");

export const metadata: Metadata = {
  title: `${englishEssay.title} | Lattice`,
  description: englishEssay.subtitle,
  alternates: {
    canonical,
    languages: {
      "zh-CN": chineseUrl,
      en: canonical,
      "x-default": chineseUrl,
    },
  },
  openGraph: {
    type: "article",
    locale: "en_US",
    alternateLocale: ["zh_CN"],
    url: canonical,
    title: englishEssay.title,
    description: englishEssay.subtitle,
    publishedTime: "2026-07-31T00:00:00+08:00",
    images: [
      {
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: englishEssay.diagramTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: englishEssay.title,
    description: englishEssay.subtitle,
    images: [imageUrl],
  },
};

export default function BeyondLinearChatEnglishPage() {
  return <EssayShell content={englishEssay} />;
}
