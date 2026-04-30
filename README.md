# 符文骰子 Rune Dice

竖屏手机优先的 2D 符文骰子 Roguelike，基于 TypeScript + Vite + Phaser 3。

## 架构边界

- 游戏本体是纯客户端游戏，核心运行代码位于 `src/game`。
- 客户端不依赖 `server`，不引入 Express、SQLite、`better-sqlite3` 或 Node 服务端模块。
- 存档默认使用浏览器本地存档。远程存档失败或未启动时，游戏仍然可以正常运行。
- `server` 只是 Web 部署时的可选远程存档服务，只提供 `/api/health` 和 `/api/saves/:slot`。
- Android App 和微信小游戏移植时可以不带 `server` 目录，也不需要安装服务端依赖。

## 本地运行客户端

```bash
npm install
npm run dev
npm run build
```

`npm run dev` 只启动 Vite 客户端。`npm run build` 只构建客户端。

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

如果 `VITE_SAVE_API_BASE` 为空，或者远程服务不可用，客户端继续使用本地存档。

## Docker 部署

Docker 镜像用于 Web 部署场景，会构建客户端并启动可选远程存档服务，容器监听 `9999`：

```bash
docker compose up -d --build
```

验证：

```bash
curl http://127.0.0.1:9999/
curl http://127.0.0.1:9999/api/health
```

`/api/health` 应返回 `{ "ok": true }`。SQLite 数据默认写入容器 `/data/rune-dice.sqlite`，`docker-compose.yml` 会把服务器目录挂载到 `/data`，重建容器不会丢失远程存档。

## 目录结构

- `src/game/core`：纯游戏规则、状态、随机、战斗、敌人 AI、奖励逻辑。
- `src/game/data`：符文、敌人、遗物、奖励配置。
- `src/game/save`：存档抽象、LocalStorage 存档、远程 API 存档、组合策略。
- `src/game/ui`：Phaser UI 组件。
- `src/game/scenes`：Phaser 场景。
- `src/game/platform`：平台能力抽象。
- `server`：可选远程存档服务，不包含游戏规则。

## 当前玩法

- 每场战斗开局自动掷 5 个符文骰。
- 可锁定骰子，重掷时只影响未锁定、未封印、未强制诅咒的骰子。
- 重掷会播放错峰滚动动画，期间按钮不可用。
- 敌人意图会先展示再执行；执行后才生成下一回合意图。
- 诅咒法师会让一个骰子在下一回合强制显示为诅咒。
- 命运庄家会封印一个骰子的下一回合重掷。
- 奖励包含生命、重掷次数、火焰精通、骰面改造和遗物。
- 骰面改造会进入目标骰子选择状态，再替换该骰子的一个面。

## 自动部署

`.github/workflows/deploy.yml` 会在 `main` 分支 push 后 SSH 到服务器执行 `scripts/deploy.sh`，并在服务器上运行：

```bash
docker compose up -d --build
```

部署服务器需要安装 Docker 和 Docker Compose v2，并开放公网端口 `9999`。
