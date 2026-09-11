import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  className?: string;
} & Omit<ComponentProps<"button">, "onClick">) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        checked ? "bg-accent" : "bg-surface-2 shadow-[var(--shadow-border)]",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "block size-5 rounded-full transition-transform duration-150 ease-out",
          checked
            ? "translate-x-[18px] bg-accent-fg"
            : "translate-x-0.5 bg-fg",
        )}
      />
    </button>
  );
}
