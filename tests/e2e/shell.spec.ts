import { expect, test } from '@playwright/test'

// These run against a production preview build, where the dev user switcher does not exist.
// The app is therefore signed out: what is checked here is the public shell and the auth gate.
// End-to-end flows behind a session arrive with the full suite in Phase 10.

test('app shell loads and navigates between sections', async ({ page, isMobile }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Boards · Kanban')

  const nav = page.getByRole('navigation', { name: 'Main' }).locator('visible=true')
  await expect(nav).toHaveCount(1)

  await nav.getByRole('link', { name: 'My Tasks' }).click()
  await expect(page).toHaveURL(/\/my-tasks$/)
  await expect(page).toHaveTitle('My Tasks · Kanban')

  // Mobile uses the bottom tab bar; desktop uses the sidebar.
  const box = await nav.boundingBox()
  const viewport = page.viewportSize()
  if (isMobile) expect(box!.y + box!.height).toBeCloseTo(viewport!.height, 0)
  else expect(box!.x).toBe(0)
})

test('private pages are behind the sign-in gate', async ({ page }) => {
  await page.goto('/my-tasks')
  await expect(page.getByText('Sign in to continue')).toBeVisible()
  await expect(page.getByText('Nothing assigned to you')).toBeHidden()
})

test('a team page is not reachable without a session', async ({ page }) => {
  await page.goto('/t/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText('Sign in to continue')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Members' })).toBeHidden()
})

test('theme choice persists across reloads', async ({ page }) => {
  await page.goto('/')
  const initial = await page.locator('html').getAttribute('data-theme')
  const expected = initial === 'dark' ? 'light' : 'dark'

  await page.getByRole('button', { name: `Switch to ${expected} theme` }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', expected)

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', expected)
})

test('unknown routes show the not-found page without a session', async ({ page }) => {
  await page.goto('/nope')
  await expect(page.getByText('Page not found')).toBeVisible()
})

test('page has no horizontal overflow', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})
