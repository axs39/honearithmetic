import { redirect } from "@tanstack/react-router";

export function requireSession({
  context,
}: {
  context: { sessionUser: { id: string; email: string | null } | null };
}) {
  if (!context.sessionUser) {
    throw redirect({ to: "/login" });
  }
}
