import { backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store } from '../src/database/store.js';
const store=new Store(resolve(process.env.DATABASE_PATH || './data/rlrp.sqlite'));
mkdirSync('./backups',{recursive:true});
const destination=resolve('backups',`rlrp-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
try {await backup(store.db,destination);console.log(`Consistente SQLite-back-up: ${destination}`);} finally {store.close();}
