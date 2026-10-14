import { randomUUID } from 'node:crypto';
import { PermissionFlagsBits as P } from 'discord.js';
import { embed, payload, NO_MENTIONS } from '../utils/embeds.js';
import { noMassMentions, text, url, pages, UserError } from '../utils/validation.js';
import { writable } from '../security/permissions.js';
import { pageButtons } from './views.js';
export class CommunicationService {
  constructor(ctx) { this.ctx=ctx; }
  async execute(i,actor,c) {
    const {store,logger}=this.ctx;
    if (i.commandName==='changelog') {
      const ch=await writable(i.guild,c.channels.changelog), key=randomUUID();
      if(!ch.permissionsFor(await i.guild.members.fetchMe()).has(P.AttachFiles)) throw new UserError('AttachFiles ontbreekt voor de changelogbanner.');
      const title=text(i.options.getString('naam'),100),version=i.options.getString('versie'),content=noMassMentions(text(i.options.getString('inhoud'),6000));
      const heading=version ? `${title} ${text(version,50)}` : title;
      const chunks=pages(content,1800).map((chunk,index,all)=>payload(i.guild,c,'Rotterdam Roleplay — Changelog',`**${heading}**\n\n${chunk}`,{footer:`Pagina ${index+1}/${all.length}`}));
      chunks.forEach(p=>{p.embeds[0].image={url:'attachment://rlrp-banner.png'};});
      const navigation=pageButtons(`changelog:${key}`,0,chunks.length);
      store.transaction(()=>{store.run('INSERT INTO changelogs VALUES (?,?,?,?,?)',key,i.guildId,i.user.id,JSON.stringify(chunks),Date.now()); store.queue(i.guildId,ch.id,{...chunks[0],brandAsset:'banner',...(navigation.length ? {components:navigation} : {})});});
      await logger.log(i.guild,'system','Changelog ingepland',{actor:i.user.id,reason:heading,result:'Toegevoegd aan de verzendwachtrij'});
      return i.editReply(payload(i.guild,c,'Changelog ingepland',`${chunks.length} pagina's.`));
    }
    const ch=await writable(i.guild,i.options.getChannel('kanaal')?.id || i.channelId);
    let data;
    if (i.commandName==='say') {
      const content=noMassMentions(text(i.options.getString('bericht'),1900));
      data={content,allowedMentions:NO_MENTIONS};
    } else {
      const color=i.options.getString('kleur');
      if (!/^#[a-f0-9]{6}$/i.test(color)) throw new UserError('Kleur moet #RRGGBB zijn.');
      const e=embed(i.guild,c,noMassMentions(text(i.options.getString('titel'),256)),noMassMentions(text(i.options.getString('beschrijving'),3500)),{footer:i.options.getString('footer') || undefined});
      e.setColor(color); const thumbnail=i.options.getString('thumbnail'); if (thumbnail) e.setThumbnail(url(thumbnail));
      data={embeds:[e.toJSON()],allowedMentions:NO_MENTIONS};
    }
    store.queue(i.guildId,ch.id,data);
    await logger.log(i.guild,'system',`${i.commandName} verstuurd`,{actor:i.user.id,reason:`Kanaal ${ch.id}`,result:'In persistente verzendwachtrij'});
    return i.editReply(payload(i.guild,c,'Bericht ingepland',`Doelkanaal: <#${ch.id}>`));
  }
  async button(i,key,index) {
    const row=this.ctx.store.get('SELECT * FROM changelogs WHERE id=? AND guild_id=?',key,i.guildId);
    if (!row) throw new UserError('Changelog ontbreekt.');
    const list=JSON.parse(row.pages), n=Number(index);
    if (!Number.isInteger(n) || n<0 || n>=list.length) throw new UserError('Ongeldige pagina.');
    // Navigatie verandert uitsluitend de weergegeven pagina van onveranderlijke opgeslagen inhoud.
    const navigation=pageButtons(`changelog:${key}`,n,list.length);
    return i.editReply({...list[n],...(navigation.length ? {components:navigation} : {})});
  }
}
