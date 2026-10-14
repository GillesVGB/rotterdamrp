import { EmbedBuilder } from 'discord.js';
import { safe, truncate } from './validation.js';
export const NO_MENTIONS = { parse: [], repliedUser: false };
export function brandEmoji(guild,c,name) {
  const caches=[guild.client?.application?.emojis?.cache,guild.emojis?.cache].filter(Boolean);
  const explicit=c.brand[{rlogo:'logoEmojiId',upvote:'upvoteEmojiId',downvote:'downvoteEmojiId'}[name]];
  const usable=e=>e && e.available!==false && e.usable!==false;
  if(explicit) for(const cache of caches) {const found=cache.get(explicit);if(usable(found)) return found;}
  for(const cache of caches) {const found=cache.find(e=>e.name===name && usable(e));if(found) return found;}
  return null;
}
export const logo=(guild,c)=>brandEmoji(guild,c,'rlogo')?.toString() || '';
export function embed(guild, c, title, description = '', { user, error = false, footer, logo: withLogo = true } = {}) {
  const mark = withLogo ? logo(guild, c) : '';
  const e = new EmbedBuilder().setColor(error ? c.brand.errorColor : c.brand.color).setTitle(truncate(safe(title), 256))
    .setDescription(truncate(`${safe(description)}${mark ? `\n\n${mark}` : ''}`, 4096))
    .setFooter({ text: truncate(footer || `${c.brand.name} • ${guild.name}`, 2048) }).setTimestamp();
  if (user) e.setAuthor({ name: truncate(user.username || user.displayName, 256), iconURL: user.displayAvatarURL() });
  const icon=guild.iconURL?.({size:256}); if(icon) e.setThumbnail(icon);
  return e;
}
export function payload(guild, c, title, description, opts) { return { embeds: [embed(guild, c, title, description, opts).toJSON()], allowedMentions: NO_MENTIONS }; }
