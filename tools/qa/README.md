# gate-tools（测试交件门禁）

2026-10-14 盒子回退后重建。每次交测试报告前两个脚本都必须 exit 0，并把输出贴进交件消息。

## verdict_gate.py
    python3 verdict_gate.py <matrix.csv> <report.md>
- 矩阵：CSV（逗号或 `|` 分隔），必须有列 `判定`、`原因`、`证据路径`。
  判定取值：PASS / PARTIAL（也可写「部分验证」）/ FAIL / BLOCKED / N/A。
- 报告：第一行形如 `总结论: <值>`（也认 `结论:`、`**总结论**：`）。值归类为
  PASS（PASS/过门/通过）、PARTIAL（部分验证）、FAIL（不过门/FAIL）、BLOCKED。
- 输出：`格总数 N 分布 {...}`、`结论字段: ...`，然后 `OK`(exit 0) 或逐条 `VIOLATION:`(exit 1)。
- 规则：
  1. 有任何非 PASS 格（N/A 除外）→ 结论不得为 PASS/过门；
  2. 范围含 BLOCKED 或 N/A → 不得写成整体过门；
  3. 有 FAIL → 结论必须是不过门/FAIL；
  4. 非 PASS/N/A 的格必须填原因和证据路径；
  5. 判定值非法、缺列、找不到结论行均算违规。

## sticky_blocked.py
    python3 sticky_blocked.py <report.md> [--ledger BLOCKED_LEDGER.tsv]
- 默认读同目录 `BLOCKED_LEDGER.tsv`（列 `id\tstatus\tnote`）。
- 账上 status=BLOCKED 的 id，若在报告某行出现且该行写成 PASS/过门（不含「不过门/未通过」等否定），
  而报告里没有 `UNBLOCK:<id> <证据路径...>` 行 → 违规 exit 1。
- 通过时输出 `sticky_blocked: N 项在账, OK`（N=账本总条数）。
- 解阻：真机/设备证据到位后，在报告写 `UNBLOCK:<id> <paths>`，并把账本该行改为 UNBLOCKED。

## 账本现状
B-FERRY6-HOS BLOCKED（驿路鸿蒙渡口六关设备验证）；B-ANDBACK-B6 BLOCKED（Android Back B6 真机）；
B-ZAOZI-DEVICE UNBLOCKED。

## 自测
`selftest/` 下 11 个正反样例，结果见 `selftest/SELFTEST_RESULT.txt`。
