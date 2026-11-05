import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/app/PagePlaceholder";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Grove" },
      { name: "description", content: "Clear weekly and monthly trends across tasks, habits and focus." },
      { property: "og:title", content: "Insights — Grove" },
      { property: "og:description", content: "Clear weekly and monthly trends across tasks, habits and focus." },
    ],
  }),
  component: Page,
});

function Page() {
  return <PagePlaceholder page="insights" />;
}
