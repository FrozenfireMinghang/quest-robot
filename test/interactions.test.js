import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import { createHandler } from '../src/interactions.js';
import { commands } from '../src/commands.js';
import * as E from '../src/engine.js';
import { Store } from '../src/store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function fixture(t,n=5) {
  const dir=mkdtempSync(join(tmpdir(),'quest-ui-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new Store(join(dir,'games.json'));
  const g=E.lobby('p0',n,'en'); for(let i=1;i<n;i++) E.join(g,'p'+i); E.start(g,'p0');
  g.roles=Object.fromEntries(g.players.map((p,i)=>[p,E.CONFIG[n].roles[i]]));g.leader='p0';g.veterans=['p0'];
  store.update('guild:channel',()=>({game:g}));
  return {store,handle:createHandler({users:{cache:new Map()}},store)};
}
function interaction(sub,id='p0',opts={}) {
  const replies=[],publicMessages=[];
  const i={locale:'en-US',commandName:'quest',guildId:'guild',channelId:'channel',user:{id,bot:false},deferred:false,
    inGuild:()=>true,isChatInputCommand:()=>true,isButton:()=>false,isStringSelectMenu:()=>false,
    options:{getSubcommand:()=>sub,getString:n=>opts[n]??null,getInteger:n=>opts[n]??null,getUser:n=>opts[n]?{id:opts[n],bot:false}:null},
    channel:{isTextBased:()=>true,send:async msg=>publicMessages.push(msg)},memberPermissions:{has:()=>false},
    deferReply:async options=>{assert.equal(options.flags,MessageFlags.Ephemeral);i.deferred=true;},
    editReply:async msg=>replies.push(msg),followUp:async msg=>replies.push(msg),reply:async msg=>replies.push(msg),replies,publicMessages};return i;
}
function component(g,action,id,values=[]) {
  const i=interaction('',id);i.isChatInputCommand=()=>false;i.isButton=()=>action!=='accuse';i.isStringSelectMenu=()=>action==='accuse';
  i.customId=`q:${g.id}:${g.round}:${action}`;i.values=values;return i;
}
test('command definitions serialize with valid required-before-optional ordering',()=>{
  assert.equal(commands[0].name,'quest');assert.equal(commands[0].dm_permission,false);
  for(const sub of commands[0].options) {assert.ok(sub.description_localizations['zh-CN']);let optional=false;
    for(const option of sub.options||[]) {if(!option.required) optional=true;else assert.equal(optional,false,sub.name);}
  }
});
test('role information and action buttons are ephemeral and never posted publicly',async t=>{
  const {handle,store}=fixture(t);const i=interaction('role','p3');await handle(i);
  assert.match(i.replies[0].content,/Morgan le Fay/);assert.match(i.replies[0].content,/<@p4>/);assert.equal(i.publicMessages.length,0);
  store.update('guild:channel',g=>E.selectTeam(g,'p0',['p0','p3'],'p3'));
  const a=interaction('action','p0');await handle(a);const buttons=a.replies[0].components[0].toJSON().components;
  assert.equal(buttons[1].disabled,true);assert.equal(a.publicMessages.length,0);
});
test('forged Fail buttons, outsider actions and old-game panels cannot mutate state',async t=>{
  const {handle,store}=fixture(t);store.update('guild:channel',g=>E.selectTeam(g,'p0',['p0','p3'],'p3'));
  const g=store.get('guild:channel'),revision=g.revision;
  const bad=component(g,'fail','p0');await handle(bad);assert.match(bad.replies[0].content,/must play Success/);
  const outsider=component(g,'success','outsider');await handle(outsider);assert.match(outsider.replies[0].content,/must be a player/);
  const old=component({...g,id:'old'},'success','p3');await handle(old);assert.match(old.replies[0].content,/old game/);
  assert.equal(store.get('guild:channel').revision,revision);
});
test('task cards reveal only totals after all members submit, never the raw card',async t=>{
  const {handle,store}=fixture(t);store.update('guild:channel',g=>E.selectTeam(g,'p0',['p0','p3'],'p3'));const g=store.get('guild:channel');
  const fail=component(g,'fail','p3');await handle(fail);assert.equal(fail.publicMessages.length,0);assert.equal(fail.replies[0].content,'Saved.');
  const success=component(g,'success','p0');await handle(success);assert.equal(success.publicMessages.length,1);
  assert.match(success.publicMessages[0].content,/Fail: 1/);assert.ok(!success.publicMessages[0].content.includes('Morgan le Fay'));
});
test('amulet alignment stays private while the public phase advances',async t=>{
  const {handle,store}=fixture(t,6);store.update('guild:channel',g=>{g.phase='transition';g.round=1;E.transition(g,'p0','p1','p4');});
  const i=interaction('inspect','p4',{player:'p3'});await handle(i);assert.match(i.replies[0].content,/<@p3> — \*\*Evil\*\*/);
  assert.equal(i.publicMessages.length,1);assert.ok(!i.publicMessages[0].content.includes('Evil'));assert.ok(!i.publicMessages[0].content.includes('Morgan'));
});
test('simultaneous duplicate submissions persist only once',async t=>{
  const {handle,store}=fixture(t);store.update('guild:channel',g=>E.selectTeam(g,'p0',['p0','p3'],'p3'));const g=store.get('guild:channel');
  const a=component(g,'fail','p3'),b=component(g,'success','p3');await Promise.all([handle(a),handle(b)]);
  assert.deepEqual(store.get('guild:channel').cards,{p3:'fail'});assert.match(b.replies[0].content,/already submitted/);
});
test('cancel authorization and game isolation are enforced',async t=>{
  const {handle,store}=fixture(t);const i=interaction('cancel','p1');await handle(i);assert.equal(store.get('guild:channel').phase,'team');
  const other=interaction('status','p0');other.channelId='other';await handle(other);assert.match(other.replies[0].content,/No game here/);
  const host=interaction('cancel');await handle(host);assert.equal(store.get('guild:channel').phase,'cancelled');
});
test('Chinese creation and errors are localized',async t=>{
  const {handle}=fixture(t);const i=interaction('create','x',{players:4,language:'zh'});i.channelId='new';await handle(i);
  assert.equal(i.replies[0].content,'已保存。');assert.match(i.publicMessages[0].content,/阿瓦隆2号/);
  const bad=interaction('start','x');bad.channelId='new';await handle(bad);assert.match(bad.replies[0].content,/人数齐/);
});
test('final accusations are hidden until all players submit, then roles are revealed',async t=>{
  const {handle,store}=fixture(t);store.update('guild:channel',g=>{g.phase='final';g.history=[{round:1,leader:'p0',team:['p0','p3'],magic:'p3',fails:1,success:false}];});
  for(const id of ['p0','p1','p2','p3','p4']) {
    const g=store.get('guild:channel'); const i=component(g,'accuse',id,id==='p3'||id==='p4'?['p0','p1']:['p3','p4']);await handle(i);
    assert.equal(i.replies[0].content,'Saved.');
    if(id!=='p4') { assert.ok(!i.publicMessages[0].content.includes('Morgan le Fay'));assert.equal(store.get('guild:channel').winner,null); }
    else { assert.match(i.publicMessages[0].content,/Winner: Good/);assert.match(i.publicMessages[0].content,/Morgan le Fay/); }
  }
});
