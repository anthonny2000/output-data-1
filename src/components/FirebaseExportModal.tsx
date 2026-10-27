import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  CloudUpload,
  Database,
  Download,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { DEFAULT_DATASET_KEY } from '../constants/validation';
import { firebaseConfig, parseStructuredFirestoreError } from '../firebase';
import {
  deleteExportBatch,
  executeFirebaseExport,
  fetchExportRows,
  FirebaseExportProgress,
  prepareFirebaseExport,
} from '../services/firebaseExportService';
import {
  ConsensusModel,
  GroupDecision,
  StoredExportBatch,
  StoredExportRow,
  SubmittedHitState,
} from '../types/consensus';
import {
  pluralize,
  reconstructDelimitedFromFirebaseRows,
} from '../utils/consensusEngine';
import { StatusBadge, SvgProgressBar } from './StatusBadge';

interface FirebaseExportModalProps {
  open: boolean;
  initialTab: 'send' | 'stored';
  model: ConsensusModel | null;
  decisions: Map<string, GroupDecision>;
  submittedHitStates: Map<string, SubmittedHitState>;
  comments: Map<string, string>;
  currentUser: User | null;
  storedExports: StoredExportBatch[];
  onClose: () => void;
  onSignInGoogle: () => Promise<void>;
  onSignOutGoogle: () => Promise<void>;
  onNotify: (message: string, isError?: boolean) => void;
  onExportActiveChange: (active: boolean) => void;
}

function formatDateFr(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function triggerTextDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const FirebaseExportModal: React.FC<FirebaseExportModalProps> = ({
  open,
  initialTab,
  model,
  decisions,
  submittedHitStates,
  comments,
  currentUser,
  storedExports,
  onClose,
  onSignInGoogle,
  onSignOutGoogle,
  onNotify,
  onExportActiveChange,
}) => {
  const [activeTab, setActiveTab] = useState<'send' | 'stored'>(initialTab);
  const [datasetKey, setDatasetKey] = useState(DEFAULT_DATASET_KEY);
  const [replaceMode, setReplaceMode] = useState(true);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<FirebaseExportProgress | null>(null);
  const [sendError, setSendError] = useState<{ message: string; upgradeUrl?: string } | null>(null);
  const [lastSuccess, setLastSuccess] = useState<{
    exportId: string;
    datasetKey: string;
    rowCount: number;
    hitCount: number;
    replacedCount: number;
  } | null>(null);

  const [previewExportId, setPreviewExportId] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<StoredExportRow[]>([]);
  const [loadingRowsId, setLoadingRowsId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const cancelRef = useRef(false);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setSendError(null);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, sending, onClose]);

  const preflight = useMemo(
    () =>
      prepareFirebaseExport(
        model,
        decisions,
        submittedHitStates,
        comments,
        datasetKey
      ),
    [model, decisions, submittedHitStates, comments, datasetKey]
  );

  const matchingExistingCount = useMemo(
    () =>
      storedExports.filter(
        (exp) => exp.datasetKey === datasetKey.trim() && exp.status === 'completed'
      ).length,
    [storedExports, datasetKey]
  );

  if (!open) return null;

  const needsReplaceConfirmation = replaceMode && matchingExistingCount > 0;
  const canStartExport =
    Boolean(currentUser) &&
    preflight.valid &&
    !sending &&
    (!needsReplaceConfirmation || confirmReplace);

  const handleStartExport = async () => {
    if (!currentUser || !preflight.valid || sending) return;
    setSending(true);
    onExportActiveChange(true);
    setSendError(null);
    setLastSuccess(null);
    cancelRef.current = false;

    try {
      const result = await executeFirebaseExport({
        ownerId: currentUser.uid,
        prepared: preflight,
        replaceExistingDataset: replaceMode,
        existingExports: storedExports,
        isCancelled: () => cancelRef.current,
        onProgress: (p) => setProgress(p),
      });

      setLastSuccess({
        exportId: result.exportId,
        datasetKey: preflight.datasetKey,
        rowCount: result.rowCount,
        hitCount: result.hitCount,
        replacedCount: result.replacedCount,
      });
      setConfirmReplace(false);
      onNotify(
        `Export enregistré sur Firebase Firestore : ${pluralize(
          result.rowCount,
          'ligne',
          'lignes'
        )} (${pluralize(result.hitCount, 'HIT', 'HIT')}).`
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'EXPORT_CANCELLED') {
        setSendError({
          message:
            'Envoi annulé avant validation finale. Les données existantes dans Firebase sont restées intactes.',
        });
        onNotify('Envoi Firebase annulé.', true);
      } else {
        const parsed = parseStructuredFirestoreError(error);
        setSendError({ message: parsed.userMessage, upgradeUrl: parsed.upgradeUrl });
        onNotify(`Échec de l’envoi Firebase : ${parsed.userMessage}`, true);
      }
      setProgress(null);
    } finally {
      setSending(false);
      onExportActiveChange(false);
    }
  };

  const handleTogglePreview = async (batch: StoredExportBatch) => {
    if (!currentUser) return;
    if (previewExportId === batch.id) {
      setPreviewExportId(null);
      setPreviewRows([]);
      return;
    }
    setLoadingRowsId(batch.id);
    try {
      const rows = await fetchExportRows(batch.id, currentUser.uid);
      setPreviewExportId(batch.id);
      setPreviewRows(rows);
    } catch (error) {
      const parsed = parseStructuredFirestoreError(error);
      onNotify(`Impossible de charger les lignes : ${parsed.userMessage}`, true);
    } finally {
      setLoadingRowsId(null);
    }
  };

  const handleDownloadStored = async (batch: StoredExportBatch, format: 'csv' | 'tsv') => {
    if (!currentUser) return;
    setLoadingRowsId(batch.id);
    try {
      const rows =
        previewExportId === batch.id && previewRows.length > 0
          ? previewRows
          : await fetchExportRows(batch.id, currentUser.uid);
      const delimiter = format === 'tsv' ? '\t' : ',';
      const content = reconstructDelimitedFromFirebaseRows(rows, delimiter);
      const mime =
        format === 'tsv'
          ? 'text/tab-separated-values;charset=utf-8'
          : 'text/csv;charset=utf-8';
      triggerTextDownload(content, `${batch.datasetKey}_${batch.id}.${format}`, mime);
      onNotify(
        `Fichier ${format.toUpperCase()} téléchargé depuis Firebase (${pluralize(
          rows.length,
          'ligne',
          'lignes'
        )}).`
      );
    } catch (error) {
      const parsed = parseStructuredFirestoreError(error);
      onNotify(`Téléchargement impossible : ${parsed.userMessage}`, true);
    } finally {
      setLoadingRowsId(null);
    }
  };

  const handleDeleteStored = async (batch: StoredExportBatch) => {
    if (!currentUser) return;
    setDeletingId(batch.id);
    try {
      await deleteExportBatch(batch.id, currentUser.uid);
      if (previewExportId === batch.id) {
        setPreviewExportId(null);
        setPreviewRows([]);
      }
      setConfirmDeleteId(null);
      onNotify(`Export « ${batch.datasetKey} » supprimé de Firebase.`);
    } catch (error) {
      const parsed = parseStructuredFirestoreError(error);
      onNotify(`Suppression impossible : ${parsed.userMessage}`, true);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="firebaseModalTitle"
        className="flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-[#0d2135] to-[#071321] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-400/20">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              <h2 id="firebaseModalTitle" className="m-0 text-base sm:text-lg font-bold text-white">
                Base de données gratuite Firebase Cloud Firestore
              </h2>
            </div>
            <p className="m-0 mt-1 text-xs text-slate-400">
              Projet provisionné : <code className="text-cyan-200">{firebaseConfig.projectId}</code> · Stockage sécurisé de vos exports validés sans configuration manuelle.
            </p>
          </div>
          <button
            type="button"
            disabled={sending}
            onClick={onClose}
            aria-label="Fermer la fenêtre Firebase"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-400/25 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10"
          >
            <X className="w-4 h-4" />
            Fermer
          </button>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-400/15 bg-black/15">
          <button
            type="button"
            onClick={() => setActiveTab('send')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition ${
              activeTab === 'send'
                ? 'border-emerald-400 text-emerald-200'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            Envoyer un export
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stored')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition ${
              activeTab === 'stored'
                ? 'border-cyan-400 text-cyan-200'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            Exports stockés ({storedExports.length})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Authentication Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-400/20 bg-black/25 p-3.5">
            {currentUser ? (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-emerald-100 truncate">
                      Connecté à Firebase : {currentUser.displayName || currentUser.email}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {currentUser.email} · Accès isolé à vos propres jeux de données
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void onSignOutGoogle()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-400/25 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Se déconnecter
                </button>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-amber-200">
                    Connexion Google requise pour lire et écrire dans Firebase
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Aucune clé API ni mot de passe à saisir : connectez votre compte Google en un clic.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onSignInGoogle()}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
                >
                  <LogIn className="w-4 h-4" />
                  Se connecter avec Google
                </button>
              </>
            )}
          </div>

          {activeTab === 'send' ? (
            <>
              {/* Summary grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-slate-400/20 bg-black/20 p-3">
                  <span className="block text-[10.5px] uppercase tracking-wider text-slate-400">
                    Jeu de données (dataset_key)
                  </span>
                  <strong className="block mt-1 text-xs font-mono text-cyan-100 truncate">
                    {datasetKey.trim() || '—'}
                  </strong>
                </div>
                <div className="rounded-xl border border-slate-400/20 bg-black/20 p-3">
                  <span className="block text-[10.5px] uppercase tracking-wider text-slate-400">
                    Fichier source
                  </span>
                  <strong className="block mt-1 text-xs text-cyan-100 truncate">
                    {preflight.fileName}
                  </strong>
                </div>
                <div className="rounded-xl border border-slate-400/20 bg-black/20 p-3">
                  <span className="block text-[10.5px] uppercase tracking-wider text-slate-400">
                    Périmètre prêt à envoyer
                  </span>
                  <strong className="block mt-1 text-xs text-emerald-200 truncate">
                    {pluralize(preflight.hitCount, 'HIT soumis', 'HIT soumis')} ·{' '}
                    {pluralize(preflight.rowCount, 'ligne', 'lignes')}
                  </strong>
                </div>
              </div>

              {/* Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="firebaseDatasetKey"
                    className="block mb-1 text-xs font-bold text-slate-300"
                  >
                    Identifiant du dataset (dataset_key)
                  </label>
                  <input
                    id="firebaseDatasetKey"
                    type="text"
                    value={datasetKey}
                    disabled={sending}
                    onChange={(e) => {
                      setDatasetKey(e.target.value);
                      setConfirmReplace(false);
                    }}
                    placeholder="comparaison_principale"
                    className="w-full rounded-xl border border-slate-400/25 bg-black/30 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  />
                  <span className="block mt-1 text-[10.5px] text-slate-500">
                    Lettres, chiffres, tirets (-) ou underscores (_).
                  </span>
                </div>

                <div>
                  <label className="block mb-1 text-xs font-bold text-slate-300">
                    Mode d’enregistrement
                  </label>
                  <select
                    value={replaceMode ? 'replace' : 'append'}
                    disabled={sending}
                    onChange={(e) => {
                      setReplaceMode(e.target.value === 'replace');
                      setConfirmReplace(false);
                    }}
                    className="w-full rounded-xl border border-slate-400/25 bg-[#06101d] px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="replace">
                      Remplacer l’ancien export du même dataset_key
                    </option>
                    <option value="append">
                      Conserver l’historique (ajouter une nouvelle sauvegarde)
                    </option>
                  </select>
                  <span className="block mt-1 text-[10.5px] text-slate-500">
                    {replaceMode
                      ? 'Les anciens lots du même dataset_key ne sont supprimés qu’après validation complète du nouvel envoi.'
                      : 'Chaque envoi est conservé séparément avec son horodatage.'}
                  </span>
                </div>
              </div>

              {/* Preflight panel */}
              <div
                className={`rounded-xl border p-3.5 ${
                  preflight.valid
                    ? 'border-emerald-400/40 bg-emerald-500/10'
                    : 'border-amber-400/40 bg-amber-500/10'
                }`}
              >
                <div className="text-xs font-bold text-white">
                  {preflight.valid
                    ? `✓ Données vérifiées : ${pluralize(
                        preflight.rowCount,
                        'ligne prête',
                        'lignes prêtes'
                      )} (${Math.max(1, Math.ceil(preflight.rowCount / 100))} lot(s) Firestore).`
                    : 'Vérification préalable avant envoi'}
                </div>

                {preflight.errors.length > 0 && (
                  <ul className="mt-2 pl-4 space-y-1 text-xs text-amber-100 list-disc">
                    {preflight.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Replace confirmation checkbox */}
              {needsReplaceConfirmation && preflight.valid && (
                <label className="flex items-start gap-2.5 rounded-xl border border-amber-400/35 bg-amber-950/25 p-3 text-xs text-amber-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmReplace}
                    disabled={sending}
                    onChange={(e) => setConfirmReplace(e.target.checked)}
                    className="mt-0.5 accent-emerald-400"
                  />
                  <span>
                    Je confirme le remplacement de{' '}
                    <strong>
                      {pluralize(matchingExistingCount, 'export existant', 'exports existants')}
                    </strong>{' '}
                    portant le <code>dataset_key</code> « {datasetKey.trim()} ». Les autres jeux de données ne seront pas touchés.
                  </span>
                </label>
              )}

              {/* Live progress */}
              {progress && (
                <div className="rounded-xl border border-cyan-400/30 bg-black/25 p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5 text-xs text-cyan-100">
                    <span className="inline-flex items-center gap-2">
                      {sending && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" />}
                      {progress.text}
                    </span>
                    <span className="font-mono font-bold">{progress.percent} %</span>
                  </div>
                  <SvgProgressBar
                    percent={progress.percent}
                    fillClass="fill-emerald-400"
                    heightClass="h-2"
                  />
                </div>
              )}

              {/* Error banner */}
              {sendError && (
                <div className="rounded-xl border border-rose-400/45 bg-rose-950/30 p-3.5 text-xs text-rose-100 space-y-1.5">
                  <div className="font-bold">Erreur lors de l’envoi vers Firebase</div>
                  <div>{sendError.message}</div>
                  {sendError.upgradeUrl && (
                    <a
                      href={sendError.upgradeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-cyan-300 underline"
                    >
                      Consulter les limites du plan gratuit Spark Firebase ↗
                    </a>
                  )}
                </div>
              )}

              {/* Success banner */}
              {lastSuccess && !sending && (
                <div className="rounded-xl border border-emerald-400/50 bg-emerald-950/35 p-3.5 text-xs text-emerald-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">
                        Sauvegarde Firebase confirmée ({lastSuccess.datasetKey})
                      </div>
                      <div className="text-emerald-200/90 mt-0.5">
                        {pluralize(lastSuccess.rowCount, 'ligne enregistrée', 'lignes enregistrées')} ·{' '}
                        {pluralize(lastSuccess.hitCount, 'HIT', 'HIT')} · ID{' '}
                        <code>{lastSuccess.exportId}</code>
                        {lastSuccess.replacedCount > 0 &&
                          ` · ${pluralize(
                            lastSuccess.replacedCount,
                            'ancien lot remplacé',
                            'anciens lots remplacés'
                          )}`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('stored')}
                    className="rounded-lg border border-emerald-300/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500/30"
                  >
                    Voir dans la base →
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Tab 2: Stored Exports in Firebase */
            <div className="space-y-3">
              {!currentUser ? (
                <div className="rounded-xl border border-slate-400/20 bg-black/20 p-6 text-center text-xs text-slate-400">
                  Connectez-vous avec votre compte Google ci-dessus pour consulter et télécharger vos exports stockés dans Firebase.
                </div>
              ) : storedExports.length === 0 ? (
                <div className="rounded-xl border border-slate-400/20 bg-black/20 p-6 text-center text-xs text-slate-400">
                  Aucun export n’est encore stocké dans votre base Firebase Firestore. Soumettez au moins un HIT validé puis utilisez l’onglet « Envoyer un export ».
                </div>
              ) : (
                storedExports.map((batch) => {
                  const isPreviewOpen = previewExportId === batch.id;
                  const isBusy = loadingRowsId === batch.id || deletingId === batch.id;

                  return (
                    <div
                      key={batch.id}
                      className="rounded-xl border border-slate-400/25 bg-black/25 overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="text-xs font-extrabold text-cyan-200">
                              {batch.datasetKey}
                            </code>
                            <StatusBadge
                              status={
                                batch.status === 'completed'
                                  ? 'submitted'
                                  : batch.status === 'failed'
                                    ? 'invalid'
                                    : 'pending'
                              }
                              compact
                              customLabel={
                                batch.status === 'completed'
                                  ? '✓ Enregistré'
                                  : batch.status === 'failed'
                                    ? 'Échec'
                                    : 'En cours'
                              }
                            />
                            <span className="text-[11px] text-slate-400">
                              {formatDateFr(batch.createdAtIso)}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-300 truncate">
                            Source : <span className="text-white">{batch.fileName}</span> ·{' '}
                            {pluralize(batch.hitCount, 'HIT', 'HIT')} ·{' '}
                            {pluralize(batch.rowCount, 'ligne', 'lignes')}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleTogglePreview(batch)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-400/25 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
                          >
                            {loadingRowsId === batch.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isPreviewOpen ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                            {isPreviewOpen ? 'Masquer' : 'Aperçu'}
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDownloadStored(batch, 'csv')}
                            className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/35 bg-cyan-500/12 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/22"
                          >
                            <Download className="w-3.5 h-3.5" />
                            CSV
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDownloadStored(batch, 'tsv')}
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-400/35 bg-violet-500/12 px-2.5 py-1.5 text-[11px] font-semibold text-violet-100 hover:bg-violet-500/22"
                          >
                            <Download className="w-3.5 h-3.5" />
                            TSV
                          </button>

                          {confirmDeleteId === batch.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDeleteStored(batch)}
                                className="rounded-lg border border-rose-400/60 bg-rose-600/80 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-rose-500"
                              >
                                {deletingId === batch.id ? 'Suppression…' : 'Confirmer'}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-lg border border-slate-400/25 bg-white/5 px-2 py-1.5 text-[11px] text-slate-300"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteId(batch.id)}
                              className="inline-flex items-center justify-center rounded-lg border border-rose-400/30 bg-rose-500/10 p-1.5 text-rose-200 hover:bg-rose-500/25"
                              title="Supprimer cet export de Firebase"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isPreviewOpen && (
                        <div className="border-t border-slate-400/20 bg-slate-950/60 max-h-64 overflow-auto">
                          <table className="w-full text-left border-collapse text-[11px]">
                            <thead className="sticky top-0 bg-slate-900 text-slate-300 border-b border-slate-400/20">
                              <tr>
                                <th className="px-3 py-2 font-bold">#</th>
                                <th className="px-3 py-2 font-bold">HITId</th>
                                <th className="px-3 py-2 font-bold">ASIN</th>
                                <th className="px-3 py-2 font-bold">WorkerId</th>
                                <th className="px-3 py-2 font-bold">Attribute (Worker)</th>
                                <th className="px-3 py-2 font-bold text-emerald-300">
                                  Attribute.by QA
                                </th>
                                <th className="px-3 py-2 font-bold">Commentaire QA</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-200">
                              {previewRows.slice(0, 100).map((row) => (
                                <tr key={row.id} className="hover:bg-white/5">
                                  <td className="px-3 py-1.5 font-mono text-slate-400">
                                    {row.rowNumber}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono truncate max-w-28">
                                    {row.hitid}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono text-cyan-200">
                                    {row.asin || '—'}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono text-slate-300">
                                    {row.workerId || '—'}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono text-xs">
                                    {row.attribute || '—'}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono font-bold text-emerald-300">
                                    {row.attributeByQa || '—'}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-400 max-w-52 truncate">
                                    {row.qaComment || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {previewRows.length > 100 && (
                            <div className="px-3 py-2 text-[10.5px] text-slate-400 border-t border-white/5">
                              Affichage des 100 premières lignes sur {previewRows.length}. Téléchargez le CSV ou TSV pour récupérer l’intégralité.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-400/20 bg-black/25">
          <span className="text-[11px] text-slate-400">
            Stockage Cloud Firestore gratuit (plan Spark) · Données structurées en collections natives.
          </span>

          <div className="flex items-center gap-2">
            {sending ? (
              <button
                type="button"
                onClick={() => {
                  cancelRef.current = true;
                }}
                className="rounded-xl border border-rose-400/50 bg-rose-600/30 px-3.5 py-2 text-xs font-bold text-rose-100 hover:bg-rose-600/50"
              >
                Annuler l’envoi
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-400/25 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                Fermer
              </button>
            )}

            {activeTab === 'send' && (
              <button
                type="button"
                disabled={!canStartExport}
                onClick={() => void handleStartExport()}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/55 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:brightness-110 transition"
              >
                <CloudUpload className="w-4 h-4" />
                {sending ? 'Envoi en cours…' : 'Confirmer et envoyer vers Firebase'}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
};
