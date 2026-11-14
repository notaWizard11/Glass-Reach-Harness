import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {resolveCodex} from './codex-path.mjs';
test('finds the newest desktop CLI without inherited PATH',async()=>{
 const home=await mkdtemp(join(tmpdir(),'codex-discovery-')),local=join(home,'local');
 const old=join(local,'OpenAI','Codex','bin','old','codex.exe'),current=join(local,'OpenAI','Codex','bin','new','codex.exe');
 for(const file of [old,current]){await mkdir(dirname(file),{recursive:true});await writeFile(file,'fixture');}
 await utimes(old,1,1);
 assert.equal(await resolveCodex({home,platform:'win32',env:{LOCALAPPDATA:local,PATH:''}}),current);
 await assert.rejects(resolveCodex({home,platform:'win32',env:{GLASS_REACH_CODEX:join(home,'missing')}}),/missing executable/);
});
test('resolves npm native binary instead of a cmd wrapper',async()=>{
 const home=await mkdtemp(join(tmpdir(),'codex-npm-')),app=join(home,'roaming');
 const binary=join(app,'npm','node_modules','@openai','codex','node_modules','@openai','codex-win32-x64','vendor','x86_64-pc-windows-msvc','codex','codex.exe');
 await mkdir(dirname(binary),{recursive:true});await writeFile(binary,'fixture');
 assert.equal(await resolveCodex({home,platform:'win32',arch:'x64',env:{APPDATA:app,LOCALAPPDATA:join(home,'local')}}),binary);
});
