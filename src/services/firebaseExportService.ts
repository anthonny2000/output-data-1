import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  clampString,
  isValidDatasetKey,
  VALIDATION_LIMITS,
} from '../constants/validation';
import {
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  ConsensusModel,
  GroupDecision,
  PreparedFirebaseRow,
  StoredExportBatch,
  StoredExportRow,
  SubmittedHitState,
  WorkerResponse,
} from '../types/consensus';
import {
  asText,
  getExportableHitIds,
  isPlainObject,
  parseMatches,
  parseOutputEntries,
} from '../utils/consensusEngine';

const FIRESTORE_BATCH_CHUNK_SIZE = 100;

export interface FirebasePreflightResult {
  valid: boolean;
  datasetKey: string;
  fileName: string;
  hitCount: number;
  rowCount: number;
  rows: PreparedFirebaseRow[];
  errors: string[];
}

export interface FirebaseExportProgress {
  text: string;
  percent: number;
}

function sanitizeJsonMap(rawValue: unknown, maxKeys: number): Record<string, unknown> {
  if (!isPlainObject(rawValue)) return {};
  const result: Record<string, unknown> = {};
  const keys = Object.keys(rawValue).slice(0, maxKeys);
  for (const key of keys) {
    const val = rawValue[key];
    if (val === undefined) continue;
    if (
      val === null ||
      typeof val === 'string' ||
      typeof val === 'number' ||
      typeof val === 'boolean'
    ) {
      result[key] = typeof val === 'string' ? clampString(val, 2000) : val;
    } else if (isPlainObject(val)) {
      result[key] = sanitizeJsonMap(val, 40);
    } else if (Array.isArray(val)) {
      result[key] = val.slice(0, 40).map((item) =>
        isPlainObject(item) ? sanitizeJsonMap(item, 20) : clampString(item, 500)
      );
    }
  }
  return result;
}

function sanitizeMatchesList(rawMatchesText: string): Array<Record<string, unknown>> {
  const parsed = parseMatches(rawMatchesText);
  return parsed.rawArray
    .slice(0, VALIDATION_LIMITS.maxMatchesPerRow)
    .map((entry) => sanitizeJsonMap(entry, 20));
}

function sanitizeBBoxMap(rawBboxText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawBboxText) as unknown;
    if (isPlainObject(parsed)) {
      return sanitizeJsonMap(parsed, 8);
    }
  } catch {
    // Fallback to empty native map when raw bbox is missing or invalid
  }
  return {};
}

export function prepareFirebaseExport(
  model: ConsensusModel | null,
  decisions: Map<string, GroupDecision>,
  submittedHitStates: Map<string, SubmittedHitState>,
  comments: Map<string, string>,
  rawDatasetKey: string
): FirebasePreflightResult {
  const datasetKey = asText(rawDatasetKey).trim();
  const errors: string[] = [];

  if (!model) {
    return {
      valid: false,
      datasetKey,
      fileName: '—',
      hitCount: 0,
      rowCount: 0,
      rows: [],
      errors: ['Aucun fichier CSV / TSV n’est actuellement importé.'],
    };
  }

  if (!isValidDatasetKey(datasetKey)) {
    errors.push(
      `dataset_key invalide : utilisez uniquement lettres, chiffres, tirets (-) ou underscores (_), de 1 à ${VALIDATION_LIMITS.datasetKey.maxLength} caractères.`
    );
  }

  const exportableHitIds = getExportableHitIds(model, decisions, submittedHitStates);
  const exportableSet = new Set(exportableHitIds);
  const eligibleSources = model.sourceRows.filter((source) => exportableSet.has(source.HITId));

  const fileNames: string[] = [];
  eligibleSources.forEach((s) => {
    if (s.fileName && !fileNames.includes(s.fileName)) fileNames.push(s.fileName);
  });
  if (!fileNames.length) {
    model.fileReports.forEach((f) => {
      if (f.fileName && !fileNames.includes(f.fileName)) fileNames.push(f.fileName);
    });
  }
  const combinedFileName = clampString(
    fileNames.length ? fileNames.join(' + ') : 'consensus_export.csv',
    VALIDATION_LIMITS.fileName.maxLength
  );

  if (exportableHitIds.length === 0) {
    errors.push(
      'Aucun HIT validé et soumis n’est prêt à être exporté. Validez tous les ASIN d’au moins un HIT puis cliquez sur « Soumettre le HIT ».'
    );
  }

  const rows: PreparedFirebaseRow[] = [];
  let rowSequence = 1;

  eligibleSources.forEach((source) => {
    const outputParsed = parseOutputEntries(asText(source.rawColumns['Answer.output_data']));
    const nativeOutputData = sanitizeJsonMap(outputParsed.rawMap, 200);
    const nativeBbox = sanitizeBBoxMap(source.rawBbox);
    const nativeMatches = sanitizeMatchesList(source.rawMatches);

    const relevant = source.responseIds
      .map((id) => model.responsesById.get(id))
      .filter((r): r is WorkerResponse => Boolean(r));

    const hitid = clampString(source.HITId, VALIDATION_LIMITS.row.hitidMax);
    if (!hitid) {
      errors.push(`Ligne source ${source.sourceLine} : HITId vide.`);
      return;
    }

    if (!relevant.length) {
      rows.push({
        rowNumber: rowSequence++,
        hitid,
        assignmentId: clampString(source.AssignmentId, VALIDATION_LIMITS.row.assignmentIdMax),
        workerId: clampString(source.WorkerId, VALIDATION_LIMITS.row.workerIdMax),
        primaryImageUrl: clampString(source.mainImageUrl, VALIDATION_LIMITS.row.primaryImageUrlMax),
        bbox: nativeBbox,
        queryProductAsin: clampString(
          source.inputQueryProductAsin,
          VALIDATION_LIMITS.row.queryProductAsinMax
        ),
        outputData: nativeOutputData,
        imageUrl: '',
        marketplace: clampString(source.marketplace, VALIDATION_LIMITS.row.marketplaceMax),
        matches: nativeMatches,
        asin: '',
        attribute: '',
        attributeByQa: '',
        qaComment: '',
      });
      return;
    }

    relevant.forEach((response) => {
      const decision = response.groupKey ? decisions.get(response.groupKey) : undefined;
      const qaAttribute =
        decision && decision.status === 'validated' ? asText(decision.signature) : '';
      const workerAttribute =
        response.responseState === 'exploitable' ? asText(response.responseSignature) : '';
      const qaComment = response.groupKey ? asText(comments.get(response.groupKey)) : '';

      if (!qaAttribute) {
        errors.push(
          `HIT ${source.HITId} · ASIN ${response.ASIN} : décision QA validée manquante.`
        );
      }

      rows.push({
        rowNumber: rowSequence++,
        hitid,
        assignmentId: clampString(source.AssignmentId, VALIDATION_LIMITS.row.assignmentIdMax),
        workerId: clampString(source.WorkerId, VALIDATION_LIMITS.row.workerIdMax),
        primaryImageUrl: clampString(source.mainImageUrl, VALIDATION_LIMITS.row.primaryImageUrlMax),
        bbox: nativeBbox,
        queryProductAsin: clampString(
          source.inputQueryProductAsin,
          VALIDATION_LIMITS.row.queryProductAsinMax
        ),
        outputData: nativeOutputData,
        imageUrl: clampString(response.product.imageUrl, VALIDATION_LIMITS.row.imageUrlMax),
        marketplace: clampString(source.marketplace, VALIDATION_LIMITS.row.marketplaceMax),
        matches: nativeMatches,
        asin: clampString(response.ASIN, VALIDATION_LIMITS.row.asinMax),
        attribute: clampString(workerAttribute, VALIDATION_LIMITS.row.attributeMax),
        attributeByQa: clampString(qaAttribute, VALIDATION_LIMITS.row.attributeByQaMax),
        qaComment: clampString(qaComment, VALIDATION_LIMITS.row.qaCommentMax),
      });
    });
  });

  if (rows.length > VALIDATION_LIMITS.maxRowCount) {
    errors.push(
      `Nombre de lignes (${rows.length}) supérieur à la limite autorisée par lot (${VALIDATION_LIMITS.maxRowCount}).`
    );
  }
  if (exportableHitIds.length > VALIDATION_LIMITS.maxHitCount) {
    errors.push(
      `Nombre de HIT (${exportableHitIds.length}) supérieur à la limite autorisée (${VALIDATION_LIMITS.maxHitCount}).`
    );
  }

  return {
    valid: errors.length === 0 && rows.length > 0,
    datasetKey,
    fileName: combinedFileName,
    hitCount: exportableHitIds.length,
    rowCount: rows.length,
    rows,
    errors,
  };
}

function generateSafeExportId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `exp_${Date.now()}_${randomPart}`;
}

function toIsoTimestamp(value: unknown): { iso: string; ms: number } {
  if (value instanceof Timestamp) {
    const date = value.toDate();
    return { iso: date.toISOString(), ms: date.getTime() };
  }
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return { iso: date.toISOString(), ms: date.getTime() };
  }
  const now = Date.now();
  return { iso: new Date(now).toISOString(), ms: now };
}

export async function deleteExportBatch(exportId: string, ownerId: string): Promise<void> {
  const rowsPath = `exports/${exportId}/rows`;
  let rowDocIds: string[] = [];
  try {
    const rowsQuery = query(collection(db, 'exports', exportId, 'rows'), where('ownerId', '==', ownerId));
    const snap = await getDocs(rowsQuery);
    rowDocIds = snap.docs.map((d) => d.id);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, rowsPath);
  }

  // Delete subcollection rows first while parent /exports/{exportId} still exists (Master Gate invariant)
  for (let i = 0; i < rowDocIds.length; i += FIRESTORE_BATCH_CHUNK_SIZE) {
    const slice = rowDocIds.slice(i, i + FIRESTORE_BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);
    slice.forEach((rowId) => {
      batch.delete(doc(db, 'exports', exportId, 'rows', rowId));
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, rowsPath);
    }
  }

  const batchPath = `exports/${exportId}`;
  try {
    await deleteDoc(doc(db, 'exports', exportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, batchPath);
  }
}

export async function executeFirebaseExport(options: {
  ownerId: string;
  prepared: FirebasePreflightResult;
  replaceExistingDataset: boolean;
  existingExports: StoredExportBatch[];
  isCancelled: () => boolean;
  onProgress: (progress: FirebaseExportProgress) => void;
}): Promise<{ exportId: string; rowCount: number; hitCount: number; replacedCount: number }> {
  const {
    ownerId,
    prepared,
    replaceExistingDataset,
    existingExports,
    isCancelled,
    onProgress,
  } = options;

  if (!prepared.valid) {
    throw new Error('Les données préparées comportent des erreurs de validation.');
  }

  const exportId = generateSafeExportId();
  const exportDocRef = doc(db, 'exports', exportId);
  const exportPath = `exports/${exportId}`;

  onProgress({ text: 'Création du lot de staging dans Firebase Firestore…', percent: 8 });

  try {
    await setDoc(exportDocRef, {
      ownerId,
      datasetKey: prepared.datasetKey,
      fileName: prepared.fileName,
      rowCount: prepared.rowCount,
      hitCount: prepared.hitCount,
      status: 'staging',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, exportPath);
  }

  const totalChunks = Math.max(1, Math.ceil(prepared.rows.length / FIRESTORE_BATCH_CHUNK_SIZE));

  try {
    let sentRows = 0;
    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      if (isCancelled()) {
        throw new Error('EXPORT_CANCELLED');
      }

      const start = chunkIdx * FIRESTORE_BATCH_CHUNK_SIZE;
      const chunk = prepared.rows.slice(start, start + FIRESTORE_BATCH_CHUNK_SIZE);
      onProgress({
        text: `Envoi du lot ${chunkIdx + 1} / ${totalChunks} (${sentRows} / ${prepared.rowCount} lignes)…`,
        percent: 14 + Math.round((chunkIdx / totalChunks) * 72),
      });

      const batch = writeBatch(db);
      chunk.forEach((row) => {
        const rowId = `row_${String(row.rowNumber).padStart(6, '0')}`;
        const rowRef = doc(db, 'exports', exportId, 'rows', rowId);
        batch.set(rowRef, {
          ownerId,
          exportId,
          datasetKey: prepared.datasetKey,
          rowNumber: row.rowNumber,
          hitid: row.hitid,
          assignmentId: row.assignmentId,
          workerId: row.workerId,
          primaryImageUrl: row.primaryImageUrl,
          bbox: row.bbox,
          queryProductAsin: row.queryProductAsin,
          outputData: row.outputData,
          imageUrl: row.imageUrl,
          marketplace: row.marketplace,
          matches: row.matches,
          asin: row.asin,
          attribute: row.attribute,
          attributeByQa: row.attributeByQa,
          qaComment: row.qaComment,
          createdAt: serverTimestamp(),
        });
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `exports/${exportId}/rows`);
      }

      sentRows += chunk.length;
    }

    if (isCancelled()) {
      throw new Error('EXPORT_CANCELLED');
    }

    onProgress({ text: 'Validation finale du lot dans Firestore…', percent: 90 });

    try {
      await updateDoc(exportDocRef, {
        status: 'completed',
        rowCount: prepared.rowCount,
        hitCount: prepared.hitCount,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, exportPath);
    }

    let replacedCount = 0;
    if (replaceExistingDataset) {
      const obsolete = existingExports.filter(
        (item) => item.datasetKey === prepared.datasetKey && item.id !== exportId
      );
      if (obsolete.length > 0) {
        onProgress({
          text: `Nettoyage de ${obsolete.length} ancien(s) lot(s) du dataset « ${prepared.datasetKey} »…`,
          percent: 96,
        });
        for (const oldBatch of obsolete) {
          await deleteExportBatch(oldBatch.id, ownerId);
          replacedCount++;
        }
      }
    }

    onProgress({
      text: `Export enregistré avec succès (${prepared.rowCount} lignes).`,
      percent: 100,
    });

    return {
      exportId,
      rowCount: prepared.rowCount,
      hitCount: prepared.hitCount,
      replacedCount,
    };
  } catch (error) {
    // Rollback / mark failed so incomplete staging data never pollutes completed exports
    try {
      await deleteExportBatch(exportId, ownerId);
    } catch {
      try {
        await updateDoc(exportDocRef, {
          status: 'failed',
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore cleanup failure if network dropped
      }
    }
    throw error;
  }
}

export function subscribeToUserExports(
  ownerId: string,
  onExports: (exports: StoredExportBatch[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = 'exports';
  const exportsQuery = query(collection(db, 'exports'), where('ownerId', '==', ownerId));
  return onSnapshot(
    exportsQuery,
    (snapshot) => {
      const list: StoredExportBatch[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const created = toIsoTimestamp(data.createdAt);
        const updated = toIsoTimestamp(data.updatedAt);
        return {
          id: docSnap.id,
          ownerId: asText(data.ownerId),
          datasetKey: asText(data.datasetKey),
          fileName: asText(data.fileName),
          rowCount: Number(data.rowCount) || 0,
          hitCount: Number(data.hitCount) || 0,
          status:
            data.status === 'completed' || data.status === 'failed' ? data.status : 'staging',
          createdAtIso: created.iso,
          updatedAtIso: updated.iso,
          createdAtMs: created.ms,
        };
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onExports(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (structuredErr) {
        onError(structuredErr);
      }
    }
  );
}

export async function fetchExportRows(
  exportId: string,
  ownerId: string
): Promise<StoredExportRow[]> {
  const path = `exports/${exportId}/rows`;
  try {
    const rowsQuery = query(
      collection(db, 'exports', exportId, 'rows'),
      where('ownerId', '==', ownerId)
    );
    const snapshot = await getDocs(rowsQuery);
    const rows: StoredExportRow[] = snapshot.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ownerId: asText(d.ownerId),
        exportId: asText(d.exportId),
        datasetKey: asText(d.datasetKey),
        rowNumber: Number(d.rowNumber) || 0,
        hitid: asText(d.hitid),
        assignmentId: asText(d.assignmentId),
        workerId: asText(d.workerId),
        primaryImageUrl: asText(d.primaryImageUrl),
        bbox: isPlainObject(d.bbox) ? d.bbox : {},
        queryProductAsin: asText(d.queryProductAsin),
        outputData: isPlainObject(d.outputData) ? d.outputData : {},
        imageUrl: asText(d.imageUrl),
        marketplace: asText(d.marketplace),
        matches: Array.isArray(d.matches)
          ? d.matches.filter((m): m is Record<string, unknown> => isPlainObject(m))
          : [],
        asin: asText(d.asin),
        attribute: asText(d.attribute),
        attributeByQa: asText(d.attributeByQa),
        qaComment: asText(d.qaComment),
      };
    });
    rows.sort((a, b) => a.rowNumber - b.rowNumber);
    return rows;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
