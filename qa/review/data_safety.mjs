// data_safety.mjs — Item C6 (Rule 数据安全（PR9 D4/B5）)
// Sub-checks:
//   C6a e2e presence (static): scan web/tests/**/*.mjs for throw + render + save key
//   C6b render-error probe (dynamic): UI render crash must not delete/corrupt save
//   C6c corrupt-replay probe (dynamic): corrupted save must be preserved in SAVE_KEY or .bak

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

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

const REPO_ROOT = path.resolve(getArg("--repo-root", findRepoRoot()));
const OUT_DIR = path.resolve(getArg("--out-dir", path.join(REPO_ROOT, "qa/review/out/latest")));
const PORT = Number(getArg("--port", "5179"));
const BASE_URL = getArg("--url", `http://localhost:${PORT}`);
const ENGINES_ARG = getArg("--engines", "chromium"); // chromium only by default per prompt

fs.mkdirSync(OUT_DIR, { recursive: true });

const SAVE_KEY = "zaozi.save.year1";
const BACKUP_KEY = SAVE_KEY + ".bak";

const results = {
  item: "C6",
  rule: "数据安全（PR9 D4/B5）",
  status: "PASS",
  subChecks: {
    C6a_e2e_presence: {
      pass: false,
      message: "",
      matchingFiles: [],
    },
    C6b_render_error_probe: {
      pass: false,
      message: "",
      details: {},
    },
    C6c_corrupt_replay_probe: {
      pass: false,
      message: "",
      details: {},
    },
  },
  timestamp: new Date().toISOString(),
};

// -------------------------------------------------------------
// Sub-check C6a: e2e presence (static scan)
// -------------------------------------------------------------
function findFilesRecursive(dir, ext = ".mjs") {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findFilesRecursive(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

// web/tests（npm e2e）和 qa/test（送审矩阵脚本）都扫；qa/review 自己不算
const testDirs = [path.join(REPO_ROOT, "web/tests"), path.join(REPO_ROOT, "qa/test")];
const testFiles = testDirs.flatMap((d) => findFilesRecursive(d, ".mjs"));

for (const tf of testFiles) {
  const content = fs.readFileSync(tf, "utf8");
  const hasThrow = /\bthrow\b/.test(content);
  const hasRender = /\brender\b|addInitScript|initScript|monkey|prototype/i.test(content);
  const hasSave = /zaozi\.save|SAVE_KEY|saveKey|localStorage/.test(content);

  if (hasThrow && hasRender && hasSave) {
    results.subChecks.C6a_e2e_presence.matchingFiles.push(path.relative(REPO_ROOT, tf));
  }
}

if (results.subChecks.C6a_e2e_presence.matchingFiles.length > 0) {
  results.subChecks.C6a_e2e_presence.pass = true;
  const m = results.subChecks.C6a_e2e_presence.matchingFiles;
  const inNpm = m.filter((f) => f.startsWith("web/tests/")).length;
  results.subChecks.C6a_e2e_presence.message =
    `找到 ${m.length} 个覆盖用例` + (inNpm ? "" : "（只在 qa/test，未接入 web/tests 的 npm e2e）");
} else {
  results.subChecks.C6a_e2e_presence.pass = false;
  results.subChecks.C6a_e2e_presence.message = "缺『注入 render 报错后断言存档还在』的 e2e";
}

// -------------------------------------------------------------
// Dynamic Sub-checks: C6b and C6c
// -------------------------------------------------------------
const enginesList = ENGINES_ARG.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const perEngine = []; // 每个引擎各自的 C6b/C6c 结果，任一引擎不过即不过

async function runDynamicProbes() {
  const pwPath = path.join(REPO_ROOT, "web/node_modules/playwright/index.mjs");
  const playwright = await import(pathToFileURL(pwPath).href);

  for (const engineName of enginesList) {
    const launcher = playwright[engineName];
    if (!launcher) {
      console.warn(`[data_safety] Unknown engine ${engineName}, skipping`);
      continue;
    }

    let browser;
    try {
      browser = await launcher.launch({ headless: true });
    } catch (e) {
      perEngine.push({ engine: engineName, launchError: e.message.split("\n")[0] });
      continue;
    }
    // 每个引擎重置一次，免得上一个引擎的结果串过来
    results.subChecks.C6b_render_error_probe = { pass: false, message: "未执行", details: {} };
    results.subChecks.C6c_corrupt_replay_probe = { pass: false, message: "未执行", details: {} };
    try {
      // -------------------------------------------------------
      // C6b render-error probe
      // -------------------------------------------------------
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const url = `${BASE_URL}/?seed=20261016`;

      await page1.goto(url);
      await page1.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page1.evaluate(() => localStorage.clear());
      await page1.reload();
      await page1.waitForFunction(
        () => window.__zz && window.__zz.st && window.__zz.st.phase === "card" && !window.__zz.animating
      );
      await new Promise((r) => setTimeout(r, 600));

      // Make 2 moves to ensure save exists
      await page1.keyboard.press("ArrowLeft");
      await new Promise((r) => setTimeout(r, 400));
      await page1.keyboard.press("ArrowLeft");
      await new Promise((r) => setTimeout(r, 600));

      const raw = await page1.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
      await page1.close();

      if (!raw) {
        results.subChecks.C6b_render_error_probe.pass = false;
        results.subChecks.C6b_render_error_probe.message = "未能成功建立初始存档";
      } else {
        // Create new page in same context with throw injection
        const page2 = await context.newPage();
        const pageerrors = [];
        page2.on("pageerror", (err) => pageerrors.push(err.message));

        await page2.addInitScript(() => {
          window.__qaThrow = true;
          window.__qaThrowCount = 0;
          // 只在调用栈里有 render() 时才抛：模拟「渲染报错」，不去打断 render 之前的初始化代码
          // （V8: "at render (", SpiderMonkey/JSC: "render@"）
          const inRender = () => /(^|\s)(at\s+)?render(@|\s+\()/m.test(new Error().stack || "");
          const bump = () => { window.__qaThrowCount++; try { sessionStorage.setItem("qaThrows", String(+(sessionStorage.getItem("qaThrows") || 0) + 1)); } catch {} };
          setTimeout(() => {
            window.__qaThrow = false;
          }, 1500);

          const origText = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
          if (origText && origText.set) {
            Object.defineProperty(Node.prototype, "textContent", {
              set(val) {
                if (window.__qaThrow && document.readyState !== "loading" && inRender()) {
                  bump(); throw new Error("qa-injected-render-error: textContent");
                }
                return origText.set.call(this, val);
              },
              get() {
                return origText.get.call(this);
              },
            });
          }

          const origInner = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
          if (origInner && origInner.set) {
            Object.defineProperty(Element.prototype, "innerHTML", {
              set(val) {
                if (window.__qaThrow && document.readyState !== "loading" && inRender()) {
                  bump(); throw new Error("qa-injected-render-error: innerHTML");
                }
                return origInner.set.call(this, val);
              },
              get() {
                return origInner.get.call(this);
              },
            });
          }

          const origAppend = Element.prototype.appendChild;
          Element.prototype.appendChild = function (child) {
            if (window.__qaThrow && document.readyState !== "loading" && inRender()) {
              bump(); throw new Error("qa-injected-render-error: appendChild");
            }
            return origAppend.call(this, child);
          };

          const origReplace = Element.prototype.replaceChildren;
          if (origReplace) {
            Element.prototype.replaceChildren = function (...nodes) {
              if (window.__qaThrow && document.readyState !== "loading" && inRender()) {
                bump(); throw new Error("qa-injected-render-error: replaceChildren");
              }
              return origReplace.apply(this, nodes);
            };
          }
        });

        try {
          await page2.goto(url);
        } catch {}

        await new Promise((r) => setTimeout(r, 2500));

        const toastInfo = await page2
          .evaluate(() => {
            const t = document.querySelector("#toast");
            return t ? { text: t.textContent.trim(), hidden: t.hidden } : null;
          })
          .catch(() => null);

        const afterRaw = await page2.evaluate((k) => localStorage.getItem(k), SAVE_KEY).catch(() => null);
        await page2.close();

        // 注入必须真的打到了渲染路径（至少抛出 1 次），否则探针无效、不能判过
        // 计数放 sessionStorage：页面若在报错后自行刷新，window 上的计数会丢
        const throwCount = Math.max(
          await page2.evaluate(() => +(sessionStorage.getItem("qaThrows") || 0)).catch(() => 0),
          pageerrors.filter((e) => e.includes("qa-injected-render-error")).length
        );
        const c6bPass = afterRaw === raw && throwCount > 0;
        const injectedErrors = pageerrors.filter((e) => e.includes("qa-injected-render-error"));
        const otherErrors = pageerrors.filter((e) => !e.includes("qa-injected-render-error"));

        results.subChecks.C6b_render_error_probe = {
          pass: c6bPass,
          message: c6bPass
            ? "注入 render 报错后，存档完整保留且未被破坏"
            : throwCount === 0
            ? "注入探针未生效（渲染路径未抛出），不能判过"
            : "注入 render 报错后，存档丢失或被覆写",
          details: {
            rawSavePreserved: c6bPass,
            toastShown: Boolean(toastInfo && toastInfo.text),
            toastText: toastInfo?.text || "",
            injectedErrorCount: injectedErrors.length,
            injectedThrowCount: throwCount,
            otherErrorCount: otherErrors.length,
            otherErrors,
          },
        };
      }

      // -------------------------------------------------------
      // C6c corrupt-replay probe
      // -------------------------------------------------------
      const page3 = await context.newPage();
      await page3.goto(url);
      await page3.waitForFunction(
        () => window.__zz && window.__zz.st && window.__zz.st.phase === "card"
      );

      // Construct a corrupted unreplayable save
      let corruptString = "ZZ1.corrupt.invalid";
      if (raw && raw.startsWith("ZZ1.")) {
        try {
          const parts = raw.split(".");
          const jsonStr = Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed.actions)) {
            parsed.actions.push({ type: "impossible_action_999", side: "zz" });
            const body = JSON.stringify(parsed);
            let h = 0x811c9dc5;
            for (let i = 0; i < body.length; i++) {
              h ^= body.charCodeAt(i);
              h = Math.imul(h, 0x01000193) >>> 0;
            }
            const ck = h.toString(36);
            const b64 = Buffer.from(body).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            corruptString = `ZZ1.${ck}.${b64}`;
          }
        } catch {
          corruptString = raw + "_corrupt_garbage";
        }
      }

      await page3.evaluate(
        ({ k, v }) => {
          localStorage.setItem(k, v);
        },
        { k: SAVE_KEY, v: corruptString }
      );

      await page3.reload();
      await new Promise((r) => setTimeout(r, 1200));

      const afterCorrupt = await page3.evaluate(
        ({ k, b }) => ({
          saveVal: localStorage.getItem(k),
          bakVal: localStorage.getItem(b),
          toast: document.querySelector("#toast")?.textContent?.trim() || "",
        }),
        { k: SAVE_KEY, b: BACKUP_KEY }
      );

      await page3.close();
      await context.close();

      const isRecoverable = afterCorrupt.saveVal === corruptString || afterCorrupt.bakVal === corruptString;
      results.subChecks.C6c_corrupt_replay_probe = {
        pass: isRecoverable,
        message: isRecoverable
          ? "损坏存档在重放失败后已成功留存（存在于 SAVE_KEY 或 .bak 中）"
          : "损坏存档在重放失败后从 SAVE_KEY 与 .bak 中彻底丢失",
        details: {
          originalCorruptString: corruptString,
          foundInSaveKey: afterCorrupt.saveVal === corruptString,
          foundInBackupKey: afterCorrupt.bakVal === corruptString,
          toast: afterCorrupt.toast,
        },
      };
    } finally {
      perEngine.push({
        engine: engineName,
        c6b: results.subChecks.C6b_render_error_probe,
        c6c: results.subChecks.C6c_corrupt_replay_probe,
      });
      await browser.close();
    }
  }
  // 汇总：所有引擎都过才算过；失败信息带引擎名
  results.perEngine = perEngine;
  const bad = (k) => perEngine.filter((p) => p.launchError || !p[k] || !p[k].pass);
  for (const [k, key] of [["c6b", "C6b_render_error_probe"], ["c6c", "C6c_corrupt_replay_probe"]]) {
    const b = bad(k);
    if (perEngine.length === 0) {
      results.subChecks[key] = { pass: false, message: "没有可用引擎", details: {} };
    } else if (b.length) {
      results.subChecks[key] = {
        pass: false,
        message: b.map((p) => `${p.engine}: ${p.launchError ? "引擎启动失败 " + p.launchError : p[k].message}`).join("; "),
        details: (b.find((p) => p[k]) || {})[k]?.details || {},
      };
    } else {
      results.subChecks[key] = { ...perEngine[0][k], message: perEngine[0][k].message + `（${perEngine.map((p) => p.engine).join("/")}）` };
    }
  }
}

try {
  await runDynamicProbes();
} catch (err) {
  results.status = "FAIL";
  results.dynamicError = err.stack || err.message;
}

// Final evaluation
if (
  !results.subChecks.C6a_e2e_presence.pass ||
  !results.subChecks.C6b_render_error_probe.pass ||
  !results.subChecks.C6c_corrupt_replay_probe.pass
) {
  results.status = "FAIL";
}

// Write JSON & MD
const jsonPath = path.join(OUT_DIR, "data_safety.json");
fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");

let md = `# 数据安全检查 (Item C6 - 规则 数据安全（PR9 D4/B5）)\n\n`;
md += `- **检查结论**: **${results.status}**\n`;
md += `- **检查引擎**: ${ENGINES_ARG}\n`;
md += `- **检查时间**: ${results.timestamp}\n\n`;

md += `## 1. C6a: e2e 覆盖存在性 (静态扫描)\n`;
if (results.subChecks.C6a_e2e_presence.pass) {
  md += `- PASS: ${results.subChecks.C6a_e2e_presence.message}\n`;
  for (const f of results.subChecks.C6a_e2e_presence.matchingFiles) {
    md += `  - \`${f}\`\n`;
  }
} else {
  md += `- FAIL: ${results.subChecks.C6a_e2e_presence.message}\n`;
}
md += `\n`;

md += `## 2. C6b: Render 异常探针 (动态注入)\n`;
md += `- **结果**: **${results.subChecks.C6b_render_error_probe.pass ? "PASS" : "FAIL"}**\n`;
md += `- **详情**: ${results.subChecks.C6b_render_error_probe.message}\n`;
if (results.subChecks.C6b_render_error_probe.details) {
  md += `  - 存档保持一致: ${results.subChecks.C6b_render_error_probe.details.rawSavePreserved ? "是" : "否"}\n`;
  md += `  - Toast 显示: ${results.subChecks.C6b_render_error_probe.details.toastShown ? `有 (「${results.subChecks.C6b_render_error_probe.details.toastText}」)` : "无"}\n`;
  md += `  - 注入异常捕获数: ${results.subChecks.C6b_render_error_probe.details.injectedErrorCount}\n`;
  md += `  - 其他非预期异常数: ${results.subChecks.C6b_render_error_probe.details.otherErrorCount}\n`;
}
md += `\n`;

md += `## 3. C6c: 损坏存档重放探针 (动态损坏重放)\n`;
md += `- **结果**: **${results.subChecks.C6c_corrupt_replay_probe.pass ? "PASS" : "FAIL"}**\n`;
md += `- **详情**: ${results.subChecks.C6c_corrupt_replay_probe.message}\n`;
if (results.subChecks.C6c_corrupt_replay_probe.details) {
  md += `  - 保存于原始 Key: ${results.subChecks.C6c_corrupt_replay_probe.details.foundInSaveKey ? "是" : "否"}\n`;
  md += `  - 保存于 .bak 备份 Key: ${results.subChecks.C6c_corrupt_replay_probe.details.foundInBackupKey ? "是" : "否"}\n`;
  md += `  - Toast 提示: 「${results.subChecks.C6c_corrupt_replay_probe.details.toast}」\n`;
}

const mdPath = path.join(OUT_DIR, "data_safety.md");
fs.writeFileSync(mdPath, md, "utf8");

console.log(`[data_safety] Completed: ${results.status}`);
process.exit(results.status === "PASS" ? 0 : 1);
