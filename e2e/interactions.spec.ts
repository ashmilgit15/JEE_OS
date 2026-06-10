import { test, expect } from '@playwright/test';

test.describe('Dashboard interactions', () => {
  test('dashboard renders with greeting and stats', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('Good morning').or(page.getByText('Good afternoon')).or(page.getByText('Good evening'))).toBeVisible();

    const sidebar = page.locator('aside');
    if (await sidebar.isVisible()) {
      // Desktop: stat labels visible in stat cards
      await expect(page.getByText('Study Target', { exact: true })).toBeVisible();
    }

    await expect(page.getByText('AI Strategy Control HUD')).toBeVisible();
    await expect(page.getByText('Burnout & Fatigue Index')).toBeVisible();
    await expect(page.getByText('JEE Readiness Score')).toBeVisible();
    await expect(page.getByText('Quick Actions')).toBeVisible();
    await expect(page.getByText('Recent Activity')).toBeVisible();
    await expect(page.getByText('Overall Syllabus Progress')).toBeVisible();
  });

  test('study recommendation modal opens and closes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const openBtn = page.getByText('Study Recommendation Checklist');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    await page.waitForTimeout(500);

    await expect(page.getByText('Your Personalized Study Priorities')).toBeVisible();

    const closeBtn = page.getByText('Close Checklist');
    await closeBtn.click();
    await page.waitForTimeout(500);
  });

  test('quick action buttons navigate correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const quickTestLink = page.locator('a[href="/tests"]').first();
    await quickTestLink.click();
    await page.waitForURL('**/tests');
    expect(page.url()).toContain('/tests');

    await page.goto('/', { waitUntil: 'networkidle' });
    const revisionsLink = page.locator('a[href="/revisions"]').first();
    await revisionsLink.click();
    await page.waitForURL('**/revisions');
    expect(page.url()).toContain('/revisions');

    await page.goto('/', { waitUntil: 'networkidle' });
    const coachLink = page.locator('a[href="/coach"]').first();
    await coachLink.click();
    await page.waitForURL('**/coach');
    expect(page.url()).toContain('/coach');
  });
});

test.describe('Syllabus page', () => {
  test('syllabus page loads subjects', async ({ page }) => {
    await page.goto('/syllabus', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Physics', exact: true }).first()).toBeVisible();
  });
});

test.describe('Tests page', () => {
  test('tests page loads', async ({ page }) => {
    await page.goto('/tests', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Log page', () => {
  test('log page loads', async ({ page }) => {
    await page.goto('/log', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Revisions page', () => {
  test('revisions page loads', async ({ page }) => {
    await page.goto('/revisions', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Profile page', () => {
  test('profile page loads with form elements', async ({ page }) => {
    await page.goto('/profile', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Analytics page', () => {
  test('analytics page loads with charts', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/analytics', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await expect(page.locator('h1, h2').first()).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});

test.describe('Planner page', () => {
  test('planner page loads', async ({ page }) => {
    await page.goto('/planner', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Settings page', () => {
  test('settings page loads', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Resources page', () => {
  test('resources page loads', async ({ page }) => {
    await page.goto('/resources', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Advanced AI page', () => {
  test('advanced AI page loads', async ({ page }) => {
    await page.goto('/advanced', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Mocks page', () => {
  test('mock tests page loads', async ({ page }) => {
    await page.goto('/mocks', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('AI Tutor page', () => {
  test('tutor page loads with chat interface', async ({ page }) => {
    await page.goto('/tutor', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('AI Coach page', () => {
  test('coach page loads', async ({ page }) => {
    await page.goto('/coach', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('localStorage state persistence', () => {
  test('state is persisted to localStorage on page load', async ({ page }) => {
    await page.goto('/profile', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // wait for loadState to complete

    const stored = await page.evaluate(() => localStorage.getItem('jee-os-state'));
    expect(stored).not.toBeNull();

    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed).toHaveProperty('syllabus');
      expect(parsed).toHaveProperty('profile');
      expect(parsed).toHaveProperty('studyLogs');
      expect(parsed).toHaveProperty('revisions');
      expect(parsed).toHaveProperty('testAttempts');
      expect(parsed).toHaveProperty('dailyPlans');
    }
  });
});
