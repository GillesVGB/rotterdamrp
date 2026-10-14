# Uitgevoerde controles

Datum: 15 oktober 2026. Windows, Node.js 24.14.0, npm 11.9.0, discord.js 14.27.0.

| Controle | Resultaat |
| --- | --- |
| `npm run check` | 56 JavaScript-bestanden geldig; alle bronimports geladen |
| Slash-commandvalidatie | 29 unieke roots, 47 routes; iedere root gekoppeld aan een echte service |
| SQL-migraties | Vijf migraties; migratie van een echte oude database, herstart en quick_check geslaagd |
| Volledige testsuite | **191 geslaagd, 0 gefaald, 0 fouten, 0 overgeslagen, 0 TODO** |
| Installatie en dependencies | Lockfile behouden; eerdere schone installatie geslaagd met dezelfde dependencies |
| Uitnodigingsgenerator | Officiële bot + applications.commands scopes; geen Administrator of Manage Webhooks nodig voor de bot |
| Huisstijl | Logo/banner inbegrepen; staffembeds zonder foto's; application/guild `:rlogo:`, `:upvote:` en `:downvote:` getest |

Het machineleesbare verslag staat in [test-results.xml](test-results.xml); absolute lokale padnamen zijn voor publicatie verwijderd. De tests gebruiken echte SQLite-databases, de echte discord.js-rolmanager en gesimuleerde Discord/FiveM-netwerkgrenzen. Er is geen live Discord-token gebruikt en geen productionguild gewijzigd.

De controles dekken Beheer zonder afzonderlijke moderatorrechten, alle 47 commandroutes, directe Discord-permissies voor moderatoren, rolverlies, hiërarchie, beschermde accounts, echte rolselectie, promotie/demotie, ontslag en behoud van communityrollen. De tests met de echte GuildMemberRoleManager controleren verouderde caches, afzonderlijke PUT/DELETE-verzoeken, gelijktijdige rolwijzigingen en API-fouten zonder valse succesregistratie.

Verder getest: automatische guildcommandregistratie en bevestiging, handmatige registratie, ontbrekende optionele .env, hostingvariabelen, runtimeversie, interactieve /help, vaste kanalen met oude configuratie, changelog zonder categorie/met optionele versie, paginaknoppen, privé staffwaarschuwingen, tijdelijke/permanente bans, onzekere mutaties, kanaalslotherstel, normale event-/auditlogging, giveaways, APV/regels, evenementen, FiveM-privacy, responsegrenzen, outboxretries en SQLite-back-up/restore. Eventtests bevestigen dat bursts, botjoins en berichten geen automatische beveiligingssancties uitvoeren.

De dependencies zijn ongewijzigd sinds de eerdere online npm-audit, die 0 bekende kwetsbaarheden meldde. Het GitHub-workflowbestand voert syntax-, import-, schema- en unittests uit zonder de bot te starten.

De bot-hosting.net-deployment en live Discord-werking zijn niet vanuit deze chat getest. Gebruik de [acceptatiecontroles](ACCEPTATIE.md) met jouw draaiende bot. De gedeelde token is niet in de bronbestanden of oplevering gepubliceerd.
