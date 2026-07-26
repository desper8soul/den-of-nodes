# Home Dashboard

Raspberry Pi 3 B+ compatible home network dashboard with two services: a Next.js BFF dashboard and an internal Network Agent.

## Features

- Manage saved devices from the UI (create, edit, delete)
- Send Wake-on-LAN magic packets to enabled devices
- Passive network device list (`ip neigh`, `/proc/net/arp`, reverse DNS)
- Optional active ARP discovery (`arp-scan`)
- Save detected devices with one click
- Username/password login with an HTTP-only session cookie
- Failed login alert emails (from the 3rd failure, with a 15-minute cooldown)
- Docker images published to GitHub Container Registry
- Secure access over Tailscale

## Architecture

```text
apps/
  dashboard/       Next.js UI + BFF (0.0.0.0:3000)
  network-agent/   Fastify internal API (127.0.0.1:3100)
packages/
  contracts/       Shared Zod schemas and types
```

### Why two services?

- The **Dashboard** only serves the UI and BFF API; it does not run network commands directly.
- The **Network Agent** handles WoL, ARP discovery, device persistence, and email alerts.
- The Agent listens **only on loopback** (`127.0.0.1:3100`), so it is not reachable from outside the host.
- Both containers run with `network_mode: host` so WoL broadcast and ARP/neighbour data are available.

## Limitations

- Sleeping or powered-off devices often do not appear in ARP/neighbour tables
- Online status is only an estimate (`online` / `offline` / `unknown`)
- Sending a magic packet **does not guarantee** wake-up
- Wake-on-LAN requires BIOS/UEFI and Windows NIC configuration
- Waking from full shutdown (S5) is hardware-dependent
- Windows Fast Startup can interfere with S5 WoL
- WoL often does not work over Wi-Fi — Ethernet is recommended
- Active scan does not provide a complete network inventory

## Windows PC Wake-on-LAN setup

### BIOS/UEFI

- Wake on LAN
- Power On By PCI-E / Resume By PCI-E Device

### Device Manager (Ethernet adapter)

- Wake on Magic Packet: Enabled
- Allow this device to wake the computer: Enabled
- Only allow a magic packet to wake the computer: Enabled
- Wake on Pattern Match: **Disabled**
- Energy Efficient Ethernet: disable if needed

### Other

- Disable Fast Startup for testing if the PC does not wake from a powered-off state

## Local development

```bash
corepack enable
pnpm install

cp apps/dashboard/.env.example apps/dashboard/.env.local
cp apps/network-agent/.env.example apps/network-agent/.env.local
```

Fill in the secrets in both `.env.local` files (see [Environment secrets](#environment-secrets)), then start the stack:

```bash
pnpm dev
```

Local dev notes for the Network Agent `.env.local`:

- `DEVICES_FILE_PATH=./data/devices.json` — use a path under the project (Docker uses `/data/devices.json`)
- `ACTIVE_SCAN_ENABLED=false` — unless `arp-scan` is installed on your machine

Network features work fully on Linux; on Windows/WSL the agent starts without active scan unless `arp-scan` is installed.

## Security

- **Do not** set up router port forwarding
- Reach the dashboard only from LAN or Tailscale
- The Agent port (`3100`) is not reachable from outside the host
- Restrict who can access the Pi with Tailscale ACLs
- Keep the internal `INTERNAL_AGENT_SECRET` in server-side ENV only

## GitHub repository and GHCR

1. Create the repository and push the code
2. The GitHub Actions workflow builds and publishes public images:
  - `ghcr.io/<owner>/den-of-nodes-dashboard`
  - `ghcr.io/<owner>/den-of-nodes-network-agent`

No `docker login` is required on the Pi to pull these images.
## Raspberry Pi deployment

```bash
mkdir -p ~/den-of-nodes
cd ~/den-of-nodes
```

Create these files (clone the repo, or copy them from it):

- `compose.yaml`
- `.env.dashboard` (based on `.env.dashboard.example`)
- `.env.agent` (based on `.env.agent.example`)

`compose.yaml` uses `${GHCR_OWNER}` in image names. The deploy job sets this automatically from `github.repository_owner` — no Pi-side `.env` needed for automated deploys. For a one-off manual pull on the Pi:

```bash
export GHCR_OWNER=desper8soul   # your GitHub username/org
docker compose pull && docker compose up -d
```

### Environment secrets

Copy the example env files, then replace every `replace-with-...` placeholder before starting the services.

```bash
openssl rand -hex 32
```

**On the Pi (deployment):**

```bash
cp .env.dashboard.example .env.dashboard
cp .env.agent.example .env.agent
```


**For local development**, use `apps/dashboard/.env.local` and `apps/network-agent/.env.local` instead (see [Local development](#local-development)).

#### Shared secret (required)

`INTERNAL_AGENT_SECRET` must be **the same value** in `.env.dashboard` and `.env.agent`. The dashboard uses it to authenticate to the Network Agent; the agent rejects requests without a matching bearer token.

Generate a random value (at least 32 characters):

```bash
openssl rand -hex 32
```

Put the output in both files:

```env
INTERNAL_AGENT_SECRET=<generated-value>
```

#### Dashboard login (`.env.dashboard`)


| Variable             | How to set                                                     |
| -------------------- | -------------------------------------------------------------- |
| `AUTH_USERNAME`      | Login name of your choice                                      |
| `AUTH_PASSWORD_SALT` | Output of the hash script (below)                              |
| `AUTH_PASSWORD_HASH` | Output of the hash script (below)                              |
| `SESSION_SECRET`     | Random string, at least 32 characters (`openssl rand -hex 32`) |


Generate the password salt and hash from the repo (on your dev machine or the Pi, anywhere Node.js is available):

```bash
node scripts/hash-password.mjs "your-chosen-password"
```

Example output:

```text
AUTH_PASSWORD_SALT=669f145f994d3631293739731f94aac7
AUTH_PASSWORD_HASH=1ef56a63f5f5691ec76b64be10c8995f...
```

Copy both lines into `.env.dashboard`. Re-running the script with the same password produces a **new** salt and hash, so store the values you actually deploy.

#### Network and email (`.env.agent`)

Adjust these for your LAN:

- `LAN_INTERFACE` — Pi interface name (e.g. `eth0`; check with `ip link`)
- `LAN_CIDR` — local subnet (e.g. `192.168.0.0/24`)
- `WOL_BROADCAST_ADDRESS` — broadcast address for that subnet (e.g. `192.168.0.255`)

For failed-login email alerts, set `SECURITY_ALERT_EMAIL` and your SMTP provider details (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`). Use app passwords where your provider requires them.

#### Checklist

- [ ] `INTERNAL_AGENT_SECRET` matches in `.env.dashboard` and `.env.agent`
- [ ] `SESSION_SECRET` set in `.env.dashboard`
- [ ] `AUTH_USERNAME`, `AUTH_PASSWORD_SALT`, and `AUTH_PASSWORD_HASH` set in `.env.dashboard`
- [ ] LAN settings match your Pi's network
- [ ] SMTP settings filled in if you want security alerts

Start:

```bash
docker compose pull
docker compose up -d
```

Verify:

```bash
docker compose ps
docker compose logs -f
curl http://127.0.0.1:3000/api/health
```

Update:

```bash
docker compose pull
docker compose up -d
docker image prune -f
```

### Automated deploy on merge to `main` (Tailscale + SSH)

GitHub-hosted runners cannot reach a home Pi on your LAN directly. Use [Tailscale to connect CI/CD to private infrastructure](https://tailscale.com/docs/solutions/connect-github-CICD-workflows-to-private-infrastructure-without-public-exposure) so the workflow SSHs over your tailnet after images are published.

**Important:** If the Pi has **Tailscale SSH** enabled (`tailscale set --ssh`), connections to port 22 are handled by Tailscale — not plain OpenSSH. Network `grants` alone are not enough; you also need an **`ssh`** policy. A failure that looks like `handshake failed: EOF` or ends with `tailnet policy does not permit you to SSH to this node` means this section is missing or wrong.

**One-time Tailscale setup**

1. Tag the Pi in the [admin console](https://login.tailscale.com/admin/machines) (e.g. `tag:pi`).
2. In [Access controls](https://login.tailscale.com/admin/acls), allow CI both network reachability and Tailscale SSH:

```json
"tagOwners": {
  "tag:ci": [],
  "tag:pi": []
},
"grants": [
  {
    "src": ["tag:ci"],
    "dst": ["tag:pi"],
    "ip": ["22"]
  }
],
"ssh": [
  {
    "action": "accept",
    "src": ["tag:ci"],
    "dst": ["tag:pi"],
    "users": ["ede"]
  }
]
```

Replace `"ede"` with the Unix account on the Pi (`PI_USER`). Keep your existing open `grants` if you use them for personal devices; the `ssh` block is what CI needs.

**Alternative:** turn off Tailscale SSH on the Pi and use classic OpenSSH + `authorized_keys` only:

```bash
sudo tailscale set --ssh=false
```

Then only the deploy key in `~/.ssh/authorized_keys` matters (no `ssh` ACL required).

3. Create an [OAuth client](https://login.tailscale.com/admin/settings/trust-credentials) with scopes **Devices Write** and **Auth Keys Write**, tagged with `tag:ci`.
4. On the Pi: enable SSH, install Tailscale, clone the repo to `~/den-of-nodes`, and configure env files.
5. If Tailscale SSH is **off**, create a deploy SSH key pair and add the public key to `~/.ssh/authorized_keys` on the Pi. If Tailscale SSH is **on**, ACL identity is what authorizes CI (`tag:ci` → local user); a deploy key is optional.

**GitHub repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client ID |
| `TS_OAUTH_SECRET` | Tailscale OAuth client secret |
| `PI_HOST` | Pi MagicDNS name (e.g. `raspberrypi` or `raspberrypi.tail-xxxxx.ts.net`) |
| `PI_USER` | SSH user on the Pi |
| `PI_SSH_PRIVATE_KEY` | Private key for deploy (full PEM, including `BEGIN`/`END` lines) |

After this, every push to `main` runs tests, publishes ARM64 images to GHCR, joins the tailnet as an ephemeral `tag:ci` node, and runs `docker compose pull && docker compose up -d` on the Pi. No port forwarding required.

### NET_RAW capability

`arp-scan` requires raw socket access. The compose file grants the `NET_RAW` capability. **Do not** use `privileged: true`.

## Tailscale access

```bash
tailscale ip -4
```

Example:

```text
http://100.x.y.z:3000
```

With MagicDNS:

```text
http://edes314:3000
```

## Backup and restore

Backup:

```bash
docker run --rm \
  -v den-of-nodes_dashboard-data:/data \
  -v "$PWD":/backup \
  alpine \
  tar czf /backup/dashboard-data.tar.gz -C /data .
```

Restore:

```bash
docker compose down
docker run --rm \
  -v den-of-nodes_dashboard-data:/data \
  -v "$PWD":/backup \
  alpine \
  sh -c "cd /data && tar xzf /backup/dashboard-data.tar.gz"
docker compose up -d
```

## Troubleshooting


| Problem                          | Possible cause                                                         |
| -------------------------------- | ---------------------------------------------------------------------- |
| WoL does not work over Tailscale | WoL is LAN broadcast only; the Pi must be on the same physical network |
| `arp-scan: permission denied`    | Missing `NET_RAW` capability                                           |
| Agent not reachable              | Check that it is running on `127.0.0.1:3100` in host network mode      |
| Architecture mismatch            | ARM64 image required for Pi 3 B+                                       |
| High memory usage                | Pi 3 B+ has 1 GB RAM — do not run parallel scans                       |


## Commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

