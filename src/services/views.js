import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { randomUUID } from 'node:crypto';
import { pages, UserError } from '../utils/validation.js';
import { payload } from '../utils/embeds.js';
import { authorize } from '../security/permissions.js';
import { policy } from '../commands/registry.js';
export const pageButtons = (prefix, index, count) => count > 1 ? [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`${prefix}:${Math.max(0,index-1)}`).setLabel('◀ Vorige').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
  new ButtonBuilder().setCustomId(`${prefix}:${Math.min(count-1,index+1)}`).setLabel('▶ Volgende').setStyle(ButtonStyle.Secondary).setDisabled(index === count-1)
).toJSON()] : [];
export async function showView(ctx, i, title, description, commandKey = null) {
  const key = randomUUID(), chunks = pages(description);
  ctx.store.run('INSERT INTO views VALUES (?,?,?,?,?,?,?)', key, i.guildId, i.user.id, commandKey, title, JSON.stringify(chunks), Date.now()+900000);
  await i.editReply(viewPayload(ctx, i.guild, ctx.store.get('SELECT * FROM views WHERE id=?', key), 0));
}
export function viewPayload(ctx, guild, view, index) {
  const chunks = JSON.parse(view.pages);
  if (!Number.isInteger(index) || index < 0 || index >= chunks.length) throw new UserError('Ongeldige pagina.');
  return { ...payload(guild, ctx.store.config(guild.id), view.title, chunks[index], { footer: `Pagina ${index+1}/${chunks.length}` }), components: chunks.length > 1 ? pageButtons(`view:${view.id}`,index,chunks.length) : [] };
}
export async function viewButton(ctx, i, key, index) {
  const view = ctx.store.get('SELECT * FROM views WHERE id=? AND guild_id=?', key, i.guildId);
  if (!view || view.expires_at < Date.now() || view.user_id !== i.user.id) throw new UserError('Deze pagina is verlopen of behoort aan een andere gebruiker.');
  if (view.command_key) { const [name,sub] = view.command_key.split('.'); await authorize(i,ctx,policy(name,sub),view.command_key); }
  await i.editReply(viewPayload(ctx,i.guild,view,Number(index)));
}
