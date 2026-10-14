// 从 glyph/glyph_pack_v1.csv 生成 credits.html 表格里的一行行 <tr>。
// 列映射（已按 baseline_dist/credits.html 逐字节核对）：
//   字=char  阶段=stage_label<br><small>stage</small>  来源=source
//   许可=license<br><span class="url">license_url</span>  署名=source_label
//   原始链接=commons_page（小学堂行为空，回落到 url）
// 值里的 & < > " 按 HTML 实体转义。
import fs from "node:fs";
import path from "node:path";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function creditsRows(csvText) {
  const lines = csvText.split("\n").filter((x) => x !== "");
  const rows = lines.slice(1); // 跳过表头
  return rows.map((line) => {
    const [id, char, trad, method, order, stage, stage_label, source, license, license_url, p, url, commons_page, format, width, height, bytes, sha1, commons_sha1, source_label] = line.split(",");
    return `<tr><td>${esc(char)}</td><td>${esc(stage_label)}<br><small>${esc(stage)}</small></td><td>${esc(source)}</td><td>${esc(license)}<br><span class="url">${esc(license_url)}</span></td><td>${esc(source_label)}</td><td class="url">${esc(commons_page || url)}</td></tr>`;
  });
}

// 用模板渲染完整 credits.html：__COUNT__ = 行数，__ROWS__ = 表格行。
export function renderCredits(csvText, templateText) {
  const rows = creditsRows(csvText);
  return templateText
    .replace("__COUNT__", String(rows.length))
    .replace("__ROWS__", rows.join("\n"));
}

// CLI：
//   node tools/credits_table.mjs <csv>                 输出表格行（每行一条）
//   node tools/credits_table.mjs <csv> <template> <out> 渲染完整 credits.html
if (import.meta.url === `file://${process.argv[1]}`) {
  const [csvPath, templatePath, outPath] = process.argv.slice(2);
  const csv = fs.readFileSync(csvPath, "utf8");
  if (!templatePath) {
    process.stdout.write(creditsRows(csv).join("\n") + "\n");
  } else {
    const html = renderCredits(csv, fs.readFileSync(templatePath, "utf8"));
    if (outPath) fs.writeFileSync(outPath, html);
    else process.stdout.write(html);
  }
}
