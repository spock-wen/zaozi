// 公共 glyph CSV：把私有 csv 的 notes、credit_note 两列去掉，生成发布用的公开 csv。
// 原始私有 csv 已丢失，现网与仓库里只剩公开版（本来就没有这两列），
// 所以本脚本对现有的 glyph/glyph_pack_v1.csv 是幂等的：列不变、字节不变。
import fs from "node:fs";
import path from "node:path";

const DROP = new Set(["notes", "credit_note"]);

export function publicCsv(csvText) {
  const lines = csvText.split("\n");
  if (lines.length === 0) return csvText;
  const header = lines[0].split(",");
  const keep = header.map((h, i) => (DROP.has(h) ? -1 : i)).filter((i) => i >= 0);
  const out = lines.map((line) => {
    if (line === "") return line;
    const cols = line.split(",");
    return keep.map((i) => cols[i]).join(",");
  });
  return out.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [src, dest] = process.argv.slice(2);
  const text = fs.readFileSync(src, "utf8");
  const result = publicCsv(text);
  if (dest) fs.writeFileSync(dest, result);
  else process.stdout.write(result);
}
