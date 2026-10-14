# Giveawaytrekking controleren

De openbare slashcommands zijn `/giveaway start`, `/giveaway stop` en `/giveaway reroll`. Trekkingbewijzen worden in SQLite bewaard in `giveaway_draws`; deelnames staan in `giveaway_entries`. De eerdere openbare exportcommand is verwijderd. Bewaar het originele commitmentbericht als je een trekking controleert. Bewijsdata bevatten Discord-ID's, geen FiveM-identifiers.

Voor iedere ronde controleer je:

1. De opgeslagen commitment is gelijk aan de eerder gepubliceerde hash.
2. SHA-256 van de seed (UTF-8, hexseed als tekst) is gelijk aan die commitment.
3. De deelnemerslijst heeft geen dubbele IDs. Bij reroll komen uitgesloten eerdere winnaars niet in de geldige snapshot voor.
4. Voor ieder ID bereken je SHA-256 van `seed + ':' + ID`, lexicografisch oplopend gesorteerd op de hexhash.
5. Kies de eerste `winner_count` IDs. Bij te weinig deelnemers is de juiste uitkomst een lege lijst.

Een zelfstandige verifier is meegeleverd. Geef hem een JSON-export met `winner_count` en een `rounds`-array; iedere ronde bevat `round`, `seed`, `commitment`, `entrants`, `winners` en `excluded`:

```powershell
node scripts/verify-giveaway.js .\giveaway-bewijs.json
```

De verifier rekent commitments en resultaten opnieuw uit en eindigt met een niet-nul exitcode bij inconsistentie. De verifier kan niet bewijzen dat een databasebeheerder alle aanmeldingen eerlijk heeft bewaard. Controleer ook het originele Discord-bericht en de deelnemersregistratie waar dat nodig is.
