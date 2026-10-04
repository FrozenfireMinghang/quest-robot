import * as E from './engine.js';
import { dictionary, mention, status } from './i18n.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
export function createSimulation(host,size=4,language='zh') {
  const g=E.lobby(host,size,language);
  for(let n=2;n<=size;n++) E.join(g,`sim-${n}`);
  E.start(g,host);g.simulation=true;return g;
}
export function assertSimulation(g,host) {
  if(!g.simulation) throw new E.GameError('phase');
  if(g.host!==host) throw new E.GameError('host');
}
export function simulationStep(g,host,action,values=[]) {
  assertSimulation(g,host);
  if(action==='team') {
    E.phase(g,'team');
    if(values.length!==E.teamSize(g)||new Set(values).size!==values.length) throw new E.GameError('teamSize');
    values.forEach(p=>E.member(g,p));g.simDraft=[...values];
  } else if(action==='magic') {
    E.phase(g,'team');
    E.selectTeam(g,g.leader,g.simDraft||[],values[0]);g.simDraft=null;g.simActor=g.team[0];
  } else if(action==='actor') {
    E.phase(g,'quest');
    if(values.length!==1||!g.team.includes(values[0])) throw new E.GameError('teamMember');
    if(Object.hasOwn(g.cards,values[0])) throw new E.GameError('submitted');g.simActor=values[0];
  } else if(['success','fail'].includes(action)) {
    E.phase(g,'quest');
    const actor=g.simActor||g.team.find(p=>!Object.hasOwn(g.cards,p));
    E.play(g,actor,action);g.simActor=g.phase==='quest'?g.team.find(p=>!Object.hasOwn(g.cards,p)):null;
  } else if(action==='reset-team') {
    E.phase(g,'team');g.simDraft=null;
  } else if(action==='next') {
    E.phase(g,'transition');
    const eligible=g.players.filter(p=>!g.veterans.includes(p)&&!g.amulets.includes(p));
    E.transition(g,g.leader,eligible[0],g.size===6&&g.round===1?eligible[1]:undefined);
  } else if(action==='inspect') {
    E.phase(g,'inspect');
    E.inspect(g,g.holder,g.players.find(p=>!g.amulets.includes(p)&&!g.checked.includes(p)));
  } else if(action==='skip') {
    E.phase(g,'discussion');E.openFinal(g,g.discussionEnds);
  } else if(['correct','incorrect'].includes(action)) {
    E.phase(g,'final');
    const bad=g.players.filter(p=>E.evil(g.roles[p]));
    const good=g.players.filter(p=>!E.evil(g.roles[p]));
    for(const p of g.players) {
      let targets=g.players.filter(x=>x!==p).slice(0,2);
      if(good.includes(p)) {
        const index=good.indexOf(p);
        targets=[bad[index%bad.length],bad[(index+1)%bad.length]];
        if(action==='incorrect') targets=[good.find(x=>x!==p),bad[0]];
      }
      E.accuse(g,p,targets);
    }
  } else throw new E.GameError('phase');
}
export function simulationPanel(g,host) {
  assertSimulation(g,host);const zh=g.language==='zh',w=dictionary(g.language);
  const token=`sim:${g.id}:${g.revision}:`;
  const label=p=>p===host?(zh?'你（房主）':'You (host)'):(zh?`虚拟玩家 ${p.slice(4)}`:`Player ${p.slice(4)}`);
  const options=players=>players.map(p=>({label:label(p),value:p}));
  const select=(action,prompt,players,min=1,max=1)=>new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(token+action).setPlaceholder(prompt).setMinValues(min).setMaxValues(max).addOptions(options(players)));
  const button=(action,text,disabled=false)=>new ButtonBuilder().setCustomId(token+action).setLabel(text).setStyle(action==='fail'||action==='incorrect'?ButtonStyle.Danger:ButtonStyle.Primary).setDisabled(disabled);
  const components=[];let prompt='';
  if(g.phase==='team') {
    if(!g.simDraft) {
      prompt=zh?`① 选择 ${E.teamSize(g)} 名任务队员，然后确认选择。`:`① Choose ${E.teamSize(g)} team members and confirm.`;
      components.push(select('team',zh?'选择任务队员':'Choose team members',g.players,E.teamSize(g),E.teamSize(g)));
    } else {
      prompt=(zh?'② 给哪位队员魔法？队伍：':'② Who receives Magic? Team: ')+g.simDraft.map(label).join('、');
      components.push(select('magic',zh?'选择魔法指示物接收者':'Choose Magic recipient',g.simDraft));
      components.push(new ActionRowBuilder().addComponents(button('reset-team',zh?'重新选择队伍':'Change team')));
    }
  } else if(g.phase==='quest') {
    const pending=g.team.filter(p=>!Object.hasOwn(g.cards,p));const actor=pending.includes(g.simActor)?g.simActor:pending[0];
    const canFail=E.evil(g.roles[actor])&&(actor!==g.magic||g.roles[actor]==='morgan');
    prompt=(zh?'③ 正在代替 ':'③ Playing as ')+label(actor)+` — ${w[g.roles[actor]]}`+(actor===g.magic?(zh?'（持有魔法）':' (has Magic)'):'')+'\n'+(canFail?(zh?'你可以点成功或失败。':'Choose Success or Fail.'):(zh?'规则要求成功，所以失败按钮不可用。':'Success is required; Fail is disabled.'));
    components.push(select('actor',zh?'切换尚未出牌的队员':'Switch pending player',pending));
    components.push(new ActionRowBuilder().addComponents(button('success',zh?'成功':'Success'),button('fail',zh?'失败':'Fail',!canFail)));
  } else {
    const names={next:zh?'交接下一任领袖':'Assign next leader',inspect:zh?'执行护符查验':'Inspect with amulet',skip:zh?'跳过测试讨论时间':'Skip test discussion',correct:zh?'好人正确指认':'Correct Good accusations',incorrect:zh?'好人错误指认':'Incorrect Good accusations'};
    const actions=({transition:['next'],inspect:['inspect'],discussion:['skip'],final:['correct','incorrect']})[g.phase]||[];
    if(actions.length) components.push(new ActionRowBuilder().addComponents(actions.map(a=>button(a,names[a]))));
    prompt=zh?'按下方按钮继续。':'Use the buttons to continue.';
  }
  // Keep the simulation panel focused on the current step; omit multiplayer command instructions.
  const content=(zh?'**🧪 单人模拟 · 你控制所有玩家**':'**🧪 Solo simulation · You control every player**')+'\n'+g.players.map(p=>`${label(p)}: ${w[g.roles[p]]}`).join(' · ')+'\n\n'+`**${w[g.phase]} · ${w.round} ${g.round+1}**`+'\n'+`${w.leader}: ${label(g.leader)}`+(g.team.length?'\n'+`${w.teamLabel}: ${g.team.map(label).join('、')} · ${w.magicLabel}: ${label(g.magic)}`:'')+(g.phase==='quest'?'\n'+`${w.submittedLabel}: ${Object.keys(g.cards).length}/${g.team.length}`:'')+(g.winner?'\n'+`**${w.winner}: ${w[g.winner]}**`:'')+'\n\n'+prompt;
  return {content,components};
}
