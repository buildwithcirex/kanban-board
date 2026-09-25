import { expect, test } from '@playwright/test'

test('app shell loads and navigates between sections', async ({ page, isMobile }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Boards · Kanban')

  const nav = page.getByRole('navigation', { name: 'Main' }).locator('visible=true')
  await expect(nav).toHaveCount(1)

  await nav.getByRole('link', { name: 'My Tasks' }).click()
  await expect(page).toHaveURL(/\/my-tasks$/)
  await expect(page.getByText('Nothing assigned to you')).toBeVisible()

  await nav.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()

  // Mobile uses the bottom tab bar; desktop uses the sidebar.
  const box = await nav.boundingBox()
  const viewport = page.viewportSize()
  if (isMobile) expect(box!.y + box!.height).toBeCloseTo(viewport!.height, 0)
  else expect(box!.x).toBe(0)
})

test('theme choice persists across reloads', async ({ page }) => {
  await page.goto('/settings')
  await page.getByText('Dark', { exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('unknown routes show the not-found page', async ({ page }) => {
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
