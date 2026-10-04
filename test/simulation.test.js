import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,simulationStep,simulationPanel} from '../src/simulation.js';
import {status} from '../src/i18n.js';
function step(g,a) {
 if(['success','fail'].includes(a)&&g.phase==='team') {
  const m=g.players.find(p=>g.roles[p]==='morgan');const team=[m,...g.players.filter(p=>p!==m).slice(0,({4:[2,3,3,2],5:[2,3,2,4,3],6:[2,3,4,3,4]})[g.size][g.round]-1)];
  simulationStep(g,'host','team',team);simulationStep(g,'host','magic',[m]);
  for(const p of team) {simulationStep(g,'host','actor',[p]);simulationStep(g,'host',a==='fail'&&p===m?'fail':'success');}
 } else simulationStep(g,'host',a);g.revision++;
}
function advance(g) {if(g.phase==='transition') step(g,'next');if(g.phase==='inspect') step(g,'inspect');}
test('solo simulations reach three successes for 4, 5 and 6 players',()=>{
 for(const n of [4,5,6]) {const g=createSimulation('host',n);for(let i=0;i<3;i++){step(g,'success');advance(g);}assert.equal(g.winner,'good');assert.equal(g.players.length,n);}
});
test('solo failures exercise Morgan Magic exception, discussion skipping and final verdict',()=>{
 for(const n of [4,5,6]) for(const outcome of ['correct','incorrect']) {
  const g=createSimulation('host',n);g.leader='host';g.roles.host='loyal';
  // Set a deterministic valid distribution for the leader-exception test.
  const roles=n===4?['loyal','loyal','morgan','scion']:n===5?['loyal','loyal','loyal','morgan','scion']:['loyal','loyal','loyal','morgan','minion','changeling'];
  g.roles=Object.fromEntries(g.players.map((p,i)=>[p,roles[i]]));g.veterans=['host'];
  for(let i=0;i<(n===4?2:3);i++){step(g,'fail');advance(g);}
  assert.equal(g.phase,'discussion');assert.ok(g.history.every(r=>r.fails===1&&g.roles[r.magic]==='morgan'));
  step(g,'skip');step(g,outcome);assert.equal(g.winner,outcome==='correct'?'good':'evil');
 }
});
test('only simulation host can operate panels, real games cannot skip discussion',()=>{
 const g=createSimulation('host');assert.throws(()=>simulationStep(g,'outsider','success'),/host/);
 assert.throws(()=>simulationPanel(g,'outsider'),/host/);g.simulation=false;assert.throws(()=>simulationStep(g,'host','skip'),/phase/);
});
test('role overview stays in private panel and generated labels are not Discord mentions',()=>{
 const g=createSimulation('host');assert.match(simulationPanel(g,'host').content,/摩根/);assert.ok(!status(g).includes('摩根'));
 assert.ok(!status(g).includes('<@sim-'));const buttons=simulationPanel(g,'host').components[0].toJSON().components;
 assert.ok(buttons.every(b=>b.custom_id.includes(g.id)));
});
test('stepwise team and Magic selection enforce eligibility and resolve only after separate cards',()=>{
 const g=createSimulation('host');g.roles={host:'loyal','sim-2':'morgan','sim-3':'scion','sim-4':'loyal'};
 simulationStep(g,'host','team',['sim-2','sim-3']);
 assert.equal(g.phase,'team');assert.equal(simulationPanel(g,'host').components[0].toJSON().components[0].options.length,2);
 assert.throws(()=>simulationStep(g,'host','magic',['host']),/magic/);
 simulationStep(g,'host','magic',['sim-3']);
 simulationStep(g,'host','actor',['sim-3']);
 assert.equal(simulationPanel(g,'host').components[1].toJSON().components[1].disabled,true);
 assert.throws(()=>simulationStep(g,'host','fail'),/forcedSuccess/);
 simulationStep(g,'host','success');assert.equal(g.history.length,0);assert.equal(g.simActor,'sim-2');
 simulationStep(g,'host','fail');assert.equal(g.history.length,1);assert.equal(g.history[0].fails,1);
});
test('Magic on Morgan permits Fail and forged old shortcut cannot submit an entire team',()=>{
 const g=createSimulation('host');g.roles={host:'loyal','sim-2':'morgan','sim-3':'scion','sim-4':'loyal'};
 assert.throws(()=>simulationStep(g,'host','success'),/phase/);
 simulationStep(g,'host','team',['host','sim-2']);simulationStep(g,'host','reset-team');assert.equal(g.simDraft,null);
 simulationStep(g,'host','team',['host','sim-2']);simulationStep(g,'host','magic',['sim-2']);simulationStep(g,'host','actor',['sim-2']);
 assert.equal(simulationPanel(g,'host').components[1].toJSON().components[1].disabled,false);
 simulationStep(g,'host','fail');assert.equal(g.history.length,0);simulationStep(g,'host','success');assert.equal(g.history[0].success,false);
});
