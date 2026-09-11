/**
 * Grok preview PWA middleware disabled for self-hosted deploys.
 * Kept as a no-op so Nitro's middleware glob still resolves cleanly.
 */
import type { H3Event } from "h3";

export default async function grokPwaMiddleware(_event: H3Event) {
  // no-op outside Grok preview host
}
