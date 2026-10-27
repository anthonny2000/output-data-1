export type IssueLevel = 'error' | 'warning';

export interface DataIssue {
  level: IssueLevel;
  code: string;
  message: string;
  line?: number;
  sourceRowId?: string;
  fileName?: string;
  HITId?: string;
  WorkerId?: string;
  ASIN?: string;
}

export interface DelimitedRecord {
  line: number;
  values: string[];
}

export interface PreparedImportFile {
  fileName: string;
  delimiter: string;
  headers: string[];
  records: DelimitedRecord[];
  issues: DataIssue[];
  valid: boolean;
}

export interface ParsedBBox {
  valid: boolean;
  raw: string;
  reason?: string;
  coordinateSystem?: 'source-pixels-tlx-brx-tly-bry';
  tlx?: number;
  brx?: number;
  tly?: number;
  bry?: number;
}

export interface ProjectedBBox {
  valid: boolean;
  reason?: string;
  viewBox?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export type ProductUrlOrigin = 'source' | 'reconstructed' | 'unavailable';

export interface MatchedProduct {
  asin: string;
  id: string;
  imageUrl: string;
  productTitle: string;
  productUrlSource: string;
  productUrl: string;
  productUrlOrigin: ProductUrlOrigin;
  marketplace: string;
  raw: Record<string, unknown> | null;
}

export type ResponseState =
  | 'exploitable'
  | 'empty'
  | 'incomplete'
  | 'invalid_asin'
  | 'missing_hit'
  | 'missing_worker';

export interface WorkerResponse {
  responseId: string;
  sourceRowId: string;
  HITId: string;
  ASIN: string;
  WorkerId: string;
  AssignmentId: string;
  rawAnswerObject: unknown;
  responseState: ResponseState;
  responseSignature: string;
  activeFields: string[];
  unknownBooleanFields: string[];
  product: MatchedProduct;
  productUrlSource: string;
  productUrl: string;
  productUrlOrigin: ProductUrlOrigin;
  bbox: ParsedBBox;
  mainImageUrl: string;
  boundingBoxRaw: string;
  marketplace: string;
  issues: DataIssue[];
  duplicateWorker: boolean;
  voteEligible: boolean;
  groupKey: string | null;
}

export interface SourceRow {
  sourceRowId: string;
  fileName: string;
  sourceLine: number;
  sourceRecordIndex: number;
  rawColumns: Record<string, string>;
  HITId: string;
  WorkerId: string;
  AssignmentId: string;
  SubmitTime: string;
  mainImageUrl: string;
  rawBbox: string;
  inputContent: string;
  inputQueryProductAsin: string;
  inputQueryProductTitle: string;
  marketplace: string;
  rawMatches: string;
  bbox: ParsedBBox;
  productsByAsin: Map<string, Omit<MatchedProduct, 'productUrl' | 'productUrlOrigin' | 'marketplace'>>;
  responseIds: string[];
  unresolved: boolean;
}

export interface HitEntry {
  HITId: string;
  sourceRowIds: string[];
  groupKeys: string[];
  groupKeySet: Set<string>;
  contextVariants: Map<string, SourceRow>;
  primaryContext: SourceRow | null;
  anomalies: string[];
}

export interface ConsensusGroup {
  key: string;
  HITId: string;
  ASIN: string;
  responseIds: string[];
  responses: WorkerResponse[];
  productVariants: Map<string, MatchedProduct>;
  primaryProduct: MatchedProduct | null;
  anomalies: string[];
  voteDistribution: Map<string, number>;
  validWorkerCount: number;
  validVoteCount: number;
  majoritySuggestion: string | null;
  agreementRate: number | null;
  isTie: boolean;
}

export interface FileReport {
  fileName: string;
  valid: boolean;
  records: number;
  issues: DataIssue[];
}

export interface ConsensusModel {
  sourceHeaders: string[];
  sourceRows: SourceRow[];
  sourceRowsById: Map<string, SourceRow>;
  responses: WorkerResponse[];
  responsesById: Map<string, WorkerResponse>;
  hits: Map<string, HitEntry>;
  hitOrder: string[];
  groups: Map<string, ConsensusGroup>;
  groupOrder: string[];
  fileReports: FileReport[];
  issues: DataIssue[];
  observedAnswerSchema: Map<string, { boolean: number; other: number }>;
}

export type GroupDecisionStatus = 'validated' | 'review' | 'pending';

export interface GroupDecision {
  groupKey: string;
  signature: string;
  status: 'validated' | 'review';
  comment: string;
  validationRevision: number;
  decisionChangedAt: string;
  commentChangedAt?: string;
}

export interface SubmittedHitLogEntry {
  id: string;
  HITId: string;
  submittedAt: string;
  total: number;
  validated: number;
  qaComments: Array<{ groupKey: string; ASIN: string; comment: string }>;
  revision: number;
}

export interface SubmittedHitState {
  HITId: string;
  lastEntryId: string;
  revision: number;
  stale: boolean;
  submittedAt: string;
  changedAt?: string;
}

export interface ConsensusOption {
  value: string;
  votes: number;
  category: 'observed' | 'composite' | 'excluded' | 'attribute';
}

export interface DashboardStats {
  hitCount: number;
  uniqueAsinCount: number;
  groupCount: number;
  validatedCount: number;
  pendingCount: number;
  reviewCount: number;
  tieCount: number;
  validationRate: number;
  meanAgreement: number | null;
}

export interface ExportPackage {
  headers: string[];
  rows: string[][];
  exportableHitIds: string[];
  excludedHitIds: string[];
  eligibleSourceRows: number;
  excludedSourceRows: number;
}

export type HitFilterValue = 'all' | 'pending' | 'review' | 'tie';

export type ExportBatchStatus = 'staging' | 'completed' | 'failed';

export interface StoredExportBatch {
  id: string;
  ownerId: string;
  datasetKey: string;
  fileName: string;
  rowCount: number;
  hitCount: number;
  status: ExportBatchStatus;
  createdAtIso: string;
  updatedAtIso: string;
  createdAtMs: number;
}

export interface PreparedFirebaseRow {
  rowNumber: number;
  hitid: string;
  assignmentId: string;
  workerId: string;
  primaryImageUrl: string;
  bbox: Record<string, unknown>;
  queryProductAsin: string;
  outputData: Record<string, unknown>;
  imageUrl: string;
  marketplace: string;
  matches: Array<Record<string, unknown>>;
  asin: string;
  attribute: string;
  attributeByQa: string;
  qaComment: string;
}

export interface StoredExportRow extends PreparedFirebaseRow {
  id: string;
  ownerId: string;
  exportId: string;
  datasetKey: string;
}

export interface ViewerImageItem {
  id: string;
  src: string;
  alt: string;
  title: string;
  subtitle?: string;
}
