import { test, expect } from '@playwright/test';

test.describe('Deposit Modal Validation and Success State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    
    // Mock connected wallet
    await page.addInitScript(() => {
      window.freighter = {
        isConnected: async () => ({ isConnected: true }),
        getAddress: async () => ({ address: 'GD5DJQD7KGYRY4TSK4K2V5J2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2' }),
        getNetwork: async () => ({ network: 'TESTNET' }),
        signTransaction: async () => ({ 
          signedTxXdr: 'AAAAAgAAAABzZXJ2aWNlX3BvaW50X2hvc3QAAAAAAAAAAAAA',
          error: null
        }),
        requestAccess: async () => ({ address: 'GD5DJQD7KGYRY4TSK4K2V5J2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2' })
      };
    });

    // Wait for wallet connection
    await page.waitForTimeout(1000);
  });

  test('should open deposit modal when deposit button is clicked', async ({ page }) => {
    // Click deposit button
    const depositButton = page.locator('button', { hasText: /deposit/i });
    await depositButton.click();

    // Check modal is open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Check modal title
    await expect(page.locator('h2', { hasText: /deposit to bridge/i })).toBeVisible();
  });

  test('should validate amount input - empty amount', async ({ page }) => {
    // Open deposit modal
    await page.click('button', { hasText: /deposit/i });

    // Try to submit with empty amount
    const submitButton = page.locator('button', { hasText: /deposit/i });
    await submitButton.click();

    // Check for validation error
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/please enter a valid amount/i);
  });

  test('should validate amount input - negative amount', async ({ page }) => {
    // Open deposit modal
    await page.click('button', { hasText: /deposit/i });

    // Enter negative amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('-1');

    // Try to submit
    const submitButton = page.locator('button', { hasText: /deposit/i });
    await submitButton.click();

    // Check for validation error
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/please enter a valid amount/i);
  });

  test('should validate amount input - zero amount', async ({ page }) => {
    // Open deposit modal
    await page.click('button', { hasText: /deposit/i });

    // Enter zero amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('0');

    // Try to submit
    const submitButton = page.locator('button', { hasText: /deposit/i });
    await submitButton.click();

    // Check for validation error
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/please enter a valid amount/i);
  });

  test('should accept valid amount and show loading state', async ({ page }) => {
    // Open deposit modal
    await page.click('button', { hasText: /deposit/i });

    // Enter valid amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('1.5');

    // Submit and check loading state
    const submitButton = page.locator('button', { hasText: /deposit/i });
    await submitButton.click();

    // Check for loading indicator
    const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    await expect(loadingSpinner).toBeVisible();
    await expect(page.locator('button', { hasText: /signing & submitting/i })).toBeVisible();
  });

  test('should show success state after successful deposit', async ({ page }) => {
    // Mock successful transaction
    await page.addInitScript(() => {
      window.depositToContract = async () => 'mock-transaction-hash-12345';
    });

    // Open deposit modal
    await page.click('button', { hasText: /deposit/i });

    // Enter valid amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('2.5');

    // Submit
    const submitButton = page.locator('button', { hasText: /deposit/i });
    await submitButton.click();

    // Wait for success state
    await page.waitForTimeout(2000);

    // Check success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('text=Transaction Confirmed!')).toBeVisible();
    
    // Check transaction details
    await expect(page.locator('text=Deposit of 2.5 XLM processed successfully')).toBeVisible();
    
    // Check transaction hash link
    const txLink = page.locator('a[href*="stellar.expert"]');
    await expect(txLink).toBeVisible();
    await expect(txLink).toHaveAttribute('href', /mock-transaction-hash-12345/);
  });

  test('should show error state for failed transaction', async ({ page }) => {
    // Mock failed transaction
    await page.addInitScript(() => {
      window.freighter.signTransaction = async () => ({
        error: 'Transaction failed: insufficient funds'
      });
    });

    // Open deposit modal
    await page.click('button', { hasText: /deposit/i });

    // Enter valid amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('1.0');

    // Submit
    const submitButton = page.locator('button', { hasText: /deposit/i });
    await submitButton.click();

    // Wait for error state
    await page.waitForTimeout(2000);

    // Check error message
    const errorContainer = page.locator('[data-testid="error-container"]');
    await expect(errorContainer).toBeVisible();
    await expect(errorContainer).toHaveText(/transaction failed/i);
  });

  test('should close modal when close button is clicked', async ({ page }) => {
    // Open deposit modal
    await page.click('button', { hasText: /deposit/i });

    // Check modal is open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Click close button
    const closeButton = page.locator('button[aria-label="close"]');
    await closeButton.click();

    // Check modal is closed
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should display wallet connection info in modal', async ({ page }) => {
    // Open deposit modal
    await page.click('button', { hasText: /deposit/i });

    // Check wallet info display
    const walletInfo = page.locator('[data-testid="wallet-info"]');
    await expect(walletInfo).toBeVisible();
    await expect(walletInfo).toHaveText(/GD5DJQD…J2XQK2/);
    await expect(walletInfo).toHaveText(/TESTNET/);
  });

  test('should disable submit button when wallet is not connected', async ({ page }) => {
    // Mock disconnected wallet
    await page.addInitScript(() => {
      window.freighter = {
        isConnected: async () => ({ isConnected: false }),
        getAddress: async () => ({ error: 'Wallet not connected' }),
        getNetwork: async () => ({ network: 'TESTNET' }),
        signTransaction: async () => ({ error: 'Wallet not connected' }),
        requestAccess: async () => ({ error: 'Wallet not connected' })
      };
    });

    // Open deposit modal
    await page.click('button', { hasText: /deposit/i });

    // Check submit button is disabled
    const submitButton = page.locator('button', { hasText: /deposit/i });
    await expect(submitButton).toBeDisabled();
    
    // Check helper message
    await expect(page.locator('text=Connect your Freighter wallet to continue')).toBeVisible();
  });
});
