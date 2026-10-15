// 版权页是给玩家看的公开页面：介绍文字里不能出现内部文件路径（glyph/glyph_pack_v1.csv、
// glyph/ 目录）或内部代码样式。用真实模板 + 真实 csv 渲染一份 credits.html 来断言，
// 不依赖 dist/ 是否已经构建。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { renderCredits } from "../tools/credits_table.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function generated() {
  const tmpl = fs.readFileSync(path.join(ROOT, "tools", "credits_template.html"), "utf8");
  const csv = fs.readFileSync(path.join(ROOT, "glyph", "glyph_pack_v1.csv"), "utf8");
  const sources = fs.readFileSync(path.join(ROOT, "data", "glyph_sources.csv"), "utf8");
  return renderCredits(csv, tmpl, sources);
}

test("generated credits.html has no internal path or jargon", () => {
  const html = generated();
  assert.ok(!html.includes("glyph_pack"), "版权页不能出现内部文件名 glyph_pack");
  assert.ok(!html.includes("glyph/"), "版权页不能把 glyph/ 当成路径引用");
  assert.ok(!html.includes("<code>"), "版权页不应出现内部代码样式 <code>");
  assert.ok(!html.includes("baseline"), "版权页不能出现内部术语 baseline");
});

test("generated credits.html keeps the public wording and table", () => {
  const html = generated();
  for (const w of ["字", "阶段", "来源", "许可", "署名", "原始链接"]) {
    assert.ok(html.includes(w), `版权页应保留公开措辞「${w}」`);
  }
  assert.match(html, /共 \d+ 条/, "版权页应填出身形条数");
  assert.ok(html.includes("Richard Sears"), "版权页应保留 Richard Sears 署名");
});
