import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { environment,loadDefaults,validateConfig } from '../src/config.js';
import { Store } from '../src/database/store.js';
import { commandKeys,policy } from '../src/commands/registry.js';
const env=environment(process.env,false),store=new Store(env.database),mode=process.argv[2],path=resolve(process.argv[3] || './config/export.json');
try {
  store.init(env.guildId,loadDefaults(env.configPath));
  if(mode==='export') {const {revision,...c}=store.config(env.guildId);writeFileSync(path,JSON.stringify(c,null,2)+'\n',{flag:'wx'});console.log(`Configuratie geëxporteerd: ${path}`);}
  else if(mode==='import') {
    if(!process.argv[3]) throw new Error('Geef het configuratiebestand als argument.');
    const c=validateConfig(JSON.parse(readFileSync(path,'utf8')));
    for(const key of Object.keys(c.permissions)) {const [name,sub]=key.split('.');if(!commandKeys().includes(key) || policy(name,sub).owner || policy(name,sub).scope==='public') throw new Error(`Ongeldige commandoverride ${key}`);}
    store.saveConfig(env.guildId,c,store.config(env.guildId).revision);console.log('Configuratie geïmporteerd. Bestaande setupsessies zijn nu ongeldig. Voer npm run doctor uit.');
  } else throw new Error('Gebruik export of import.');
} finally {store.close();}
