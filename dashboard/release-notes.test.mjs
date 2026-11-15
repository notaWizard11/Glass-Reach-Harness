import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {parseReleaseNotes} from './release-notes.mjs';
import {startServer} from './server.mjs';
test('release notes preserve section order and multiline bullets',()=>{
 const notes=parseReleaseNotes('# Changelog\r\nIntro\r\n## Unreleased\r\n- New atlas\r\n  with coordinates\r\n- <b>Literal text</b>\r\n\r\n## 0.1.0\r\n- First build');
 assert.deepEqual(notes,[{title:'Unreleased',notes:['New atlas with coordinates','<b>Literal text</b>']},{title:'0.1.0',notes:['First build']}]);
});
test('installed notes API and source serve the same root changelog without engine work',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'gr-notes-')),app=await startServer({demo:true,port:0,dataDir:dir});t.after(async()=>{app.stop();await rm(dir,{recursive:true,force:true});});
 app.game.transport=()=>{throw Error('Release notes must not call the engine');};
 const source=await readFile(new URL('../CHANGELOG.md',import.meta.url),'utf8');
 const response=await fetch(app.url+'api/harness-updates',{headers:{'X-Glass-Reach-Dashboard':'1'}});assert.equal(response.status,200);const payload=await response.json();assert.deepEqual(payload.sections,parseReleaseNotes(source));assert.ok(payload.sections[0].notes.length>=8);
 const raw=await fetch(app.url+'CHANGELOG.md');assert.equal(raw.status,200);assert.equal(await raw.text(),source);
 assert.equal(app.store.character('aaron').rulesFeed,undefined);
});
