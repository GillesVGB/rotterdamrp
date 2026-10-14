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

Vul dit in het **Env-tabje** van jouw hosting in. Je hoeft geen `.env`-bestand te uploaden of aan te maken:

```dotenv
DISCORD_TOKEN=
DISCORD_CLIENT_ID=1560042466198167642
DISCORD_GUILD_ID=1226509285924540467
```

Vul `DISCORD_TOKEN` met een nieuwe token en markeer die als secret in het paneel. De eerder in chat gedeelde token moet worden gereset. Dit zijn de drie verplichte waarden. Databasepad, configuratiepad, Beheerrol en automatische commandregistratie hebben al standaardinstellingen. Voeg `FIVEM_BASE_URL` en eventueel `FIVEM_JOIN_URL` toe als je FiveM-status wilt gebruiken. Start/herstart na het aanpassen van het Env-tabje.

## Eerste start en slash commands

1. Controleer privileged intents en botrechten volgens de hoofd-README.
2. Installeer afhankelijkheden via de hosting of `npm ci --omit=dev --ignore-scripts` in Shell.
3. Voer `npm run invite` uit in Shell en open de getoonde officiële uitnodigingslink. Voeg de bot toe aan server `1226509285924540467` en zet zijn rol boven de te beheren staffrollen voordat je start.
4. Start met entry file `index.js` en controleer de console. De bot registreert automatisch de 29 slash commands in jouw guild; wacht op de bevestiging van die registratie.
5. Open Discord in die server en typ `/help`. Dit toont alle commands, parameters en benodigde rechten.
6. Leden met Beheerrol `1226509285924540473`, gebruikers met Administrator en de servereigenaar mogen alle commands gebruiken. Gewone moderatoren gebruiken hun Discord-permissies voor bans, kicks, waarschuwingen, timeouts en overige moderatie.
7. Gebruik `/aannemen` en kies bij `functie` de bestaande Discord-rol. Voor `/staffupdate` kies je `nieuwe_rank`; de nieuwe rank wordt echt gegeven en de oude staffrank wordt verwijderd. `/ontslag` verwijdert altijd de staffrollen. Staffgroepen en ranks vooraf invoeren is niet nodig.
8. Aannemen/staffupdate/ontslag gaan altijd naar `1560050091245699245`, changelogs naar `1226509287459655704`, APV-publicaties naar `1226509286587498599` en regels naar `1226509286587498597`. `/changelog` vraagt alleen `naam` en `inhoud`; `versie` is optioneel. Extra log-/modulekanalen zijn optioneel via het configuratiebestand en `config:export`/`config:import`; zie de README.

De Beheerrol staat standaard al ingesteld. `MANAGEMENT_ROLE_IDS` is alleen nodig als je andere rollen wilt gebruiken. Een bestaande `BOT_OWNER_ROLE_IDS`-waarde wordt ook ondersteund. Plaats de botrol boven de leden en rankrollen die hij moet beheren; Beheer kan die Discord-hiërarchie niet omzeilen.

Wil je automatische registratie uitschakelen, zet dan `REGISTER_COMMANDS_ON_START=false`. Registreer daarna handmatig met `npm run register` of `node scripts/register.js` in **Shell**. Beide gebruiken het Env-tabje en werken zonder `.env`-bestand.

De fout `node: .env: not found` kwam van de oude startregel `node --env-file=.env scripts/register.js`. Haal de nieuwste `main` binnen en herstart. Als je de oude checkout nog gebruikt, voer direct `node scripts/register.js` uit in Shell: de hostingvariabelen zijn daar beschikbaar.

Heeft jouw oudere paneel alleen een console die invoer naar de draaiende bot stuurt, dan is dat geen shell. Gebruik de gewone entry file `index.js` voor automatische registratie. Als je registratie bewust apart wilt uitvoeren, zet de entry file **eenmalig** op `register.js`, start, wacht op het registratiebericht en zet de entry file terug op `index.js`. Registratie sluit normaal af; het is geen permanent draaiend botproces.

## Data behouden bij updates

De SQLite-database in `data/` bevat alle instellingen en historie. Maak vóór een update een consistente back-up met `npm run backup`. Download de snapshot uit `backups/` ook naar een eigen veilige locatie. Houd één botproces actief.

Gebruik bij latere GitHub-imports **Merge**. **Replace all files** kan de lokale data verwijderen. De hostdocumentatie biedt geen expliciete garantie dat iedere auto-pull/redeploy alle lokale SQLite-bestanden bewaart; controleer dit op jouw deployment voordat je automatische updates inschakelt. [GitHub-import](https://bot-hosting.net/docs/guides/clone-a-github-repository).

Controleer bij een gratis deployment de vereiste verlenging in jouw paneel. Uitval vertraagt geplande sancties en evenementen. [Gratis abonnement verlengen](https://bot-hosting.net/docs/guides/renew-free-subscription).

## Als het starten mislukt

- `RLRP vereist Node.js 24...`: verkeerde runtime/patch; wijzig de runtime, niet de versiecontrole.
- `Cannot find module`: controleer projectroot, package-installatie en entry file.
- Ontbrekende configuratie/token: controleer environment-instellingen of `.env`, daarna herstarten.
- `.env: not found`: nieuwste `main` gebruiken; direct `node scripts/register.js` werkt met het Env-tabje.
- Commands ontbreken: controleer het registratieresultaat in de startconsole, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, uitnodigingsscope `applications.commands` en Discords Integrations-commandzichtbaarheid. Een mislukte registratie moet eerst worden opgelost.
- `node:sqlite` ExperimentalWarning op Node 24: deze waarschuwing is bekend; lees de volgende echte foutregel als de bot stopt.
- `Missing Permissions`: botrolpositie, kanaaloverwrites en `npm run doctor`.

De code en CI zijn getest; jouw hostingaccount, resourcekeuze en live Discord/FiveM-verbinding zijn niet vanuit deze oplevering aangemaakt of getest.
