import type { ValidationIssue } from '../model/types';
import { validateModel } from '../model/validate';
import { centre, laneAt } from './geometry';
import type { DiagramState } from './diagram';
import { kindOf } from './diagram';
import { lineCount, TOO_MANY_LINES, type Measure } from './text';

export type DrawingIssueCode =
  'DECISION_FEW_EXITS' | 'DECISION_UNLABELLED' | 'OUTSIDE_LANE' | 'LABEL_TOO_LONG';

export interface DrawingIssue extends Omit<ValidationIssue, 'code'> {
  code: ValidationIssue['code'] | DrawingIssueCode;
}

/** validateModel plus the drawing checks of SPEC §2.2a. */
export function drawingIssues(state: DiagramState, measure?: Measure): DrawingIssue[] {
  const { model, layout } = state;
  const issues: DrawingIssue[] = validateModel(model).issues.filter((i) => i.code !== 'DECISION_SINGLE_EXIT');
  for (const step of model.steps) {
    const label = step.name.trim() ? `„${step.name}”` : step.id;
    if (step.type === 'DECISION') {
      const exits = model.flows.filter((f) => f.from === step.id);
      if (exits.length < 2) {
        issues.push({
          code: 'DECISION_FEW_EXITS',
          severity: 'ERROR',
          message: `Beslissing ${label} heeft minder dan twee uitgangen.`,
          stepIds: [step.id],
          flowIds: [],
        });
      } else if (exits.some((f) => !f.label?.trim())) {
        issues.push({
          code: 'DECISION_UNLABELLED',
          severity: 'WARNING',
          message: `Geef de uitgangen van beslissing ${label} een label (bijvoorbeeld Ja/Nee).`,
          stepIds: [step.id],
          flowIds: exits.filter((f) => !f.label?.trim()).map((f) => f.id),
        });
      }
    }
    const rect = layout.shapes[step.id];
    if (rect && layout.lanes.length > 0 && !laneAt(layout.lanes, centre(rect).y)) {
      issues.push({
        code: 'OUTSIDE_LANE',
        severity: 'WARNING',
        message: `Stap ${label} staat buiten de zwembanen en heeft geen rol.`,
        stepIds: [step.id],
        flowIds: [],
      });
    }
    if (measure && rect && lineCount(kindOf(step), step.name, rect.width, rect.height, measure) > TOO_MANY_LINES) {
      issues.push({
        code: 'LABEL_TOO_LONG',
        severity: 'WARNING',
        message: `De tekst van ${label} is te lang; houd het bij een korte omschrijving.`,
        stepIds: [step.id],
        flowIds: [],
      });
    }
  }
  return issues;
}
