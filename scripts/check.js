import { readdirSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { builders,definitions,commandKeys } from '../src/commands/registry.js';
import { serviceFor } from '../src/handlers/interactions.js';
import { Store } from '../src/database/store.js';
import { loadDefaults } from '../src/config.js';
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):e.name.endsWith('.js')?[join(dir,e.name)]:[]);
const js=['index.js','register.js',...['src','scripts','tests'].flatMap(files)];
for(const file of js) {
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0) throw new Error(`${file}: ${result.stderr}`);
}
for(const file of files('src').filter(x=>!x.endsWith('index.js') || !x.startsWith(`src${process.platform==='win32'?'\\':'/'}index`))) await import(pathToFileURL(resolve(file)));
const commands=builders().map(b=>b.toJSON());
if(new Set(commands.map(c=>c.name)).size!==commands.length) throw new Error('Dubbele commands.');
for(const definition of definitions) serviceFor(definition.name);
const store=new Store(); store.init('123456789012345678',loadDefaults('./config/default.json')); store.close();
console.log(`${js.length} JS-bestanden geldig; imports, ${commands.length} commands, ${commandKeys().length} routes en SQLite-migraties gecontroleerd.`);
