import test from 'node:test';
import assert from 'node:assert/strict';
import { environment,RLRP_GUILD_ID,RLRP_MANAGEMENT_ROLE_ID } from '../src/config.js';
import { Store } from '../src/database/store.js';
import { defaults,IDs,fixture } from './fixture.js';
import { installationHealth } from '../src/services/health.js';

test('RLRP Beheer en registratie zijn automatisch ingesteld met alleen de drie hostingwaarden',()=>{
  const env=environment({DISCORD_TOKEN:'test-token',DISCORD_CLIENT_ID:IDs.bot,DISCORD_GUILD_ID:RLRP_GUILD_ID});
  assert.deepEqual(env.managementRoles,[RLRP_MANAGEMENT_ROLE_ID]);assert.equal(env.registerOnStart,true);
});
test('extra beheerrollen blijven geldig en @everyone wordt geweigerd',()=>{
  const input={DISCORD_CLIENT_ID:IDs.bot,DISCORD_GUILD_ID:IDs.guild,MANAGEMENT_ROLE_IDS:IDs.manage};
  assert.deepEqual(environment(input,false).managementRoles,[IDs.manage]);
  assert.throws(()=>environment({...input,MANAGEMENT_ROLE_IDS:IDs.guild},false),/everyone/);
});
test('vaste RLRP-publicatiekanalen gelden ook voor oude databaseconfig en na import',()=>{
  const s=new Store();try {
    const old=defaults();for(const key of ['hiring','dismissal','staffUpdates','changelog']) old.channels[key]=IDs.channel;
    s.init(RLRP_GUILD_ID,old);
    const expected={hiring:'1560050091245699245',dismissal:'1560050091245699245',staffUpdates:'1560050091245699245',changelog:'1226509287459655704'};
    for(const [key,value] of Object.entries(expected)) assert.equal(s.config(RLRP_GUILD_ID).channels[key],value);
    s.saveConfig(RLRP_GUILD_ID,old,1);
    const saved=JSON.parse(s.get('SELECT body FROM config').body);
    for(const [key,value] of Object.entries(expected)) assert.equal(saved.channels[key],value);
    assert.equal(s.config(RLRP_GUILD_ID).revision,2);
  }finally {s.close();}
});
test('installatiediagnose controleert werkelijk database, botrechten en publicatiekanalen',async()=>{
  const f=fixture();try {
    const report=await installationHealth(f.ctx,f.guild);assert.equal(report.ok,true);
    assert.match(report.lines.join('\n'),/Database: ok/);
    f.guild.channels.fetch=async()=>{throw new Error('Missing Access');};
    const failed=await installationHealth(f.ctx,f.guild);assert.equal(failed.ok,false);assert.match(failed.lines.join('\n'),/hiring: Missing Access/);
  }finally {f.store.close();}
});
