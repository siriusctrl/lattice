import type { Metadata } from "next";
import { ResearchWorkspace } from "@/app/components/ResearchWorkspace";

export const metadata: Metadata = {
  title: "Lattice - Graph-native AI research",
  description:
    "A tactile prototype for branching AI research with stacked cards and a live graph.",
};

export default function Home() {
  return <ResearchWorkspace />;
}
