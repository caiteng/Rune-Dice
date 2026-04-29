import type { Platform } from './Platform';
export class WebPlatform implements Platform{vibrate(ms:number){navigator.vibrate?.(ms)} load(k:string){return localStorage.getItem(k)} save(k:string,v:string){localStorage.setItem(k,v)} screen(){return{w:window.innerWidth,h:window.innerHeight,dpr:window.devicePixelRatio||1}}}
