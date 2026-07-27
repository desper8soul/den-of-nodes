#!/bin/sh
set -eu

# Named volumes are root-owned by default; the agent runs as user `app`.
devices_file="${DEVICES_FILE_PATH:-/data/devices.json}"
data_dir="$(dirname "$devices_file")"
mkdir -p "$data_dir"
chown -R app:app "$data_dir"

exec runuser -u app -- "$@"
