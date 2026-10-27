import blueprint from '../../firebase-blueprint.json';

const batchProps = blueprint.entities.ExportBatch.properties;
const rowProps = blueprint.entities.ExportRow.properties;

export const VALIDATION_LIMITS = {
  id: {
    minLength: batchProps.ownerId.minLength,
    maxLength: batchProps.ownerId.maxLength,
    pattern: new RegExp(batchProps.ownerId.pattern),
  },
  datasetKey: {
    minLength: batchProps.datasetKey.minLength,
    maxLength: batchProps.datasetKey.maxLength,
    pattern: new RegExp(batchProps.datasetKey.pattern),
  },
  fileName: {
    minLength: batchProps.fileName.minLength,
    maxLength: batchProps.fileName.maxLength,
  },
  maxRowCount: 50000,
  maxHitCount: 10000,
  maxMatchesPerRow: 100,
  row: {
    hitidMax: rowProps.hitid.maxLength,
    assignmentIdMax: rowProps.assignmentId.maxLength,
    workerIdMax: rowProps.workerId.maxLength,
    primaryImageUrlMax: rowProps.primaryImageUrl.maxLength,
    queryProductAsinMax: rowProps.queryProductAsin.maxLength,
    imageUrlMax: rowProps.imageUrl.maxLength,
    marketplaceMax: rowProps.marketplace.maxLength,
    asinMax: rowProps.asin.maxLength,
    attributeMax: rowProps.attribute.maxLength,
    attributeByQaMax: rowProps.attributeByQa.maxLength,
    qaCommentMax: rowProps.qaComment.maxLength,
  },
} as const;

export const DEFAULT_DATASET_KEY = 'comparaison_principale';

export function clampString(value: unknown, maxLength: number): string {
  const str = value === undefined || value === null ? '' : String(value);
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

export function isValidDatasetKey(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= VALIDATION_LIMITS.datasetKey.minLength &&
    trimmed.length <= VALIDATION_LIMITS.datasetKey.maxLength &&
    VALIDATION_LIMITS.datasetKey.pattern.test(trimmed)
  );
}
