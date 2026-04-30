import type { Die } from './types';
import { Random } from './Random';
export const rollAll=(dice:Die[],rng:Random)=>dice.forEach(d=>{if(!d.locked&&!d.blocked&&!d.forced)d.value=rng.pick(d.faces)});
export const toggleLock=(die:Die)=>{if(!die.blocked&&!die.forced)die.locked=!die.locked};
export const reroll=(dice:Die[],rng:Random)=>rollAll(dice,rng);
export const resetDiceTurn=(dice:Die[])=>dice.forEach(d=>{d.locked=false;d.blocked=d.nextBlocked;d.forced=d.nextForcedValue!==null;if(d.nextForcedValue)d.value=d.nextForcedValue;d.nextBlocked=false;d.nextForcedValue=null;});
