# Rune Dice 美术资源使用说明

本资源包用于当前 Phaser 竖屏版本。资源以独立 PNG 形式放在 `public/assets/` 下，由 `src/game/assets/RuneDiceAssets.ts` 统一维护 key 和路径映射。

## 目录约定

```text
public/assets/dice/*.png
public/assets/enemies/*.png
public/assets/effects/*.png
public/assets/ui/*.png
public/assets/original_sheets/*.png
public/assets/asset-manifest.json
```

当前资源类型：

- `dice/`：骰子底图、符文面、锁定 / 封印 / 选中状态图标。
- `enemies/`：敌人立绘和头像。
- `effects/`：结算特效和数字弹窗底板。
- `ui/`：面板、按钮、血条、护甲条、奖励卡框、小图标。
- `original_sheets/`：原始总图，供后续重新切图或人工校对。

## 加载方式

`PreloadScene` 使用 `ALL_IMAGE_ASSETS` 批量加载：

```ts
import { ALL_IMAGE_ASSETS } from '../assets/RuneDiceAssets';

ALL_IMAGE_ASSETS.forEach(([key, path]) => this.load.image(key, path));
```

新增资源时，优先在 `RuneDiceAssets.ts` 中追加 key 和路径，不要在场景里散落硬编码路径。

## 资源缺失策略

玩法代码不应因为某个美术 key 缺失而崩溃。场景层使用 `safeTexture(key, fallback)` 做兜底；如果指定 key 不存在，会回退到同类基础资源。

建议继续遵守：

- 敌人图缺失时回退到史莱姆资源或文字信息。
- 特效图缺失时回退到通用爆发效果。
- UI 皮肤缺失时保留 Phaser rectangle / text 方案。

## 槽位系统资源使用

当前槽位 UI 先使用 Phaser rectangle 实现，避免依赖尚未固定的槽位框资源 key。

后续如要替换为贴图，建议增加：

- `ui/slot_attack_frame.png`：攻击槽框，红色或攻击风格。
- `ui/slot_defense_frame.png`：防御槽框，蓝色或护甲风格。
- `ui/slot_tactic_frame.png`：战术槽框，紫色、金币或卡牌风格。

替换时保持槽位容量由逻辑控制：

- 攻击槽默认 2 格。
- 防御槽默认 2 格。
- 战术槽默认 1 格。

不要把容量写死在贴图尺寸里。

## 骰子资源

核心 key：

- `dice_common_body`：普通骰子底图。
- `dice_rare_body`：稀有 / 强化骰子底图。
- `dice_cursed_body`：诅咒骰子底图。
- `dice_boss_body`：特殊骰子底图。
- `rune_fire_face`
- `rune_water_face`
- `rune_stone_face`
- `rune_thunder_face`
- `rune_gold_face`
- `rune_dark_face`
- `rune_wild_face`
- `rune_curse_face`
- `state_locked_badge`：锁定或已分配标记。
- `state_sealed_badge`：封印标记。
- `state_empowered_badge`：强制诅咒等特殊状态标记。
- `state_selected_highlight`：选中高亮。

骰子分配后会显示“已分配”状态，并复用锁定徽章作为视觉提示。

## 敌人资源

敌人 key 映射在 `ENEMY_SPRITE_ASSET` 和 `ENEMY_PORTRAIT_ASSET` 中维护：

- 史莱姆：`enemy_slime_sprite` / `enemy_slime_portrait`
- 骷髅兵：`enemy_skeleton_sprite` / `enemy_skeleton_portrait`
- 石像守卫：`enemy_stone_guardian_sprite` / `enemy_stone_guardian_portrait`
- 小偷：`enemy_thief_sprite` / `enemy_thief_portrait`
- 诅咒法师：`enemy_curse_mage_sprite` / `enemy_curse_mage_portrait`
- 命运庄家：`enemy_fate_dealer_sprite` / `enemy_fate_dealer_portrait`

敌人数量目前不扩展，设计重点是让敌人意图推动玩家做槽位分配取舍。

## 特效资源

当前结算只做轻量 sprite flash / tween，不引入复杂特效架构。

常用 key：

- `effect_fire_burst`：火焰伤害和火系组合。
- `effect_lightning_strike`：雷电伤害和黑雷。
- `effect_stone_impact`：石、护甲、石像守卫。
- `effect_heal_burst`：治疗。
- `effect_coin_burst`：金币收益。
- `effect_dark_blast`：暗影伤害和暗能。
- `effect_rainbow_burst`：万能和彩虹天平。
- `effect_curse_cloud`：诅咒。
- `effect_shield_flare`：获得护甲。
- `effect_slash_impact`：敌人普通攻击。
- `effect_critical_starburst`：高收益组合提示。

## UI 资源

当前 UI 已使用：

- `panel_wide_boss`：顶部敌人区域。
- `panel_vertical_common`：玩家状态区域。
- `panel_large_reward`：奖励面板和首页面板。
- `button_primary_blue`：结算、确认类按钮。
- `button_secondary_green`：重掷、返回类按钮。
- `button_reward_purple`：奖励按钮。
- `button_danger_red`：关闭或危险操作。
- `bar_health_empty` / `bar_health_full`：生命条。
- `bar_armor_empty` / `bar_armor_full`：护甲条。
- `bar_energy_empty` / `bar_energy_full`：重掷次数条。

## 接入原则

1. 玩法优先。资源 key 不稳定时，先用 Phaser 基础图形兜底。
2. 所有新增 key 先进入 `RuneDiceAssets.ts`，再由场景引用。
3. 不要在核心逻辑层引用 Phaser 或资源 key。
4. 预览和结算规则只在 `SlotResolver` 中维护。
5. 后续如打 atlas，应保持现有 key 不变，减少场景层改动。
