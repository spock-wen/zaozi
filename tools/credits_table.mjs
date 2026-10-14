// 从 glyph/glyph_pack_v1.csv 生成 credits.html 表格里的一行行 <tr>。
// 列映射（已按 baseline_dist/credits.html 逐字节核对）：
//   字=char  阶段=stage_label<br><small>stage</small>  来源=source
//   许可=license<br><span class="url">license_url</span>  署名=source_label
//   原始链接=commons_page（小学堂行为空，回落到 url）
// 值里的 & < > " 按 HTML 实体转义。
import fs from "node:fs";
import path from "node:path";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 极简 CSV 行解析：支持双引号包裹（SOURCES.csv 的 credit 列里带逗号）。
function splitCsvLine(line) {
  line = line.replace(/\r$/, "");
  const out = [];
  let cell = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cell); cell = ""; }
    else cell += c;
  }
  out.push(cell);
  return out;
}

// 从 SOURCES.csv（data/glyph_sources.csv，公开字段）建索引：key = 原始文件页（source_label），
// value = { author, credit }。字源页据此在「署名」列补出作者与 credit 列的致谢。
export function sourceAttributions(sourcesCsvText) {
  const map = new Map();
  if (!sourcesCsvText) return map;
  const lines = sourcesCsvText.split("\n").filter((x) => x !== "");
  const header = splitCsvLine(lines[0]);
  const I = (k) => header.indexOf(k);
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const url = cols[I("url")] || "";
    const file = decodeURIComponent(url.split("/").pop() || "");
    if (!file) continue;
    map.set(file, { author: cols[I("author")] || "", credit: cols[I("credit")] || "" });
  }
  return map;
}

export function creditsRows(csvText, sourcesCsvText = "") {
  const sources = sourceAttributions(sourcesCsvText);
  const lines = csvText.split("\n").filter((x) => x !== "");
  const rows = lines.slice(1); // 跳过表头
  return rows.map((line) => {
    const [id, char, trad, method, order, stage, stage_label, source, license, license_url, p, url, commons_page, format, width, height, bytes, sha1, commons_sha1, source_label] = line.split(",");
    // 署名：来源页 + （如 SOURCES.csv 里有）作者、credit 列致谢
    const att = sources.get(source_label);
    let sig = esc(source_label);
    if (att) {
      if (att.author) sig += `<br><small>${esc(att.author)}</small>`;
      if (att.credit) sig += `<br><small>${esc(att.credit)}</small>`;
    }
    return `<tr><td>${esc(char)}</td><td>${esc(stage_label)}<br><small>${esc(stage)}</small></td><td>${esc(source)}</td><td>${esc(license)}<br><span class="url">${esc(license_url)}</span></td><td>${sig}</td><td class="url">${esc(commons_page || url)}</td></tr>`;
  });
}

// 用模板渲染完整 credits.html：__COUNT__ = 行数，__ROWS__ = 表格行。
export function renderCredits(csvText, templateText, sourcesCsvText = "") {
  const rows = creditsRows(csvText, sourcesCsvText);
  return templateText
    .replace("__COUNT__", String(rows.length))
    .replace("__ROWS__", rows.join("\n"));
}

// CLI：
//   node tools/credits_table.mjs <csv>                             输出表格行（每行一条）
//   node tools/credits_table.mjs <csv> <template> <out> [sources]  渲染完整 credits.html
if (import.meta.url === `file://${process.argv[1]}`) {
  const [csvPath, templatePath, outPath, sourcesPath] = process.argv.slice(2);
  const csv = fs.readFileSync(csvPath, "utf8");
  const sources = sourcesPath ? fs.readFileSync(sourcesPath, "utf8") : "";
  if (!templatePath) {
    process.stdout.write(creditsRows(csv, sources).join("\n") + "\n");
  } else {
    const html = renderCredits(csv, fs.readFileSync(templatePath, "utf8"), sources);
    if (outPath) fs.writeFileSync(outPath, html);
    else process.stdout.write(html);
  }
}
