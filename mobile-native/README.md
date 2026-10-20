# 星轨厨房 · React Native + Skia 原生版（已在本机编译出 APK）

真原生路线：业务逻辑跑在 Hermes JS 引擎（非 WebView），渲染走 @shopify/react-native-skia。
业务规则 100% 复用平台无关核心 `src/core/starchef-core.js`（Node 测试 15 项全绿）。

**2026-10-20 实测状态（本机 Pixel 9 Pro API36 模拟器）**：
✅ Gradle 编译通过、`app-release.apk`（86MB，自带 JS，免 Metro）安装后独立启动，RN 原生 UI（菜单/顶栏/候选池/弹窗）渲染正常；
✅ 触摸→引擎事件链验证通过（点击候选、点击槽位投放均有事件落地）；
⚠️ **Skia 画布在模拟器上无像素输出**（连单个纯色 Fill 都不显示；swiftshader 后端直接 SIGSEGV、ANGLE 后端静默失败）——判定为模拟器图形栈问题而非代码问题，**待真机 GPU 验证**。

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
