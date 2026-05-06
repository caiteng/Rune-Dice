export type RuneType='fire'|'water'|'stone'|'thunder'|'gold'|'dark'|'wild'|'curse';
export type GamePhase='battle'|'reward'|'upgrade'|'victory'|'defeat';
export interface Die{faces:RuneType[];value:RuneType;locked:boolean;blocked:boolean;nextBlocked:boolean;nextForcedValue:RuneType|null;forced:boolean}
export interface PlayerState{maxHp:number;hp:number;armor:number;gold:number;rerollMax:number;rerollsLeft:number;relics:string[];runeBonus:Partial<Record<RuneType,number>>}
export interface EnemyDef{id:string;name:string;maxHp:number;baseAttack:number;traits?:string[]}
export interface EnemyState extends EnemyDef{hp:number;armor:number;turn:number;intent:string}
export interface Reward{id:string;name:string;desc:string;kind:'maxhp'|'reroll'|'fireup'|'dieface'|'relic';data?:{rune?:RuneType;relicId?:string}}
export interface PendingDieUpgrade{rune:RuneType}
export interface GameState{seed:number;phase:GamePhase;battleIndex:number;player:PlayerState;enemy:EnemyState|null;dice:Die[];log:string[];pendingRewards:Reward[];pendingDieUpgrade:PendingDieUpgrade|null}
