import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Store } from './store.js';
import { createHandler } from './interactions.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: { parse: [] } });
client.on(Events.InteractionCreate, createHandler(client, new Store()));
client.once(Events.ClientReady, () => console.log('Quest robot is online.'));
client.on(Events.Error, () => console.error('Discord connection error.'));
if (!process.env.DISCORD_TOKEN) throw new Error('Set DISCORD_TOKEN in .env before starting.');
try { await client.login(process.env.DISCORD_TOKEN); }
catch { console.error('Discord login failed. Check the token and network connection.'); process.exitCode = 1; client.destroy(); }
