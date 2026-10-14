# Giveawaytrekking controleren

Download de JSON-bijlage van `/giveawaybeheer bewijs`. Bewaar het originele commitmentbericht. Het bewijs bevat uitsluitend Discord-ID's van deelnemers en resultaten, geen FiveM-identifiers.

Voor iedere ronde controleer je:

1. De opgeslagen commitment is gelijk aan de eerder gepubliceerde hash.
2. SHA-256 van de seed (UTF-8, hexseed als tekst) is gelijk aan die commitment.
3. De deelnemerslijst heeft geen dubbele IDs. Bij reroll komen uitgesloten eerdere winnaars niet in de geldige snapshot voor.
4. Voor ieder ID bereken je SHA-256 van `seed + ':' + ID`, lexicografisch oplopend gesorteerd op de hexhash.
5. Kies de eerste `winner_count` IDs. Bij te weinig deelnemers is de juiste uitkomst een lege lijst.

Een zelfstandige verifier is meegeleverd:

```powershell
node scripts/verify-giveaway.js .\giveaway-bewijs.json
```

De verifier rekent commitments en resultaten opnieuw uit en eindigt met een niet-nul exitcode bij inconsistentie. De verifier kan niet bewijzen dat een databasebeheerder alle aanmeldingen eerlijk heeft bewaard. Controleer ook het originele Discord-bericht en de deelnemersregistratie waar dat nodig is.
