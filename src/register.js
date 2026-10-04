import { REST, Routes } from 'discord.js';
import { commands } from './commands.js';
const {DISCORD_TOKEN:token,DISCORD_CLIENT_ID:clientId,DISCORD_GUILD_ID:guildId}=process.env;
if(!token||!clientId||!guildId) throw new Error('Set DISCORD_TOKEN, DISCORD_CLIENT_ID and DISCORD_GUILD_ID in .env.');
const rest=new REST({version:'10'}).setToken(token);
// Upsert only this application's Quest command; preserve unrelated commands.
try {
  for(const command of commands) await rest.post(Routes.applicationGuildCommands(clientId,guildId),{body:command});
  console.log('Quest command registered for the configured server.');
} catch {
  console.error('Command registration failed. Check credentials, server access and network connectivity.');
  process.exitCode=1;
}
