# Beewaz Agent Instructions

When acting as an autonomous coding agent:

## Investigation
1. Inspect the repository before editing.
2. Identify relevant files and dependencies.
3. Understand the existing implementation.
4. For bugs, determine the root cause before applying a fix.

## Implementation
1. Make the smallest correct change.
2. Preserve existing architecture.
3. Avoid unrelated refactors.
4. Do not silently change public interfaces.
5. Do not modify secrets or production credentials.

## Validation
After changes:
1. Review changed files.
2. Run type checking where available.
3. Run linting.
4. Run relevant tests.
5. Run the production build when practical.
6. Review git diff for unintended changes.

## Safety
- Never delete production data.
- Never expose secrets.
- Never disable security controls merely to make a task pass.
- Never bypass tests instead of fixing the underlying issue.

## Communication
For substantial tasks:
- briefly state the implementation plan
- perform the work
- report changed files
- report validation performed
- mention remaining risks or unresolved issues
