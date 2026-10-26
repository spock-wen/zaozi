// summary.mjs — Aggregates review checklist checkers into summary.json & summary.md
// Computes final pass/fail gate status and prints summary table

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const REPO_ROOT = path.resolve(getArg("--repo-root", findRepoRoot()));
const OUT_DIR = path.resolve(getArg("--out-dir", path.join(REPO_ROOT, "qa/review/out/latest")));
const LATEST_DIR = path.join(REPO_ROOT, "qa/review/out/latest");
const onlyArg = getArg("--only", "");

fs.mkdirSync(OUT_DIR, { recursive: true });

const onlyItems = onlyArg
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

function isItemIncluded(id) {
  if (onlyItems.length === 0) return true;
  return onlyItems.includes(id) || (id === "C4" && (onlyItems.includes("C4A") || onlyItems.includes("C4B")));
}

function readJsonSafe(filename) {
  const filePath = path.join(OUT_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

const staticRes = readJsonSafe("static_check.json");
const uiRes = readJsonSafe("ui_gate.json");
const cliRes = readJsonSafe("cli_model.json");
const safetyRes = readJsonSafe("data_safety.json");

// Item C1
let c1Status = "SKIPPED";
let c1Detail = "未执行";
if (uiRes && uiRes.itemStatuses && uiRes.itemStatuses.C1) {
  c1Status = uiRes.itemStatuses.C1;
  c1Detail = `抽样 ${uiRes.counts.C1.samples} 项，失败 ${uiRes.counts.C1.fails}，警告 ${uiRes.counts.C1.warns}`;
}

// Item C2
let c2Status = "SKIPPED";
let c2Detail = "未执行";
if (uiRes && uiRes.itemStatuses && uiRes.itemStatuses.C2) {
  c2Status = uiRes.itemStatuses.C2;
  c2Detail = `抽样 ${uiRes.counts.C2.samples} 项，失败 ${uiRes.counts.C2.fails}`;
}

// Item C3
let c3Status = "SKIPPED";
let c3Detail = "未执行";
if (uiRes && uiRes.itemStatuses && uiRes.itemStatuses.C3) {
  c3Status = uiRes.itemStatuses.C3;
  c3Detail = `抽样 ${uiRes.counts.C3.samples} 项，失败 ${uiRes.counts.C3.fails}`;
}

// Item C4 (C4a + C4b)
let c4Status = "SKIPPED";
let c4Detail = "未执行";
if (staticRes || uiRes) {
  // C4 需要静态(C4a)与运行(C4b)两半都产出结果；--only c4 时两半都会跑
  const c4aPass = staticRes ? staticRes.status === "PASS" : false;
  const c4bPass = uiRes && uiRes.itemStatuses ? uiRes.itemStatuses.C4b === "PASS" : false;

  if (staticRes && uiRes) {
    c4Status = c4aPass && c4bPass ? "PASS" : "FAIL";
    const parts = [];
    if (!c4aPass) parts.push("C4a静态检查未通过");
    if (!c4bPass) parts.push(`C4b有 ${uiRes.counts.C4b.cellFails} 单元报错`);
    c4Detail = parts.length > 0 ? parts.join("; ") : "静态与运行错误检查均通过";
  } else {
    c4Status = "FAIL";
    c4Detail = staticRes ? "缺运行报错结果(ui_gate.json)" : "缺静态检查结果(static_check.json)";
  }
}

// Item C5
let c5Status = "SKIPPED";
let c5Detail = "未执行";
if (cliRes) {
  c5Status = cliRes.status;
  if (c5Status === "PASS") {
    c5Detail = `SHA 全部匹配 (${cliRes.checks.allShasIncluded.totalShas} 个)，cc 原因合规，无违规图片任务`;
  } else {
    const reasons = [];
    if (!cliRes.checks?.hasCliModelSection?.pass) reasons.push("缺「CLI/模型」栏");
    if (!cliRes.checks?.allShasIncluded?.pass)
      reasons.push(`缺 ${cliRes.checks.allShasIncluded.missingShas.length} 个 SHA`);
    if (cliRes.checks?.ccReasons?.failures?.length > 0)
      reasons.push(`${cliRes.checks.ccReasons.failures.length} 处 cc 缺原因`);
    if (cliRes.checks?.glmVisionBan?.failures?.length > 0)
      reasons.push(`${cliRes.checks.glmVisionBan.failures.length} 处 glm-5.3 涉图违规`);
    if (cliRes.errors?.length > 0) reasons.push(...cliRes.errors);
    c5Detail = reasons.join("; ");
  }
}

// Item C6
let c6Status = "SKIPPED";
let c6Detail = "未执行";
if (safetyRes) {
  c6Status = safetyRes.status;
  if (c6Status === "PASS") {
    c6Detail = "e2e 覆盖存在，render 报错不丢档，损坏存档可恢复";
  } else {
    const parts = [];
    if (!safetyRes.subChecks?.C6a_e2e_presence?.pass) parts.push(safetyRes.subChecks.C6a_e2e_presence.message);
    if (!safetyRes.subChecks?.C6b_render_error_probe?.pass)
      parts.push(safetyRes.subChecks.C6b_render_error_probe.message);
    if (!safetyRes.subChecks?.C6c_corrupt_replay_probe?.pass)
      parts.push(safetyRes.subChecks.C6c_corrupt_replay_probe.message);
    c6Detail = parts.join("; ");
  }
}

const items = [
  { id: "C1", ...config.RULE_MAP.C1, status: c1Status, detail: c1Detail },
  { id: "C2", ...config.RULE_MAP.C2, status: c2Status, detail: c2Detail },
  { id: "C3", ...config.RULE_MAP.C3, status: c3Status, detail: c3Detail },
  { id: "C4", ...config.RULE_MAP.C4, status: c4Status, detail: c4Detail },
  { id: "C5", ...config.RULE_MAP.C5, status: c5Status, detail: c5Detail },
  { id: "C6", ...config.RULE_MAP.C6, status: c6Status, detail: c6Detail },
];

// Evaluate overall verdict
let overallVerdict = "PASS";
for (const item of items) {
  if (isItemIncluded(item.id)) {
    // 被要求跑的项没有产出结果（检查器崩了/没跑）也算不过
    if (item.status !== "PASS") {
      if (item.status === "SKIPPED") { item.status = "FAIL"; item.detail = "未产出结果（检查器崩溃或未运行）"; }
      overallVerdict = "FAIL";
    }
  }
}

const summaryData = {
  verdict: overallVerdict,
  timestamp: new Date().toISOString(),
  targetDir: OUT_DIR,
  items,
  checksRun: {
    static_check: Boolean(staticRes),
    ui_gate: Boolean(uiRes),
    cli_model: Boolean(cliRes),
    data_safety: Boolean(safetyRes),
  },
};

// Write summary.json
fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summaryData, null, 2), "utf8");

// Generate summary.md
let md = `# 工程送审检查清单汇总 (Engineering Review Summary)\n\n`;
md += `- **总体结论**: **${overallVerdict}**\n`;
md += `- **检查时间**: ${summaryData.timestamp}\n`;
md += `- **输出目录**: \`${OUT_DIR}\`\n\n`;

md += `## 检查项结论列表\n\n`;
md += `| 编号 | 检查项 | 规则号 | 状态 | 判据与详情 | 详情报告 |\n`;
md += `|:---:|---|---|:---:|---|---|\n`;

for (const it of items) {
  const mark = it.status === "PASS" ? "✅ PASS" : it.status === "FAIL" ? "❌ FAIL" : "⚪ SKIPPED";
  md += `| ${it.id} | ${it.name} | \`${it.rule}\` | **${mark}** | ${it.detail} | [${it.output}](${it.output}) |\n`;
}
md += `\n`;

if (uiRes && uiRes.recordOnlyFailures && uiRes.recordOnlyFailures.length > 0) {
  md += `> [!NOTE] 360x640 为仅记录视口 (Rule R14 / PM U4)，不影响门禁总体结论。\n\n`;
}

fs.writeFileSync(path.join(OUT_DIR, "summary.md"), md, "utf8");

// Copy to qa/review/out/latest/ if OUT_DIR is not latest
if (OUT_DIR !== LATEST_DIR) {
  fs.mkdirSync(LATEST_DIR, { recursive: true });
  fs.copyFileSync(path.join(OUT_DIR, "summary.json"), path.join(LATEST_DIR, "summary.json"));
  fs.copyFileSync(path.join(OUT_DIR, "summary.md"), path.join(LATEST_DIR, "summary.md"));
}

// Print final table to stdout
console.log(`\n================================================================================`);
console.log(`                      工程送审检查清单结论: ${overallVerdict}                       `);
console.log(`================================================================================`);
console.log(`编号 | 检查项                 | 规则号                            | 状态    | 详情`);
console.log(`-----+------------------------+-----------------------------------+---------+-----------------------------`);
for (const it of items) {
  if (isItemIncluded(it.id)) {
    const idPad = it.id.padEnd(4);
    const namePad = it.name.padEnd(16);
    const rulePad = it.rule.padEnd(25);
    const statusPad = it.status.padEnd(7);
    console.log(`${idPad} | ${namePad} | ${rulePad} | ${statusPad} | ${it.detail}`);
  }
}
console.log(`================================================================================\n`);

process.exit(overallVerdict === "PASS" ? 0 : 1);
