# GitHub to VPS deployment pipeline

This runbook describes the MVP deployment flow for Sozamen. A push to the
`main` branch starts a GitHub Actions workflow, which connects to the production
VPS over SSH and deploys the exact pushed commit.

This document is intentionally maintained separately from the general
[setup and deployment guide](./deployment-guide.md). Add new failures and their
solutions to the troubleshooting log at the end of this file as the pipeline
evolves.

## 1. Deployment flow

```text
Developer computer
    |
    | git push origin main
    v
GitHub repository
    |
    | starts GitHub Actions workflow
    v
GitHub Actions runner
    |
    | SSH using the Actions-to-VPS key
    v
VPS deploy script
    |
    | fetch exact commit using the VPS-to-GitHub deploy key
    | create a new release directory
    | link persistent .env, SQLite database, and uploads
    | install dependencies and build
    | back up the database and apply the Prisma schema
    | switch the current symlink to the new release
    | restart the systemd service and run a health check
    v
Nginx -> Next.js on 127.0.0.1:3000
```

There are two different SSH connections and they must use different keys:

| Connection            | Purpose                       | Private key location  | Public key location               |
| --------------------- | ----------------------------- | --------------------- | --------------------------------- |
| VPS to GitHub         | Fetch repository code         | VPS user `~/.ssh/`    | GitHub repository **Deploy keys** |
| GitHub Actions to VPS | Run the VPS deployment script | GitHub Actions secret | VPS user `~/.ssh/authorized_keys` |

## 2. Assumptions and limitations

This flow is suitable for the current single-server MVP:

- The application runs as the Linux user `sozamen`.
- The application listens on `127.0.0.1:3000` behind Nginx.
- SQLite and uploaded files live on the same VPS.
- Deployments restart one application process, so a brief interruption may
  occur.
- Database changes are committed under `prisma/migrations` and production runs
  `prisma migrate deploy`. Never create a migration on the production VPS.
- Before handling important production data, move from SQLite to a production
  database such as PostgreSQL.

## 3. Server directory layout

Create the deployment directories once:

```bash
sudo mkdir -p /var/www/sozamen/repository
sudo mkdir -p /var/www/sozamen/releases
sudo mkdir -p /var/www/sozamen/shared/uploads/products
sudo mkdir -p /var/www/sozamen/shared/uploads/profiles
sudo mkdir -p /var/www/sozamen/backups
sudo chown -R sozamen:sozamen /var/www/sozamen
```

Switch from the administrative account to the application account before
creating SSH keys, cloning the repository, or creating application files:

```bash
sudo -iu sozamen
```

Commands that create systemd, sudoers, or Nginx configuration still require
`sudo` or the administrative account. Confirm the active account when unsure:

```bash
whoami
```

The resulting layout is:

```text
/var/www/sozamen/
├── repository/       # persistent Git clone
├── releases/         # one directory per deployed commit
├── shared/
│   ├── .env          # production secrets
│   ├── dev.db        # persistent SQLite database
│   └── uploads/      # persistent customer/product uploads
├── backups/          # SQLite backups made before schema changes
├── current -> releases/<commit>
└── deploy.sh         # deployment script
```

Do not store `.env`, the live database, or runtime uploads inside a disposable
release directory.

## 4. Configure VPS access to GitHub

Run these commands as the `sozamen` user:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -C "sozamen-production-deploy" -f ~/.ssh/github_deploy_key
chmod 600 ~/.ssh/github_deploy_key
chmod 644 ~/.ssh/github_deploy_key.pub
```

Add the contents of `~/.ssh/github_deploy_key.pub` to the repository at
**Settings -> Deploy keys**. Read-only access is sufficient.

Add this host alias to `~/.ssh/config`:

```sshconfig
Host github-sozamen
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy_key
  IdentitiesOnly yes
```

Protect and test the configuration:

```bash
chmod 600 ~/.ssh/config
ssh -T git@github-sozamen
```

GitHub should confirm successful authentication and state that it does not
provide shell access. Clone using the alias from the SSH configuration:

```bash
git clone git@github-sozamen:Mohammadreza-Tatlari/sozamen.git \
  /var/www/sozamen/repository
```

Using `git@github.com:...` bypasses the `github-sozamen` alias and may cause a
`Permission denied (publickey)` error because SSH can select a different key.

Confirm that the saved remote also uses the alias:

```bash
git -C /var/www/sozamen/repository remote -v
```

If necessary, correct an existing remote:

```bash
git -C /var/www/sozamen/repository remote set-url origin \
  git@github-sozamen:Mohammadreza-Tatlari/sozamen.git
```

## 5. Create production environment variables

Create `/var/www/sozamen/shared/.env` and keep it readable only by `sozamen`:

```env
DATABASE_URL="file:/var/www/sozamen/shared/dev.db"
SESSION_SECRET="replace-with-a-long-random-secret"
```

Generate a session secret and protect the file:

```bash
openssl rand -hex 32
chmod 600 /var/www/sozamen/shared/.env
touch /var/www/sozamen/shared/dev.db
```

The database URL is absolute so it continues to point to the same database when
the `current` release changes.

## 6. Create the deployment script

Create `/var/www/sozamen/deploy.sh` as `sozamen`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="/var/www/sozamen"
REPOSITORY="$APP_ROOT/repository"
RELEASES="$APP_ROOT/releases"
SHARED="$APP_ROOT/shared"
BACKUPS="$APP_ROOT/backups"
COMMIT="${1:-}"
NODE_BIN="/home/sozamen/.local/node-current/bin"
export PATH="$NODE_BIN:$PATH"
export NODE_OPTIONS="--dns-result-order=ipv4first"

if [[ ! "$COMMIT" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "A full 40-character Git commit SHA is required."
  exit 1
fi

RELEASE="$RELEASES/$COMMIT"
PREVIOUS="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"

git -C "$REPOSITORY" fetch --prune origin
git -C "$REPOSITORY" cat-file -e "$COMMIT^{commit}"

if [[ ! -d "$RELEASE" ]]; then
  git -C "$REPOSITORY" worktree add --detach "$RELEASE" "$COMMIT"
fi

ln -sfn "$SHARED/.env" "$RELEASE/.env"
mkdir -p "$RELEASE/public/uploads"
cp -an "$RELEASE/public/uploads/products/." "$SHARED/uploads/products/"
rm -rf "$RELEASE/public/uploads/products" "$RELEASE/public/uploads/profiles"
ln -sfn "$SHARED/uploads/products" "$RELEASE/public/uploads/products"
ln -sfn "$SHARED/uploads/profiles" "$RELEASE/public/uploads/profiles"

cd "$RELEASE"
timeout 10m npm ci --no-audit --no-fund --prefer-offline
npm run format:check
npx prisma generate

if [[ -s "$SHARED/dev.db" ]]; then
  cp --preserve=mode,timestamps "$SHARED/dev.db" \
    "$BACKUPS/dev-$(date -u +%Y%m%dT%H%M%SZ)-$COMMIT.db"
fi

npx prisma migrate deploy
npm run build
ln -sfn "$RELEASE" "$APP_ROOT/current"
sudo systemctl restart sozamen

if ! curl --fail --silent --show-error \
  --retry 15 \
  --retry-delay 2 \
  --retry-connrefused \
  --connect-timeout 3 \
  http://127.0.0.1:3000/ >/dev/null; then
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    ln -sfn "$PREVIOUS" "$APP_ROOT/current"
    sudo systemctl restart sozamen
  fi
  echo "Health check failed; the previous release was restored."
  exit 1
fi

echo "Successfully deployed $COMMIT"
```

Make it executable:

```bash
chmod 750 /var/www/sozamen/deploy.sh
```

The `NODE_BIN` setting is required because non-interactive SSH sessions do not
reliably load NVM. Section 7 creates this stable link to the supported Node.js
version.

The script copies any missing seeded product assets into persistent storage
before replacing the release-local upload paths with symlinks. `cp -n` does not
overwrite existing persistent images. The `rm -rf` targets are limited to the
new disposable release and never target `shared/uploads`. During initial setup,
inspect the paths with `ls -la` and confirm the symlinks point into
`shared/uploads`.

## 7. Configure systemd

This project uses Prisma 6, which supports Node.js 20. Node.js 22.23.2 was also
installed during setup, but its native HTTPS requests to the npm registry hung
on this VPS even though curl worked. The verified production runtime is
Node.js 20.20.2. As `sozamen`, install and select Node.js 20 with NVM:

```bash
nvm install 20
nvm alias default 20
nvm use 20
node --version
npm --version
```

Create a stable link so systemd and non-interactive deployments do not contain
a version number that changes after a Node.js update:

```bash
mkdir -p /home/sozamen/.local
ln -sfn "$(dirname "$(dirname "$(command -v node)")")" \
  /home/sozamen/.local/node-current
```

Confirm the resolved paths:

```bash
readlink -f /home/sozamen/.local/node-current
/home/sozamen/.local/node-current/bin/node --version
/home/sozamen/.local/node-current/bin/npm --version
```

Because this npm installation uses NVM, systemd also needs the linked Node.js
directory in `PATH`. Create `/etc/systemd/system/sozamen.service` with:

```ini
[Unit]
Description=Sozamen Next.js Shop
After=network.target

[Service]
Type=simple
User=sozamen
Group=sozamen
WorkingDirectory=/var/www/sozamen/current
Environment=NODE_ENV=production
Environment="PATH=/home/sozamen/.local/node-current/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"
ExecStart=/home/sozamen/.local/node-current/bin/npm start -- -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Allow the deployment user to restart only this service without entering a
password. Run `sudo visudo -f /etc/sudoers.d/sozamen-deploy` and add:

```sudoers
sozamen ALL=(root) NOPASSWD: /usr/bin/systemctl restart sozamen
```

Then load and enable the service after the first release exists:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sozamen
```

After changing the unit file, always run `daemon-reload`. Validate that systemd
can find Node.js through the configured path:

```bash
sudo systemctl restart sozamen
sudo systemctl status sozamen --no-pager
sudo journalctl -u sozamen -n 100 --no-pager
```

After installing a newer compatible Node.js 20 release with NVM, select it and
recreate the `node-current` link before restarting the service. A system-wide
production Node.js installation is another valid option and avoids NVM path
handling entirely.

## 8. Prepare Prisma migrations

Prisma has four related pieces in this project:

1. `prisma/schema.prisma` is the desired database design—the models, fields,
   relationships, defaults, and indexes the application expects.
2. Each `prisma/migrations/<name>/migration.sql` file is a versioned set of SQL
   instructions that changes a database from one known design to the next.
3. The `_prisma_migrations` table inside the database is Prisma's deployment
   history. It records which migration files have already been applied.
4. `prisma migrate dev` creates and tests migrations during development, while
   `prisma migrate deploy` applies already-committed pending migrations on the
   server. The production command does not invent or edit migration files.

For example, the initial migration creates the `User`, `Product`, `Comment`,
`Order`, and `OrderItem` tables. A later product-field change should generate a
second migration. Production applies only the migrations missing from its
`_prisma_migrations` history, in filename order.

`prisma migrate deploy` only applies migration files already committed under
`prisma/migrations`; it does not generate a migration from `schema.prisma`. This
repository now includes the initial migration named `20260904000000_init`.

For a fresh or empty production database, no special preparation is required:

```bash
npx prisma migrate deploy
```

If the production database was previously created with `prisma db push` and
already contains these tables or customer data, do **not** apply the initial
migration directly. Back it up, confirm that its schema matches the committed
Prisma schema, and baseline it:

```bash
cp --preserve=mode,timestamps /var/www/sozamen/shared/dev.db \
  /var/www/sozamen/backups/dev-before-migration-baseline.db
cd /var/www/sozamen/repository
ln -sfn /var/www/sozamen/shared/.env .env
npx prisma migrate diff \
  --from-url 'file:/var/www/sozamen/shared/dev.db' \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
npx prisma migrate resolve --applied 20260904000000_init
npx prisma migrate deploy
```

The diff command exits successfully with no SQL output when the database and
schema match. If it prints a schema difference, stop and review it instead of
marking the initial migration as applied.

For every future schema change, create and test a migration on the developer
machine, then commit both `schema.prisma` and the generated migration:

```bash
npx prisma migrate dev --name describe_the_change
npm run build
git add prisma/schema.prisma prisma/migrations
```

The VPS should run only `npx prisma migrate deploy`.

## 9. Create the GitHub Actions-to-VPS key

Create a second key on a trusted administrator computer. Do not reuse the
VPS-to-GitHub deploy key:

```bash
ssh-keygen -t ed25519 -C "github-actions-sozamen" -f sozamen_actions_key
```

Append `sozamen_actions_key.pub` to this file on the VPS:

```text
/home/sozamen/.ssh/authorized_keys
```

Apply the required permissions:

```bash
chmod 700 /home/sozamen/.ssh
chmod 600 /home/sozamen/.ssh/authorized_keys
chown -R sozamen:sozamen /home/sozamen/.ssh
```

Add these GitHub repository settings under **Settings -> Secrets and variables
-> Actions**:

| Type     | Name               | Value                                      |
| -------- | ------------------ | ------------------------------------------ |
| Secret   | `PROD_SSH_KEY`     | Entire private `sozamen_actions_key` file  |
| Secret   | `PROD_KNOWN_HOSTS` | Output of a verified VPS SSH host-key scan |
| Variable | `PROD_HOST`        | VPS hostname or IP address                 |
| Variable | `PROD_USER`        | `sozamen`                                  |

Generate the known-hosts value from a trusted computer. The value shown in the
question—including the `ssh-rsa`, ECDSA, and `ssh-ed25519` lines—is the correct
kind of content for `PROD_KNOWN_HOSTS`. Comment lines are harmless. Save the
complete multiline output as the secret, or save only a verified `ssh-ed25519`
entry:

```bash
ssh-keyscan -H -t ed25519 185.164.73.204
```

`ssh-keyscan` collects a key but does not prove its identity. On the VPS, obtain
the authoritative ED25519 fingerprint:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

On the trusted computer, save the scanned line and compare its fingerprint:

```bash
ssh-keyscan -H -t ed25519 185.164.73.204 > sozamen_known_hosts
ssh-keygen -lf sozamen_known_hosts
```

The SHA256 fingerprints must match. Do not disable SSH host-key checking. The
secret name is exactly `PROD_KNOWN_HOSTS`—with `KNOWN`, including the final `N`.

## 10. Current VPS checkpoint (2026-09-04)

Based on the setup reported so far:

- [x] The `sozamen` Linux user and `/var/www/sozamen` directories exist.
- [x] VPS-to-GitHub authentication works through `github-sozamen`.
- [x] The separate GitHub Actions public key is in the `sozamen` user's
      `authorized_keys` and has been tested.
- [x] `sozamen.service` has been created.
- [x] A valid-looking multiline SSH host-key scan has been collected for
      `PROD_KNOWN_HOSTS`.
- [x] Node.js 20.20.2 is installed and the stable `node-current` link resolves
      to it. Node.js 22.23.2 was rejected after its npm HTTPS traffic repeatedly
      stalled on this VPS.
- [x] The deployment PATH finds npm 10.9.8.
- [x] The deployment script passes `bash -n`, and the systemd unit passes
      `systemd-analyze verify`.
- [x] `sozamen.service` is enabled. It is inactive because no successful release
      has created `/var/www/sozamen/current` yet; this is expected.
- [x] `/var/www/sozamen/shared/dev.db` is a fresh zero-byte database. It does not
      need baselining; the first `prisma migrate deploy` will apply the initial
      migration normally.
- [x] SSH files have restrictive permissions, persistent upload directories are
      populated, and the deployment user can restart the service without a
      password.
- [x] Commit and push `prisma/migrations`, which is required by
      `prisma migrate deploy`.
- [x] Add `PROD_SSH_KEY` and the verified `PROD_KNOWN_HOSTS` as GitHub secrets.
- [x] Add `PROD_HOST` and `PROD_USER` as GitHub variables.
- [x] Add the GitHub Actions workflow and verify its SSH-key validation.
- [ ] Complete a deployment. This is paused because the cloud-provider/network
      path times out between GitHub-hosted runners and VPS port 22.

The sudo policy currently lists the same `systemctl restart sozamen` permission
twice. This is harmless, but one duplicate line can be removed from the sudoers
configuration later. The unfinished release
`133681e0421576a805f28983eb86569d271aa7c4` has no migrations and is not linked
as `current`; a new pushed commit receives a different release directory, so it
does not block the next deployment.

### Current pipeline decision

The GitHub-hosted runner pipeline remains in the repository but is paused. Two
runs reached the SSH command and timed out before authentication despite a valid
workflow, environment configuration, private key, reachable SSH service, and
successful SSH access from another external client. The remaining issue is in
the cloud-provider or network path rather than the project or key configuration.

Because the VPS can make outbound connections to GitHub, releases are currently
performed using the
[manual GitHub-to-VPS deployment guide](./github-vps-pull-deployment.md). It
requires no inbound GitHub-to-VPS connection and no polling timer.

Deployment work will continue later using the user's self-hosted GitLab. The
VPS release layout, `deploy.sh`, systemd service, shared directories, and Prisma
migration process can be reused. Only the CI configuration and runner-to-VPS
connection need to be adapted. Continue with the
[self-hosted GitLab deployment guide](./gitlab-vps-deployment-pipeline.md).

## 11. Add the GitHub Actions workflow

Create `.github/workflows/deploy.yml` in the repository:

```yaml
name: Deploy production

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: sozamen-production
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Configure SSH
        env:
          PROD_SSH_KEY: ${{ secrets.PROD_SSH_KEY }}
          PROD_KNOWN_HOSTS: ${{ secrets.PROD_KNOWN_HOSTS }}
        run: |
          install -m 700 -d ~/.ssh
          printf '%s\n' "$PROD_SSH_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          printf '%s\n' "$PROD_KNOWN_HOSTS" > ~/.ssh/known_hosts
          chmod 644 ~/.ssh/known_hosts
          test -s ~/.ssh/id_ed25519
          test -s ~/.ssh/known_hosts
          ssh-keygen -y -f ~/.ssh/id_ed25519 > /dev/null

      - name: Deploy exact commit
        env:
          PROD_HOST: ${{ vars.PROD_HOST }}
          PROD_USER: ${{ vars.PROD_USER }}
        run: |
          ssh -i ~/.ssh/id_ed25519 \
            -o IdentitiesOnly=yes \
            -o ConnectTimeout=20 \
            "$PROD_USER@$PROD_HOST" \
            "/var/www/sozamen/deploy.sh '${{ github.sha }}'"
```

Optionally enable required reviewers for the GitHub `production` environment if
deployments should need manual approval later.

## 12. Perform the first deployment

Before relying on automation, test the same path manually on the VPS:

```bash
cd /var/www/sozamen/repository
git fetch origin main
git rev-parse origin/main
/var/www/sozamen/deploy.sh FULL_40_CHARACTER_COMMIT_SHA
```

Then verify:

```bash
readlink -f /var/www/sozamen/current
sudo systemctl status sozamen --no-pager
curl -I http://127.0.0.1:3000
sudo journalctl -u sozamen -n 100 --no-pager
```

After the manual deployment succeeds, push a harmless documentation change to
`main` and confirm the GitHub Actions run completes.

Because the current database is fresh, seed the demo accounts and products once
after the first successful deployment:

```bash
cd /var/www/sozamen/current
export PATH="/home/sozamen/.local/node-current/bin:$PATH"
npm run db:seed
```

Do not add the seed command to routine deployments. Running schema migrations
and inserting application/demo data are separate operations.

## 13. Normal update procedure

For each application update:

1. Develop and test locally on a feature branch.
2. Commit the intended files.
3. Merge or push the tested commit to `main`.
4. GitHub Actions connects to the VPS and passes the exact commit SHA.
5. The VPS builds a new release without changing the running release.
6. After a successful build and schema update, `current` switches to the new
   release.
7. systemd restarts Next.js and the script checks the home page.
8. If the health check fails, the script points `current` back to the previous
   release and restarts it.

Monitor the GitHub Actions run and verify at least the home page, login, shop,
cart, customer orders, and admin orders after a meaningful release.

## 14. Manual rollback

List releases in deployment order:

```bash
ls -lt /var/www/sozamen/releases
readlink -f /var/www/sozamen/current
```

Point `current` to a known-good release and restart:

```bash
ln -sfn /var/www/sozamen/releases/KNOWN_GOOD_COMMIT \
  /var/www/sozamen/current
sudo systemctl restart sozamen
curl -I http://127.0.0.1:3000
```

Application rollback does not automatically roll back a database schema. This
is one reason to use backward-compatible migrations before production usage.
Restore a database backup only after understanding the data-loss impact.

## 15. Operational checks

Useful commands:

```bash
sudo systemctl status sozamen --no-pager
sudo journalctl -u sozamen -f
curl -I http://127.0.0.1:3000
git -C /var/www/sozamen/repository remote -v
git -C /var/www/sozamen/repository log -1 --oneline origin/main
readlink -f /var/www/sozamen/current
df -h
```

Periodically remove old releases and backups only after confirming they are not
the active release and after retaining enough history for recovery. Deletion is
deliberately not automated in this MVP runbook.

## 16. Troubleshooting log

Use this format for future entries:

```text
Date:
Stage:
Symptom/error:
Cause:
Resolution:
Prevention/document change:
```

### 2026-09-04 - Repository clone failed with `Permission denied (publickey)`

- **Stage:** Initial VPS-to-GitHub setup.
- **Symptom:** `ssh -T git@github-sozamen` succeeded, but cloning with
  `git@github.com:Mohammadreza-Tatlari/sozamen.git` failed.
- **Cause:** The successful SSH test used the `github-sozamen` host alias, which
  selects `~/.ssh/github_deploy_key`. The clone used `github.com` directly, so
  the alias-specific identity was not selected.
- **Resolution:** Clone with
  `git@github-sozamen:Mohammadreza-Tatlari/sozamen.git`, or update the existing
  `origin` URL to use that alias.
- **Prevention:** Keep `IdentitiesOnly yes` in the SSH alias and use the alias in
  every repository remote URL on this VPS.

### 2026-09-04 - GitHub-hosted runner timed out connecting to VPS port 22

- **Stage:** First GitHub Actions deployment.
- **Symptom:** The deploy job reported
  `ssh: connect to host 185.164.73.204 port 22: Connection timed out`.
- **Meaning:** The TCP connection was not established, so SSH never attempted
  public-key authentication. Missing or invalid keys instead normally produce
  a key-loading error or `Permission denied (publickey)`.
- **Verified:** The `production` environment contains the correctly named
  secrets and variables. The VPS SSH service is active and listening on both
  `0.0.0.0:22` and `[::]:22`, and an external key-based connection succeeds.
  `fail2ban` is active.
- **Workflow improvement:** Validate that the secret files are non-empty, parse
  the private key with `ssh-keygen`, explicitly select it using `ssh -i`, enable
  `IdentitiesOnly`, and use a 20-second connection timeout.
- **Root-level checks:** On the VPS, run:

  ```bash
  sudo ufw status verbose
  sudo fail2ban-client status
  sudo fail2ban-client status sshd
  sudo journalctl -u ssh --since "30 minutes ago" --no-pager
  sudo ss -ltnp | grep ':22'
  ```

  If the GitHub attempt does not appear in the SSH journal, traffic is being
  dropped before it reaches `sshd`, usually by UFW, the hosting-provider
  firewall, fail2ban, or an upstream network path. Do not disable the firewall
  or SSH host-key checking. Review the narrow rule or ban responsible.

- **Next diagnostic:** Re-run the job once. GitHub-hosted runners are ephemeral,
  so a retry uses another runner and may distinguish a transient route or banned
  source address from a persistent firewall policy. If every runner times out,
  inspect the VPS provider firewall and consider a self-hosted runner or a
  server-side pull timer rather than broadly opening SSH to large address
  ranges.
- **Second-run result:** The corrected workflow validated and explicitly loaded
  `~/.ssh/id_ed25519`, but SSH timed out again before authentication.
- **Conclusion:** The cloud-provider/network path is preventing GitHub-hosted
  runners from reaching VPS port 22. The workflow, secrets, variables, and SSH
  key are not the cause.
- **Status:** GitHub deployment is paused. The configuration is retained for
  reference, and deployment work will continue later using self-hosted GitLab.

## 17. Future production improvements

Before this MVP serves important customer traffic:

- Move SQLite to PostgreSQL or another managed production database.
- Move uploads to object storage with durable backups.
- Add a dedicated health endpoint that also checks required dependencies.
- Add automated tests before the deployment job.
- Add monitoring, alerting, log retention, and scheduled restore tests.
- Consider two application instances with a load balancer for deployments
  without a restart interruption.
