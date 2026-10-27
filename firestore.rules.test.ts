/**
 * Security Rules Verification Suite (Dirty Dozen + Happy Path)
 * Mirrors the exact boolean gates of firestore.rules to assert that all
 * 12 Dirty Dozen adversarial payloads return PERMISSION_DENIED.
 */

interface AuthContext {
  uid: string;
  emailVerified: boolean;
}

interface ExportBatchDoc {
  [key: string]: unknown;
}

interface ExportRowDoc {
  [key: string]: unknown;
}

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

const BATCH_KEYS = [
  'ownerId',
  'datasetKey',
  'fileName',
  'rowCount',
  'hitCount',
  'status',
  'createdAt',
  'updatedAt',
];

const ROW_KEYS = [
  'ownerId',
  'exportId',
  'datasetKey',
  'rowNumber',
  'hitid',
  'assignmentId',
  'workerId',
  'primaryImageUrl',
  'bbox',
  'queryProductAsin',
  'outputData',
  'imageUrl',
  'marketplace',
  'matches',
  'asin',
  'attribute',
  'attributeByQa',
  'qaComment',
  'createdAt',
];

function isSignedIn(auth: AuthContext | null): auth is AuthContext {
  return auth !== null && typeof auth.uid === 'string' && auth.uid.length > 0;
}

function isVerified(auth: AuthContext | null): auth is AuthContext {
  return isSignedIn(auth) && auth.emailVerified === true;
}

function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

function hasExactKeys(data: Record<string, unknown>, allowed: string[]): boolean {
  const keys = Object.keys(data);
  return (
    allowed.every((k) => Object.prototype.hasOwnProperty.call(data, k)) &&
    keys.every((k) => allowed.includes(k))
  );
}

function isPlainMap(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function isValidExportBatch(data: ExportBatchDoc, auth: AuthContext): boolean {
  if (!hasExactKeys(data, BATCH_KEYS)) return false;
  return (
    typeof data.ownerId === 'string' &&
    data.ownerId.length >= 1 &&
    data.ownerId.length <= 128 &&
    ID_REGEX.test(data.ownerId) &&
    data.ownerId === auth.uid &&
    typeof data.datasetKey === 'string' &&
    data.datasetKey.length >= 1 &&
    data.datasetKey.length <= 120 &&
    ID_REGEX.test(data.datasetKey) &&
    typeof data.fileName === 'string' &&
    data.fileName.length >= 1 &&
    data.fileName.length <= 260 &&
    typeof data.rowCount === 'number' &&
    Number.isInteger(data.rowCount) &&
    data.rowCount >= 0 &&
    data.rowCount <= 50000 &&
    typeof data.hitCount === 'number' &&
    Number.isInteger(data.hitCount) &&
    data.hitCount >= 0 &&
    data.hitCount <= 10000 &&
    typeof data.status === 'string' &&
    data.status.length >= 6 &&
    data.status.length <= 16 &&
    (data.status === 'staging' || data.status === 'completed' || data.status === 'failed') &&
    typeof data.createdAt === 'number' &&
    typeof data.updatedAt === 'number'
  );
}

function isValidExportRow(data: ExportRowDoc, auth: AuthContext): boolean {
  if (!hasExactKeys(data, ROW_KEYS)) return false;
  return (
    typeof data.ownerId === 'string' &&
    data.ownerId.length >= 1 &&
    data.ownerId.length <= 128 &&
    ID_REGEX.test(data.ownerId) &&
    data.ownerId === auth.uid &&
    typeof data.exportId === 'string' &&
    data.exportId.length >= 1 &&
    data.exportId.length <= 128 &&
    ID_REGEX.test(data.exportId) &&
    typeof data.datasetKey === 'string' &&
    data.datasetKey.length >= 1 &&
    data.datasetKey.length <= 120 &&
    ID_REGEX.test(data.datasetKey) &&
    typeof data.rowNumber === 'number' &&
    Number.isInteger(data.rowNumber) &&
    data.rowNumber >= 1 &&
    data.rowNumber <= 50000 &&
    typeof data.hitid === 'string' &&
    data.hitid.length >= 1 &&
    data.hitid.length <= 128 &&
    typeof data.assignmentId === 'string' &&
    data.assignmentId.length <= 128 &&
    typeof data.workerId === 'string' &&
    data.workerId.length <= 128 &&
    typeof data.primaryImageUrl === 'string' &&
    data.primaryImageUrl.length <= 2048 &&
    isPlainMap(data.bbox) &&
    Object.keys(data.bbox).length <= 8 &&
    typeof data.queryProductAsin === 'string' &&
    data.queryProductAsin.length <= 64 &&
    isPlainMap(data.outputData) &&
    Object.keys(data.outputData).length <= 200 &&
    typeof data.imageUrl === 'string' &&
    data.imageUrl.length <= 2048 &&
    typeof data.marketplace === 'string' &&
    data.marketplace.length <= 32 &&
    Array.isArray(data.matches) &&
    data.matches.length <= 100 &&
    (data.matches.length === 0 || isPlainMap(data.matches[0])) &&
    typeof data.asin === 'string' &&
    data.asin.length <= 32 &&
    typeof data.attribute === 'string' &&
    data.attribute.length <= 512 &&
    typeof data.attributeByQa === 'string' &&
    data.attributeByQa.length <= 512 &&
    typeof data.qaComment === 'string' &&
    data.qaComment.length <= 2000 &&
    typeof data.createdAt === 'number'
  );
}

function affectedKeys(incoming: Record<string, unknown>, existing: Record<string, unknown>): string[] {
  const all = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  all.forEach((k) => {
    if (JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])) {
      changed.push(k);
    }
  });
  return changed;
}

function evalCreateExportBatch(
  exportId: string,
  incoming: ExportBatchDoc,
  auth: AuthContext | null,
  requestTime: number
): boolean {
  return (
    isVerified(auth) &&
    isValidId(exportId) &&
    isValidExportBatch(incoming, auth) &&
    incoming.status === 'staging' &&
    incoming.createdAt === requestTime &&
    incoming.updatedAt === requestTime
  );
}

function evalUpdateExportBatch(
  exportId: string,
  existing: ExportBatchDoc,
  incoming: ExportBatchDoc,
  auth: AuthContext | null,
  requestTime: number
): boolean {
  if (!isVerified(auth) || !isValidId(exportId) || !isValidExportBatch(incoming, auth)) {
    return false;
  }
  const diff = affectedKeys(incoming, existing);
  const completeAllowed = ['status', 'rowCount', 'hitCount', 'updatedAt'];
  const failAllowed = ['status', 'updatedAt'];
  return (
    existing.ownerId === auth.uid &&
    incoming.ownerId === existing.ownerId &&
    incoming.datasetKey === existing.datasetKey &&
    incoming.fileName === existing.fileName &&
    incoming.createdAt === existing.createdAt &&
    incoming.updatedAt === requestTime &&
    existing.status === 'staging' &&
    ((incoming.status === 'completed' && diff.every((k) => completeAllowed.includes(k))) ||
      (incoming.status === 'failed' && diff.every((k) => failAllowed.includes(k))))
  );
}

function evalCreateExportRow(
  exportId: string,
  rowId: string,
  parentBatch: ExportBatchDoc | null,
  incoming: ExportRowDoc,
  auth: AuthContext | null,
  requestTime: number
): boolean {
  return (
    isVerified(auth) &&
    isValidId(exportId) &&
    isValidId(rowId) &&
    isValidExportRow(incoming, auth) &&
    incoming.exportId === exportId &&
    incoming.createdAt === requestTime &&
    parentBatch !== null &&
    parentBatch.ownerId === auth.uid &&
    parentBatch.status === 'staging' &&
    parentBatch.datasetKey === incoming.datasetKey
  );
}

function evalListExportBatch(resourceData: ExportBatchDoc, auth: AuthContext | null): boolean {
  return isVerified(auth) && resourceData.ownerId === auth.uid;
}

function assertDenied(name: string, allowed: boolean): void {
  if (allowed) {
    throw new Error(`SECURITY FAILURE: Dirty Dozen test "${name}" was ALLOWED instead of PERMISSION_DENIED.`);
  }
}

function assertAllowed(name: string, allowed: boolean): void {
  if (!allowed) {
    throw new Error(`FUNCTIONAL FAILURE: Valid operation "${name}" was DENIED.`);
  }
}

export function runSecurityRulesSuite(): void {
  const now = 1793014000000;
  const validAuth: AuthContext = { uid: 'user_abc123', emailVerified: true };

  const baseBatch: ExportBatchDoc = {
    ownerId: 'user_abc123',
    datasetKey: 'comparaison_principale',
    fileName: 'extrait.csv',
    rowCount: 12,
    hitCount: 2,
    status: 'staging',
    createdAt: now,
    updatedAt: now,
  };

  const baseRow: ExportRowDoc = {
    ownerId: 'user_abc123',
    exportId: 'exp_001',
    datasetKey: 'comparaison_principale',
    rowNumber: 1,
    hitid: '3XYZ123456',
    assignmentId: '3ASSIGN789',
    workerId: 'A1WORKER99',
    primaryImageUrl: 'https://m.media-amazon.com/images/I/query.jpg',
    bbox: { tlx: 10, tly: 20, brx: 120, bry: 220 },
    queryProductAsin: 'B001234567',
    outputData: { B009876543: { no_difference: true } },
    imageUrl: 'https://m.media-amazon.com/images/I/match.jpg',
    marketplace: 'FR',
    matches: [{ asin: 'B009876543', product_title: 'Exemple Produit' }],
    asin: 'B009876543',
    attribute: 'no_difference',
    attributeByQa: 'no_difference',
    qaComment: 'Produit strictement identique.',
    createdAt: now,
  };

  // Happy path sanity checks
  assertAllowed('Valid staging batch creation', evalCreateExportBatch('exp_001', baseBatch, validAuth, now));
  assertAllowed('Valid staging row creation', evalCreateExportRow('exp_001', 'row_0001', baseBatch, baseRow, validAuth, now));
  assertAllowed(
    'Valid staging -> completed transition',
    evalUpdateExportBatch(
      'exp_001',
      baseBatch,
      { ...baseBatch, status: 'completed', updatedAt: now + 5000 },
      validAuth,
      now + 5000
    )
  );

  // Dirty Dozen Adversarial Payloads (ALL 12 MUST BE PERMISSION_DENIED)
  assertDenied('1. Unauthenticated create', evalCreateExportBatch('exp_001', baseBatch, null, now));
  assertDenied(
    '2. Unverified email spoofing',
    evalCreateExportBatch('exp_001', baseBatch, { uid: 'user_abc123', emailVerified: false }, now)
  );
  assertDenied(
    '3. Identity spoofing (ownerId mismatch)',
    evalCreateExportBatch('exp_001', { ...baseBatch, ownerId: 'victim_999' }, validAuth, now)
  );
  assertDenied(
    '4. Shadow / ghost field injection',
    evalCreateExportBatch('exp_001', { ...baseBatch, isAdmin: true }, validAuth, now)
  );
  assertDenied(
    '5. State shortcutting on create (status=completed)',
    evalCreateExportBatch('exp_001', { ...baseBatch, status: 'completed' }, validAuth, now)
  );
  assertDenied(
    '6. Forged client timestamp',
    evalCreateExportBatch('exp_001', { ...baseBatch, createdAt: now - 99999 }, validAuth, now)
  );
  assertDenied(
    '7. ID poisoning attack',
    evalCreateExportBatch('bad$id/with spaces!' + 'x'.repeat(140), baseBatch, validAuth, now)
  );
  assertDenied(
    '8. Terminal state re-opening from completed',
    evalUpdateExportBatch(
      'exp_001',
      { ...baseBatch, status: 'completed' },
      { ...baseBatch, status: 'staging', updatedAt: now + 1000 },
      validAuth,
      now + 1000
    )
  );
  assertDenied(
    '9. Immutable datasetKey mutation during update',
    evalUpdateExportBatch(
      'exp_001',
      baseBatch,
      { ...baseBatch, datasetKey: 'hijacked_dataset', status: 'completed', updatedAt: now + 1000 },
      validAuth,
      now + 1000
    )
  );
  assertDenied(
    '10. Orphaned subcollection row write (missing parent)',
    evalCreateExportRow('exp_missing', 'row_0001', null, { ...baseRow, exportId: 'exp_missing' }, validAuth, now)
  );
  assertDenied(
    '11. Unbounded matches array Denial-of-Wallet (>100 items)',
    evalCreateExportRow(
      'exp_001',
      'row_0001',
      baseBatch,
      { ...baseRow, matches: Array.from({ length: 105 }, () => ({ asin: 'B000000001' })) },
      validAuth,
      now
    )
  );
  assertDenied(
    '12. Cross-tenant list scraping',
    evalListExportBatch(baseBatch, { uid: 'attacker_uid', emailVerified: true })
  );

  console.log('ALL 12 DIRTY DOZEN PAYLOADS REJECTED (PERMISSION_DENIED) & HAPPY PATHS VERIFIED.');
}

runSecurityRulesSuite();
