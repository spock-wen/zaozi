// e2e test for RULES_fix2_v2.md §15: rows 1-31 contrast and font-size
// Tested across 3 engines (chromium, firefox, webkit) at 375x667 and 1920x1080.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

let server;
const browsers = {};

before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) {
    browsers[name] = await type.launch();
  }
});

after(async () => {
  for (const b of Object.values(browsers)) {
    await b.close();
  }
  server?.close();
});

const LOG_24 = [
  "C01 遇到行商", "C02 猎场让出一半", "C03 粟田大丰", "C04 山洪暴发", "C05 赶路者歇脚", "C06 河水涨过土坎",
  "C08 拿牛骨换粟种", "C09 发现铜矿", "C10 祭祀先祖",
  "T01 开局记事", "T02 占卜吉凶", "T05 左 遵从巫的指引",
  "交出一片空骨片", "余年用完", "冬夜", "冬夜刻成 休", "冬夜刻成 力", "冬夜刻错",
  "出发挑字", "刻事签", "开局", "开局", "达成", "骨片 +1"
];

const VIEWPORTS = [
  { name: "phone 375x667", width: 375, height: 667, isDesktop: false },
  { name: "desktop 1920x1080", width: 1920, height: 1080, isDesktop: true },
];

for (const [engineName] of Object.entries(ENGINES)) {
  for (const vp of VIEWPORTS) {
    test(`${engineName} ${vp.name} §15 rows 1-31 contrast and font size`, async () => {
      const browser = browsers[engineName];
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: !vp.isDesktop,
        isMobile: !vp.isDesktop && engineName !== "firefox",
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);

      // Open drawer/sidebar with 24 log entries and clues
      await page.evaluate((logs) => {
        const z = window.__zz;
        z.st.log = logs.slice();
        z.st.zilu = ["人", "休", "木"];
        z.st.clues = { "人": ["人 + ？"] };
        // Trigger drawer and save dialog elements
        document.getElementById("drawer").hidden = false;
        document.getElementById("savedlg").hidden = false;
        document.getElementById("pick").hidden = false;
        // Populate pick info
        const pick = document.getElementById("pick");
        pick.innerHTML = `
          <div class="pickinfo">
            <div class="pi-h">河水 <span>河水</span></div>
          </div>
        `;
        z.render();
      }, LOG_24);

      const res = await page.evaluate(() => {
        const parseRGB = (s) => {
          const m = String(s).match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
          return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
        };
        const sRGBtoLinear = (c) => {
          const v = c / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        const relLuminance = (rgb) => {
          return 0.2126 * sRGBtoLinear(rgb.r) + 0.7152 * sRGBtoLinear(rgb.g) + 0.0722 * sRGBtoLinear(rgb.b);
        };
        const contrastRatio = (c1, c2) => {
          const l1 = relLuminance(c1), l2 = relLuminance(c2);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        };

        const out = { failures: [] };
        const isDesktop = document.body.dataset.view === "desktop" || document.body.dataset.view === "tablet-landscape";

        // Rows 1-24: Drawer log li
        if (!isDesktop) {
          const drawerBody = document.getElementById("drawer-body");
          const logLis = drawerBody ? [...drawerBody.querySelectorAll("#log li")] : [];
          const drawerBg = parseRGB(getComputedStyle(drawerBody).backgroundColor) || { r: 250, g: 246, b: 236 };
          if (logLis.length === 0) {
            out.failures.push("No drawer log li found");
          }
          logLis.forEach((li, idx) => {
            const cs = getComputedStyle(li);
            const fg = parseRGB(cs.color);
            const cr = fg ? contrastRatio(fg, drawerBg) : 1;
            if (cr < 4.45) {
              out.failures.push(`Row ${idx + 1} drawer log li "${li.textContent.slice(0, 10)}" contrast ${cr.toFixed(2)}:1 < 4.5:1`);
            }
          });
        }

        // Row 25: .pi-h span
        const piSpan = document.querySelector("#pick .pickinfo .pi-h span");
        if (piSpan) {
          const cs = getComputedStyle(piSpan);
          const fg = parseRGB(cs.color);
          const bg = { r: 250, g: 246, b: 236 }; // paper-50
          const cr = fg ? contrastRatio(fg, bg) : 1;
          const fs = parseFloat(cs.fontSize);
          if (cr < 4.45) {
            out.failures.push(`Row 25 .pi-h span contrast ${cr.toFixed(2)}:1 < 4.5:1`);
          }
          if (isDesktop && fs < 13.9) {
            out.failures.push(`Row 25 desktop .pi-h span font-size ${fs}px < 14px`);
          } else if (!isDesktop && fs < 12.9) {
            out.failures.push(`Row 25 mobile .pi-h span font-size ${fs}px < 13px`);
          }
        } else {
          out.failures.push("Row 25 .pi-h span not found");
        }

        // Rows 26-28: #dlgtext border
        const dlgtext = document.getElementById("dlgtext");
        if (dlgtext) {
          const cs = getComputedStyle(dlgtext);
          const bc = parseRGB(cs.borderColor || cs.borderTopColor);
          const bg = { r: 43, g: 48, b: 66 }; // dlgbox outer #2B3042
          const cr = bc ? contrastRatio(bc, bg) : 1;
          if (cr < 2.95) {
            out.failures.push(`Rows 26-28 #dlgtext border contrast ${cr.toFixed(2)}:1 < 3:1`);
          }
        } else {
          out.failures.push("Rows 26-28 #dlgtext not found");
        }

        // Row 29: #keyhelp-btn border
        const keyhelpBtn = document.getElementById("keyhelp-btn");
        if (keyhelpBtn) {
          const cs = getComputedStyle(keyhelpBtn);
          const bc = parseRGB(cs.borderColor || cs.borderTopColor);
          const bg = { r: 43, g: 48, b: 66 }; // night bg #2B3042
          const cr = bc ? contrastRatio(bc, bg) : 1;
          if (cr < 2.95) {
            out.failures.push(`Row 29 #keyhelp-btn border contrast ${cr.toFixed(2)}:1 < 3:1`);
          }
        } else {
          out.failures.push("Row 29 #keyhelp-btn not found");
        }

        // Row 30: .zl small font size and line-height
        const zlSmall = document.querySelector(".zl small");
        if (zlSmall) {
          const cs = getComputedStyle(zlSmall);
          const fs = parseFloat(cs.fontSize);
          const lh = parseFloat(cs.lineHeight);
          const expectedFs = isDesktop ? 14 : 13;
          if (fs < expectedFs - 0.1) {
            out.failures.push(`Row 30 .zl small font-size ${fs}px < ${expectedFs}px`);
          }
          const ratio = lh / fs;
          if (Math.abs(ratio - 1.3) > 0.15 && Math.abs(lh - expectedFs * 1.3) > 1.5) {
            out.failures.push(`Row 30 .zl small line-height ${lh}px (ratio ${ratio.toFixed(2)}) != 1.3`);
          }
        } else {
          out.failures.push("Row 30 .zl small not found");
        }

        // Row 31: #dlgmsg font size
        const dlgmsg = document.getElementById("dlgmsg");
        if (dlgmsg) {
          const cs = getComputedStyle(dlgmsg);
          const fs = parseFloat(cs.fontSize);
          if (isDesktop && fs < 13.9) {
            out.failures.push(`Row 31 desktop #dlgmsg font-size ${fs}px < 14px`);
          } else if (!isDesktop && fs < 12.9) {
            out.failures.push(`Row 31 mobile #dlgmsg font-size ${fs}px < 13px`);
          }
        } else {
          out.failures.push("Row 31 #dlgmsg not found");
        }

        return out;
      });

      await ctx.close();
      assert.deepEqual(res.failures, [], `Contrast/font-size failures: \n${res.failures.join("\n")}`);
    });
  }
}
