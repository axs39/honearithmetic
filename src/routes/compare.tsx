import { createFileRoute } from "@tanstack/react-router";
import { CompareView } from "@/components/compare/compare-view";

export const Route = createFileRoute("/compare")({
  component: CompareView,
});
