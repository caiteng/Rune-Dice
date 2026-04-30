# Rune Dice (MVP)

竖屏手机优先的 2D 符文骰子 Roguelike Web 游戏，基于 TypeScript + Vite + Phaser 3。

## 安装与运行
```bash
npm install
npm run dev
npm run build
cd server && npm install && cd ..
npm start
```

> 当前环境对 npm registry 返回 403，可能无法实际安装依赖；代码结构和脚本已就绪。

## Docker 部署
容器内服务监听 `9999`，同时托管前端静态文件和 `/api` 接口：

```bash
docker compose up -d
```

后续存档走服务端 SQLite，数据文件默认放在容器内 `/data/rune-dice.sqlite`。`docker-compose.yml` 已把服务器目录 `/opt/rune-dice/data` 挂到容器 `/data`，重建容器不会丢存档。

服务端依赖单独放在 `server/package.json`，根目录 `package.json` 只保留客户端游戏依赖。这样后续打包安卓应用或微信小游戏时，可以只复用 `src/game` 和 Vite 客户端构建，不会把 Express/SQLite native 依赖带进移动端包。

## GitHub Actions 自动部署
`.github/workflows/deploy.yml` 会在 `main` 分支 push 后：

1. SSH 到服务器。
2. 进入服务器项目目录 `/opt/rune-dice/app`。
3. 执行 `scripts/deploy.sh`。
4. 在服务器上拉取最新 `main` 并执行 `docker compose up -d --build`。

GitHub 仓库需要配置这些 Actions Secrets：

- `DEPLOY_HOST`: 服务器 IP 或域名。
- `DEPLOY_USER`: SSH 用户名，需能执行 `docker`。
- `DEPLOY_SSH_KEY`: 对应服务器公钥的私钥内容。
- `DEPLOY_PORT`: SSH 端口；不填时默认 `22`。

服务器需要提前准备：

- 安装 Docker 和 Docker Compose v2，或执行 `scripts/server-init.sh` 自动安装。
- 开放公网端口 `9999`。
- 创建部署用户并加入 docker 组，或确保该用户能直接运行 `docker compose`。
- 把 `DEPLOY_SSH_KEY` 对应的公钥加入该用户的 `~/.ssh/authorized_keys`。
- 首次初始化示例：

```bash
REPO_URL='https://github.com/caiteng/Rune-Dice.git' APP_DIR='/opt/rune-dice/app' bash scripts/server-init.sh
```

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
