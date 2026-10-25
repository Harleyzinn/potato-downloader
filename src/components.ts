const glyphs:Record<string,string[]>={B:['#### ','#   #','#### ','#   #','#### '],P:['#### ','#   #','#### ','#    ','#    '],O:[' ### ','#   #','#   #','#   #',' ### '],T:['#####','  #  ','  #  ','  #  ','  #  '],A:[' ### ','#   #','#####','#   #','#   #'],D:['#### ','#   #','#   #','#   #','#### '],U:['#   #','#   #','#   #','#   #',' ### '],M:['#   #','## ##','# # #','#   #','#   #'],W:['#   #','#   #','# # #','## ##','#   #'],N:['#   #','##  #','# # #','#  ##','#   #'],L:['#    ','#    ','#    ','#    ','#####'],E:['#####','#    ','#### ','#    ','#####'],R:['#### ','#   #','#### ','#  # ','#   #']};
export function asciiTitle():string{return ['BATA','TUBO'].map(word=>Array.from({length:5},(_,row)=>[...word].map(c=>glyphs[c][row]).join(' ')).join('\n')).join('\n\n');}
export function element<T extends HTMLElement=HTMLElement>(selector:string):T{const node=document.querySelector<T>(selector);if(!node)throw new Error(`Missing ${selector}`);return node;}
export function bytes(value:number):string{return `${(value/1024/1024).toLocaleString('pt-BR',{maximumFractionDigits:1})} MiB`;}
export function duration(value:number):string{return `${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;}
export function progressBar(percent?:number):string{if(percent===undefined)return '[ >........................... ]';const n=Math.max(0,Math.min(100,percent));return `[${'#'.repeat(Math.round(n/5))}${'.'.repeat(20-Math.round(n/5))}] ${n}%` ;}
export function terminalIllustration(label:string):string{
  if(/FALHA|CONEXÃO INTERROMPIDA/.test(label))return '  .--------.\n  |  [!]   |   algo deu errado\n  |________|   [ tentar outra vez ]\n     /__\\';
  if(/CANCELADO/.test(label))return '  +-----------+\n  | cancelado |   operação cancelada\n  +-----------+   pronto para recomeçar';
  if(/DOWNLOAD INICIADO/.test(label))return '    .----.\n    | .--|----.   pedido enviado\n    | |  v   |   ao navegador\n    \'-|______|   [ siga por aqui -> ]';
  if(/ARQUIVO PREPARADO/.test(label))return '    .------.\n    | .--. |    [ok] arquivo pronto\n    | |##| |    escolha salvar abaixo\n    |______|';
  if(/PREPARANDO|TRANSFERINDO|CONVERTENDO|COMBINANDO/.test(label))return '  [ origem ] --#--> [ arquivo ]\n                        |\n                   +----v----+\n                   |  disco  |\n                   +---------+';
  if(/MÍDIA DISPONÍVEL/.test(label))return '     .-----.\n     | >   |    opções encontradas\n     \'-----\'    formatos da sua mídia';
  if(/ANALISANDO/.test(label))return '   URL --[?]--> .--------.\n                | motor  |\n                |  >_    |\n                \'--------\'';
  return '      .---.       .---------.\n     / o . \\  --> |  caixa  |\n    | .  o |      | de mídia|\n     \\____/       \'---------\'';
}
