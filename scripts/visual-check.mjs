import { chromium } from "playwright-core";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(90000);
const errors = [];
const messages = [];
page.on("console", (message) => { messages.push(`${message.type()}: ${message.text()}`); if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(process.argv[2] ?? "http://localhost:3001", { waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForSelector("canvas", { timeout: 15000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: "visual-check-2026.png", fullPage: true });
await page.locator("canvas").screenshot({ path: "visual-canvas-2026.png" });
const canvasData = await page.locator("canvas").evaluate((canvas) => canvas.toDataURL("image/png"));
await writeFile("visual-webgl-2026.png", Buffer.from(canvasData.split(",")[1], "base64"));
console.log(JSON.stringify({ title: await page.title(), canvas: await page.locator("canvas").count(), errors, messages }, null, 2));
await browser.close();
