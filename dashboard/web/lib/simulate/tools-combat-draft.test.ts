import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { applyToolsCombatDraft } from './tools-combat-draft';
const original = () => ({stats:{infantry:{attack:100,defense:100,health:100,lethality:100},lancer:{attack:100},marksman:{attack:100}},petModifiers:{attack:4,defense:4,health:4,lethality:4,enemy_defense:4,enemy_health:4,enemy_lethality:4}});
test('imports base stats and separate active buffs without mutation or permanent additions',()=>{
 const state=original(), result=applyToolsCombatDraft(state,{petsActive:true,statsIncludePets:true,stats:{infantry:{attack:900,defense:0,health:null}},petModifiers:{attack:10,enemy_health:5},permanent:{attack:215.49}});
 assert.equal(result.stats.infantry.attack,900);assert.equal(result.stats.infantry.defense,0);assert.equal(result.stats.infantry.health,100);assert.equal(result.petModifiers.attack,10);assert.equal(result.petModifiers.enemy_health,5);assert.equal(state.stats.infantry.attack,100);
});
test('off clears old active buffs while legacy missing combat preserves the form',()=>{
 const state=original();assert.equal(applyToolsCombatDraft(state,null),state);
 const result=applyToolsCombatDraft(state,{petsActive:false,statsIncludePets:false,stats:{infantry:{attack:1000}}});
 assert.equal(result.stats.infantry.attack,1000);assert(Object.values(result.petModifiers).every(value=>value===0));
});
test('unknown, malformed and out-of-range inputs cannot create numeric stats',()=>{
 const state=original(), result=applyToolsCombatDraft(state,{petsActive:true,statsIncludePets:false,stats:{infantry:{attack:'200',defense:-1,health:Infinity}},petModifiers:{attack:11,enemy_health:6,defense:NaN}});
 assert.deepEqual(result.stats,state.stats);assert.deepEqual(result.petModifiers,state.petModifiers);
 assert.equal(applyToolsCombatDraft(state,{petsActive:'true',statsIncludePets:false}),state);
});
if (process.env.SIM_COMBAT_FIXTURE) test('actual Tools SQL/HTTP payload applies a saved pet exactly once',()=>{
 const draft=JSON.parse(fs.readFileSync(process.env.SIM_COMBAT_FIXTURE!,'utf8'));
 const result=applyToolsCombatDraft(original(),draft.combat);
 assert.equal(result.petModifiers.attack,3.5);
 assert(Math.abs((100+result.stats.infantry.attack)*1.035-100-1000)<.00001);
 assert.equal(result.stats.lancer.attack,100,'missing SQL stats do not overwrite the existing form');
});
