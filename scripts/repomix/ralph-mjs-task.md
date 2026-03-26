# Ralph Loop Task: Simplify and Review MJS Root Files

## Context
Working directory: /Users/alyshialedlie/code/is-internal/bot-army-google-calendar-mcp

The `docs/repomix/repo-mjs-root.xml` file contains all *.mjs files from the project root.

## Task Steps (each iteration)

1. Run `/simplify` skill on the contents of `docs/repomix/repo-mjs-root.xml`
   - Accept all suggestions — apply changes directly to the actual .mjs source files
2. Run `/code-reviewer` skill on the contents of `docs/repomix/repo-mjs-root.xml`
   - Accept all suggestions — apply changes directly to the actual .mjs source files
3. Run `/otel-session-summary` and address any issues identified
4. Regenerate `docs/repomix/repo-mjs-root.xml`:
   ```
   cd /Users/alyshialedlie/code/is-internal/bot-army-google-calendar-mcp && npx repomix --config scripts/repomix/repomix-mjs-root.config.json
   ```
5. Check if `/simplify` and `/code-reviewer` are now clean (no further suggestions)

## Completion Criteria
Loop is DONE when both `/simplify` and `/code-reviewer` run on the regenerated `docs/repomix/repo-mjs-root.xml` and return no actionable suggestions.

When complete, output exactly:
<promise>RALPH_CLEAN</promise>
