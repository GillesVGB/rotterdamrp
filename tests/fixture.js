import { readFileSync } from 'node:fs';
import { Collection,PermissionsBitField,PermissionFlagsBits as P } from 'discord.js';
import { Store } from '../src/database/store.js';
import { createContext } from '../src/app.js';
export const IDs={guild:'123456789012345678',owner:'123456789012345679',actor:'123456789012345680',target:'123456789012345681',bot:'123456789012345682',channel:'123456789012345683',manage:'123456789012345684',support:'123456789012345685',mod:'123456789012345686',botRole:'123456789012345687',protect:'123456789012345688'};
export function defaults() {return JSON.parse(readFileSync(new URL('../config/default.json',import.meta.url),'utf8'));}
export function fixture() {
  const c=defaults(); c.roles.management=[IDs.manage];c.roles.support=[IDs.support];c.roles.moderator=[IDs.mod];c.roles.protected=[IDs.protect];
  c.roles.ranks=[{name:'Support',roleId:IDs.support,level:1},{name:'Moderator',roleId:IDs.mod,level:2}];
  for(const k of Object.keys(c.channels)) c.channels[k]=IDs.channel;
  const members=new Collection(),roles=new Collection(),bans=new Collection(),messages=new Collection(),records=[];
  const client={user:{id:IDs.bot,tag:'RLRP#0001'},users:{fetch:async uid=>members.get(uid)?.user || {id:uid,bot:false}},isReady:()=>true,ws:{ping:20}};
  const guild={id:IDs.guild,ownerId:IDs.owner,name:'Testguild',emojis:{cache:new Collection()},client};
  const role=(uid,position,permissions=[])=>({id:uid,name:uid,position,managed:false,guild,permissions:new PermissionsBitField(permissions),comparePositionTo(other){return position-other.position;}});
  for(const r of [role(IDs.guild,0),role(IDs.manage,80,[P.Administrator]),role(IDs.support,10),role(IDs.mod,20),role(IDs.botRole,90,[P.Administrator]),role(IDs.protect,5)]) roles.set(r.id,r);
  guild.roles={cache:roles,everyone:roles.get(IDs.guild),fetch:async uid=>roles.get(uid)};
  const user=uid=>({id:uid,username:uid,bot:uid===IDs.bot,createdAt:new Date(0),displayAvatarURL:()=>`https://cdn.discordapp.com/avatars/${uid}/abc.png`,send:async data=>records.push({dm:uid,data})});
  const member=(uid,roleId,permissions=[P.Administrator])=>({id:uid,user:user(uid),guild,client,displayName:uid,permissions:new PermissionsBitField(permissions),moderatable:true,kickable:true,bannable:true,communicationDisabledUntilTimestamp:null,
    roles:{highest:roles.get(roleId),cache:new Collection([[IDs.guild,roles.get(IDs.guild)],[roleId,roles.get(roleId)]]),async add(r){this.cache.set(r,roles.get(r));records.push({add:r});},async remove(rs){for(const r of Array.isArray(rs)?rs:[rs]) this.cache.delete(r);records.push({remove:rs});}},
    async timeout(ms){this.communicationDisabledUntilTimestamp=ms ? Date.now()+ms:null;records.push({timeout:uid,ms});},async kick(){members.delete(uid);records.push({kick:uid});}});
  const actor=member(IDs.actor,IDs.manage),target=member(IDs.target,IDs.support,[]),bot=member(IDs.bot,IDs.botRole),owner=member(IDs.owner,IDs.manage);
  [actor,target,bot,owner].forEach(m=>members.set(m.id,m));
  guild.members={cache:members,fetch:async input=>{const uid=typeof input==='object'?input.user:input;if(!members.has(uid)) throw Object.assign(new Error('Unknown member'),{code:10007});return members.get(uid);},fetchMe:async()=>bot,ban:async(uid,{reason})=>{bans.set(uid,{user:{id:uid},reason});records.push({ban:uid});},unban:async uid=>{if(!bans.has(uid)) throw Object.assign(new Error('Unknown ban'),{code:10026});bans.delete(uid);records.push({unban:uid});}};
  guild.bans={fetch:async uid=>{if(!bans.has(uid)) throw Object.assign(new Error('Unknown ban'),{code:10026});return bans.get(uid);}};
  const channel={id:IDs.channel,guild,name:'test',permissionOverwrites:{cache:new Collection(),edit:async(uid,data)=>records.push({overwrite:uid,data})},isTextBased:()=>true,isThread:()=>false,permissionsFor:()=>new PermissionsBitField(P.Administrator),messages:{fetch:async()=>messages,edit:async(uid,data)=>{records.push({edit:uid,data});}},send:async data=>{const uid=String(100000000000000000n+BigInt(messages.size));const message={id:uid,nonce:data.nonce ?? null,author:client.user,content:data.content || '',embeds:data.embeds || [],react:async reaction=>records.push({reaction})};messages.set(uid,message);records.push({send:data});return message;}};
  guild.channels={fetch:async uid=>{if(uid!==IDs.channel) throw new Error('Unknown channel');return channel;},cache:new Collection([[IDs.channel,channel]])};
  const scheduled=new Collection();guild.scheduledEvents={fetch:async uid=>uid?scheduled.get(uid):scheduled,create:async data=>{const e={...data,id:'123456789012345699',creatorId:IDs.bot,status:1,setStatus:async status=>{e.status=status;records.push({status});return e;}};scheduled.set(e.id,e);return e;}};
  client.guilds={fetch:async()=>guild,cache:new Collection([[IDs.guild,guild]])};
  const store=new Store(),env={guildId:IDs.guild,clientId:IDs.bot,owners:[IDs.owner],ownerRoles:[],token:'fixture-secret',fivemUrl:null,joinUrl:null};
  const ctx=createContext(env,{store,client,defaults:c});
  ctx.logger={log:async(...args)=>records.push({log:args}),error:async(...args)=>records.push({error:args})};
  const interaction=(name,opts={},sub=null,uid=IDs.actor)=>({commandName:name,user:members.get(uid).user,guild,guildId:guild.id,channel,channelId:channel.id,inGuild:()=>true,options:{getUser:k=>opts[k]?.user || opts[k] || null,getRole:k=>opts[k] ?? null,getString:k=>opts[k] ?? null,getBoolean:k=>opts[k] ?? null,getInteger:k=>opts[k] ?? null,getChannel:k=>opts[k] ?? null,getSubcommand:()=>sub},editReply:async data=>{records.push({reply:data});},deferReply:async()=>{},deferUpdate:async()=>{},reply:async data=>{records.push({reply:data});},followUp:async data=>{records.push({followUp:data});}});
  return {ctx,c,guild,channel,store,actor,target,bot,owner,members,roles,bans,messages,records,interaction,scheduled,role};
}
