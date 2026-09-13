import { useEffect, useRef, type ReactNode } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  isForceGuest,
  stripGuestQuery,
} from "@/lib/game/identity";
import {
  isCloudHydrated,
  kvClearScope,
  kvReadScope,
  markCloudHydrated,
  markKvScopeReady,
  resetCloudHydrated,
  setKvScope,
  wipeLegacyUnscoped,
} from "@/lib/game/persist";
import {
  completeIntro,
  notifyIntro,
  readPendingDisplayName,
  readTraineeName,
  writeTraineeName,
} from "@/lib/game/trainee";
import { parseImported } from "@/lib/game/storage";
import { useGameStore } from "@/lib/game/store";

function adoptGuestIntoAccount() {
  const guest = kvReadScope("guest");
  const name = (guest["hone.traineeName"] ?? "").trim();
  const intro = guest["hone.introDone"] === "1";
  let save = null;
  try {
    const raw = guest["hone.save.v1"];
    if (raw) save = parseImported(raw);
  } catch {
    save = null;
  }
  kvClearScope("guest");
  return { name, intro, save };
}

function applyGuest() {
  wipeLegacyUnscoped();
  setKvScope("guest");
  markKvScopeReady();
  markCloudHydrated();
  notifyIntro();
}

export function SessionBoot({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrateRemote = useGameStore((s) => s.hydrateRemote);
  const signedIn = Boolean(user && !user.isDevFallback);
  const userId = signedIn ? user?.id ?? null : null;
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    wipeLegacyUnscoped();

    if (isForceGuest()) {
      stripGuestQuery();
      if (lastId.current !== "guest") {
        lastId.current = "guest";
        applyGuest();
        hydrate(true);
      }
      return;
    }

    if (isPending && !userId) return;

    if (!userId) {
      if (lastId.current !== "guest") {
        lastId.current = "guest";
        applyGuest();
        hydrate(true);
      }
      return;
    }

    const scopeChanged = lastId.current !== userId;
    let guest = { name: "", intro: false, save: null as ReturnType<typeof adoptGuestIntoAccount>["save"] };
    if (scopeChanged) {
      lastId.current = userId;
      resetCloudHydrated();
      guest = adoptGuestIntoAccount();
      setKvScope(`u:${userId}`);
      markKvScopeReady();
      if (guest.name) writeTraineeName(guest.name);
      if (guest.intro) completeIntro(guest.name || readTraineeName());
      else notifyIntro();
      hydrate(true);
      if (guest.save && guest.save.sessions.length > 0) {
        hydrateRemote(guest.save);
      }
    } else if (isCloudHydrated()) {
      // Same user, profile already loaded (skip re-fetch on displayName churn).
      return;
    }
    // else: Strict Mode remount after cancelled first fetch — load profile again.

    let cancelled = false;
    const t = window.setTimeout(() => {
      if (!cancelled) notifyIntro();
    }, 4000);

    const sessionsWhenFetchBegan = useGameStore.getState().sessions.length;
    const guestName = guest.name;
    const guestIntro = guest.intro;
    void import("@/lib/game/profile")
      .then(({ loadProfile }) => loadProfile())
      .then((row) => {
        if (cancelled) return;
        const name =
          row?.username ||
          guestName ||
          readTraineeName() ||
          user?.displayName ||
          "";
        if (name) writeTraineeName(name);
        if (row?.onboarded || guestIntro) completeIntro(name);
        if (row?.save && row.save.sessions.length > 0) {
          // Local may have grown while the profile request was in flight.
          hydrateRemote(row.save);
          const after = useGameStore.getState().sessions.length;
          if (after < sessionsWhenFetchBegan) {
            // Should be impossible after merge — re-persist current store.
            useGameStore.getState().persist();
          }
        }
        void import("@/lib/game/sync-social").then(({ pushLeaderboardScoresOnce }) =>
          pushLeaderboardScoresOnce(),
        );
        const pendingDn = readPendingDisplayName();
        if (pendingDn) {
          void import("@/lib/game/leaderboard")
            .then(async ({ setDisplayName, getSocialStatus }) => {
              const { clientTimeZone } = await import("@/lib/game/sync-social");
              const s = await getSocialStatus({
                data: { timeZone: clientTimeZone() },
              });
              if (s.needsDisplayName) {
                return setDisplayName({ data: { displayName: pendingDn } });
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (guestIntro || guestName) completeIntro(guestName);
      })
      .finally(() => {
        window.clearTimeout(t);
        // Allow SaveBootstrap cloud pushes only after first profile attempt.
        if (!cancelled) markCloudHydrated();
      });

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isPending, userId, user?.displayName, hydrate, hydrateRemote]);

  return <>{children}</>;
}
