# Maximum Cap Limit Documentation

## Overview

The DEX-CHAT FiatBridge contract implements a maximum cap limit system to manage risk and prevent excessive deposits beyond the platform's capacity. This document describes the architecture, configuration, and behavior of the cap limit mechanism.

## Architecture

### On-Chain Cap Structure

The `FiatBridge` contract maintains two cap-related fields per token:

```rust
/// Maximum vault balance cap (protects against over-deposit)
pub max_cap: i128,

/// Configured limit ceiling (admin-controlled risk boundary)
pub cap_limit: i128,
```

**`max_cap`**: The actual vault balance after accounting for on-chain token reserves. This represents the maximum amount of the token that can be held in the contract simultaneously.

**`cap_limit`**: The admin-configured global per-token limit ceiling. This is the policy boundary that the admin sets to control risk exposure.

### Admin Configuration

Admins configure the cap limit via the `set_limit_max_cap` function:

```rust
pub fn set_limit_max_cap(
    env: Env,
    token: Address,
    new_limit: i128,
) -> Result<i128, Error>
```

**Parameters:**
- `token`: Token address to set cap for
- `new_limit`: New maximum cap value (in token decimals)

**Returns:** The previously set cap limit

**Behavior:**
- Only the contract admin can call this function
- Affects all future deposits of the specified token
- Does not retroactively affect already-deposited amounts
- Setting to `0` disables the cap (unlimited deposits)

### Deposit Validation

When a user attempts to deposit, the contract checks:

1. **Token Reserve Check**: Verifies sufficient on-chain token supply
2. **Cap Limit Check**: Ensures new balance ≤ `cap_limit`
3. **Daily Limit Check**: Enforces per-user daily deposit limits (future feature)

If the deposit would exceed `cap_limit`, the transaction reverts with:
```
Error::ExceedsLimitMaxCap
```

## Configuration Examples

### Example 1: USDC Cap of 100,000

Set maximum USDC deposits to 100,000 units:

```typescript
// Frontend
await adminClient.invoke({
  method: 'set_limit_max_cap',
  args: [
    Address.fromString('GBUQWP3BOUZX34ULNQG23RQ6F4YUSXZTVY5OOOXVP67ABDA5940VPK7'),  // USDC contract
    new i128(100_000_000_000),  // 100,000 USDC (7 decimals)
  ],
});
```

### Example 2: Disable Cap (Unlimited)

Remove cap limit for XLM:

```typescript
await adminClient.invoke({
  method: 'set_limit_max_cap',
  args: [
    Address.fromString('GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ5LKG3FZJYGLSRDNT5OJJLW'),  // XLM native
    new i128(0),  // Disable cap
  ],
});
```

## Frontend Integration

### Reading Current Cap

```typescript
import { useContractRead } from '@/hooks/useContractRead';

export function CapLimitDisplay() {
  const { data: capLimit } = useContractRead({
    method: 'get_cap_limit',
    args: [tokenAddress],
  });

  return (
    <div>
      <p>Current Cap: {capLimit ? formatAmount(capLimit) : 'Unlimited'}</p>
    </div>
  );
}
```

### Deposit Form Validation

```typescript
async function validateDeposit(amount: string, token: Address) {
  const capLimit = await contract.invoke({
    method: 'get_cap_limit',
    args: [token],
  });

  const currentVault = await contract.invoke({
    method: 'get_vault_balance',
    args: [token],
  });

  const newBalance = BigInt(currentVault) + BigInt(amount);

  if (capLimit > 0n && newBalance > BigInt(capLimit)) {
    throw new Error(`Deposit exceeds cap limit of ${formatAmount(capLimit)}`);
  }
}
```

### User-Facing Messages

When a deposit fails due to cap limit:

```typescript
if (error.code === 'ExceedsLimitMaxCap') {
  showError(
    `This deposit would exceed the platform limit of ${capLimit} ${tokenCode}. ` +
    `Your deposit reduced to ${adjustedAmount} ${tokenCode}.`
  );
}
```

## Security Considerations

1. **Admin-Only Control**: Only authenticated admins can set cap limits
2. **No Retroactive Changes**: Existing deposits are not retroactively capped
3. **Token-Specific**: Each token has its own independent cap
4. **Zero = Unlimited**: Setting cap to 0 disables the limit (intentional design)
5. **Atomic Validation**: Cap checks are atomic with deposit execution

## Future Enhancements

- **Per-User Daily Caps**: Individual daily deposit limits per user
- **Time-Based Caps**: Different caps during business hours vs. weekends
- **Risk Scoring**: Dynamic caps based on user KYC level
- **Multi-Token Limits**: Combined cap across multiple tokens

## Troubleshooting

### Error: "ExceedsLimitMaxCap"

**Cause:** Deposit would exceed the configured cap limit.

**Solution:**
1. Check current cap with `get_cap_limit(token)`
2. Calculate remaining capacity: `cap - current_vault_balance`
3. Reduce deposit amount to fit within capacity
4. Contact admin if cap needs adjustment

### Error: "Unauthorized"

**Cause:** Non-admin attempted to call `set_limit_max_cap`.

**Solution:**
- Only contract admins can configure caps
- Contact your DEX-CHAT administrator

## Related Functions

- `get_cap_limit(token)`: Retrieve current cap for a token
- `get_vault_balance(token)`: Get current vault balance
- `deposit(token, amount)`: Deposit (validates against cap)
- `set_limit_max_cap(token, limit)`: Configure cap (admin only)

## References

- [FiatBridge Contract README](../stellar-contracts/FIAT_BRIDGE_README.md)
- [Soroban Documentation](https://developers.stellar.org/docs/learn/soroban)
- [Risk Management Guidelines](./RISK_MANAGEMENT.md)
