import { createFileRoute } from "@tanstack/react-router";
import { ExamIntelligence } from "@/components/app/ExamIntelligence";
export const Route = createFileRoute("/pyq")({
  head: () => ({
    meta: [
      { title: "PYQ Research — Exam Rescue" },
      {
        name: "description",
        content:
          "Review real question papers, original sources and topic evidence without fabricated exam statistics.",
      },
      { property: "og:title", content: "PYQ Research — Exam Rescue" },
      {
        property: "og:description",
        content:
          "Verify question paper evidence and review transparent, provisional topic priorities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ExamIntelligence research />,
});
