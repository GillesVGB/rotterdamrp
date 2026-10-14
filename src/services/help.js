import { randomUUID } from 'node:crypto';
import { ActionRowBuilder,StringSelectMenuBuilder } from 'discord.js';
import { definitions } from '../commands/registry.js';
import { helpCategories } from '../commands/utility/definitions.js';
import { payload } from '../utils/embeds.js';
import { UserError } from '../utils/validation.js';
import { pageButtons } from './views.js';

const typeLabels={user:'gebruiker',role:'Discord-rol',channel:'kanaal',string:'tekst',int:'getal',bool:'ja/nee'};
const permissionLabels={ManageRoles:'Rollen beheren',ManageMessages:'Berichten beheren',ManageChannels:'Kanalen beheren',ManageGuild:'Server beheren',BanMembers:'Leden bannen',KickMembers:'Leden kicken',ModerateMembers:'Leden modereren',ViewAuditLog:'Auditlog bekijken',CreateEvents:'Evenementen aanmaken',ManageEvents:'Evenementen beheren'};
export function helpEntries() {
  return definitions.flatMap(root=>root.subcommands ? root.subcommands.map(sub=>({...root,...sub,key:`${root.name}.${sub.name}`,command:`/${root.name} ${sub.name}`,helpCategory:root.helpCategory})) : [{...root,key:root.name,command:`/${root.name}`}]);
}
export function accessLabel(entry,c) {
  if(entry.scope==='public' || !entry.scope) return 'Alle serverleden.';
  if(entry.owner || entry.scope==='management') return 'Beheer, Administrator of servereigenaar.';
  return `${permissionLabels[entry.permission] || entry.permission} (${entry.permission}), of Beheer/Administrator/servereigenaar.`;
}
export function renderEntry(entry,c) {
  const options=entry.options || [];
  const usage=options.map(([type,name,,required])=>required ? `${name}:<${typeLabels[type] || type}>` : `[${name}:<${typeLabels[type] || type}>]`).join(' ');
  const params=options.map(([type,name,description,required,extra,max])=>{
    const bounds=Array.isArray(extra) ? ` Keuzes: ${extra.join(', ')}.` : type==='int' ? ` Bereik: ${extra}–${max}.` : type==='string' ? ` Maximaal ${max || 1000} tekens.` : '';
    return `• \`${name}\` (${required?'verplicht':'optioneel'}, ${typeLabels[type] || type}): ${description}.${bounds}`;
  }).join('\n');
  return `**${entry.command}**\n${entry.description}\n\`${entry.command}${usage ? ` ${usage}` : ''}\`\n${params ? `${params}\n` : ''}Toegang: ${accessLabel(entry,c)}`;
}
export function helpPages(c,category='alle') {
  if(!helpCategories.some(x=>x.value===category)) throw new UserError('Onbekende helpcategorie.');
  const entries=helpEntries().filter(e=>category==='alle' || e.helpCategory===category),result=[];
  let page='';
  for(const entry of entries) {
    const block=renderEntry(entry,c);
    if(block.length>3100) throw new Error(`Helptekst voor ${entry.key} past niet op een pagina.`);
    if(page && page.length+block.length+2>3100) {result.push(page);page='';}
    page+=(page?'\n\n':'')+block;
  }
  if(page) result.push(page);
  return result.length ? result : ['Geen commands in deze categorie.'];
}
export class HelpService {
  constructor(ctx) {this.ctx=ctx;}
  async execute(i,actor,c) {
    const category=i.options.getString('categorie') || 'alle',key=randomUUID();
    const label=helpCategories.find(x=>x.value===category)?.label;
    if(!label) throw new UserError('Onbekende helpcategorie.');
    this.ctx.store.run('INSERT INTO views VALUES (?,?,?,?,?,?,?)',key,i.guildId,i.user.id,'help',`Help • ${label}`,JSON.stringify(helpPages(c,category)),Date.now()+900000);
    return i.editReply(this.data(i.guild,this.ctx.store.get('SELECT * FROM views WHERE id=?',key),0));
  }
  data(guild,view,index) {
    const list=JSON.parse(view.pages);
    if(!Number.isInteger(index) || index<0 || index>=list.length) throw new UserError('Ongeldige helppagina.');
    const intro='Kies een categorie. Verplichte parameters staan tussen < >; optionele tussen [ ]. Beheer heeft toegang tot alle commands; moderatie gebruikt je Discord-permissies. De bot controleert ook zijn rechten en de rolhiërarchie.\n\n';
    const selector=new StringSelectMenuBuilder().setCustomId(`help:${view.id}:category`).setPlaceholder('Kies een commandcategorie').addOptions(helpCategories.map(c=>({label:c.label,value:c.value,default:view.title===`Help • ${c.label}`})));
    return {...payload(guild,this.ctx.store.config(guild.id),view.title,intro+list[index],{footer:`Pagina ${index+1}/${list.length} • Alleen voor jou • 15 minuten geldig`}),components:[new ActionRowBuilder().addComponents(selector).toJSON(),...(list.length>1 ? pageButtons(`help:${view.id}:page`,index,list.length) : [])]};
  }
  async handle(i,key,action,value) {
    const {store}=this.ctx,view=store.get('SELECT * FROM views WHERE id=? AND guild_id=? AND user_id=? AND command_key=?',key,i.guildId,i.user.id,'help');
    if(!view || view.expires_at<Date.now()) throw new UserError('Dit helppaneel is verlopen of behoort aan een andere gebruiker.');
    if(action==='category') {
      const category=i.values[0],label=helpCategories.find(x=>x.value===category)?.label;
      if(!label) throw new UserError('Onbekende helpcategorie.');
      const content=JSON.stringify(helpPages(store.config(i.guildId),category));
      store.run('UPDATE views SET title=?,pages=? WHERE id=?',`Help • ${label}`,content,key);
      return i.editReply(this.data(i.guild,{...view,title:`Help • ${label}`,pages:content},0));
    }
    if(action!=='page') throw new UserError('Onbekende helpactie.');
    return i.editReply(this.data(i.guild,view,Number(value)));
  }
}
