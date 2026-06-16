# 符文骰子 Rune Dice

竖屏手机优先的 2D 符文骰子 Roguelike，基于 TypeScript + Vite + Phaser 3。

## 核心玩法

每回合敌人会先展示意图，玩家掷出 5 个骰子。玩家可以锁定骰子并重掷；重掷结束后，必须把 5 个骰子全部分配到 3 个战斗槽位后才能结算：

- 攻击槽：最多 2 个骰子，负责伤害、爆发和削甲组合。
- 防御槽：最多 2 个骰子，负责护甲、治疗、反击和自伤抵消。
- 战术槽：最多 1 个骰子，负责金币、下回合护甲、下回合额外重掷、暗能和净化。

交互采用移动端友好的点击分配：

1. 点击一个未分配骰子进入选中状态。
2. 点击攻击 / 防御 / 战术槽，把骰子放入槽位。
3. 点击槽位中的骰子，可以把它移回骰子区。
4. 已分配骰子默认视为锁定，不参与重掷。
5. 结算按钮只有在 5 个骰子全部分配后才可用。

## 槽位结算

槽位预览和最终结算共用 `src/game/core/SlotResolver.ts`，避免 UI 显示和实际结果不一致。

攻击槽支持双火、双雷、火 + 雷、火 + 暗、雷 + 暗、双暗等组合。防御槽支持双石、双水、水 + 石、石 + 金、水 + 暗等组合。战术槽提供长期收益和特殊操作，例如金骰获得金币、雷骰让下回合额外重掷、石骰让下回合获得护甲、暗骰获得暗能。

遗物已经改为围绕槽位生效：

- 火焰王冠：攻击槽中火不少于 2 个时，额外造成 12 伤害。
- 石像面具：防御槽本回合获得护甲不少于 12 时，反击 6 伤害。
- 金杯：战术槽放入金时，额外获得 6 金币。
- 血契：攻击槽中的暗伤害 +50%，但自伤 +1。
- 彩虹天平：三个槽位中出现 5 种不同非诅咒符文时，所有收益 +30%。
- 幸运护符：每回合最大重掷次数 +1。

## 奖励系统

战斗胜利后提供三选一奖励，奖励会去重。当前 MVP 奖励包括：

- 攻击训练：攻击槽中的火 / 雷 / 暗伤害 +1。
- 防御训练：防御槽中的石 / 水效果 +1。
- 战术训练：战术槽中的金收益 +2。
- 骰面改造：选择一个骰子，把第一个面改造成指定符文。
- 遗物：获得一个尚未拥有的遗物。
- 重掷次数 +1：提高每回合最大重掷次数。

槽位容量强化暂未开放，避免本阶段扩大 UI 改动。

## 架构边界

- 游戏本体是纯客户端，核心运行代码位于 `src/game`。
- 客户端不依赖 `server`，不需要启动 Express、SQLite 或 Node 服务端也能游玩。
- 存档默认使用浏览器本地存档。远程存档失败或服务端未启动时，游戏继续使用本地存档。
- `server` 只是 Web 部署时的可选远程存档服务，提供 `/api/health` 和 `/api/saves/:slot`。
- Android App 和微信小游戏移植时可以不携带 `server` 目录。

## 本地运行客户端

```bash
npm install
npm run dev
```

`npm run dev` 只启动 Vite 客户端。默认地址通常是：

```text
http://127.0.0.1:5173
```

## 构建客户端

```bash
npm run build
```

`npm start` 等价于 `npm run preview`，用于预览已构建的客户端，不会默认启动远程存档服务。

## 可选远程存档服务

服务端依赖只在 `server/package.json` 中维护。

```bash
npm run save-server:install
npm run save-server:start
```

也可以直接运行：

```bash
cd server
npm install
npm start
```

远程 API 默认同源 `/api`。客户端可通过 Vite 环境变量覆盖：

```bash
VITE_SAVE_API_BASE=/api npm run dev
```

如果 `VITE_SAVE_API_BASE` 为空，或远程服务不可用，客户端继续使用本地存档。

## Docker 部署

Docker 镜像用于 Web 部署场景，会构建客户端并启动可选远程存档服务，容器监听 `9999`。

```bash
docker compose up -d --build
```

验证：

```bash
curl http://127.0.0.1:9999/
curl http://127.0.0.1:9999/api/health
```

`/api/health` 应返回 `{ "ok": true }`。SQLite 数据默认写入容器 `/data/rune-dice.sqlite`，`docker-compose.yml` 会把服务端目录挂载到 `/data`。

## 目录结构

- `src/game/core`：纯玩法规则、状态、随机、敌人 AI、槽位解析、奖励逻辑。
- `src/game/data`：符文、敌人、遗物配置。
- `src/game/save`：存档抽象、LocalStorage 存档、远程 API 存档和兼容迁移。
- `src/game/ui`：Phaser UI 组件。
- `src/game/scenes`：Phaser 场景。
- `src/game/assets`：美术资源 key 和路径映射。
- `src/game/platform`：平台能力抽象。
- `server`：可选远程存档服务，不包含游戏规则。

## 存档兼容

旧存档没有 `slots`、`selectedDieIndex`、`slotBonus`、`darkEnergy` 等字段时，会在读取时补默认值并输出 `console.warn`，不会白屏。

## 当前限制

- 暗能已记录到 `player.darkEnergy`，但后续暗流强化系统尚未展开。
- 战术槽水符文会净化一个负面骰子；没有负面状态时转为治疗。
- 目前没有自动分配，玩家必须手动分配 5 个骰子。
- 槽位容量强化奖励暂未开放。
