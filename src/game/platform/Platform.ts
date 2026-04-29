export interface Platform{vibrate(ms:number):void;load(k:string):string|null;save(k:string,v:string):void;screen():{w:number;h:number;dpr:number}}
