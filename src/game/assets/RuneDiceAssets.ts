import type { RuneType } from '../core/types';

export const DICE_ASSETS = [
  'rune_fire_face',
  'rune_water_face',
  'rune_stone_face',
  'rune_thunder_face',
  'rune_gold_face',
  'rune_dark_face',
  'rune_wild_face',
  'rune_curse_face',
  'dice_common_body',
  'dice_rare_body',
  'dice_cursed_body',
  'dice_boss_body',
  'state_locked_badge',
  'state_sealed_badge',
  'state_empowered_badge',
  'state_selected_highlight',
  'icon_reroll',
  'icon_health',
  'icon_armor',
  'icon_gold',
] as const;

export const ENEMY_ASSETS = [
  'enemy_slime_sprite',
  'enemy_slime_portrait',
  'enemy_skeleton_sprite',
  'enemy_skeleton_portrait',
  'enemy_stone_guardian_sprite',
  'enemy_stone_guardian_portrait',
  'enemy_thief_sprite',
  'enemy_thief_portrait',
  'enemy_curse_mage_sprite',
  'enemy_curse_mage_portrait',
  'enemy_fate_dealer_sprite',
  'enemy_fate_dealer_portrait',
] as const;

export const EFFECT_ASSETS = [
  'effect_fire_burst',
  'effect_lightning_strike',
  'effect_stone_impact',
  'effect_heal_burst',
  'effect_coin_burst',
  'effect_dark_blast',
  'effect_rainbow_burst',
  'effect_curse_cloud',
  'effect_shield_flare',
  'effect_slash_impact',
  'effect_critical_starburst',
  'effect_reroll_swirl',
  'popup_red_frame',
  'popup_blue_frame',
  'popup_green_frame',
  'popup_gold_frame',
] as const;

export const UI_ASSETS = [
  'panel_vertical_common',
  'panel_large_reward',
  'panel_narrow_curse',
  'panel_wide_boss',
  'button_primary_blue',
  'button_secondary_green',
  'button_reward_purple',
  'button_danger_red',
  'bar_health_empty',
  'bar_health_full',
  'bar_armor_empty',
  'bar_armor_full',
  'bar_energy_empty',
  'bar_energy_full',
  'tab_common',
  'tab_dark',
  'tab_gold',
  'tab_danger',
  'card_common_frame',
  'card_curse_frame',
  'card_gold_frame',
  'card_danger_frame',
  'mini_attack_icon',
  'mini_defense_icon',
  'mini_heal_icon',
  'mini_gold_icon',
  'mini_reroll_icon',
  'mini_relic_icon',
  'divider_gold',
  'divider_dark',
  'marker_blue',
  'marker_gold',
] as const;

export const SHEET_ASSETS = [
  'dice_sheet',
  'enemies_sheet',
  'effects_sheet',
  'ui_sheet',
] as const;

export const ALL_IMAGE_ASSETS = [
  ...DICE_ASSETS.map((key) => [key, `/assets/dice/${key}.png`] as const),
  ...ENEMY_ASSETS.map((key) => [key, `/assets/enemies/${key}.png`] as const),
  ...EFFECT_ASSETS.map((key) => [key, `/assets/effects/${key}.png`] as const),
  ...UI_ASSETS.map((key) => [key, `/assets/ui/${key}.png`] as const),
  ...SHEET_ASSETS.map((key) => [key, `/assets/original_sheets/${key}.png`] as const),
] as const;

export const RUNE_FACE_ASSET: Record<RuneType, string> = {
  fire: 'rune_fire_face',
  water: 'rune_water_face',
  stone: 'rune_stone_face',
  thunder: 'rune_thunder_face',
  gold: 'rune_gold_face',
  dark: 'rune_dark_face',
  wild: 'rune_wild_face',
  curse: 'rune_curse_face',
};

export const RUNE_EFFECT_ASSET: Record<RuneType, string> = {
  fire: 'effect_fire_burst',
  water: 'effect_heal_burst',
  stone: 'effect_stone_impact',
  thunder: 'effect_lightning_strike',
  gold: 'effect_coin_burst',
  dark: 'effect_dark_blast',
  wild: 'effect_rainbow_burst',
  curse: 'effect_curse_cloud',
};

export const ENEMY_SPRITE_ASSET: Record<string, string> = {
  slime: 'enemy_slime_sprite',
  skeleton: 'enemy_skeleton_sprite',
  stoneguard: 'enemy_stone_guardian_sprite',
  thief: 'enemy_thief_sprite',
  cursemage: 'enemy_curse_mage_sprite',
  fatedealer: 'enemy_fate_dealer_sprite',
};

export const ENEMY_PORTRAIT_ASSET: Record<string, string> = {
  slime: 'enemy_slime_portrait',
  skeleton: 'enemy_skeleton_portrait',
  stoneguard: 'enemy_stone_guardian_portrait',
  thief: 'enemy_thief_portrait',
  cursemage: 'enemy_curse_mage_portrait',
  fatedealer: 'enemy_fate_dealer_portrait',
};
