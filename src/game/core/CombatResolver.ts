import type { EnemyState, PlayerState, RuneType } from './types';
export function resolveRunes(runes:RuneType[],player:PlayerState,enemy:EnemyState,log:(s:string)=>void){
 const c=(r:RuneType)=>runes.filter(x=>x===r).length;
 let damage=0,heal=0,armor=0,gold=0,self=0;
 const fire=c('fire'); damage+=[0,3,8,18,40,100][fire]||0; damage+=fire*(player.runeBonus.fire||0);
 const water=c('water'); heal+=water*2+(water>=2?3:0);
 const stone=c('stone'); armor+=stone*3+(stone>=3?8:0);
 const thunder=c('thunder'); damage+=thunder*4+(thunder>=3?6:0);
 const g=c('gold'); gold+=g*2+(g>=3?8:0);
 const dark=c('dark'); damage+=dark*8+(dark>=3?20:0); self+=dark;
 if(new Set(runes.filter(r=>r!=='curse')).size>=5){damage+=20;heal+=5;armor+=5;gold+=5;if(player.relics.includes('RainbowScale')){damage+=20;heal+=5;armor+=5;gold+=5;}}
 if(player.relics.includes('FlameCrown')&&fire>=3)damage+=10;
 if(player.relics.includes('GoldCup'))gold+=g;
 if(player.relics.includes('BloodContract')){damage+=Math.floor(dark*8*0.5);self+=dark;}
 if(enemy.id==='firespirit') damage=Math.floor(damage*0.7);
 player.hp=Math.min(player.maxHp,player.hp+heal)-self; player.armor+=armor; player.gold+=gold;
 let d=Math.max(0,damage-enemy.armor); enemy.armor=Math.max(0,enemy.armor-damage); enemy.hp-=d;
 if(player.relics.includes('StoneMask')&&armor>=10){enemy.hp-=4;log('StoneMask reflects 4.');}
 log(`Resolve dmg:${d} heal:${heal} armor:+${armor} gold:+${gold} self:${self}`);
}
