# Installatie op bot-hosting.net

Deze repository heeft een hosting-entrybestand `index.js`. Dat laadt een lokale `.env` als die bestaat, gebruikt anders de hostingvariabelen en start de echte bot. Bestaande hostingvariabelen hebben voorrang. Node.js **24.12 of hoger binnen 24.x** is vereist vanwege deze geteste runtime en SQLite-implementatie.

## Deployment en startup

Maak in het huidige paneel een Application-deployment met GitHub-bron `GillesVGB/rotterdamrp`, branch `main` en runtime Node.js. Kies Node 24. De officiële API noemt runtimeversie `24`; de werkelijke patch op jouw node moet je controleren met `node --version` in Shell. [Deployment maken](https://bot-hosting.net/docs/guides/create-a-deployment), [runtime-instellingen](https://bot-hosting.net/api).

| Instelling | Waarde voor deze bot |
| --- | --- |
| Repository | `https://github.com/GillesVGB/rotterdamrp` |
| Branch | `main` |
| Node | `24.x`, minimaal `24.12.0` |
| Entry File / STARTUP_FILE | `index.js` |
| Eigen Start Command, indien gebruikt | `npm ci --omit=dev --ignore-scripts && exec node index.js` |
| DATABASE_PATH | `./data/rlrp.sqlite` |
| CONFIG_PATH | `./config/default.json` |

De Start Command-regel is een projectadvies: hij installeert de vastgelegde afhankelijkheden voordat de bot draait. Bij de gewone entry-filemodus kan de hosting de installatie uit `package.json` verzorgen. Laat `package-lock.json` staan en upload geen `node_modules`. Bij ZIP-upload moet de inhoud van de map `rlrp-main-bot/` in de deploymentroot staan, zodat `package.json` en `index.js` direct bereikbaar zijn. [Officiële installatiegids](https://bot-hosting.net/docs/guides/set-up-a-deployment).

## Environment Variables

Vul dit in bij de environment-instellingen, of maak op de hosting lokaal een `.env` op basis van `config/server.env.example`:

```dotenv
DISCORD_TOKEN=
DISCORD_CLIENT_ID=1560042466198167642
DISCORD_GUILD_ID=1226509285924540467
BOT_OWNER_IDS=
BOT_OWNER_ROLE_IDS=1226509285924540473
DATABASE_PATH=./data/rlrp.sqlite
CONFIG_PATH=./config/default.json
FIVEM_BASE_URL=
FIVEM_JOIN_URL=
```

Vul `DISCORD_TOKEN` met een nieuwe token en markeer die als secret in het paneel. De eerder in chat gedeelde token moet worden gereset. FiveM-velden zijn optioneel totdat je die module configureert. Deel geen hosting- of Discord-secrets in GitHub of chat. Start/herstart na het aanpassen van environment-instellingen; de bot valideert verplichte waarden voordat hij inlogt.

## Eerste registratie en start

1. Controleer privileged intents en botrechten volgens de hoofd-README.
2. Installeer afhankelijkheden via de hosting of `npm ci --omit=dev --ignore-scripts` in Shell.
3. Voer in **Shell** eenmalig `npm run register` uit. Dat registreert de 33 slash commands.
4. Start met entry file `index.js` en controleer de console.
5. Open `/setup` met de ingestelde ownerrol en koppel ranks en logkanalen. Het staffpublicatiekanaal `1560050091245699245` staat al ingesteld.

Heeft jouw oudere paneel alleen een console die invoer naar de draaiende bot stuurt, dan is dat geen shell. Zet de entry file dan **eenmalig** op `register.js`, start, wacht op het registratiebericht en zet de entry file daarna terug op `index.js`. Bij een eigen Start Command gebruik je tijdelijk `npm ci --omit=dev --ignore-scripts && node register.js`; herstel daarna de gewone startregel. Registratie sluit normaal af; het is geen permanent draaiend botproces.

## Data behouden bij updates

De SQLite-database in `data/` bevat alle instellingen en historie. Maak vóór een update een consistente back-up met `npm run backup`. Download de snapshot uit `backups/` ook naar een eigen veilige locatie. Houd één botproces actief.

Gebruik bij latere GitHub-imports **Merge**. **Replace all files** kan de lokale data verwijderen. De hostdocumentatie biedt geen expliciete garantie dat iedere auto-pull/redeploy alle lokale SQLite-bestanden bewaart; controleer dit op jouw deployment voordat je automatische updates inschakelt. [GitHub-import](https://bot-hosting.net/docs/guides/clone-a-github-repository).

Bij een gratis deployment moet je de vereiste handmatige verlenging bijhouden; de huidige gids beschrijft een termijn van vier dagen. Uitval vertraagt geplande sancties en evenementen. [Gratis abonnement verlengen](https://bot-hosting.net/docs/guides/renew-free-subscription).

## Als het starten mislukt

- `RLRP vereist Node.js 24...`: verkeerde runtime/patch; wijzig de runtime, niet de versiecontrole.
- `Cannot find module`: controleer projectroot, package-installatie en entry file.
- Ontbrekende configuratie/token: controleer environment-instellingen of `.env`, daarna herstarten.
- `node:sqlite` ExperimentalWarning op Node 24: deze waarschuwing is bekend; lees de volgende echte foutregel als de bot stopt.
- `Missing Permissions`: botrolpositie, kanaaloverwrites en `/setup` → Controleer installatie.

De code en CI zijn getest; jouw hostingaccount, resourcekeuze en live Discord/FiveM-verbinding zijn niet vanuit deze oplevering aangemaakt of getest.
