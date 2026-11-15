import test from 'node:test';
import assert from 'node:assert/strict';
import {knownPeople,relationshipGroups} from './people.mjs';
test('people retain observed faction and description without inventing unknown details',()=>{
 const c={people:[],state:{knows:[{who:'p',name:'Person',standing:0}],present:[{id:'p',state:{faction:'House',description:'A traveller.'}},{id:'cup',type:'thing'}]}};
 c.people=knownPeople(c);c.state.present=[];
 const p=knownPeople(c)[0];assert.equal(p.faction,'House');assert.equal(p.description,'A traveller.');assert.equal(p.here,false);assert.equal(p.standing,0);assert.equal(c.people.length,1);
});
test('relationships use with/direction/data and retain distinct incoming and outgoing standing',()=>{
 const result=relationshipGroups([{relation:'knows',direction:'in',with:'p',data:{standing:2}},{relation:'knows',direction:'out',with:'p',data:{standing:-1}},{relation:'knows',participants:['me','q'],data:{as:'A trusted guide'}}],'me');
 assert.equal(result.length,2);assert.deepEqual(result[0].links.map(x=>[x.from,x.to,x.standing]),[['p','me',2],['me','p',-1]]);
 assert.deepEqual(result[1].members,['me','q']);assert.equal(result[1].links[0].note,'A trusted guide');
});
