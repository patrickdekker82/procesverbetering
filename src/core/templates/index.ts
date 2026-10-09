import type { Route } from '../assessment/types';

// Step-plan templates per route (SPEC §6.5). Phase names are the only allowed values for plan steps.

export interface TemplateStep {
  what: string;
  deliverable: string;
}

export interface TemplatePhase {
  name: string;
  purposeNl: string;
  steps: TemplateStep[];
}

export interface Template {
  route: Route;
  methodNl: string;
  phases: TemplatePhase[];
}

const PDCA: TemplatePhase[] = [
  {
    name: 'Plan',
    purposeNl: 'Doel, nulmeting en aanpak vastleggen.',
    steps: [{ what: 'Nulmeting doen en doel vastleggen', deliverable: 'Nulmeting en meetbaar doel' }],
  },
  {
    name: 'Do',
    purposeNl: 'De verbetering op kleine schaal uitvoeren.',
    steps: [{ what: 'Verbetering uitvoeren in een proef', deliverable: 'Uitgevoerde proef' }],
  },
  {
    name: 'Check',
    purposeNl: 'Resultaat meten en vergelijken met de nulmeting.',
    steps: [{ what: 'Resultaat meten en vergelijken met het doel', deliverable: 'Meting na de proef' }],
  },
  {
    name: 'Act',
    purposeNl: 'Borgen of bijsturen.',
    steps: [{ what: 'Werkwijze vastleggen of bijsturen', deliverable: 'Aangepaste werkinstructie' }],
  },
];

export const TEMPLATES: Record<Route, Template> = {
  SNELLE_WINST: { route: 'SNELLE_WINST', methodNl: 'PDCA', phases: PDCA },
  OORZAAK_ZOEKEN: {
    route: 'OORZAAK_ZOEKEN',
    methodNl: 'A3 met 5× waarom en visgraat, daarna PDCA',
    phases: [
      {
        name: 'Achtergrond',
        purposeNl: 'Waarom dit probleem ertoe doet.',
        steps: [{ what: 'Achtergrond en belang beschrijven', deliverable: 'A3: achtergrond' }],
      },
      {
        name: 'Huidige situatie',
        purposeNl: 'Feiten en cijfers over het probleem nu.',
        steps: [{ what: 'Huidige situatie in kaart brengen met data', deliverable: 'A3: huidige situatie' }],
      },
      {
        name: 'Doel',
        purposeNl: 'Meetbaar doel.',
        steps: [{ what: 'Meetbaar doel formuleren', deliverable: 'A3: doel' }],
      },
      {
        name: 'Oorzaakanalyse',
        purposeNl: '5× waarom en visgraat.',
        steps: [{ what: '5× waarom en visgraat invullen met betrokkenen', deliverable: 'Grondoorzaak' }],
      },
      {
        name: 'Tegenmaatregelen',
        purposeNl: 'Maatregelen tegen de grondoorzaak.',
        steps: [{ what: 'Tegenmaatregelen kiezen', deliverable: 'Lijst tegenmaatregelen' }],
      },
      ...PDCA,
    ],
  },
  MEETPROJECT: {
    route: 'MEETPROJECT',
    methodNl: 'DMAIC',
    phases: [
      {
        name: 'Define',
        purposeNl: 'Probleem, klant en scope afbakenen.',
        steps: [{ what: 'Projectopdracht en scope vastleggen', deliverable: 'Projectopdracht' }],
      },
      {
        name: 'Measure',
        purposeNl: 'Meten hoe het proces nu presteert.',
        steps: [{ what: 'Meetplan maken en data verzamelen', deliverable: 'Nulmeting met spreiding' }],
      },
      {
        name: 'Analyze',
        purposeNl: 'Oorzaken van variatie vinden.',
        steps: [{ what: 'Data analyseren op oorzaken van variatie', deliverable: 'Aangetoonde oorzaken' }],
      },
      {
        name: 'Improve',
        purposeNl: 'Oplossingen testen.',
        steps: [{ what: 'Oplossing testen en effect meten', deliverable: 'Getest verbetervoorstel' }],
      },
      {
        name: 'Control',
        purposeNl: 'Resultaat borgen.',
        steps: [{ what: 'Beheersplan en meting invoeren', deliverable: 'Beheersplan' }],
      },
    ],
  },
  KNELPUNT: {
    route: 'KNELPUNT',
    methodNl: 'Vijf focusstappen (Theory of Constraints)',
    phases: [
      {
        name: 'Identificeer',
        purposeNl: 'Welke stap beperkt de doorvoer.',
        steps: [{ what: 'Knelpunt aantonen met wachtrij en doorvoer', deliverable: 'Bevestigd knelpunt' }],
      },
      {
        name: 'Benut maximaal',
        purposeNl: 'Geen capaciteit verspillen op het knelpunt.',
        steps: [{ what: 'Verlies op het knelpunt wegnemen', deliverable: 'Hogere benutting knelpunt' }],
      },
      {
        name: 'Ondergeschikt maken',
        purposeNl: 'De rest van het proces afstemmen op het knelpunt.',
        steps: [
          { what: 'Instroom en planning afstemmen op het knelpunt', deliverable: 'Aangepaste planning' },
        ],
      },
      {
        name: 'Verhoog capaciteit',
        purposeNl: 'Extra capaciteit als het nog niet genoeg is.',
        steps: [{ what: 'Capaciteit van het knelpunt vergroten', deliverable: 'Besluit over capaciteit' }],
      },
      {
        name: 'Herhaal',
        purposeNl: 'Opnieuw kijken waar het knelpunt nu zit.',
        steps: [{ what: 'Nieuw knelpunt bepalen', deliverable: 'Nieuwe meting doorvoer' }],
      },
    ],
  },
  HERONTWERP: {
    route: 'HERONTWERP',
    methodNl: 'Herontwerp-heuristieken, daarna PDCA per wijziging',
    phases: [
      {
        name: 'Heuristieken kiezen',
        purposeNl: 'Welke herontwerpregels toegepast worden.',
        steps: [{ what: 'Heuristieken kiezen en wijzigingen ontwerpen', deliverable: 'Lijst wijzigingen' }],
      },
      ...PDCA,
    ],
  },
};

export function templateFor(route: Route): Template {
  return TEMPLATES[route];
}

export function phaseNames(route: Route): string[] {
  return TEMPLATES[route].phases.map((p) => p.name);
}

/** Adds whole days to an ISO date (YYYY-MM-DD) in UTC. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const FISHBONE_CATEGORIES = [
  'MENS',
  'METHODE',
  'MIDDELEN',
  'MATERIAAL',
  'METING',
  'OMGEVING',
] as const;
export type FishboneCategory = (typeof FISHBONE_CATEGORIES)[number];
export type Fishbone = Record<FishboneCategory, string[]>;
