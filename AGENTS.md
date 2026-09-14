# Beewaz Agent Baseline

- Inspect relevant code, dependencies, and repository guidance before acting.
- Make the smallest correct change; preserve established architecture, public interfaces, and backward compatibility unless explicitly told otherwise.
- Do not expose secrets, mutate production data, weaken security controls, or bypass failing checks.
- Validate proportionately with the available typecheck, lint, test, end-to-end, and build scripts; review the final diff.
- Report changed files, validation performed, and any unresolved risks. State a short plan first for substantial work.
