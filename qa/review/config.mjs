// Engineering Review Checklist Configuration
// Centralizes viewports, selectors, thresholds, exclusions, and rule numbers

export const VIEWPORTS = [
  // 15 in-gate sizes per R14/T2
  // Phones (7)
  { name: "375x667", width: 375, height: 667, category: "phone", hasTouch: true, isMobile: true },
  { name: "360x800", width: 360, height: 800, category: "phone", hasTouch: true, isMobile: true },
  { name: "390x844", width: 390, height: 844, category: "phone", hasTouch: true, isMobile: true },
  { name: "393x852", width: 393, height: 852, category: "phone", hasTouch: true, isMobile: true },
  { name: "412x915", width: 412, height: 915, category: "phone", hasTouch: true, isMobile: true },
  { name: "430x932", width: 430, height: 932, category: "phone", hasTouch: true, isMobile: true },
  { name: "390x664", width: 390, height: 664, category: "phone", hasTouch: true, isMobile: true },
  // Tablets (3)
  { name: "768x1024", width: 768, height: 1024, category: "tablet", hasTouch: true, isMobile: true },
  { name: "820x1180", width: 820, height: 1180, category: "tablet", hasTouch: true, isMobile: true },
  { name: "1024x768", width: 1024, height: 768, category: "tablet", hasTouch: true, isMobile: true },
  // Desktops (5)
  { name: "1280x720", width: 1280, height: 720, category: "desktop", hasTouch: false, isMobile: false },
  { name: "1280x800", width: 1280, height: 800, category: "desktop", hasTouch: false, isMobile: false },
  { name: "1366x768", width: 1366, height: 768, category: "desktop", hasTouch: false, isMobile: false },
  { name: "1440x900", width: 1440, height: 900, category: "desktop", hasTouch: false, isMobile: false },
  { name: "1920x1080", width: 1920, height: 1080, category: "desktop", hasTouch: false, isMobile: false },
  // Record-only size (rule R14 / PM U4)
  { name: "360x640", width: 360, height: 640, category: "phone", hasTouch: true, isMobile: true, recordOnly: true },
];

export const QUICK_SIZES = ["375x667", "360x800", "1920x1080"];

export const DEFAULT_ENGINES = ["chromium", "firefox", "webkit"];

export const EXCLUDE_SELECTORS = ["script", "style", "noscript"];

export const UI_BORDERS = ["#opt-left", "#opt-right"];

export const DESKTOP_BODY_SELECTORS = ["#card-text", "#coach", "#opt-left", "#opt-right"];

export const CONTAINER_SELECTORS = [
  "#card",
  "button",
  ".opt",
  "#wordbox",
  "#coach",
  "#toast",
  "dialog",
  "#menu-pop",
  "#keyhelp-pop",
];

export const TARGETS_PER_STATE = {
  T01: ["#opt-left", "#opt-right", "#card", "#menubtn"],
  T02: ["#opt-left", "#opt-right", "#card", "#menubtn"],
  T03engrave: ["#bonecorner", '[data-do="skip"]', "#menubtn"],
  menu: ["#menu-pop [data-menu]"],
};

export const MIN_44_TARGETS = [
  "#opt-left",
  "#opt-right",
  "#bonecorner",
  '[data-do="skip"]',
  "#menubtn",
];

export const THRESHOLDS = {
  contrastNormal: 4.5,
  contrastLarge: 3.0,
  contrastBorder: 3.0,
  largeTextFontSize: 24.0,
  largeTextBoldFontSize: 18.66,
  largeTextBoldWeight: 700,
  fontSizeMin: 13.0,
  fontSizeDesktopBody: 14.0,
  targetMinSize: 44.0,
  minVisibilityOpacity: 0.05,
  requiredOptionOpacity: 1.0,
  boundsTolerancePx: 1.0,
  contrastTolerance: 0, // WCAG 判据不放宽
  desktopCardMaxW: 448, // R18 电脑卡片上限
  desktopCardMaxH: 640,
  fontSizeTolerance: 0.01, // 只吸收浮点误差
};

export const RULE_MAP = {
  C1: {
    id: "C1",
    name: "对比度",
    rule: "R16",
    desc: "正文≥4.5、大字≥3、选项边框≥3、选项不透明",
    output: "ui_gate.md",
  },
  C2: {
    id: "C2",
    name: "字号",
    rule: "R16",
    desc: "≥13px，电脑正文≥14px",
    output: "ui_gate.md",
  },
  C3: {
    id: "C3",
    name: "溢出与目标门禁",
    rule: "R12/R13/R17/R18",
    desc: "文字框 rect ⊂ 容器 rect 容差 1px、提示目标在视口内可见可点、核心入口≥44",
    output: "ui_gate.md",
  },
  C4: {
    id: "C4",
    name: "代码规范与运行错误",
    rule: "R20",
    desc: "只一个 inputBusy、无重复顶层 function、无 SyntaxError/pageerror/控制台报错",
    output: "static_check.md, ui_gate.md",
  },
  C5: {
    id: "C5",
    name: "送审与模型规范",
    rule: "R24 + 审核规则「CLI/模型」行",
    desc: "cc 须写原因、碰图片禁 glm-5.3",
    output: "cli_model.md",
  },
  C6: {
    id: "C6",
    name: "数据安全",
    rule: "数据安全（PR9 D4/B5）",
    desc: "render 报错不丢档、损坏存档可恢复、包含对应 e2e",
    output: "data_safety.md",
  },
};
