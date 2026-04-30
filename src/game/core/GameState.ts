import { makeDice } from './Dice';
import { ENEMY_ORDER } from '../data/enemies';
import type { GameState } from './types';
import { enemyIntent } from './EnemyAI';
export function createEnemy(index:number){const def=ENEMY_ORDER[index];return{...def,hp:def.maxHp,armor:0,turn:1,intent:enemyIntent({...def,hp:def.maxHp,armor:0,turn:1,intent:''})};}
export function createState(seed:number):GameState{return{seed,phase:'battle',battleIndex:0,player:{maxHp:40,hp:40,armor:0,gold:0,rerollMax:2,rerollsLeft:2,relics:[],runeBonus:{},firstRerollFreeUsed:false},enemy:createEnemy(0),dice:makeDice(5),log:['战斗开始'],pendingRewards:[],pendingDieUpgrade:null}}
