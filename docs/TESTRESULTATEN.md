# Uitgevoerde controles

Datum: 14–15 oktober 2026. Windows, Node.js 24.14.0, npm 11.9.0, discord.js 14.27.0.

| Controle | Resultaat |
| --- | --- |
| `npm ci --ignore-scripts --no-fund --no-audit` | Geslaagd; 25 packages exact volgens package-lock geïnstalleerd |
| `npm run check` | 49 JavaScript-bestanden syntactisch geldig; alle bronimports geladen |
| Slash-commandvalidatie | 33 unieke roots, 55 routes; iedere root gekoppeld aan een echte service |
| SQL-migraties | Vier migraties toepasbaar, herhaalbaar en quick_check geslaagd |
| Testsuite | **108 geslaagd, 0 gefaald, 0 overgeslagen, 0 TODO** |
| `npm audit --json` online | 0 bekende kwetsbaarheden gemeld tijdens deze controle |
| Uitnodigingsgenerator | Correcte application/guild, officiële bot + applications.commands scopes, zonder Administrator |
| Huisstijl | Logo/banner visueel gecontroleerd; blauwe embeds; application/guild `:rlogo:`, `:upvote:` en `:downvote:` getest |

Het machineleesbare verslag staat in [test-results.xml](test-results.xml); absolute lokale padnamen zijn voor publicatie verwijderd. Tests zijn uitgevoerd met echte SQLite-databases en gesimuleerde Discord/FiveM-grenzen. Er is geen live bot-token gebruikt, geen productionguild gewijzigd en geen echte giveaway of destructieve beveiligingstest gestart.

De hostingaanpassing voegt tests toe voor Node-versiecontrole, een ontbrekende optionele `.env`, echte native `.env`-parsing, leesfouten en de voorrang van hostingvariabelen. `index.js` en `register.js` zijn meegenomen in de syntaxcontrole. Het account op bot-hosting.net is niet vanuit deze chat ingericht.

De tests dekken onder meer beide autorisatielagen, expliciete ownerrollen, rolverlies, beschermde doelen, rankrichting, rolmutaties, interne notitieafscherming, tijdelijke/permanente bans, generatiebescherming, onzekere mutaties, kanaalslotherstel, auditdeduplicatie, stale auditlogs, veilige simulatie, spam, mentions, botallowlists, raids, webhookeigenaren, persistente deelnemers, deelnemershercontrole, commitmentpublicatie vóór trekking, reroll, APV-versies, evenementcapaciteit, gemiste evenementen, FiveM-privacy, responsegrenzen, outboxretries en daadwerkelijke SQLite-back-up/restore.

Een offline `npm ci`-poging kon de dependencies niet uit de geïsoleerde npm-cache halen; de installatie met registrytoegang slaagde daarna. Dat is een omgevings-/cacheverschil, geen falende applicatietest.

Voor productie blijven de [live acceptatiecontroles](ACCEPTATIE.md) met een nieuwe Discord-token en het echte FiveM-endpoint noodzakelijk. De gedeelde token is niet opgeslagen of gepubliceerd. De komende workflow draait alleen syntax-, import-, schema- en unittests en start de bot niet.
