import { test, expect } from '@playwright/test';

test.describe('Wallet Connect UI Path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display connect wallet button when not connected', async ({ page }) => {
    // Check if connect button is visible on landing page
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await expect(connectButton).toBeVisible();
  });

  test('should navigate to chat page and show wallet connection options', async ({ page }) => {
    // Navigate to chat interface
    await page.click('button', { hasText: /get started/i });
    await expect(page).toHaveURL('/chat');

    // Check for wallet connection UI elements
    const walletConnectButton = page.locator('button', { hasText: /connect freighter/i });
    await expect(walletConnectButton).toBeVisible();

    // Check wallet status indicator
    const walletStatus = page.locator('[data-testid="wallet-status"]');
    await expect(walletStatus).toHaveText(/not connected/i);
  });

  test('should handle wallet connection flow', async ({ page }) => {
    await page.goto('/chat');
    
    // Mock Freighter wallet API
    await page.addInitScript(() => {
      window.freighter = {
        isConnected: async () => ({ isConnected: false }),
        getAddress: async () => ({ address: 'GD5DJQD7KGYRY4TSK4K2V5J2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2' }),
        getNetwork: async () => ({ network: 'TESTNET' }),
        signTransaction: async () => ({ signedTxXdr: 'mock-signed-tx-xdr' }),
        requestAccess: async () => ({ address: 'GD5DJQD7KGYRY4TSK4K2V5J2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2' })
      };
    });

    // Click connect button
    await page.click('button', { hasText: /connect freighter/i });

    // Wait for connection to complete
    await expect(page.locator('[data-testid="wallet-status"]')).toHaveText(/connected/i);
    
    // Verify wallet address is displayed
    const walletAddress = page.locator('[data-testid="wallet-address"]');
    await expect(walletAddress).toBeVisible();
    await expect(walletAddress).toContainText('GD5DJQD…J2XQK2');
  });

  test('should handle wallet disconnection', async ({ page }) => {
    await page.goto('/chat');
    
    // Mock connected wallet
    await page.addInitScript(() => {
      window.freighter = {
        isConnected: async () => ({ isConnected: true }),
        getAddress: async () => ({ address: 'GD5DJQD7KGYRY4TSK4K2V5J2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2' }),
        getNetwork: async () => ({ network: 'TESTNET' }),
        signTransaction: async () => ({ signedTxXdr: 'mock-signed-tx-xdr' }),
        requestAccess: async () => ({ address: 'GD5DJQD7KGYRY4TSK4K2V5J2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2' })
      };
    });

    // Wait for initial connection state
    await page.waitForTimeout(1000);

    // Click disconnect button
    const disconnectButton = page.locator('button', { hasText: /disconnect/i });
    await disconnectButton.click();

    // Verify disconnection
    await expect(page.locator('[data-testid="wallet-status"]')).toHaveText(/not connected/i);
  });

  test('should show error when Freighter is not installed', async ({ page }) => {
    await page.goto('/chat');
    
    // Mock no Freighter installation
    await page.addInitScript(() => {
      window.freighter = undefined;
    });

    // Check for install Freighter message
    const installMessage = page.locator('[data-testid="install-freighter-message"]');
    await expect(installMessage).toBeVisible();
    await expect(installMessage).toHaveText(/freighter wallet not installed/i);
  });
});
