import { PermissionFlagsBits as P } from 'discord.js';
import { UserError } from '../utils/validation.js';

export const DANGEROUS = [P.Administrator,P.ManageGuild,P.ManageRoles,P.ManageChannels,P.ManageWebhooks,P.BanMembers,P.KickMembers,P.ModerateMembers,P.MentionEveryone];
export const hasDanger = permissions => DANGEROUS.some(p => permissions.has(p, false));
export function isTrusted(member, c, env) {
  return member.id === member.guild.ownerId || member.id === member.client.user.id || env.owners.includes(member.id) ||
    (env.ownerRoles || []).some(r=>member.roles.cache.has(r)) || (member.user.bot ? c.security.allowBots : c.security.allowUsers).includes(member.id);
}
export async function authorize(i, ctx, policy, commandKey) {
  if (!i.inGuild() || i.guildId !== ctx.env.guildId) throw new UserError('Deze bot werkt uitsluitend in de ingestelde server.');
  const member = await i.guild.members.fetch({user:i.user.id,force:policy.scope!=='public' || policy.owner===true});
  const c = ctx.store.config(i.guildId);
  if (policy.owner) {
    const explicitRole=(ctx.env.ownerRoles || []).some(r=>r!==i.guildId && member.roles.cache.has(r));
    const explicitUser=ctx.env.owners.includes(member.id) && (member.id===i.guild.ownerId || member.permissions.has(P.Administrator));
    if (!explicitRole && !explicitUser) throw new UserError('Alleen expliciet ingestelde configuratiebeheerders mogen dit beheren.');
  } else if (policy.scope !== 'public' && member.id !== i.guild.ownerId) {
    const groups = { management: ['management'], moderator: ['management','moderator'], support: ['management','moderator','support'] };
    const allowed = c.permissions[commandKey] ?? (groups[policy.scope] || []).flatMap(k => c.roles[k]);
    if (!allowed.some(r => member.roles.cache.has(r))) throw new UserError('Je hebt geen geconfigureerde rol voor dit command.');
    if (policy.discord && !member.permissions.has(policy.discord)) throw new UserError('Je mist de vereiste Discord-permissie.');
  }
  return { member, c };
}
export async function botPermissions(guild, flags) {
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(flags)) throw new UserError('De bot mist de vereiste Discord-permissies. Controleer /setup en de botrol.');
  return me;
}
export function hierarchy(actor, target, bot, c, env={}) {
  if (target.id === actor.id || target.id === target.guild.ownerId || target.id === bot.id || target.user.bot || (env.owners || []).includes(target.id) || (env.ownerRoles || []).some(r=>target.roles.cache.has(r)) || c.roles.protected.some(r => target.roles.cache.has(r))) throw new UserError('Deze gebruiker is beschermd of kan niet door dit command worden gemodereerd.');
  if (actor.id !== target.guild.ownerId && actor.roles.highest.comparePositionTo(target.roles.highest) <= 0) throw new UserError('Het doelwit heeft een gelijke of hogere rol dan jij.');
  if (bot.roles.highest.comparePositionTo(target.roles.highest) <= 0) throw new UserError('Het doelwit staat boven of gelijk aan de hoogste botrol.');
}
export function grantable(actor, role, bot) {
  if (!role || role.managed || role.id === role.guild.id || bot.roles.highest.comparePositionTo(role) <= 0) throw new UserError('Deze rankrol is niet toewijsbaar door de bot.');
  if (actor.id !== role.guild.ownerId && (actor.roles.highest.comparePositionTo(role) <= 0 || !actor.permissions.has(role.permissions))) throw new UserError('Je mag deze rankrol niet toekennen: rolpositie of rechten zijn te hoog.');
}
export async function writable(guild, channelId, { privateStaff = false, c } = {}) {
  if (!channelId) throw new UserError('Dit kanaal is nog niet ingesteld. Gebruik /setup.');
  const ch = await guild.channels.fetch(channelId);
  const me = await guild.members.fetchMe();
  if (!ch?.isTextBased() || ch.isThread() || !ch.permissionsFor(me)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks,P.ReadMessageHistory])) throw new UserError('Gebruik een tekstkanaal waar de bot kan lezen, schrijven en embeds sturen.');
  if (privateStaff) {
    const trusted = new Set([guild.id, me.roles.highest.id, ...me.roles.cache.keys(), ...c.roles.management]);
    if (ch.permissionsFor(guild.roles.everyone).has(P.ViewChannel)) throw new UserError('Het staffwaarschuwingkanaal is zichtbaar voor @everyone. Maak het privé.');
    for (const overwrite of ch.permissionOverwrites.cache.values()) {
      if (!overwrite.allow.has(P.ViewChannel)) continue;
      const role = guild.roles.cache.get(overwrite.id);
      if (!trusted.has(overwrite.id) && overwrite.id !== me.id && !role?.permissions.has(P.Administrator)) throw new UserError('Het staffwaarschuwingkanaal heeft een expliciete toegang voor een niet-managementrol/gebruiker.');
    }
  }
  return ch;
}
