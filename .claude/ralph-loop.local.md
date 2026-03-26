---
active: true
iteration: 1
max_iterations: 0
completion_promise: "DONE"
started_at: "2026-03-26T11:25:42Z"
---

Look for opportunities to use DRY and abstraction principles to consolidate the number of distinct .mjs scripts at root of /Users/alyshialedlie/code/is-internal/bot-army-google-calendar-mcp, following 1 change per commit principles.

## Goal
Reduce the number of root .mjs scripts by at least 10, OR reduce their total token count by 25%, OR commit 100 diffs — whichever comes first.

## Starting state
79 root .mjs scripts. Track progress each iteration.

## How to proceed each iteration

1. Run: ls /Users/alyshialedlie/code/is-internal/bot-army-google-calendar-mcp/*.mjs | wc -l  to see current count
2. Run: git -C /Users/alyshialedlie/code/is-internal/bot-army-google-calendar-mcp log --oneline -5 to see recent commits
3. Identify the next best consolidation opportunity by reading 2-3 related scripts
4. Make exactly ONE logical change (delete a script that's been absorbed, consolidate two scripts, extract shared utility, etc.)
5. Commit with a conventional commit message
6. Check if goal is met

## Consolidation strategies (in priority order)

A. Delete obsolete scripts — scripts that are one-off cleanup operations already completed (archive-*, revert-*, delete-*, cleanup-*, final-cleanup, debug-tools) — just delete them (they served their purpose)
B. Merge near-duplicate scripts into one parameterized script — e.g., multiple mark-*-read.mjs scripts that do the same thing with different label/query args
C. Extract repeated inline patterns into existing shared utilities (gmail-client.mjs, gmail-batch.mjs, gmail-label-utils.mjs, date-based-filter.mjs)
D. Combine scripts that are always run together into a single orchestration script

## Rules
- 1 commit per logical change
- Don't break working scripts — if a script is still needed, either keep it or replace it with something equivalent
- Use existing shared utilities: gmail-client.mjs, gmail-batch.mjs, gmail-label-utils.mjs, date-based-filter.mjs
- Prefer deleting dead one-off scripts over merging active ones
- All commits go to main branch in /Users/alyshialedlie/code/is-internal/bot-army-google-calendar-mcp
- Use conventional commits: chore(scripts): ..., refactor(scripts): ...

## Completion check each iteration
After each commit, check:
- Current script count (target: <= 69, i.e. reduced by 10)
- Total commits made this session
- If target met, output: <promise>DONE</promise>

## Session baseline
- Starting script count: 79
- Starting commit: ae24fa4
