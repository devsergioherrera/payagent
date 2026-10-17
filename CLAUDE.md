# payagent

Payments agent for the Blinka challenge. Spec: [docs/SPEC.md](docs/SPEC.md). Layout and deployment details: [docs/STRUCTURE.md](docs/STRUCTURE.md).

## Code navigation

This repo is indexed by CodeGraph (`.codegraph/`). Use it before grep or reading files: the `codegraph_explore` MCP tool, or `codegraph explore "<symbols or question>"` in the shell. Every agent working here (Claude, OpenCode) does the same.

The agent is what matters: deciding, explaining and learning rules. Cut screens and technicalities before touching that. Plan and owners: [docs/ROADMAP.md](docs/ROADMAP.md).

## Environments

| | Development (your laptop) | Production (AWS) |
|---|---|---|
| Compose | `docker-compose.yml` + `docker-compose.dev.yml` | `docker-compose.yml` only |
| URL | http://localhost (also :3000 frontend, :8000 api) | https://52.207.93.205.sslip.io |
| Code | mounted, reloads on save | built into images |
| Email worker | off unless `--profile email` | always on |
| `.env` | repo root, `DOMAIN` empty | `/opt/payagent/.env` on the server, `DOMAIN=52.207.93.205.sslip.io` |

```bash
# development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile email up --build   # with the Gmail worker

# production, the same thing CD runs (by hand only if CD is broken)
sudo /opt/payagent/deploy/deploy.sh
```

Never run the dev email worker while production is up unless you mean to: both read the same Gmail inbox.

## Production on AWS

- One EC2 instance in `us-east-1`: `i-0dcffd36c993d8739` (tag `Project=payagent`), Elastic IP `52.207.93.205`, repo at `/opt/payagent`.
- **Deploys only happen through CD.** Every push to `main` runs `.github/workflows/cd.yml`: GitHub assumes the IAM role `payagent-github-deploy` (OIDC, no stored keys), and SSM runs `deploy/deploy.sh` on the server (no public SSH).
- `payagent-github-deploy` can only be assumed by `main` of `devsergioherrera/payagent` and can only run SSM commands on `Project=payagent` instances. Don't widen it.
- For manual AWS work use the IAM user `payagent-operator` (start/stop/reboot/SSM on the payagent instance), not root.
- Budget `payagent-monthly`: $15/month, alerts at 50%/80% and forecast 100%; at 100% actual AWS **stops the instance automatically**. If the site is down, check this first.
- Secrets live only in `.env` (gitignored). Never commit them or put them in GitHub.

## Git flow

`main` is production: whatever lands on `main` is deployed within minutes.

1. Work on a branch in its own worktree: `.claude/worktrees/<name>` on branch `worktree-<name>` (e.g. `worktree-frontend`). Use `git -C` or absolute paths; don't `cd` between worktrees.
2. Commit small, with Conventional Commits (`feat(email): ...`, `fix(engine): ...`, `build(docker): ...`).
3. Before merging: tests pass (`cd backend && uv run --group dev pytest`) and the dev stack runs.
4. Merge into `main` only when the change is ready for users. Prefer fast-forward (`git merge --ff-only`) after rebasing the branch on `main`.
5. Delete the branch and worktree once merged.

**Don't push to `main` just to deploy or to "see if it works".** Each push rebuilds production and can take the demo down. Try it in dev first; to redeploy without code changes, use *Run workflow* on the CD action instead of an empty commit.

<!-- claude-reflect: learned rules (saved from the band; edit freely) -->
## Learned rules
- Keep every reply to the user at 200 words or fewer.
<!-- end claude-reflect -->
