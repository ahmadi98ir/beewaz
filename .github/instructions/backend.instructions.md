---
applyTo: "src/app/api/**/*.ts,src/server/**/*.ts"
---

# Backend Instructions

- Validate all external input.
- Never trust client-provided authorization data.
- Follow existing authentication and authorization patterns.
- Return appropriate HTTP status codes.
- Handle errors explicitly.
- Avoid leaking internal errors or secrets in API responses.
- Keep database queries efficient.
- Avoid unnecessary network or database calls.
