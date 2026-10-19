# 星轨厨房 · React Native 原生版骨架（v0.1）

真原生路线：**业务逻辑跑在 Hermes JS 引擎（非 WebView），渲染走 @shopify/react-native-skia（Skia 原生绘制）**。
业务规则 100% 复用平台无关核心模块 `src/core/starchef-core.js`（与移动网页版同源，Node 测试 15/15 通过）。

## 目录

```
mobile-native/
├── App.js                 # 界面层：菜单/对局/图鉴/排行榜/胜利与崩溃弹窗
├── index.js / app.json / babel.config.js / metro.config.js / package.json
└── src/
    ├── core/starchef-core.js   # 平台无关核心（数据+规则+纯函数，UMD）
    └── game/
        ├── engine.js           # 游戏引擎（状态机+动作+tick，框架无关，Node 已冒烟验证）
        └── GameCanvas.js       # Skia 渲染层（基础图元：圆/矩形/组）
```

## 如何跑起来（需要你本机执行）

骨架未在本环境做过真机/模拟器验证（无 Android SDK / Xcode），以下步骤在你机器上完成：

```bash
# 1. 用 RN 官方模板初始化原生工程（提供 android/ ios/ 目录）
npx @react-native-community/cli@latest init StarChef --version 0.76.5

# 2. 把本目录的 App.js、index.js、app.json、babel.config.js、metro.config.js
#    覆盖进新工程根目录，src/ 整个拷过去

# 3. 安装依赖
cd StarChef
npm i @shopify/react-native-skia@^1.8 @react-native-async-storage/async-storage@^2

# 4. 运行（Android 需已装 Android Studio/SDK；iOS 需 Mac + Xcode，并 pod install）
npm run android     # 或 npm run ios
```

> 注意：`package.json` 里预置了依赖版本供参考；init 生成的工程自带匹配的 react/react-native 版本，以它为准。

## 已实现 / 待补

已实现：10 关三章关卡与全部核心规则（合成外迁/交付/共振/三星/崩溃/弃置/滑移/陨石/超新星/脉冲星/黑洞终章/冰封）、
候选池、订单星座条、图鉴解锁、本地排行榜与署名（AsyncStorage）、暂停、胜利/崩溃结算。

待补（下版）：音频（建议 expo-av 或 react-native-sound）、粒子与浮动文字特效、
战绩海报（可用 react-native-view-shot 或 Skia 离屏导出）、轻量教练教程、色弱/减动效模式。

## 架构说明（答辩可讲）

- 分层：`core（纯逻辑，无平台依赖）→ engine（状态机，框架无关）→ UI（RN+Skia）`；
- 同一份 core 同时驱动移动网页版（`mobile/星轨厨房MOBILE.html`）与本原生版，逻辑零重复；
- core 的 Node 测试（`mobile/core/core.test.js`）在任何平台跑同一套规则回归。
