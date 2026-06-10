import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/', title: 'Dashboard' },
  { path: '/syllabus', title: 'Syllabus' },
  { path: '/coach', title: 'Coach' },
  { path: '/tutor', title: 'Tutor' },
  { path: '/log', title: 'Log' },
  { path: '/revisions', title: 'Revisions' },
  { path: '/tests', title: 'Tests' },
  { path: '/mocks', title: 'Mock Tests' },
  { path: '/analytics', title: 'Analytics' },
  { path: '/planner', title: 'Planner' },
  { path: '/profile', title: 'Profile' },
  { path: '/resources', title: 'Resources' },
  { path: '/advanced', title: 'Advanced' },
  { path: '/settings', title: 'Settings' },
];

test.describe('All routes load successfully', () => {
  for (const route of ROUTES) {
    test(`${route.path} — ${route.title}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      const response = await page.goto(route.path, { waitUntil: 'networkidle' });
      expect(response).not.toBeNull();
      expect(response!.status()).toBe(200);

      // Wait for client hydration
      await page.waitForTimeout(500);

      expect(errors).toHaveLength(0);

      // Verify the page title is present
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
  }
});
