import { Given, When, Then } from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "https://gameofy.publicvm.com";

Given("the login page is open", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.goto(`${BASE_URL}/`);
  await page.waitForSelector("#login-user", { timeout: 5000 });
});

When(
  "I enter {string} as the username and {string} as the password and submit",
  async function (username, password) {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    await page.fill("#login-user", username);
    await page.fill("#login-pw", password);
    await page.click('button[type="submit"]');
  }
);

When(
  "I submit the login form with username {string} and password {string}",
  async function (username, password) {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    await page.fill("#login-user", username);
    await page.fill("#login-pw", password);
    await page.click('button[type="submit"]');
  }
);

Then("I should be redirected to the home page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL("**/home", { timeout: 10000 });
  const normalized = new URL(page.url()).pathname;
  if (normalized !== "/home") {
    throw new Error(`Expected path to be "/home" but got: ${normalized}`);
  }
});

Then("I should see a login error message", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const el = await page.waitForSelector(".msg--error", { timeout: 5000 });
  const text = await el.textContent();
  if (!text || text.trim().length === 0) {
    throw new Error("Expected a non-empty error message but found none");
  }
});

When("I click the register link", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.click(".text-link");
});

Then("I should be on the register page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL("**/register", { timeout: 5000 });
  const normalized = new URL(page.url()).pathname;
  if (normalized !== "/register") {
    throw new Error(`Expected path to be "/register" but got: ${normalized}`);
  }
});
