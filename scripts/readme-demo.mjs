import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const outputDirectory = join(process.cwd(), ".artifacts", "readme-demo");
const url = process.argv.find((argument) => argument.startsWith("http")) ?? "http://localhost:3000";

const browserCandidates = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].filter(Boolean);

await mkdir(outputDirectory, { recursive: true });
for (const filename of await readdir(outputDirectory)) {
  if (/^frame-\d{3}\.png$/.test(filename)) await unlink(join(outputDirectory, filename));
}

const executablePath = browserCandidates.find((candidate) => existsSync(candidate));
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  args: ["--enable-gpu", "--ignore-gpu-blocklist"],
});

const page = await browser.newPage({
  viewport: { width: 1200, height: 750 },
  deviceScaleFactor: 1,
});
page.setDefaultTimeout(90_000);
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByRole("button", { name: /Ver la ciudad de demostración/i }).click();
await page.waitForTimeout(12_000);

let frame = 0;
const capture = async (count, delay = 55) => {
  for (let index = 0; index < count; index += 1) {
    await page.screenshot({
      path: join(outputDirectory, `frame-${String(frame).padStart(3, "0")}.png`),
      fullPage: true,
    });
    frame += 1;
    await page.waitForTimeout(delay);
  }
};

// The GIF opens on the city, follows the built-in cinematic camera and closes at night.
await capture(8, 80);
await page.getByRole("button", { name: /Iniciar recorrido cinematográfico/i }).click();
await capture(42, 55);
await page.getByRole("button", { name: /Activar noche analítica/i }).click();
await page.waitForTimeout(900);
await capture(20, 60);

await browser.close();
console.log(`Captured ${frame} README frames in ${outputDirectory}`);
