import type { EnemyDef } from '../core/types';
export const ENEMY_ORDER:EnemyDef[]=[
{id:'slime',name:'Slime',maxHp:30,baseAttack:4},
{id:'skeleton',name:'Skeleton',maxHp:45,baseAttack:6},
{id:'stoneguard',name:'StoneGuard',maxHp:70,baseAttack:7,traits:['stone_armor']},
{id:'thief',name:'Thief',maxHp:55,baseAttack:5,traits:['thief']},
{id:'cursemage',name:'CurseMage',maxHp:75,baseAttack:6,traits:['curse_mage']},
{id:'fatedealer',name:'FateDealer',maxHp:180,baseAttack:10,traits:['fate_boss']}
];
