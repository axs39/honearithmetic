import { createFileRoute } from "@tanstack/react-router";
import { PlayView } from "@/components/game/play-view";

export const Route = createFileRoute("/play")({
  component: PlayView,
});
