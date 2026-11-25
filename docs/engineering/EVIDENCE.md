# Engineering Evidence & Verification Standards

Every phase and pull request in NgeBekasinYuk is accepted only on raw, reproducible tool output committed under `proofs/<phase>/` or cited directly by committed `file:line`.

## 1. Required Phase Artifacts

Each phase commit sequence must include raw outputs captured on the **final code commit** (before the final proof commit, or alongside it without code edits afterwards):

1. `pnpm --filter web run typecheck`
2. Uncached lint: `pnpm turbo run lint --force` (0 errors, 0 warnings)
3. Unit, integration, and concurrency suite: `pnpm --filter web run test`
4. Browser E2E suite: `pnpm --filter web exec playwright test --reporter=list`
5. Supply-chain audit: `pnpm audit --prod --audit-level high`
6. Runtime proof for changed endpoints/flows (raw `curl` transcript with HTTP status codes, PostgreSQL query output, or Playwright run output)
7. Unedited `git diff <base>..<head>` of touched source files

## 2. Capturing Clean Output (Windows & POSIX)

- Always capture raw command stdout/stderr directly (`| tee proofs/<phase>/<name>.txt`), never reconstructed or hand-edited.
- On Windows PowerShell, prevent UTF-16LE encoding, mojibake, and ANSI escape codes before capturing:
  ```powershell
  chcp 65001
  $OutputEncoding = [Text.Encoding]::UTF8
  $env:NO_COLOR = "1"
  $env:FORCE_COLOR = "0"
  ```
- Verify captured `.txt` files are valid UTF-8 and contain zero ANSI CSI sequences (`\x1b[`). Re-capture if corrupted.

## 3. Red-Before-Green Requirement

Every new test guarding a bug, security flaw, or concurrency race must be executed **before** applying the fix in a temporary git worktree (at the base commit with dependencies installed), saving the failing output including the exact assertion failure message (`proofs/<phase>/<topic>-red.txt`). If a race does not reproduce across 20 runs, record `NOT REPRODUCED in 20 runs`.

## 4. CI Verification & Status Vocabulary

- Save GitHub Actions run and job JSON to `proofs/<phase>/ci-run.json` and `proofs/<phase>/ci-jobs.json` after the run finishes. If GitHub API access is blocked or rate-limited, mark `UNVERIFIED — owner to paste` and specify the required summary lines (`Test Files`, `Tests`, Playwright `N passed`, and `flaky` count).
- Acceptance criteria in reports use only `VERIFIED`, `UNVERIFIED`, or `REFUTED`.
- Legacy pre-phase proofs live under `proofs/legacy/` (`proofs/legacy/order-creation-curl.txt`, `proofs/legacy/wallet-pin-curl.txt`), and verification helper scripts live under `scripts/`.
