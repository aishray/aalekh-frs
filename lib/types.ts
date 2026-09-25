// Core requirements model. Traceability, coverage, scores and out-of-date flags are derived (lib/engine), never stored.

export type Ref = string; // "GO-4.2" | "ANS-3" | "RES-1" | "ASM-2" | "STD-DPDP" | "WF-T5" | "BR-002" | "FLD-income" | "INT-4"

export type SourceKind = 'GO' | 'Corrigendum' | 'Guideline' | 'Minutes' | 'Form' | 'VoiceBrief' | 'Interview' | 'Other';
export type ClauseType = 'Mandate' | 'Rule' | 'Timeline' | 'Role' | 'Info';

export type SourceClause = {
  id: Ref;
  docId: string;
  label: string;
  original: string;
  english: string;
  type: ClauseType;
  supersededBy?: Ref;
  notApplicable?: { reason: string };
};

export type SourceDoc = {
  id: string;
  prefix: string; // GO, COR1, MIN, VB, FORM, GDL, INT1
  name: string;
  kind: SourceKind;
  refNo?: string;
  date?: string;
  authority?: string;
  language: string; // 'en' | 'hi' | ...
  amends?: string; // docId
  addedAt: string;
  clauses: SourceClause[];
};

export type Resolution = {
  type: 'Prevails' | 'ClarifiedValue' | 'Deferred';
  prevailing?: Ref;
  value?: string;
  note?: string;
  by: string;
  at: string;
};

export type Reconciliation = {
  id: string; // RES-n
  kind: 'Conflict' | 'Supersession' | 'Duplicate' | 'MissingReference';
  clauses: Ref[];
  description: string;
  resolution?: Resolution;
};

export type Role = { id: string; name: string; description: string; refs: Ref[] };

export type ChecklistItem = { topic: string; status: 'Covered' | 'Partial' | 'Missing'; refs: Ref[]; note?: string };

export type Discovery = {
  objective: string;
  objectiveRefs: Ref[];
  scopeIn: { text: string; refs: Ref[] }[];
  scopeOut: { text: string; refs: Ref[] }[];
  roles: Role[];
  channels: { text: string; refs: Ref[] }[];
  entities: { text: string; refs: Ref[] }[];
  integrations: { name: string; catalogueId?: string; refs: Ref[] }[];
  modules: { code: string; name: string; refs: Ref[] }[];
  checklist: ChecklistItem[];
};

export type Question = {
  id: string; // Q-n; answer becomes ANS-n, assumption ASM-n
  topic: string;
  question: string;
  whyItMatters: string;
  suggestedAnswers: string[];
  defaultAssumption: string;
  answer?: string;
  assumed?: boolean;
  confirmed?: boolean; // assumption confirmed in review
};

export type WfState = { id: string; name: string; terminal: boolean };
export type WfTransition = {
  id: string; // WF-Tn
  from: string;
  to: string;
  action: string;
  actor: string;
  conditions: Ref[];
  slaDays?: number;
  escalation?: { afterDays: number; to: string };
  notification?: { channel: 'SMS' | 'Email' | 'In-app'; recipient: string; template: string };
  refs: Ref[];
};
export type Workflow = { states: WfState[]; transitions: WfTransition[]; rtsDays?: number; rtsRef?: Ref };

export type PiiClass = 'Personal' | 'Sensitive' | 'Aadhaar' | 'Financial' | 'None';
export type ValueSource = 'Applicant' | 'Aadhaar eKYC' | 'DigiLocker' | 'Master' | 'System';
export type Field = {
  id: string; // FLD-x
  label: string;
  labelOriginal?: string;
  name: string;
  type: string;
  length?: number;
  mandatory: boolean;
  validation?: string;
  valueSource: ValueSource;
  masterList?: string;
  pii: PiiClass;
  readOnly?: boolean;
  refs: Ref[];
};
export type DataEntity = { id: string; name: string; fields: Field[] };
export type MasterList = { name: string; values: string[]; owner: string };

export type Condition = { attribute: string; operator: '<=' | '<' | '>=' | '>' | '=' | '!=' | 'in'; value: string; unit?: string; label?: string };
export type TestCase = {
  id: string;
  reqId: string;
  title?: string;
  precondition: string;
  steps: string[];
  data: Record<string, string>;
  expected: string;
  refs?: Ref[];
};
export type DecisionTable = {
  id: string; // BR-nnn
  name: string;
  appliesTo?: 'All' | 'Renewal';
  conditions: Condition[];
  outcome: string;
  failOutcome: string;
  refs: Ref[];
};

export type Jurisdiction = 'State' | 'District' | 'Institution' | 'Self';
export type PermissionMatrix = {
  roles: { id: string; name: string; jurisdiction: Jurisdiction; admin?: boolean }[];
  actions: string[];
  grants: Record<string, string[]>; // roleId -> actions
};

export type Priority = 'Must' | 'Should' | 'Could' | "Won't";
export type Requirement = {
  id: string;
  kind: 'FR' | 'NFR' | 'IR' | 'RPT';
  module: string;
  title: string;
  description: string;
  actor?: string;
  priority: Priority;
  acceptanceCriteria: string[];
  refs: Ref[];
  origin: 'Generated' | 'FromModel' | 'Reused' | 'Manual';
  reusedFrom?: string;
  status: 'Draft' | 'Reviewed' | 'Approved';
  generatedAt: string;
  modelKey?: string; // for requirements generated from a model artefact: keeps IDs stable across regeneration
};

export type IssueSeverity = 'High' | 'Medium' | 'Low';
export type IssueType =
  | 'Ambiguity'
  | 'NoAcceptance'
  | 'NoRefs'
  | 'InvalidRef'
  | 'Duplicate'
  | 'Coverage'
  | 'Workflow'
  | 'Permission'
  | 'Compliance'
  | 'Assumption'
  | 'OpenIssue'
  | 'MissingException'
  | 'Conflict'
  | 'Untestable'
  | 'Contradiction'
  | 'OutOfDate';
export type Issue = {
  id: string;
  severity: IssueSeverity;
  type: IssueType;
  category: 'Completeness' | 'Clarity' | 'Testability' | 'Traceability' | 'Compliance';
  message: string;
  targetIds: string[];
  suggestion: string;
  status: 'Open' | 'Fixed' | 'Dismissed';
  source: 'Rule' | 'Review';
};

// AI-proposed or reviewer-proposed change. Nothing is silently overwritten.
export type TrackedChange = {
  id: string;
  targetId: string; // requirement id, or 'NEW' for an added requirement
  kind: 'Modify' | 'Add' | 'Remove';
  before?: Partial<Requirement>;
  after?: Partial<Requirement>;
  reason: string;
  origin: string; // e.g. "Quality fix", "Reviewer comment", "Corrigendum COR2"
  issueId?: string;
  status: 'Pending' | 'Accepted' | 'Rejected';
  createdAt: string;
};

export type Note = { id: string; by: string; designation: string; at: string; text: string; action?: string };
export type Comment = { id: string; reqId: string; by: string; designation: string; at: string; text: string; resolved?: boolean };

export type ModelSnapshot = {
  sources: SourceDoc[];
  reconciliations: Reconciliation[];
  questions: Question[];
  workflow?: Workflow;
  entities: DataEntity[];
  rules: DecisionTable[];
  permissions?: PermissionMatrix;
  requirements: Requirement[];
  sections: Record<string, string>;
};
export type Version = { version: string; label: string; createdAt: string; by: string; snapshot: ModelSnapshot };
export type Baseline = { version: string; approvedBy: string; approvedAt: string; snapshot: ModelSnapshot };

export type ImpactItem = { targetId: string; kind: 'Requirement' | 'Rule' | 'Test' | 'Field' | 'Transition'; reason: string; proposedChange: string; changeId?: string };
export type ImpactAnalysis = {
  id: string;
  corrigendumDocId: string;
  supersessions: { old: Ref; by: Ref }[];
  affected: ImpactItem[];
  timelineImpact: string;
  status: 'Open' | 'Applied';
  createdAt: string;
};

export type CrItem = { ask: string; effort?: string; classification: 'In scope' | 'Clarification' | 'New scope'; matchedReqs: string[]; quotes: string[]; reasoning: string };
export type CrAssessment = { id: string; title: string; vendorText: string; items: CrItem[]; createdAt: string };

export type ProjectStatus = 'Draft' | 'In review' | 'Changes requested' | 'Approved';
export type ProjectType = 'benefit' | 'permit' | 'grievance' | 'mis' | 'licence';

export type Project = {
  id: string;
  name: string;
  department: string;
  fileNo: string;
  type: ProjectType;
  status: ProjectStatus;
  version: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  sample?: 'scholarship';
  description?: string;
  sources: SourceDoc[];
  reconciliations: Reconciliation[];
  reconciledAt?: string;
  discovery?: Discovery;
  questions: Question[];
  workflow?: Workflow;
  entities: DataEntity[];
  masters: MasterList[];
  rules: DecisionTable[];
  permissions?: PermissionMatrix;
  requirements: Requirement[];
  sections: Record<string, string>; // narrative sections generated by LLM
  sectionsAt: Record<string, string>;
  reviewIssues: Issue[]; // issues from the LLM "full review"
  issueState: Record<string, { status: 'Fixed' | 'Dismissed'; note?: string }>;
  changes: TrackedChange[];
  notes: Note[];
  comments: Comment[];
  versions: Version[];
  baseline?: Baseline;
  impacts: ImpactAnalysis[];
  crs: CrAssessment[];
  stamps: Record<string, string>; // artefact ref -> last edited ISO time
  estimateWeights?: Record<string, number>;
};

export type ActivityEvent = { id: string; at: string; user: string; projectId?: string; projectName?: string; action: string; target?: string };

export type PersonaId = 'author' | 'reviewer' | 'approver';
export type Persona = { id: PersonaId; name: string; designation: string; role: 'Author' | 'Reviewer' | 'Approver' };
