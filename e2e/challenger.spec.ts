import { test, expect } from '@playwright/test';

// Define the getDOMSummary function exactly as implemented in src/utils/domSummarizer.ts
// so we can serialize it and run it inside the browser context.
const getDOMSummaryStr = `
function getDOMSummary(pathname) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '';

  try {
    const mainContent = document.querySelector('main') || document.body;

    // 1. Path-specific structural scanning
    if (pathname.startsWith('/tests')) {
      const testContainer = mainContent.querySelector('[data-testid="test-taking"]') || mainContent;
      const activeQuestionEl = testContainer.querySelector('.prose, .question-text, h3');
      const activeQuestion = activeQuestionEl ? activeQuestionEl.textContent?.trim() : '';

      const optionsEls = testContainer.querySelectorAll('button[class*="border"], label[class*="border"]');
      const options = Array.from(optionsEls).map(o => o.textContent?.trim()).filter(Boolean);

      if (activeQuestion) {
        return \`[Active Mock Test] Question: "\${activeQuestion}". Options: \${options.map((o, idx) => \`\${idx + 1}) \${o}\`).join(' | ')}. Status: Active test session.\`;
      }
    }

    if (pathname.startsWith('/tutor')) {
      const activeTopicEl = mainContent.querySelector('h2, .tutor-topic-header');
      const activeTopic = activeTopicEl ? activeTopicEl.textContent?.trim() : '';
      if (activeTopic) {
        return \`[Active AI Tutor Session] Topic: "\${activeTopic}".\`;
      }
    }

    if (pathname.startsWith('/log')) {
      const loggedItemsEls = mainContent.querySelectorAll('.card-title, table tr td');
      const loggedItems = Array.from(loggedItemsEls).slice(0, 5).map(i => i.textContent?.trim()).filter(Boolean);
      return \`[Study Log] Visible items: \${loggedItems.join(', ')}\`;
    }

    // 2. Generic DOM outline fallback
    const headings = Array.from(mainContent.querySelectorAll('h1, h2, h3'))
      .map(h => h.textContent?.trim())
      .filter(Boolean)
      .slice(0, 6);

    const firstParagraphs = Array.from(mainContent.querySelectorAll('p'))
      .map(p => p.textContent?.trim())
      .filter(p => !!p && p.length > 20)
      .slice(0, 3);

    return \`Headers: \${headings.join(' > ')}. Description: \${firstParagraphs.join(' ')}\`.substring(0, 800);
  } catch (err) {
    console.error('DOM Scraping failed:', err);
    return '';
  }
}
`;

test.describe('Milestone 1 Empirical Challenger Tests', () => {

  test('DOM Summarizer - path-specific and fallback scanning', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/', { waitUntil: 'load' });

    // Helper to run getDOMSummary on custom DOM
    const runSummary = async (path: string, html: string) => {
      return await page.evaluate(({ fnStr, path, html }) => {
        document.body.innerHTML = html;
        const fn = new Function('pathname', fnStr + '; return getDOMSummary(pathname);');
        return fn(path);
      }, { fnStr: getDOMSummaryStr, path, html });
    };

    // 1. Path `/tests` with active test taker elements
    const testHtml = `
      <main>
        <div data-testid="test-taking">
          <h3>What is the limit of sin(x)/x as x approaches 0?</h3>
          <button class="border-indigo-500">A) 0</button>
          <button class="border-indigo-500">B) 1</button>
          <button class="border-indigo-500">C) Infinity</button>
        </div>
      </main>
    `;
    const summaryTest = await runSummary('/tests', testHtml);
    expect(summaryTest).toBe('[Active Mock Test] Question: "What is the limit of sin(x)/x as x approaches 0?". Options: 1) A) 0 | 2) B) 1 | 3) C) Infinity. Status: Active test session.');

    // 2. Path `/tutor` with active topic
    const tutorHtml = `
      <main>
        <h2 class="tutor-topic-header">Newton's Laws of Motion</h2>
      </main>
    `;
    const summaryTutor = await runSummary('/tutor', tutorHtml);
    expect(summaryTutor).toBe('[Active AI Tutor Session] Topic: "Newton\'s Laws of Motion".');

    // 3. Path `/log` with logged items
    const logHtml = `
      <main>
        <div class="card-title">Study Session 1</div>
        <table>
          <tr><td>Log Item A</td></tr>
          <tr><td>Log Item B</td></tr>
        </table>
      </main>
    `;
    const summaryLog = await runSummary('/log', logHtml);
    expect(summaryLog).toBe('[Study Log] Visible items: Study Session 1, Log Item A, Log Item B');

    // 4. Path `/` generic fallback
    const homeHtml = `
      <main>
        <h1>Welcome to JEE OS</h1>
        <h2>Section A</h2>
        <h3>Subsection B</h3>
        <p>This is a paragraph that has more than 20 characters so it is included in description.</p>
        <p>Short</p>
        <p>Another long paragraph that will also be included in the description string.</p>
      </main>
    `;
    const summaryHome = await runSummary('/', homeHtml);
    expect(summaryHome).toBe('Headers: Welcome to JEE OS > Section A > Subsection B. Description: This is a paragraph that has more than 20 characters so it is included in description. Another long paragraph that will also be included in the description string.');

    // 5. Empty DOM
    const emptyHtml = `<main></main>`;
    const summaryEmpty = await runSummary('/', emptyHtml);
    expect(summaryEmpty).toBe('Headers: . Description: ');
  });

  test('Value Coercion & Supabase Check Constraints Mapping in syncProfile', async ({ page }) => {
    test.setTimeout(60000);
    
    // Mock Supabase Auth to succeed immediately in the sandbox environment
    await page.route('**/auth/v1/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: {
            id: '33333333-3333-3333-3333-333333333333',
            aud: 'authenticated',
            role: 'authenticated',
            email: '',
            phone: '',
            app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
            user_metadata: {},
            identities: [],
            created_at: '2026-06-07T00:00:00Z',
            updated_at: '2026-06-07T00:00:00Z'
          }
        }),
      });
    });

    // Intercept Supabase upsert/query requests
    let capturedPayloads: any[] = [];
    await page.route('**/rest/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/users') && route.request().method() === 'POST') {
        capturedPayloads.push(JSON.parse(route.request().postData() || '{}'));
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
      } else {
        // Return empty arrays for GET requests (logs, revisions, status, etc.)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    // Navigate to page to initialize app
    await page.goto('/profile', { waitUntil: 'load' });
    await page.waitForTimeout(2000);

    // 1. Test case 1: String to number coercion, and check constraints mapping
    await page.evaluate(() => {
      // Seed both state and device ID
      localStorage.setItem('jee-os-device-id', '33333333-3333-3333-3333-333333333333');
      
      const parsed = {
        profile: {
          name: 'Challenger Coercion 1',
          class: 'dropper batch', // should map to 'dropper'
          targetYear: '2028', // should map to 2028 (number)
          studyHoursPerDay: '8.5', // should map to 8.5 (number)
          preferredStudyTime: 'late night study', // should map to 'night'
          studyStyle: 'Visual learner, needs graphs', // should map to 'visual'
        }
      };
      localStorage.setItem('jee-os-state', JSON.stringify(parsed));
    });

    // Reload page to trigger loading from localStorage and debounced sync to Supabase
    capturedPayloads = [];
    await page.reload({ waitUntil: 'load' });
    
    // Wait for the debounced sync (2000ms debounce in code, we wait 4000ms)
    await page.waitForTimeout(4500);

    expect(capturedPayloads.length).toBeGreaterThan(0);
    const payload1 = capturedPayloads[capturedPayloads.length - 1];
    console.log('Sync Payload 1:', payload1);

    expect(payload1.name).toBe('Challenger Coercion 1');
    expect(payload1.class).toBe('dropper');
    expect(payload1.target_year).toBe(2028);
    expect(payload1.study_hours_per_day).toBe(8.5);
    expect(payload1.preferred_study_time).toBe('night');
    expect(payload1.study_style).toBe('visual');

    // 2. Test case 2: Float values, negative numbers, NaN/undefined handling
    await page.evaluate(() => {
      const parsed = {
        profile: {
          name: 'Challenger Coercion 2',
          class: '12th Class', // should map to '12'
          targetYear: -2025, // negative number target year
          studyHoursPerDay: NaN, // NaN study hours
          preferredStudyTime: 'morning study session', // should map to 'morning'
          studyStyle: 'auditory learner', // should map to 'auditory'
        }
      };
      localStorage.setItem('jee-os-state', JSON.stringify(parsed));
    });

    capturedPayloads = [];
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(4500);

    expect(capturedPayloads.length).toBeGreaterThan(0);
    const payload2 = capturedPayloads[capturedPayloads.length - 1];
    console.log('Sync Payload 2:', payload2);

    expect(payload2.name).toBe('Challenger Coercion 2');
    expect(payload2.class).toBe('12');
    expect(payload2.target_year).toBe(-2025); // negative target year is preserved in coercion
    expect(payload2.study_hours_per_day).toBe(6.0); // NaN is coerced to 6.0 default
    expect(payload2.preferred_study_time).toBe('morning');
    expect(payload2.study_style).toBe('auditory');

    // 3. Test case 3: Unrecognized/empty mapping fallback
    await page.evaluate(() => {
      const parsed = {
        profile: {
          name: 'Challenger Coercion 3',
          class: 'some random class', // unrecognized class -> should map to '11'
          targetYear: 2027.5, // float target year
          studyHoursPerDay: undefined, // undefined study hours
          preferredStudyTime: 'random study time', // unrecognized preferred time -> should map to 'evening'
          studyStyle: 'random study style', // unrecognized study style -> should map to 'visual'
        }
      };
      localStorage.setItem('jee-os-state', JSON.stringify(parsed));
    });

    capturedPayloads = [];
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(4500);

    expect(capturedPayloads.length).toBeGreaterThan(0);
    const payload3 = capturedPayloads[capturedPayloads.length - 1];
    console.log('Sync Payload 3:', payload3);

    expect(payload3.name).toBe('Challenger Coercion 3');
    expect(payload3.class).toBe('11'); // fallback
    expect(payload3.target_year).toBe(2027.5); // float target year is preserved in coercion
    expect(payload3.study_hours_per_day).toBe(6.0); // undefined is coerced to 6.0 default
    expect(payload3.preferred_study_time).toBe('evening'); // fallback
    expect(payload3.study_style).toBe('visual'); // fallback
  });

  test('Custom Key Partitioning in UPDATE_PROFILE', async ({ page }) => {
    test.setTimeout(60000);
    
    // Mock Auth to prevent network hangs
    await page.route('**/auth/v1/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: { id: '33333333-3333-3333-3333-333333333333' }
        }),
      });
    });

    // Mock Rest endpoints
    await page.route('**/rest/v1/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Intercept chat API to stream our custom client action
    await page.route('**/api/chat', async (route) => {
      const postData = JSON.parse(route.request().postData() || '{}');
      if (postData.action === 'reflect') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ userPersonaInsight: 'insight', adaptationNotes: [] }),
        });
        return;
      }
      const payload = {
        type: 'client_action',
        action: 'update_profile',
        args: {
          name: 'Updated Challenger', // standard
          studyHoursPerDay: '9.5', // standard string -> should be coerced to number
          customGoal: 'IIT Bombay CSE', // custom key -> should go to aiPreferences
          aiPreferences: {
            themeColor: 'indigo', // nested in aiPreferences -> should be merged
            notificationsEnabled: 'true', // nested in aiPreferences -> should be merged
          },
          anotherNewField: 'some-value', // completely new custom key -> should go to aiPreferences
        }
      };
      
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: JSON.stringify(payload) + '\n',
      });
    });

    // Go to home page
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(2000);

    // Open Floating AI Copilot panel
    const copilotTrigger = page.locator('button[title="Ask AI Co-Pilot"]');
    await expect(copilotTrigger).toBeVisible();
    await copilotTrigger.click();
    await page.waitForTimeout(1000);

    // Send a mock message to trigger the mocked /api/chat route
    const input = page.locator('input[placeholder*="Ask Co-Pilot"]');
    await input.fill('Please update my profile');
    const sendBtn = page.locator('button:has(svg.lucide-send)');
    await sendBtn.click();

    // Wait for chat stream to finish and dispatch state
    await page.waitForTimeout(3000);

    // Verify state in localStorage
    const localState = await page.evaluate(() => {
      const saved = localStorage.getItem('jee-os-state');
      return saved ? JSON.parse(saved) : null;
    });

    expect(localState).not.toBeNull();
    console.log('Saved local profile:', localState.profile);

    const profile = localState.profile;
    expect(profile.name).toBe('Updated Challenger');
    expect(profile.studyHoursPerDay).toBe(9.5); // coerced to number
    
    expect(profile.aiPreferences).not.toBeNull();
    expect(profile.aiPreferences.customGoal).toBe('IIT Bombay CSE');
    expect(profile.aiPreferences.themeColor).toBe('indigo');
    expect(profile.aiPreferences.notificationsEnabled).toBe('true');
    expect(profile.aiPreferences.anotherNewField).toBe('some-value');
  });

});
