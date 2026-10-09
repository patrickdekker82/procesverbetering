// Internal process model (SPEC.md §3). Times in minutes, frequencies per year, rates 0..1.

export type StepType = 'START' | 'END' | 'TASK' | 'DECISION';
/** CUSTOMER = klantwaarde, BUSINESS = bedrijfsnoodzakelijk, NONE = geen waarde. */
export type ValueClass = 'CUSTOMER' | 'BUSINESS' | 'NONE';
export type Domain = 'KANTOOR' | 'KLANT' | (string & {});
export type SourceFormat =
  'FORM' | 'TEXT' | 'BPMN' | 'DRAWIO' | 'MERMAID' | 'VSDX' | 'TABLE' | 'DOCX' | 'IMAGE' | 'PDF';

export interface Role {
  id: string;
  name: string;
}

export interface Step {
  id: string;
  type: StepType;
  name: string;
  roleId?: string;
  system?: string;
  /** Bewerktijd per keer, minuten. */
  processingTime?: number;
  /** Wachttijd vóór deze stap, minuten. */
  waitingTime?: number;
  /** Aantal keer per jaar. */
  frequency?: number;
  /** Foutpercentage als fractie 0..1. */
  errorRate?: number;
  valueClass?: ValueClass;
  /** Controle- of goedkeuringsstap; undefined = afleiden uit de naam. */
  isControl?: boolean;
  notes?: string;
  source?: { format: SourceFormat; ref?: string };
}

export interface Flow {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** 0..1, alleen zinvol na een DECISION. */
  probability?: number;
}

export interface ProcessModel {
  id: string;
  name: string;
  domain: Domain;
  volumePerYear?: number;
  roles: Role[];
  steps: Step[];
  flows: Flow[];
}

export type IssueSeverity = 'ERROR' | 'WARNING';

export type IssueCode =
  | 'NO_START'
  | 'MULTIPLE_START'
  | 'NO_END'
  | 'DANGLING_FLOW'
  | 'DUPLICATE_ID'
  | 'UNREACHABLE_STEP'
  | 'END_UNREACHABLE'
  | 'DEAD_END'
  | 'START_HAS_INCOMING'
  | 'END_HAS_OUTGOING'
  | 'UNKNOWN_ROLE'
  | 'INVALID_NUMBER'
  | 'DECISION_SINGLE_EXIT'
  | 'PROBABILITY_SUM'
  | 'NO_PATH_TO_END'
  | 'MISSING_TIMES'
  | 'EMPTY_NAME';

export interface ValidationIssue {
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  stepIds: string[];
  flowIds: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
