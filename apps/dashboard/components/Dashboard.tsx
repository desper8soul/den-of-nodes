"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DevicesResponse, MergedDevice, NetworkDevice } from "@home-dashboard/contracts";
import { DeviceModal, deviceToForm, networkDeviceToForm, type DeviceFormData } from "./DeviceModal";
import { StatusBadge } from "./StatusBadge";
import { useToast } from "./Toast";

type StatusFilter = "all" | "online" | "offline" | "unknown";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("en-US");
}

function formatSources(sources: string[]): string {
  const labels: Record<string, string> = {
    configured: "Configured",
    active_scan: "Active scan",
    ip_neigh: "ip neigh",
    proc_arp: "/proc/net/arp",
    cache: "Cache",
  };
  return sources.map((source) => labels[source] ?? source).join(", ");
}

export function Dashboard() {
  const { showToast } = useToast();
  const [devices, setDevices] = useState<MergedDevice[]>([]);
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([]);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [storageError, setStorageError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Add device");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<Partial<DeviceFormData>>();
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [wakingId, setWakingId] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    const response = await fetch("/api/devices");
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!response.ok) {
      setStorageError(true);
      throw new Error("Failed to load devices");
    }
    const data = (await response.json()) as DevicesResponse;
    setDevices(data.devices.filter((d) => !d.id.startsWith("discovered-")));
    setScannedAt(data.scannedAt);
    setStorageError(false);
  }, []);

  const loadNetworkDevices = useCallback(async () => {
    const response = await fetch("/api/network/devices");
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as { devices: NetworkDevice[] };
    const savedMacs = new Set(devices.map((d) => d.mac));
    setNetworkDevices(
      data.devices.filter((d) => d.mac && !savedMacs.has(d.mac)),
    );
  }, [devices]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDevices();
      await loadNetworkDevices();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Refresh failed",
        "error",
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadDevices, loadNetworkDevices, showToast]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        await loadDevices();
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Failed to load",
          "error",
        );
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [loadDevices, showToast]);

  useEffect(() => {
    void loadNetworkDevices();
  }, [loadNetworkDevices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const matchesStatus =
        statusFilter === "all" || device.status === statusFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        device.name.toLowerCase().includes(query) ||
        (device.hostname?.toLowerCase().includes(query) ?? false) ||
        (device.ip?.includes(query) ?? false) ||
        device.mac.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [devices, search, statusFilter]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleSaveDevice(form: DeviceFormData) {
    const payload = {
      name: form.name,
      macAddress: form.macAddress,
      lastKnownIpAddress: form.lastKnownIpAddress || null,
      wakeOnLanEnabled: form.wakeOnLanEnabled,
      notes: form.notes || null,
    };

    const response = editingId
      ? await fetch(`/api/devices/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? "Failed to save");
    }

    showToast(editingId ? "Device updated" : "Device added", "success");
    await refreshAll();
  }

  async function handleDelete(device: MergedDevice) {
    if (!confirm(`Delete ${device.name}?`)) {
      return;
    }

    const response = await fetch(`/api/devices/${device.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      showToast("Delete failed", "error");
      return;
    }
    showToast("Device deleted", "success");
    await refreshAll();
  }

  async function handleWake(device: MergedDevice) {
    if (!confirm(`Wake ${device.name}?`)) {
      return;
    }

    setWakingId(device.id);
    try {
      const response = await fetch(`/api/devices/${device.id}/wake`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Wake failed");
      }
      showToast(
        "Magic packet sent. This does not guarantee the machine woke up.",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Wake failed",
        "error",
      );
    } finally {
      setWakingId(null);
    }
  }

  async function handleActiveScan() {
    setScanDialogOpen(false);
    setScanning(true);
    try {
      const response = await fetch("/api/network/scan", { method: "POST" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Active scan failed");
      }
      showToast("Active network scan complete", "success");
      await refreshAll();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Active scan failed",
        "error",
      );
    } finally {
      setScanning(false);
    }
  }

  function openCreateModal(prefill?: Partial<DeviceFormData>) {
    setEditingId(null);
    setModalTitle("Add device");
    setInitialForm(prefill);
    setModalOpen(true);
  }

  function openEditModal(device: MergedDevice) {
    setEditingId(device.id);
    setModalTitle("Edit device");
    setInitialForm(deviceToForm(device));
    setModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[#0d1424]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Home Dashboard</h1>
            <p className="text-sm text-[var(--muted)]">
              Raspberry Pi connection: available
            </p>
            <p className="text-sm text-[var(--muted)]">
              Last updated: {formatDate(scannedAt)}
            </p>
          </div>
          <button
            onClick={() => void handleLogout()}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6">
        {storageError ? (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-200">
            Device storage is unavailable. Check the Network Agent status and
            the devices.json file.
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Saved devices</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => openCreateModal()}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Add device
              </button>
              <button
                onClick={() => void refreshAll()}
                disabled={refreshing}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button
                onClick={() => setScanDialogOpen(true)}
                disabled={scanning}
                className="rounded-lg border border-amber-700 bg-amber-950/40 px-4 py-2 text-sm text-amber-100 disabled:opacity-50"
              >
                {scanning ? "Scanning..." : "Active network scan"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, IP, or MAC..."
              className="w-full rounded-lg border border-[var(--border)] bg-[#0d1424] px-3 py-2 sm:max-w-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-[var(--border)] bg-[#0d1424] px-3 py-2"
            >
              <option value="all">All statuses</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="skeleton h-24" />
              ))}
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
              No devices to show. Add one or run a network scan.
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-[var(--border)] md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#10182a] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Hostname</th>
                      <th className="px-4 py-3">IP</th>
                      <th className="px-4 py-3">MAC</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last seen</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map((device) => (
                      <tr key={device.id} className="border-t border-[var(--border)]">
                        <td className="px-4 py-3 font-medium">{device.name}</td>
                        <td className="px-4 py-3">{device.hostname ?? "—"}</td>
                        <td className="px-4 py-3 font-mono">{device.ip ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{device.mac}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={device.status} />
                        </td>
                        <td className="px-4 py-3">{formatDate(device.lastSeenAt)}</td>
                        <td className="px-4 py-3 text-xs text-[var(--muted)]">
                          {formatSources(device.source)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {device.wakeOnLanEnabled ? (
                              <button
                                onClick={() => void handleWake(device)}
                                disabled={wakingId === device.id}
                                className="rounded bg-green-700 px-2 py-1 text-xs text-white disabled:opacity-50"
                              >
                                Wake
                              </button>
                            ) : null}
                            <button
                              onClick={() => openEditModal(device)}
                              className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => void handleDelete(device)}
                              className="rounded border border-red-800 px-2 py-1 text-xs text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {filteredDevices.map((device) => (
                  <article
                    key={device.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{device.name}</h3>
                        <p className="text-sm text-[var(--muted)]">
                          {device.hostname ?? "No hostname"}
                        </p>
                      </div>
                      <StatusBadge status={device.status} />
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-[var(--muted)]">IP</dt>
                        <dd className="font-mono">{device.ip ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">MAC</dt>
                        <dd className="font-mono text-xs">{device.mac}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-[var(--muted)]">Last seen</dt>
                        <dd>{formatDate(device.lastSeenAt)}</dd>
                      </div>
                      {device.notes ? (
                        <div className="col-span-2">
                          <dt className="text-[var(--muted)]">Notes</dt>
                          <dd>{device.notes}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {device.wakeOnLanEnabled ? (
                        <button
                          onClick={() => void handleWake(device)}
                          disabled={wakingId === device.id}
                          className="rounded-lg bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                        >
                          Wake PC
                        </button>
                      ) : null}
                      <button
                        onClick={() => openEditModal(device)}
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDelete(device)}
                        className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Detected network devices</h2>
          <p className="text-sm text-[var(--muted)]">
            These devices are not saved yet. Verify the details before adding
            them.
          </p>

          {networkDevices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-[var(--muted)]">
              No newly detected devices. Run a refresh or active scan.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {networkDevices.map((device) => (
                <article
                  key={`${device.ip}-${device.mac}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium">
                      {device.hostname ?? device.ip}
                    </h3>
                    <StatusBadge status={device.status} />
                  </div>
                  <p className="font-mono text-sm">{device.ip}</p>
                  <p className="font-mono text-xs text-[var(--muted)]">
                    {device.mac ?? "—"}
                  </p>
                  <button
                    onClick={() =>
                      openCreateModal(networkDeviceToForm(device))
                    }
                    className="mt-3 rounded-lg border border-[var(--accent)] px-3 py-2 text-sm text-blue-300"
                  >
                    Add to saved devices
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <DeviceModal
        open={modalOpen}
        title={modalTitle}
        initial={initialForm}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSaveDevice}
      />

      {scanDialogOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-amber-800 bg-[var(--card)] p-5">
            <h3 className="mb-3 text-lg font-semibold">
              Active network scan
            </h3>
            <p className="mb-4 text-sm text-[var(--muted)]">
              Active network scanning sends ARP requests. This normally does not
              wake sleeping devices, but Wake on Pattern Match settings on some
              network adapters may behave differently.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setScanDialogOpen(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleActiveScan()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-white"
              >
                Start scan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
