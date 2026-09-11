import { createFileRoute } from "@tanstack/react-router";
import { ProgressView } from "@/components/progress/progress-view";

export const Route = createFileRoute("/progress")({
  component: ProgressView,
});
