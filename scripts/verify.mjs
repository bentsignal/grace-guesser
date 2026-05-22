import { chromium } from "playwright";

const PORT = process.argv[2] || "3000";
const URL = `http://localhost:${PORT}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const shot = (n) => page.screenshot({ path: `/tmp/er-${n}.png` });

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.getByText("Begin the journey").waitFor({ timeout: 15000 });
await page.waitForTimeout(500);
await shot("1-intro");

await page.getByText("Begin the journey").click();
await page.waitForTimeout(1500); // let leaflet init + tiles load
await shot("2-round1");

for (let r = 1; r <= 5; r++) {
  // place a guess somewhere on the map (upper area, away from bottom panel)
  await page.mouse.click(560 + r * 30, 250 + r * 20);
  await page.waitForTimeout(400);
  if (r === 1) await shot("3-guess");

  // submit
  await page.getByRole("button", { name: /Lay your guess/i }).click();
  await page.waitForTimeout(700);
  if (r === 1) await shot("4-reveal");

  // advance
  const label = r === 5 ? /See verdict/i : /Next grace/i;
  await page.getByRole("button", { name: label }).click();
  await page.waitForTimeout(600);
}

await page.waitForTimeout(600);
await shot("5-results");

const resultsText = await page
  .locator("pre")
  .first()
  .innerText()
  .catch(() => "(no results pre found)");

await browser.close();

console.log("=== share text ===");
console.log(resultsText);
console.log("\n=== console/page errors ===");
console.log(errors.length ? errors.join("\n") : "none");
