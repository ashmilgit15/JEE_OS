import { chromium } from "playwright";

const queries = [
  "just draw a graph of x = x^2, nothing else",
  "draw the graph of y = sin(x)",
  "graph of the parabola y = x^2",
  "graph of y = x^3 - 2x + 1",
];

for (const q of queries) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 1600 });

  let allText = "";
  page.on("response", async (response) => {
    if (response.url().includes("/api/chat")) {
      try {
        const text = await response.text();
        for (const line of text.split("\n").filter((l) => l.trim().startsWith("{"))) {
          try {
            const ev = JSON.parse(line);
            if (ev.type === "text") allText += ev.content;
          } catch {}
        }
      } catch {}
    }
  });

  await page.goto("http://localhost:3000/tutor");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  const input = page.locator('input[placeholder*="Ask me anything"]').first();
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.fill(q);
  await input.press("Enter");

  await page.waitForTimeout(20000);

  const allProse = await page.locator(".prose").all();
  const asstProse = allProse[allProse.length - 1];
  const graphSvgs = await asstProse.locator('svg[role="img"]').all();
  const graphPaths = await Promise.all(
    graphSvgs.map(async (s) => ({
      aria: await s.getAttribute("aria-label"),
      paths: await s.locator("path").count(),
    }))
  );

  console.log(`\n=== Q: "${q}" ===`);
  console.log(`Graph SVGs: ${graphSvgs.length}`);
  for (const g of graphPaths) console.log(`  aria="${g.aria}" paths=${g.paths}`);
  console.log(`Response (first 300): ${allText.slice(0, 300).replace(/\n/g, ' ')}`);

  await browser.close();
}
