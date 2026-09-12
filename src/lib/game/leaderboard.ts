import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { normalizeDisplayName } from "./trainee";
import {
  addCalendarDays,
  calendarDay,
  endOfDayIso,
  resolveTimeZone,
  yesterday,
} from "./pt-day";

const DISPLAY_CHANGE_MS = 90 * 24 * 60 * 60 * 1000; // ~3 months
const PLACEHOLDER = "player";

export type LeaderboardRow = {
  rank: number;
  displayName: string;
  streakCount: number;
  best120: number;
  userId: string;
};

export type SocialStatus = {
  username: string;
  displayName: string | null;
  displayNameChangedAt: string | null;
  canChangeDisplayName: boolean;
  nextDisplayNameChangeAt: string | null;
  hideFromLeaderboard: boolean;
  streakCount: number;
  streakLastDay: string | null;
  streakRescueAvailable: boolean;
  streakRescueDeadline: string | null;
  best120: number;
  needsDisplayName: boolean;
  hasPassword: boolean;
  signedInWith: string[];
  timezone: string | null;
};

type ProfileSocial = {
  username: string;
  display_name: string | null;
  display_name_changed_at: string | Date | null;
  hide_from_leaderboard: boolean;
  streak_count: number;
  streak_last_day: string | null;
  streak_rescue_available: boolean;
  streak_rescue_deadline: string | Date | null;
  best_120: number;
  timezone: string | null;
};

function asIso(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return v.toISOString();
}

function asDay(
  v: string | Date | null | undefined,
  tz: string,
): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.slice(0, 10);
  return calendarDay(tz, v);
}

function normalizePublicDisplayName(raw: string): string {
  return normalizeDisplayName(raw).slice(0, 32);
}

function canChangeAt(changedAt: string | null, now = Date.now()): {
  can: boolean;
  next: string | null;
} {
  if (!changedAt) return { can: true, next: null };
  const t = Date.parse(changedAt);
  if (Number.isNaN(t)) return { can: true, next: null };
  const next = t + DISPLAY_CHANGE_MS;
  if (now >= next) return { can: true, next: null };
  return { can: false, next: new Date(next).toISOString() };
}

function pickTimeZone(
  stored: string | null | undefined,
  provided: string | null | undefined,
): string {
  return resolveTimeZone(provided || stored || undefined);
}

async function ensureProfile(userId: string, sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`
    insert into profiles (user_id, username, onboarded, save_json, updated_at)
    values (${userId}, ${PLACEHOLDER}, false, '{}', now())
    on conflict (user_id) do nothing
  `;
}

async function loadSocialRow(
  userId: string,
  sql: Awaited<ReturnType<typeof getSql>>,
): Promise<ProfileSocial> {
  await ensureProfile(userId, sql);
  const rows = await sql<ProfileSocial>`
    select
      username,
      display_name,
      display_name_changed_at,
      hide_from_leaderboard,
      streak_count,
      streak_last_day::text as streak_last_day,
      streak_rescue_available,
      streak_rescue_deadline,
      best_120,
      timezone
    from profiles
    where user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Profile missing");
  }
  return row;
}

async function persistTimezoneIfNeeded(
  userId: string,
  sql: Awaited<ReturnType<typeof getSql>>,
  row: ProfileSocial,
  provided: string | null | undefined,
): Promise<ProfileSocial> {
  if (!provided) return row;
  const resolved = resolveTimeZone(provided);
  if (row.timezone === resolved) return row;
  await sql`
    update profiles set
      timezone = ${resolved},
      updated_at = now()
    where user_id = ${userId}
  `;
  return { ...row, timezone: resolved };
}

/**
 * Rescue window: last streak day = L, first missed = L+1, deadline = end of L+3
 * (two full days after the first missed day ends). Do not shorten an existing deadline.
 */
async function syncRescueFlags(
  userId: string,
  row: ProfileSocial,
  sql: Awaited<ReturnType<typeof getSql>>,
  tz: string,
  now = new Date(),
): Promise<ProfileSocial> {
  const yday = yesterday(tz, now);
  const last = asDay(row.streak_last_day, tz);
  let streakCount = Number(row.streak_count) || 0;
  let rescueAvailable = Boolean(row.streak_rescue_available);
  let rescueDeadline = asIso(row.streak_rescue_deadline);

  let changed = false;

  if (streakCount > 0 && last && last < yday) {
    if (
      rescueAvailable &&
      rescueDeadline &&
      Date.parse(rescueDeadline) < now.getTime()
    ) {
      streakCount = 0;
      rescueAvailable = false;
      rescueDeadline = null;
      changed = true;
    } else if (!rescueAvailable) {
      // Open rescue: deadline = end of L+3 in user TZ.
      rescueAvailable = true;
      rescueDeadline = endOfDayIso(addCalendarDays(last, 3), tz);
      changed = true;
    }
    // If already open: do not shorten (or otherwise alter) the existing deadline.
  } else if (last && last >= yday) {
    if (rescueAvailable) {
      rescueAvailable = false;
      rescueDeadline = null;
      changed = true;
    }
  } else if (streakCount <= 0 && rescueAvailable) {
    rescueAvailable = false;
    rescueDeadline = null;
    changed = true;
  }

  if (changed) {
    await sql`
      update profiles set
        streak_count = ${streakCount},
        streak_rescue_available = ${rescueAvailable},
        streak_rescue_deadline = ${rescueDeadline},
        updated_at = now()
      where user_id = ${userId}
    `;
    return {
      ...row,
      streak_count: streakCount,
      streak_rescue_available: rescueAvailable,
      streak_rescue_deadline: rescueDeadline,
    };
  }
  return row;
}

function providerLabel(providerId: string): string {
  if (providerId === "credential") return "Email";
  if (providerId.includes("google")) return "Google";
  if (providerId.includes("twitter") || providerId.endsWith("-x") || providerId === "x")
    return "X";
  if (providerId.includes("github")) return "GitHub";
  return providerId.replace(/^grok-/, "").replace(/^\w/, (c) => c.toUpperCase());
}

export const getLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ rows: LeaderboardRow[] }> => {
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      display_name: string;
      streak_count: number;
      best_120: number;
    }>`
      select user_id, display_name, streak_count, best_120
      from profiles
      where hide_from_leaderboard = false
        and display_name is not null
        and trim(display_name) <> ''
        and best_120 > 0
      order by best_120 desc, lower(display_name) asc
      limit 10
    `;
    return {
      rows: rows.map((r, i) => ({
        rank: i + 1,
        displayName: r.display_name,
        streakCount: Number(r.streak_count) || 0,
        best120: Number(r.best_120) || 0,
        userId: r.user_id,
      })),
    };
  },
);

export const getSocialStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { timeZone?: string } | undefined) => data ?? {})
  .handler(async ({ context, data }): Promise<SocialStatus> => {
    const sql = await getSql();
    let row = await loadSocialRow(context.userId, sql);
    row = await persistTimezoneIfNeeded(
      context.userId,
      sql,
      row,
      data.timeZone,
    );
    const tz = pickTimeZone(row.timezone, data.timeZone);
    row = await syncRescueFlags(context.userId, row, sql, tz);

    const accounts = await sql<{ providerId: string }>`
      select "providerId" as "providerId"
      from "account"
      where "userId" = ${context.userId}
    `;
    const providers = accounts.map((a) => a.providerId);
    const hasPassword = providers.some(
      (p) => p === "credential" || p === "email",
    );
    const signedInWith = [
      ...new Set(
        providers
          .filter((p) => p !== "credential" && p !== "email")
          .map(providerLabel),
      ),
    ];

    const changedAt = asIso(row.display_name_changed_at);
    const displayName =
      row.display_name && row.display_name.trim()
        ? row.display_name.trim()
        : null;
    const change = canChangeAt(displayName ? changedAt : null);

    return {
      username: row.username,
      displayName,
      displayNameChangedAt: changedAt,
      canChangeDisplayName: !displayName || change.can,
      nextDisplayNameChangeAt: displayName ? change.next : null,
      hideFromLeaderboard: Boolean(row.hide_from_leaderboard),
      streakCount: Number(row.streak_count) || 0,
      streakLastDay: asDay(row.streak_last_day, tz),
      streakRescueAvailable: Boolean(row.streak_rescue_available),
      streakRescueDeadline: asIso(row.streak_rescue_deadline),
      best120: Number(row.best_120) || 0,
      needsDisplayName: !displayName,
      hasPassword,
      signedInWith,
      timezone: row.timezone,
    };
  });

export const setDisplayName = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { displayName: string }) => data)
  .handler(async ({ context, data }) => {
    const name = normalizePublicDisplayName(data.displayName);
    if (!name) return { ok: false as const, reason: "empty" as const };
    if (name.length < 2) return { ok: false as const, reason: "short" as const };

    const sql = await getSql();
    const row = await loadSocialRow(context.userId, sql);
    const existing = row.display_name?.trim() || null;
    if (existing) {
      const change = canChangeAt(asIso(row.display_name_changed_at));
      if (!change.can) {
        return {
          ok: false as const,
          reason: "cooldown" as const,
          nextAt: change.next,
        };
      }
    }

    const taken = await sql<{ user_id: string }>`
      select user_id from profiles
      where lower(display_name) = ${name.toLowerCase()}
        and user_id <> ${context.userId}
      limit 1
    `;
    if (taken[0]) return { ok: false as const, reason: "taken" as const };

    await sql`
      update profiles set
        display_name = ${name},
        display_name_changed_at = now(),
        updated_at = now()
      where user_id = ${context.userId}
    `;
    return { ok: true as const, reason: null, displayName: name };
  });

export const updateTraineeName = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { username: string }) => data)
  .handler(async ({ context, data }) => {
    const wanted = normalizeDisplayName(data.username).slice(0, 32);
    if (!wanted) return { ok: false as const, reason: "empty" as const };

    const sql = await getSql();
    await ensureProfile(context.userId, sql);

    if (wanted.toLowerCase() !== PLACEHOLDER) {
      const taken = await sql<{ user_id: string }>`
        select user_id from profiles
        where lower(username) = ${wanted.toLowerCase()}
          and user_id <> ${context.userId}
        limit 1
      `;
      if (taken[0]) return { ok: false as const, reason: "taken" as const };
    }

    await sql`
      update profiles set
        username = ${wanted},
        updated_at = now()
      where user_id = ${context.userId}
    `;
    return { ok: true as const, reason: null, username: wanted };
  });

export const setPrivacy = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { hideFromLeaderboard: boolean }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId, sql);
    await sql`
      update profiles set
        hide_from_leaderboard = ${Boolean(data.hideFromLeaderboard)},
        updated_at = now()
      where user_id = ${context.userId}
    `;
    return { ok: true as const, hideFromLeaderboard: Boolean(data.hideFromLeaderboard) };
  });

export const syncBest120 = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { best120: number; timeZone?: string }) => data)
  .handler(async ({ context, data }) => {
    const best120 = Math.max(0, Math.floor(Number(data.best120) || 0));
    const sql = await getSql();
    await ensureProfile(context.userId, sql);

    if (data.timeZone) {
      const tz = resolveTimeZone(data.timeZone);
      await sql`
        update profiles set
          best_120 = greatest(best_120, ${best120}),
          timezone = ${tz},
          updated_at = now()
        where user_id = ${context.userId}
      `;
    } else {
      await sql`
        update profiles set
          best_120 = greatest(best_120, ${best120}),
          updated_at = now()
        where user_id = ${context.userId}
      `;
    }

    const rows = await sql<{ best_120: number }>`
      select best_120 from profiles where user_id = ${context.userId}
    `;
    return {
      ok: true as const,
      best120: Number(rows[0]?.best_120) || best120,
    };
  });

export const recordQualifiedRound = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      score: number;
      duration: number;
      completed: boolean;
      timeZone?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    if (!data.completed) {
      return { ok: true as const, credited: false as const };
    }
    if (!Number.isFinite(data.score) || !Number.isFinite(data.duration)) {
      return { ok: false as const, credited: false as const };
    }
    const score = Math.max(0, Math.floor(data.score));
    const duration = Math.max(0, Math.floor(data.duration));

    const sql = await getSql();
    let row = await loadSocialRow(context.userId, sql);
    row = await persistTimezoneIfNeeded(
      context.userId,
      sql,
      row,
      data.timeZone,
    );
    const tz = pickTimeZone(row.timezone, data.timeZone);
    row = await syncRescueFlags(context.userId, row, sql, tz);

    if (duration < 120) {
      return { ok: true as const, credited: false as const };
    }

    const now = new Date();
    const today = calendarDay(tz, now);
    const yday = yesterday(tz, now);
    const bestBefore = Number(row.best_120) || 0;
    const best120 = Math.max(bestBefore, score);
    const last = asDay(row.streak_last_day, tz);
    let streakCount = Number(row.streak_count) || 0;
    let rescueAvailable = Boolean(row.streak_rescue_available);
    let rescueDeadline = asIso(row.streak_rescue_deadline);

    // Expire rescue if deadline passed (sync may have missed a race).
    if (
      rescueAvailable &&
      rescueDeadline &&
      Date.parse(rescueDeadline) < now.getTime()
    ) {
      streakCount = 0;
      rescueAvailable = false;
      rescueDeadline = null;
    }

    let credited = false;

    if (last === today) {
      // Already credited today — still allow best_120 update.
    } else if (rescueAvailable) {
      const threshold = bestBefore - 7;
      if (duration === 120 && score >= threshold) {
        streakCount = streakCount + 1;
        credited = true;
        rescueAvailable = false;
        rescueDeadline = null;
      } else if (duration === 120) {
        // Rescue failed; still qualifies for a fresh day-1 streak.
        streakCount = 1;
        credited = true;
        rescueAvailable = false;
        rescueDeadline = null;
      } else {
        // Non-rescue qualified round abandons rescue → new streak.
        streakCount = 1;
        credited = true;
        rescueAvailable = false;
        rescueDeadline = null;
      }
    } else if (last === yday) {
      streakCount = streakCount + 1;
      credited = true;
    } else {
      streakCount = 1;
      credited = true;
    }

    const streakLastDay = credited || last === today ? today : last;

    await sql`
      update profiles set
        best_120 = ${best120},
        streak_count = ${streakCount},
        streak_last_day = ${streakLastDay},
        streak_rescue_available = ${rescueAvailable},
        streak_rescue_deadline = ${rescueDeadline},
        updated_at = now()
      where user_id = ${context.userId}
    `;

    return {
      ok: true as const,
      credited,
      streakCount,
      best120,
      rescued: Boolean(last !== today && last !== yday && credited && streakCount > 1),
    };
  });

/** Used only to keep the addCalendarDays import live for tests / callers. */
export { addCalendarDays };
