import { MessageFlags, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import * as E from './engine.js';
import { dictionary, language, mention, status } from './i18n.js';

export function createHandler(client, store) {
const privateReply={flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}};
const active=g=>g&&!['ended','cancelled'].includes(g.phase);
function requireGame(key) { const g=store.get(key); if(!g) throw new E.GameError('missing'); return g; }
function roleText(g,id) {
  const {role,allies,inspections}=E.knowledge(g,id), w=dictionary(g.language);
  return `**${w.roleLabel}: ${w[role]} (${w[E.evil(role)?'evil':'good']})**\n${w[role==='morgan'?'morganHelp':E.evil(role)?'evilHelp':'loyalHelp']}\n${allies.length?`${w.allies}: ${allies.map(mention).join(' ')}`:w.noAllies}${inspections.length?'\n'+w.inspections+': '+inspections.map(i=>`${mention(i.target)} — ${w[i.alignment]}`).join('; '):''}`;
}
function actionUI(g,id) {
  E.member(g,id); const w=dictionary(g.language), token=`q:${g.id}:${g.round}`;
  if(g.phase==='quest') {
    if(!g.team.includes(id)) throw new E.GameError('teamMember');
    if(Object.hasOwn(g.cards,id)) throw new E.GameError('submitted');
    const canFail=E.evil(g.roles[id])&&(g.magic!==id||g.roles[id]==='morgan');
    return {content:roleText(g,id)+'\n\n'+w.privatePrompt,components:[new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(token+':success').setLabel(w.success).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(token+':fail').setLabel(w.fail).setStyle(ButtonStyle.Danger).setDisabled(!canFail))]};
  }
  E.phase(g,'final'); if(Object.hasOwn(g.accusations,id)) throw new E.GameError('submitted');
  return {content:w.privatePrompt,components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(token+':accuse').setPlaceholder(w.accusation).setMinValues(2).setMaxValues(2)
    .addOptions(g.players.filter(p=>p!==id).map(p=>({label:`${g.players.indexOf(p)+1}. ${client.users.cache.get(p)?.username||p}`.slice(0,100),value:p}))))]};
}
return async function handleInteraction(i) {
  if(!i.isChatInputCommand()&&!i.isButton()&&!i.isStringSelectMenu()) return;
  if(i.isChatInputCommand()&&i.commandName!=='quest') return;
  let lang=language(i.locale);
  try {
    await i.deferReply(privateReply);
    if(!i.inGuild()||!i.channel?.isTextBased()||!i.channel.send) throw new E.GameError('unsupported');
    const key=`${i.guildId}:${i.channelId}`, id=i.user.id; let g=store.get(key); lang=g?.language||lang;
    let content=dictionary(lang).saved, components=[], announce=false;
    if(!i.isChatInputCommand()) {
      g=requireGame(key); const [prefix,gameId,round,action]=i.customId.split(':');
      if(prefix!=='q'||gameId!==g.id||Number(round)!==g.round) throw new E.GameError('stale');
      if(action==='accuse') { store.update(key,d=>E.accuse(d,id,i.values)); announce=true; }
      else if(['success','fail'].includes(action)) {
        const before=g.phase; store.update(key,d=>E.play(d,id,action)); announce=before!==store.get(key).phase;
      } else throw new E.GameError('stale');
    } else {
      const sub=i.options.getSubcommand(), opt=i.options;
      if(sub==='rules') { const w=dictionary(opt.getString('language')||lang); await i.editReply({content:`**${w.rulesTitle}**\n${w.rules}`}); return; }
      if(i.user.bot) throw new E.GameError('bot');
      if(sub==='create') {
        if(active(g)) throw new E.GameError('exists');
        lang=opt.getString('language')||language(i.locale);
        store.update(key,()=>({game:E.lobby(id,opt.getInteger('players'),lang,opt.getString('board')||'a')})); content=dictionary(lang).saved; announce=true;
      } else {
        g=requireGame(key);
        switch(sub) {
          case 'join': store.update(key,d=>E.join(d,id)); announce=true; break;
          case 'leave': store.update(key,d=>E.leave(d,id)); announce=true; break;
          case 'start': store.update(key,d=>E.start(d,id)); announce=true; break;
          case 'status': content=status(g); break;
          case 'role': content=roleText(g,id); break;
          case 'action': ({content,components}=actionUI(g,id)); break;
          case 'team': {
            const users=['player1','player2','player3','player4'].map(n=>opt.getUser(n)).filter(Boolean);
            if(users.some(u=>u.bot)) throw new E.GameError('bot');
            store.update(key,d=>E.selectTeam(d,id,users.map(u=>u.id),opt.getUser('magic').id)); announce=true; break;
          }
          case 'next': store.update(key,d=>E.transition(d,id,opt.getUser('leader').id,opt.getUser('amulet')?.id)); announce=true; break;
          case 'inspect': {
            const target=opt.getUser('player').id;
            const {value}=store.update(key,d=>({value:E.inspect(d,id,target)}));
            const w=dictionary(lang); content=`${w.inspectResult}: ${mention(target)} — **${w[value]}**`; announce=true; break;
          }
          case 'final': E.member(g,id); store.update(key,d=>E.openFinal(d)); announce=true; break;
          case 'language':
            if(id!==g.host) throw new E.GameError('host');
            store.update(key,d=>{d.language=opt.getString('value');}); lang=opt.getString('value'); content=dictionary(lang).saved; announce=true; break;
          case 'cancel':
            if(id!==g.host&&!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new E.GameError('permission');
            store.update(key,d=>{d.phase='cancelled';}); announce=true; break;
          default: throw new E.GameError('phase');
        }
      }
    }
    await i.editReply({content,components,allowedMentions:{parse:[]}});
    if(announce) {
      try { await i.channel.send({content:status(store.get(key)),allowedMentions:{parse:[]}}); }
      catch { await i.followUp({...privateReply,content:dictionary(lang).errors.internal}); }
    }
  } catch(error) {
    // Do not log raw Discord error objects: they may include private payloads or credentials.
    const content=dictionary(lang).errors[error instanceof E.GameError?error.code:'internal']||dictionary(lang).errors.internal;
    try { if(i.deferred||i.replied) await i.editReply({content,components:[]}); else await i.reply({...privateReply,content}); } catch { console.error('Could not acknowledge an interaction.'); }
    if(!(error instanceof E.GameError)) console.error('Interaction failed:',error.name);
  }
}
}
