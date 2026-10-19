//! Tests for issue #1003 – contract version migration guard.
//!
//! The feature:
//! - [`FiatBridge::get_contract_version`] returns the current stored version (0 after init).
//! - [`FiatBridge::propose_upgrade`] accepts a `new_version: u32` and rejects proposals
//!   where `new_version < current_version` with [`Error::DowngradeNotAllowed`].
//! - [`FiatBridge::execute_upgrade`] bumps [`DataKey::ContractVersion`] to the proposed
//!   `new_version` upon successful WASM replacement.
//!
//! Registered from `lib.rs` behind `#[cfg(test)]`.

use soroban_sdk::{testutils::Ledger, Address, BytesN, Env, Vec};

use crate::{Error, FiatBridge, FiatBridgeClient, MIN_UPGRADE_DELAY};

// ── Test helpers ──────────────────────────────────────────────────────────────

fn setup(env: &Env) -> (FiatBridgeClient<'_>, Address) {
    let contract_id = env.register(FiatBridge, ());
    let client = FiatBridgeClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_addr = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();

    let signers = {
        let mut v = Vec::new(env);
        v.push_back(admin.clone());
        v
    };
    client.init(&admin, &token_addr, &10_000_000i128, &1i128, &signers, &1, &0);

    (client, admin)
}

fn fake_hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

// ── Issue #1003: version guard ────────────────────────────────────────────────

/// `get_contract_version` returns 0 before any upgrade has been executed.
#[test]
fn get_contract_version_returns_zero_initially() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = setup(&env);
    assert_eq!(client.get_contract_version(), 0u32);
}

/// `propose_upgrade` succeeds when `new_version >= current_version`.
#[test]
fn propose_upgrade_accepts_forward_version() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.sequence_number = 1_000);

    let (client, _admin) = setup(&env);
    // Version 0 → 5 (forward): must succeed
    client.propose_upgrade(&fake_hash(&env, 1), &5u32);
    let proposal = client.get_upgrade_proposal().expect("proposal must be stored");
    assert_eq!(proposal.new_version, 5u32);
}

/// `propose_upgrade` succeeds when `new_version == current_version` (re-deploy).
#[test]
fn propose_upgrade_allows_same_version() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.sequence_number = 2_000);

    let (client, _admin) = setup(&env);
    // Version 0 → 0 (same): must succeed
    client.propose_upgrade(&fake_hash(&env, 3), &0u32);
}

/// `propose_upgrade` rejects `new_version < current_version` with
/// [`Error::DowngradeNotAllowed`].
///
/// We drive this by manually writing the stored version to 5 via the storage
/// API available in tests, then trying to propose version 3.
#[test]
fn propose_upgrade_rejects_downgrade() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.sequence_number = 3_000);

    let (client, admin) = setup(&env);

    // Propose version 5 first (0→5 is a valid forward upgrade)
    client.propose_upgrade(&fake_hash(&env, 1), &5u32);

    // Cancel the pending proposal so we can try another proposal
    let nonce = client.get_upgrade_cancellation_nonce(&admin);
    client.cancel_upgrade(&nonce);

    // After cancellation, stored ContractVersion is still 0 (no execute_upgrade ran),
    // so version 0 → 2 is still valid.
    client.propose_upgrade(&fake_hash(&env, 2), &2u32);
    let nonce = client.get_upgrade_cancellation_nonce(&admin);
    client.cancel_upgrade(&nonce);

    // ContractVersion is still 0 — version 0 is still ≥ 0, so this is the
    // baseline for the downgrade test.
    //
    // To trigger DowngradeNotAllowed we need ContractVersion > 0.
    // We can only bump it by calling execute_upgrade, which requires a real
    // WASM hash that the test host won't have.  Instead we write the version
    // key directly through the contract storage using a raw storage call.
    // In Soroban unit tests, `env.as_contract` lets us write instance storage.
    use crate::DataKey;
    env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .set(&DataKey::ContractVersion, &5u32);
    });

    // Now the stored version is 5; proposing new_version=3 must be rejected
    let result = client.try_propose_upgrade(&fake_hash(&env, 4), &3u32);
    assert_eq!(result, Err(Ok(Error::DowngradeNotAllowed)));
}

/// After a successful downgrade rejection, `get_contract_version` still
/// reflects the stored value unchanged.
#[test]
fn downgrade_rejection_leaves_version_unchanged() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.sequence_number = 4_000);

    let (client, _admin) = setup(&env);

    // Artificially set version to 10
    use crate::DataKey;
    env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .set(&DataKey::ContractVersion, &10u32);
    });

    assert_eq!(client.get_contract_version(), 10u32);

    // Try and fail to downgrade to version 7
    let _ = client.try_propose_upgrade(&fake_hash(&env, 5), &7u32);

    // Version must be unchanged
    assert_eq!(client.get_contract_version(), 10u32);
}

/// Proposing does not disturb any accounting fields.
#[test]
fn propose_upgrade_does_not_disturb_accounting() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.sequence_number = 5_000);

    let (client, _admin) = setup(&env);
    let limit_before = client.get_limit();
    let dep_before = client.get_total_deposited();
    let admin_before = client.get_admin();

    client.propose_upgrade(&fake_hash(&env, 9), &1u32);

    assert_eq!(client.get_limit(), limit_before);
    assert_eq!(client.get_total_deposited(), dep_before);
    assert_eq!(client.get_admin(), admin_before);
}

/// The stored `new_version` round-trips through `get_upgrade_proposal`.
#[test]
fn proposal_stores_new_version_verbatim() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.sequence_number = 6_000);

    let (client, _admin) = setup(&env);
    client.propose_upgrade(&fake_hash(&env, 0xAB), &42u32);

    let proposal = client.get_upgrade_proposal().unwrap();
    assert_eq!(proposal.new_version, 42u32);
    assert_eq!(proposal.wasm_hash, fake_hash(&env, 0xAB));
}

/// executable_after is always strictly in the future.
#[test]
fn proposal_deadline_is_always_in_the_future() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.sequence_number = 7_000);

    let (client, _admin) = setup(&env);
    client.propose_upgrade(&fake_hash(&env, 0x22), &0u32);

    let p = client.get_upgrade_proposal().unwrap();
    assert!(
        p.executable_after > env.ledger().sequence(),
        "a fresh proposal must never be immediately executable"
    );
}

/// `executable_after` equals `current_ledger + MIN_UPGRADE_DELAY` by default.
#[test]
fn proposal_default_deadline_equals_min_delay() {
    let env = Env::default();
    env.mock_all_auths();
    let seq: u32 = 8_000;
    env.ledger().with_mut(|l| l.sequence_number = seq);

    let (client, _admin) = setup(&env);
    client.propose_upgrade(&fake_hash(&env, 0xCC), &0u32);

    let p = client.get_upgrade_proposal().unwrap();
    assert_eq!(p.executable_after, seq + MIN_UPGRADE_DELAY);
}
