//! Tests for Issue #1422: `migrate_fee_withdrawal_nonce` copies the legacy
//! global `DataKey::FeeWithdrawalNonce` onto the admin's per-caller
//! `FeeWithdrawalNonceByCaller` key exactly once, and removes the legacy key.
//!
//! Covers: legacy present / target absent, legacy present / target already
//! present, and idempotent re-runs.

use crate::{DataKey, FiatBridge, FiatBridgeClient};
use soroban_sdk::{testutils::Address as _, vec, Address, Env};

fn setup(env: &Env) -> (Address, FiatBridgeClient<'_>, Address) {
    let contract_id = env.register(FiatBridge, ());
    let client = FiatBridgeClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_addr = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();

    let signers = vec![env, admin.clone()];
    client.init(&admin, &token_addr, &10_000_000i128, &1i128, &signers, &1, &0);

    (contract_id, client, admin)
}

fn set_legacy_nonce(env: &Env, contract_id: &Address, value: u64) {
    env.as_contract(contract_id, || {
        env.storage()
            .instance()
            .set(&DataKey::FeeWithdrawalNonce, &value);
    });
}

fn has_legacy_nonce(env: &Env, contract_id: &Address) -> bool {
    env.as_contract(contract_id, || {
        env.storage().instance().has(&DataKey::FeeWithdrawalNonce)
    })
}

/// Legacy present, per-caller target absent: the legacy value is copied over
/// and the legacy key is removed.
#[test]
fn copies_legacy_value_when_target_is_absent() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, admin) = setup(&env);
    set_legacy_nonce(&env, &contract_id, 7);
    assert_eq!(client.get_fee_withdrawal_nonce(&admin), 0);

    client.migrate_fee_withdrawal_nonce();

    assert_eq!(client.get_fee_withdrawal_nonce(&admin), 7);
    assert!(!has_legacy_nonce(&env, &contract_id), "legacy key must be removed after migration");
}

/// Legacy present, per-caller target already present (e.g. the admin already
/// made a `withdraw_fees_batch` call before migrating): the target is left
/// untouched, but the legacy key is still cleaned up.
#[test]
fn does_not_overwrite_an_existing_target_nonce() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, admin) = setup(&env);
    set_legacy_nonce(&env, &contract_id, 7);

    // The admin already advanced the per-caller nonce independently of the
    // legacy key (e.g. via withdraw_fees_batch) before migration ran.
    env.as_contract(&contract_id, || {
        env.storage().instance().set(
            &DataKey::FeeWithdrawalNonceByCaller(admin.clone()),
            &3u64,
        );
    });

    client.migrate_fee_withdrawal_nonce();

    assert_eq!(
        client.get_fee_withdrawal_nonce(&admin),
        3,
        "an existing per-caller nonce must not be clobbered by the legacy value"
    );
    assert!(!has_legacy_nonce(&env, &contract_id), "legacy key must still be removed");
}

/// Idempotent: running the migration a second time (legacy key already gone)
/// is a no-op rather than an error.
#[test]
fn is_idempotent_on_repeated_runs() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, admin) = setup(&env);
    set_legacy_nonce(&env, &contract_id, 7);

    client.migrate_fee_withdrawal_nonce();
    assert_eq!(client.get_fee_withdrawal_nonce(&admin), 7);

    // Second run: no legacy key left, nothing should change or error.
    client.migrate_fee_withdrawal_nonce();
    assert_eq!(client.get_fee_withdrawal_nonce(&admin), 7);
    assert!(!has_legacy_nonce(&env, &contract_id));
}

/// No legacy key at all (a fresh deployment that never had one): migration is
/// a harmless no-op.
#[test]
fn no_op_when_legacy_key_was_never_set() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, admin) = setup(&env);

    client.migrate_fee_withdrawal_nonce();

    assert_eq!(client.get_fee_withdrawal_nonce(&admin), 0);
    assert!(!has_legacy_nonce(&env, &contract_id));
}
