import {
  ConsensusGroup,
  ConsensusModel,
  ConsensusOption,
  DashboardStats,
  DataIssue,
  DelimitedRecord,
  ExportPackage,
  GroupDecision,
  GroupDecisionStatus,
  HitEntry,
  IssueLevel,
  MatchedProduct,
  ParsedBBox,
  PreparedImportFile,
  ProductUrlOrigin,
  ProjectedBBox,
  ResponseState,
  SourceRow,
  StoredExportRow,
  SubmittedHitState,
  WorkerResponse,
} from '../types/consensus';

export const REQUIRED_COLUMNS = [
  'Answer.output_data',
  'HITId',
  'Input.bbox',
  'Input.imageURL',
  'Input.marketplace',
  'Input.matches',
  'WorkerId',
] as const;

export const RESPONSE_FIELDS = [
  'asin_image_not_load',
  'no_difference',
  'wrong_category',
  'has_product_difference',
  'is_wrong_characteristic',
  'is_wrong_size_or_count',
  'is_wrong_bundle',
  'is_wrong_packaging_overlay',
  'is_non_targeted_match',
] as const;

export const UI_ONLY_RESPONSE_FIELDS = ['link_clicked', 'on'] as const;

export const ASIN_PATTERN = /^[A-Z0-9]{10}$/;

export const EXPORT_HEADERS = [
  'hitid',
  'AssignmentId',
  'workerid',
  'Input.imageURL',
  'Input.bbox',
  'Input.queryProductASIN',
  'Answer.output_data',
  'image_url',
  'Input.marketplace',
  'Input.matches',
  'ASIN',
  'Attribute',
  'Attribute.by QA',
] as const;

export interface AnswerPaletteToken {
  chip: string;
  barFill: string;
}

export const ANSWER_PALETTE: AnswerPaletteToken[] = [
  {
    chip: 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100 hover:border-cyan-300',
    barFill: 'fill-cyan-400',
  },
  {
    chip: 'border-rose-400/60 bg-rose-500/15 text-rose-100 hover:border-rose-300',
    barFill: 'fill-rose-400',
  },
  {
    chip: 'border-amber-400/60 bg-amber-500/15 text-amber-100 hover:border-amber-300',
    barFill: 'fill-amber-400',
  },
  {
    chip: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100 hover:border-emerald-300',
    barFill: 'fill-emerald-400',
  },
  {
    chip: 'border-violet-400/60 bg-violet-500/15 text-violet-100 hover:border-violet-300',
    barFill: 'fill-violet-400',
  },
  {
    chip: 'border-sky-400/60 bg-sky-500/15 text-sky-100 hover:border-sky-300',
    barFill: 'fill-sky-400',
  },
  {
    chip: 'border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-100 hover:border-fuchsia-300',
    barFill: 'fill-fuchsia-400',
  },
  {
    chip: 'border-lime-400/60 bg-lime-500/15 text-lime-100 hover:border-lime-300',
    barFill: 'fill-lime-400',
  },
  {
    chip: 'border-orange-400/60 bg-orange-500/15 text-orange-100 hover:border-orange-300',
    barFill: 'fill-orange-400',
  },
  {
    chip: 'border-teal-400/60 bg-teal-500/15 text-teal-100 hover:border-teal-300',
    barFill: 'fill-teal-400',
  },
  {
    chip: 'border-indigo-400/60 bg-indigo-500/15 text-indigo-100 hover:border-indigo-300',
    barFill: 'fill-indigo-400',
  },
  {
    chip: 'border-pink-400/60 bg-pink-500/15 text-pink-100 hover:border-pink-300',
    barFill: 'fill-pink-400',
  },
];

export const HIGHLIGHT_MARK_CLASSES = [
  'border-amber-300/80 bg-amber-400/30 text-white',
  'border-cyan-300/80 bg-cyan-400/30 text-white',
  'border-emerald-300/80 bg-emerald-400/30 text-white',
  'border-rose-300/80 bg-rose-400/30 text-white',
  'border-violet-300/80 bg-violet-400/30 text-white',
  'border-lime-300/80 bg-lime-400/30 text-white',
  'border-fuchsia-300/80 bg-fuchsia-400/30 text-white',
  'border-orange-300/80 bg-orange-400/30 text-white',
] as const;

export function own(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function asText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function makeIssue(
  level: IssueLevel,
  code: string,
  message: string,
  context?: Partial<DataIssue>
): DataIssue {
  return {
    level,
    code,
    message,
    ...(context || {}),
  };
}

export function makeGroupKey(hitId: string, asin: string): string {
  return `${asText(hitId)}\u001F${asText(asin)}`;
}

export function splitGroupKey(key: string): { HITId: string; ASIN: string } {
  const parts = asText(key).split('\u001F');
  return {
    HITId: parts[0] || '',
    ASIN: parts.slice(1).join('\u001F') || '',
  };
}

export function validHttpUrl(value: unknown): boolean {
  return /^https?:\/\/[^\s]+$/i.test(asText(value));
}

export function buildProductUrl(marketplace: string, asin: string): string {
  const market = asText(marketplace).trim().toUpperCase();
  const productAsin = asText(asin).trim();
  if (!market || !productAsin || !ASIN_PATTERN.test(productAsin)) return '';
  const domain =
    market === 'UK'
      ? 'www.amazon.co.uk'
      : market === 'US'
        ? 'www.amazon.com'
        : `www.amazon.${market.toLowerCase()}`;
  return `https://${domain}/dp/${encodeURIComponent(productAsin)}`;
}

export function resolveEffectiveProductUrl(
  productUrlSource: string,
  marketplace: string,
  asin: string
): { productUrlSource: string; productUrl: string; productUrlOrigin: ProductUrlOrigin } {
  const rawSource = asText(productUrlSource);
  const sourceCandidate = rawSource.trim();
  if (validHttpUrl(sourceCandidate)) {
    return {
      productUrlSource: rawSource,
      productUrl: sourceCandidate,
      productUrlOrigin: 'source',
    };
  }
  const reconstructed = buildProductUrl(marketplace, asin);
  return {
    productUrlSource: rawSource,
    productUrl: reconstructed,
    productUrlOrigin: reconstructed ? 'reconstructed' : 'unavailable',
  };
}

export function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const val of values) {
    const key = asText(val);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

export function detectDelimiter(text: string, fileName: string): string {
  const lower = asText(fileName).toLowerCase();
  if (/\.tsv$/.test(lower)) return '\t';
  if (/\.csv$/.test(lower)) return ',';

  const source = asText(text).replace(/^\uFEFF/, '');
  const counts: Record<string, number> = { ',': 0, '\t': 0, ';': 0 };
  let inQuotes = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (inQuotes && source[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (!inQuotes && (ch === ',' || ch === '\t' || ch === ';')) {
      counts[ch]++;
    } else if (!inQuotes && (ch === '\n' || ch === '\r')) {
      break;
    }
  }
  let best = ',';
  if (counts['\t'] > counts[best]) best = '\t';
  if (counts[';'] > counts[best]) best = ';';
  return best;
}

export function parseDelimitedText(
  text: string,
  delimiter = ','
): { headers: string[]; records: DelimitedRecord[]; errors: DataIssue[] } {
  const source = asText(text).replace(/^\uFEFF/, '');
  const sep = delimiter || ',';
  const records: DelimitedRecord[] = [];
  const errors: DataIssue[] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let physicalLine = 1;
  let recordLine = 1;

  const pushRecord = () => {
    row.push(field);
    field = '';
    const nonEmpty = row.some((cell) => asText(cell).trim() !== '');
    if (nonEmpty) {
      records.push({ line: recordLine, values: row });
    }
    row = [];
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (ch === '\r') {
        if (source[i + 1] === '\n') {
          field += '\r\n';
          i++;
        } else {
          field += '\r';
        }
        physicalLine++;
      } else if (ch === '\n') {
        field += '\n';
        physicalLine++;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field.length === 0) {
      inQuotes = true;
    } else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      pushRecord();
      if (ch === '\r' && source[i + 1] === '\n') i++;
      physicalLine++;
      recordLine = physicalLine;
    } else {
      field += ch;
    }
  }

  if (inQuotes) {
    errors.push(
      makeIssue(
        'error',
        'csv_guillemet_manquant',
        'Guillemet fermant manquant dans le fichier tabulaire.',
        { line: recordLine }
      )
    );
  }
  if (field.length > 0 || row.length > 0) pushRecord();

  if (records.length === 0) {
    return {
      headers: [],
      records: [],
      errors: [
        ...errors,
        makeIssue('error', 'fichier_vide', 'Le fichier ne contient aucun en-tête exploitable.'),
      ],
    };
  }

  return {
    headers: records[0].values,
    records: records.slice(1),
    errors,
  };
}

export function prepareImportFile(fileName: string, text: string): PreparedImportFile {
  const delimiter = detectDelimiter(text, fileName);
  const parsed = parseDelimitedText(text, delimiter);
  const headers = parsed.headers.slice();
  const issues: DataIssue[] = parsed.errors.slice();
  const duplicates: string[] = [];
  const known = new Set<string>();

  headers.forEach((header) => {
    const name = asText(header);
    if (name === '') {
      issues.push(makeIssue('error', 'entete_vide', 'Un en-tête de colonne est vide.'));
    }
    if (known.has(name)) duplicates.push(name);
    known.add(name);
  });

  const uniqueDups = uniqueValues(duplicates);
  if (uniqueDups.length) {
    issues.push(
      makeIssue('error', 'entete_duplique', `En-tête dupliqué : ${uniqueDups.join(', ')}.`)
    );
  }

  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missing.length) {
    issues.push(
      makeIssue(
        'error',
        'colonne_obligatoire_absente',
        `Colonnes obligatoires absentes : ${missing.join(', ')}.`
      )
    );
  }

  parsed.records.forEach((record) => {
    if (record.values.length !== headers.length) {
      issues.push(
        makeIssue(
          'warning',
          'largeur_ligne_incoherente',
          `La ligne CSV logique ${record.line} contient ${record.values.length} cellules pour ${headers.length} en-têtes.`,
          { line: record.line }
        )
      );
    }
  });

  const blocking = issues.some((issue) => issue.level === 'error');
  return {
    fileName: asText(fileName),
    delimiter,
    headers,
    records: parsed.records,
    issues,
    valid: !blocking,
  };
}

export function parseJsonCell(
  raw: unknown,
  label: string
): { ok: true; value: unknown } | { ok: false; code: string; message: string } {
  const text = asText(raw);
  if (text.trim() === '') {
    return { ok: false, code: 'json_vide', message: `${label} est vide.` };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return {
      ok: false,
      code: 'json_invalide',
      message: `${label} contient un JSON invalide : ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function parseBBox(raw: unknown): ParsedBBox {
  const rawText = isPlainObject(raw) ? JSON.stringify(raw) : asText(raw);
  let box: Record<string, unknown>;
  if (isPlainObject(raw)) {
    box = raw;
  } else {
    const parsed = parseJsonCell(raw, 'Input.bbox');
    if (!parsed.ok || !isPlainObject(parsed.value)) {
      return {
        valid: false,
        raw: rawText,
        reason: parsed.ok ? 'Input.bbox n’est pas un objet JSON.' : parsed.message,
      };
    }
    box = parsed.value;
  }
  const keys = ['tlx', 'brx', 'tly', 'bry'] as const;
  for (const key of keys) {
    const val = box[key];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return {
        valid: false,
        raw: rawText,
        reason: `Input.bbox.${key} doit être un nombre fini.`,
      };
    }
  }
  const tlx = box.tlx as number;
  const brx = box.brx as number;
  const tly = box.tly as number;
  const bry = box.bry as number;
  if (tlx >= brx || tly >= bry || tlx < 0 || tly < 0) {
    return {
      valid: false,
      raw: rawText,
      reason: 'Les coordonnées Input.bbox tlx/brx/tly/bry sont incohérentes.',
    };
  }
  return {
    valid: true,
    raw: rawText,
    coordinateSystem: 'source-pixels-tlx-brx-tly-bry',
    tlx,
    brx,
    tly,
    bry,
  };
}

export function projectBBoxToImage(
  bbox: ParsedBBox | undefined,
  naturalWidth: number,
  naturalHeight: number
): ProjectedBBox {
  const width = Number(naturalWidth);
  const height = Number(naturalHeight);
  if (
    !bbox ||
    !bbox.valid ||
    bbox.tlx === undefined ||
    bbox.brx === undefined ||
    bbox.tly === undefined ||
    bbox.bry === undefined
  ) {
    return { valid: false, reason: 'Bounding box absente ou invalide.' };
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { valid: false, reason: 'Dimensions naturelles de l’image indisponibles.' };
  }
  if (bbox.coordinateSystem !== 'source-pixels-tlx-brx-tly-bry') {
    return { valid: false, reason: 'Repère de bounding box non pris en charge.' };
  }
  if (bbox.brx > width || bbox.bry > height) {
    return {
      valid: false,
      reason: `Bounding box hors des dimensions naturelles (${width} × ${height}).`,
    };
  }
  return {
    valid: true,
    viewBox: `0 0 ${width} ${height}`,
    x: bbox.tlx,
    y: bbox.tly,
    width: bbox.brx - bbox.tlx,
    height: bbox.bry - bbox.tly,
  };
}

export function parseMatches(raw: string): {
  products: Map<string, Omit<MatchedProduct, 'productUrl' | 'productUrlOrigin' | 'marketplace'>>;
  issues: DataIssue[];
  rawArray: Array<Record<string, unknown>>;
} {
  const parsed = parseJsonCell(raw, 'Input.matches');
  const issues: DataIssue[] = [];
  const products = new Map<
    string,
    Omit<MatchedProduct, 'productUrl' | 'productUrlOrigin' | 'marketplace'>
  >();
  if (!parsed.ok) {
    return { products, issues: [makeIssue('warning', parsed.code, parsed.message)], rawArray: [] };
  }
  if (!Array.isArray(parsed.value)) {
    return {
      products,
      issues: [
        makeIssue('warning', 'matches_racine_invalide', 'Input.matches doit être un tableau JSON.'),
      ],
      rawArray: [],
    };
  }

  const rawArray: Array<Record<string, unknown>> = [];
  parsed.value.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      issues.push(
        makeIssue('warning', 'match_invalide', `Entrée Input.matches invalide à l’index ${index}.`)
      );
      return;
    }
    rawArray.push(entry);
    const asin = asText(entry.asin).trim();
    if (!asin) {
      issues.push(
        makeIssue('warning', 'match_sans_asin', `Entrée Input.matches sans asin à l’index ${index}.`)
      );
      return;
    }
    if (products.has(asin)) {
      issues.push(
        makeIssue('warning', 'match_asin_duplique', `ASIN dupliqué dans Input.matches : ${asin}.`)
      );
      return;
    }
    products.set(asin, {
      asin,
      id: asText(entry.id),
      imageUrl: asText(entry.image_url),
      productTitle: asText(entry.product_title),
      productUrlSource: asText(entry.product_url),
      raw: entry,
    });
  });

  return { products, issues, rawArray };
}

export function parseOutputEntries(raw: string): {
  entries: Array<{ asin: string; answer: unknown }>;
  issues: DataIssue[];
  rawMap: Record<string, unknown>;
} {
  const parsed = parseJsonCell(raw, 'Answer.output_data');
  if (!parsed.ok) {
    return { entries: [], issues: [makeIssue('error', parsed.code, parsed.message)], rawMap: {} };
  }
  if (!isPlainObject(parsed.value)) {
    return {
      entries: [],
      issues: [
        makeIssue(
          'error',
          'output_racine_invalide',
          'Answer.output_data doit être un objet JSON ASIN → réponse.'
        ),
      ],
      rawMap: {},
    };
  }
  const keys = Object.keys(parsed.value);
  if (keys.length === 0) {
    return {
      entries: [],
      issues: [makeIssue('warning', 'output_sans_asin', 'Answer.output_data ne contient aucun ASIN.')],
      rawMap: parsed.value,
    };
  }
  return {
    entries: keys.map((asin) => ({ asin, answer: parsed.value && (parsed.value as Record<string, unknown>)[asin] })),
    issues: [],
    rawMap: parsed.value,
  };
}

export function assessAnswerObject(answer: unknown): {
  state: 'exploitable' | 'empty' | 'incomplete';
  signature: string;
  activeFields: string[];
  unknownBooleanFields: string[];
  missingFields: string[];
  reason: string;
} {
  if (!isPlainObject(answer)) {
    return {
      state: 'incomplete',
      signature: '',
      activeFields: [],
      unknownBooleanFields: [],
      missingFields: [...RESPONSE_FIELDS],
      reason: 'La réponse ASIN n’est pas un objet.',
    };
  }

  const missing: string[] = [];
  const active: string[] = [];
  RESPONSE_FIELDS.forEach((field) => {
    if (!own(answer, field) || typeof answer[field] !== 'boolean') {
      missing.push(field);
    } else if (answer[field] === true) {
      active.push(field);
    }
  });
  active.sort();

  const unknownBooleanFields = Object.keys(answer)
    .filter(
      (field) =>
        typeof answer[field] === 'boolean' &&
        !(RESPONSE_FIELDS as readonly string[]).includes(field) &&
        !(UI_ONLY_RESPONSE_FIELDS as readonly string[]).includes(field)
    )
    .sort();

  if (missing.length) {
    return {
      state: 'incomplete',
      signature: '',
      activeFields: active,
      unknownBooleanFields,
      missingFields: missing,
      reason: `Critères métier absents ou non booléens : ${missing.join(', ')}.`,
    };
  }
  if (active.length === 0) {
    return {
      state: 'empty',
      signature: '',
      activeFields: [],
      unknownBooleanFields,
      missingFields: [],
      reason: 'Aucun critère métier actif.',
    };
  }
  return {
    state: 'exploitable',
    signature: active.join('|'),
    activeFields: active,
    unknownBooleanFields,
    missingFields: [],
    reason: '',
  };
}

function productFingerprint(product: MatchedProduct): string {
  return [
    product.asin,
    product.id,
    product.imageUrl,
    product.productTitle,
    product.productUrlSource,
    product.productUrl,
    product.productUrlOrigin,
    product.marketplace,
  ].join('\u001F');
}

function contextFingerprint(source: SourceRow): string {
  return [
    source.mainImageUrl,
    source.rawBbox,
    source.inputContent,
    source.inputQueryProductAsin,
    source.inputQueryProductTitle,
    source.marketplace,
    source.rawMatches,
  ].join('\u001F');
}

export function createEmptyModel(): ConsensusModel {
  return {
    sourceHeaders: [],
    sourceRows: [],
    sourceRowsById: new Map(),
    responses: [],
    responsesById: new Map(),
    hits: new Map(),
    hitOrder: [],
    groups: new Map(),
    groupOrder: [],
    fileReports: [],
    issues: [],
    observedAnswerSchema: new Map(),
  };
}

export function createModel(preparedFiles: PreparedImportFile[]): ConsensusModel {
  const model = createEmptyModel();
  const headerSeen = new Set<string>();
  let responseSequence = 0;
  let sourceSequence = 0;

  const addIssue = (issue: DataIssue, source?: SourceRow, asin?: string) => {
    const copy: DataIssue = { ...issue };
    if (source) {
      copy.sourceRowId = source.sourceRowId;
      copy.fileName = source.fileName;
      copy.line = source.sourceLine;
      copy.HITId = source.HITId;
      copy.WorkerId = source.WorkerId;
    }
    if (asin !== undefined) copy.ASIN = asin;
    model.issues.push(copy);
  };

  const ensureHit = (hitId: string): HitEntry => {
    let hit = model.hits.get(hitId);
    if (!hit) {
      hit = {
        HITId: hitId,
        sourceRowIds: [],
        groupKeys: [],
        groupKeySet: new Set(),
        contextVariants: new Map(),
        primaryContext: null,
        anomalies: [],
      };
      model.hits.set(hitId, hit);
      model.hitOrder.push(hitId);
    }
    return hit;
  };

  const ensureGroup = (hitId: string, asin: string): ConsensusGroup => {
    const key = makeGroupKey(hitId, asin);
    let group = model.groups.get(key);
    if (!group) {
      group = {
        key,
        HITId: hitId,
        ASIN: asin,
        responseIds: [],
        responses: [],
        productVariants: new Map(),
        primaryProduct: null,
        anomalies: [],
        voteDistribution: new Map(),
        validWorkerCount: 0,
        validVoteCount: 0,
        majoritySuggestion: null,
        agreementRate: null,
        isTie: false,
      };
      model.groups.set(key, group);
      model.groupOrder.push(key);
      const hit = ensureHit(hitId);
      if (!hit.groupKeySet.has(key)) {
        hit.groupKeySet.add(key);
        hit.groupKeys.push(key);
      }
    }
    return group;
  };

  (preparedFiles || []).forEach((file, fileIndex) => {
    model.fileReports.push({
      fileName: file.fileName,
      valid: Boolean(file.valid),
      records: file.records ? file.records.length : 0,
      issues: file.issues.slice(),
    });
    file.issues.forEach((issue) => {
      model.issues.push({ ...issue, fileName: file.fileName });
    });
    if (!file.valid) return;

    file.headers.forEach((header) => {
      if (!headerSeen.has(header)) {
        headerSeen.add(header);
        model.sourceHeaders.push(header);
      }
    });

    file.records.forEach((record, recordIndex) => {
      const rawColumns: Record<string, string> = {};
      file.headers.forEach((header, idx) => {
        rawColumns[header] = idx < record.values.length ? asText(record.values[idx]) : '';
      });

      const bbox = parseBBox(rawColumns['Input.bbox']);
      const matches = parseMatches(asText(rawColumns['Input.matches']));

      const source: SourceRow = {
        sourceRowId: `f${fileIndex}:r${record.line}:n${sourceSequence++}`,
        fileName: file.fileName,
        sourceLine: record.line,
        sourceRecordIndex: recordIndex,
        rawColumns,
        HITId: asText(rawColumns.HITId).trim(),
        WorkerId: asText(rawColumns.WorkerId).trim(),
        AssignmentId: asText(rawColumns.AssignmentId).trim(),
        SubmitTime: asText(rawColumns.SubmitTime).trim(),
        mainImageUrl: asText(rawColumns['Input.imageURL']).trim(),
        rawBbox: asText(rawColumns['Input.bbox']),
        inputContent: asText(rawColumns['Input.content']).trim(),
        inputQueryProductAsin: asText(rawColumns['Input.queryProductASIN']).trim(),
        inputQueryProductTitle: asText(rawColumns['Input.queryProductTitle']).trim(),
        marketplace: asText(rawColumns['Input.marketplace']).trim(),
        rawMatches: asText(rawColumns['Input.matches']),
        bbox,
        productsByAsin: matches.products,
        responseIds: [],
        unresolved: false,
      };

      model.sourceRows.push(source);
      model.sourceRowsById.set(source.sourceRowId, source);

      if (!source.HITId) {
        addIssue(
          makeIssue(
            'error',
            'hit_manquant',
            'HITId est vide ; aucun regroupement fiable n’est possible.'
          ),
          source
        );
      }
      if (!source.WorkerId) {
        addIssue(
          makeIssue(
            'error',
            'worker_manquant',
            'WorkerId est vide ; la réponse ne peut pas participer au vote.'
          ),
          source
        );
      }

      const hit = source.HITId ? ensureHit(source.HITId) : null;
      if (hit) {
        hit.sourceRowIds.push(source.sourceRowId);
        const fp = contextFingerprint(source);
        if (!hit.contextVariants.has(fp)) hit.contextVariants.set(fp, source);
        if (!hit.primaryContext) hit.primaryContext = source;
      }

      if (!bbox.valid) {
        addIssue(makeIssue('warning', 'bbox_invalide', bbox.reason || 'BBox invalide.'), source);
      }
      if (!source.mainImageUrl) {
        addIssue(makeIssue('warning', 'image_principale_absente', 'Input.imageURL est vide.'), source);
      } else if (!validHttpUrl(source.mainImageUrl)) {
        addIssue(
          makeIssue(
            'warning',
            'image_principale_url_invalide',
            'Input.imageURL n’est pas une URL HTTP(S) valide.'
          ),
          source
        );
      }

      matches.issues.forEach((issue) => addIssue(issue, source));

      const output = parseOutputEntries(asText(rawColumns['Answer.output_data']));
      output.issues.forEach((issue) => addIssue(issue, source));
      if (output.entries.length === 0) source.unresolved = true;

      output.entries.forEach((entry) => {
        const asin = asText(entry.asin).trim();
        const assessment = assessAnswerObject(entry.answer);

        if (isPlainObject(entry.answer)) {
          Object.keys(entry.answer).forEach((key) => {
            if (!model.observedAnswerSchema.has(key)) {
              model.observedAnswerSchema.set(key, { boolean: 0, other: 0 });
            }
            const info = model.observedAnswerSchema.get(key)!;
            if (typeof (entry.answer as Record<string, unknown>)[key] === 'boolean') info.boolean++;
            else info.other++;
          });
        }

        const matchedProduct = matches.products.get(asin) || {
          asin,
          id: '',
          imageUrl: '',
          productTitle: '',
          productUrlSource: '',
          raw: null,
        };

        const urlResolution = resolveEffectiveProductUrl(
          matchedProduct.productUrlSource,
          source.marketplace,
          asin
        );

        const product: MatchedProduct = {
          asin,
          id: asText(matchedProduct.id),
          imageUrl: asText(matchedProduct.imageUrl),
          productTitle: asText(matchedProduct.productTitle),
          productUrlSource: urlResolution.productUrlSource,
          productUrl: urlResolution.productUrl,
          productUrlOrigin: urlResolution.productUrlOrigin,
          marketplace: source.marketplace,
          raw: matchedProduct.raw,
        };

        let state: ResponseState = assessment.state;
        const localIssues: DataIssue[] = [];

        if (!ASIN_PATTERN.test(asin)) {
          state = 'invalid_asin';
          localIssues.push(makeIssue('error', 'asin_invalide', `Clé ASIN invalide : « ${asin} ».`));
        }
        if (!source.HITId) {
          state = 'missing_hit';
          localIssues.push(makeIssue('error', 'hit_manquant', 'Réponse non groupable sans HITId.'));
        }
        if (!source.WorkerId) {
          state = 'missing_worker';
          localIssues.push(
            makeIssue('error', 'worker_manquant', 'Réponse non comptable sans WorkerId.')
          );
        }
        if (assessment.state === 'incomplete') {
          localIssues.push(makeIssue('warning', 'reponse_incomplete', assessment.reason));
        } else if (assessment.state === 'empty') {
          localIssues.push(makeIssue('warning', 'reponse_vide', assessment.reason));
        }
        assessment.unknownBooleanFields.forEach((field) => {
          localIssues.push(
            makeIssue('warning', 'cle_booleenne_inconnue', `Clé booléenne non classée : ${field}.`)
          );
        });
        if (!matches.products.has(asin)) {
          localIssues.push(
            makeIssue('warning', 'produit_absent_matches', 'ASIN absent de Input.matches.')
          );
        }

        const response: WorkerResponse = {
          responseId: `resp:${responseSequence++}`,
          sourceRowId: source.sourceRowId,
          HITId: source.HITId,
          ASIN: asin,
          WorkerId: source.WorkerId,
          AssignmentId: source.AssignmentId,
          rawAnswerObject: entry.answer,
          responseState: state,
          responseSignature: state === 'exploitable' ? assessment.signature : '',
          activeFields: assessment.activeFields,
          unknownBooleanFields: assessment.unknownBooleanFields,
          product,
          productUrlSource: product.productUrlSource,
          productUrl: product.productUrl,
          productUrlOrigin: product.productUrlOrigin,
          bbox,
          mainImageUrl: source.mainImageUrl,
          boundingBoxRaw: source.rawBbox,
          marketplace: source.marketplace,
          issues: localIssues,
          duplicateWorker: false,
          voteEligible: false,
          groupKey: source.HITId && asin ? makeGroupKey(source.HITId, asin) : null,
        };

        source.responseIds.push(response.responseId);
        model.responses.push(response);
        model.responsesById.set(response.responseId, response);
        localIssues.forEach((issue) => addIssue(issue, source, asin));

        if (response.groupKey) {
          const group = ensureGroup(source.HITId, asin);
          group.responseIds.push(response.responseId);
          group.responses.push(response);
          const pKey = productFingerprint(product);
          if (!group.productVariants.has(pKey)) group.productVariants.set(pKey, product);
          if (!group.primaryProduct) group.primaryProduct = product;
        }
      });
    });
  });

  model.hits.forEach((hit) => {
    if (hit.contextVariants.size > 1) {
      hit.anomalies.push('Contexte HIT divergent entre participations worker.');
      model.issues.push(
        makeIssue(
          'warning',
          'contexte_hit_divergent',
          'Le même HIT possède plusieurs contextes image/bbox/marketplace/matches.',
          { HITId: hit.HITId }
        )
      );
    }
  });

  finalizeConsensusModel(model);
  return model;
}

export function finalizeConsensusModel(model: ConsensusModel): void {
  model.groups.forEach((group) => {
    group.responses.forEach((response) => {
      response.duplicateWorker = false;
      response.voteEligible = false;
    });

    const byWorker = new Map<string, WorkerResponse[]>();
    group.responses.forEach((response) => {
      const worker = asText(response.WorkerId);
      if (!worker) return;
      const bucket = byWorker.get(worker) || [];
      bucket.push(response);
      byWorker.set(worker, bucket);
    });

    byWorker.forEach((responses, worker) => {
      if (responses.length > 1) {
        responses.forEach((r) => {
          r.duplicateWorker = true;
        });
        group.anomalies.push(
          `Worker dupliqué : ${worker} (${responses.length} réponses exclues du vote).`
        );
      }
    });

    const distribution = new Map<string, number>();
    let validWorkers = 0;
    let validVotes = 0;

    group.responses.forEach((response) => {
      response.voteEligible =
        response.responseState === 'exploitable' &&
        !response.duplicateWorker &&
        Boolean(response.WorkerId);
      if (!response.voteEligible) return;
      validWorkers++;
      response.activeFields.forEach((attribute) => {
        distribution.set(attribute, (distribution.get(attribute) || 0) + 1);
        validVotes++;
      });
    });

    group.voteDistribution = distribution;
    group.validWorkerCount = validWorkers;
    group.validVoteCount = validVotes;
    group.majoritySuggestion = null;
    group.agreementRate = null;
    group.isTie = false;

    if (group.validVoteCount > 0) {
      let maxVotes = 0;
      distribution.forEach((count) => {
        if (count > maxVotes) maxVotes = count;
      });
      const leaders: string[] = [];
      distribution.forEach((count, attribute) => {
        if (count === maxVotes) leaders.push(attribute);
      });
      leaders.sort();
      group.isTie = leaders.length > 1;
      if (!group.isTie) group.majoritySuggestion = leaders[0];
      group.agreementRate = (maxVotes / group.validVoteCount) * 100;
    }

    if (group.productVariants.size > 1) {
      group.anomalies.push('Informations produit divergentes entre les réponses de ce groupe.');
    }
  });
}

export function isConfiguredConsensusSignature(signature: string): boolean {
  const parts = asText(signature)
    .split('|')
    .filter((p) => p !== '');
  if (!parts.length || parts.length !== uniqueValues(parts).length) return false;
  return parts.every((part) => (RESPONSE_FIELDS as readonly string[]).includes(part));
}

export function getConsensusOptions(group: ConsensusGroup): ConsensusOption[] {
  const options: ConsensusOption[] = [];
  const seen = new Set<string>();

  const add = (value: string, votes: number, category: ConsensusOption['category']) => {
    const signature = asText(value);
    if (!isConfiguredConsensusSignature(signature) || seen.has(signature)) return;
    seen.add(signature);
    options.push({ value: signature, votes: Number(votes) || 0, category });
  };

  Array.from(group.voteDistribution.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([attr, count]) => add(attr, count, 'observed'));

  group.responses.forEach((response) => {
    if (!response.responseSignature) return;
    if (response.activeFields.length > 1) {
      add(response.responseSignature, 0, 'composite');
    } else if (!response.voteEligible) {
      add(response.responseSignature, 0, 'excluded');
    }
  });

  RESPONSE_FIELDS.forEach((attribute) => add(attribute, 0, 'attribute'));
  return options;
}

export function getGroupStatus(
  group: ConsensusGroup,
  decisions: Map<string, GroupDecision>
): GroupDecisionStatus {
  const decision = decisions.get(group.key);
  if (decision && decision.status === 'validated') return 'validated';
  if (decision && decision.status === 'review') return 'review';
  if (group.anomalies.length > 0 || group.validVoteCount === 0) return 'review';
  return 'pending';
}

export function isHitCurrentlySubmitted(
  submittedHitStates: Map<string, SubmittedHitState>,
  hitId: string
): boolean {
  const state = submittedHitStates.get(hitId);
  return Boolean(state && !state.stale);
}

export function getExportableHitIds(
  model: ConsensusModel | null,
  decisions: Map<string, GroupDecision>,
  submittedHitStates: Map<string, SubmittedHitState>
): string[] {
  if (!model) return [];
  return model.hitOrder.filter((hitId) => {
    const hit = model.hits.get(hitId);
    if (!isHitCurrentlySubmitted(submittedHitStates, hitId) || !hit || !hit.groupKeys.length) {
      return false;
    }
    return hit.groupKeys.every((groupKey) => {
      const group = model.groups.get(groupKey);
      return Boolean(group && getGroupStatus(group, decisions) === 'validated');
    });
  });
}

export function calculateDashboardStats(
  model: ConsensusModel,
  decisions: Map<string, GroupDecision>
): DashboardStats {
  const groups = Array.from(model.groups.values());
  const uniqueAsins = new Set(groups.map((g) => g.ASIN));
  let validated = 0;
  let review = 0;
  let ties = 0;
  let sumAgreement = 0;
  let agreementGroups = 0;

  groups.forEach((group) => {
    const status = getGroupStatus(group, decisions);
    if (status === 'validated') validated++;
    if (status === 'review') review++;
    if (group.isTie) ties++;
    if (group.agreementRate !== null) {
      sumAgreement += group.agreementRate;
      agreementGroups++;
    }
  });

  return {
    hitCount: model.hits.size,
    uniqueAsinCount: uniqueAsins.size,
    groupCount: groups.length,
    validatedCount: validated,
    pendingCount: groups.length - validated,
    reviewCount: review,
    tieCount: ties,
    validationRate: groups.length ? (validated / groups.length) * 100 : 0,
    meanAgreement: agreementGroups ? sumAgreement / agreementGroups : null,
  };
}

export function calculateHitConsensusScore(
  model: ConsensusModel | null,
  hit: HitEntry | undefined
): { majorityVotes: number; totalVotes: number; agreementRate: number | null } {
  if (!model || !hit) {
    return { majorityVotes: 0, totalVotes: 0, agreementRate: null };
  }
  let majorityVotes = 0;
  let totalVotes = 0;
  hit.groupKeys.forEach((key) => {
    const group = model.groups.get(key);
    if (!group || !group.validVoteCount || !group.voteDistribution.size) return;
    majorityVotes += Math.max(...Array.from(group.voteDistribution.values()));
    totalVotes += group.validVoteCount;
  });
  return {
    majorityVotes,
    totalVotes,
    agreementRate: totalVotes ? (majorityVotes / totalVotes) * 100 : null,
  };
}

function sourceExportValue(source: SourceRow | null, header: string): string {
  return source && source.rawColumns ? asText(source.rawColumns[header]) : '';
}

export function buildExportRow(
  source: SourceRow,
  response: WorkerResponse | null,
  decisions: Map<string, GroupDecision>
): string[] {
  const decision = response && response.groupKey ? decisions.get(response.groupKey) : undefined;
  const qaAttribute = decision && decision.status === 'validated' ? asText(decision.signature) : '';
  const workerAttribute =
    response && response.responseState === 'exploitable' ? asText(response.responseSignature) : '';
  return [
    sourceExportValue(source, 'HITId'),
    sourceExportValue(source, 'AssignmentId'),
    sourceExportValue(source, 'WorkerId'),
    sourceExportValue(source, 'Input.imageURL'),
    sourceExportValue(source, 'Input.bbox'),
    sourceExportValue(source, 'Input.queryProductASIN'),
    sourceExportValue(source, 'Answer.output_data'),
    asText(response?.product?.imageUrl),
    sourceExportValue(source, 'Input.marketplace'),
    sourceExportValue(source, 'Input.matches'),
    asText(response?.ASIN),
    workerAttribute,
    qaAttribute,
  ];
}

export function buildExportPackage(
  model: ConsensusModel,
  decisions: Map<string, GroupDecision>,
  submittedHitStates: Map<string, SubmittedHitState>
): ExportPackage {
  const headers = [...EXPORT_HEADERS];
  const exportableHitIds = getExportableHitIds(model, decisions, submittedHitStates);
  const exportableHitSet = new Set(exportableHitIds);
  const eligibleSources = model.sourceRows.filter((source) => exportableHitSet.has(source.HITId));
  const rows: string[][] = [];

  eligibleSources.forEach((source) => {
    const relevant = source.responseIds
      .map((id) => model.responsesById.get(id))
      .filter((r): r is WorkerResponse => Boolean(r));
    if (!relevant.length) {
      rows.push(buildExportRow(source, null, decisions));
      return;
    }
    relevant.forEach((response) => {
      rows.push(buildExportRow(source, response, decisions));
    });
  });

  return {
    headers,
    rows,
    exportableHitIds,
    excludedHitIds: model.hitOrder.filter((hitId) => !exportableHitSet.has(hitId)),
    eligibleSourceRows: eligibleSources.length,
    excludedSourceRows: model.sourceRows.length - eligibleSources.length,
  };
}

export function serializeDelimited(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  delimiter = ','
): string {
  const sep = delimiter || ',';
  const escapeCell = (value: string): string => {
    const text = asText(value);
    if (
      text.includes('"') ||
      text.includes(sep) ||
      text.includes('\r') ||
      text.includes('\n')
    ) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const output = [headers.map(escapeCell).join(sep)];
  rows.forEach((row) => {
    output.push(row.map(escapeCell).join(sep));
  });
  return output.join('\r\n');
}

export function reconstructDelimitedFromFirebaseRows(
  rows: StoredExportRow[],
  delimiter = ','
): string {
  const sorted = [...rows].sort((a, b) => a.rowNumber - b.rowNumber);
  const matrix = sorted.map((row) => [
    row.hitid,
    row.assignmentId,
    row.workerId,
    row.primaryImageUrl,
    Object.keys(row.bbox || {}).length ? JSON.stringify(row.bbox) : '',
    row.queryProductAsin,
    Object.keys(row.outputData || {}).length ? JSON.stringify(row.outputData) : '',
    row.imageUrl,
    row.marketplace,
    Array.isArray(row.matches) ? JSON.stringify(row.matches) : '[]',
    row.asin,
    row.attribute,
    row.attributeByQa,
  ]);
  return serializeDelimited(EXPORT_HEADERS, matrix, delimiter);
}

export function workerAnswerLabel(response: WorkerResponse): string {
  if (response.responseState === 'exploitable') return response.responseSignature;
  const labels: Record<ResponseState, string> = {
    exploitable: response.responseSignature,
    empty: 'Aucun attribut actif',
    incomplete: 'Réponse incomplète',
    invalid_asin: 'ASIN invalide',
    missing_hit: 'HIT manquant',
    missing_worker: 'Worker manquant',
  };
  return labels[response.responseState] || 'Non exploitable';
}

export function buildAnswerPaletteMap(group: ConsensusGroup): Map<string, AnswerPaletteToken> {
  const labels: string[] = [];
  group.responses.forEach((response) => {
    const label = workerAnswerLabel(response);
    if (!labels.includes(label)) labels.push(label);
  });
  Array.from(group.voteDistribution.keys()).forEach((attr) => {
    if (!labels.includes(attr)) labels.push(attr);
  });
  const map = new Map<string, AnswerPaletteToken>();
  labels.forEach((label, idx) => {
    map.set(label, ANSWER_PALETTE[idx % ANSWER_PALETTE.length]);
  });
  return map;
}

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
  lineIndex?: number;
  termText?: string;
}

function normalizeSearchText(value: string): string {
  return asText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function splitTextIntoHighlightedSegments(
  sourceText: string,
  searchQuery: string
): HighlightSegment[] {
  const original = asText(sourceText);
  const terms: Array<{ text: string; normalized: string; lineIndex: number }> = [];
  asText(searchQuery)
    .split(/\r?\n/)
    .forEach((line, lineIndex) => {
      const trimmed = line.trim();
      const normalized = normalizeSearchText(trimmed);
      if (normalized) {
        terms.push({ text: trimmed, normalized, lineIndex });
      }
    });

  if (!terms.length || !original) {
    return [{ text: original, highlighted: false }];
  }

  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];

  for (let index = 0; index < original.length; ) {
    const codePoint = original.codePointAt(index) ?? original.charCodeAt(index);
    const ch = String.fromCodePoint(codePoint);
    const len = ch.length;
    const norm = normalizeSearchText(ch);
    for (let k = 0; k < norm.length; k++) {
      folded += norm.charAt(k);
      starts.push(index);
      ends.push(index + len);
    }
    index += len;
  }

  const candidates: Array<{
    start: number;
    end: number;
    lineIndex: number;
    termText: string;
  }> = [];

  terms.forEach((term) => {
    let from = 0;
    while (from < folded.length) {
      const found = folded.indexOf(term.normalized, from);
      if (found === -1) break;
      const last = found + term.normalized.length - 1;
      if (starts[found] !== undefined && ends[last] !== undefined) {
        candidates.push({
          start: starts[found],
          end: ends[last],
          lineIndex: term.lineIndex,
          termText: term.text,
        });
      }
      from = found + 1;
    }
  });

  candidates.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA;
    return a.lineIndex - b.lineIndex;
  });

  const selected: typeof candidates = [];
  let cursor = 0;
  candidates.forEach((cand) => {
    if (cand.start < cursor) return;
    selected.push(cand);
    cursor = cand.end;
  });

  if (!selected.length) {
    return [{ text: original, highlighted: false }];
  }

  const segments: HighlightSegment[] = [];
  let pos = 0;
  selected.forEach((hl) => {
    if (hl.start > pos) {
      segments.push({ text: original.slice(pos, hl.start), highlighted: false });
    }
    segments.push({
      text: original.slice(hl.start, hl.end),
      highlighted: true,
      lineIndex: hl.lineIndex,
      termText: hl.termText,
    });
    pos = hl.end;
  });
  if (pos < original.length) {
    segments.push({ text: original.slice(pos), highlighted: false });
  }
  return segments;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 10) / 10} %`;
}

export function pluralize(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count <= 1 ? singular : pluralForm || `${singular}s`}`;
}

export function buildDemoCsvSample(): string {
  const allFalse = {
    asin_image_not_load: false,
    no_difference: false,
    wrong_category: false,
    has_product_difference: false,
    is_wrong_characteristic: false,
    is_wrong_size_or_count: false,
    is_wrong_bundle: false,
    is_wrong_packaging_overlay: false,
    is_non_targeted_match: false,
  };

  const hit1Matches = JSON.stringify([
    {
      asin: 'B09V3KXJPB',
      id: 'm1',
      image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
      product_title: 'Casque Audio Sans Fil circum-auriculaire Noir Mat — Édition Studio',
      product_url: 'https://www.amazon.fr/dp/B09V3KXJPB',
    },
    {
      asin: 'B08N5WRWNW',
      id: 'm2',
      image_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80',
      product_title: 'Pack Duo Casques Audio Sans Fil Noir + Étui Rigide de Transport',
      product_url: 'https://www.amazon.fr/dp/B08N5WRWNW',
    },
  ]);

  const hit2Matches = JSON.stringify([
    {
      asin: 'B07XJ8C8F5',
      id: 'm3',
      image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80',
      product_title: 'Montre Connectée Minimaliste Boîtier Argent Bracelet Blanc 40mm',
      product_url: 'https://www.amazon.fr/dp/B07XJ8C8F5',
    },
  ]);

  const headers = [
    'HITId',
    'AssignmentId',
    'WorkerId',
    'Input.imageURL',
    'Input.bbox',
    'Input.queryProductASIN',
    'Input.queryProductTitle',
    'Input.marketplace',
    'Input.matches',
    'Answer.output_data',
  ];

  const rows = [
    [
      '3HITDEMO0001ALPHA',
      '3ASSIGN001W1',
      'A1WORKER01',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80',
      JSON.stringify({ tlx: 140, tly: 70, brx: 760, bry: 520 }),
      'B09V3KXJPB',
      'Casque Audio Studio Noir Sans Fil',
      'FR',
      hit1Matches,
      JSON.stringify({
        B09V3KXJPB: { ...allFalse, no_difference: true },
        B08N5WRWNW: { ...allFalse, has_product_difference: true, is_wrong_bundle: true },
      }),
    ],
    [
      '3HITDEMO0001ALPHA',
      '3ASSIGN002W2',
      'A1WORKER02',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80',
      JSON.stringify({ tlx: 140, tly: 70, brx: 760, bry: 520 }),
      'B09V3KXJPB',
      'Casque Audio Studio Noir Sans Fil',
      'FR',
      hit1Matches,
      JSON.stringify({
        B09V3KXJPB: { ...allFalse, no_difference: true },
        B08N5WRWNW: { ...allFalse, is_wrong_bundle: true },
      }),
    ],
    [
      '3HITDEMO0001ALPHA',
      '3ASSIGN003W3',
      'A1WORKER03',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80',
      JSON.stringify({ tlx: 140, tly: 70, brx: 760, bry: 520 }),
      'B09V3KXJPB',
      'Casque Audio Studio Noir Sans Fil',
      'FR',
      hit1Matches,
      JSON.stringify({
        B09V3KXJPB: { ...allFalse, no_difference: true },
        B08N5WRWNW: { ...allFalse, is_wrong_size_or_count: true },
      }),
    ],
    [
      '3HITDEMO0002BETA',
      '3ASSIGN004W1',
      'A1WORKER01',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80',
      JSON.stringify({ tlx: 210, tly: 90, brx: 680, bry: 510 }),
      'B07XJ8C8F5',
      'Montre Minimaliste Argent 40mm',
      'FR',
      hit2Matches,
      JSON.stringify({
        B07XJ8C8F5: { ...allFalse, no_difference: true },
      }),
    ],
    [
      '3HITDEMO0002BETA',
      '3ASSIGN005W4',
      'A1WORKER04',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80',
      JSON.stringify({ tlx: 210, tly: 90, brx: 680, bry: 510 }),
      'B07XJ8C8F5',
      'Montre Minimaliste Argent 40mm',
      'FR',
      hit2Matches,
      JSON.stringify({
        B07XJ8C8F5: { ...allFalse, is_wrong_characteristic: true },
      }),
    ],
  ];

  return serializeDelimited(headers, rows, ',');
}
