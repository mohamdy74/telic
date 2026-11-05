import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/app/PagePlaceholder";

export const Route = createFileRoute("/habits")({
  head: () => ({
    meta: [
      { title: "Habits — Grove" },
      { name: "description", content: "Build steady habits with flexible schedules and forgiving streaks." },
      { property: "og:title", content: "Habits — Grove" },
      { property: "og:description", content: "Build steady habits with flexible schedules and forgiving streaks." },
    ],
  }),
  component: Page,
});

function Page() {
  return <PagePlaceholder page="habits" />;
}
