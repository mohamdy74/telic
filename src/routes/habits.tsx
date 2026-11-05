import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/app/PagePlaceholder";

export const Route = createFileRoute("/habits")({
  head: () => ({
    meta: [
      { title: "Habits — Tilth" },
      { name: "description", content: "Build steady habits with flexible schedules and forgiving streaks." },
      { property: "og:title", content: "Habits — Tilth" },
      { property: "og:description", content: "Build steady habits with flexible schedules and forgiving streaks." },
    ],
  }),
  component: Page,
});

function Page() {
  return <PagePlaceholder page="habits" />;
}
