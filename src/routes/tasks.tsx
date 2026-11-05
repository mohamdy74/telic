import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/app/PagePlaceholder";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Tilth" },
      { name: "description", content: "Capture, prioritize and finish tasks with Today, Upcoming and Kanban views." },
      { property: "og:title", content: "Tasks — Tilth" },
      { property: "og:description", content: "Capture, prioritize and finish tasks with Today, Upcoming and Kanban views." },
    ],
  }),
  component: Page,
});

function Page() {
  return <PagePlaceholder page="tasks" />;
}
