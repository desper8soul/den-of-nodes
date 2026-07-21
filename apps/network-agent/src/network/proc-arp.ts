import { normalizeMacAddress } from "@home-dashboard/contracts";

export interface ProcArpEntry {
  ip: string;
  mac: string;
  device: string;
  flags: string;
}

export function parseProcArpContent(content: string): ProcArpEntry[] {
  const entries: ProcArpEntry[] = [];
  const lines = content.split("\n");

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]?.trim();
    if (!line) {
      continue;
    }

    const parts = line.split(/\s+/);
    if (parts.length < 6) {
      continue;
    }

    const ip = parts[0];
    const flags = parts[2];
    const mac = parts[3];
    const device = parts[5];

    if (!ip || !mac || !flags || !device) {
      continue;
    }

    if (mac === "00:00:00:00:00:00" || mac === "<incomplete>") {
      continue;
    }

    if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) {
      continue;
    }

    entries.push({
      ip,
      mac: normalizeMacAddress(mac),
      device,
      flags,
    });
  }

  return entries;
}
