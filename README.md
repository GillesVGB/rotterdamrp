# Rotterdam Roleplay Main Bot

![Rotterdam Roleplay](assets/rlrp-banner.png)

Volledig JavaScript-project voor één Discord-server, met 33 slash commands en 55 commandroutes. Staffmanagement, moderatie, Anti-Nuke, bericht- en wijzigingslogs, changelogs, giveaways, FiveM-status, APV/regels, evenementen, interne staffwaarschuwingen en een interactief configuratiepaneel. Alle operationele commands gebruiken echte Discord-acties of persistente databasegegevens.

De bronbestanden, tests, lockfile, migraties en blauwe huisstijlassets zijn inbegrepen. Er staat geen Discord-token in de oplevering. Dit project is lokaal gecontroleerd; live Discord-/FiveM-acceptatie is nog niet uitgevoerd. Zie [testresultaten](docs/TESTRESULTATEN.md) en [architectuur](docs/ARCHITECTUUR.md).

## Snel installeren voor jouw server

Installeer Node.js **24 LTS, minimaal 24.12**; getest met 24.14.0. Pak het archief uit op een machine die continu draait. Gebruik een blijvende lokale schijf voor `data/` en één botproces. Gebruik geen serverless function, gedeelde netwerkschijf of meerdere instanties op dezelfde SQLite-database.

In PowerShell, vanuit de projectmap:

```powershell
npm.cmd ci
Copy-Item -LiteralPath .\config\server.env.example -Destination .\.env
```

Open `.env` lokaal en vul `DISCORD_TOKEN` in met een **nieuwe** bot-token. De in de chat gedeelde token moet eerst worden gereset in het [Discord Developer Portal](https://discord.com/developers/applications), onder Bot → Reset Token. Plak secrets niet in chat, screenshots, commits of supportlogs.

Het servervoorbeeld bevat al:

| Instelling | Waarde |
| --- | --- |
| Application-ID | `1560042466198167642` — controleer tegen je Developer Portal |
| Guild-ID | `1226509285924540467` |
| Configuratiebeheerdersrol | `1226509285924540473` |
| Aannemen / staffupdate / ontslag | Kanaal `1560050091245699245` |

Ieder lid met de ingestelde ownerrol kan `/setup`, `/antinuke` en `/systeem` gebruiken. Deze rol is een expliciete configuratiebevoegdheid, wordt bij ieder gebruik gecontroleerd en staat uitsluitend in `.env`. Gewone management-/moderatiecommands vereisen apart geconfigureerde rollen en Discord-permissies. Zet de ownerrol boven rollen die minder vertrouwde leden kunnen beheren. De bot deelt deze ownerrol nooit via staffcommands uit.

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run invite
```

Open de getoonde officiële uitnodigingslink, controleer de server en sta de gevraagde botpermissies toe. Zet daarna de botrol boven alle rollen die hij moet toekennen, verwijderen of modereren. Voeg uitsluitend vertrouwde bestaande bots toe aan de allowlist voordat je nieuwe bots uitnodigt; onbekende botaccounts worden door de bescherming verwijderd als Discord dat toestaat.

```powershell
npm.cmd run register
npm.cmd start
```

Open `/setup` in je server. Koppel eerst security-, systeem-, moderatie- en stafflogkanalen. Stel vervolgens de andere publicatiekanalen, staffgroepen, ranks en emoji in. Gebruik de knop **Controleer installatie**, of voer `npm.cmd run doctor` uit. Een lege kanaalkoppeling betekent dat het betreffende publicatiecommand expliciet om configuratie vraagt; staffmutaties publiceren niet naar een willekeurig kanaal.

Op Linux/macOS gebruik je dezelfde npm-scripts met `npm` in plaats van `npm.cmd`, en `cp config/server.env.example .env` om het voorbeeld te kopiëren.

## Discord-app maken en instellen

Voor een nieuwe app: maak in het Developer Portal een Application en Bot, kopieer de Application ID naar `DISCORD_CLIENT_ID`, maak een token en bewaar deze alleen in `.env`. Zet Discord Developer Mode aan om guild-, rol-, kanaal- en gebruikers-ID's te kopiëren. Gebruik voor een andere server `.env.example` in plaats van het RLRP-servervoorbeeld.

Schakel onder **Bot → Privileged Gateway Intents** de **Server Members Intent** en **Message Content Intent** in. Deze zijn nodig voor lidupdates, raidcontrole en berichtanalyse. Presence Intent is niet nodig. Grote/geverifieerde apps kunnen Discord-goedkeuring nodig hebben voor privileged intents; zie de [officiële Gateway-documentatie](https://docs.discord.com/developers/events/gateway#gateway-intents).

De client vraagt `Guilds`, `GuildMembers`, `GuildModeration`, `GuildMessages`, `MessageContent`, `GuildWebhooks` en `GuildExpressions` (actuele emoji-cache). Auditlogevents vereisen bovendien **View Audit Log**. De bot gebruikt geen user-token, selfbot of onofficiële Discord-endpoints. Auditlogattributie volgt de [officiële Audit Log API](https://docs.discord.com/developers/resources/audit-log).

De uitnodigingsgenerator gebruikt scopes `bot` en `applications.commands` en deze permissies:

- View Channels, Send Messages, Embed Links, Attach Files, Read Message History.
- Add Reactions en Use External Emojis voor bereikbare emoji.
- View Audit Log, Manage Roles, Manage Channels en Manage Webhooks.
- Ban Members, Kick Members, Moderate Members en Manage Messages.
- Create Events en Manage Events voor externe Discord Scheduled Events. De gescheiden eventrechten volgen de [officiële requirements](https://github.com/discord/discord-api-docs/blob/main/developers/resources/guild-scheduled-event.mdx).

**Administrator is niet nodig voor de bot.** Kanaaloverwrites kunnen globale botrechten beperken. Een bot kan de guildeigenaar, managed/integratierollen en hoger geplaatste rollen niet beheersen. Een gewone gebruiker met Administrator krijgt geen staffcommandtoegang zonder ingestelde staffrol. Configuratiegebruikers via `BOT_OWNER_IDS` moeten daarnaast guildeigenaar of Administrator zijn; `BOT_OWNER_ROLE_IDS` is de expliciet gedelegeerde configuratieroot.

`npm run register` vervangt de guildcommands van **deze application** in de ingestelde guild. Gebruik deze app uitsluitend voor deze bot. Herhaal de registratie nadat commanddefinities wijzigen. Een databaseback-up is niet nodig voor registratie, omdat registratie geen databasegegevens wijzigt.

## Configuratiepaneel en bestanden

`.env` bevat alleen token en vaste uitvoeringsinstellingen. `config/default.json` is de bootstrapconfiguratie. Na de eerste start is de guildconfiguratie in SQLite leidend; het aanpassen van het bootstrapbestand verandert bestaande databaseconfiguratie niet.

Het `/setup`-paneel is privé, eigenaargebonden, verloopt na 15 minuten en weigert gelijktijdig verouderde wijzigingen. Kanaal- en rolselecties verwijzen naar echte Discord-objecten. Uitgebreide secties gebruiken gevalideerde JSON-modals; ongeldige sleutels, thresholds, kleuren en ID's worden geweigerd. Secrets en ownerrollen kunnen niet via het paneel worden aangepast.

| Sectie | Instellen |
| --- | --- |
| Kanalen | `hiring`, `dismissal`, `staffUpdates`, `changelog`, `giveaway`, `events`, `rules`, `fivem`, `staffWarnings`, `moderation`, `staff`, `security`, `messages`, `roles`, `channelChanges`, `members`, `system` |
| Staffrollen | Lijsten voor `management`, `moderator`, `support` en `protected` |
| Ranks | Per rank: `name`, echte `roleId` en numeriek `level`; een hoger level betekent hogere rank |
| Huisstijl | Naam, kleur, foutkleur, logo-emoji-ID, upvote-emoji-ID |
| Beveiliging | Actie, thresholds, vensters, anti-spam, mentions, raid en webhookburst |
| Allowlists | Afzonderlijke lijsten met expliciet vertrouwde gebruikers en botaccounts |
| Commandpermissies | Commandnaam of `root.subcommand` naar een lijst toegestane rollen; vereiste Discord-permissies blijven verplicht |
| Overig | Staff-DM's, rollen verwijderen bij ontslag, moderatie-DM's, tijdelijke bans, logretentie, spelerszichtbaarheid en pollinterval |

Voeg bij Ranks geen fictieve ID's in: kopieer de echte rol-ID uit Discord. Maak de rankrollen vooraf in Discord. De bot maakt geen rol met extra rechten aan. Ranks moeten onder de hoogste botrol staan, namen en rol-ID's moeten uniek zijn. Rank-up/down controleert zowel de levelrichting als Discord-rolpositie en actorpermissies.

Maak het staffwaarschuwingkanaal privé: @everyone mag het niet zien, en expliciete View Channel-overwrites mogen uitsluitend voor management of de bot zijn. Administrator-rollen behouden via Discord hun wettelijke technische toegang. Een lid dat via een persoonlijke overwrite wordt toegelaten, wordt conservatief geweigerd voor dit kanaal. Staffgeschiedenis en notities zijn uitsluitend via geautoriseerde privécommandantwoorden beschikbaar; notitietekst wordt niet naar gewone stafflogs gekopieerd.

Voor een configuratiesectie groter dan de Discord-modallimiet:

```powershell
npm.cmd run config:export -- .\config\export.json
# Bewerk het geëxporteerde JSON-bestand lokaal.
npm.cmd run config:import -- .\config\export.json
npm.cmd run doctor
```

Export overschrijft geen bestaand bestand. Import valideert het schema, verhoogt de revisie en maakt oude setupsessies ongeldig. De CLI is bedoeld voor een vertrouwde beheerder van de host en heeft geen Discord-token nodig. Rol- en kanaalbestaan controleer je daarna met doctor. Wijzig nooit handmatig tabellen terwijl de bot draait.

## Commands en toegang

Alle commandantwoorden met staff-, moderatie- of configuratiegegevens zijn ephemeral. Publieke aankondigingen gaan via de persistente outbox; een bevestiging **ingepland** betekent opgeslagen voor verzending, geen claim dat Discord al heeft bezorgd. Verzendfouten blijven zichtbaar in de outbox en systeem-/consolelogs.

| Groep | Commands | Standaardtoegang |
| --- | --- | --- |
| Staff | `/aannemen`, `/ontslag`, `/staffupdate`, `/staffopmerking`, `/staffstatus` | Managementrol + Manage Roles |
| Staff lezen | `/staffoverzicht`, `/staffgeschiedenis`, `/staffstats` | Support of management volgens commandbeleid + View Audit Log |
| Intern | `/staffwaarschuwing geven/bekijken/intrekken` | Managementrol + Manage Roles |
| Bans | `/ban`, `/unban` | Moderator/management + Ban Members |
| Kick | `/kick` | Moderator/management + Kick Members |
| Waarschuwingen | `/warn`, `/warnings` | Support/moderator/management + Moderate Members |
| Timeouts | `/timeout`, `/untimeout`, `/clearwarnings` | Moderator/management + Moderate Members |
| Kanaalmoderatie | `/purge`, `/lock`, `/unlock`, `/modlogs` | Moderator/management + passende Discord-rechten |
| Communicatie | `/say`, `/embed`, `/changelog` | Management + Manage Messages |
| Giveaway | `/giveaway`, beheer eindigen/opnieuw/reroll | Management + Manage Guild |
| Giveaway lezen | `/giveawaybeheer status/bewijs` | Serverleden |
| Documenten | `/apv` en `/regels` bekijken/accepteren | Serverleden |
| Documentbeheer | Toevoegen/publiceren; acceptaties | Management + Manage Guild; lezen van acceptaties + View Audit Log |
| Evenementen | `/evenement maken/annuleren/deelnemers` | Management + Create Events/Manage Events |
| Community lezen | `/evenement lijst`, `/fivem status/spelers` | Serverleden |
| Configuratie | `/setup`, `/antinuke status/configuratie/test`, `/systeem status/acties/afhandelen` | Expliciete ownergebruikers of ownerrollen |

Slash-commandzichtbaarheid is niet de autorisatie. Iedere handler controleert guild, actor, ingestelde rollen en vereiste Discord-permissies opnieuw. Gevoelige commands zijn begrensd op 3 uitvoeringen per 10 seconden per actor/command; alle interacties samen op 12 per 10 seconden. De guildeigenaar kan gewone beheertaken uitvoeren, maar moet voor owner-only configuratie expliciet als owner zijn ingesteld.

Duraties: `30s`, `30m`, `2h`, `7d`, `1w`. Timeouts maximaal 28 dagen, algemene bans/giveaways maximaal 365 dagen en evenementen maximaal 7 dagen. Evenementstart is ISO-8601 met expliciete tijdzone, bijvoorbeeld `2026-12-01T20:00:00+01:00`. De UI toont Discord-timestamps in de lokale tijd van de lezer.

`/ban` zonder duur is permanent; met duur tijdelijk als ingeschakeld. Automatisch unbannen gebeurt uitsluitend als de actuele banreden de unieke generatie-referentie van deze sanctie bevat. Een nieuwere/andere ban wordt niet opgeheven. DM-fouten stoppen een uitgevoerde moderatieactie niet en worden gelogd. `/ban`, `/kick` en staffcommands beschermen zichzelf, de bot, bots, de guildeigenaar, owneraccounts en ingestelde beschermde rollen. `/ban` vereist een huidig serverlid; `/unban` gebruikt een Discord-ID van een bestaand geband account.

`/purge` verwijdert uitsluitend opgehaalde berichten jonger dan 14 dagen. Een kanaalslot wijzigt de Send/Create Thread-flags voor @everyone en bewaart afzonderlijk eerdere toestemmingen, verboden en ontbrekende overwrites. Rollen met een eigen allow kunnen volgens Discord nog schrijven; de bot claimt geen volledige kanaalisolatie.

`/say` verstuurt gewone tekst tot 1900 tekens met een kleine verzendreferentie. `/embed` accepteert #RRGGBB en alleen HTTP(S)-thumbnail-URL's. User-/rolmentions in embeds worden correct weergegeven, maar `allowedMentions` voorkomt ongewenste notificaties. Massamentions en rolmentions via `/say` of aangepaste communicatietekst worden geweigerd.

## Anti-Nuke en anti-misbruik

Beveiliging staat standaard aan. De standaardactie is **strip**: bij een overschreden auditdrempel verwijdert de bot gevaarlijke, beheersbare rollen van de aantoonbare actor. Dat verandert geen gedeelde rolpermissies voor andere leden. Alternatieven zijn een timeout van één uur of uitsluitend een alert. Administrator-accounts kunnen niet worden getimeout; managed rollen en accounts boven de botrol kunnen niet worden beperkt.

Detectie omvat kanaal-/rolcreate, delete en update, kanaaloverwrites, lidrolwijzigingen, webhookmutaties, bans, kicks en serverinstellingen. Audit-entry-ID's zijn persistent gededupliceerd. Serverevents leveren een tweede observatiepad; passende recente auditlogs worden met target-ID gecorreleerd. Geen willekeurige nieuwste auditregel wordt als daderbewijs gebruikt. Zonder betrouwbare attributie volgt een melding zonder accountactie.

Automatische anti-spam en mass-mentioncontrole verwijderen waar mogelijk het overtredende bericht en geven een timeout. Een joinburst beperkt recente nieuwe leden; dit is een rate-limitmaatregel en kan ook legitieme nieuwe leden raken. Thresholds staan expliciet in het paneel. Webhookbursts kunnen de specifieke webhook verwijderen als de eigenaar bekend en niet vertrouwd is; onbekende eigenaren veroorzaken uitsluitend een alert. Botuitnodigingen vereisen een expliciete botallowlist. Vertrouwde users/bots, guildeigenaar, de eigen bot en configuratieowners worden wel gelogd maar niet automatisch zwaar gesanctioneerd. Administrator is bij anti-spam een conservatieve alertuitzondering, geen algemene Anti-Nuke-vrijstelling.

`/antinuke test` simuleert drempelbeslissingen en schrijft uitsluitend een testlog. De test voert geen ban, kick, timeout, rol- of kanaalwijziging uit en gebruikt geen productiehits. Test echte schadelijke scenario's uitsluitend in een afgeschermde testguild.

De bot kan pas reageren wanneer Discord events en auditinformatie levert. Hij voorkomt niet alle schade en biedt geen volledige rollback. Verwijderde berichten, kanalen en integratierollen worden niet gereconstrueerd. Herstelbare tijdelijke bans, berichtpublicaties en geplande taken zijn wel persistent.

## Giveaways

Deelnemen via de knop, unieke SQL-entry per lid, geen bots en hercontrole van lidmaatschap bij afsluiten. De vrije `voorwaarden`-tekst is informatief; de bot interpreteert geen natuurlijke taal om bijvoorbeeld speeltijd, Discord-boosts of FiveM-geld automatisch te verifiëren.

Een cryptografische seed wordt vooraf gecommit met SHA-256. De trekking wacht totdat de commitment daadwerkelijk op Discord is verzonden. Bij afsluiten wordt per geldig Discord-ID `SHA256(seed + ':' + ID)` berekend; sorteer oplopend op de hexhash en kies het gewenste aantal. Onvoldoende geldige deelnemers betekent **geen winnaars**. Een API-fout maakt een lid niet onterecht ongeldig: de sluiting wordt later hervat. Seed, commitment, geldige snapshot, uitgesloten vorige winnaars en resultaten zijn downloadbaar via `/giveawaybeheer bewijs`; [trekking verifiëren](docs/GIVEAWAY-BEWIJS.md).

`opnieuw` opent een nieuwe ronde en wist de huidige deelnemerlijst; eerdere trekkingbewijzen blijven bestaan. `reroll` publiceert een nieuwe commitment, wacht 30 seconden en gebruikt dezelfde deelnemers met uitsluiting van alle eerdere winnaars. Nieuwe deelname tijdens reroll is gesloten. Dit bewijs toont reproduceerbaarheid en commitmentconsistentie; een beheerder met schrijfrechten op de database blijft technisch in staat de opgeslagen gegevens te manipuleren.

## FiveM, APV/regels en evenementen

Zet het vertrouwde FiveM-serverendpoint uitsluitend in `FIVEM_BASE_URL` in `.env`, en desgewenst een echte `https://cfx.re/join/...` link in `FIVEM_JOIN_URL`. De bot gebruikt `info.json`, `dynamic.json` en `players.json`, zoals beschreven in de [officiële Cfx-documentatie](https://docs.fivem.net/docs/server-manual/proxy-setup/). Hij opent geen RCON, console, spelers-IP's of license-identifiers. Een statuskanaal wordt standaard iedere 60 seconden bijgewerkt; een command gebruikt maximaal 15 seconden cache. HTTP-timeout 5 seconden per endpoint, response maximaal 1 MiB, geen redirects.

Spelersnamen zijn standaard verborgen. Zet `fivem.showPlayers` expliciet aan wanneer je ze wilt publiceren. Een 403, afgeschermd endpoint of netwerkstoring wordt als onbereikbaar/onbekend weergegeven en bewijst niet dat de gameserver offline is. De bot omzeilt geen afgeschermde endpoints.

Voer eigen APV en regels in met `/apv toevoegen` en `/regels toevoegen`. Iedere toevoeging maakt een nieuwe, onveranderlijke versie. Publicatie heeft een versiegebonden acceptatieknop. Een nieuwe versie wist oude acceptaties niet. Dit zijn jouw serverdocumenten; er is geen verzonnen juridisch APV-document meegeleverd.

Evenementen worden als externe **Discord Scheduled Events** aangemaakt en krijgen daarnaast een persistente RSVP-knop met capaciteit, afmelden en kanaalreminder 15 minuten voor de start. RSVP-capaciteit geldt voor de botaanmeldingen; Discords afzonderlijke knop **Interested** is een andere lijst. De scheduler activeert en sluit de events. Is het volledige tijdvenster tijdens uitval verstreken, dan wordt het nog geplande event als gemist geregistreerd en geannuleerd. Annulering wordt ook op Discord uitgevoerd. Een crash na Discord-create kan aan de unieke RLRP-referentie worden herkend en gereconcilieerd.

## Huisstijlassets

`assets/rlrp-logo.png` en `assets/rlrp-banner.png` zijn nieuw gegenereerd naar jouw referenties: blauwe Rotterdamse skyline, metallic witte R, witte 3D-lettering en cyaan Roleplay-script. Upload het logo als servericon/botavatar in Discord/Developer Portal. Upload de banner waar jouw Discord-account/server die functie ondersteunt. Changelogs voegen de meegeleverde banner automatisch als Discord-attachment toe; de embeds gebruiken #1675FF en waar aanwezig het servericon. De prompts staan in [assets/GENERATIE.md](assets/GENERATIE.md).

De bot leest bij opstart en iedere vijf minuten de emoji van jouw application: `rlogo`, `upvote` en `downvote`. De applicationcache krijgt voorrang op een gelijknamig guildemoji. Aannemen/promotie gebruikt `:upvote:`, demotie/ontslag `:downvote:`. `:rlogo:` komt onder de embed en als reactie. Expliciete bereikbare emoji-ID's kun je instellen via `/setup`. De bot haalt echte ID's en CDN-afbeeldingen op; ontbrekende emoji veroorzaken een systeemmelding en een zichtbare Unicode-fallback. Applicatie-emoji vereisen volgens de [officiële Emoji API](https://docs.discord.com/developers/resources/emoji#application-owned-emoji) geen Use External Emojis-permissie; die permissie blijft nuttig voor guildemoji. De bot logt mislukte reacties.

## Onderhoud, back-up en herstel

```powershell
npm.cmd run backup
```

Dit gebruikt de SQLite online backup-API en maakt een consistente snapshot in `backups/`, ook bij WAL. Kopieer een actieve `.sqlite` niet los van zijn WAL-bestanden. Bewaar back-ups en `.env` met beperkte hostrechten; back-ups bevatten interne notities en staffgegevens.

Voor herstel: stop de bot, bewaar de huidige volledige `data/` map apart, zet de gekozen back-up als `data/rlrp.sqlite` terug in een lege datamap, controleer `DATABASE_PATH` en start opnieuw. Kopieer geen oude `-wal`/`-shm` bestanden naast een teruggezette snapshot. Migraties draaien gecontroleerd en een quick_check moet slagen. Daarna worden verlopen bans, giveaways, evenementen en de outbox hervat. Dit project ondersteunt één actieve guild/proces; PostgreSQL vraagt een aparte repositoryadapter en SQL-migratie.

Een onderbroken Discord-mutatie verschijnt onder `/systeem acties` als **uncertain**. Controleer de daadwerkelijke rollen, ban of kanaalrechten, herstel zo nodig handmatig en leg de controle vast met `/systeem afhandelen`. Dit command verandert uitsluitend de auditstatus en voert de oorspronkelijke mutatie niet opnieuw uit. Tijdelijke bans worden zelfstandig gereconcilieerd; permanente bans worden nooit vanzelf opgeheven.

Audit-/systeemlogs en incidenten worden standaard na 90 dagen opgeschoond. Berichtinhoud is standaard niet opgeslagen; uncached verwijderde berichten kunnen niet worden gereconstrueerd. Staffhistorie, interne waarschuwingen, sancties, documenten, acceptaties en giveawaybewijzen blijven bewaard voor beheer. Hanteer daarvoor je eigen bewaarbeleid en verwijder oude interne gegevens via een gecontroleerde, geback-upte databasemigratie.

Laat de bot draaien onder een procesmanager/service met automatische herstart en een beperkte hostgebruiker. Een voorbeeld voor Linux staat in `deploy/rlrp-main.service`: zet het project in `/opt/rlrp-main-bot`, maak de lokale servicegebruiker `rlrp` en geef die leesrechten op code/.env en schrijfrechten op `data/` en `backups/`. Maak beide mappen vooraf. Controleer met `command -v node` of ExecStart het correcte Node 24-pad gebruikt. Kopieer het servicebestand naar `/etc/systemd/system/rlrp-main.service`, voer `systemctl daemon-reload` uit en start met `systemctl enable --now rlrp-main`. Bekijk `journalctl -u rlrp-main` bij problemen. Op Windows kan een bestaande service-wrapper deze `npm.cmd start`-opdracht uitvoeren met de projectmap als working directory. Een werkende persistentieschijf en automatische hostback-ups zijn nodig; Discord-uitval kan geplande acties vertragen.

Update afhankelijkheden bewust: eerst back-up, daarna update in een testkopie, `npm run check`, `npm test`, `npm audit`, live acceptatietest en pas daarna productie. Node 24 geeft momenteel een ExperimentalWarning voor `node:sqlite`; de bot is getest op de genoemde Node-versie. Dit is geen SQLite-corruptiemelding. Pin je runtime en test Node-updates voordat je ze invoert.

## Foutopsporing

| Probleem | Controle |
| --- | --- |
| Token/login ongeldig | Nieuwe bot-token, juiste application, geen extra quotes/spaties; reset gedeelde tokens |
| Commands ontbreken | Application ID, guild-ID, scopes, `npm run register` en Integrations commandzichtbaarheid |
| Disallowed intents | Server Members/Message Content in Developer Portal, eventueel Discord-goedkeuring |
| Geen bevoegdheid | Staffrol én Discord-permissie; owner-only vereist expliciete env-owner of env-ownerrol |
| Missing Permissions | Botrolpositie en kanaaloverwrites; `npm run doctor`; voor evenementen ook Create Events |
| Berichten komen later/niet | `/systeem status`, outbox.error, View/Send/Embed/Attach/Read-rechten en kanaalbestaan |
| Anti-Nuke beperkt niemand | Betrouwbare attributie, allowlists, botrol boven actor, Manage Roles/Moderate Members |
| FiveM onbereikbaar | Endpoint, firewall, HTTP-status en response; stel geen RCON-token in |
| SQLite busy/corrupt | Eén proces, lokale schijf, quick_check, betrouwbare snapshot; geen live losse databasekopie |
| Interactie verlopen | Nieuwe `/setup` openen; rate-limit of langdurige Discord-API-uitval controleren |

Zie [live acceptatiecheck](docs/ACCEPTATIE.md) voordat je deze bot in productie inzet.
