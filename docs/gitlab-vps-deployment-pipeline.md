# Self-hosted GitLab to VPS deployment pipeline

This guide recreates the existing GitHub Actions deployment flow with
self-hosted GitLab CI/CD. A push to the protected default branch starts a
GitLab Runner job, which packages the exact checked-out commit and pushes it to
the Sozamen VPS for deployment.

Read the existing [GitHub-to-VPS deployment runbook](./github-vps-deployment-pipeline.md)
first. The VPS release directories, persistent storage, Prisma migrations,
systemd service, health check, and rollback process remain unchanged.

## 1. Recommended architecture

```text
Developer
    |
    | git push to protected default branch
    v
Self-hosted GitLab
    |
    | assigns deploy job over HTTPS
    v
Dedicated GitLab Runner (Docker executor)
    |
    | checks out CI_COMMIT_SHA from private GitLab
    | creates source archive
    | SCP archive and SSH command to 185.164.73.204:22
    v
/var/www/sozamen/deploy-artifact.sh <CI_COMMIT_SHA>
    |
    | extract exact source archive
    | create and build a release
    | apply committed Prisma migrations
    | switch current symlink
    | restart and health-check systemd service
    v
Sozamen production application
```

Use a dedicated runner machine that is separate from both the GitLab server and
the production VPS when possible. The runner must be able to:

- Reach the self-hosted GitLab HTTPS URL.
- Reach `185.164.73.204` on TCP port 22.
- Pull the small CI image used by the pipeline, unless it is hosted locally.

This design avoids depending on GitHub-hosted runner addresses. Before doing
anything else, test from the future runner machine:

```bash
curl -I https://gitlab.example.com
nc -vz -w 10 185.164.73.204 22
```

Replace `gitlab.example.com` with the real self-hosted GitLab hostname. If the
port-22 test fails, solve that network path before configuring CI.

## 2. One-way network architecture

The private GitLab does not need to accept connections from the production VPS.
The GitLab Runner checks out the repository because it can reach GitLab, then
pushes an archive to the VPS because it can reach remote hosts.

Only one deployment SSH identity is required:

| Connection           | Purpose                       | Private key location       | Public key location                  |
| -------------------- | ----------------------------- | -------------------------- | ------------------------------------ |
| GitLab Runner to VPS | Upload archive and run deploy | GitLab CI/CD file variable | `/home/sozamen/.ssh/authorized_keys` |

The VPS no longer runs `git fetch` during GitLab deployments. This means:

- GitLab may remain private and unreachable from the public internet.
- The runner must be inside a network that can reach GitLab.
- The runner must have outbound access to the VPS on port 22.
- The source received by the VPS is still tied to GitLab's exact
  `CI_COMMIT_SHA`.

Do not reuse a personal SSH key. Keep the old GitHub keys until the GitLab
deployment has been tested, then revoke keys that are no longer needed.

## 3. Mirror or move the repository to GitLab

Create a private project in the self-hosted GitLab instance. From a trusted
developer computer, add GitLab as a second remote first so GitHub remains
available during the transition:

```bash
git remote add gitlab git@gitlab.example.com:YOUR_GROUP/sozamen.git
git push -u gitlab main
git push gitlab --tags
```

Confirm that these important deployment files appear in GitLab:

```text
.gitlab-ci.yml
prisma/migrations/migration_lock.toml
prisma/migrations/20260904000000_init/migration.sql
```

Do not delete the GitHub repository or its remote during initial testing.

## 4. Prepare the VPS for pushed release archives

The VPS does not need a GitLab deploy key, GitLab DNS, or network access to the
GitLab server. Keep `/var/www/sozamen/repository` only for the paused GitHub
workflow or manual recovery; the GitLab pipeline will not use it.

Create an incoming directory:

```bash
sudo mkdir -p /var/www/sozamen/incoming
sudo chown sozamen:sozamen /var/www/sozamen/incoming
sudo chmod 750 /var/www/sozamen/incoming
sudo -iu sozamen
```

Create `/var/www/sozamen/deploy-artifact.sh` as `sozamen`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="/var/www/sozamen"
RELEASES="$APP_ROOT/releases"
SHARED="$APP_ROOT/shared"
BACKUPS="$APP_ROOT/backups"
INCOMING="$APP_ROOT/incoming"
COMMIT="${1:-}"
NODE_BIN="/home/sozamen/.local/node-current/bin"
export PATH="$NODE_BIN:$PATH"
export NODE_OPTIONS="--dns-result-order=ipv4first"

if [[ ! "$COMMIT" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "A full 40-character Git commit SHA is required."
  exit 1
fi

ARCHIVE="$INCOMING/$COMMIT.tar.gz"
RELEASE="$RELEASES/$COMMIT"
PREVIOUS="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"

if [[ ! -s "$ARCHIVE" ]]; then
  echo "Release archive is missing or empty: $ARCHIVE"
  exit 1
fi

if [[ "$PREVIOUS" == "$RELEASE" ]]; then
  echo "$COMMIT is already the active release."
  exit 0
fi

rm -rf "$RELEASE"
mkdir -p "$RELEASE"
tar -xzf "$ARCHIVE" -C "$RELEASE"

ln -sfn "$SHARED/.env" "$RELEASE/.env"
mkdir -p "$RELEASE/public/uploads"
cp -an "$RELEASE/public/uploads/products/." "$SHARED/uploads/products/"
rm -rf "$RELEASE/public/uploads/products" "$RELEASE/public/uploads/profiles"
ln -sfn "$SHARED/uploads/products" "$RELEASE/public/uploads/products"
ln -sfn "$SHARED/uploads/profiles" "$RELEASE/public/uploads/profiles"

cd "$RELEASE"
timeout 20m npm ci --no-audit --no-fund --prefer-offline
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

if ! curl --fail --silent --show-error --retry 10 --retry-delay 2 \
  http://127.0.0.1:3000/ >/dev/null; then
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    ln -sfn "$PREVIOUS" "$APP_ROOT/current"
    sudo systemctl restart sozamen
  fi
  echo "Health check failed; the previous release was restored."
  exit 1
fi

rm -f "$ARCHIVE"
echo "Successfully deployed $COMMIT from GitLab artifact"
```

Protect and validate it:

```bash
chmod 750 /var/www/sozamen/deploy-artifact.sh
bash -n /var/www/sozamen/deploy-artifact.sh
```

The destructive commands are restricted to a release path derived from a
validated 40-character SHA. Shared data is never removed, and a failed build
leaves the previous `current` release active.

## 5. Create a GitLab-specific Runner-to-VPS key

On a trusted administrator computer—not in the repository—create a second key:

```bash
ssh-keygen -t ed25519 -C "gitlab-runner-sozamen-production" \
  -f sozamen_gitlab_runner_key
```

Append `sozamen_gitlab_runner_key.pub` to:

```text
/home/sozamen/.ssh/authorized_keys
```

On the VPS, restore strict ownership and permissions:

```bash
sudo chown -R sozamen:sozamen /home/sozamen/.ssh
sudo chmod 700 /home/sozamen/.ssh
sudo chmod 600 /home/sozamen/.ssh/authorized_keys
```

Test from the future runner machine or another trusted machine:

```bash
ssh -i ./sozamen_gitlab_runner_key \
  -o IdentitiesOnly=yes \
  sozamen@185.164.73.204
```

Keep the private key only for the GitLab CI/CD variable created in section 8.

## 6. Install a dedicated GitLab Runner

Create a project runner in GitLab:

1. Open the project.
2. Go to **Settings -> CI/CD -> Runners**.
3. Select **Create project runner**.
4. Add the tag `sozamen-deploy`.
5. Disable **Run untagged jobs**.
6. Mark the runner as **Protected** so it runs jobs only on protected refs.
7. Copy the runner authentication token. Modern tokens start with `glrt-`.

Install GitLab Runner on the dedicated runner machine by following the official
package instructions for that operating system. Install Docker as well, then
register the runner:

```bash
sudo gitlab-runner register
```

Use these answers:

```text
GitLab instance URL: https://gitlab.example.com
Runner token:        glrt-REPLACE_WITH_PROJECT_RUNNER_TOKEN
Description:         sozamen-production-deploy
Tags:                sozamen-deploy
Executor:            docker
Default image:       alpine:3.22
```

Verify it:

```bash
sudo gitlab-runner verify
sudo systemctl status gitlab-runner --no-pager
```

The runner should show as online in the project's runner settings. Assign this
runner only to this trusted project; do not expose it as an unprotected shared
runner.

## 7. Protect the deployment branch

Protect the default branch before exposing production credentials to CI:

1. Open **Settings -> Repository -> Protected branches**.
2. Protect `main`, or the actual default branch.
3. Allow merges only for trusted maintainers or the intended review role.
4. Restrict direct pushes according to the team's workflow.
5. Require merge-request review when more people begin contributing.

The pipeline variables and runner should also be protected. This ensures an
unprotected feature branch cannot request production credentials or the
production runner.

## 8. Add GitLab CI/CD variables

In the project, open **Settings -> CI/CD -> Variables** and create:

| Key               | Type     | Value                                 | Protected | Environment scope |
| ----------------- | -------- | ------------------------------------- | --------- | ----------------- |
| `SSH_PRIVATE_KEY` | File     | Full GitLab Runner-to-VPS private key | Yes       | `production`      |
| `SSH_KNOWN_HOSTS` | File     | Verified VPS `ssh-keyscan` output     | Yes       | `production`      |
| `PROD_HOST`       | Variable | `185.164.73.204`                      | Yes       | `production`      |
| `PROD_USER`       | Variable | `sozamen`                             | Yes       | `production`      |

For the private key:

- Include the complete `BEGIN OPENSSH PRIVATE KEY` and `END` lines.
- Add a final newline after the ending line.
- GitLab's official SSH guidance uses a **File** variable.
- Multiline SSH keys cannot satisfy GitLab's masked-variable restrictions. Use
  the File type, do not print the variable, protect it, and limit its
  environment scope.

For known hosts, reuse the previously verified host-key data or collect it from
a trusted computer:

```bash
ssh-keyscan -H -t ed25519 185.164.73.204
```

Do not run `ssh-keyscan` inside the CI job. A live scan during the job would
trust whichever host answered at deployment time and weaken host verification.

## 9. Create `.gitlab-ci.yml`

Create this file at the repository root:

```yaml
stages:
  - deploy

workflow:
  rules:
    - if: "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH"
    - when: never

deploy_production:
  stage: deploy
  image: alpine:3.22
  tags:
    - sozamen-deploy
  environment:
    name: production
  resource_group: sozamen-production
  before_script:
    - apk add --no-cache openssh-client
    - install -m 700 -d ~/.ssh
    - install -m 600 "$SSH_PRIVATE_KEY" ~/.ssh/id_ed25519
    - install -m 644 "$SSH_KNOWN_HOSTS" ~/.ssh/known_hosts
    - test -s ~/.ssh/id_ed25519
    - test -s ~/.ssh/known_hosts
    - ssh-keygen -y -f ~/.ssh/id_ed25519 > /dev/null
  script:
    - ARCHIVE="/tmp/sozamen-${CI_COMMIT_SHA}.tar.gz"
    - REMOTE_ARCHIVE="/var/www/sozamen/incoming/${CI_COMMIT_SHA}.tar.gz"
    - >-
      tar
      --exclude=.git
      --exclude=.env
      --exclude=.next
      --exclude=node_modules
      --exclude='prisma/*.db*'
      -czf "$ARCHIVE" .
    - >-
      scp -i ~/.ssh/id_ed25519
      -o IdentitiesOnly=yes
      -o ConnectTimeout=20
      "$ARCHIVE"
      "${PROD_USER}@${PROD_HOST}:${REMOTE_ARCHIVE}.part"
    - >-
      ssh -i ~/.ssh/id_ed25519
      -o IdentitiesOnly=yes
      -o ConnectTimeout=20
      "$PROD_USER@$PROD_HOST"
      "mv '${REMOTE_ARCHIVE}.part' '$REMOTE_ARCHIVE' &&
      /var/www/sozamen/deploy-artifact.sh '$CI_COMMIT_SHA'"
```

What this configuration does:

- Creates pipelines only for the default branch.
- Selects only the protected runner tagged `sozamen-deploy`.
- Uses an isolated Alpine container for the job.
- Installs only the SSH client required by the deployment job.
- Uses GitLab File variables without exposing their contents.
- Validates the private key before connecting.
- Uses `CI_COMMIT_SHA`, GitLab's full SHA for the exact pushed commit.
- Packages the runner's checked-out commit, uploads it atomically with a `.part`
  suffix, and then invokes the artifact deployment script.
- Uses `resource_group` to prevent two production deployments from running at
  the same time.
- Records the job as a deployment to the `production` environment.

The application is built on the VPS by `deploy-artifact.sh`, so this CI job does
not need Node.js, npm, or Prisma. GitLab Runner's normal checkout supplies the
exact source commit for the archive.

## 10. Validate before the first deployment

Complete these checks in order:

1. The dedicated runner is online and protected.
2. `main` is protected.
3. All four variables exist and are protected with environment scope
   `production`.
4. The runner host reaches GitLab over HTTPS and the VPS on port 22.
5. The Runner-to-VPS key can authenticate as `sozamen`.
6. `/var/www/sozamen/incoming` exists and is writable by `sozamen`.
7. `/var/www/sozamen/deploy-artifact.sh` passes `bash -n`.
8. The zero-byte SQLite database remains backed by the committed initial Prisma
   migration.

Useful VPS checks:

```bash
sudo -iu sozamen
test -w /var/www/sozamen/incoming
bash -n /var/www/sozamen/deploy-artifact.sh
readlink -f /home/sozamen/.local/node-current
```

## 11. First deployment

Commit `.gitlab-ci.yml` and push it to the protected default branch. Watch the
job under **Build -> Pipelines**.

The job should:

1. Start on the `sozamen-deploy` runner.
2. Validate the SSH files.
3. Package the checked-out `CI_COMMIT_SHA`.
4. Upload the archive to the VPS and invoke `deploy-artifact.sh`.
5. Extract it into a new release.
6. Run `npm ci` and formatting checks.
7. Run `prisma migrate deploy`, which creates the fresh production schema.
8. Build the application.
9. Switch `/var/www/sozamen/current`.
10. Restart `sozamen.service` and pass the health check.

Verify on the VPS:

```bash
readlink -f /var/www/sozamen/current
sudo systemctl status sozamen --no-pager
sudo journalctl -u sozamen -n 100 --no-pager
curl -I http://127.0.0.1:3000
```

Because the current production database is fresh, seed it exactly once after
the first successful deployment:

```bash
sudo -iu sozamen
cd /var/www/sozamen/current
export PATH="/home/sozamen/.local/node-current/bin:$PATH"
npm run db:seed
```

Do not add seeding to normal deployments.

## 12. Normal deployment flow

After setup, routine deployment is:

1. Create a feature branch.
2. Develop and test locally.
3. For schema changes, run `npx prisma migrate dev --name change_name` and
   commit both the schema and generated migration.
4. Open and review a merge request.
5. Merge into the protected default branch.
6. GitLab creates the pipeline.
7. The protected runner performs the SSH deployment.
8. The VPS deployment script builds, migrates, switches, restarts, and verifies
   the release.

The existing rollback commands and database warnings in the GitHub-to-VPS
runbook still apply.

## 13. Troubleshooting

### Job remains pending

Check that:

- The runner is online.
- The runner has the `sozamen-deploy` tag.
- The runner is allowed to run protected jobs.
- The branch is protected.
- The job tag and runner tag match exactly.

### A variable is empty

Check that:

- The pipeline runs on a protected branch.
- The variable is protected.
- Its environment scope matches `production`.
- The job declares `environment: name: production`.

Do not debug this by printing all environment variables or private-key content.

### `error in libcrypto`

Edit the `SSH_PRIVATE_KEY` File variable and add a newline after the final
`-----END OPENSSH PRIVATE KEY-----` line.

### `Host key verification failed`

Confirm that `SSH_KNOWN_HOSTS` is a File variable and contains the verified key
for the exact hostname or IP stored in `PROD_HOST`. Do not disable
`StrictHostKeyChecking`.

### `Permission denied (publickey)`

The network connection succeeded, but authentication failed. Confirm that:

- `SSH_PRIVATE_KEY` contains the Runner-to-VPS private key.
- Its matching public key is in `/home/sozamen/.ssh/authorized_keys`.
- `/home/sozamen/.ssh` is mode `700`.
- `authorized_keys` and the private key are mode `600`.
- The deployment uses the `sozamen` account.

### Connection to port 22 times out

Test from the runner host itself:

```bash
nc -vz -w 10 185.164.73.204 22
```

If this fails, inspect the VPS/provider firewall and fail2ban before retrying CI.
The self-hosted runner has a stable source address, so the firewall can allow
only that address rather than GitHub's changing hosted-runner ranges.

### VPS cannot reach GitLab

This is expected in the one-way design. The VPS does not fetch source from
GitLab. Confirm instead that the runner successfully checked out the commit and
that `scp` created this file before invoking the deployment script:

```text
/var/www/sozamen/incoming/<CI_COMMIT_SHA>.tar.gz
```

If upload fails, verify the incoming-directory permissions and Runner-to-VPS
SSH key.

### `prisma migrate deploy` fails

Do not run `db push` as a shortcut and do not delete migration history. Capture:

```bash
cd /var/www/sozamen/current
export PATH="/home/sozamen/.local/node-current/bin:$PATH"
npx prisma migrate status
sudo journalctl -u sozamen -n 100 --no-pager
```

Restore application availability using the documented release rollback, then
review the failed migration before changing the database.

## 14. Same-VPS runner fallback

This fallback works only if the production VPS can reach GitLab. In the current
network it cannot, so do not install the runner directly on the production VPS
unless private routing or a VPN is added later.

If connectivity changes, it is technically possible to install a
project-specific shell runner on production and invoke the deployment locally,
but it is not the recommended first choice:

- Shell jobs execute directly on the runner host.
- A malicious or mistaken CI change can access the production machine.
- The runner user needs narrowly designed permission to invoke deployment.
- Application builds consume production CPU, memory, and disk either way.

Use this only for a private project with trusted maintainers, a protected
default branch, a protected project runner, mandatory review of CI changes, and
least-privilege sudo rules. Do not register the production runner as a shared
instance runner.

## 15. Migration checklist from GitHub to GitLab

- [ ] Self-hosted GitLab project created.
- [ ] Repository and tags pushed to GitLab.
- [ ] Dedicated runner machine can reach GitLab and VPS port 22.
- [ ] Protected project runner registered with the `sozamen-deploy` tag.
- [ ] Default branch protected.
- [ ] `/var/www/sozamen/incoming` created with correct permissions.
- [ ] `/var/www/sozamen/deploy-artifact.sh` installed and syntax-checked.
- [ ] GitLab-specific Runner-to-VPS key added and tested.
- [ ] Four protected, production-scoped CI/CD variables created.
- [ ] `.gitlab-ci.yml` committed and validated.
- [ ] First pipeline succeeded.
- [ ] systemd service and health endpoint verified.
- [ ] Demo data seeded once.
- [ ] Rollback tested.
- [ ] Unused GitHub deployment credentials revoked after the transition.

## 16. Official GitLab references

- [Install GitLab Runner](https://docs.gitlab.com/runner/install/)
- [Register a runner](https://docs.gitlab.com/runner/register/)
- [GitLab Runner security](https://docs.gitlab.com/runner/security/)
- [Use SSH keys in GitLab CI/CD](https://docs.gitlab.com/ci/jobs/ssh_keys/)
- [CI/CD variables](https://docs.gitlab.com/ci/variables/)
- [GitLab CI/CD YAML reference](https://docs.gitlab.com/ci/yaml/)
- [Deployment safety and resource groups](https://docs.gitlab.com/ci/environments/deployment_safety/)
