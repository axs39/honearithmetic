import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { normalizeUsername } from "./account";
import { parseImported, type SaveState } from "./storage";

export type ProfileRow = {
  username: string;
  onboarded: boolean;
  save: SaveState | null;
};

const PLACEHOLDER = "player";

function displayUsername(raw: string | undefined): string {
  const t = (raw ?? "").trim().slice(0, 32);
  return t || PLACEHOLDER;
}

export const usernameAvailable = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<boolean> => {
    const n = normalizeUsername(data.username);
    if (!n || n === PLACEHOLDER) return false;
    const sql = await getSql();
    const rows = await sql<{ n: number }>`
      select count(*)::int as n
      from profiles
      where lower(username) = ${n}
        and lower(username) <> ${PLACEHOLDER}
    `;
    return (rows[0]?.n ?? 0) === 0;
  });

export const loadProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ProfileRow | null> => {
    const sql = await getSql();
    const rows = await sql<{
      username: string;
      onboarded: boolean;
      save_json: string;
    }>`
      select username, onboarded, save_json
      from profiles
      where user_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row) return null;
    let save: SaveState | null = null;
    try {
      if (row.save_json && row.save_json !== "{}") {
        save = parseImported(row.save_json);
      }
    } catch {
      save = null;
    }
    return {
      username: row.username,
      onboarded: Boolean(row.onboarded),
      save,
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      saveJson: string;
      username?: string;
      onboarded?: boolean;
      requireUsername?: boolean;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const wanted = displayUsername(data.username);
    const onboarded = data.onboarded ?? true;
    const existing = await sql<{ username: string }>`
      select username from profiles where user_id = ${context.userId}
    `;
    const taken =
      wanted.toLowerCase() !== PLACEHOLDER
        ? await sql<{ user_id: string }>`
            select user_id from profiles
            where lower(username) = ${wanted.toLowerCase()}
              and user_id <> ${context.userId}
            limit 1
          `
        : [];
    if (taken[0]) {
      if (data.requireUsername) {
        return { ok: false as const, reason: "taken" as const };
      }
    }
    const username = taken[0]
      ? (existing[0]?.username ?? PLACEHOLDER)
      : wanted;

    await sql`
      insert into profiles (user_id, username, onboarded, save_json, updated_at)
      values (
        ${context.userId},
        ${username},
        ${onboarded},
        ${data.saveJson},
        now()
      )
      on conflict (user_id) do update set
        save_json = excluded.save_json,
        onboarded = excluded.onboarded,
        username = case
          when excluded.username = ${PLACEHOLDER} then profiles.username
          else excluded.username
        end,
        updated_at = now()
    `;
    return { ok: true as const, reason: null };
  });
