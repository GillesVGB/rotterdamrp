import { PermissionFlagsBits as P } from 'discord.js';
import { environment } from '../src/config.js';
const env=environment(process.env,false);
const keys=['ViewChannel','SendMessages','EmbedLinks','AttachFiles','ReadMessageHistory','AddReactions','UseExternalEmojis','ViewAuditLog','ManageRoles','ManageChannels','ManageWebhooks','BanMembers','KickMembers','ModerateMembers','ManageMessages','CreateEvents','ManageEvents'];
const permissions=keys.reduce((mask,key)=>mask|P[key],0n);
console.log(`https://discord.com/oauth2/authorize?client_id=${env.clientId}&scope=bot%20applications.commands&permissions=${permissions}&guild_id=${env.guildId}&disable_guild_select=true`);
