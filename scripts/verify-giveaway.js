import { readFileSync } from 'node:fs';
import { commitment,draw } from '../src/services/giveaways.js';
import { id,integer } from '../src/utils/validation.js';
const path=process.argv[2];
if(!path) throw new Error('Geef een giveawaybewijs-JSON als argument.');
const proof=JSON.parse(readFileSync(path,'utf8'));
integer(proof.winner_count,1,20);
if(!Array.isArray(proof.rounds) || !proof.rounds.length) throw new Error('Geen bewijsrondes.');
for(const round of proof.rounds) {
  round.entrants.forEach(id);round.winners.forEach(id);round.excluded.forEach(id);
  if(commitment(round.seed)!==round.commitment) throw new Error(`Ronde ${round.round}: commitment klopt niet.`);
  if(round.entrants.some(x=>round.excluded.includes(x))) throw new Error(`Ronde ${round.round}: uitgesloten deelnemer staat in snapshot.`);
  if(JSON.stringify(draw(round.seed,round.entrants,proof.winner_count))!==JSON.stringify(round.winners)) throw new Error(`Ronde ${round.round}: winnaars kloppen niet.`);
  console.log(`Ronde ${round.round}: seed, commitment, unieke snapshot en winnaars consistent.`);
}
