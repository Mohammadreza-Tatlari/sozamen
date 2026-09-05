# Manual GitHub-to-VPS pull deployment

This guide is the current GitHub deployment method for Sozamen. The VPS can
reach GitHub, but GitHub-hosted runners cannot reach the VPS on port 22. An
administrator therefore starts each deployment manually from the VPS.

No timer, cron job, webhook, or GitHub Actions connection is used. The existing
release layout, persistent files, Prisma migrations, systemd service, health
check, and rollback behavior remain unchanged.

## 1. Deployment flow

```text
Developer
    |
    | push or merge reviewed changes to main
    v
GitHub repository
    ^
    | administrator manually fetches from VPS
    |
VPS /var/www/sozamen/repository
    |
    | resolve exact origin/main commit SHA
    | run /var/www/sozamen/deploy.sh <SHA>
    v
New release -> Prisma migrate -> build -> symlink -> restart -> health check
```

The VPS initiates every network connection. GitHub never needs inbound access
to the server.

## 2. Prerequisites already completed

The VPS audit confirmed:

- The `sozamen` account exists.
- `/var/www/sozamen/repository` is cloned.
- Its `origin` uses
  `git@github-sozamen:Mohammadreza-Tatlari/sozamen.git`.
- The read-only GitHub deploy key and SSH alias work.
- `/var/www/sozamen/deploy.sh` accepts a full commit SHA.
- Node.js 20.20.2 is available through `/home/sozamen/.local/node-current`.
- `sozamen` can restart only `sozamen.service` without a password.
- Persistent `.env`, SQLite, uploads, releases, and backups are prepared.

Before the first deployment, ensure `main` contains:

```text
prisma/migrations/migration_lock.toml
prisma/migrations/20260904000000_init/migration.sql
```

## 3. Protect `main`

The manual procedure deploys `origin/main`, so protect that branch:

1. Open the GitHub repository rulesets or **Settings -> Branches**.
2. Create a protection rule for `main`.
3. Require pull-request review when multiple contributors are involved.
4. Prevent force pushes and branch deletion.
5. Restrict direct pushes as appropriate for the team.

The VPS GitHub deploy key should remain read-only.

## 4. Deploy the latest `main` manually

Connect to the VPS and switch to the application user:

```bash
ssh YOUR_ADMIN_USER@185.164.73.204
sudo -iu sozamen
```

Verify GitHub authentication when necessary:

```bash
ssh -T git@github-sozamen
```

Fetch GitHub without changing the working repository checkout:

```bash
git -C /var/www/sozamen/repository fetch --prune origin main
```

Inspect the commit that will be deployed:

```bash
git -C /var/www/sozamen/repository log -1 \
  --format='%H %an %ad%n%s' origin/main
```

If it is the intended commit, resolve and deploy its full SHA:

```bash
TARGET_COMMIT="$(git -C /var/www/sozamen/repository rev-parse origin/main)"
/var/www/sozamen/deploy.sh "$TARGET_COMMIT"
```

Do not use an ordinary `git pull` inside a release directory. `deploy.sh`
creates an isolated release for the exact commit, applies migrations, builds it,
switches the `current` symlink, restarts the application, and checks its health.

For the temporary preview gate, add this only to
`/var/www/sozamen/shared/.env` before deploying:

```env
PREVIEW_PASSWORD="use-a-unique-temporary-password"
PREVIEW_COOKIE_SECURE="true"
```

Do not commit the real password. Because each release links the shared `.env`,
the setting survives future deployments. Restarting the application is required
after changing or removing it.

Apply an environment-only change without rebuilding:

```bash
sudo systemctl restart sozamen
sudo systemctl status sozamen --no-pager
```

Keep `PREVIEW_COOKIE_SECURE` set to `true` when using HTTPS. If you are still
temporarily opening `http://SERVER_IP:3000`, set it to `false`; otherwise the
browser will not send the preview cookie over the unencrypted connection. This
HTTP exception is only suitable for a short test because the password itself is
not encrypted in transit.

## 5. Verify the deployment

```bash
readlink -f /var/www/sozamen/current
git -C /var/www/sozamen/repository rev-parse origin/main
systemctl status sozamen --no-pager
curl -I http://127.0.0.1:3000
journalctl -u sozamen -n 200 --no-pager
```

The last directory in the `current` path should match the `origin/main` commit
SHA. Then verify the home page, login, products and images, cart and checkout,
customer orders, and admin order management.

## 6. First-deployment database seed

The current production SQLite database was observed as fresh and zero bytes.
The first `deploy.sh` run applies the committed initial Prisma migration and
creates the tables.

After that first successful deployment, seed demo data exactly once:

```bash
cd /var/www/sozamen/current
export PATH="/home/sozamen/.local/node-current/bin:$PATH"
npm run db:seed
```

Do not run the seed command during routine deployments.

## 7. Normal update procedure

For every later update:

1. Develop and test locally.
2. If the Prisma schema changes, create and commit a migration with
   `npx prisma migrate dev --name describe_the_change`.
3. Merge the reviewed change into `main`.
4. Connect to the VPS and switch to `sozamen`.
5. Fetch `origin/main` and inspect its commit.
6. Run `deploy.sh` with that exact SHA.
7. Verify the application and logs.

This is manual continuous delivery: pushing code makes it available for
deployment, but a human explicitly decides when production changes.

## 8. Failure behavior

- A GitHub, DNS, or network failure prevents `git fetch` but does not affect the
  running release.
- A dependency, formatting, migration, or build failure occurs before the
  `current` symlink changes, so the previous release stays active.
- A post-restart health-check failure makes `deploy.sh` restore the previous
  release.
- The deployment script backs up a nonempty SQLite database before applying
  migrations.

Inspect a failure with:

```bash
journalctl -u sozamen -n 300 --no-pager
readlink -f /var/www/sozamen/current
ls -lt /var/www/sozamen/releases
```

### Health check runs before Next.js is ready

Next.js can take several seconds to listen after systemd restarts it. A plain
`curl --retry` does not retry a refused TCP connection by default, so the
deployment may incorrectly report this failure and restore the previous
release:

```text
curl: (7) Failed to connect to 127.0.0.1 port 3000
Health check failed; the previous release was restored.
```

Use this complete health-check block in `/var/www/sozamen/deploy.sh`:

```bash
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
```

Replace the old block instead of inserting this below its first line. If two
`if ! curl` lines are accidentally combined, curl interprets shell words such
as `if` and `curl` as hostnames and reports `Could not resolve host: if`.
Always validate the edited script before deploying:

```bash
bash -n /var/www/sozamen/deploy.sh
```

After a successful run, confirm both the selected release and local HTTP
response:

```bash
readlink -f /var/www/sozamen/current
systemctl status sozamen --no-pager
curl -I http://127.0.0.1:3000
```

### Preview password repeatedly returns to the access page

When the application is temporarily accessed at `http://SERVER_IP:3000`, a
cookie marked `Secure` is intentionally not sent by the browser. Set the
persistent VPS environment to the HTTP-only testing value:

```env
PREVIEW_COOKIE_SECURE="false"
```

Restart `sozamen.service`, then submit the preview password again. Change this
setting back to `true` as soon as Nginx and HTTPS are enabled. The application
source, database, and dependencies do not need to be rebuilt for this setting.

### `npm ci` appears to run forever

The first production attempts on 2026-09-04 remained inside `npm ci` for many
minutes. Their npm debug logs showed repeated `ETIMEDOUT` and `ECONNRESET`
errors while downloading package tarballs from `registry.npmjs.org`. CPU and
memory were not the cause, and the release had not reached Prisma, Next.js
build, symlink switching, or service restart.

Further testing identified the cause: real package tarballs downloaded quickly
over IPv4, while the same registry endpoint timed out over IPv6. A successful
`curl -I` request therefore did not prove that npm's full download path worked.

If there has been no new npm log activity and no network socket for several
minutes, interrupt the original deployment with `Ctrl+C`. This is safe while
`current` has not switched. Confirm it stopped:

```bash
pgrep -af 'deploy.sh|npm ci'
```

Check connectivity and npm's cache:

```bash
curl -I --connect-timeout 10 --max-time 20 https://registry.npmjs.org/
npm cache verify
```

Add this after the deployment script exports its Node.js `PATH`:

```bash
export NODE_OPTIONS="--dns-result-order=ipv4first"
```

This makes Node prefer the working IPv4 addresses instead of waiting on the
broken IPv6 route. Also change the install line in
`/var/www/sozamen/deploy.sh` from `npm ci` to:

```bash
timeout 20m npm ci --no-audit --no-fund --prefer-offline
```

This reuses valid cached downloads, skips the nonessential audit request during
deployment, and stops the release after 20 minutes if registry connectivity is
still unusable. Re-run `bash -n /var/www/sozamen/deploy.sh`, then run the same
exact-SHA deployment command again. `npm ci` recreates its installation from the
lockfile, so the partial `node_modules` directory is not a completed release.

On the second manual diagnosis, npm still stalled with IPv4-first DNS and one
download socket. A direct Node.js 22 HTTPS request also hung, while curl
downloaded the same package quickly. Node.js 20.20.2 was then installed with
NVM; its HTTPS test succeeded and `npm ci` installed all 70 packages in about
one minute. The stable `node-current` link now points to Node.js 20.20.2.

The remaining steps were completed manually: formatting passed, Prisma Client
was generated, migration `20260904000000_init` was applied, Next.js compiled and
generated all 17 pages, `current` was switched to commit
`38e777b5950db2d8d568e1e6ece7552837ba5311`, and the service returned HTTP 200.
The one-time seed created 5 users and 6 products.

## 9. Disable unused automation

The timer-based polling design is not being used. Do not create or enable these
units:

```text
sozamen-deploy-poll.service
sozamen-deploy-poll.timer
```

If they were previously installed, stop and disable the timer:

```bash
sudo systemctl disable --now sozamen-deploy-poll.timer
```

The GitHub Actions SSH workflow is also known to time out through the cloud
provider. Disable its push trigger or disable the workflow in GitHub so routine
pushes do not create expected failures. Disabling deployment automation does
not stop the running `sozamen.service`.

## 10. Manual-deployment checklist

- [ ] Latest `main` contains the initial Prisma migration.
- [ ] `main` is protected.
- [ ] VPS-to-GitHub deploy key works.
- [ ] `git fetch origin main` succeeds as `sozamen`.
- [ ] Intended commit inspected before deployment.
- [ ] `deploy.sh` completed successfully.
- [ ] `current` matches the intended SHA.
- [ ] Application service and HTTP health check pass.
- [ ] Demo data seeded once after the first deployment.
- [ ] GitHub Actions push trigger disabled.
- [ ] No deployment polling timer is enabled.

## 11. Future automation

Manual deployment can later be replaced without changing the release layout:

- Restore VPS polling with a systemd timer.
- Use a self-hosted GitLab Runner to push release archives to the VPS.
- Use another trusted self-hosted runner that can reach port 22.

Until then, the manual exact-SHA procedure is simple, auditable, and compatible
with the current network restrictions.
