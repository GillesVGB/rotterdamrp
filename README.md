# Rotterdam Roleplay Main Bot

![Rotterdam Roleplay](assets/rlrp-banner.png)

JavaScript-bot voor één Discord-server, met 29 slash commands en 47 commandroutes. Staffmanagement, gewone moderatie, wijzigingslogs, changelogs, giveaways, FiveM-status, APV/regels, evenementen, interne staffwaarschuwingen en `/help`. De commands voeren echte Discord-acties uit en bewaren hun gegevens in SQLite.

De bronbestanden, tests, lockfile, migraties en blauwe huisstijlassets zijn inbegrepen. Er staat geen Discord-token in de oplevering. Zie [architectuur](docs/ARCHITECTUUR.md), [testresultaten](docs/TESTRESULTATEN.md) en [live acceptatie](docs/ACCEPTATIE.md). Live Discord-/FiveM-acceptatie vereist jouw draaiende bot.

## Starten op bot-hosting.net

Gebruik repository `GillesVGB/rotterdamrp`, branch `main`, **Node.js 24.x vanaf 24.12** en entry file **`index.js`**. Vul de waarden uit `config/server.env.example` in het **Env-tabje** in. Een `.env`-bestand is daar niet nodig. De volledige stappen staan in [docs/BOT-HOSTING.md](docs/BOT-HOSTING.md).

De token die in de chat is gedeeld, moet worden gereset in het [Discord Developer Portal](https://discord.com/developers/applications), onder Bot → Reset Token. Bewaar de nieuwe token alleen als hostingsecret of in je lokale `.env`.

| Instelling | RLRP-waarde |
| --- | --- |
| Application-ID | `1560042466198167642` |
| Guild-ID | `1226509285924540467` |
| Beheerrol | `1226509285924540473` |
| Aannemen / staffupdate / ontslag | Altijd kanaal `1560050091245699245` |
| Changelog | Altijd kanaal `1226509287459655704` |
| APV | Altijd kanaal `1226509286587498599` |
| Regels | Altijd kanaal `1226509286587498597` |

Bij opstart registreert de bot automatisch alle guildcommands. Controleer de console op een geslaagde registratie en typ daarna `/help` in Discord. Dat toont alle commands, subcommands, parameters en benodigde rechten, met categorieën en paginaknoppen. De commandantwoorden met interne gegevens zijn alleen zichtbaar voor de uitvoerder.

Leden met de Beheerrol, gebruikers met Administrator en de servereigenaar mogen alle commands uitvoeren. Gewone moderatoren gebruiken de bijbehorende Discord-permissies, zoals **Ban Members**, **Kick Members** en **Moderate Members**. De bot controleert de rechten bij iedere uitvoering. Vooraf staffgroepen, ranks of commandrollen invoeren is niet nodig.

Selecteer bij `/aannemen functie` en `/staffupdate nieuwe_rank` een bestaande Discord-rol. De bot bewaart de echte rol-ID bij de medewerker. De Discord-rolhiërarchie bepaalt altijd de richting van een promotie/demotie. De botrol moet boven de doelgebruiker en rankrol staan; de uitvoerder moet het doelwit en de te geven rol volgens de hiërarchie mogen beheren. `/staffupdate` voegt de nieuwe rankrol toe en verwijdert de oude staffrankrollen. `/ontslag` verwijdert altijd de opgeslagen en herkende staffrollen. Andere communityrollen blijven behouden.

## Lokaal installeren

Installeer Node.js **24 LTS, minimaal 24.12**; het project is getest met 24.14.0. Gebruik een blijvende lokale schijf voor `data/` en één botproces. Vanuit de projectmap in PowerShell:

```powershell
npm.cmd ci
Copy-Item -LiteralPath .\config\server.env.example -Destination .\.env
```

Vul `DISCORD_TOKEN` in `.env` in. Controleer de application- en guild-ID. Voer vervolgens uit:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run invite
```

Open de officiële uitnodigingslink die `invite` toont, kies de juiste server en geef de bot de gevraagde rechten. Plaats de botrol boven de rollen die hij moet toekennen, verwijderen of modereren. Start daarna:

```powershell
npm.cmd start
```

Op Linux/macOS gebruik je `npm` en `cp config/server.env.example .env`.

## Discord-app, intents en rechten

Voor een nieuwe application: maak in het Developer Portal een Application en Bot, kopieer de Application ID naar `DISCORD_CLIENT_ID` en bewaar het token als secret. Discord Developer Mode maakt het mogelijk guild-, rol-, kanaal- en gebruikers-ID's te kopiëren. De vaste publicatiekanalen in dit project zijn voor de RLRP-server.

Schakel onder **Bot → Privileged Gateway Intents** de **Server Members Intent** en **Message Content Intent** in voor lidupdates en volledige berichtlogs. Presence Intent is niet nodig. Grote/geverifieerde apps kunnen goedkeuring nodig hebben; zie de [officiële Gateway-documentatie](https://docs.discord.com/developers/events/gateway#gateway-intents).

De client vraagt `Guilds`, `GuildMembers`, `GuildModeration`, `GuildMessages`, `MessageContent`, `GuildWebhooks` en `GuildExpressions`. Auditlogevents gebruiken **View Audit Log** en de [officiële Audit Log API](https://docs.discord.com/developers/resources/audit-log).

De uitnodigingsgenerator gebruikt scopes `bot` en `applications.commands` en deze permissies:

- View Channels, Send Messages, Embed Links, Attach Files en Read Message History.
- Add Reactions en Use External Emojis voor bereikbare guildemoji.
- View Audit Log, Manage Roles en Manage Channels.
- Ban Members, Kick Members, Moderate Members en Manage Messages.
- Create Events en Manage Events voor externe Discord Scheduled Events; zie de [officiële eventrequirements](https://github.com/discord/discord-api-docs/blob/main/developers/resources/guild-scheduled-event.mdx).

**Administrator is niet nodig voor de bot.** Kanaaloverwrites kunnen globale rechten beperken. De bot kan de guildeigenaar, managed/integratierollen en hoger geplaatste rollen niet beheersen.

De automatische registratie en `npm run register` vervangen de guildcommands van **deze application** in de ingestelde guild. Gebruik deze app uitsluitend voor deze bot. Zet optioneel `REGISTER_COMMANDS_ON_START=false` om registratie apart te doen. `npm run register` of `node scripts/register.js` werkt met het Env-tabje en met een lokale `.env` als die bestaat.

## Commands en toegang

`/help` geeft voor iedere commandroute het volledige actuele parameteroverzicht. Beheer, Administrator en de servereigenaar hebben toegang tot alle commands; in de tabel staat deze gezamenlijke toegang als **Beheer**. Normale moderatoren hebben de genoemde Discord-permissie nodig. Publicatieberichten gaan via een persistente outbox. Een bevestiging **ingepland** betekent opgeslagen voor verzending; `/systeem status` toont de wachtrij en fouten.

| Groep | Commands | Toegang |
| --- | --- | --- |
| Hulp | `/help` | Serverleden |
| Staff | `/aannemen`, `/ontslag`, `/staffupdate`, `/staffopmerking` | Beheer |
| Staff lezen | `/staffoverzicht`, `/staffgeschiedenis` | Beheer |
| Intern | `/staffwaarschuwing geven/bekijken/intrekken` | Beheer |
| Bans | `/ban`, `/unban` | Beheer of Ban Members |
| Kick | `/kick` | Beheer of Kick Members |
| Waarschuwingen | `/warn`, `/warnings`, `/clearwarnings` | Beheer of Moderate Members |
| Timeouts | `/timeout`, `/untimeout` | Beheer of Moderate Members |
| Berichten | `/purge` | Beheer of Manage Messages |
| Kanaalslot | `/lock`, `/unlock` | Beheer of Manage Channels |
| Moderatiehistorie | `/modlogs` | Beheer of View Audit Log |
| Communicatie | `/say`, `/embed`, `/changelog` | Beheer |
| Giveaway | `/giveawaybeheer opnieuw` (bestaande giveaway) | Beheer |
| Giveaway lezen | `/giveawaybeheer status/bewijs` | Serverleden |
| Documenten | `/apv` en `/regels` bekijken/accepteren | Serverleden |
| Documentbeheer | `/apv` en `/regels` toevoegen/publiceren/acceptaties | Beheer |
| Evenementen | `/evenement maken/annuleren/deelnemers` | Beheer |
| Community lezen | `/evenement lijst`, `/fivem status/spelers` | Serverleden |
| Systeem | `/systeem status/acties/afhandelen` | Beheer |

Hiërarchie, beschermde accounts, botrechten en invoervalidatie blijven ook voor Beheer gelden. Gevoelige commands zijn begrensd op 3 uitvoeringen per 10 seconden per actor/command; alle interacties samen op 12 per 10 seconden. Gewone moderatie beschermt de uitvoerder, de bot, bots, de guildeigenaar en geconfigureerde beschermde accounts/rollen.

`/changelog` heeft verplichte parameters `naam` en `inhoud`, en optioneel `versie`. De bot publiceert de inhoud met paginaknoppen in `1226509287459655704`.

Duraties: `30s`, `30m`, `2h`, `7d`, `1w`. Timeouts maximaal 28 dagen, algemene bans/giveaways maximaal 365 dagen en evenementen maximaal 7 dagen. Evenementstart is ISO-8601 met tijdzone, bijvoorbeeld `2026-12-01T20:00:00+01:00`. Discord toont timestamps in de lokale tijd van de lezer.

`/ban` zonder duur is permanent; met duur tijdelijk als ingeschakeld. Automatisch unbannen gebeurt uitsluitend als de actuele banreden de unieke generatie-referentie van deze sanctie bevat. Een nieuwere/andere ban wordt niet opgeheven. `/ban` vereist een huidig serverlid; `/unban` gebruikt een Discord-ID van een geband account. Mislukte DM's worden gelogd en stoppen een uitgevoerde moderatieactie niet.

`/purge` verwijdert uitsluitend opgehaalde berichten jonger dan 14 dagen. `/lock` bewaart de eerdere Send/Create Thread-overwrites voor @everyone; `/unlock` zet die terug. Rollen met een eigen allow kunnen volgens Discord nog schrijven. `/say` accepteert maximaal 1900 tekens en weigert massamentions/rolmentions. `/embed` accepteert #RRGGBB en HTTP(S)-thumbnail-URL's. `allowedMentions` voorkomt ongewenste notificaties.

## Optionele configuratie

De standaardinstellingen staan in `config/default.json`; bestaande instellingen staan in SQLite. De vaste RLRP-publicatiekanalen worden ook op bestaande databases toegepast. Voor optionele log-/modulekanalen kun je lokaal exporteren en importeren:

```powershell
npm.cmd run config:export -- .\config\export.json
# Bewerk het geëxporteerde JSON-bestand lokaal.
npm.cmd run config:import -- .\config\export.json
npm.cmd run doctor
```

Export overschrijft geen bestaand bestand. Import valideert het schema. Wijzig geen tabellen terwijl de bot draait. Je kunt kanalen instellen voor moderatie-, staff-, bericht-, rol-, kanaal-, leden- en systeemlogs, en voor APV/regels, FiveM en interne staffwaarschuwingen. Ontbrekende logkanalen verhinderen database-logging niet; systeemfouten blijven ook zichtbaar in de console. Een module die een publicatiekanaal nodig heeft, geeft een duidelijke configuratiefout als dat ontbreekt.

De Beheerrol is standaard `1226509285924540473`. Met `MANAGEMENT_ROLE_IDS` kun je andere Beheerrollen instellen; bestaande `BOT_OWNER_ROLE_IDS` worden eveneens ondersteund. Secrets, FiveM-endpoints en uitvoeringsinstellingen horen in het Env-tabje of je lokale `.env`.

Een eigen `roles.ranks`-lijst is optioneel voor herkenbare ranknamen: iedere rank heeft `name`, echte `roleId` en numeriek `level`. Het veld `level` blijft ondersteund voor bestaande configuraties; promotie/demotie gebruikt altijd de Discord-rolhiërarchie. Rol-ID's en namen moeten uniek zijn. Zonder zo'n lijst gebruik je direct bestaande Discord-rollen.

Voor interne staffwaarschuwingen stel je `channels.staffWarnings` in en maak je dat kanaal privé. @everyone mag het niet zien; View Channel-overwrites horen bij de Beheerrollen en de bot. Administrator behoudt de technische toegang die Discord verleent. Staffgeschiedenis en notities zijn alleen via geautoriseerde privéantwoorden beschikbaar; notitietekst wordt niet naar gewone stafflogs gekopieerd.

## Giveaways en community

Giveaways gebruiken een deelnameknop, unieke SQL-entry per lid en hercontrole van lidmaatschap bij afsluiten. Vrije `voorwaarden`-tekst is informatief. Een cryptografische seed wordt vooraf met SHA-256 gecommit en op Discord gepubliceerd. Bij afsluiten sorteert de bot geldige deelnemers op `SHA256(seed + ':' + ID)`; te weinig geldige deelnemers betekent geen winnaars. Bij een API-fout wordt de sluiting later hervat. Seed, commitment, snapshot en resultaten zijn beschikbaar via `/giveawaybeheer bewijs`; zie [trekking verifiëren](docs/GIVEAWAY-BEWIJS.md).

`/giveawaybeheer opnieuw` opent een nieuwe ronde van een bestaande giveaway; eerdere bewijzen blijven bewaard. Actieve giveaways sluiten automatisch op hun ingestelde eindtijd. Een beheerder met schrijfrechten op de database kan de opgeslagen gegevens technisch manipuleren.

Zet het FiveM-endpoint in `FIVEM_BASE_URL` en eventueel de echte `https://cfx.re/join/...` link in `FIVEM_JOIN_URL`. De bot gebruikt `info.json`, `dynamic.json` en `players.json`; zie de [officiële Cfx-documentatie](https://docs.fivem.net/docs/server-manual/proxy-setup/). Een statuskanaal wordt standaard iedere 60 seconden bijgewerkt; commands gebruiken maximaal 15 seconden cache. HTTP-timeout is 5 seconden per endpoint, response maximaal 1 MiB, geen redirects. Spelersnamen zijn standaard verborgen; `fivem.showPlayers` zet ze aan. Afgeschermde endpoints of netwerkstoringen worden als onbereikbaar/onbekend weergegeven. IP's en license-identifiers worden niet gepubliceerd.

Voer eigen APV en regels in met `/apv toevoegen` en `/regels toevoegen`. Iedere toevoeging maakt een onveranderlijke versie. Publicatie krijgt een versiegebonden acceptatieknop; nieuwe versies behouden eerdere acceptaties.

Evenementen worden als externe Discord Scheduled Events aangemaakt, met daarnaast persistente RSVP, capaciteit, afmelden en een reminder 15 minuten vóór de start. Discords eigen Interested-lijst staat los van RSVP. De scheduler activeert en sluit events. Een tijdens uitval volledig gemist event wordt geannuleerd. Een onderbroken Discord-create kan aan de unieke RLRP-referentie worden herkend en gereconcilieerd.

## Huisstijl

`assets/rlrp-logo.png` en `assets/rlrp-banner.png` volgen jouw referenties: blauwe Rotterdamse skyline, metallic witte R, witte 3D-lettering en cyaan Roleplay-script. Upload het logo als servericon/botavatar en de banner waar Discord dit ondersteunt. Changelogberichten gebruiken een compacte embed zonder bannerafbeelding. De embeds gebruiken #1675FF en waar aanwezig het servericon. De prompts staan in [assets/GENERATIE.md](assets/GENERATIE.md).

De bot leest bij opstart en iedere vijf minuten de applicationemoji `rlogo`, `upvote` en `downvote`. De applicationcache krijgt voorrang op een gelijknamig guildemoji. Aannemen/promotie gebruikt `:upvote:`, demotie/ontslag `:downvote:`. Staffaankondigingen bevatten geen foto's en noemen de uitvoerder met een Discord-mention; de `rlogo`-emoji wordt als reactie onder het bericht geplaatst. Interne retry-ID's worden via Discords nonce afgehandeld en staan niet in de footer. Ontbrekende upvote/downvote-emoji tonen Unicode-fallbacks. Volgens de [officiële Emoji API](https://docs.discord.com/developers/resources/emoji#application-owned-emoji) vereisen applicationemoji geen Use External Emojis; die permissie blijft nuttig voor guildemoji.

## Onderhoud en herstel

`npm run backup` maakt via de SQLite online backup-API een consistente snapshot in `backups/`, ook bij WAL. Bewaar back-ups en secrets met beperkte hostrechten. Een back-up bevat interne notities en staffgegevens. Kopieer een actieve `.sqlite` niet los van zijn WAL-bestanden.

Voor herstel: stop de bot, bewaar de volledige huidige `data/` apart en zet de gekozen snapshot terug als `data/rlrp.sqlite` in een lege datamap. Controleer `DATABASE_PATH`. Plaats geen oude `-wal`/`-shm` bestanden naast de snapshot. Migraties en `quick_check` worden gecontroleerd; verlopen bans, giveaways, evenementen en outbox worden hervat. Gebruik één actieve guild/proces. PostgreSQL vereist een aparte repositoryadapter en SQL-migratie.

Een onderbroken Discord-mutatie verschijnt onder `/systeem acties` als **uncertain**. Controleer de echte Discord-status en leg je controle vast met `/systeem afhandelen`. Dat command verandert de auditstatus en herhaalt de mutatie niet. Permanente bans worden nooit vanzelf opgeheven.

Audit-/systeemlogs worden standaard na 90 dagen opgeschoond. Berichtinhoud wordt standaard niet opgeslagen; uncached verwijderde berichten kunnen niet worden gereconstrueerd. Staffhistorie, interne waarschuwingen, sancties, documenten, acceptaties en giveawaybewijzen blijven bewaard. Pas daarvoor je eigen bewaarbeleid toe met gecontroleerde, geback-upte databasemigraties.

Laat de bot draaien met automatische herstart en een beperkte hostgebruiker. `deploy/rlrp-main.service` is een Linux-servicevoorbeeld voor `/opt/rlrp-main-bot`; geef de gebruiker `rlrp` leesrechten op code/secrets en schrijfrechten op `data/` en `backups/`. Controleer het Node 24-pad in ExecStart. Op Windows kan een service-wrapper `npm.cmd start` met de projectmap als working directory uitvoeren. Uitval kan geplande acties vertragen.

Voor updates: back-up, update in een testkopie, `npm run check`, `npm test`, `npm audit` en live acceptatie. Node 24 geeft momenteel een ExperimentalWarning voor `node:sqlite`; dit is geen corruptiemelding. Pin je runtime en test Node-updates.

## Foutopsporing

| Probleem | Controle |
| --- | --- |
| Commands ontbreken | Succesvolle registratie in startconsole, Application ID, guild-ID, uitnodigingsscope `applications.commands` en Integrations-commandzichtbaarheid; handmatig `node scripts/register.js` |
| `node: .env: not found` bij register | Nieuwste `main` gebruiken; met oudere checkout `node scripts/register.js` uitvoeren met het Env-tabje |
| Token/login ongeldig | Nieuwe token, juiste application, geen extra quotes/spaties |
| Disallowed intents | Server Members/Message Content in Developer Portal en eventuele goedkeuring |
| Geen bevoegdheid | Beheerrol of passende Discord-permissie voor gewone moderatie |
| Missing Permissions | Botrolpositie, kanaaloverwrites en `npm run doctor`; evenementen vereisen Create Events/Manage Events |
| Staff/changelog komt niet aan | Botrechten en bestaan van de vaste kanalen; `/systeem status` en outboxfout |
| FiveM onbereikbaar | Endpoint, firewall, HTTP-status en response |
| SQLite busy/corrupt | Eén proces, lokale schijf en betrouwbare snapshot |

Voer de [live acceptatiecheck](docs/ACCEPTATIE.md) uit met een gecontroleerd testaccount voordat je beheeracties op productie gebruikt.
