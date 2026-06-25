import { test, expect } from '@playwright/test';

test.describe('Payout Form and Mocked Transfer Initiation', () => {
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

  test('should open payout modal when withdraw button is clicked', async ({ page }) => {
    // Click withdraw button (admin mode)
    const withdrawButton = page.locator('button', { hasText: /withdraw/i });
    await withdrawButton.click();

    // Check modal is open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Check modal title
    await expect(page.locator('h2', { hasText: /withdraw from bridge/i })).toBeVisible();
  });

  test('should show recipient address field in withdraw mode', async ({ page }) => {
    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Check recipient field is visible
    const recipientLabel = page.locator('label', { hasText: /recipient address/i });
    await expect(recipientLabel).toBeVisible();
    
    const recipientInput = page.locator('input[placeholder="G..."]');
    await expect(recipientInput).toBeVisible();
    
    // Check helper text
    await expect(page.locator('text=leave blank for self')).toBeVisible();
  });

  test('should validate recipient address format', async ({ page }) => {
    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Enter invalid recipient address
    const recipientInput = page.locator('input[placeholder="G..."]');
    await recipientInput.fill('invalid-address');

    // Enter valid amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('1.0');

    // Try to submit
    const submitButton = page.locator('button', { hasText: /withdraw/i });
    await submitButton.click();

    // Check for validation error
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/invalid recipient address/i);
  });

  test('should accept valid Stellar address format', async ({ page }) => {
    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Enter valid recipient address
    const recipientInput = page.locator('input[placeholder="G..."]');
    await recipientInput.fill('GD5DJQD7KGYRY4TSK4K2V5J2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2');

    // Enter valid amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('0.5');

    // Submit should not show address validation error
    const submitButton = page.locator('button', { hasText: /withdraw/i });
    await submitButton.click();

    // Check loading state
    const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    await expect(loadingSpinner).toBeVisible();
  });

  test('should allow withdrawal to self when recipient is blank', async ({ page }) => {
    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Leave recipient blank (self-withdrawal)
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('1.0');

    // Submit
    const submitButton = page.locator('button', { hasText: /withdraw/i });
    await submitButton.click();

    // Check loading state
    await expect(page.locator('button', { hasText: /signing & submitting/i })).toBeVisible();
  });

  test('should show loading state during withdrawal processing', async ({ page }) => {
    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Enter valid amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('2.0');

    // Submit
    const submitButton = page.locator('button', { hasText: /withdraw/i });
    await submitButton.click();

    // Check loading indicators
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    await expect(page.locator('button', { hasText: /signing & submitting/i })).toBeVisible();
    
    // Check button is disabled during processing
    await expect(submitButton).toBeDisabled();
  });

  test('should show success state after successful withdrawal', async ({ page }) => {
    // Mock successful withdrawal
    await page.addInitScript(() => {
      window.withdrawFromContract = async () => 'mock-withdrawal-tx-hash-67890';
    });

    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Enter valid amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('1.5');

    // Submit
    const submitButton = page.locator('button', { hasText: /withdraw/i });
    await submitButton.click();

    // Wait for success state
    await page.waitForTimeout(2000);

    // Check success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('text=Transaction Confirmed!')).toBeVisible();
    
    // Check withdrawal details
    await expect(page.locator('text=Withdrawal of 1.5 XLM processed successfully')).toBeVisible();
    
    // Check transaction hash link
    const txLink = page.locator('a[href*="stellar.expert"]');
    await expect(txLink).toBeVisible();
    await expect(txLink).toHaveAttribute('href', /mock-withdrawal-tx-hash-67890/);
  });

  test('should show error state for failed withdrawal', async ({ page }) => {
    // Mock failed withdrawal
    await page.addInitScript(() => {
      window.freighter.signTransaction = async () => ({
        error: 'Withdrawal failed: insufficient contract balance'
      });
    });

    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Enter valid amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('1.0');

    // Submit
    const submitButton = page.locator('button', { hasText: /withdraw/i });
    await submitButton.click();

    // Wait for error state
    await page.waitForTimeout(2000);

    // Check error message
    const errorContainer = page.locator('[data-testid="error-container"]');
    await expect(errorContainer).toBeVisible();
    await expect(errorContainer).toHaveText(/withdrawal failed/i);
  });

  test('should validate withdrawal amount', async ({ page }) => {
    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Try to submit without amount
    const submitButton = page.locator('button', { hasText: /withdraw/i });
    await submitButton.click();

    // Check validation error
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/please enter a valid amount/i);
  });

  test('should display correct wallet info for withdrawal', async ({ page }) => {
    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Check wallet info display
    const walletInfo = page.locator('[data-testid="wallet-info"]');
    await expect(walletInfo).toBeVisible();
    await expect(walletInfo).toHaveText(/GD5DJQD…J2XQK2/);
    await expect(walletInfo).toHaveText(/TESTNET/);
  });

  test('should handle withdrawal to different recipient', async ({ page }) => {
    // Mock successful withdrawal to different address
    await page.addInitScript(() => {
      window.withdrawFromContract = async (from, to, amount) => {
        console.log(`Withdrawing ${amount} from ${from} to ${to}`);
        return 'mock-transfer-to-recipient-tx-hash';
      };
    });

    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Enter recipient address
    const recipientInput = page.locator('input[placeholder="G..."]');
    await recipientInput.fill('GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456');

    // Enter amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('0.75');

    // Submit
    const submitButton = page.locator('button', { hasText: /withdraw/i });
    await submitButton.click();

    // Wait for success
    await page.waitForTimeout(2000);

    // Check success state
    await expect(page.locator('text=Transaction Confirmed!')).toBeVisible();
    await expect(page.locator('text=Withdrawal of 0.75 XLM processed successfully')).toBeVisible();
  });

  test('should close modal after successful withdrawal', async ({ page }) => {
    // Mock successful withdrawal
    await page.addInitScript(() => {
      window.withdrawFromContract = async () => 'mock-success-tx-hash';
    });

    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Enter amount and submit
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('1.0');
    
    const submitButton = page.locator('button', { hasText: /withdraw/i });
    await submitButton.click();

    // Wait for success
    await page.waitForTimeout(2000);

    // Click close button on success screen
    const closeButton = page.locator('button', { hasText: /close/i });
    await closeButton.click();

    // Check modal is closed
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should disable withdrawal when wallet not connected', async ({ page }) => {
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

    // Open withdraw modal
    await page.click('button', { hasText: /withdraw/i });

    // Check submit button is disabled
    const submitButton = page.locator('button', { hasText: /withdraw/i });
    await expect(submitButton).toBeDisabled();
    
    // Check helper message
    await expect(page.locator('text=Connect your Freighter wallet to continue')).toBeVisible();
  });
});
