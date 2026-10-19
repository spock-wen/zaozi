// ui_gate.mjs — Items C1 (contrast), C2 (font size), C3 (overflow/target gate), C4b (load errors)
// Multi-engine x multi-size Playwright runner across states: T01, T02, T03engrave, menu

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as config from "./config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findRepoRoot() {
  let curr = __dirname;
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, ".git"))) return curr;
    curr = path.dirname(curr);
  }
  return process.cwd();
}

const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : defaultValue;
}
const hasFlag = (flag) => args.includes(flag);

const REPO_ROOT = path.resolve(getArg("--repo-root", findRepoRoot()));
const OUT_DIR = path.resolve(getArg("--out-dir", path.join(REPO_ROOT, "qa/review/out/latest")));
const SHOTS_DIR = path.join(OUT_DIR, "shots");
const PORT = Number(getArg("--port", "5179"));
const BASE_URL = getArg("--url", `http://localhost:${PORT}`);
const isQuick = hasFlag("--quick");
const enginesArg = getArg("--engines", config.DEFAULT_ENGINES.join(","));
const onlyArg = getArg("--only", "");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(SHOTS_DIR, { recursive: true });

// Filter sizes
let targetSizes = config.VIEWPORTS;
if (isQuick) {
  targetSizes = config.VIEWPORTS.filter((v) => config.QUICK_SIZES.includes(v.name));
}

// Filter engines
const requestedEngines = enginesArg
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const onlyItems = onlyArg
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

function shouldCheckItem(id) {
  if (onlyItems.length === 0) return true;
  return onlyItems.includes(id) || (id === "C4B" && onlyItems.includes("C4"));
}

// Results container
const runSummary = {
  timestamp: new Date().toISOString(),
  quick: isQuick,
  engines: requestedEngines,
  sizes: targetSizes.map((s) => s.name),
  itemStatuses: {
    C1: "PASS",
    C2: "PASS",
    C3: "PASS",
    C4b: "PASS",
  },
  counts: {
    C1: { samples: 0, fails: 0, warns: 0 },
    C2: { samples: 0, fails: 0 },
    C3: { samples: 0, fails: 0 },
    C4b: { cellsChecked: 0, cellFails: 0 },
  },
  failures: [], // all in-gate failures
  recordOnlyFailures: [], // failures on record-only sizes like 360x640
  cells: [],
};

// 每次 reload/goto 前等网络空闲：否则 harness 自己的导航会打断页面在途的子资源请求，
// Firefox 下 sw.js 的 respondWith 会因此报「ServiceWorker intercepted the request and encountered an unexpected error」，
// 那是测试脚本造成的假报错，不是产品缺陷。等空闲后再出现的报错照常算 C4b 失败。
const settle = (p) => p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

// Inpage check script passed to page.evaluate
const INPAGE_CHECK_FN = (stateName, sizeInfo, cfg) => {
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const x = lum(a),
      y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const over = (top, bot) => {
    const a = top.a + bot.a * (1 - top.a);
    if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a,
      g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a,
      b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a,
      a,
    };
  };
  const effOp = (e) => {
    let o = 1;
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) o *= +getComputedStyle(x).opacity;
    return o;
  };
  const isVisible = (e) => {
    let cur = e;
    while (cur && cur.nodeType === 1) {
      const cs = getComputedStyle(cur);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < cfg.THRESHOLDS.minVisibilityOpacity || cur.hasAttribute("hidden"))
        return false;
      cur = cur.parentElement;
    }
    const r = e.getBoundingClientRect();
    if (r.right < 0 || r.bottom < 0 || r.left > window.innerWidth || r.top > window.innerHeight) return false;
    return r.width > 0 && r.height > 0;
  };
  const getIdentifier = (el) => {
    if (el.id) return "#" + el.id;
    if (el.className) {
      const first = String(el.className).trim().split(/\s+/)[0];
      if (first) return "." + first;
    }
    return el.tagName.toLowerCase();
  };
  const getTextSample = (el) => {
    return [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join("")
      .trim()
      .slice(0, 20);
  };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isDesktop = vw >= 1024;

  const c1Samples = [];
  const c2Samples = [];
  const c3OverflowSamples = [];
  const c3TargetSamples = [];

  const isExcluded = (el) => {
    return cfg.EXCLUDE_SELECTORS.some((sel) => el.matches(sel) || el.closest(sel));
  };

  // 1. Text elements check
  const allElements = document.querySelectorAll("body *");
  for (const el of allElements) {
    if (isExcluded(el)) continue;
    if (!isVisible(el)) continue;

    const hasDirectText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!hasDirectText) continue;

    const elCs = getComputedStyle(el);
    const tag = getIdentifier(el);
    const text = getTextSample(el);
    const elRect = el.getBoundingClientRect();

    // --- C1: Contrast ---
    let bgUnknown = false;
    let gradStops = null; // 最近一层渐变背景的色标（可解析时按最差色标算，不再只记 WARN）
    const ancestors = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      ancestors.push(cur);
      const cs = getComputedStyle(cur);
      if (cs.backgroundImage && cs.backgroundImage !== "none") {
        const stops = /url\(/.test(cs.backgroundImage) ? [] : (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
        if (!gradStops && stops.length && stops.every((c) => c.a >= 0.999)) gradStops = { el: cur, stops };
        else bgUnknown = true;
      }
      cur = cur.parentElement;
    }

    let bg = { r: 255, g: 255, b: 255, a: 1 };
    const htmlCs = getComputedStyle(document.documentElement);
    const bodyCs = getComputedStyle(document.body);
    const htmlBg = parse(htmlCs.backgroundColor);
    const bodyBg = parse(bodyCs.backgroundColor);
    if (htmlBg && htmlBg.a > 0) bg = over(htmlBg, bg);
    if (bodyBg && bodyBg.a > 0) bg = over(bodyBg, bg);

    for (const a of ancestors.slice().reverse()) {
      const acs = getComputedStyle(a);
      const c = parse(acs.backgroundColor);
      if (c && c.a > 0) bg = over({ ...c, a: c.a * effOp(a) }, bg);
    }

    const fg0 = parse(elCs.color) || { r: 0, g: 0, b: 0, a: 1 };
    const fg = { ...fg0, a: fg0.a * effOp(el) };
    let cr = ratio(over(fg, bg), bg);
    if (gradStops) {
      // 不透明渐变：其上一层以内的背景色直接取色标，逐个算，取最差
      for (const st of gradStops.stops) {
        let b2 = st;
        let below = true;
        for (const a of ancestors.slice().reverse()) {
          if (a === gradStops.el) { below = false; continue; }
          if (below) continue;
          const c = parse(getComputedStyle(a).backgroundColor);
          if (c && c.a > 0) b2 = over({ ...c, a: c.a * effOp(a) }, b2);
        }
        cr = Math.min(cr, ratio(over(fg, b2), b2));
      }
    }

    const fs = parseFloat(elCs.fontSize);
    const fw = parseInt(elCs.fontWeight, 10) || 400;
    const isLarge =
      fs >= cfg.THRESHOLDS.largeTextFontSize ||
      (fs >= cfg.THRESHOLDS.largeTextBoldFontSize && fw >= cfg.THRESHOLDS.largeTextBoldWeight);
    const thr = isLarge ? cfg.THRESHOLDS.contrastLarge : cfg.THRESHOLDS.contrastNormal;

    const passCr = cr >= thr - cfg.THRESHOLDS.contrastTolerance;

    c1Samples.push({
      element: tag,
      text,
      fontSize: fs,
      ratio: Number(cr.toFixed(2)),
      threshold: thr,
      bgUnknown,
      pass: passCr || bgUnknown,
      warn: bgUnknown,
      failReason: !passCr && !bgUnknown ? `contrast ${cr.toFixed(2)}:1 < ${thr}:1` : null,
    });

    // --- C2: Font size ---
    let minExpectedFs = cfg.THRESHOLDS.fontSizeMin;
    let isDesktopBody = false;
    if (isDesktop) {
      if (cfg.DESKTOP_BODY_SELECTORS.some((sel) => el.matches(sel) || el.closest(sel))) {
        minExpectedFs = cfg.THRESHOLDS.fontSizeDesktopBody;
        isDesktopBody = true;
      }
    }
    const passFs = fs >= minExpectedFs - cfg.THRESHOLDS.fontSizeTolerance;
    c2Samples.push({
      element: tag,
      text,
      fontSize: Number(fs.toFixed(2)),
      threshold: minExpectedFs,
      isDesktopBody,
      pass: passFs,
      failReason: !passFs ? `font-size ${fs.toFixed(1)}px < ${minExpectedFs}px` : null,
    });

    // --- C3a: Text Overflow ---
    const ox = elCs.overflowX,
      oy = elCs.overflowY;
    if (["hidden", "clip", "auto", "scroll"].includes(ox) || ["hidden", "clip", "auto", "scroll"].includes(oy)) {
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
        c3OverflowSamples.push({
          type: "self-scroll-overflow",
          element: tag,
          text,
          scrollSize: `${el.scrollWidth}x${el.scrollHeight}`,
          clientSize: `${el.clientWidth}x${el.clientHeight}`,
          pass: false,
          failReason: `scrollWidth/Height (${el.scrollWidth}x${el.scrollHeight}) > client (${el.clientWidth}x${el.clientHeight})`,
        });
      }
    }

    let container = null;
    let p = el.parentElement;
    while (p && p.nodeType === 1 && p.tagName !== "BODY" && p.tagName !== "HTML") {
      const pcs = getComputedStyle(p);
      const isConfigContainer = cfg.CONTAINER_SELECTORS.some((s) => p.matches(s));
      if (isConfigContainer || pcs.overflowX !== "visible" || pcs.overflowY !== "visible") {
        container = p;
        break;
      }
      p = p.parentElement;
    }

    if (container) {
      const cRect = container.getBoundingClientRect();
      const tol = cfg.THRESHOLDS.boundsTolerancePx;
      const leftOverflow = elRect.left < cRect.left - tol;
      const rightOverflow = elRect.right > cRect.right + tol;
      const topOverflow = elRect.top < cRect.top - tol;
      const bottomOverflow = elRect.bottom > cRect.bottom + tol;

      if (leftOverflow || rightOverflow || topOverflow || bottomOverflow) {
        c3OverflowSamples.push({
          type: "container-bounds-overflow",
          element: tag,
          text,
          container: getIdentifier(container),
          elRect: {
            left: Math.round(elRect.left),
            right: Math.round(elRect.right),
            top: Math.round(elRect.top),
            bottom: Math.round(elRect.bottom),
          },
          cRect: {
            left: Math.round(cRect.left),
            right: Math.round(cRect.right),
            top: Math.round(cRect.top),
            bottom: Math.round(cRect.bottom),
          },
          pass: false,
          failReason: `Text rect outside container ${getIdentifier(container)}`,
        });
      }
    }
  }

  // --- C1: UI Borders check (#opt-left, #opt-right) ---
  for (const sel of cfg.UI_BORDERS) {
    const el = document.querySelector(sel);
    if (!el || !isVisible(el)) continue;

    const op = effOp(el);
    const cs = getComputedStyle(el);
    const bw = parseFloat(cs.borderTopWidth) || parseFloat(cs.borderWidth) || 0;
    const bc = parse(cs.borderTopColor || cs.borderColor);

    let bg = { r: 255, g: 255, b: 255, a: 1 };
    const ancestors = [];
    let cur = el.parentElement;
    while (cur && cur.nodeType === 1) {
      ancestors.push(cur);
      cur = cur.parentElement;
    }
    for (const a of ancestors.reverse()) {
      const acs = getComputedStyle(a);
      const c = parse(acs.backgroundColor);
      if (c && c.a > 0) bg = over({ ...c, a: c.a * effOp(a) }, bg);
    }

    let cr = null;
    if (bw > 0 && bc && bc.a > 0) {
      const finalBc = over({ ...bc, a: bc.a * op }, bg);
      cr = ratio(finalBc, bg);
    }

    const passOp = op >= cfg.THRESHOLDS.requiredOptionOpacity - 1e-4;
    const passBorderCr =
      cr === null || cr >= cfg.THRESHOLDS.contrastBorder - cfg.THRESHOLDS.contrastTolerance;

    c1Samples.push({
      element: `${sel} (border/opacity)`,
      text: el.innerText.trim().slice(0, 20),
      opacity: Number(op.toFixed(3)),
      borderWidth: bw,
      ratio: cr !== null ? Number(cr.toFixed(2)) : null,
      threshold: cfg.THRESHOLDS.contrastBorder,
      pass: passOp && passBorderCr,
      failReason: !passOp
        ? `computed opacity ${op} < 1.0 (R16 N4)`
        : !passBorderCr
        ? `border contrast ${cr} < 3.0`
        : null,
    });
  }

  // --- C3b: Target Gate ---
  const targetSelectors = cfg.TARGETS_PER_STATE[stateName] || [];
  for (const sel of targetSelectors) {
    const matchedElements = document.querySelectorAll(sel);
    if (matchedElements.length === 0) {
      c3TargetSamples.push({
        selector: sel,
        element: sel,
        pass: false,
        failReason: `Target element not found: ${sel}`,
      });
      continue;
    }

    for (const el of matchedElements) {
      const tag = getIdentifier(el);
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const op = effOp(el);

      const visible =
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        op >= cfg.THRESHOLDS.minVisibilityOpacity &&
        !el.hasAttribute("hidden") &&
        r.width > 0 &&
        r.height > 0;

      const tol = cfg.THRESHOLDS.boundsTolerancePx;
      const insideViewport =
        r.left >= -tol && r.top >= -tol && r.right <= vw + tol && r.bottom <= vh + tol;

      const isMin44 = cfg.MIN_44_TARGETS.some((s) => el.matches(s));
      const sizePass =
        !isMin44 ||
        (r.width >= cfg.THRESHOLDS.targetMinSize - 0.5 && r.height >= cfg.THRESHOLDS.targetMinSize - 0.5);

      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      const hitPass = hit === el || el.contains(hit);

      const pass = visible && insideViewport && sizePass && hitPass;
      const reasons = [];
      if (!visible) reasons.push("not visible");
      if (!insideViewport)
        reasons.push(
          `outside viewport (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`
        );
      if (!sizePass) reasons.push(`size ${r.width.toFixed(1)}x${r.height.toFixed(1)} < 44`);
      if (!hitPass) reasons.push(`hit blocked by ${hit ? getIdentifier(hit) : "null"}`);

      c3TargetSamples.push({
        selector: sel,
        element: tag,
        rect: { width: Number(r.width.toFixed(1)), height: Number(r.height.toFixed(1)) },
        visible,
        insideViewport,
        sizePass,
        hitPass,
        pass,
        failReason: reasons.join("; ") || null,
      });
    }
  }

  // R18: 电脑（宽≥1280）卡片上限 448×640，容差 1px
  if (vw >= 1280 && (stateName === "T01" || stateName === "T02")) {
    const card = document.querySelector("#card");
    if (card) {
      const r = card.getBoundingClientRect();
      const tol = cfg.THRESHOLDS.boundsTolerancePx;
      const ok = r.width <= cfg.THRESHOLDS.desktopCardMaxW + tol && r.height <= cfg.THRESHOLDS.desktopCardMaxH + tol;
      c3TargetSamples.push({
        selector: "#card (R18 上限)", element: "#card",
        rect: { width: Number(r.width.toFixed(1)), height: Number(r.height.toFixed(1)) },
        pass: ok,
        failReason: ok ? null : `card ${r.width.toFixed(1)}x${r.height.toFixed(1)} > 448x640 (R18)`,
      });
    }
  }

  // In T03engrave: #opt-left / #opt-right must be visibility:hidden or disabled (R12)
  if (stateName === "T03engrave") {
    for (const sel of ["#opt-left", "#opt-right"]) {
      const el = document.querySelector(sel);
      if (el) {
        const cs = getComputedStyle(el);
        const isHiddenOrDisabled = cs.visibility === "hidden" || el.disabled || cs.display === "none";
        if (!isHiddenOrDisabled) {
          c3TargetSamples.push({
            selector: sel,
            element: sel,
            pass: false,
            failReason: `In T03engrave, ${sel} must be visibility:hidden or disabled (R12)`,
          });
        }
      }
    }
  }

  return {
    c1Samples,
    c2Samples,
    c3OverflowSamples,
    c3TargetSamples,
  };
};

async function runGate() {
  const pwPath = path.join(REPO_ROOT, "web/node_modules/playwright/index.mjs");
  const playwright = await import(pathToFileURL(pwPath).href);

  for (const engineName of requestedEngines) {
    const launcher = playwright[engineName];
    if (!launcher) {
      console.warn(`[ui_gate] Engine ${engineName} not available in playwright`);
      runSummary.failures.push({ item: "C4b", engine: engineName, size: "-", state: "launch", element: "browser", value: "未知引擎名" });
      runSummary.itemStatuses.C4b = "FAIL";
      continue;
    }

    let browser;
    try {
      browser = await launcher.launch({ headless: true });
    } catch (e) {
      console.error(`[ui_gate] Failed to launch ${engineName}:`, e.message);
      runSummary.failures.push({ item: "C4b", engine: engineName, size: "-", state: "launch", element: "browser", value: `引擎启动失败: ${e.message.split("\n")[0]}` });
      runSummary.itemStatuses.C4b = "FAIL";
      continue;
    }

    try {
      for (const size of targetSizes) {
        const cell = {
          engine: engineName,
          size: size.name,
          category: size.category,
          recordOnly: Boolean(size.recordOnly),
          states: {},
          errors: [],
          pageErrors: [],
          consoleErrors: [],
          pass: true,
        };
        runSummary.counts.C4b.cellsChecked++;

        const contextOptions = {
          viewport: { width: size.width, height: size.height },
          hasTouch: Boolean(size.hasTouch),
        };
        if (size.isMobile && engineName !== "firefox") {
          contextOptions.isMobile = true;
        }

        let context;
        let page;
        try {
          context = await browser.newContext(contextOptions);
          page = await context.newPage();

          // Monitor errors from the very first navigation
          page.on("pageerror", (err) => {
            cell.pageErrors.push(err.message);
          });
          page.on("console", (msg) => {
            if (msg.type() === "error") {
              cell.consoleErrors.push(msg.text());
            }
          });

          // State 1: T01
          let t01Success = false;
          try {
            await page.goto(`${BASE_URL}/?seed=20261016`);
            await settle(page);
            await page.evaluate(() => localStorage.clear());
            await page.reload();
            await page.waitForFunction(
              () => window.__zz && window.__zz.st && window.__zz.st.phase === "card" && !window.__zz.animating,
              { timeout: 10000 }
            );
            await new Promise((r) => setTimeout(r, 600));

            // C4b: check #card visible at T01
            const cardVisible = await page.evaluate(() => {
              const c = document.querySelector("#card");
              if (!c) return false;
              const cs = getComputedStyle(c);
              const r = c.getBoundingClientRect();
              return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0;
            });
            if (!cardVisible) {
              cell.errors.push("T01: #card is not visible");
            }

            // Screenshot T01
            const shotPath = path.join(SHOTS_DIR, `${engineName}_${size.name}_T01.png`);
            await page.screenshot({ path: shotPath, fullPage: true });

            // Inpage check
            const resT01 = await page.evaluate(
              ({ fnStr, sName, sInfo, cfg }) => {
                const fn = new Function("return " + fnStr)();
                return fn(sName, sInfo, cfg);
              },
              { fnStr: INPAGE_CHECK_FN.toString(), sName: "T01", sInfo: size, cfg: config }
            );
            cell.states.T01 = resT01;
            t01Success = true;
          } catch (err) {
            cell.errors.push(`T01 failed: ${err.message}`);
          }

          // State 2: T02
          if (t01Success) {
            try {
              await page.keyboard.press("ArrowLeft");
              await new Promise((r) => setTimeout(r, 400));
              await page.keyboard.press("ArrowLeft");
              await page.waitForFunction(() => window.__zz && !window.__zz.animating, { timeout: 10000 });
              await new Promise((r) => setTimeout(r, 600));

              const shotPath = path.join(SHOTS_DIR, `${engineName}_${size.name}_T02.png`);
              await page.screenshot({ path: shotPath, fullPage: true });

              const resT02 = await page.evaluate(
                ({ fnStr, sName, sInfo, cfg }) => {
                  const fn = new Function("return " + fnStr)();
                  return fn(sName, sInfo, cfg);
                },
                { fnStr: INPAGE_CHECK_FN.toString(), sName: "T02", sInfo: size, cfg: config }
              );
              cell.states.T02 = resT02;
            } catch (err) {
              cell.errors.push(`T02 failed: ${err.message}`);
            }

            // State 3: T03engrave
            try {
              await page.keyboard.press("ArrowRight");
              await new Promise((r) => setTimeout(r, 400));
              await page.keyboard.press("ArrowRight");
              await page.waitForFunction(
                () => window.__zz && window.__zz.st && window.__zz.st.phase === "engrave" && !window.__zz.animating,
                { timeout: 10000 }
              );
              await new Promise((r) => setTimeout(r, 600));

              const shotPath = path.join(SHOTS_DIR, `${engineName}_${size.name}_T03engrave.png`);
              await page.screenshot({ path: shotPath, fullPage: true });

              const resT03 = await page.evaluate(
                ({ fnStr, sName, sInfo, cfg }) => {
                  const fn = new Function("return " + fnStr)();
                  return fn(sName, sInfo, cfg);
                },
                { fnStr: INPAGE_CHECK_FN.toString(), sName: "T03engrave", sInfo: size, cfg: config }
              );
              cell.states.T03engrave = resT03;
            } catch (err) {
              cell.errors.push(`T03engrave failed: ${err.message}`);
            }
          }

          // State 4: menu (from T01 state)
          try {
            await settle(page);
            await page.goto(`${BASE_URL}/?seed=20261016`);
            await settle(page);
            await page.evaluate(() => localStorage.clear());
            await page.reload();
            await page.waitForFunction(
              () => window.__zz && window.__zz.st && window.__zz.st.phase === "card" && !window.__zz.animating,
              { timeout: 10000 }
            );
            await new Promise((r) => setTimeout(r, 600));
            await page.click("#menubtn");
            await new Promise((r) => setTimeout(r, 300));

            const shotPath = path.join(SHOTS_DIR, `${engineName}_${size.name}_menu.png`);
            await page.screenshot({ path: shotPath, fullPage: true });

            const resMenu = await page.evaluate(
              ({ fnStr, sName, sInfo, cfg }) => {
                const fn = new Function("return " + fnStr)();
                return fn(sName, sInfo, cfg);
              },
              { fnStr: INPAGE_CHECK_FN.toString(), sName: "menu", sInfo: size, cfg: config }
            );
            cell.states.menu = resMenu;
          } catch (err) {
            cell.errors.push(`menu state failed: ${err.message}`);
          }
        } catch (cellErr) {
          cell.errors.push(`Cell execution crashed: ${cellErr.message}`);
        } finally {
          if (page) await page.close().catch(() => {});
          if (context) await context.close().catch(() => {});
        }

        // Aggregate cell metrics and failures
        const isRecordOnly = Boolean(size.recordOnly);

        // Check C4b (pageerror, console error, cell.errors)
        const cellC4bFailures = [...cell.errors, ...cell.pageErrors, ...cell.consoleErrors];
        if (cellC4bFailures.length > 0) {
          cell.pass = false;
          runSummary.counts.C4b.cellFails++;
          for (const err of cellC4bFailures) {
            const failItem = {
              item: "C4b",
              engine: engineName,
              size: size.name,
              state: "global",
              element: "#card / window",
              value: err,
            };
            if (isRecordOnly) runSummary.recordOnlyFailures.push(failItem);
            else {
              runSummary.failures.push(failItem);
              if (shouldCheckItem("C4B")) runSummary.itemStatuses.C4b = "FAIL";
            }
          }
        }

        // Aggregate states
        for (const [stName, stData] of Object.entries(cell.states)) {
          if (!stData) continue;
          // C1
          for (const s of stData.c1Samples || []) {
            runSummary.counts.C1.samples++;
            if (s.warn) runSummary.counts.C1.warns++;
            if (!s.pass) {
              cell.pass = false;
              runSummary.counts.C1.fails++;
              const failItem = {
                item: "C1",
                engine: engineName,
                size: size.name,
                state: stName,
                element: `${s.element}「${s.text || ""}」`,
                value: s.failReason || `contrast ${s.ratio}:1 < ${s.threshold}:1`,
              };
              if (isRecordOnly) runSummary.recordOnlyFailures.push(failItem);
              else {
                runSummary.failures.push(failItem);
                if (shouldCheckItem("C1")) runSummary.itemStatuses.C1 = "FAIL";
              }
            }
          }

          // C2
          for (const s of stData.c2Samples || []) {
            runSummary.counts.C2.samples++;
            if (!s.pass) {
              cell.pass = false;
              runSummary.counts.C2.fails++;
              const failItem = {
                item: "C2",
                engine: engineName,
                size: size.name,
                state: stName,
                element: `${s.element}「${s.text || ""}」`,
                value: s.failReason || `fontSize ${s.fontSize}px < ${s.threshold}px`,
              };
              if (isRecordOnly) runSummary.recordOnlyFailures.push(failItem);
              else {
                runSummary.failures.push(failItem);
                if (shouldCheckItem("C2")) runSummary.itemStatuses.C2 = "FAIL";
              }
            }
          }

          // C3 (Overflow + Targets)
          for (const s of stData.c3OverflowSamples || []) {
            runSummary.counts.C3.samples++;
            if (!s.pass) {
              cell.pass = false;
              runSummary.counts.C3.fails++;
              const failItem = {
                item: "C3",
                engine: engineName,
                size: size.name,
                state: stName,
                element: `${s.element}「${s.text || ""}」`,
                value: s.failReason,
              };
              if (isRecordOnly) runSummary.recordOnlyFailures.push(failItem);
              else {
                runSummary.failures.push(failItem);
                if (shouldCheckItem("C3")) runSummary.itemStatuses.C3 = "FAIL";
              }
            }
          }

          for (const s of stData.c3TargetSamples || []) {
            runSummary.counts.C3.samples++;
            if (!s.pass) {
              cell.pass = false;
              runSummary.counts.C3.fails++;
              const failItem = {
                item: "C3",
                engine: engineName,
                size: size.name,
                state: stName,
                element: `${s.element} (${s.selector})`,
                value: s.failReason,
              };
              if (isRecordOnly) runSummary.recordOnlyFailures.push(failItem);
              else {
                runSummary.failures.push(failItem);
                if (shouldCheckItem("C3")) runSummary.itemStatuses.C3 = "FAIL";
              }
            }
          }
        }

        runSummary.cells.push(cell);
      }
    } finally {
      await browser.close();
    }
  }
}

try {
  await runGate();
} catch (globalErr) {
  console.error("[ui_gate] Global error:", globalErr);
  runSummary.itemStatuses.C4b = "FAIL";
  runSummary.globalError = globalErr.stack || globalErr.message;
}

// Write outputs
const jsonPath = path.join(OUT_DIR, "ui_gate.json");
fs.writeFileSync(jsonPath, JSON.stringify(runSummary, null, 2), "utf8");

// Generate Markdown
let md = `# UI 门禁检查报告 (Items C1, C2, C3, C4b)\n\n`;
md += `- **检查时间**: ${runSummary.timestamp}\n`;
md += `- **执行模式**: ${isQuick ? "快速模式 (--quick, 3 尺寸)" : `完整模式 (${targetSizes.length} 尺寸)`}\n`;
md += `- **测试引擎**: ${requestedEngines.join(", ")}\n`;
md += `- **测试视口**: ${targetSizes.map((s) => (s.recordOnly ? `${s.name}(仅记录)` : s.name)).join(", ")}\n\n`;

md += `## 检查项结论概览\n\n`;
md += `| 编号 | 检查项 | 规则号 | 状态 | 抽样数 | 失败数 | 警告数 |\n`;
md += `|---|---|---|:---:|---:|---:|---:|\n`;
md += `| C1 | 对比度 | R16 | **${runSummary.itemStatuses.C1}** | ${runSummary.counts.C1.samples} | ${runSummary.counts.C1.fails} | ${runSummary.counts.C1.warns} |\n`;
md += `| C2 | 字号门禁 | R16 | **${runSummary.itemStatuses.C2}** | ${runSummary.counts.C2.samples} | ${runSummary.counts.C2.fails} | - |\n`;
md += `| C3 | 溢出与目标门禁 | R12/R13/R17/R18 | **${runSummary.itemStatuses.C3}** | ${runSummary.counts.C3.samples} | ${runSummary.counts.C3.fails} | - |\n`;
md += `| C4b | 页面与控制台报错 | R20 | **${runSummary.itemStatuses.C4b}** | ${runSummary.counts.C4b.cellsChecked} 单元 | ${runSummary.counts.C4b.cellFails} 单元 | - |\n\n`;

md += `## 门禁失败详情 (前 30 项)\n\n`;
if (runSummary.failures.length === 0) {
  md += `- **PASS**: 无任何在门禁视口内的失败项目。\n\n`;
} else {
  md += `发现 ${runSummary.failures.length} 项门禁失败:\n\n`;
  md += `| # | 项 | 引擎 | 视口 | 阶段 | 元素/选择器 | 失败原因 |\n`;
  md += `|---|:---:|---|---|---|---|---|\n`;
  const top30 = runSummary.failures.slice(0, 30);
  top30.forEach((f, idx) => {
    md += `| ${idx + 1} | ${f.item} | ${f.engine} | ${f.size} | ${f.state} | \`${f.element}\` | ${f.value} |\n`;
  });
  md += `\n`;
}

if (runSummary.recordOnlyFailures.length > 0) {
  md += `## 仅记录尺寸 (360x640) 差异\n\n`;
  md += `> [!NOTE] 依据规则 R14 / PM U4，360x640 属于「只记录不阻断门禁」的视口。\n\n`;
  md += `发现 ${runSummary.recordOnlyFailures.length} 处仅记录项:\n\n`;
  md += `| # | 项 | 引擎 | 阶段 | 元素 | 原因 |\n`;
  md += `|---|:---:|---|---|---|---|\n`;
  runSummary.recordOnlyFailures.slice(0, 20).forEach((f, idx) => {
    md += `| ${idx + 1} | ${f.item} | ${f.engine} | ${f.state} | \`${f.element}\` | ${f.value} |\n`;
  });
  md += `\n`;
}

const mdPath = path.join(OUT_DIR, "ui_gate.md");
fs.writeFileSync(mdPath, md, "utf8");

const overallPass =
  runSummary.itemStatuses.C1 === "PASS" &&
  runSummary.itemStatuses.C2 === "PASS" &&
  runSummary.itemStatuses.C3 === "PASS" &&
  runSummary.itemStatuses.C4b === "PASS";

console.log(
  `[ui_gate] Completed: ${overallPass ? "PASS" : "FAIL"} (C1:${runSummary.itemStatuses.C1}, C2:${runSummary.itemStatuses.C2}, C3:${runSummary.itemStatuses.C3}, C4b:${runSummary.itemStatuses.C4b})`
);

process.exit(overallPass ? 0 : 1);
