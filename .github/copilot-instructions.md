# Beewaz Repository Instructions

## Project overview
Beewaz is a production web application built with:
- Next.js 16
- TypeScript
- PostgreSQL 18
- Docker
- Coolify for deployment

## General engineering rules
- Always inspect the existing codebase before making changes.
- Prefer minimal, targeted changes over large rewrites.
- Follow the existing architecture and naming conventions.
- Do not introduce new dependencies unless clearly necessary.
- Never expose or commit secrets, API keys, passwords, tokens, or environment values.
- Never modify .env files unless explicitly requested.
- Preserve backward compatibility unless the task explicitly requires a breaking change.
- Do not change unrelated files.

## Before implementation
- Identify the relevant files and dependencies.
- Understand the existing implementation.
- Explain the likely root cause for bugs before editing.
- For large changes, create a short implementation plan first.

## After implementation
Always perform the applicable checks:
- TypeScript typecheck
- lint
- tests
- production build

Review the final git diff before considering the task complete.

## Database rules
- Never modify production data directly.
- Review existing schema and migrations before changing database structures.
- Prefer safe and reversible migrations.
- Avoid destructive schema changes unless explicitly requested.

## Deployment rules
- Be aware that production is deployed using Docker and Coolify.
- Changes must remain compatible with the current Docker-based deployment.
- Do not change Docker or deployment configuration without checking its impact.
