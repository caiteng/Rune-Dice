import { makeDice } from './Dice';
import { ENEMY_ORDER } from '../data/enemies';
import type { GameState } from './types';
export function createState(seed:number):GameState{return{seed,phase:'battle',battleIndex:0,player:{maxHp:40,hp:40,armor:0,gold:0,rerollMax:2,rerollsLeft:2,relics:[],runeBonus:{},firstRerollFreeUsed:false},enemy:{...ENEMY_ORDER[0],hp:ENEMY_ORDER[0].maxHp,armor:0,turn:1,intent:`Attack ${ENEMY_ORDER[0].baseAttack}`},dice:makeDice(5),log:['Battle start'],pendingRewards:[]}}
