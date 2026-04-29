import type { Die } from './types';
import { BASE_DIE_FACES } from '../data/dice';
export const makeDice=(count:number):Die[]=>Array.from({length:count},()=>({faces:[...BASE_DIE_FACES],value:'fire',locked:false,blocked:false}));
