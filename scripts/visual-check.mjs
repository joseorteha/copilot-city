import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Browser resolution order: an explicit BROWSER_PATH, then the usual Edge and Chrome
 * locations for the host platform, then whatever playwright-core has downloaded. The path
 * used to be hard-coded to one machine, which meant CI could never run this.
 */
const CANDIDATES = {
  win32: [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ],
  darwin: [
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ],
  linux: ["/usr/bin/microsoft-edge", "/usr/bin/google-chrome", "/usr/bin/chromium"],
};

async function resolveBrowser() {
  const { existsSync } = await import("node:fs");
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  for (const candidate of CANDIDATES[process.platform] ?? []) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const url = process.argv.find((argument) => argument.startsWith("http")) ?? "http://localhost:3000";
const focusMode = process.argv.includes("--focus");
const exploreMode = process.argv.includes("--explore");
const nightMode = process.argv.includes("--night");
const suffix = [focusMode && "focus", exploreMode && "explore", nightMode && "night"]
  .filter(Boolean)
  .map((part) => `-${part}`)
  .join("");
// Written outside the repository tree: these are 500 kB binaries that changed on every run.
const outputDirectory = process.env.VISUAL_OUTPUT ?? ".artifacts";
await mkdir(outputDirectory, { recursive: true });

const executablePath = await resolveBrowser();
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  args:
    process.env.VISUAL_SOFTWARE === "1"
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : ["--enable-gpu", "--ignore-gpu-blocklist"],
});

const page = await browser.newPage({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(90000);
const errors = [];
const messages = [];
page.on("console", (message) => {
  messages.push(`${message.type()}: ${message.text()}`);
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
// The city rises with a staggered reveal; sampling earlier captures a half-built skyline.
await page.waitForTimeout(Number(process.env.VISUAL_SETTLE_MS ?? 12000));

if (focusMode) {
  await page.getByRole("button", { name: /Corazón/i }).click();
  await page.waitForTimeout(4500);
}
if (exploreMode) {
  await page.locator("#explore-lock").click();
  await page.waitForTimeout(4500);
}
if (nightMode) {
  await page.getByRole("button", { name: /Activar noche analítica/i }).click();
  await page.waitForTimeout(4500);
}

const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const started = performance.now();
      const sample = (now) => {
        frames += 1;
        if (now - started >= 1500) resolve(Math.round((frames * 1000) / (now - started)));
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }),
);
const rendererInfo = await page.locator("canvas").evaluate((canvas) => ({ ...canvas.dataset }));
console.log(JSON.stringify({ sampleFps: fps, rendererInfo }));

await page.screenshot({ path: join(outputDirectory, `visual-check-2026${suffix}.png`), fullPage: true });
const canvasLocator = page.locator("canvas");
const canvasBox = await canvasLocator.boundingBox();
if (canvasBox)
  await page.screenshot({ path: join(outputDirectory, `visual-canvas-2026${suffix}.png`), clip: canvasBox });

console.log(
  JSON.stringify(
    {
      url,
      browser: executablePath ?? "playwright bundled",
      output: outputDirectory,
      title: await page.title(),
      canvas: await page.locator("canvas").count(),
      fps,
      rendererInfo,
      errors,
      messages,
    },
    null,
    2,
  ),
);

await browser.close();
if (errors.length) process.exitCode = 1;
