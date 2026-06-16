# 猫猫守夜

竖屏手机优先的纯 Web 幸存者小游戏，基于 TypeScript + Vite + Phaser 3。玩法方向接近吸血鬼幸存者：玩家移动走位，武器自动攻击，怪物持续围攻，拾取经验后升级三选一。

## 当前玩法

- 下半屏浮动摇杆移动，桌面端也支持 WASD / 方向键。
- 人物保持在屏幕中央，地图和敌人相对角色移动，贴近幸存者类的基础视角。
- 武器机制贴近经典幸存者模板：魔杖自动打最近敌人、飞刀朝移动方向连射、大蒜式近身领域、圣经式环绕物。
- 敌人从屏幕外持续生成，随时间提升密度、速度和血量。
- 精英怪每 60 秒出现一次，必定掉落宝箱。
- 宝箱会随机强化已拥有武器，有小概率触发三连或五连强化。
- 经验满后暂停战斗，出现升级三选一。
- 目标是在 10 分钟内坚持到天亮。
- 首页右下角显示当前部署版本短号。

## 技术结构

- `src/game/SurvivorGame.ts`：当前幸存者玩法主实现。
- `src/main.ts`：Web 入口。
- `server`：可选远程存档/健康检查服务，部署时用于托管构建后的客户端。
- `.github/workflows/deploy.yml`：推送 `main` 后自动 SSH 到服务器部署。
- `scripts/deploy.sh`：服务器侧拉取 `origin/main` 并执行 Docker 构建发布。

旧的符文骰子代码仍保留在 `src/game` 的部分文件中，但当前入口不再引用它们。

## 本地运行客户端

```bash
npm install
npm run dev
```

默认地址通常是：

```text
http://127.0.0.1:5173
```

## 构建

```bash
npm run build
```

## Docker 部署

Docker 镜像会构建客户端并启动 Node 服务，容器监听 `9999`。

```bash
docker compose up -d --build
```

验证：

```bash
curl http://127.0.0.1:9999/
curl http://127.0.0.1:9999/api/health
```

## 自动部署

推送到 `main` 会触发 GitHub Actions。服务器目录默认是：

```text
/opt/rune-dice/app
```

workflow 会在目录缺失时先 clone 仓库，然后执行：

```bash
bash ./scripts/deploy.sh
```
