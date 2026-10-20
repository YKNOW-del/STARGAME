# 星轨厨房 · React Native + Skia 原生版（已在本机编译出 APK）

真原生路线：业务逻辑跑在 Hermes JS 引擎（非 WebView），渲染走 @shopify/react-native-skia。
业务规则 100% 复用平台无关核心 `src/core/starchef-core.js`（Node 测试 15 项全绿）。

**2026-10-20 实测状态（本机 Pixel 9 Pro API36 模拟器，release 版免 Metro 终验通过）**：
✅ `app-release.apk`（88MB）安装独立启动，RN 原生 UI 正常；
✅ **棋盘画布完整渲染并通过视觉闭环**：太阳/星云/星点/轨道/槽位均命中预期坐标，点击槽位后天体精准出现；
✅ 触摸→引擎事件链全通。

**渲染黑屏问题的根因与修复（重要）**：Skia 1.12.4 × RN 0.76 组合下画布零输出（模拟器与真机复现一致）；两处修正后解决：
1. 降级 `@shopify/react-native-skia` 至 **1.7.5**（与 RN 0.76 同期版本，需 exact 锁定）；
2. **Canvas 绘制坐标处于 dp 空间**（框架自动按像素密度放大），且 `<Group transform>` 在该组合下不可靠——渲染层改为在 JS 里显式计算缩放与偏移（X/Y/R 辅助函数），触摸用 dp 坐标直接映射，不走 Group 变换。

## 本机可复现构建（已验证的完整路径）

```bash
# 0) 工程必须放在纯 ASCII 路径（AGP 拒绝中文路径），例如 D:\StarChefBuild\StarChef
# 1) 环境（本机实际值）：
#    JAVA_HOME = D:\APP\AS\jbr（Android Studio 自带 JDK21）
#    ANDROID SDK = D:\WORK\sdk（platform-tools、platforms;android-34/35、build-tools;34/35.0.0）
#    node 在 D:\nodejs；npm 已配 npmmirror 镜像
#    gradle 分发已换腾讯镜像（android/gradle/wrapper/gradle-wrapper.properties）
# 2) 依赖
npm install
# 3) Debug（连模拟器/真机 + Metro）
npx react-native run-android
# 4) Release APK（自带 JS，debug 签名，可直接侧载）
cd android && gradlew.bat assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

已知工程要点：`android/local.properties`（含本机 SDK 路径）不入库，克隆后需自建：`sdk.dir=D:/WORK/sdk`；
模拟器无头启动参考：`emulator -avd Pixel_9_Pro -no-window -gpu angle_indirect -skin 1080x2340`（swiftshader 会崩 Skia）。

## 待办（真机验证后）

- 真机确认 Skia 画布渲染（预期正常——模拟器 ANGLE/swiftshader 呈现缺陷）
- 补音频（expo-av）、粒子特效、教练教程、战绩海报、色弱/减动效
- Skia `mode="continuous"` 为 deprecated（v1.12 仍生效）——若真机声明式重绘正常可移除
