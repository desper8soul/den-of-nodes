import dns from "node:dns/promises";

const DEFAULT_TIMEOUT_MS = 1500;
const MAX_CONCURRENCY = 4;

interface CacheEntry {
  hostname: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function resolveHostname(
  ip: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string | null> {
  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.hostname;
  }

  try {
    const hostnames = await Promise.race([
      dns.reverse(ip),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("DNS timeout")), timeoutMs);
      }),
    ]);

    const hostname = hostnames[0]?.replace(/\.$/, "") ?? null;
    cache.set(ip, {
      hostname,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return hostname;
  } catch {
    cache.set(ip, {
      hostname: null,
      expiresAt: Date.now() + 60 * 1000,
    });
    return null;
  }
}

export async function resolveHostnames(
  ips: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const queue = [...new Set(ips)];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const ip = queue.shift();
      if (!ip) {
        return;
      }
      const hostname = await resolveHostname(ip, timeoutMs);
      results.set(ip, hostname);
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENCY, queue.length || 1) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export function clearHostnameCache(): void {
  cache.clear();
}
