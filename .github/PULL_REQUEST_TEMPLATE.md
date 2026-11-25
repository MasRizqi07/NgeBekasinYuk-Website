## Summary

<!-- Describe what this PR changes and which phase/task it implements. -->

## Evidence Gate Checklist (§0.2)

- [ ] Raw output of `pnpm --filter web run typecheck` saved to `proofs/<phase>/` and committed
- [ ] Raw output of uncached `pnpm turbo run lint --force` (0 errors, 0 warnings) saved to `proofs/<phase>/` and committed
- [ ] Raw output of `pnpm --filter web run test` saved to `proofs/<phase>/` and committed
- [ ] Raw output of `pnpm --filter web exec playwright test --reporter=list` saved to `proofs/<phase>/` and committed
- [ ] Raw runtime proof (curl transcript with status codes, DB query, or Playwright output) saved to `proofs/<phase>/` and committed
- [ ] `git diff <base>..<head>` of touched files captured without edits
- [ ] All proof text files captured as UTF-8 with `NO_COLOR=1`, `FORCE_COLOR=0` (no mojibake or ANSI codes)
- [ ] Red-before-green failure output (with assertion message) saved for every new bug/race guard test (or `NOT REPRODUCED in 20 runs`)
- [ ] `pnpm audit --prod --audit-level=high` passes with zero findings
- [ ] CI run JSON (`ci-run.json` / `ci-jobs.json`) saved and `flaky` count checked (or marked `UNVERIFIED — owner to paste` if blocked)

## Acceptance Criteria Status

| AC ID | Status (`VERIFIED` / `UNVERIFIED` / `REFUTED`) | Evidence Path |
|---|---|---|
| | | |
