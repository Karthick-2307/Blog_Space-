import { expect, test, type Page } from "@playwright/test";

/**
 * Full user journey against a real Supabase project.
 * Requires: E2E_SUPABASE=1, email confirmation turned OFF in Supabase Auth
 * (use a separate test project), and the migrations applied.
 * Never point this at production data.
 */
test.skip(!process.env.E2E_SUPABASE, "Set E2E_SUPABASE=1 to run against a configured Supabase project.");
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const userA = { username: `e2e_a_${stamp}`, email: `e2e_a_${stamp}@example.com`, password: "e2ePassw0rd!" };
const userB = { username: `e2e_b_${stamp}`, email: `e2e_b_${stamp}@example.com`, password: "e2ePassw0rd!" };
const title = `E2E article ${stamp}`;
let articleUrl = "";
let editUrl = "";

async function register(page: Page, u: typeof userA) {
  await page.goto("/register");
  await page.getByLabel("Username").fill(u.username);
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByLabel("Confirm password").fill(u.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

async function login(page: Page, u: typeof userA) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

test("protected pages redirect guests to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await page.goto("/write");
  await expect(page).toHaveURL(/\/login\?next=%2Fwrite/);
});

test("user A registers, drafts, publishes, comments, edits and logs out", async ({ page }) => {
  await register(page, userA);
  await expect(page.getByRole("heading", { name: "Your dashboard" })).toBeVisible();

  // Draft
  await page.goto("/write");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("textbox", { name: "Article content" }).click();
  await page.keyboard.type("This is an end-to-end test article with enough words to be published properly.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/write\/[0-9a-f-]{36}$/);
  editUrl = new URL(page.url()).pathname;

  // Publish
  await page.getByRole("button", { name: "Publish" }).click();
  await page.waitForURL(/\/blog\//);
  articleUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // Comment, then delete it
  await page.getByLabel("Write a comment").fill("First comment from E2E");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("First comment from E2E")).toBeVisible();
  await page.getByRole("button", { name: "Comment options" }).first().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("First comment from E2E")).toHaveCount(0);

  // Edit the article
  await page.goto(editUrl);
  await page.getByLabel("Title").fill(`${title} (edited)`);
  await page.getByRole("button", { name: "Update" }).click();
  await page.waitForURL(/\/blog\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("(edited)");

  await logout(page);
});

test("user B cannot edit user A's article", async ({ page, request }) => {
  await register(page, userB);
  await page.goto(editUrl);
  await expect(page.getByText("You can't edit this article")).toBeVisible();

  // API calls with B's session cookies
  const id = editUrl.split("/").pop()!;
  const patch = await page.request.patch(`/api/v1/posts/${id}`, { data: { title: "Hacked" } });
  expect(patch.status()).toBe(403);
  const del = await page.request.delete(`/api/v1/posts/${id}`);
  expect(del.status()).toBe(403);

  // Guests cannot comment
  const guest = await request.post(`/api/v1/posts/${id}/comments`, { data: { content: "hi" } });
  expect(guest.status()).toBe(401);

  // B likes and bookmarks A's article
  await page.goto(articleUrl);
  await page.getByRole("button", { name: "Like this article" }).click();
  await expect(page.getByRole("button", { name: "Unlike this article" })).toBeVisible();
  await page.getByRole("button", { name: "Bookmark this article" }).click();
  await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
  await page.goto("/bookmarks");
  await expect(page.getByText(title)).toBeVisible();
  await logout(page);
});

test("user A logs back in and deletes the article", async ({ page }) => {
  await login(page, userA);
  await page.getByRole("button", { name: new RegExp(`Delete "${title}`) }).click();
  await page.getByRole("button", { name: "Delete article" }).click();
  await expect(page.getByText(title)).toHaveCount(0);
});
