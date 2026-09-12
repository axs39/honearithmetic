import { useId } from "react";

/** Duolingo-ish SVG flame (no emoji) for streak display. */

type StreakFireProps = {
  size?: number;
  className?: string;
  title?: string;
};

export function StreakFire({
  size = 16,
  className,
  title = "Streak",
}: StreakFireProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `streak-fire-grad-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      style={{ display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0 }}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff9600" />
          <stop offset="45%" stopColor="#ff4b4b" />
          <stop offset="100%" stopColor="#ff2d55" />
        </linearGradient>
      </defs>
      {/* Outer flame */}
      <path
        fill={`url(#${gradId})`}
        d="M12 2c.4 2.2-.3 3.8-1.6 5.3C8.8 9 7.5 10.6 7.5 13.2c0 3.1 2.1 5.3 4.5 5.3s4.5-2.2 4.5-5.3c0-1.5-.4-2.7-1-3.8.7 1.1 1.1 2.4 1.1 3.8 0 3.8-2.7 6.8-6.1 6.8S4.4 17 4.4 13.2C4.4 9.4 7 6.3 9.2 4.2 10.3 3.1 11.2 2.4 12 2z"
      />
      {/* Inner core */}
      <path
        fill="#ffd84d"
        opacity="0.95"
        d="M12 10.2c.25 1.2-.15 2.1-.9 2.95-.7.75-1.35 1.55-1.35 2.85 0 1.55 1.05 2.6 2.25 2.6s2.25-1.05 2.25-2.6c0-.85-.25-1.55-.6-2.15.4.65.65 1.4.65 2.15 0 2.05-1.4 3.55-3.15 3.55S8.1 18.05 8.1 16c0-1.85 1.25-3.35 2.4-4.55.55-.55 1-.95 1.5-1.25z"
      />
    </svg>
  );
}

type StreakFireCountProps = {
  count: number;
  size?: number;
  className?: string;
};

/** Flame + streak number for leaderboard / stats. */
export function StreakFireCount({
  count,
  size = 16,
  className,
}: StreakFireCountProps) {
  if (count <= 0) return null;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: "#e85d4c",
        fontVariantNumeric: "tabular-nums",
      }}
      title={`${count}-day streak`}
    >
      <StreakFire size={size} title={`${count}-day streak`} />
      <span>{count}</span>
    </span>
  );
}
