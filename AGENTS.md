# AGENTS.md

Instructions for every coding agent in this repo (OpenCode, Claude, others).

- **Read first:** [docs/ROADMAP.md](docs/ROADMAP.md) (decisions, rules, your vertical). Where `docs/SPEC.md` disagrees with the roadmap, the roadmap wins.
- **Navigate with CodeGraph** before grep or opening files: `codegraph explore "<symbols or question>"`, or the `codegraph_explore` MCP tool.
- **Work only in your worktree** `.claude/worktrees/<name>` on branch `worktree-<name>`. Branch from `develop`, never commit to `main` or `develop`; the orchestrator merges.
- **Contracts are frozen:** `db/migrations/`, `backend/src/payagent/domain/`, `backend/src/payagent/ports/`, `frontend/src/lib/api-types.ts`. If one is wrong, stop and report it; don't change it.
- **Safety invariants:** the LLM never decides; a missing value or an exception escalates, never pays; ALLOW never cancels HOLD or a non-overridable rule.
- **Done means verified:** backend `cd backend && uv run --group dev pytest`; frontend `npm run lint && npm run build`. Report what you ran and its output.
- Code, comments and commits in English (Conventional Commits). UI copy in Spanish.
- No secrets in code or commits; they live in `.env`.
