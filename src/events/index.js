import { Events, AuditLogEvent as A } from 'discord.js';
import { interaction } from '../handlers/interactions.js';
import { truncate } from '../utils/validation.js';
import { redact } from '../services/logging.js';

const auditActions = new Map([
  [A.ChannelCreate, ['channelChanges', 'Kanaal gemaakt']],
  [A.ChannelDelete, ['channelChanges', 'Kanaal verwijderd']],
  [A.ChannelUpdate, ['channelChanges', 'Kanaal gewijzigd']],
  [A.ChannelOverwriteCreate, ['channelChanges', 'Kanaalrechten toegevoegd']],
  [A.ChannelOverwriteUpdate, ['channelChanges', 'Kanaalrechten gewijzigd']],
  [A.ChannelOverwriteDelete, ['channelChanges', 'Kanaalrechten verwijderd']],
  [A.RoleCreate, ['roles', 'Rol gemaakt']],
  [A.RoleDelete, ['roles', 'Rol verwijderd']],
  [A.RoleUpdate, ['roles', 'Rol gewijzigd']],
  [A.MemberRoleUpdate, ['roles', 'Lidrollen gewijzigd', true]],
  [A.MemberBanAdd, ['moderation', 'Lid geband', true]],
  [A.MemberBanRemove, ['moderation', 'Lid unbanned', true]],
  [A.MemberKick, ['moderation', 'Lid gekickt', true]],
  [A.MemberUpdate, ['members', 'Lid gewijzigd', true]],
  [A.MessageDelete, ['messages', 'Bericht verwijderd', true]],
  [A.MessageBulkDelete, ['messages', 'Berichten in bulk verwijderd']],
  [A.WebhookCreate, ['channelChanges', 'Webhook gemaakt']],
  [A.WebhookUpdate, ['channelChanges', 'Webhook gewijzigd']],
  [A.WebhookDelete, ['channelChanges', 'Webhook verwijderd']],
  [A.GuildUpdate, ['system', 'Serverinstellingen gewijzigd']]
]);

// Auditlogs voegen uitsluitend feitelijke uitvoerdersinformatie toe aan gewone logs.
export async function logAuditEntry(ctx, entry, guild) {
  if (guild?.id !== ctx.env.guildId) return;
  const definition = auditActions.get(entry.action);
  if (!definition || !ctx.store.onceAudit(entry.id)) return;
  const [category, label, userTarget] = definition;
  const object = entry.targetId || entry.target?.id || null;
  await ctx.logger.log(guild, category, `${label} • auditlog`, {
    actor: entry.executorId || entry.executor?.id || null,
    target: userTarget ? object : null,
    reason: `${entry.reason || 'Geen reden in auditlog'}${object && !userTarget ? `; object ${object}` : ''}`,
    result: `Vastgelegd in Discord-auditlog ${entry.id}`
  });
}

export function wireEvents(ctx) {
  const { client, logger, env, store } = ctx;
  const safe = (name, fn) => client.on(name, (...args) => {
    Promise.resolve().then(() => fn(...args)).catch(error => {
      const guild = args.find(value => value?.guild)?.guild || args.find(value => value?.id === env.guildId) || null;
      return logger.error(guild, `Event ${name}`, error).catch(logError => console.error(redact(logError.message, env)));
    });
  });
  const inGuild = guild => guild?.id === env.guildId;
  safe(Events.InteractionCreate, value => interaction(ctx, value));
  safe(Events.GuildAuditLogEntryCreate, (entry, guild) => logAuditEntry(ctx, entry, guild));
  safe(Events.GuildMemberAdd, member => inGuild(member.guild) && logger.log(member.guild, 'members', 'Lid toegetreden', {
    target: member.id,
    result: `Account aangemaakt op ${member.user.createdAt.toISOString()}`
  }));
  safe(Events.GuildMemberRemove, member => inGuild(member.guild) && logger.log(member.guild, 'members', 'Lid vertrokken', { target: member.id }));
  safe(Events.GuildMemberUpdate, async (old, current) => {
    if (!inGuild(current.guild)) return;
    const added = current.roles.cache.filter(role => !old.roles.cache.has(role.id));
    const removed = old.roles.cache.filter(role => !current.roles.cache.has(role.id));
    if (added.size || removed.size) await logger.log(current.guild, 'roles', 'Lidrollen gewijzigd', {
      target: current.id,
      reason: `Toegevoegd: ${[...added.keys()].join(', ') || '—'}; verwijderd: ${[...removed.keys()].join(', ') || '—'}`,
      result: 'Event ontvangen; uitvoerder indien beschikbaar via het afzonderlijke auditlog.'
    });
  });
  safe(Events.MessageDelete, async message => {
    if (!inGuild(message.guild)) return;
    const c = store.config(message.guild.id);
    await logger.log(message.guild, 'messages', 'Bericht verwijderd', {
      target: message.author?.id || null,
      reason: `Kanaal ${message.channelId}, bericht ${message.id}${c.logging.messageContent && message.content ? `; inhoud: ${truncate(message.content, 600)}` : ''}`,
      result: 'Uitvoerder niet uit dit event vast te stellen; inhoud van uncached berichten niet beschikbaar.'
    });
  });
  safe(Events.MessageBulkDelete, (messages, channel) => inGuild(channel.guild) && logger.log(channel.guild, 'messages', 'Berichten in bulk verwijderd', {
    reason: `Kanaal ${channel.id}`, result: `${messages.size} berichten`
  }));
  safe(Events.MessageUpdate, async (old, current) => {
    if (!inGuild(current.guild) || old.content === current.content || current.author?.id === client.user.id) return;
    const c = store.config(current.guild.id);
    await logger.log(current.guild, 'messages', 'Bericht aangepast', {
      actor: current.author?.id || null,
      reason: `Kanaal ${current.channelId}, bericht ${current.id}${c.logging.messageContent ? `; oud: ${truncate(old.content, 250)}; nieuw: ${truncate(current.content, 250)}` : ''}`
    });
  });
  for (const [event, category, label] of [
    [Events.ChannelCreate, 'channelChanges', 'Kanaal gemaakt'],
    [Events.ChannelDelete, 'channelChanges', 'Kanaal verwijderd'],
    [Events.GuildRoleCreate, 'roles', 'Rol gemaakt'],
    [Events.GuildRoleDelete, 'roles', 'Rol verwijderd']
  ]) safe(event, object => inGuild(object.guild) && logger.log(object.guild, category, label, {
    reason: `${object.name} (${object.id})`, result: 'Event ontvangen; uitvoerder indien beschikbaar via het afzonderlijke auditlog.'
  }));
  safe(Events.ChannelUpdate, (old, current) => inGuild(current.guild) && logger.log(current.guild, 'channelChanges', 'Kanaal gewijzigd', {
    reason: `${current.name} (${current.id})`
  }));
  safe(Events.GuildRoleUpdate, (old, current) => inGuild(current.guild) && logger.log(current.guild, 'roles', 'Rol gewijzigd', {
    reason: `${current.name} (${current.id}); permissies ${old.permissions.bitfield} ➜ ${current.permissions.bitfield}`
  }));
  for (const [event, label] of [[Events.GuildBanAdd, 'Lid geband'], [Events.GuildBanRemove, 'Lid unbanned']]) {
    safe(event, ban => inGuild(ban.guild) && logger.log(ban.guild, 'moderation', label, {
      target: ban.user.id, reason: ban.reason || 'Geen reden beschikbaar in event', result: 'Event ontvangen; uitvoerder indien beschikbaar via het afzonderlijke auditlog.'
    }));
  }
  safe(Events.GuildUpdate, (old, current) => inGuild(current) && logger.log(current, 'system', 'Serverinstellingen gewijzigd', {
    reason: `Verificatieniveau ${old.verificationLevel} ➜ ${current.verificationLevel}; MFA ${old.mfaLevel} ➜ ${current.mfaLevel}`
  }));
  safe(Events.WebhooksUpdate, channel => inGuild(channel.guild) && logger.log(channel.guild, 'channelChanges', 'Webhookwijziging waargenomen', {
    reason: `Kanaal ${channel.id}`, result: 'Event ontvangen; uitvoerder indien beschikbaar via het afzonderlijke auditlog.'
  }));
  safe(Events.Error, error => logger.error(client.guilds.cache.get(env.guildId), 'Discord-clientfout', error));
  safe(Events.ShardError, error => logger.error(client.guilds.cache.get(env.guildId), 'Gatewayfout', error));
  safe(Events.Warn, message => client.guilds.cache.get(env.guildId)
    ? logger.log(client.guilds.cache.get(env.guildId), 'system', 'Discord-waarschuwing', { result: message })
    : console.warn('Discord-waarschuwing ontvangen vóór guildverbinding.'));
}
