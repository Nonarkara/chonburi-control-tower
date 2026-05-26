import { test, expect } from "@playwright/test";

/**
 * Smoke tests — these are the contracts that, if broken, mean a council
 * briefing fails. Each test is independent and runs against a fresh page.
 *
 * Philosophy: assert structure + behaviour, never assert specific live data
 * values (those depend on upstream APIs / env keys we don't control here).
 *
 * Selector strategy: prefer aria-label exact matches and text content. The
 * dashboard is map-heavy so we give it generous timeouts.
 */

test.setTimeout(60_000);

test.describe("Dashboard boot", () => {
  test("loads with map host and top bar", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });
    // Top bar contains the SOURCES button — that's the proof the React tree mounted.
    await expect(page.getByRole("button", { name: "Open source catalog" })).toBeVisible();
  });

  test("does not throw uncaught page errors during initial load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });
    // Give async chunks + map a beat to finish
    await page.waitForTimeout(2_000);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("Lens switching", () => {
  test("INT and MAR lens buttons toggle aria-pressed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    // Lens buttons have label as text content (EXEC / OPS / MOB / MAR / etc.) and
    // their aria-label is the long description. Match by exact text inside .lens container.
    const lensPalette = page.locator(".lens");
    const intButton = lensPalette.locator("button", { hasText: /^INT$/ });
    const marButton = lensPalette.locator("button", { hasText: /^MAR$/ });

    await intButton.click();
    await expect(intButton).toHaveAttribute("aria-pressed", "true");

    await marButton.click();
    await expect(marButton).toHaveAttribute("aria-pressed", "true");
    await expect(intButton).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("Source catalog modal", () => {
  test("opens on SOURCES click and closes via ESC", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    const sourcesBtn = page.getByRole("button", { name: "Open source catalog" });
    await sourcesBtn.focus();
    await sourcesBtn.click();

    const dialog = page.getByRole("dialog", { name: /Source catalog/i });
    await expect(dialog).toBeVisible();
    // Catalog row count summary is always rendered (even if /api/health hasn't returned)
    await expect(dialog.getByText(/SOURCE CATALOG/i)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });
});

test.describe("MODELLED chip on traffic hour rail", () => {
  test("is visible and carries an accessible label", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    const chip = page.getByLabel(/Modelled — not live sensor data/i);
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText(/MODELLED/);
  });
});

test.describe("Layer palette — count badge suppression", () => {
  test("Distance grid layer toggle does NOT show a numeric count badge", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    // Layer toggles have role="checkbox". Distance grid lives in the "municipality"
    // group, which is open by default. Expand it explicitly in case a prior preset collapsed it.
    const muniHead = page.getByRole("button", { name: /Municipality layers/i });
    if (await muniHead.getAttribute("aria-expanded") === "false") await muniHead.click();

    const dgRow = page.getByRole("checkbox").filter({ hasText: /Distance grid/i }).first();
    await expect(dgRow).toBeVisible({ timeout: 10_000 });

    // The row must NOT contain the .layer-count element — that's the contract we just shipped.
    const badgeCount = await dgRow.locator(".layer-count").count();
    expect(badgeCount).toBe(0);
  });
});

test.describe("MAR lens — panel headers", () => {
  test("CoastalBrief, TidePanel and FisheryPanel render their PanelHeader eyebrows", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    // Switch to MAR lens
    const marButton = page.locator(".lens").getByRole("button", { name: /^MAR$/i });
    await marButton.click();
    await expect(marButton).toHaveAttribute("aria-pressed", "true");

    // Each panel's PanelHeader renders the title as an eyebrow element.
    // Give panels time to mount (they're async data-dependent).
    await expect(page.getByText(/SEA STATE/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/TIDAL PREDICTION/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/FISHERY CONDITIONS/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
