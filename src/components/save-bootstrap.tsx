import { useEffect, useRef, useSyncExternalStore } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  isCloudHydrated,
  subscribeCloudHydrated,
} from "@/lib/game/persist";
import {
  isIntroDone,
  readPendingDisplayName,
  readTraineeName,
} from "@/lib/game/trainee";
import { useGameStore } from "@/lib/game/store";
import { pushLeaderboardScoresOnce } from "@/lib/game/sync-social";

function pushCloud(user: { displayName?: string | null } | null) {
  if (!user) return;
  void import("@/lib/game/cloud-save")
    .then(({ enqueueCloudSave }) =>
      enqueueCloudSave(async () => {
        const { saveProfile } = await import("@/lib/game/profile");
        // Re-read store at flush time so queued saves get the latest sessions.
        const { useGameStore } = await import("@/lib/game/store");
        return saveProfile({
          data: {
            saveJson: useGameStore.getState().exportJson(),
            username: readTraineeName() || user.displayName || undefined,
            displayName: readPendingDisplayName() || undefined,
            onboarded: isIntroDone(),
          },
        });
      }),
    )
    .catch(() => {});
}

export function SaveBootstrap() {
  const persist = useGameStore((s) => s.persist);
  const exportJson = useGameStore((s) => s.exportJson);
  const sessions = useGameStore((s) => s.sessions);
  const hydrated = useGameStore((s) => s.hydrated);
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const cloudReady = useSyncExternalStore(
    subscribeCloudHydrated,
    isCloudHydrated,
    () => false,
  );
  const lastPushedLen = useRef<number | null>(null);

  useEffect(() => {
    if (!cloudReady) lastPushedLen.current = null;
  }, [cloudReady]);

  useEffect(() => {
    const flush = () => {
      persist();
      if (signedIn && isCloudHydrated()) pushCloud(user);
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
    if (isPending || !signedIn || !hydrated || !cloudReady) return;
    // Skip duplicate pushes for the same length unless this is the first
    // post-hydrate flush (lastPushedLen null → always push merged state).
    if (
      lastPushedLen.current !== null &&
      lastPushedLen.current === sessions.length
    ) {
      return;
    }
    lastPushedLen.current = sessions.length;
    pushCloud(user);
    pushLeaderboardScoresOnce();
  }, [
    sessions.length,
    user,
    signedIn,
    isPending,
    hydrated,
    cloudReady,
    exportJson,
    persist,
  ]);

  return null;
}
