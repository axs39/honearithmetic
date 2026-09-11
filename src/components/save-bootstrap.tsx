import { useEffect, useRef } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isIntroDone, readTraineeName } from "@/lib/game/trainee";
import { useGameStore } from "@/lib/game/store";

function pushCloud(
  user: { displayName?: string | null } | null,
  exportJson: () => string,
) {
  if (!user) return;
  void import("@/lib/game/profile")
    .then(({ saveProfile }) =>
      saveProfile({
        data: {
          saveJson: exportJson(),
          username: readTraineeName() || user.displayName || undefined,
          onboarded: isIntroDone(),
        },
      }),
    )
    .catch(() => {});
}

export function SaveBootstrap() {
  const persist = useGameStore((s) => s.persist);
  const exportJson = useGameStore((s) => s.exportJson);
  const sessions = useGameStore((s) => s.sessions);
  const { user, isPending } = useCurrentUserState();
  const remoteReady = useRef(true);
  const signedIn = Boolean(user && !user.isDevFallback);

  useEffect(() => {
    const flush = () => {
      persist();
      if (signedIn) pushCloud(user, exportJson);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [persist, exportJson, user, signedIn]);

  useEffect(() => {
    persist();
    if (isPending || !remoteReady.current || !signedIn) return;
    pushCloud(user, exportJson);
  }, [sessions.length, user, signedIn, isPending, exportJson, persist]);

  return null;
}
