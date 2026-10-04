# 单人模拟 / Solo simulation

单人模拟使用与正式对局相同的规则引擎，房主代所有玩家操作。

在 Discord 测试频道执行 `/quest simulate players:4 language:zh`，自动开始房主与三位虚拟玩家的模拟局。可以选 5/6 人和英文。

只有房主可以打开和使用模拟面板。面板私密显示所有角色；公开频道显示模拟标记与进度。先在选择菜单选够任务队员，再在下一步选择魔法接收者。出牌面板显示当前代操作的玩家、角色与魔法状态，点击“成功”或“失败”提交这一位玩家的牌，自动切换下一位；也可手动切换未出牌队员。规则禁止失败时，失败按钮不可用。所有队员出牌后统一结算，再点击“交接下一任领袖”。六人局有护符查验按钮。达到失败次数后，可跳过模拟讨论时间，测试正确或错误指认。

使用 `/quest simulate-panel` 重新打开面板；使用 `/quest cancel` 取消。正式多人局保持原规则，不能使用模拟按钮跳过讨论。面板每次操作后刷新，旧按钮不能重复执行。

Start with `/quest simulate players:4 language:en` (4, 5 or 6 players supported). Reopen the private panel with `/quest simulate-panel`.

1. Choose the required number of team members.
2. Assign the Magic token to one of them.
3. Submit each player's Success or Fail card separately; the panel automatically switches to the next player, or you can choose a pending player yourself.
4. After everyone submits, the quest resolves. Click **Assign next leader** to continue.
5. Six-player games include an amulet step. At the final phase, simulations allow skipping discussion and testing correct or incorrect accusations.

Secret role overviews and controls are host-only. Illegal Fail choices are disabled and validated by the engine. Morgan can still Fail while holding Magic. Regular multiplayer games keep the five-minute discussion requirement. Use `/quest cancel` to stop a game.
