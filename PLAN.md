# Verbeterlus — bouwplan

Zes fases. Elke fase begint in een schone sessie met de faseprompt en eindigt pas als: `npm run typecheck`, `npm run lint`, `npm test` en `npm run build` slagen, deze file is bijgewerkt (status + afwijkingen), en er een commit is. Daarna doet Patrick de handmatige controle.

Ontwikkelomgeving: Linux-container (geen scherm, geen macOS). Daar kan: Vitest, typecheck, lint, Vite-build, `cargo check`/`cargo test` (na `apt-get install libwebkit2gtk-4.1-dev …`), Playwright tegen de Vite-build. Daar kan níet: `npm run tauri dev` bekijken en `npm run tauri build` voor macOS. Die stappen staan onder *Handmatig*.

## Status

| Fase | Status | Notities |
| --- | --- | --- |
| 0 Specificatie | klaar | SPEC.md, PLAN.md, CLAUDE.md |
| 1 Fundament | klaar, handmatig gecontroleerd | zie *Afwijkingen fase 1* |
| 2 Verbetering beoordelen | klaar, handmatig gecontroleerd met de echte API | zie *Afwijkingen fase 2* |
| 3 Proces invoeren en tonen | klaar (wacht op handmatige controle) | zie *Afwijkingen fase 3* |
| 4 Procesanalyse | open | |
| 5 Leerlus | open | |
| 6 Afwerking | open | |

---

## Fase 1 — Fundament

**Oplevering**
- Tauri 2-project (React + TS strict + Vite + Tailwind), `npm run tauri dev` start de app.
- Migratie `0001_init.sql` met alle tabellen uit SPEC §9 (FTS-tabel in een aparte migratie `0002_fts.sql`, die bij ontbrekende FTS5 overgeslagen kan worden).
- `src/db`: `Db`-interface, implementaties Tauri / node:sqlite (tests) / sql.js (browser), `settingsRepo`.
- `src/core/model`: types (SPEC §3) en `validateModel` (§3.1) met tests per foutcode.
- `src/ai`: `AiClient`-interface, `fake.ts`, `claude.ts` met alleen `testConnection`, foutvertaling naar `AiError` (getest met nep-`fetch`).
- Rust: `keyring`-commando's achter een trait, `tauri-plugin-sql`, `tauri-plugin-http` met scope `https://api.anthropic.com/*`.
- Schermen: navigatie met lege Verbeteringen, Processen, Geleerd; Instellingen met API-sleutel, model, uurtarief (€ 75), AI-toestemming, „Test verbinding”.
- Scripts: `dev`, `build`, `test`, `test:watch`, `lint`, `typecheck`, `format`, `tauri`.

**Bestanden**: `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `tailwind`-config, `src/main.tsx`, `src/App.tsx`, `src/screens/*`, `src/db/**`, `src/core/model/**`, `src/ai/{types,fake,claude,errors}.ts`, `src-tauri/**`, `src-tauri/migrations/0001_init.sql`, `tests/**`.

**Controle (Claude)**: typecheck, lint, test, build; `cargo check` in `src-tauri`; test die alle migraties op node:sqlite draait en het schema controleert.

**Handmatig (Patrick, op de Mac)**: `npm install && npm run tauri dev`; API-sleutel invoeren, app herstarten, „Test verbinding” geeft groen; in Sleutelhangertoegang staat het item `nl.procesverbetering.app`; het databasebestand bevat geen sleutel.

**Afwijkingen fase 1**
- Versies: Tauri 2.12, React 19, Vite 8, Tailwind 4, Vitest 5, Zod 4, `@anthropic-ai/sdk` 0.132. TypeScript **6.0** in plaats van 7, omdat typescript-eslint 7 nog niet ondersteunt.
- „Test verbinding” gebruikt de Models API (`models.retrieve`): controleert sleutel én model en kost geen tokens. „Modellen ophalen” vult de modelkeuze via `models.list`.
- `AiClient` heeft in fase 1 alleen `testConnection` en `listModels`; de overige methoden uit SPEC §7.1 komen in de fase waarin ze nodig zijn.
- sql.js (browser/Playwright) heeft geen FTS5. Migratie 2 is daarom optioneel in de TS-runner en wordt daar overgeslagen; de terugval op labels volgt in fase 5. In Tauri en node:sqlite is FTS5 aanwezig (getest).
- Tabel `cases` heeft een extra kolom `lessons` voor de full-text index (SPEC §9 bijgewerkt).
- Buiten Tauri staat de API-sleutel in `sessionStorage` (alleen voor browser-dev); `?fakeAi=1` in de URL kiest de nep-AI.
- Rust: `keyring` 4.2 achter de trait `SecretStore` (tests met `MemoryStore`).
- Tests gebruiken de ingebouwde `node:sqlite` (Node ≥ 22.13) in plaats van `better-sqlite3`, zodat `npm install` op de Mac geen Python of C++-compilatie nodig heeft.

## Fase 2 — Verbetering beoordelen

**Oplevering**
- `src/core/assessment`: `chooseRoute` (§6.1), `impactScore`, `annualBenefit` (met rekensom-tekst), `effortScore`, `priority`, `quadrant`, `status`-overgangen.
- `src/core/templates`: vijf sjablonen (§6.5).
- `src/ai`: `clarify`, `estimate`, `plan` met Zod-schema's (§7.2) en promptbestanden `clarify.v1.md`, `estimate.v1.md`, `plan.v1.md`.
- Repos: improvements, clarifications, problem statements, assessments, overrides, action plans/steps.
- Schermen: bord per status, nieuw idee, doorvragen (max. 5), beoordeling met rekensommen en overschrijven, stappenplan bewerken.
- Overschrijvingen opgeslagen in `overrides` (verwerking in fase 5).

**Controle (Claude)**: tabelgestuurde tests met randgevallen op elke drempel (I = 5, E = 5, bandgrenzen 1.000/5.000/…); tests voor elke regel R1–R7; drie voorbeeldideeën die met de nep-AI de hele lus doorlopen tot en met een stappenplan (integratietest met node:sqlite).

**Handmatig**: één echt idee invoeren met de echte API, een schatting overschrijven, stappenplan aanpassen.

**Afwijkingen fase 2**
- Structured outputs: eigen omzetting Zod → JSON-schema (`src/ai/outputFormat.ts`) zodat `enum` echt wordt afgedwongen; aanroep via `messages.create` en eigen JSON-parse + Zod-controle, zodat `refusal` en `max_tokens` herkend worden vóór het parsen. Client-timeout 15 minuten zodat de herhaalpoging met dubbele `max_tokens` zonder streaming mag.
- Server-side terugval (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) standaard aan; weigert het model dat, dan valt de app voor de rest van de sessie terug op een gewone aanroep.
- Visgraat als vast object met zes lijsten (geen `z.record`; open maps worden niet ondersteund).
- Het stappenplan-schema wordt per route gebouwd: `phase` is een enum van de fasen van dat sjabloon.
- Orkestratie in `src/services/improvementService.ts` (AI + kern + database); integratietests daarop met `node:sqlite` en de nep-AI.
- Toestemming: AI-knoppen vragen eenmalig per idee om bevestiging (`ai_consent`), naast de algemene instelling.
- Eén actuele beoordeling per verbetering; Claudes ruwe schatting blijft bewaard, overschrijvingen gaan per veld naar `overrides`.
- Correctiefactoren worden al door `assess()` ondersteund (getest), maar pas in fase 5 gevuld; het scherm toont „nog te weinig data”.
- Opeenvolgende schrijfacties (bv. stappenplan + stappen) zijn niet in één transactie: de Tauri SQL-plugin gebruikt een pool. Acceptabel voor één gebruiker; herzien als het problemen geeft.

## Fase 3 — Proces invoeren en tonen

**Oplevering**
- Parsers in `src/core/import`: form, BPMN, draw.io (incl. gecomprimeerd), Mermaid, vsdx, Excel/CSV (plus downloadbaar sjabloon), docx-tekst.
- Fixtures in `tests/fixtures/<formaat>/`: per formaat minstens *recht*, *beslissing-en-lus*, *rollen*; plus kapotte bestanden.
- `src/ai`: `extractProcess` (tekst, afbeelding, PDF) met `ProcessExtraction` en `extract.v1.md`; `extractionToModel`.
- Diagramscherm: elkjs-opmaak, banen per rol, bewerken, zijpaneel, validatiepaneel, bevestigen (nieuwe versie).
- Formaatherkenning op inhoud.

**Controle (Claude)**: alle fixtures stap voor stap getest (stappen, types, rollen, flows); kapotte en onbekende bestanden geven `ok: false` met Nederlandse melding; geen half model in de database (test).

**Handmatig**: een eigen Visio (.vsdx of PDF-export) en een draw.io-bestand inladen, corrigeren, bevestigen.

**Afwijkingen fase 3**
- Diagramopmaak met een eigen, geteste functie (`src/core/layout.ts`: kolommen volgens het langste pad, banen per rol, lussen gestippeld) in plaats van elkjs: voorspelbaar, zonder extra afhankelijkheid. Stappen worden niet gesleept; de opmaak volgt het model.
- Bewerkingen op het model als zuivere functies (`src/core/model/edit.ts`), getest.
- Excel (`read-excel-file/universal`) en Word (`mammoth`) worden in de app-laag gelezen (`src/services/fileReaders.ts`); de kern krijgt rijen of tekst. mammoth geeft 3 `npm audit`-meldingen (moderate) in `argparse`/`sprintf-js`, alleen gebruikt door de mammoth-CLI, niet door de bibliotheek.
- Visio: rollen worden bepaald op positie binnen banen (container-relaties in .vsdx worden niet gelezen); bij meerdere pagina's alleen de eerste. Testbestanden zijn met een script gemaakt (`tests/fixtures/make_fixtures.py`) en nog niet getest met een echt Visio-bestand.
- draw.io: bij meerdere pagina's alleen de eerste; `UserObject`-cellen komen achteraan in de stappenlijst (geen gevolg voor het diagram).
- Concepten worden niet opgeslagen: een model wordt pas bewaard bij bevestigen en alleen als het geen validatiefouten heeft. Elke bevestiging is een nieuwe versie.
- AI-invoer: afbeeldingen tot 5 MB, PDF tot 24 MB; daarboven een melding vóór verzending. Toestemming per concept (`ai_consent`, type PROCESS).
- Sjabloon downloaden via een opslagdialoog (`tauri-plugin-dialog`) en een eigen Rust-commando `save_text_file`.

## Fase 4 — Procesanalyse

**Oplevering**
- `src/core/analysis/metrics.ts` (§5.1) met een met de hand doorgerekend voorbeeldproces (`tests/fixtures/analysis/handcalc.*` + uitwerking in commentaar).
- `src/core/rules`: bank met alle 8 + 3 + 29 regels, detectoren (§5.2). Per detector een test die raakt en een die niet raakt.
- `src/ai`: `suggest` met `ProcessSuggestions` en `suggest.v1.md`; `validateSuggestions` weigert onbekende stap-id's en regels (getest).
- Indeling makkelijk/moeilijk en volgorde (§5.3).
- Scherm: kengetallen, regeltreffers, suggesties in twee groepen, markering in diagram, reacties met reden, „Maak verbetering”.
- Vraag om tijden voor max. vijf stappen; melding „kwalitatief”.

**Controle (Claude)**: tests, typecheck, build.

**Handmatig**: analyse op het proces uit fase 3 en beoordelen of de suggesties kloppen.

## Fase 5 — Leerlus

**Oplevering**
- Afronden met werkelijke waarden → `outcomes` + `cases`.
- `src/core/learning`: correctiefactoren (§8.1), trefkans (§8.2), casusscore (§8.3).
- FTS5-controle met terugval op labels; casussen mee in prompts.
- Draaiboek: `proposeLessons` + scherm (voorstellen, goedkeuren, bewerken, uitzetten).
- `eval/cases/*.json`, `npm run eval` (nep) en `npm run eval:live`; resultaten per promptversie.
- Scherm „Wat heeft de app geleerd”.

**Controle (Claude)**: tests (onder minimum geen correctie; uitschieter begrensd), typecheck, build, `npm run eval`.

**Handmatig**: twee verbeteringen afronden en zien dat het leerscherm verandert.

## Fase 6 — Afwerking

**Oplevering**: export Markdown/PDF (verbetering en analyse), JSON-export/import, back-up en terugzetten, nette foutmeldingen (§10.1), lege schermen met uitleg, voorbeeldgegevens laden/verwijderen, Playwright-rooktest (idee → stappenplan met nep-AI), README (NL), app-icoon. Daarna een review door een subagent tegen SPEC.md (alleen werking/eisen), punten oplossen, alle controles opnieuw.

**Controle (Claude)**: alle bovenstaande plus `npx playwright test`.

**Handmatig**: `npm run tauri build` op de Mac, app in Programma's zetten, back-up maken en terugzetten.
