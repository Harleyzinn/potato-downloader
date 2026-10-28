/** Ephemeral, bounded IDs; the renderer never supplies a path to open. */
export class SavedDestinations{
  private readonly files=new Map<string,string>();
  constructor(private readonly capacity=100){}
  remember(id:string,path:string){this.files.delete(id);this.files.set(id,path);while(this.files.size>this.capacity)this.files.delete(this.files.keys().next().value!);}
  find(id:unknown):string|undefined{return typeof id==='string'?this.files.get(id):undefined;}
}
