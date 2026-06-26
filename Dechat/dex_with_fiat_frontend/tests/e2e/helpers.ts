import { expect, type Page } from '@playwright/test';

export const MOCK_WALLET_ADDRESS =
  'GD5DJQD7KGYRY4TSK4K2V5J2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2';

/** Connect a mock wallet via the app's E2E hook (must run after navigation). */
export async function connectMockWallet(
  page: Page,
  address: string = MOCK_WALLET_ADDRESS,
): Promise<void> {
  await page.waitForFunction(
    () => typeof window.mockStellarConnect === 'function',
  );
  await page.evaluate((addr) => {
    window.mockStellarConnect?.(addr);
  }, address);
}

/** Navigate to /chat and connect a mock wallet. */
export async function gotoChatConnected(
  page: Page,
  address: string = MOCK_WALLET_ADDRESS,
): Promise<void> {
  await page.goto('/chat');
  await page.waitForLoadState('domcontentloaded');
  await connectMockWallet(page, address);
  await expect(page.getByRole('button', { name: /deposit xlm/i })).toBeVisible({
    timeout: 20_000,
  });
}

/** Mock Soroban RPC so contract view/write calls do not hit the network. */
export async function mockSorobanRpc(
  page: Page,
  options: { adminAddress?: string } = {},
): Promise<void> {
  const adminAddress = options.adminAddress ?? MOCK_WALLET_ADDRESS;

  await page.route('**/*stellar.org/**', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    let body: { method?: string; id?: number | string } | null = null;
    try {
      body = route.request().postDataJSON();
    } catch {
      body = null;
    }

    const method = body?.method ?? '';
    const id = body?.id ?? 1;

    if (method === 'getLatestLedger') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { sequence: 12_345, protocolVersion: 22 },
        }),
      });
      return;
    }

    if (method === 'getNetwork') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { passphrase: 'Test SDF Network ; September 2015' },
        }),
      });
      return;
    }

    if (method === 'getAccount' || method === 'getAccounts') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            id: adminAddress,
            sequence: '123456789',
            balances: [],
          },
        }),
      });
      return;
    }

    if (method === 'simulateTransaction' || method === 'sendTransaction') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            status: 'SUCCESS',
            results: [{ xdr: 'AAAAAAAAAGQAAAAAAAAAAQ==' }],
            cost: { cpuInsns: '0', memBytes: '0' },
            latestLedger: 12_345,
            latestLedgerCloseTime: '1711670400',
          },
        }),
      });
      return;
    }

    await route.continue();
  });
}

/** Open the deposit modal from the chat network badge. */
export async function openDepositModalFromChat(page: Page): Promise<void> {
  await page.getByRole('button', { name: /deposit xlm/i }).click();
  await page.getByRole('dialog', { name: /deposit to bridge/i }).waitFor({
    state: 'visible',
    timeout: 10_000,
  });
}

/** Open the withdraw modal from the chat network badge (requires admin RPC mock). */
export async function openWithdrawModalFromChat(page: Page): Promise<void> {
  await page.getByRole('button', { name: /withdraw xlm/i }).click();
  await page.getByRole('dialog', { name: /withdraw from bridge/i }).waitFor({
    state: 'visible',
    timeout: 10_000,
  });
}
