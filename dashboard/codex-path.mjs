import { access, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, delimiter } from 'node:path';

const exists=async path=>{try{await access(path);return true;}catch{return false;}};
export async function resolveCodex({env=process.env,home=homedir(),platform=process.platform,arch=process.arch}={}){
  if(env.GLASS_REACH_CODEX){
    if(!await exists(env.GLASS_REACH_CODEX))throw new Error('GLASS_REACH_CODEX points to a missing executable. Update it or remove it to use automatic discovery.');
    return env.GLASS_REACH_CODEX;
  }
  if(platform!=='win32')return 'codex';
  for(const dir of (env.PATH||env.Path||'').split(delimiter).filter(Boolean)){
    const executable=join(dir.replace(/^"|"$/g,''),'codex.exe');if(await exists(executable))return executable;
  }
  const standalone=join(home,'.local','bin','codex.exe');if(await exists(standalone))return standalone;
  // Explorer does not inherit the desktop app's version-specific CLI PATH.
  const desktop=join(env.LOCALAPPDATA||join(home,'AppData','Local'),'OpenAI','Codex','bin');
  const versions=[];
  try{for(const entry of await readdir(desktop,{withFileTypes:true})){if(entry.isDirectory()){const file=join(desktop,entry.name,'codex.exe');try{const info=await stat(file);versions.push({file,time:info.mtimeMs});}catch{}}}}catch{}
  versions.sort((a,b)=>b.time-a.time);if(versions.length)return versions[0].file;
  // npm installs a .cmd wrapper; spawn needs the native executable on Windows.
  const npm=join(env.APPDATA||join(home,'AppData','Roaming'),'npm','node_modules','@openai','codex');
  const triple=(arch==='arm64'?'aarch64':'x86_64')+'-pc-windows-msvc';
  for(const root of [npm,join(npm,'node_modules','@openai','codex-win32-'+arch)]){
    const file=join(root,'vendor',triple,'codex','codex.exe');if(await exists(file))return file;
  }
  throw new Error('Codex executable was not found. Open or install Codex on this PC, then reconnect. This is an installation-path issue, not a sign-in failure.');
}
