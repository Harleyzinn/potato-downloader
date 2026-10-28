const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('batatubo',{
  runtime:ipcRenderer.sendSync('runtime'),
  folder:()=>ipcRenderer.invoke('folder'),chooseFolder:()=>ipcRenderer.invoke('choose-folder'),showSaved:id=>ipcRenderer.invoke('show-saved',id),openFolder:()=>ipcRenderer.invoke('open-folder'),listFolder:()=>ipcRenderer.invoke('list-folder'),
  save:(id,token)=>ipcRenderer.invoke('save',id,token),cancel:id=>ipcRenderer.invoke('cancel-transfer',id),exportReport:text=>ipcRenderer.invoke('export-report',text),prepareEngine:()=>ipcRenderer.invoke('prepare-engine'),
  onTransfer:fn=>{const listener=(_event,value)=>fn(value);ipcRenderer.on('transfer',listener);return()=>ipcRenderer.removeListener('transfer',listener);},
  onSetup:fn=>{const listener=(_event,value)=>fn(value);ipcRenderer.on('setup-progress',listener);return()=>ipcRenderer.removeListener('setup-progress',listener);},
});
