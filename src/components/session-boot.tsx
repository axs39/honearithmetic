import { useEffect, useRef, type ReactNode } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  isForceGuest,
  stripGuestQuery,
} from "@/lib/game/identity";
import {
  kvClearScope,
  kvReadScope,
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

    if (lastId.current === userId) return;
    lastId.current = userId;

    const guest = adoptGuestIntoAccount();
    setKvScope(`u:${userId}`);
    if (guest.name) writeTraineeName(guest.name);
    if (guest.intro) completeIntro(guest.name || readTraineeName());
    else notifyIntro();
    hydrate(true);
    if (guest.save && guest.save.sessions.length > 0) {
      hydrateRemote(guest.save);
    }

    let cancelled = false;
    const t = window.setTimeout(() => {
      if (!cancelled) notifyIntro();
    }, 4000);

    void import("@/lib/game/profile")
      .then(({ loadProfile }) => loadProfile())
      .then((row) => {
        if (cancelled) return;
        const name =
          row?.username ||
          guest.name ||
          readTraineeName() ||
          user?.displayName ||
          "";
        if (name) writeTraineeName(name);
        if (row?.onboarded || guest.intro) completeIntro(name);
        if (row?.save && row.save.sessions.length > 0) {
          hydrateRemote(row.save);
        }
        void import("@/lib/game/sync-social").then(({ pushBest120Once }) =>
          pushBest120Once(),
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
        if (guest.intro || guest.name) completeIntro(guest.name);
      })
      .finally(() => {
        window.clearTimeout(t);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isPending, userId, user?.displayName, hydrate, hydrateRemote]);

  return <>{children}</>;
}
