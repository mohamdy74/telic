import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/app/PagePlaceholder";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Grove" },
      { name: "description", content: "Your daily dashboard: priorities, habits, focus and progress in one calm view." },
      { property: "og:title", content: "Today — Grove" },
      { property: "og:description", content: "Your daily dashboard: priorities, habits, focus and progress in one calm view." },
    ],
  }),
  component: Page,
});

function Page() {
  return <PagePlaceholder page="dashboard" />;
}
