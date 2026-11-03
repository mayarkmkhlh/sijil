const hourMs = 60 * 60 * 1000;

export type ExtractDecision =
  | { ok: true }
  | { ok: false; status: 429 | 503; error: string; retryAfterSeconds?: number };

/** Render appends the client address, so the last hop is the one the proxy saw. */
export function clientIp(forwardedFor: string | undefined): string {
  const hops = (forwardedFor ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0);
  return hops.at(-1) ?? "unknown";
}

export function extractIsEnabled(value: string): boolean {
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

function riyadhDay(now: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

export function createExtractGuard(options: {
  enabled: boolean;
  ipLimit: number;
  dailyLimit: number;
}) {
  const buckets = new Map<string, { start: number; count: number }>();
  let day = "";
  let dayCount = 0;

  return {
    allow(ip: string, now = Date.now()): ExtractDecision {
      if (!options.enabled) {
        return { ok: false, status: 503, error: "Extract is turned off." };
      }

      const today = riyadhDay(now);
      if (today !== day) {
        day = today;
        dayCount = 0;
      }
      if (dayCount >= options.dailyLimit) {
        return { ok: false, status: 503, error: "Daily extract limit reached." };
      }

      const bucket = buckets.get(ip);
      if (!bucket || now - bucket.start >= hourMs) {
        buckets.set(ip, { start: now, count: 1 });
      } else if (bucket.count >= options.ipLimit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((hourMs - (now - bucket.start)) / 1000));
        return {
          ok: false,
          status: 429,
          error: "Too many extracts from this address. Try later.",
          retryAfterSeconds,
        };
      } else {
        bucket.count += 1;
      }

      dayCount += 1;
      return { ok: true };
    },
  };
}
