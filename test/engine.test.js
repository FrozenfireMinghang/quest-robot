import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import { status, words } from '../src/i18n.js';
import { Store } from '../src/store.js';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function game(n=5,board='a') {
  const g=E.lobby('p0',n,'en',board); for(let i=1;i<n;i++) E.join(g,'p'+i); E.start(g,'p0');
  g.roles=Object.fromEntries(g.players.map((p,i)=>[p,E.CONFIG[n].roles[i]])); g.leader='p0'; g.veterans=['p0']; return g;
}
function failsWith(g,leader,team,magic) {
  g.leader=leader; if(!g.veterans.includes(leader)) g.veterans.push(leader);
  E.selectTeam(g,leader,team,magic);
  for(const p of team) E.play(g,p,g.roles[p]==='morgan'?'fail':'success',0);
}
const rejects=(fn,code)=>assert.throws(fn,e=>e instanceof E.GameError&&e.code===code);
test('lobbies enforce counts, distinct humans, host ownership and start requirements',()=>{
  rejects(()=>E.lobby('p',7),'size'); const g=E.lobby('p',4); rejects(()=>E.start(g,'p'),'notFull');
  rejects(()=>E.join(g,'p'),'joined'); rejects(()=>E.leave(g,'p'),'hostLeave');
  ['a','b','c'].forEach(p=>E.join(g,p)); rejects(()=>E.join(g,'d'),'full'); rejects(()=>E.start(g,'a'),'host'); E.start(g,'p');
  assert.equal(g.veterans.length,1); assert.equal(Object.keys(g.roles).length,4); rejects(()=>E.join(g,'d'),'phase');
});
test('both four-player boards and five/six-player quest sizes are standard',()=>{
  for(const [n,expected] of [[4,[2,3,3,2]],[5,[2,3,2,4,3]],[6,[2,3,4,3,4]]]) {
    const g=game(n); expected.forEach((v,i)=>{g.round=i; assert.equal(E.teamSize(g),v);});
  }
  const b=game(4,'b'); [2,3,2,3].forEach((v,i)=>{b.round=i; assert.equal(E.teamSize(b),v);});
});
test('initial information is asymmetric and Changeling stays hidden',()=>{
  for(const n of [4,5]) { const g=game(n); const m=g.players.find(p=>g.roles[p]==='morgan'),s=g.players.find(p=>g.roles[p]==='scion');
    assert.deepEqual(E.knowledge(g,m).allies,[s]); assert.deepEqual(E.knowledge(g,s).allies,[]); }
  const g=game(6); assert.deepEqual(E.knowledge(g,'p3').allies,['p4']); assert.deepEqual(E.knowledge(g,'p4').allies,['p3']); assert.deepEqual(E.knowledge(g,'p5').allies,[]);
});
test('team selection, secret cards, Magic and duplicate submission are enforced',()=>{
  const g=game(); rejects(()=>E.selectTeam(g,'p1',['p0','p3'],'p0'),'leader');
  rejects(()=>E.selectTeam(g,'p0',['p0','p0'],'p0'),'teamSize'); rejects(()=>E.selectTeam(g,'p0',['p0','p3'],'p2'),'magic');
  E.selectTeam(g,'p0',['p0','p3'],'p3'); rejects(()=>E.play(g,'p1','success'),'teamMember'); rejects(()=>E.play(g,'p0','fail'),'forcedSuccess');
  E.play(g,'p3','fail'); assert.equal(g.history.length,0); rejects(()=>E.play(g,'p3','success'),'submitted');
  assert.ok(!status(g).includes('p3 —')); E.play(g,'p0','success'); assert.equal(g.history[0].fails,1); assert.equal(g.phase,'transition'); assert.deepEqual(g.cards,{});
  const h=game(); E.selectTeam(h,'p0',['p0','p4'],'p4'); rejects(()=>E.play(h,'p4','fail'),'forcedSuccess');
});
test('one fail defeats the fourth quest at five and six players (no Director rules)',()=>{
  for(const n of [5,6]) {const g=game(n);g.round=3; const m=g.players.find(p=>g.roles[p]==='morgan');
    const t=[...g.players.slice(0,E.teamSize(g)-1),m]; failsWith(g,'p0',t,'p0');assert.equal(g.history[0].success,false);}
});
test('leaders cannot repeat; six-player amulet is mandatory after quest 2 and checks alignment only',()=>{
  const g=game(6); g.phase='transition'; rejects(()=>E.transition(g,'p0','p0'),'eligibleLeader'); E.transition(g,'p0','p1');
  g.phase='transition'; rejects(()=>E.transition(g,'p1','p2'),'member'); rejects(()=>E.transition(g,'p1','p2','p2'),'eligibleAmulet');
  E.transition(g,'p1','p2','p4'); assert.equal(g.phase,'inspect'); assert.equal(g.round,2);
  rejects(()=>E.inspect(g,'p0','p3'),'holder'); rejects(()=>E.inspect(g,'p4','p4'),'inspectTarget'); assert.equal(E.inspect(g,'p4','p3'),'evil');
  assert.deepEqual(E.knowledge(g,'p4').inspections,[{target:'p3',alignment:'evil'}]); assert.equal(g.phase,'team');
  g.phase='transition'; rejects(()=>E.transition(g,'p2','p4'),'eligibleLeader');
});
test('three successes end immediately for each player count',()=>{
  for(const n of [4,5,6]) { const g=game(n); for(let round=0;round<3;round++) {
    if(round) { const next=g.players.find(p=>!g.veterans.includes(p)); const h=n===6&&round===2?g.players.find(p=>p!==next&&!g.veterans.includes(p)):undefined;
      E.transition(g,g.leader,next,h);if(h) E.inspect(g,h,g.players.find(p=>p!==h)); }
    const t=g.players.slice(0,E.teamSize(g)); E.selectTeam(g,g.leader,t,t[0]); for(const p of t) E.play(g,p,'success');
  } assert.equal(g.winner,'good');assert.equal(g.history.length,3); }
});
function finalGame(n=5) {
  const g=game(n); const m=g.players.find(p=>g.roles[p]==='morgan'); const times=n===4?2:3;
  for(let r=0;r<times;r++) {g.phase='team';g.round=r; const t=[...g.players.filter(p=>p!==m).slice(0,E.teamSize(g)-1),m]; failsWith(g,'p'+r,t,t[0]);}
  return g;
}
test('failed quests lead to five-minute discussion, then locked simultaneous accusations',()=>{
  for(const n of [4,5,6]) { const g=finalGame(n);assert.equal(g.phase,'discussion');assert.equal(g.history.length,n===4?2:3);
    rejects(()=>E.openFinal(g,299999),'discussion'); E.openFinal(g,300000);
    const bad=g.players.filter(p=>E.evil(g.roles[p]));
    for(const p of g.players) {
      const targets=E.evil(g.roles[p])?g.players.filter(x=>x!==p).slice(0,2):bad.slice(0,2);
      // At six players the Good players collectively cover all three Evil players.
      if(n===6&&!E.evil(g.roles[p])&&p==='p1') targets[1]=bad[2];
      E.accuse(g,p,targets); if(Object.keys(g.accusations).length<n) assert.equal(g.winner,null);
    } assert.equal(g.winner,'good');
  }
});
test('missing an Evil player or pointing at Good loses; all-Evil-leader exception wins',()=>{
  for(const exception of [false,true]) { const g=finalGame();E.openFinal(g,300000); if(exception) g.history.forEach(r=>r.leader='p3');
    for(const p of g.players) E.accuse(g,p,g.players.filter(x=>x!==p).slice(0,2)); assert.equal(g.winner,exception?'good':'evil'); }
  const g=finalGame(); E.openFinal(g,300000); rejects(()=>E.accuse(g,'p0',['p0','p3']),'targets'); E.accuse(g,'p0',['p3','p4']); rejects(()=>E.accuse(g,'p0',['p3','p4']),'submitted');
});
test('public status never includes secret cards, knowledge, inspection results or accusations',()=>{
  const g=game(6);g.inspections.p4=[{target:'SECRET_TARGET',alignment:'evil'}]; g.cards={SECRET_CARD:'fail'};g.accusations={p0:['SECRET_VOTE','p4']};
  const s=status(g);for(const secret of ['SECRET_TARGET','SECRET_CARD','SECRET_VOTE','Morgan le Fay','Changeling']) assert.ok(!s.includes(secret));
});
test('English and Chinese dictionaries have matching messages and error coverage',()=>{
  assert.deepEqual(Object.keys(words.en).sort(),Object.keys(words.zh).sort());assert.deepEqual(Object.keys(words.en.errors).sort(),Object.keys(words.zh.errors).sort());
  for(const lang of ['en','zh']) {const g=game();g.language=lang;assert.ok(!status(g).includes('undefined'));}
});
test('atomic persistence survives restarts and rejects mutations without corrupting saved state',()=>{
  const dir=mkdtempSync(join(tmpdir(),'quest-'));try {const path=join(dir,'games.json'),store=new Store(path);
    store.update('guild:channel',()=>({game:game()})); const before=structuredClone(store.get('guild:channel'));
    assert.throws(()=>store.update('guild:channel',g=>{g.phase='broken';throw Error('abort');}));assert.deepEqual(store.get('guild:channel'),before);
    assert.deepEqual(new Store(path).get('guild:channel'),before); assert.equal(statSync(path).mode&0o777,0o600);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('complete mixed-result games reach the final stage using legal leader and amulet transitions',()=>{
  for(const n of [4,5,6]) {
    const g=game(n);const m=g.players.find(p=>g.roles[p]==='morgan');const expected=n===4?3:4;
    for(let round=0;round<expected;round++) {
      const team=[m,...g.players.filter(p=>p!==m).slice(0,E.teamSize(g)-1)];
      E.selectTeam(g,g.leader,team,team[1]);
      for(const p of team) E.play(g,p,round>0&&p===m?'fail':'success',0);
      if(g.phase==='transition') {
        const eligible=g.players.filter(p=>!g.veterans.includes(p)&&!g.amulets.includes(p));
        const holder=n===6&&g.round===1?eligible[1]:undefined; E.transition(g,g.leader,eligible[0],holder);
        if(holder) E.inspect(g,holder,g.players.find(p=>p!==holder));
      }
    }
    assert.equal(g.phase,'discussion');assert.equal(g.history.length,expected);E.openFinal(g,300000);
    for(const p of g.players) {
      const bad=g.players.filter(x=>E.evil(g.roles[x]));let targets=E.evil(g.roles[p])?g.players.filter(x=>x!==p).slice(0,2):bad.slice(0,2);
      if(n===6&&p==='p1') targets=[bad[1],bad[2]]; E.accuse(g,p,targets);
    }
    assert.equal(g.winner,'good');
  }
});
