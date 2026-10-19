// cli_model_check.mjs — Item C5 (Rule R24 + 审核规则「CLI/模型」行)
// Verifies submission PR body / document against commit log and tool/model usage policies

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
const submissionFile = getArg("--submission", null);

fs.mkdirSync(OUT_DIR, { recursive: true });

// Determine base ref
let baseRef = getArg("--base", null);
if (!baseRef) {
  try {
    baseRef = execSync("git merge-base HEAD origin/main", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    try {
      baseRef = execSync("git merge-base HEAD main", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
    } catch {
      baseRef = "HEAD~1";
    }
  }
}

const results = {
  item: "C5",
  rule: "R24 + 审核规则「CLI/模型」行",
  status: "PASS",
  baseRef,
  submissionSource: null,
  checks: {
    hasCliModelSection: { pass: false, message: "" },
    allShasIncluded: { pass: false, totalShas: 0, missingShas: [], foundShas: [] },
    ccReasons: { pass: true, failures: [], warnings: [] },
    glmVisionBan: { pass: true, failures: [] },
  },
  errors: [],
  timestamp: new Date().toISOString(),
};

// Retrieve submission content
let submissionText = "";
if (submissionFile) {
  const fullSubPath = path.resolve(process.cwd(), submissionFile);
  if (!fs.existsSync(fullSubPath)) {
    results.errors.push(`送审件文件不存在: ${submissionFile}`);
  } else {
    submissionText = fs.readFileSync(fullSubPath, "utf8");
    results.submissionSource = fullSubPath;
  }
} else {
  try {
    const prBody = execSync("gh pr view --json body -q .body", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
    if (prBody) {
      submissionText = prBody;
      results.submissionSource = "gh pr view";
    } else {
      results.errors.push("未提供送审件");
    }
  } catch {
    results.errors.push("未提供送审件");
  }
}

if (!submissionText) {
  results.status = "FAIL";
  const jsonPath = path.join(OUT_DIR, "cli_model.json");
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");

  let md = `# 送审与模型规范检查 (Item C5 - 规则 R24)\n\n`;
  md += `- **检查结论**: **FAIL**\n`;
  md += `- **原因**: ${results.errors.join("; ")}\n`;
  const mdPath = path.join(OUT_DIR, "cli_model.md");
  fs.writeFileSync(mdPath, md, "utf8");
  console.log(`[cli_model_check] Completed: FAIL (${results.errors.join("; ")})`);
  process.exit(1);
}

// Check (1): Line or heading containing CLI/模型
const hasCliModel = /CLI\/模型/i.test(submissionText);
results.checks.hasCliModelSection.pass = hasCliModel;
results.checks.hasCliModelSection.message = hasCliModel
  ? "包含「CLI/模型」标题或行"
  : "缺失「CLI/模型」行或标题";
if (!hasCliModel) {
  results.status = "FAIL";
}

// Check (2): Every commit sha (7-char) in git log --format=%h <base>..HEAD
let commits = [];
try {
  const gitLog = execSync(`git log --format=%H "${baseRef}"..HEAD`, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  if (gitLog) {
    commits = gitLog.split("\n").map((s) => s.trim()).filter(Boolean);
  }
} catch (e) {
  results.errors.push(`git log 失败: ${e.message}`);
}

results.checks.allShasIncluded.totalShas = commits.length;
// 送审件里写 7 位及以上任意长度的 sha 都算列出（按前 7 位前缀匹配，大小写不敏感）
const lowerText = submissionText.toLowerCase();
commits = commits.map((full) => full.slice(0, 7));
for (const sha of commits) {
  if (lowerText.includes(sha)) {
    results.checks.allShasIncluded.foundShas.push(sha);
  } else {
    results.checks.allShasIncluded.missingShas.push(sha);
  }
}
if (results.checks.allShasIncluded.missingShas.length > 0) {
  results.checks.allShasIncluded.pass = false;
  results.status = "FAIL";
} else {
  results.checks.allShasIncluded.pass = true;
}

// Check (3) & (4): Line by line inspection
const lines = submissionText.split("\n");
const ccRegex = /\b(?:cc|claude)\b/i;
const reasonRegex = /原因|因为|报错|额度|429|quota|error|RESOURCE_EXHAUSTED/i;
const modelDisclosureRegex = /违反|披露|before|之前|rule/i;
const imageRegex = /图|图片|截图|image|png|screenshot|视觉|vision/i;

for (let idx = 0; idx < lines.length; idx++) {
  const line = lines[idx];
  const lineNum = idx + 1;

  // Check (3): cc / claude reason
  if (ccRegex.test(line)) {
    if (!reasonRegex.test(line)) {
      results.checks.ccReasons.failures.push({
        line: lineNum,
        text: line.trim(),
        message: "提到 cc/claude 但未注明原因（需含 原因/因为/报错/额度/429/quota/error/RESOURCE_EXHAUSTED）",
      });
      results.status = "FAIL";
    }

    if (line.includes("--model")) {
      if (!modelDisclosureRegex.test(line)) {
        results.checks.ccReasons.warnings.push({
          line: lineNum,
          text: line.trim(),
          message: "给 cc 传递 --model 且未在同处明确披露（需含 违反/披露/before/之前/rule）",
        });
      }
    }
  }

  // Check (4): glm-5.3 together with image work words = FAIL
  if (/glm-5\.3/i.test(line) && imageRegex.test(line)) {
    results.checks.glmVisionBan.failures.push({
      line: lineNum,
      text: line.trim(),
      message: "glm-5.3 禁止用于图片相关工作",
    });
    results.status = "FAIL";
  }
}

if (results.checks.ccReasons.failures.length > 0) {
  results.checks.ccReasons.pass = false;
}
if (results.checks.glmVisionBan.failures.length > 0) {
  results.checks.glmVisionBan.pass = false;
}

// Write outputs
const jsonPath = path.join(OUT_DIR, "cli_model.json");
fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");

let md = `# 送审与模型规范检查 (Item C5 - 规则 R24)\n\n`;
md += `- **检查结论**: **${results.status}**\n`;
md += `- **送审件来源**: ${results.submissionSource || "未知"}\n`;
md += `- **对比基线 (base)**: \`${baseRef}\`\n`;
md += `- **检查时间**: ${results.timestamp}\n\n`;

md += `## 1. 「CLI/模型」栏目检查\n`;
md += results.checks.hasCliModelSection.pass
  ? `- PASS: ${results.checks.hasCliModelSection.message}\n\n`
  : `- FAIL: ${results.checks.hasCliModelSection.message}\n\n`;

md += `## 2. Commit SHA 完整性检查\n`;
if (results.checks.allShasIncluded.pass) {
  md += `- PASS: 基线后的全部 ${commits.length} 个 commit SHA 均已在送审件中列出\n\n`;
} else {
  md += `- FAIL: 送审件中遗漏了以下 Commit SHA (${results.checks.allShasIncluded.missingShas.length}/${commits.length}):\n`;
  for (const sha of results.checks.allShasIncluded.missingShas) {
    md += `  - \`${sha}\`\n`;
  }
  md += `\n`;
}

md += `## 3. CC / Claude 使用原因与模型参数检查\n`;
if (results.checks.ccReasons.failures.length === 0) {
  md += `- PASS: 所有提及 cc/claude 处均填写了合规原因\n`;
} else {
  md += `- FAIL: 发现未附带合规原因的 cc/claude 使用记录:\n`;
  for (const f of results.checks.ccReasons.failures) {
    md += `  - 第 ${f.line} 行: \`${f.text}\` (${f.message})\n`;
  }
}
if (results.checks.ccReasons.warnings.length > 0) {
  md += `\n- WARN (未披露的 --model):\n`;
  for (const w of results.checks.ccReasons.warnings) {
    md += `  - 第 ${w.line} 行: \`${w.text}\` (${w.message})\n`;
  }
}
md += `\n`;

md += `## 4. GLM-5.3 涉图检查\n`;
if (results.checks.glmVisionBan.failures.length === 0) {
  md += `- PASS: 未发现 glm-5.3 用于图片任务\n\n`;
} else {
  md += `- FAIL: 发现违规使用 glm-5.3 处理图片任务:\n`;
  for (const f of results.checks.glmVisionBan.failures) {
    md += `  - 第 ${f.line} 行: \`${f.text}\` (${f.message})\n`;
  }
  md += `\n`;
}

const mdPath = path.join(OUT_DIR, "cli_model.md");
fs.writeFileSync(mdPath, md, "utf8");

console.log(`[cli_model_check] Completed: ${results.status}`);
process.exit(results.status === "PASS" ? 0 : 1);
