import { chromium } from "playwright-core";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const b = await chromium.launch({ executablePath: edge, headless: true, args: ["--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
pg.setDefaultTimeout(30000);
await pg.goto("http://localhost:3010", { waitUntil: "load", timeout: 60000 });
await pg.waitForSelector("canvas", { timeout: 40000 });
await pg.waitForTimeout(14000); // let scene finish loading so the landing button is clickable
// click the demo button robustly
const clicked = await pg.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(b => /ciudad de demostraci/i.test(b.textContent||""));
  if (btn) { btn.click(); return true; } return false;
});
console.log("demo clicked:", clicked);
await pg.waitForTimeout(13000);
await pg.screenshot({ path: ".artifacts/ui3-ready.png" });
// open Capas panel
const capas = await pg.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(b => /^\s*Capas/i.test(b.textContent||""));
  if (btn) { btn.click(); return true; } return false;
});
console.log("capas clicked:", capas);
await pg.waitForTimeout(2000);
await pg.screenshot({ path: ".artifacts/ui3-layers.png" });
await b.close(); console.log("done");import { chromium } from "playwright-core";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const b = await chromium.launch({ executablePath: edge, headless: true, args: ["--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
pg.setDefaultTimeout(30000);
await pg.goto("http://localhost:3010", { waitUntil: "load", timeout: 60000 });
await pg.waitForSelector("canvas", { timeout: 40000 });
await pg.waitForTimeout(14000); // let scene finish loading so the landing button is clickable
// click the demo button robustly
const clicked = await pg.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(b => /ciudad de demostraci/i.test(b.textContent||""));
  if (btn) { btn.click(); return true; } return false;
});
console.log("demo clicked:", clicked);
await pg.waitForTimeout(13000);
await pg.screenshot({ path: ".artifacts/ui3-ready.png" });
// open Capas panel
const capas = await pg.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(b => /^\s*Capas/i.test(b.textContent||""));
  if (btn) { btn.click(); return true; } return false;
});
console.log("capas clicked:", capas);
await pg.waitForTimeout(2000);
await pg.screenshot({ path: ".artifacts/ui3-layers.png" });
await b.close(); console.log("done");
