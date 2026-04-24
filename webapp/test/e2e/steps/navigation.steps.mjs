
import { When, Then } from "@cucumber/cucumber";

When("I am on the home page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForSelector(".page-main", { timeout: 5000 });
});

When("I click the Stats nav link", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  // Matches both English "Stats" and Spanish "Estadísticas"
  await page.click('button.nav-link:has-text("Stats"), button.nav-link:has-text("Estad")');
});

When("I click the Game nav link", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.click('button.nav-link:has-text("Game"), button.nav-link:has-text("Juego")');
});

When("I click the logout button", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.click(".nav-link--exit");
});

Then("I should see the navbar with the username {string}", async function (username) {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const el = await page.waitForSelector(".nav-user", { timeout: 5000 });
  const text = await el.textContent();
  if (!text || !text.includes(username)) {
    throw new Error(`Expected navbar to show username "${username}" but got: ${text}`);
  }
});

Then("I should be on the stats page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL("**/stats", { timeout: 5000 });
  const normalized = new URL(page.url()).pathname;
  if (normalized !== "/stats") {
    throw new Error(`Expected path to be "/stats" but got: ${normalized}`);
  }
});

Then("I should be on the game page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL("**/game", { timeout: 5000 });
  const pathname = new URL(page.url()).pathname;
  if (!pathname.startsWith("/game")) {
    throw new Error(`Expected path to start with "/game" but got: ${pathname}`);
  }
});
