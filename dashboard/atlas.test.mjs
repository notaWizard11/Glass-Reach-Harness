import test from 'node:test';
import assert from 'node:assert/strict';
import {captureAtlas} from './atlas.mjs';
test('exploration preserves geometry and isolates worlds and characters',()=>{
const c={},obs=(id,world='one')=>({world,here:{id,name:id},layout:{here:{at:[10,20,0]},you:[11,20,0]},exits:[{to:'unknown',name:'Unknown'}]});
captureAtlas(c,obs('a'));captureAtlas(c,obs('b'));
assert.equal(Object.keys(c.atlasWorlds.one.places).length,3);
assert.deepEqual(c.atlasWorlds.one.places.a.geometry.at,[10,20,0]);
assert.equal(c.atlasWorlds.one.places.unknown.geometry,undefined);
captureAtlas(c,{world:'one',here:{id:'a',name:'A'}});
assert.deepEqual(c.atlasWorlds.one.places.a.geometry.at,[10,20,0]);
assert.equal(c.atlasWorlds.one.player,null);
captureAtlas(c,obs('z','two'));assert.equal(c.atlasWorlds.two.places.a,undefined);
const other={};captureAtlas(other,obs('x'));assert.equal(other.atlasWorlds.one.places.a,undefined);
});
