# R号: R14（门内 15 格，PM T2）+ R15（太矮边界）。source 本文件即可；均可用环境变量覆盖（空格分隔 WxH）。
: "${VP_PHONE:=375x667 360x800 390x844 393x852 412x915 430x932 390x664}"
: "${VP_TABLET:=768x1024 820x1180 1024x768}"
: "${VP_DESK:=1280x720 1280x800 1366x768 1440x900 1920x1080}"
: "${VP_SHORT_MUST:=320x568 375x553 359x700 1280x599}"   # R15：必须出 #too-short
: "${VP_SHORT_RECORD:=360x640 1280x600}"               # PM T1/U4：不出提示，只记录（版式不崩不溢出）
: "${VP_QUICK_TOUCH:=375x667 360x800}"                 # --quick（PM T4）：触屏两格
: "${VP_QUICK_DESK:=1920x1080}"                        # --quick：桌面一格
export VP_PHONE VP_TABLET VP_DESK VP_SHORT_MUST VP_SHORT_RECORD VP_QUICK_TOUCH VP_QUICK_DESK
