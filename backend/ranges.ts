export function byteRange(value:string|undefined,size:number):{start:number;end:number;partial:boolean}|undefined{
  if(!value)return {start:0,end:size-1,partial:false};
  const match=value.match(/^bytes=(\d*)-(\d*)$/);if(!match||(!match[1]&&!match[2]))return;
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
  const end=match[1]&&match[2]?Math.min(Number(match[2]),size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=size)return;
  return {start,end,partial:true};
}
