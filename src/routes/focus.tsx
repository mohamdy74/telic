import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/app/PagePlaceholder";

export const Route = createFileRoute("/focus")({
  head: () => ({
    meta: [
      { title: "Focus — Tilth" },
      { name: "description", content: "Pomodoro and custom focus sessions with breaks and daily targets." },
      { property: "og:title", content: "Focus — Tilth" },
      { property: "og:description", content: "Pomodoro and custom focus sessions with breaks and daily targets." },
    ],
  }),
  component: Page,
});

function Page() {
  return <PagePlaceholder page="focus" />;
}
