import type { Die } from './types';
import { Random } from './Random';

export const rollAll = (dice: Die[], rng: Random, canRoll: (index: number, die: Die) => boolean = (_index, die) => !die.locked && !die.blocked && !die.forced) => {
  dice.forEach((die, index) => {
    if (canRoll(index, die)) die.value = rng.pick(die.faces);
  });
};

export const toggleLock = (die: Die) => {
  if (!die.blocked && !die.forced) die.locked = !die.locked;
};

export const reroll = (dice: Die[], rng: Random) => rollAll(dice, rng);

export const resetDiceTurn = (dice: Die[]) => dice.forEach((die) => {
  die.locked = false;
  die.blocked = die.nextBlocked;
  die.forced = die.nextForcedValue !== null;
  if (die.nextForcedValue) die.value = die.nextForcedValue;
  die.nextBlocked = false;
  die.nextForcedValue = null;
});
