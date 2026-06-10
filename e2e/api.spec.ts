import { test, expect } from '@playwright/test';

test.describe('Chat API', () => {
  test('POST /api/chat returns NDJSON stream', async ({ page }) => {
    const response = await page.request.post('/api/chat', {
      data: {
        messages: [
          { role: 'user', content: 'Hello, what is the formula for force?' },
        ],
        subject: 'physics',
        topicName: 'Laws of Motion',
        tutorMode: 'tutor',
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/event-stream');

    // Read the stream and validate JSON lines
    const body = await response.body();
    const text = new TextDecoder().decode(body);
    const lines = text.trim().split('\n');

    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const parsed = JSON.parse(line);
      // Each line should be a JSON object with a type field
      expect(parsed).toHaveProperty('type');
    }
  });

  test('POST /api/chat handles empty messages gracefully', async ({ page }) => {
    const response = await page.request.post('/api/chat', {
      data: {
        messages: [],
        subject: 'physics',
        tutorMode: 'tutor',
      },
    });

    expect(response.status()).toBe(200);
  });

  test('GET /api/chat returns 405', async ({ page }) => {
    const response = await page.request.get('/api/chat');
    expect(response.status()).toBe(405);
  });
});
