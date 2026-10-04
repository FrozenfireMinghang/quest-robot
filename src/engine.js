import { randomInt, randomUUID } from 'node:crypto';

export const CONFIG = {
  4: { roles: ['loyal','loyal','morgan','scion'], teams: [2,3,3,2] },
  5: { roles: ['loyal','loyal','loyal','morgan','scion'], teams: [2,3,2,4,3] },
  6: { roles: ['loyal','loyal','loyal','morgan','minion','changeling'], teams: [2,3,4,3,4] }
};
export class GameError extends Error { constructor(code) { super(code); this.code = code; } }
const check = (ok, code) => { if (!ok) throw new GameError(code); };
export const evil = role => role !== 'loyal';
const shuffle = values => { const a = [...values]; for (let i=a.length-1;i>0;i--) { const j=randomInt(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; };
export function lobby(host, size, language='zh', board='a') {
  check(CONFIG[size], 'size'); check(['en','zh'].includes(language), 'language'); check(['a','b'].includes(board), 'board');
  return { id: randomUUID(), host, size, language, board, players:[host], phase:'lobby', revision:0 };
}
export function member(g,id) { check(g.players.includes(id),'member'); }
export function phase(g,p) { check(g.phase===p,'phase'); }
export function join(g,id) { phase(g,'lobby'); check(!g.players.includes(id),'joined'); check(g.players.length<g.size,'full'); g.players.push(id); }
export function leave(g,id) { phase(g,'lobby'); member(g,id); check(id!==g.host,'hostLeave'); g.players=g.players.filter(p=>p!==id); }
export function start(g,id) {
  phase(g,'lobby'); check(id===g.host,'host'); check(g.players.length===g.size,'notFull');
  const roles=shuffle(CONFIG[g.size].roles); g.roles=Object.fromEntries(g.players.map((p,i)=>[p,roles[i]]));
  g.leader=g.players[randomInt(g.size)]; g.veterans=[g.leader]; g.amulets=[]; g.checked=[]; g.inspections={};
  g.history=[]; g.round=0; g.phase='team'; g.team=[]; g.magic=null; g.cards={}; g.accusations={}; g.winner=null;
}
export function teamSize(g) { return g.size===4 && g.board==='b' ? [2,3,2,3][g.round] : CONFIG[g.size].teams[g.round]; }
export function knowledge(g,id) {
  member(g,id); check(g.roles,'notStarted'); const role=g.roles[id]; let allies=[];
  if (g.size<6 && role==='morgan') allies=g.players.filter(p=>g.roles[p]==='scion');
  if (g.size===6 && ['morgan','minion'].includes(role)) allies=g.players.filter(p=>p!==id && ['morgan','minion'].includes(g.roles[p]));
  return {role, allies, inspections:g.inspections[id]||[]};
}
export function selectTeam(g,id,team,magic) {
  phase(g,'team'); check(id===g.leader,'leader'); check(team.length===teamSize(g) && new Set(team).size===team.length,'teamSize');
  team.forEach(p=>member(g,p)); check(team.includes(magic),'magic'); g.team=[...team]; g.magic=magic; g.cards={}; g.phase='quest';
}
export function play(g,id,card,now=Date.now()) {
  phase(g,'quest'); member(g,id); check(g.team.includes(id),'teamMember'); check(!Object.hasOwn(g.cards,id),'submitted');
  check(['success','fail'].includes(card),'card'); check(card==='success'||(evil(g.roles[id]) && (g.magic!==id || g.roles[id]==='morgan')),'forcedSuccess');
  g.cards[id]=card;
  if(Object.keys(g.cards).length!==g.team.length) return;
  const fails=Object.values(g.cards).filter(c=>c==='fail').length;
  g.history.push({round:g.round+1, leader:g.leader, team:[...g.team],magic:g.magic,fails,success:fails===0}); g.cards={};
  if(g.history.filter(r=>r.success).length===3) { finish(g,'good'); return; }
  if(g.history.filter(r=>!r.success).length===(g.size===4?2:3)) { g.phase='discussion'; g.discussionEnds=now+300000; return; }
  g.phase='transition';
}
export function transition(g,id,next,holder) {
  phase(g,'transition'); check(id===g.leader,'leader'); member(g,next); check(!g.veterans.includes(next)&&!g.amulets.includes(next),'eligibleLeader');
  const needed=g.size===6 && g.round===1;
  if(needed) { member(g,holder); check(holder!==next&&!g.veterans.includes(holder)&&!g.amulets.includes(holder),'eligibleAmulet'); }
  else check(!holder,'noAmulet');
  g.leader=next; g.veterans.push(next); g.round++; g.team=[]; g.magic=null;
  if(needed) { g.amulets.push(holder); g.holder=holder; g.phase='inspect'; } else g.phase='team';
}
export function inspect(g,id,target) {
  phase(g,'inspect'); check(id===g.holder,'holder'); member(g,target); check(!g.amulets.includes(target)&&!g.checked.includes(target),'inspectTarget');
  const alignment=evil(g.roles[target])?'evil':'good'; g.checked.push(target);
  (g.inspections[id]??=[]).push({target,alignment}); g.holder=null; g.phase='team'; return alignment;
}
export function openFinal(g,now=Date.now()) { phase(g,'discussion'); check(now>=g.discussionEnds,'discussion'); g.phase='final'; }
export function accuse(g,id,targets) {
  phase(g,'final'); member(g,id); check(!Object.hasOwn(g.accusations,id),'submitted');
  check(targets.length===2&&new Set(targets).size===2&&!targets.includes(id),'targets'); targets.forEach(p=>member(g,p));
  g.accusations[id]=[...targets];
  if(Object.keys(g.accusations).length!==g.size) return;
  const pointed=new Set(g.players.filter(p=>!evil(g.roles[p])).flatMap(p=>g.accusations[p]));
  const bad=g.players.filter(p=>evil(g.roles[p]));
  const allBadLeaders=g.history.every(r=>evil(g.roles[r.leader]));
  finish(g,allBadLeaders || (pointed.size===bad.length&&bad.every(p=>pointed.has(p)))?'good':'evil');
}
function finish(g,winner) { g.phase='ended'; g.winner=winner; }
