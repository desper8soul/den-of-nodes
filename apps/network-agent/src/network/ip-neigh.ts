import { normalizeMacAddress } from "@home-dashboard/contracts";

export interface IpNeighEntry {
  ip: string;
  mac: string | null;
  state: string;
}

export function parseIpNeighOutput(output: string): IpNeighEntry[] {
  const entries: IpNeighEntry[] = [];

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const match = trimmed.match(
      /^(\S+)\s+dev\s+\S+\s+lladdr\s+([0-9a-f:]{17})\s+(\S+)/i,
    );
    if (match) {
      entries.push({
        ip: match[1]!,
        mac: normalizeMacAddress(match[2]!),
        state: match[3]!.toUpperCase(),
      });
      continue;
    }

    const incompleteMatch = trimmed.match(
      /^(\S+)\s+dev\s+\S+\s+(?:FAILED|INCOMPLETE|REACHABLE|STALE|DELAY|PROBE)(?:\s+(\S+))?/i,
    );
    if (incompleteMatch) {
      const stateMatch = trimmed.match(
        /\b(FAILED|INCOMPLETE|REACHABLE|STALE|DELAY|PROBE)\b/i,
      );
      entries.push({
        ip: incompleteMatch[1]!,
        mac: null,
        state: stateMatch?.[1]?.toUpperCase() ?? "UNKNOWN",
      });
    }
  }

  return entries;
}

export function ipNeighStateToStatus(
  state: string,
): "online" | "offline" | "unknown" {
  const upper = state.toUpperCase();
  if (["REACHABLE", "STALE", "DELAY", "PROBE"].includes(upper)) {
    return "online";
  }
  if (["FAILED", "INCOMPLETE"].includes(upper)) {
    return "offline";
  }
  return "unknown";
}
