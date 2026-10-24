/** Public examples are editorial only. Never import this into URL validation or extraction. */
export function isPublicExample(name:string):boolean{return !/^(pornhub|xvideos)/i.test(name.trim());}
