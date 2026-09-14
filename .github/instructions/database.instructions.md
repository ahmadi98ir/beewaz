---
applyTo: "**/*schema*,**/*migration*,db/**/*.ts,database/**/*.ts,prisma/**/*"
---

# Database Instructions

- Inspect the current schema before proposing changes.
- Prefer additive and backward-compatible migrations.
- Never delete or rename production columns without an explicit migration strategy.
- Consider indexes for frequently filtered or joined columns.
- Avoid N+1 query patterns.
- Never assume production data can be safely destroyed.
