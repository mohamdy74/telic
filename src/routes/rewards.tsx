import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/app/PagePlaceholder";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards — Grove" },
      { name: "description", content: "Earn XP, level up and unlock rewards for meaningful progress." },
      { property: "og:title", content: "Rewards — Grove" },
      { property: "og:description", content: "Earn XP, level up and unlock rewards for meaningful progress." },
    ],
  }),
  component: Page,
});

function Page() {
  return <PagePlaceholder page="rewards" />;
}
