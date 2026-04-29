# Rune Dice (MVP)

竖屏手机优先的 2D 符文骰子 Roguelike Web 游戏，基于 TypeScript + Vite + Phaser 3。

## 安装与运行
```bash
npm install
npm run dev
npm run build
```

> 当前环境对 npm registry 返回 403，可能无法实际安装依赖；代码结构和脚本已就绪。

## 目录结构
- `src/game/core`: 核心规则、状态、随机、战斗、敌人AI、奖励。
- `src/game/data`: 符文/敌人/遗物/奖励配置。
- `src/game/ui`: Canvas UI 组件与布局。
- `src/game/scenes`: Phaser 场景（Boot/Preload/Battle）。
- `src/game/platform`: 平台抽象与 Web 实现。

## 当前玩法
- 每回合自动投掷 5 个骰子。
- 可锁定骰子并在重掷时保留。
- 每回合有重掷次数，重掷仅影响未锁定且未被阻断骰子。
- 点击结算后触发符文组合：伤害/治疗/护甲/金币/暗系自伤。
- 敌人按意图行动；玩家死亡失败。
- 敌人死亡后进入三选一奖励，再进入下一战。
- 通过最终 Boss 后显示胜利。

## 移植架构注意事项
- 游戏 UI 基于 Phaser Canvas 渲染，避免 DOM 依赖。
- 核心逻辑与 Scene 分离，便于迁移到不同运行壳。
- 随机数统一通过 `Random`，便于复现和回放。
- 平台能力通过 `Platform` 抽象，后续可扩展 `AndroidPlatform`/`WechatPlatform`。
- 存储/振动/屏幕信息统一走平台层，避免核心直接依赖 `window`。
