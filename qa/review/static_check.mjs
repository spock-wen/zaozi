// static_check.mjs — Item C4a (Rule R20)
// Checks web/web/*.js files for:
// 1. Duplicate top-level function declarations
// 2. Exactly one function inputBusy anywhere
// 3. Syntax errors via node --input-type=module --check

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate repo root
function findRepoRoot() {
  let curr = __dirname;
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, ".git"))) return curr;
    curr = path.dirname(curr);
  }
  return process.cwd();
}

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : defaultValue;
}

const REPO_ROOT = path.resolve(getArg("--repo-root", findRepoRoot()));
const OUT_DIR = path.resolve(getArg("--out-dir", path.join(REPO_ROOT, "qa/review/out/latest")));

fs.mkdirSync(OUT_DIR, { recursive: true });

const targetDir = path.join(REPO_ROOT, "web/web");
let jsFiles = [];
if (fs.existsSync(targetDir)) {
  jsFiles = fs
    .readdirSync(targetDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => path.join(targetDir, f));
}

const results = {
  item: "C4a",
  rule: "R20",
  status: "PASS",
  filesChecked: jsFiles.map((f) => path.relative(REPO_ROOT, f)),
  duplicateFunctions: [],
  inputBusy: {
    count: 0,
    locations: [],
    pass: false,
  },
  syntaxErrors: [],
  timestamp: new Date().toISOString(),
};

// 1 & 2: Parse functions and count inputBusy
for (const filePath of jsFiles) {
  const relPath = path.relative(REPO_ROOT, filePath);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  const topLevelMap = new Map(); // name -> [lineNumbers]

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Check for function inputBusy anywhere on line
    const inputBusyMatch = line.match(/\bfunction\s+inputBusy\b/g);
    if (inputBusyMatch) {
      for (const m of inputBusyMatch) {
        results.inputBusy.count++;
        results.inputBusy.locations.push({ file: relPath, line: lineNum, text: line.trim() });
      }
    }

    // Top-level function regex (no indentation at start of line)
    // starts with function or async function
    const topMatch = line.match(/^(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/);
    if (topMatch) {
      const name = topMatch[1];
      if (!topLevelMap.has(name)) {
        topLevelMap.set(name, []);
      }
      topLevelMap.get(name).push(lineNum);
    }
  }

  for (const [name, lineNums] of topLevelMap.entries()) {
    if (lineNums.length > 1) {
      results.duplicateFunctions.push({
        file: relPath,
        functionName: name,
        occurrences: lineNums,
      });
    }
  }

  // 3: Syntax check via node --input-type=module --check < file
  const checkRun = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    input: content,
    encoding: "utf8",
  });
  if (checkRun.status !== 0) {
    results.syntaxErrors.push({
      file: relPath,
      stderr: (checkRun.stderr || "").trim(),
    });
  }
}

// Evaluate status
results.inputBusy.pass = results.inputBusy.count === 1;

const hasDuplicates = results.duplicateFunctions.length > 0;
const hasInputBusyError = !results.inputBusy.pass;
const hasSyntaxErrors = results.syntaxErrors.length > 0;

if (hasDuplicates || hasInputBusyError || hasSyntaxErrors) {
  results.status = "FAIL";
}

// Write JSON
const jsonPath = path.join(OUT_DIR, "static_check.json");
fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");

// Generate Markdown
let md = `# 静态代码检查 (Item C4a - 规则 R20)\n\n`;
md += `- **检查结论**: **${results.status}**\n`;
md += `- **检查文件**: ${results.filesChecked.join(", ") || "无"}\n`;
md += `- **检查时间**: ${results.timestamp}\n\n`;

md += `## 1. 顶层函数重名检查\n`;
if (results.duplicateFunctions.length === 0) {
  md += `- PASS: 未发现重名顶层函数\n`;
} else {
  md += `- FAIL: 发现 ${results.duplicateFunctions.length} 处重名顶层函数\n\n`;
  md += `| 文件 | 函数名 | 行号 |\n|---|---|---|\n`;
  for (const d of results.duplicateFunctions) {
    md += `| \`${d.file}\` | \`${d.functionName}\` | ${d.occurrences.join(", ")} |\n`;
  }
}
md += `\n`;

md += `## 2. inputBusy 函数计数检查\n`;
if (results.inputBusy.pass) {
  md += `- PASS: \`function inputBusy\` 全局计数刚好为 1 (行号: ${results.inputBusy.locations.map((l) => `${l.file}:${l.line}`).join(", ")})\n`;
} else {
  md += `- FAIL: \`function inputBusy\` 计数不为 1 (实际计数: ${results.inputBusy.count})\n`;
  for (const loc of results.inputBusy.locations) {
    md += `  - \`${loc.file}:${loc.line}\`: \`${loc.text}\`\n`;
  }
}
md += `\n`;

md += `## 3. Node 语法检查 (node --input-type=module --check)\n`;
if (results.syntaxErrors.length === 0) {
  md += `- PASS: 所有检查文件语法合法无 SyntaxError\n`;
} else {
  md += `- FAIL: 发现语法错误\n`;
  for (const err of results.syntaxErrors) {
    md += `### ${err.file}\n\`\`\`\n${err.stderr}\n\`\`\`\n`;
  }
}

const mdPath = path.join(OUT_DIR, "static_check.md");
fs.writeFileSync(mdPath, md, "utf8");

console.log(`[static_check] Completed: ${results.status}`);
if (results.status !== "PASS") {
  if (hasDuplicates) console.error(`  - Found duplicate top-level functions`);
  if (hasInputBusyError) console.error(`  - function inputBusy count = ${results.inputBusy.count} (expected 1)`);
  if (hasSyntaxErrors) console.error(`  - Syntax error detected`);
}

process.exit(results.status === "PASS" ? 0 : 1);
