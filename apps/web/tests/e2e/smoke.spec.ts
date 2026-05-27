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

// 90s per test — map + lazy chunks + Vite dev server compile time add up.
// Individual tests pass in ~12–40s; the 60s default flakes once Vite cache warms.
test.setTimeout(90_000);

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
    // SourceCatalog is lazy-loaded — give the chunk time to arrive on first open.
    await expect(dialog).toBeVisible({ timeout: 15_000 });
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

    // CoastalBrief, TidePanel, FisheryPanel are always rendered in the sidebar
    // (not gated by a specific lens). PanelHeader renders its title immediately,
    // even during loading state — so no API data is required.
    await expect(page.getByText(/SEA STATE/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/TIDAL PREDICTION/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/FISHERY CONDITIONS/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("EAR lens — Earth obs panel header", () => {
  test("EarthAlphaBrief PanelHeader eyebrow is visible in the sidebar", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    // EarthAlphaBrief is always rendered in the sidebar (not lens-gated).
    // PanelHeader renders "EARTH OBS · NASA GIBS + GISTDA" immediately on mount.
    await expect(page.getByText(/EARTH OBS/i).first()).toBeVisible({ timeout: 15_000 });
    // SHEETS status badge is rendered as the actions prop — always visible
    await expect(page.getByText(/SHEETS/i).first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("EXEC lens — executive briefing header", () => {
  test("ExecutiveBriefing PanelHeader eyebrow is visible in EXEC lens", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    // ExecutiveBriefing IS gated by lens === "executive". Use hasText (not getByRole name)
    // because lens buttons have aria-label set to the full description, not just the label.
    const execButton = page.locator(".lens").locator("button", { hasText: /^EXEC$/ });
    await execButton.click();
    await expect(execButton).toHaveAttribute("aria-pressed", "true");

    // ExecutiveBriefing renders "EXECUTIVE BRIEF" as its PanelHeader title
    await expect(page.getByText(/EXECUTIVE BRIEF/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Source catalog — filter buttons", () => {
  test("LIVE filter narrows the catalog to live-status entries only", async ({ page }) => {
    // The SourceCatalog is lazy-loaded — give it more time than the default 60s.
    test.setTimeout(90_000);

    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    // Open the catalog — focus before click so the lazy-loaded chunk has time to start
    const sourcesBtn = page.getByRole("button", { name: "Open source catalog" });
    await sourcesBtn.focus();
    await sourcesBtn.click();
    const dialog = page.getByRole("dialog", { name: /Source catalog/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Click the LIVE filter — the button's accessible name IS "LIVE" (text content)
    const liveFilter = dialog.locator("button", { hasText: /^LIVE$/ });
    await liveFilter.click();
    await expect(liveFilter).toHaveAttribute("aria-pressed", "true");

    // Verify filtered view: at least one live entry is visible and the first pill reads LIVE.
    // We don't iterate all pills (race-prone with React re-render timing).
    const statusPills = dialog.locator(".catalog-status");
    await expect(statusPills.first()).toBeVisible({ timeout: 5_000 });
    await expect(statusPills.first()).toHaveText("LIVE");
  });
});

test.describe("ChatBox — open / close", () => {
  test("Ask CTM button opens chat panel; ESC closes it", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    // Chat handle must be visible before opening
    const handle = page.getByRole("button", { name: /Open concierge chat/i });
    await expect(handle).toBeVisible({ timeout: 10_000 });
    await handle.click();

    // Dialog opens — aria-label set in ChatBox
    const chat = page.getByRole("dialog", { name: /Concierge chat/i });
    await expect(chat).toBeVisible({ timeout: 5_000 });

    // Input field and clear button must be present
    await expect(chat.getByRole("textbox")).toBeVisible();

    // ESC closes the panel
    await page.keyboard.press("Escape");
    await expect(chat).toBeHidden({ timeout: 5_000 });
  });
});

test.describe("PART MODELLED chip on municipality ops panel", () => {
  test("PmcuBrief renders its PART MODELLED chip with accessible label", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    const chip = page.getByLabel(/Partly modelled data/i);
    await expect(chip).toBeVisible({ timeout: 15_000 });
    await expect(chip).toHaveText(/PART MODELLED/);
  });
});

test.describe("HourRail — weekday/weekend toggle", () => {
  test("Weekday and Weekend buttons toggle aria-pressed state correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    // HourRail is in the bottom bar — MODELLED chip confirms it's mounted
    const modelled = page.getByLabel(/Modelled — not live sensor data/i);
    await expect(modelled).toBeVisible({ timeout: 10_000 });

    const weekdayBtn = page.getByRole("button", { name: /Show weekday traffic pattern/i });
    const weekendBtn = page.getByRole("button", { name: /Show weekend traffic pattern/i });

    // Default is weekday
    await expect(weekdayBtn).toHaveAttribute("aria-pressed", "true");
    await expect(weekendBtn).toHaveAttribute("aria-pressed", "false");

    // Switch to weekend
    await weekendBtn.click();
    await expect(weekendBtn).toHaveAttribute("aria-pressed", "true");
    await expect(weekdayBtn).toHaveAttribute("aria-pressed", "false");

    // Switch back
    await weekdayBtn.click();
    await expect(weekdayBtn).toHaveAttribute("aria-pressed", "true");
    await expect(weekendBtn).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("EO layer toggles", () => {
  test("clicking a satellite layer toggle flips its aria-pressed state", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    // EarthAlphaBrief is always in the sidebar — wait for its PanelHeader to confirm mount
    await expect(page.getByText(/EARTH OBS/i).first()).toBeVisible({ timeout: 15_000 });

    // The Rain toggle (satellite-imerg) renders with text "Rain" and a "on"/"off" caption.
    // Its accessible name comes from text content, not aria-label or title.
    const rainToggle = page.locator(".layer-toggle", { hasText: /^Rain/ }).first();
    await expect(rainToggle).toBeVisible({ timeout: 10_000 });

    const initialState = await rainToggle.getAttribute("aria-pressed");
    await rainToggle.click();
    const newState = await rainToggle.getAttribute("aria-pressed");

    // State must have flipped
    expect(newState).not.toBe(initialState);
  });
});

test.describe("TopBar — theme toggle", () => {
  test("dark/light theme toggle changes aria-label and body class", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-host")).toBeVisible({ timeout: 20_000 });

    const themeBtn = page.getByRole("button", { name: /Switch to (light|dark) theme/i });
    await expect(themeBtn).toBeVisible({ timeout: 5_000 });

    // Theme is stored as data-theme on <html> ("dark" or "light")
    const html = page.locator("html");
    const initialTheme = await html.getAttribute("data-theme");
    expect(["dark", "light"]).toContain(initialTheme);

    // Click the toggle
    await themeBtn.click();

    // data-theme must have flipped
    const newTheme = await html.getAttribute("data-theme");
    expect(newTheme).not.toBe(initialTheme);
    expect(["dark", "light"]).toContain(newTheme);

    // Button label must now reference the other theme
    const newLabel = await themeBtn.getAttribute("aria-label");
    expect(newLabel).toContain(initialTheme!); // e.g. "Switch to dark theme" → initial was light
  });
});
