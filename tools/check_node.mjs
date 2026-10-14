// Node 版本预检：package.json 的 engines 要求 >=22。
// 本项目用到 Node 22 才有的 node:module stripTypeScriptTypes（tests/helpers/load_engine.mjs、
// tools/build_dist.mjs、tests 都靠它剥 TS 类型），Node 太老会在测试中途报
// 「stripTypeScriptTypes is not a function」这种看不懂的错。
// npm test / npm run e2e 通过 pretest / pree2e 先跑这里：版本不够就立刻退出，给一句明白话。
const REQUIRED_MAJOR = 22;
const current = process.versions.node;
const major = Number(current.split(".")[0]);
if (!Number.isInteger(major) || major < REQUIRED_MAJOR) {
  console.error(
    `\n[需要 Node >= ${REQUIRED_MAJOR}] 当前是 v${current}。\n` +
      `本项目用到 Node ${REQUIRED_MAJOR} 的 stripTypeScriptTypes 等能力，` +
      `请换用 Node ${REQUIRED_MAJOR} 或更高版本再跑 npm test / npm run e2e。\n` +
      `（例：nvm use ${REQUIRED_MAJOR}，或用装了 Node ${REQUIRED_MAJOR}+ 的 node 直接运行。）\n`,
  );
  process.exit(1);
}
