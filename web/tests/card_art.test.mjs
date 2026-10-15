// 卡面图单测（brief C1–C5）：只登记标记上线的 C01–C10；先人卡无图；
// 「休」借用的 strong 图不上线；发布资产与设计稿逐字节一致；每个条目 A/B 变体齐全。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const map = JSON.parse(fs.readFileSync(path.join(ROOT, "data/card_art.json"), "utf8"));
const WEB = path.join(ROOT, "web/img/cardart");
const SRC = path.join(ROOT, "design/v5_cardart/assets");

test("card art map only ships C01–C10; the 休/strong borrow is not shipped", () => {
  const ids = Object.keys(map.cards);
  assert.deepEqual(ids, ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10"]);
  assert.ok(!("gf4-休" in map.cards), "设计稿 gf4-休（借 strong）不能上线");
  // 先人卡不属于当年 10 张事件卡，映射里不该有它的图
  assert.equal(map.cards.elder, undefined, "先人卡不能有卡面图");
});

test("every mapped art has m/d 1x/2x webp+png in the published tree, byte-identical to design", () => {
  const arts = new Set(Object.values(map.cards));
  for (const art of arts) {
    for (const v of ["m", "d"]) {
      for (const r of ["1x", "2x"]) {
        for (const ext of ["webp", "png"]) {
          const name = `${art}_${v}@${r}.${ext}`;
          const web = path.join(WEB, name);
          const src = path.join(SRC, name);
          assert.ok(fs.existsSync(web), `发布树缺 ${name}`);
          assert.ok(fs.existsSync(src), `设计稿缺 ${name}`);
          assert.ok(
            fs.readFileSync(web).equals(fs.readFileSync(src)),
            `${name} 与设计稿不一致（需逐字节一致）`,
          );
        }
      }
    }
  }
});

test("published card art directory has exactly the shipped set (no strays)", () => {
  const shipped = [];
  for (const art of new Set(Object.values(map.cards))) {
    for (const v of ["m", "d"]) for (const r of ["1x", "2x"]) for (const ext of ["webp", "png"]) {
      shipped.push(`${art}_${v}@${r}.${ext}`);
    }
  }
  shipped.sort();
  const actual = fs.readdirSync(WEB).sort();
  assert.deepEqual(actual, shipped, "web/img/cardart 只能有上线条目的文件");
});
