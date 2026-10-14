import { PermissionFlagsBits as P } from 'discord.js';
import { writable } from '../security/permissions.js';
export async function installationHealth(ctx,guild) {
  const c=ctx.store.config(guild.id),me=await guild.members.fetchMe();
  const required=['ViewChannel','SendMessages','EmbedLinks','ReadMessageHistory','ManageRoles','BanMembers','KickMembers','ModerateMembers','ManageMessages','ManageChannels'];
  const missing=required.filter(k=>!me.permissions.has(P[k]));
  const integrity=ctx.store.get('PRAGMA quick_check').quick_check;
  let ok=integrity==='ok' && missing.length===0;
  const lines=[`Server: ${guild.name} (${guild.id})`,`Database: ${integrity}`,`Botpermissies: ${missing.length ? `ontbreekt ${missing.join(', ')}` : 'ok'}`];
  for(const key of ['hiring','dismissal','staffUpdates','changelog']) {
    try {await writable(guild,c.channels[key]);lines.push(`${key}: ok (${c.channels[key]})`);}
    catch(e) {ok=false;lines.push(`${key}: ${e.message}`);}
  }
  const managers=[...new Set([...c.roles.management,...(ctx.env.managementRoles || []),...(ctx.env.ownerRoles || [])])];
  lines.push(`Beheerrollen: ${managers.join(', ') || 'geen; Administrator/servereigenaar blijft bevoegd'}`);
  lines.push(`Hoogste botrol: ${me.roles.highest.name}; plaats deze boven de staffrangen.`);
  return {ok,lines};
}
