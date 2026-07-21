import type { DeviceStatus } from "@home-dashboard/contracts";

const labels: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  unknown: "Unknown",
};

const styles: Record<DeviceStatus, string> = {
  online: "bg-green-950 text-green-300 border-green-800",
  offline: "bg-red-950 text-red-300 border-red-800",
  unknown: "bg-amber-950 text-amber-300 border-amber-800",
};

export function StatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
