import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0"] as const;

export function Numpad({
  onDigit,
  onBackspace,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2">
      {KEYS.map((k) => {
        const isBack = k === "back";
        return (
          <button
            key={k}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              if (isBack) onBackspace();
              else onDigit(k);
            }}
            className={cn(
              "flex h-14 items-center justify-center rounded-md bg-surface-2 font-mono text-xl text-fg tabular-nums shadow-[var(--shadow-border)]",
              "transition-[transform,background-color] duration-150 ease-out active:scale-[0.96] active:bg-surface",
              isBack && "text-muted",
              k === "0" && "col-span-2",
            )}
            aria-label={isBack ? "Backspace" : k}
          >
            {isBack ? <Delete className="size-5" /> : k}
          </button>
        );
      })}
    </div>
  );
}
