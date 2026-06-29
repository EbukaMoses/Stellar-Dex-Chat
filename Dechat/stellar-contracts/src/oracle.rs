use soroban_sdk::{contractclient, Address, Env};

/// Interface that any price oracle contract must implement.
/// Returns the price of a token in USD with 7 decimal places
/// (i.e. 1 USD = 10_000_000).
#[contractclient(name = "OracleClient")]
pub trait PriceOracle {
    fn get_price(env: Env, token: Address) -> Option<i128>;
}
