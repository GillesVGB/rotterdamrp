import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { staffCommands } from './staff/definitions.js';
import { moderationCommands } from './moderation/definitions.js';
import { communityCommands } from './community/definitions.js';
import { utilityCommands } from './utility/definitions.js';
const category=(commands,helpCategory)=>commands.map(d=>({...d,helpCategory}));
export const definitions = [...category(staffCommands,'staff'),...category(moderationCommands,'moderatie'),
  ...communityCommands.map(d=>({...d,helpCategory:['apv','regels'].includes(d.name)?'documenten':d.name==='fivem'?'fivem':'community'})),
  ...utilityCommands.map(d=>({...d,helpCategory:['say','embed','changelog'].includes(d.name)?'communicatie':'beheer'}))];
function options(builder, opts = []) {
  const methods = { user: 'addUserOption', role:'addRoleOption', string: 'addStringOption', int: 'addIntegerOption', bool: 'addBooleanOption', channel: 'addChannelOption' };
  for (const [type,name,description,required,extra,max] of opts) builder[methods[type]](o => {
    o.setName(name).setDescription(description).setRequired(required);
    if (type === 'string') { o.setMaxLength(max || 1000); if (Array.isArray(extra)) o.addChoices(...extra.map(x => ({ name:x, value:x }))); }
    if (type === 'int') o.setMinValue(extra).setMaxValue(max);
    if (type === 'channel') o.addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement);
    return o;
  });
  return builder;
}
export function builders() {
  return definitions.map(d => {
    const b = new SlashCommandBuilder().setName(d.name).setDescription(d.description).setDMPermission(false);
    // Beheer kan ook zonder de individuele Discord-permissies commands gebruiken.
    // Daarom controleert iedere handler de rechten opnieuw op de server.
    if (d.subcommands) for (const sub of d.subcommands) b.addSubcommand(s => options(s.setName(sub.name).setDescription(sub.description), sub.options));
    else options(b, d.options);
    return b;
  });
}
export function policy(name, sub = null) {
  const d = definitions.find(x => x.name === name);
  if (!d) throw new Error('Command ontbreekt in registry.');
  const s = sub ? d.subcommands?.find(x => x.name === sub) : null;
  if (sub && !s) throw new Error('Subcommand ontbreekt in registry.');
  const merged = { ...d, ...s };
  return { scope: merged.scope || 'public', owner: merged.owner || false, discord: merged.permission ? PermissionFlagsBits[merged.permission] : null };
}
export const commandKeys = () => definitions.flatMap(d => d.subcommands ? d.subcommands.map(s => `${d.name}.${s.name}`) : [d.name]);
