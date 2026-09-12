import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardView,
});
