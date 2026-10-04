import { SlashCommandBuilder } from 'discord.js';
const local=(b,en,zh)=>b.setDescription(en).setDescriptionLocalizations({'zh-CN':zh,'zh-TW':zh});
const user=(b,name,en,zh,required=true)=>b.addUserOption(o=>local(o.setName(name),en,zh).setRequired(required));
const command=local(new SlashCommandBuilder().setName('quest').setDMPermission(false),'Play Quest standard edition','游玩阿瓦隆2号普通版');
function sub(name,en,zh,extend=b=>b) { command.addSubcommand(b=>extend(local(b.setName(name),en,zh))); }
sub('create','Create a lobby (host joins automatically)','创建房间（房主自动加入）',b=>b
  .addIntegerOption(o=>local(o.setName('players'),'Number of players','玩家人数').setRequired(true).addChoices({name:'4',value:4},{name:'5',value:5},{name:'6',value:6}))
  .addStringOption(o=>local(o.setName('language'),'Game language','游戏语言').addChoices({name:'English',value:'en'},{name:'简体中文',value:'zh'}))
  .addStringOption(o=>local(o.setName('board'),'Four-player board side','四人局任务板面').addChoices({name:'A · 2-3-3-2',value:'a'},{name:'B · 2-3-2-3',value:'b'})));
sub('join','Join this lobby','加入房间'); sub('leave','Leave this lobby','退出房间'); sub('start','Host: start a full lobby','房主：开始游戏');
sub('status','Show public game progress','查看公开游戏进度'); sub('role','Privately view your role and information','秘密查看你的身份与信息');
sub('action','Privately submit a quest card or final accusation','秘密提交任务牌或最终指认');
sub('team','Leader: select the quest team and Magic','领袖：选择队员与魔法',b=>{
  user(b,'player1','First team member','第一名队员'); user(b,'player2','Second team member','第二名队员'); user(b,'magic','Magic token recipient','魔法接收者');
  user(b,'player3','Third team member','第三名队员',false); return user(b,'player4','Fourth team member','第四名队员',false);
});
sub('next','Outgoing leader: choose next leader and optional amulet holder','本轮领袖：指定新领袖和护符持有人',b=>{user(b,'leader','Next leader','下一任领袖');return user(b,'amulet','Required after quest 2 in six-player games','六人局第二轮之后必填',false);});
sub('inspect','Amulet holder: privately check alignment','护符持有人：秘密查验阵营',b=>user(b,'player','Player to inspect','查验对象'));
sub('final','Open accusations after five minutes of discussion','五分钟讨论后开启最终指认');
sub('language','Host: switch the public game language','房主：切换公开游戏语言',b=>b.addStringOption(o=>local(o.setName('value'),'Game language','游戏语言').setRequired(true).addChoices({name:'English',value:'en'},{name:'简体中文',value:'zh'})));
sub('cancel','Host or administrator: cancel this game','房主或管理员：取消游戏');
sub('rules','Read the standard rules','查看普通版规则',b=>b.addStringOption(o=>local(o.setName('language'),'Rules language','规则语言').addChoices({name:'English',value:'en'},{name:'简体中文',value:'zh'})));
sub('simulate','Start a local solo simulation with virtual players','开始单人模拟局，自动加入虚拟玩家',b=>b
  .addIntegerOption(o=>local(o.setName('players'),'Simulated player count','模拟人数').addChoices({name:'4',value:4},{name:'5',value:5},{name:'6',value:6}))
  .addStringOption(o=>local(o.setName('language'),'Simulation language','模拟语言').addChoices({name:'English',value:'en'},{name:'简体中文',value:'zh'})));
sub('simulate-panel','Host: reopen the private simulation controls','房主：重新打开私密模拟面板');
export const commands=[command.toJSON()];
