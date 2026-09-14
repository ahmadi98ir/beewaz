# Beewaz Repository Instructions

## Repository

Beewaz is a production Next.js 16 App Router application under `src/app`, using strict TypeScript, React 19, npm, Drizzle ORM with PostgreSQL, and Docker deployed through Coolify. Database schema and migrations live under `src/lib/db`; container startup applies migrations.

Follow the universal process and safety baseline in `AGENTS.md` and the applicable path-specific instructions. Preserve npm and the existing architecture; add dependencies only when necessary.

## Validation

Choose checks proportionate to the change:
- `npm run typecheck` — TypeScript
- `npm run lint` — linting
- `npm test` — Vitest unit/integration tests
- `npm run test:e2e` — Playwright end-to-end tests using its configured local web server
- `npm run build` — production Next.js build

Report commands not run and why. Prompt files remain Local-agent compatibility conveniences; Agent Host may not load them because prompt files are deprecated there.

## Tool and MCP safety

- Restrict file operations to the workspace.
- Use the configured GitHub MCP read-only endpoint for repository evidence.
- Use Playwright MCP only against local or isolated test targets.
- Never perform production actions, deployments, database writes, orders, payments, or SMS sends without explicit authorization.
- Never read, print, or commit secret values. Check only required environment-variable names when reviewing configuration.
- Do not add PostgreSQL MCP unless a separately provisioned role has verified server-side SELECT-only grants.
- Do not add redundant filesystem MCP access; workspace-scoped tools already provide file operations.

## Model selection policy

The repository cannot enforce automatic model routing; the user or host selects the model.
- Use the fastest suitable low-cost model for lookups, small edits, formatting, and routine validation.
- Use a Sonnet-class or reasoning model for multi-file implementation, debugging, and standard reviews.
- Use the strongest or Opus-class model only for architecture with major tradeoffs, high-risk security analysis, complex cross-system failures, difficult migrations, or after a cheaper model demonstrably fails.
- Never default all work to Opus or invent model names or repository configuration.

## Production constraints

Keep changes compatible with the existing Docker/Coolify release path and assess migration behavior under live traffic. Never modify `.github/workflows/deploy.yml` unless the task explicitly requires it.
