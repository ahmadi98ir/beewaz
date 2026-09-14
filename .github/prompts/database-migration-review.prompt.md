---
description: Review database migration safety without executing it
agent: database-migration-reviewer
---

Review the proposed schema and migration changes in repository context. Never execute migrations, issue database writes, or edit code unless explicitly asked. Cite concrete evidence, severity-rank findings, and distinguish missing evidence from a verified pass.

Use this concise structure:
1. **Verdict and blockers**
2. **Findings** — severity, evidence, production impact, mitigation
3. **Compatibility and traffic analysis**
4. **Missing evidence**
5. **Phased rollout and rollback**
