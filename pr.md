# fix(contract): denylist/allowlist index consistency, invariant tests, and doc corrections

Closes #1432, #1433, #1434, #1435, #1405
Refs #1406, #1380

## Summary

| Issue | Type | Change |
| --- | --- | --- |
| #1433 | docs | Corrected seven rustdoc claims in `lib.rs` that the code does not implement |
| #1405 | fix | `deny_address` / `remove_denied_address` are now idempotent, so the denylist index can no longer go stale |
| #1406 (partial) | fix | Token allowlist indexes no longer accumulate duplicate or historical entries |
| #1435 | test | New registered module `test_denylist_invariants` (11 tests, including a property test) |
| #1434 | test | New registered module `test_token_allowlist_invariants` (9 tests) |
| #1432 | docs | `INVARIANT_TESTING.md` now lists the modules actually declared in `lib.rs` and explains how to add one |

#1434 and #1435 ask for invariants that the current contract violates: toggling must not create duplicate state, and `is_denied` must agree with `get_denied_addresses`. The fixes those tests depend on (#1405 and part of #1406) are therefore in this PR, each in its own commit.

---

## #1433: rustdoc corrections

Each correction changes the doc to match the code. No behaviour changes.

| Function | Doc claimed | Code actually does |
| --- | --- | --- |
| `set_anti_sandwich_delay` | the delay applies to deposit operations | only `execute_withdrawal` enforces it and returns `AntiSandwichDelayActive`. `deposit` only enforces `CooldownLedgers` |
| `deposit` (safety notes) | the saturating check evaluates "anti-sandwich and deposit rate delays" | it evaluates the `CooldownLedgers` window only, and records `LastDeposit` for the later anti-sandwich check |
| `accrue_fee` | "`reconcile_fee_vault` corrects the ledger before withdrawals", and the vault is bounded by the token balance | no such function exists, and the vault is never compared to the balance. Plain `+` traps under `overflow-checks = true` |
| `withdraw_fees` | "caps withdrawal to available funds" | only emits `FeeVaultReconciledEvent`. It still transfers the full `amount` |
| `set_circuit_breaker_threshold` | did not say which paths count toward volume; the issue flagged a claim that `request_withdrawal` accumulates it | the doc now states that `withdraw` and `execute_withdrawal` accumulate volume, `request_withdrawal` and `deposit` only call `require_circuit_breaker_clear`, and a threshold ≤ 0 disables tracking |
| `request_withdrawal` | `NextRequestID` uses checked addition, and TTL/unlock math is saturating | `unlock_ledger` and `request_id + 1` use plain `+`, which traps under `overflow-checks` and never returns `Error::Overflow` |
| `is_denied` | denied addresses cannot read user-specific state | views never check the denylist (`test_deny_address_blocks_state_reads` already asserts this). The doc now lists the actual guards: `deposit` (depositor), `withdraw` and `request_withdrawal` (recipient) |

## #1405: denylist index consistency

**Bug:** `deny_address` appended a `DeniedIndex` entry and emitted `DenyAddressEvent` on every call. `remove_denied_address` tombstoned only the first matching slot. After `deny → deny → remove`, `is_denied` returned `false` but `get_denied_addresses` still listed the address.

**Fix:** `deny_address` returns `Ok(())` early if the address is already denied. `remove_denied_address` returns `Ok(())` early if it is not. Neither emits an event on a no-op.

**Behaviour change:** repeated or no-op calls no longer emit events or bump `DeniedCount`. No existing test relied on the old behaviour.

## #1406 (partial): token allowlist indexes

- `set_token_allowlist_enabled` stores each token's slot under a new `DataKey::TokenAllowlistEnabledSlot(Address)` and updates that entry in place. `get_token_allowlist_enabled` now returns one current entry per token instead of the full toggle history.
- `add_token_allowlist` is a no-op for a pair that is already listed, so there are no duplicate live entries.
- `remove_token_allowlist` skips the index scan when the pair is not listed.

**Not done yet** (left open on #1406): versioned events for the three setters, and O(1) removal through a stored slot id.

**Existing deployments:** `TokenAllowlistEnabledIndex` entries written before this change have no slot record. The first toggle of such a token after upgrade appends one new, current entry, but the old history entries stay visible in `get_token_allowlist_enabled`. The deposit gate reads `TokenAllowlistEnabled` directly and is unaffected.

## #1435: `test_denylist_invariants`

- **Property test:** runs random sequences of deny and remove calls over four addresses, 32 cases of up to 24 operations each. After every step, `is_denied` and `get_denied_addresses` must both match a set model, with no duplicates.
- **Counter:** `DeniedCount` grows only for new denials. Includes a regression test for double deny followed by remove.
- **Guarded entrypoints:** `deposit`, `withdraw` and `request_withdrawal` each return `AddressDenied` while the address is denied and succeed after removal. Denying one address does not affect another.
- **Events:** exactly one `deny_address_event` or `deny_removed_event` per real state change, and none for no-op calls.
- **Authorisation:** callers without admin auth are rejected, and the denylist is unchanged afterwards.

## #1434: `test_token_allowlist_invariants`

- **Deposit gate:** unlisted depositors get `NotAllowed`; add lets them in, remove blocks them again, and disabling the gate reopens it. A rejected deposit moves no funds.
- **Per-token isolation:** a second token is registered through storage, because `init` registers only one and there is no public registration entrypoint. Each token's allowlist affects only its own deposits.
- **Enumeration:** covers live entries only, idempotent duplicate add, re-add after remove, `offset`/`limit` paging across a tombstone, and one current enabled entry per token after repeated toggles.
- **Authorisation:** callers without admin auth are rejected for all three setters, and state is unchanged afterwards.

## #1432: `INVARIANT_TESTING.md`

- Replaced the module table with the 24 invariant modules actually declared in `lib.rs`.
- Removed the "standalone (`#![cfg(test)]`)" explanation. The doc now states that an undeclared file is never compiled, whatever attributes it carries.
- Listed the unregistered files (`test_deposit_invariants`, `test_pause_invariants`, `test_withdraw_fees_invariants`, `test_execute_multisig_action_invariants`, `test_get_multisig_signers_invariants`) and pointed to #1380. Their suite descriptions are marked "not yet registered".
- Added an "Adding a new test module" section covering the `mod` line, `extern crate std;` for the `no_std` crate, and how to confirm the tests actually run.
- Dropped the claim that an inner `#![cfg(test)]` trips clippy's `duplicated_attributes` lint. Registered modules that carry one produce no such warning.

The issue says to land this after or together with the orphaned-tests issue (#1380). This PR does not register the orphaned files. Instead, the doc describes the current state accurately and explicitly marks those suites as not running.

---

## Testing

**`cargo test` does not pass on `main`, and this PR does not change that.** `main` has 51 test-build compile errors from API drift, in `test.rs`, the upgrade invariant modules and `test_get_withdrawal_request_invariants`. For example, `propose_upgrade` now takes 3 arguments and `Receipt` has no `refunded` field. This branch has the same 51 errors and no new ones.

To verify this PR, I temporarily commented out the nine modules that fail to compile, locally and not committed:

- **New modules:** `cargo test --lib -- denylist_invariants token_allowlist_invariants` → **20 passed, 0 failed** (11 denylist and 9 allowlist tests).
- **The new tests catch the bugs:** with the #1405/#1406 fixes reverted, 6 of them fail. These are double-deny, count, event, duplicate-add, toggle and the property test.
- **Everything else that compiles:** 242 passed, 4 failed. The same 4 fail on `main` with the same modules disabled:
  - `test_init_validation::test_init_nonce_increments_on_successful_attempt`
  - `test_init_validation::test_init_replay_with_same_nonce_is_rejected`
  - `test_issue_1437::test_migrate_upgrade_proposal_timing_legacy_proposal`
  - `test_set_withdrawal_expiry_invariants::set_withdrawal_expiry_zero_falls_back_to_default`
- **Clippy:** `cargo clippy --lib --all-features -- -D warnings` is clean. `--all-targets` cannot complete because of the pre-existing test compile errors, but clippy reports no warnings in the two new modules.
- **WASM:** built with `cargo rustc --lib --crate-type=cdylib --target=wasm32v1-none --release`: 125,014 → 125,769 bytes (+755 B). The contract was already well over the 55 KB limit in `CLAUDE.md` before this PR.

## Follow-ups

- #1380: register the 30 orphaned `test_*.rs` files.
- Fix the 51 pre-existing test compile errors and the 4 pre-existing test failures, so that `cargo test` and `cargo clippy --all-targets` can gate CI again.
- #1406 remainder: setter events, and O(1) removal for `remove_token_allowlist`.
- WASM size is about 123 KB against a 55 KB limit.
