import { createFileRoute } from "@tanstack/react-router";
import { HubView } from "@/components/hub/hub-view";
import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <AppShell>
      <HubView />
    </AppShell>
  );
}
