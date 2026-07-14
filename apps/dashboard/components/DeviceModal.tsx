"use client";

import { useEffect, useState } from "react";
import type { MergedDevice, NetworkDevice } from "@home-dashboard/contracts";

export interface DeviceFormData {
  name: string;
  macAddress: string;
  lastKnownIpAddress: string;
  wakeOnLanEnabled: boolean;
  notes: string;
}

interface DeviceModalProps {
  open: boolean;
  title: string;
  initial?: Partial<DeviceFormData>;
  onClose: () => void;
  onSubmit: (data: DeviceFormData) => Promise<void>;
}

const emptyForm: DeviceFormData = {
  name: "",
  macAddress: "",
  lastKnownIpAddress: "",
  wakeOnLanEnabled: false,
  notes: "",
};

export function DeviceModal({
  open,
  title,
  initial,
  onClose,
  onSubmit,
}: DeviceModalProps) {
  const [form, setForm] = useState<DeviceFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name ?? "",
        macAddress: initial?.macAddress ?? "",
        lastKnownIpAddress: initial?.lastKnownIpAddress ?? "",
        wakeOnLanEnabled: initial?.wakeOnLanEnabled ?? false,
        notes: initial?.notes ?? "",
      });
      setError(null);
    }
  }, [open, initial]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[var(--muted)] hover:bg-white/5"
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-sm text-[var(--muted)]">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[#0d1424] px-3 py-2"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-[var(--muted)]">MAC address</span>
            <input
              required
              placeholder="B0:6E:BF:BB:5A:79"
              value={form.macAddress}
              onChange={(e) =>
                setForm({ ...form, macAddress: e.target.value })
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[#0d1424] px-3 py-2 font-mono text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-[var(--muted)]">
              IP address (optional)
            </span>
            <input
              value={form.lastKnownIpAddress}
              onChange={(e) =>
                setForm({ ...form, lastKnownIpAddress: e.target.value })
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[#0d1424] px-3 py-2 font-mono text-sm"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.wakeOnLanEnabled}
              onChange={(e) =>
                setForm({ ...form, wakeOnLanEnabled: e.target.checked })
              }
            />
            <span className="text-sm">Enable Wake-on-LAN</span>
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-[var(--muted)]">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[#0d1424] px-3 py-2"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function deviceToForm(device: MergedDevice): DeviceFormData {
  return {
    name: device.name,
    macAddress: device.mac,
    lastKnownIpAddress: device.ip ?? "",
    wakeOnLanEnabled: device.wakeOnLanEnabled,
    notes: device.notes ?? "",
  };
}

export function networkDeviceToForm(device: NetworkDevice): DeviceFormData {
  return {
    name: device.hostname ?? device.ip,
    macAddress: device.mac ?? "",
    lastKnownIpAddress: device.ip,
    wakeOnLanEnabled: false,
    notes: "",
  };
}
