// Inputs for AI calls and how they are rendered into the user message.

export interface QuestionAnswer {
  question: string;
  answer: string | null;
}

export interface IdeaContext {
  title: string;
  description: string;
  domain: string;
}

export interface ProblemStatementInput {
  whatGoesWrong: string;
  howOften: string;
  cost: string;
  forWhom: string;
}

export interface SimilarCase {
  id: string;
  title: string;
  summary: string;
}

export interface ClarifyInput {
  idea: IdeaContext;
  qa: QuestionAnswer[];
  questionsLeft: number;
}

export interface EstimateInput {
  idea: IdeaContext;
  qa: QuestionAnswer[];
  problemStatement: ProblemStatementInput | null;
  similarCases: SimilarCase[];
  lessons: string[];
}

export interface PlanInput {
  idea: IdeaContext;
  problemStatement: ProblemStatementInput | null;
  route: string;
  method: string;
  phases: [string, ...string[]];
  startDate: string;
  estimationSummary: string;
  similarCases: SimilarCase[];
  lessons: string[];
}

function block(tag: string, content: string): string {
  return `<${tag}>\n${content.trim() || '(leeg)'}\n</${tag}>`;
}

function ideaBlock(idea: IdeaContext): string {
  return block('idee', `Titel: ${idea.title}\nDomein: ${idea.domain}\nBeschrijving: ${idea.description}`);
}

function qaBlock(qa: QuestionAnswer[]): string {
  return block(
    'eerdere_vragen',
    qa
      .map((q, i) => `${i + 1}. Vraag: ${q.question}\n   Antwoord: ${q.answer ?? 'null (overgeslagen)'}`)
      .join('\n'),
  );
}

function statementBlock(ps: ProblemStatementInput | null): string {
  return block(
    'probleemstelling',
    ps
      ? `Wat gaat mis: ${ps.whatGoesWrong}\nHoe vaak: ${ps.howOften}\nWat kost het: ${ps.cost}\nVoor wie: ${ps.forWhom}`
      : '',
  );
}

function contextBlocks(similarCases: SimilarCase[], lessons: string[]): string[] {
  const parts: string[] = [];
  if (similarCases.length > 0) {
    parts.push(
      block('vergelijkbare_casussen', similarCases.map((c) => `- ${c.title}: ${c.summary}`).join('\n')),
    );
  }
  if (lessons.length > 0) parts.push(block('lessen', lessons.map((l) => `- ${l}`).join('\n')));
  return parts;
}

export function renderClarify(input: ClarifyInput): string {
  return [ideaBlock(input.idea), qaBlock(input.qa), `questionsLeft: ${input.questionsLeft}`].join('\n\n');
}

export function renderEstimate(input: EstimateInput): string {
  return [
    ideaBlock(input.idea),
    statementBlock(input.problemStatement),
    qaBlock(input.qa),
    ...contextBlocks(input.similarCases, input.lessons),
  ].join('\n\n');
}

export function renderPlan(input: PlanInput): string {
  return [
    ideaBlock(input.idea),
    statementBlock(input.problemStatement),
    `Route: ${input.route} (${input.method})`,
    `Fasen in volgorde: ${input.phases.join(' → ')}`,
    `Startdatum: ${input.startDate}`,
    block('schatting', input.estimationSummary),
    ...contextBlocks(input.similarCases, input.lessons),
  ].join('\n\n');
}
