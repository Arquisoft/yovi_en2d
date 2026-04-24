import { When, Then } from "@cucumber/cucumber";

When("I click the {string} play card", async function (cardType) {
    if (cardType === "bot") {
        await this.page.click('.play-card:has-text("🤖")');
    } else {
        await this.page.click('.play-card:has-text("👥")');
    }
});

When("I click the {string} play card again", async function (cardType) {
    if (cardType === "bot") {
        await this.page.click('.play-card:has-text("🤖")');
    } else {
        await this.page.click('.play-card:has-text("👥")');
    }
});

When("I click the start game button", async function () {
    await this.page.click(
        'button:has-text("Start"), button:has-text("Jugar"), button:has-text("Empezar")'
    );
});

When("I select board size {string}", async function (size) {
    const selects = await this.page.$$("select");
    await selects[selects.length - 1].selectOption(size);
});

When("I select bot {string}", async function (botValue) {
    const selects = await this.page.$$("select");
    await selects[0].selectOption(botValue);
});

Then("I should see a welcome message containing {string}", async function (username) {
    const el = await this.page.waitForSelector("h1", { timeout: 5000 });
    const text = await el.textContent();

    if (!text || !text.includes(username)) {
        throw new Error(`Expected welcome message to include "${username}" but got: ${text}`);
    }
});

Then("I should see the bot configuration panel", async function () {
    await this.page.waitForSelector("h2", { timeout: 3000 });
});

Then("I should see the player configuration panel", async function () {
    await this.page.waitForSelector("h2", { timeout: 3000 });
});

Then("I should see the bot selector dropdown", async function () {
    const selects = await this.page.$$("select");
    if (selects.length < 2) {
        throw new Error("Expected bot + board size selectors");
    }
});

Then("I should not see the bot selector dropdown", async function () {
    const selects = await this.page.$$("select");
    if (selects.length >= 2) {
        throw new Error("Expected only board size selector");
    }
});

Then("I should see the board size selector", async function () {
    const selects = await this.page.$$("select");
    if (selects.length === 0) {
        throw new Error("No select found");
    }
});

Then("I should not see the configuration panel", async function () {
    const selects = await this.page.$$("select");
    if (selects.length > 0) {
        throw new Error("Config panel still visible");
    }
});

Then("the board size selector should show {string}", async function (size) {
    const selects = await this.page.$$("select");
    const last = selects[selects.length - 1];

    const value = await last.evaluate((el) => el.value);

    if (value !== size) {
        throw new Error(`Expected ${size} but got ${value}`);
    }
});

Then("the bot selector should show {string}", async function (botValue) {
    const selects = await this.page.$$("select");
    const value = await selects[0].evaluate((el) => el.value);

    if (value !== botValue) {
        throw new Error(`Expected ${botValue} but got ${value}`);
    }
});