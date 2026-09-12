import { useEffect } from "react";
import { applyAppearance, readAppearance } from "@/lib/appearance";

/** Hydrate theme/font from localStorage after mount (inline script handles FOUC). */
export function AppearanceBoot() {
  useEffect(() => {
    applyAppearance(readAppearance());
  }, []);
  return null;
}
