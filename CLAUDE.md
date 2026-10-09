# Verbeterlus

Desktop-app voor procesverbetering. Specificatie: SPEC.md. Bouwplan en status: PLAN.md.

## Opdrachten
- `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`
- `npm run tauri dev` (app) · `npm run tauri build` (alleen op macOS)
- `npm run e2e` (Playwright, Chromium; op de Mac eerst `npx playwright install chromium`)
- `npm run eval` (nep-AI) · `npm run eval:live` (echte API, `ANTHROPIC_API_KEY`)
- `cd src-tauri && cargo check` (Linux vereist `libwebkit2gtk-4.1-dev`)

## Mappen
- `src/core` — domeinlogica: model, validatie, import, analysis, rules, assessment, templates, learning
- `src/ai` — enige plek voor Claude-aanroepen; `prompts/<id>.v<N>.md`, `schemas.ts`, `fake.ts`
- `src/db` — `Db`-interface, implementaties, repos; migraties in `src-tauri/migrations`
- `src/services` — orkestratie (AI + kern + database), bestandslezers voor Excel/Word
- `src/screens`, `src/components` — React
- `tests/` — Vitest, `tests/fixtures/<formaat>/` (binaire fixtures: `python3 tests/fixtures/make_fixtures.py`); `e2e/` — Playwright; `eval/` — testset

## Harde regels
- `src/core` importeert niets uit React, Tauri, `src/ai` of `src/db`.
- Claude schat; route, scores, kwadrant en correcties berekent geteste code.
- Elk AI-antwoord gaat door een Zod-schema; daarna controleert code stap-id's en regel-id's.
- Tests en `npm run eval` doen nooit echte API-aanroepen; gebruik `src/ai/fake.ts`.
- API-sleutel alleen in de sleutelhanger: nooit in database, repo, logs, localStorage of `ai_calls`.
- Geen half procesmodel opslaan: alles gaat door `validateModel`.
- Gebruikersoverschrijvingen worden bewaard in `overrides`.
- Lessen en promptversies worden nooit automatisch actief; nieuwe promptversie alleen als live-eval niet lager scoort.
- Verzin geen cijfers of bronnen in de regelbank; onbekend effect = 0 + markering.
- Modelnamen en API-syntax uit actuele documentatie, niet uit het geheugen.
- Schermteksten Nederlands; code, namen en commits Engels.
- Fouten oplossen, niet onderdrukken (geen `@ts-ignore`, `eslint-disable` of `.skip` zonder reden in commentaar).

## Fase klaar
1. typecheck, lint, test en build slagen (en wat de fase in PLAN.md extra vraagt);
2. PLAN.md: status en afwijkingen bijgewerkt;
3. commit gemaakt;
4. lijst met handmatige controles aan Patrick gegeven.
