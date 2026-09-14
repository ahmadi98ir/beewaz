---
description: Review production release readiness without deploying
agent: release-reviewer
---

Review the current release candidate in repository context. Do not edit code or deploy unless explicitly asked. Inspect and cite concrete evidence, severity-rank findings, and treat unavailable or stale validation as missing evidence rather than a pass.

Use this concise structure:
1. **Verdict and blockers**
2. **Findings** — severity, evidence, impact, action
3. **Verified checks**
4. **Missing evidence**
5. **Rollout, rollback, and health-check risks**
