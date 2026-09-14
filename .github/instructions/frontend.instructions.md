---
applyTo: "src/app/**/*.ts,src/app/**/*.tsx,src/components/**/*.ts,src/components/**/*.tsx,**/*.tsx,**/*.jsx"
---

# Frontend Instructions

- Follow existing Next.js 16 conventions.
- Prefer Server Components unless client-side behavior is required.
- Add "use client" only when necessary.
- Avoid unnecessary client-side state.
- Reuse existing components before creating new ones.
- Preserve responsive behavior.
- Follow existing design patterns and spacing conventions.
- Avoid duplicating UI logic.
- Keep accessibility in mind.
- Do not introduce hydration mismatches.

## Browser and UI validation

- Start with the existing Playwright `webServer` and `npm run test:e2e` workflow.
- Target local or isolated test environments only; never mutate production.
- Verify critical pages, console and page errors, responsive layouts, and important forms and actions.
- Assert real expected behavior. Do not add fake or coverage-only tests.
- Authentication and checkout tests may require safe fixtures; they must not send production SMS messages or create production orders or payments.
