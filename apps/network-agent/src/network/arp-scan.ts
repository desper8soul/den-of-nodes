import { normalizeMacAddress } from "@home-dashboard/contracts";

export interface ArpScanEntry {
  ip: string;
  mac: string;
  vendor: string | null;
}

export function parseArpScanOutput(output: string): ArpScanEntry[] {
  const entries: ArpScanEntry[] = [];

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Interface:") || trimmed.startsWith("Starting")) {
      continue;
    }

    const match = trimmed.match(
      /^(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f:]{17})(?:\s+(.+))?$/i,
    );
    if (!match) {
      continue;
    }

    entries.push({
      ip: match[1]!,
      mac: normalizeMacAddress(match[2]!),
      vendor: match[3]?.trim() ?? null,
    });
  }

  return entries;
}
