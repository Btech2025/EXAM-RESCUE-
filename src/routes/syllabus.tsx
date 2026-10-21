import { createFileRoute } from "@tanstack/react-router";
import { ExamIntelligence } from "@/components/app/ExamIntelligence";
export const Route = createFileRoute("/syllabus")({
  head: () => ({
    meta: [
      { title: "Syllabus Analyzer — Exam Rescue" },
      {
        name: "description",
        content:
          "Privately review syllabus PDFs, units and topics, then build an evidence-based preparation strategy.",
      },
      { property: "og:title", content: "Syllabus Analyzer — Exam Rescue" },
      {
        property: "og:description",
        content:
          "Review your syllabus and prioritize preparation within your available study hours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ExamIntelligence />,
});
