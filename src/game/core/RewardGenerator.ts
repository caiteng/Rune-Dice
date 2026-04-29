import type { Reward, GameState } from './types';
import { Random } from './Random';
import { RELICS } from '../data/relics';
export function generateRewards(state:GameState,rng:Random):Reward[]{const arr:Reward[]=[{id:'maxhp',name:'+8 Max HP',desc:'Increase max hp',kind:'maxhp'},{id:'reroll',name:'+1 Reroll',desc:'Increase reroll max',kind:'reroll'},{id:'fireup',name:'Fire Mastery',desc:'Fire damage +1 each',kind:'fireup'},{id:'dieface',name:'Die Upgrade',desc:'replace one die face to fire',kind:'dieface'},{id:'relic',name:rng.pick(RELICS).name,desc:'Gain relic',kind:'relic'}]; return [rng.pick(arr),rng.pick(arr),rng.pick(arr)];}
export function applyReward(state:GameState,r:Reward){if(r.kind==='maxhp'){state.player.maxHp+=8;state.player.hp+=8;} if(r.kind==='reroll')state.player.rerollMax++; if(r.kind==='fireup')state.player.runeBonus.fire=(state.player.runeBonus.fire||0)+1; if(r.kind==='dieface')state.dice[0].faces[0]='fire'; if(r.kind==='relic')state.player.relics.push(r.name);}
