/**
 * Utility to extract clean, structured context from the current active page DOM.
 */
export function getDOMSummary(pathname: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '';

  try {
    // Omit layout noise (navbars, sidebars, settings drawers)
    const mainContent = document.querySelector('main') || document.body;

    // 1. Path-specific structural scanning
    if (pathname.startsWith('/tests')) {
      // Check if in mock setup vs active test taking vs review mode
      const testContainer = mainContent.querySelector('[data-testid="test-taking"]') || mainContent;
      const activeQuestionEl = testContainer.querySelector('.prose, .question-text, h3');
      const activeQuestion = activeQuestionEl ? activeQuestionEl.textContent?.trim() : '';

      const optionsEls = testContainer.querySelectorAll('button[class*="border"], label[class*="border"]');
      const options = Array.from(optionsEls).map(o => o.textContent?.trim()).filter(Boolean);

      if (activeQuestion) {
        return `[Active Mock Test] Question: "${activeQuestion}". Options: ${options.map((o, idx) => `${idx + 1}) ${o}`).join(' | ')}. Status: Active test session.`;
      }
    }

    if (pathname.startsWith('/tutor')) {
      const activeTopicEl = mainContent.querySelector('h2, .tutor-topic-header');
      const activeTopic = activeTopicEl ? activeTopicEl.textContent?.trim() : '';
      if (activeTopic) {
        return `[Active AI Tutor Session] Topic: "${activeTopic}".`;
      }
    }

    if (pathname.startsWith('/log')) {
      // Gather headings and logged cards
      const loggedItemsEls = mainContent.querySelectorAll('.card-title, table tr td');
      const loggedItems = Array.from(loggedItemsEls).slice(0, 5).map(i => i.textContent?.trim()).filter(Boolean);
      return `[Study Log] Visible items: ${loggedItems.join(', ')}`;
    }

    // 2. Generic DOM outline fallback
    const headings = Array.from(mainContent.querySelectorAll('h1, h2, h3'))
      .map(h => h.textContent?.trim())
      .filter(Boolean)
      .slice(0, 6);

    const firstParagraphs = Array.from(mainContent.querySelectorAll('p'))
      .map(p => p.textContent?.trim())
      .filter((p): p is string => !!p && p.length > 20)
      .slice(0, 3);

    return `Headers: ${headings.join(' > ')}. Description: ${firstParagraphs.join(' ')}`.substring(0, 800);
  } catch (err) {
    console.error('DOM Scraping failed:', err);
    return '';
  }
}
