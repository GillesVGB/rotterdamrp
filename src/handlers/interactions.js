import { MessageFlags } from 'discord.js';
import { staffCommands } from '../commands/staff/definitions.js';
import { moderationCommands } from '../commands/moderation/definitions.js';
import { policy } from '../commands/registry.js';
import { authorize } from '../security/permissions.js';
import { UserError, text } from '../utils/validation.js';
import { payload } from '../utils/embeds.js';
import { viewButton,showView } from '../services/views.js';
const staffNames=new Set(staffCommands.map(x=>x.name)), modNames=new Set(moderationCommands.map(x=>x.name));
export function serviceFor(name) {
  if(name==='help') return 'help';
  if(staffNames.has(name)) return 'staff'; if(modNames.has(name)) return 'moderation';
  if(name==='giveawaybeheer') return 'giveaways';
  if(['apv','regels'].includes(name)) return 'documents';
  if(name==='evenement') return 'events'; if(name==='fivem') return 'fivem';
  if(['say','embed','changelog'].includes(name)) return 'communication'; if(name==='systeem') return 'system';
  throw new Error(`Geen handler voor ${name}`);
}
async function system(ctx,i,actor,c) {
  const sub=i.options.getSubcommand(),{store}=ctx;
  if(sub==='status') {
    const pending=store.get("SELECT COUNT(*) AS n FROM outbox WHERE state='pending'").n;
    const uncertain=store.get("SELECT COUNT(*) AS n FROM actions WHERE state='uncertain'").n;
    return i.editReply(payload(i.guild,c,'Systeemstatus',`Database: ${store.get('PRAGMA quick_check').quick_check}\nGateway: ${ctx.client.ws.ping}ms\nVerzendwachtrij: ${pending}\nActies die controle vereisen: ${uncertain}\nGeplande taken draaien iedere 10 seconden.`));
  }
  if(sub==='acties') {
    const rows=store.all("SELECT * FROM actions WHERE guild_id=? AND state='uncertain' ORDER BY created_at DESC",i.guildId);
    return showView(ctx,i,'Acties: handmatige controle vereist',rows.map(r=>`\`${r.id}\` • ${r.kind} • ${r.target ? `<@${r.target}>` : 'kanaal/systeem'}\n${r.details}\n${r.error || 'Proces stopte voordat de uitkomst bevestigd was.'}`).join('\n\n'),'systeem.acties');
  }
  const key=i.options.getString('id'),reason=text(i.options.getString('reden'));
  const action=store.get("SELECT * FROM actions WHERE id=? AND guild_id=? AND state='uncertain'",key,i.guildId);
  if(!action) throw new UserError('Geen onderbroken actie met dit ID.');
  store.finish(key,'reviewed',reason); await ctx.logger.log(i.guild,'system','Onderbroken actie handmatig afgehandeld',{actor:i.user.id,reason:`${key}: ${reason}`});
  return i.editReply(payload(i.guild,c,'Controle geregistreerd',key));
}
export async function interaction(ctx,i) {
  if(!i.isChatInputCommand() && !i.isButton() && !i.isAnySelectMenu() && !i.isModalSubmit()) return;
  let update=false;
  try {
    if(!i.inGuild() || i.guildId!==ctx.env.guildId) throw new UserError('Deze bot werkt uitsluitend in de ingestelde server.');
    const count=ctx.store.hit(i.guildId,i.user.id,'interaction-rate',10000);
    if(count>12) throw new UserError('Te veel interacties. Probeer over 10 seconden opnieuw.');
    if(i.isChatInputCommand()) {
      await i.deferReply({flags:MessageFlags.Ephemeral});
      const sub=i.options.getSubcommand(false), key=`${i.commandName}${sub ? `.${sub}` : ''}`;
      const auth=await authorize(i,ctx,policy(i.commandName,sub),key);
      if(policy(i.commandName,sub).scope!=='public' && ctx.store.hit(i.guildId,i.user.id,`command:${key}`,10000)>3) throw new UserError('Dit gevoelige command is tijdelijk begrensd. Wacht 10 seconden.');
      const service=serviceFor(i.commandName),target=i.options.getUser('gebruiker')?.id || i.options.getString('gebruiker_id');
      const resource=service==='events' ? 'events:tick' : service==='giveaways' && i.commandName==='giveawaybeheer' ? `draw:${i.options.getString('id')}` : target ? `member:${target}` : `channel:${i.channelId}`;
      await ctx.mutex.run(resource,async()=>{
        const current=policy(i.commandName,sub).scope==='public' ? auth : await authorize(i,ctx,policy(i.commandName,sub),key);
        return service==='system' ? system(ctx,i,current.member,current.c) : ctx[service].execute(i,current.member,current.c);
      });
    } else {
      const [type,...parts]=i.customId.split(':');
      update=['view','changelog','help'].includes(type);
      if(update) await i.deferUpdate(); else await i.deferReply({flags:MessageFlags.Ephemeral});
      await authorize(i,ctx,{scope:'public'},'public');
      if(type==='view') await viewButton(ctx,i,parts[0],parts[1]);
      else if(type==='help') await ctx.help.handle(i,parts[0],parts[1],parts[2]);
      else if(type==='changelog') await ctx.communication.button(i,parts[0],parts[1]);
      else if(type==='giveaway') await ctx.mutex.run(`draw:${parts[0]}`,()=>ctx.giveaways.join(i,parts[0]));
      else if(type==='event') await ctx.mutex.run('events:tick',()=>ctx.events.button(i,parts[0],parts[1]));
      else if(type==='accept') await ctx.documents.button(i,parts[0]);
      else throw new UserError('Onbekende interactie.');
    }
  } catch(e) {
    const c=ctx.store.config(ctx.env.guildId), message=e instanceof UserError ? e.message : 'De actie kon niet worden bevestigd. Controleer rechten en systeemlogs; herhaal een wijziging niet blind.';
    if(!(e instanceof UserError)) await ctx.logger.error(i.guild,'Interactie mislukt',e);
    const data=i.guild ? payload(i.guild,c,'Actie niet uitgevoerd of niet bevestigd',message,{error:true}) : {content:message};
    try {
      if(i.replied || (i.deferred && update)) await i.followUp({...data,flags:MessageFlags.Ephemeral});
      else if(i.deferred) await i.editReply(data);
      else await i.reply({...data,flags:MessageFlags.Ephemeral});
    } catch(err) { console.error(`Interactieantwoord niet bezorgd: ${err.code || 'API-fout'}`); }
  }
}
