import { expect, test } from "@playwright/test";

/** Checks that run with or without a configured database. */
test.describe("public pages", () => {
  test("homepage renders the hero and navigation", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Read what people are writing");
    await expect(page.getByRole("link", { name: "Write a post" })).toBeVisible();
    await expect(page.getByRole("link", { name: "BlogSpace home" }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("explore page has search and sort controls", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search articles" })).toBeVisible();
    await expect(page.getByRole("button", { name: "popular" })).toBeVisible();
  });

  test("login form validates input on the client", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
  });

  test("register form checks matching passwords", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Username").fill("tester_1");
    await page.getByLabel("Email").fill("tester@example.com");
    await page.getByLabel("Password", { exact: true }).fill("secret123");
    await page.getByLabel("Confirm password").fill("different1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords do not match.")).toBeVisible();
  });

  test("password visibility toggle works", async ({ page }) => {
    await page.goto("/login");
    const pw = page.getByLabel("Password", { exact: true });
    await expect(pw).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(pw).toHaveAttribute("type", "text");
  });

  test("unknown pages show the 404 page", async ({ page }) => {
    const res = await page.goto("/this-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("theme toggle switches between dark and light", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "Toggle light and dark theme" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});

test.describe("API without a session", () => {
  test("protected endpoints reject guests", async ({ request }) => {
    const create = await request.post("/api/v1/posts", { data: { title: "x", contentHtml: "" } });
    expect([401, 503]).toContain(create.status());
    const body = await create.json();
    expect(body.error.code).toMatch(/UNAUTHORIZED|SERVICE_UNAVAILABLE/);

    const bookmarks = await request.get("/api/v1/bookmarks");
    expect([401, 503]).toContain(bookmarks.status());
  });
});
