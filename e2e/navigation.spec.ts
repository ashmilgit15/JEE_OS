import { test, expect } from '@playwright/test';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/' },
  { name: 'Syllabus', path: '/syllabus' },
  { name: 'AI Coach', path: '/coach' },
  { name: 'AI Tutor', path: '/tutor' },
  { name: 'Study Log', path: '/log' },
  { name: 'Revisions', path: '/revisions' },
  { name: 'Tests', path: '/tests' },
  { name: 'Mock Tests', path: '/mocks' },
  { name: 'Analytics', path: '/analytics' },
  { name: 'Planner', path: '/planner' },
  { name: 'Profile', path: '/profile' },
  { name: 'Resources', path: '/resources' },
  { name: 'Advanced AI', path: '/advanced' },
  { name: 'Settings', path: '/settings' },
];

test.describe('Sidebar navigation', () => {
  test('sidebar displays all navigation items', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    for (const item of NAV_ITEMS) {
      const link = sidebar.getByRole('link', { name: item.name, exact: true });
      await expect(link).toBeVisible();
    }
  });

  test('clicking each nav item navigates to correct route', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const sidebar = page.locator('aside');
    for (const item of NAV_ITEMS) {
      const link = sidebar.getByRole('link', { name: item.name, exact: true });
      await link.click();
      await page.waitForURL(`**${item.path}`);
      expect(page.url()).toContain(item.path);
    }
  });

  test('active nav item has highlighted class', async ({ page }) => {
    await page.goto('/syllabus', { waitUntil: 'networkidle' });
    const syllabusLink = page.locator('aside').getByRole('link', { name: 'Syllabus', exact: true });
    await expect(syllabusLink).toHaveClass(/bg-primary\/10/);
  });

  test('sidebar collapse button toggles sidebar width', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const sidebar = page.locator('aside');
    const collapseBtn = sidebar.getByTestId('collapse-sidebar-btn');
    await collapseBtn.click();
    await page.waitForTimeout(200);
    await collapseBtn.click();
    await page.waitForTimeout(200);
  });
});
