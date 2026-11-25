# Phase 9 Task 3 — Dependency Audit Remediation Table

Captured before remediation in [audit-before.txt](file:///d:/MY%20CODE/NgeBekasinYuk-Web/proofs/9/audit-before.txt) / [audit-before.json](file:///d:/MY%20CODE/NgeBekasinYuk-Web/proofs/9/audit-before.json) and after remediation in [audit-after.txt](file:///d:/MY%20CODE/NgeBekasinYuk-Web/proofs/9/audit-after.txt) / [audit-after-prod.txt](file:///d:/MY%20CODE/NgeBekasinYuk-Web/proofs/9/audit-after-prod.txt).

## 1. Findings Before Remediation (`main` at `74e4546`)

| package | severity | path | dev-only? | fix |
|---|---|---|---|---|
| `next@16.3.4` (`GHSA-vcvr-r3jv-pc5j`, `GHSA-2464-fhr4-w9xw`, `GHSA-673q-mjm6-r5xr`) | critical | `apps/web > next@16.3.4` | no | Upgraded `next` + `eslint-config-next` to `16.4.6` (Task 2, commit `1f70058`) |
| `next@16.3.4` (`GHSA-cjq9-62q9-8jv4`, `GHSA-p3m5-59mp-jv5r`) | high | `apps/web > next@16.3.4` | no | Upgraded `next` + `eslint-config-next` to `16.4.6` (Task 2, commit `1f70058`) |
| `next@16.3.4` (7 moderate, 1 low advisories) | moderate / low | `apps/web > next@16.3.4` | no | Upgraded `next` + `eslint-config-next` to `16.4.6` (Task 2, commit `1f70058`) |
| `sharp@0.35.4` (`GHSA-wq5f-xc86-pv6w`) | high | `apps/web > next@16.3.4 > sharp@0.35.4` | no | Resolved to `>=0.35.5` by `next@16.4.6` |
| `zod@4.6.2` (`GHSA-mrhx-c7xc-m3w5`) | high | `apps/web > zod@4.6.2` | no | `pnpm --filter web update zod` -> `^4.6.7` (within `^4.6.2`) |
| `source-map-js@1.2.1` (`GHSA-68fv-2mgg-jv7q`) | high | `apps/web > next@16.4.6 > postcss@8.5.23 > source-map-js@1.2.1` | no (Next/PostCSS) | `pnpm.overrides`: `"source-map-js": ">=1.2.4"` (within `^1.2.1`) |
| `undici@8.10.2` (4 high, 4 moderate) | high / moderate | `apps/web > jsdom@30.0.1 > undici@8.10.2` | yes (`jsdom` is devDep) | `pnpm --filter web update jsdom` -> `^30.1.3` (`undici@8.13.1`) |
| `vite@8.2.2` (1 high, 4 moderate, 1 low) | high / moderate / low | `apps/web > vitest@4.1.11 > vite@8.2.2` | yes (`vitest` is devDep) | Updated `vitest` (`^4.1.12`) & refreshed lockfile peers (`vite@8.3.8`) |
| `@vitest/mocker@4.1.11` (2 moderate) | moderate | `apps/web > vitest@4.1.11 > @vitest/mocker@4.1.11` | yes (`vitest` is devDep) | Updated `vitest` (`^4.1.12`) |
| `brace-expansion@1.1.18` (2 high, 1 moderate) | high / moderate | `apps/web > eslint@9.39.5 > ... > minimatch@3.1.5 > brace-expansion@1.1.18` | yes (`eslint` is devDep) | `pnpm.overrides`: `"brace-expansion@^1.1.7": ">=1.1.21 <2.0.0"` |
| `brace-expansion@5.0.9` (2 high, 1 moderate) | high / moderate | `apps/web > eslint-config-next@16.4.6 > ... > minimatch@10.2.6 > brace-expansion@5.0.9` | yes (`eslint-config-next` is devDep) | `pnpm.overrides`: `"brace-expansion@^5.0.0": ">=5.0.12"` |
| `minimatch@10.2.6` (`GHSA-g3hv-75wg-m249`) | moderate | `apps/web > eslint-config-next@16.4.6 > ... > @typescript-eslint/typescript-estree@8.70.0 > minimatch@10.2.6` | yes (`eslint-config-next` is devDep) | **Accepted in writing** (see §3 below) |

## 2. `pnpm.overrides` Justifications (`package.json`)

1. `"source-map-js": ">=1.2.4"` — Forces patched `source-map-js` within `postcss`'s `^1.2.1` range to clear production high advisory `GHSA-68fv-2mgg-jv7q`.
2. `"brace-expansion@^1.1.7": ">=1.1.21 <2.0.0"` — Forces patched 1.x `brace-expansion` for `eslint > minimatch@3.1.5` without breaking `1.x` compatibility.
3. `"brace-expansion@^5.0.0": ">=5.0.12"` — Forces patched 5.x `brace-expansion` for `eslint-config-next > minimatch@10.2.6`.

## 3. Accepted Dev-Only Findings

- **`minimatch@10.2.6` (`GHSA-g3hv-75wg-m249`, moderate):** Present only in the `eslint-config-next` / `typescript-eslint` lint toolchain (`devDependencies`, never shipped in production runtime). The upstream fix requires `minimatch@>=11.0.1` (a major version bump outside `@typescript-eslint/typescript-estree`'s `^10.x` semver range). Accepted as dev-only moderate per Phase 9 Task 3.

## 4. Verification Result

- `pnpm audit --prod --audit-level high`: `No known vulnerabilities found` (exit 0).
- `pnpm audit --audit-level high`: `0` critical, `0` high, `1` moderate (`minimatch@10.2.6`, dev-only; exit 0).
