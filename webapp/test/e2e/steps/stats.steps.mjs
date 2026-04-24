import { When, Then } from "@cucumber/cucumber";

When("I navigate to the stats page", async function () {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    // Navigate via the navbar link so router state and localStorage are preserved.
    // A raw goto("/stats") loses the location.state the component relies on.
    await page.click('button.nav-link:has-text("Stats"), button.nav-link:has-text("Estad")');
    await page.waitForURL("**/stats", { timeout: 10000 });
    await page.waitForSelector(".page-main", { timeout: 10000 });
});

Then("I should see the stats page title", async function () {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    const el = await page.waitForSelector("h1", { timeout: 5000 });
    const text = await el.textContent();
    if (!text || text.trim().length === 0)
        throw new Error("Stats page title is empty");
});

Then("I should see the games played card", async function () {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    // Wait for loading to finish first, then check for the card
    await page.waitForSelector('div:has-text("⏳")', { state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForSelector('div:has-text("🎮")', { timeout: 8000 });
});

Then("I should see the wins card", async function () {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    await page.waitForSelector('div:has-text("🏆")', { timeout: 5000 });
});

Then("I should see the losses card", async function () {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    await page.waitForSelector('div:has-text("💀")', { timeout: 5000 });
});

Then("I should see the win rate card", async function () {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    await page.waitForSelector('div:has-text("📈")', { timeout: 5000 });
});

Then(
    "I should see the game history table with columns for result, opponent and date",
    async function () {
        const page = this.page;
        if (!page) throw new Error("Page not initialized");

        const table = await page.waitForSelector("table", { timeout: 8000 });
        if (!table) throw new Error("History table not found");

        const headers = await page.$$("thead th");
        if (headers.length < 3)
            throw new Error(`Expected at least 3 table columns but found ${headers.length}`);
    }
);

Then("I should see an error or empty state message", async function () {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    // Wait for loading spinner to disappear
    await page.waitForSelector('div:has-text("⏳")', { state: "detached", timeout: 10000 }).catch(() => {});

    const errorEl = await page.$("p[style*='danger'], .msg--error");
    if (!errorEl)
        throw new Error("Expected an error or empty-state message but found none");
});
