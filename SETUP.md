# Quest Robot · 阿瓦隆2号

A bilingual Discord bot for **Quest standard edition**, with 4, 5 or 6 human players. No Director’s Cut or optional characters. Original implementation; the linked Blood on the Clocktower bot was an interaction reference, not copied source.

一个中英文 Discord 游戏机器人，支持 **Quest 普通版 4、5、6 人局**。不含导演剪辑版或可选角色。机器人负责主持流程，玩家负责讨论和推理；没有 AI 玩家。

## Quick start / 启动

Requires Node.js 22.12+ and a Discord application with a bot user.

1. In the [Discord Developer Portal](https://discord.com/developers/applications), create an application and bot. Copy its application ID, bot token, and your server ID (enable Discord Developer Mode to copy the server ID).
2. Invite it through OAuth2 / URL Generator with `bot` and `applications.commands` scopes. Give it **View Channels**, **Send Messages**, and **Use Application Commands** in the game channel. No Administrator, Manage Channels, Message Content or Server Members privileged intent is needed.
3. In the project folder, run:

```sh
npm ci
cp .env.example .env
```

4. Edit `.env` locally:

```dotenv
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_server_id
```

5. Register the command in your server and start:

```sh
npm run register
npm start
```

Keep the process and computer running during play. Registration calls Discord; the bot needs a working network connection. Leave the application's Interactions Endpoint URL empty when using this Gateway bot.

中文：在开发者后台创建应用和机器人，邀请到服务器，填写本地 `.env`，执行 `npm run register` 和 `npm start`。不要把 Token 发到聊天或提交到 Git。机器人运行期间电脑需要保持联网和唤醒。

## Play / 游戏操作

Use one dedicated server text channel per game. Concurrent games in different channels are supported. The bot uses the existing channel; it does not create channels or voice rooms. Use Discord permissions if you want to exclude spectators.

| Command | English | 中文 |
| --- | --- | --- |
| `/quest create players:4 language:zh board:a` | Create lobby, host automatically joins | 创建房间，房主自动加入；人数可选 4/5/6 |
| `/quest join` / `/quest leave` | Join or leave before start | 开始前加入或退出 |
| `/quest start` | Host starts a full lobby | 人数齐后房主开局 |
| `/quest role` | View your private role and known allies | 秘密查看身份、已知坏人、护符结果 |
| `/quest team player1:… player2:… magic:…` | Leader chooses exact required team; add player3/4 when needed | 当前领袖选队员和魔法，可补第三、第四人 |
| `/quest action` | Private buttons for quest cards; private select menu for final accusations | 秘密出牌按钮或最终指认菜单 |
| `/quest next leader:… amulet:…` | Outgoing leader chooses next leader; amulet required after quest 2 at 6 players | 本轮领袖交接；六人局第二轮后须指定护符持有人 |
| `/quest inspect player:…` | Amulet holder checks alignment privately | 护符持有人秘密查验阵营 |
| `/quest final` | Any player opens accusations after five minutes | 五分钟后任一玩家开启指认 |
| `/quest status` | View progress privately; mutations publish updates | 查看进度；阶段变更会发布公开进度 |
| `/quest rules language:en` | Read English or Chinese rules | 查看英文或中文规则 |
| `/quest language value:en` | Host changes game language at any time | 房主随时切换中英文 |
| `/quest cancel` | Host or Manage Server member cancels | 房主或管理服务器权限成员取消 |

After starting, **every player must use `/quest role` before discussion**. Private responses replace physical role cards and do not require DMs to be open. During a quest, all team members must submit, including players forced to Success. Submissions are final. Old action panels cannot affect a new game or quest.

开局后每人先执行 `/quest role`。任务队员都要执行 `/quest action` 出牌，即使规则要求必须成功。五分钟终局讨论后停止讨论，所有玩家秘密选择另外两名不同玩家；机器人等待全部提交，再统一判定，不提前公开指认或坏人身份。

The timer is enforced when `/quest final` is used, and survives restart. The bot does not mute players or auto-submit for missing players. If someone leaves after starting, the host can cancel and create a new game. There are no role replacements during a game.

## Standard rules / 普通版规则

| Players 人数 | Good 好人 | Evil 坏人 | Quest team sizes 任务人数 |
| --- | --- | --- | --- |
| 4 | 2 Loyal Servants 忠臣 | Morgan 摩根 + Scion 继承者 | A: 2,3,3,2 / B: 2,3,2,3 |
| 5 | 3 Loyal Servants 忠臣 | Morgan 摩根 + Scion 继承者 | 2,3,2,4,3 |
| 6 | 3 Loyal Servants 忠臣 | Morgan 摩根 + Minion 爪牙 + Changeling 换形者 | 2,3,4,3,4 |

- Random roles and first leader. No team approval vote. The leader may choose themselves, and assigns Magic to exactly one team member.
- Good always plays Success. Evil may play Success or Fail; Magic forces Success except for Morgan. A single Fail defeats **any** quest at these counts, including quest 4 at 5–6 players.
- At 4–5, Morgan knows Scion; Scion does not know Morgan. At 6, Morgan and Minion recognize each other; Changeling neither knows nor is known by them.
- After a non-terminal quest, the outgoing leader picks a new leader who has never led or held an amulet. Each player can lead only once.
- At 6 players, after quest 2, select a different amulet holder who has never led or held an amulet. The holder privately checks another player's alignment, not exact role. A target must never have held an amulet or been inspected. Holders cannot become leaders; inspected targets may become leaders. There is only one amulet at 6 players.
- Three successful quests immediately win for Good. Two failures at 4 players or three failures at 5–6 trigger five-minute discussion and Good’s Last Chance. Every player selects two other distinct players. Only Good selections count: their union must include all Evil and no Good. If every quest leader was Evil, Good wins even when the selections are incorrect. Otherwise Evil wins.

中文：身份和首任领袖随机；无组队表决。好人必须成功，坏人可成功或失败，魔法要求成功但摩根豁免。一张失败就使任务失败。领袖不可重复，持有过护符者不可当领袖。六人局第二轮后分配一次护符，只查阵营。三次成功好人胜；四人两次失败、五六人三次失败后进入五分钟讨论和最后指认。只统计好人指认的合集，须覆盖全部坏人且不能指到好人；若所有任务领袖都是坏人，好人胜。

Rule reference: [published Quest rulebook, Galápagos translation mirrored on Scribd](https://pt.scribd.com/document/827352875/quest-quest-regras-v1-0-08-23-br-264861), pages 4–11. This bot implements the base setup table, not the optional-character setup. Role artwork and rulebook prose are not bundled.

## Persistence and validation / 存档与验证

Games are atomically saved to `data/games.json` after every valid mutation and restored on restart. This file contains secret roles and unfinished submissions: restrict machine access and do not share it during a game. Files use owner-only permissions on macOS/Linux. Keep only one bot process writing the same data file. `.env`, saves and dependencies are excluded from Git.

```sh
npm test
npm run check
```

Tests cover rules, privacy, persistence and Discord interaction handling with local mocks. Live Discord connectivity requires your own credentials and is a separate validation step.

Source layout: `src/engine.js` rules; `src/interactions.js` Discord adapter; `src/i18n.js` English/Chinese; `src/store.js` save storage; `src/commands.js` command definitions.
