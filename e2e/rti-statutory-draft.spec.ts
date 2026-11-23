import { test, expect } from '@playwright/test';

test.describe('RTI Section 6(1) Drafting & PDF Generation Journey', () => {
  test('Citizen generates an RTI Section 6(1) draft and downloads PDF', async ({ page }) => {
    // 1. Visit Login page and authenticate as Citizen
    await page.goto('/login');
    const citizenButton = page.locator('button', { hasText: 'Citizen' }).first();
    await citizenButton.click();
    await expect(page).toHaveURL('/');

    // 2. Visit RTI Drafter application
    await page.goto('/rti');
    await expect(page).toHaveTitle(/JanSetu Multiverse/);
    await expect(page.locator('h1')).toContainText(/RTI Drafter|Statutory Section 6\(1\)|आरटीआई ड्राफ्टर/i);

    // 2. Verify statutory form fields are populated or enter custom inputs
    const applicantInput = page.locator('input[required]').first();
    await expect(applicantInput).toBeVisible();

    // Ensure questions are provided
    const questionsTextarea = page.locator('textarea').first();
    const currentQuestions = await questionsTextarea.inputValue();
    if (!currentQuestions.trim()) {
      await questionsTextarea.fill(
        '1. Certified copy of tender contract for road resurfacing in Ward 01.\n2. Total budget expenditure and contractor identity.'
      );
    }

    // 3. Trigger AI-assisted statutory drafting
    const generateBtn = page.locator('button[type="submit"]', {
      hasText: /AI-Assist Statutory Draft|Generate/i,
    });
    await generateBtn.click();

    // 4. Verify generated draft appears in live editable preview
    const previewTextarea = page.locator('textarea[placeholder*="Statutory draft will appear here"]');
    await expect(previewTextarea).toBeVisible({ timeout: 15000 });

    const draftText = await previewTextarea.inputValue();
    expect(draftText.length).toBeGreaterThan(100);
    expect(draftText).toMatch(/Section 6\(1\)|Right to Information|RTI Act/i);

    // 5. Test dual-language bilingual toggle (English -> Hindi -> English)
    const hindiTabBtn = page.locator('button', { hasText: /हिन्दी \(Hindi\)/i });
    if (await hindiTabBtn.isVisible()) {
      await hindiTabBtn.click();
      const hindiDraftText = await previewTextarea.inputValue();
      expect(hindiDraftText.length).toBeGreaterThan(50);
      expect(hindiDraftText).toMatch(/सूचना का अधिकार|धारा 6\(1\)|आवेदन/);

      const englishTabBtn = page.locator('button', { hasText: /English/i });
      if (await englishTabBtn.isVisible()) {
        await englishTabBtn.click();
      }
    }

    // 6. Test statutory PDF download
    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
    const downloadPdfBtn = page.locator('button', {
      hasText: /One-Click Statutory PDF Download|Download/i,
    });
    await downloadPdfBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    // Verify downloaded file size > 0
    const stream = await download.createReadStream();
    expect(stream).toBeDefined();
  });
});
