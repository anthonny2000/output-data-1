import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Sparkles,
  Upload,
} from 'lucide-react';
import { AppHeader } from './components/AppHeader';
import { AsinCard } from './components/AsinCard';
import { DashboardTopBar } from './components/DashboardTopBar';
import { FirebaseExportModal } from './components/FirebaseExportModal';
import { HighlightedText, selectElementContents } from './components/HighlightedText';
import { ImageViewerModal } from './components/ImageViewerModal';
import { scoreBandClasses, StatusBadge, SvgProgressBar } from './components/StatusBadge';
import {
  auth,
  googleProvider,
  parseStructuredFirestoreError,
} from './firebase';
import { subscribeToUserExports } from './services/firebaseExportService';
import {
  ConsensusGroup,
  ConsensusModel,
  GroupDecision,
  HitFilterValue,
  ProjectedBBox,
  StoredExportBatch,
  SubmittedHitLogEntry,
  SubmittedHitState,
  ViewerImageItem,
} from './types/consensus';
import {
  ASIN_PATTERN,
  asText,
  buildDemoCsvSample,
  buildExportPackage,
  buildProductUrl,
  calculateDashboardStats,
  createModel,
  formatPercent,
  getConsensusOptions,
  getExportableHitIds,
  getGroupStatus,
  pluralize,
  prepareImportFile,
  projectBBoxToImage,
  serializeDelimited,
  validHttpUrl,
} from './utils/consensusEngine';

function parsePriorityHitIds(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  asText(value)
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .forEach((id) => {
      if (id && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    });
  return result;
}

function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => resolve(asText(reader.result));
    reader.readAsText(file, 'UTF-8');
  });
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export default function App() {
  // Firebase Auth & stored exports state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [storedExports, setStoredExports] = useState<StoredExportBatch[]>([]);
  const [firebaseModalOpen, setFirebaseModalOpen] = useState(false);
  const [firebaseModalTab, setFirebaseModalTab] = useState<'send' | 'stored'>('send');
  const [firebaseExporting, setFirebaseExporting] = useState(false);

  // Consensus application state
  const [model, setModel] = useState<ConsensusModel | null>(null);
  const [decisions, setDecisions] = useState<Map<string, GroupDecision>>(() => new Map());
  const [drafts, setDrafts] = useState<Map<string, string>>(() => new Map());
  const [comments, setComments] = useState<Map<string, string>>(() => new Map());
  const [submittedHitLog, setSubmittedHitLog] = useState<SubmittedHitLogEntry[]>([]);
  const [submittedHitStates, setSubmittedHitStates] = useState<Map<string, SubmittedHitState>>(
    () => new Map()
  );

  const [activeHitId, setActiveHitId] = useState<string | null>(null);
  const [hitFilter, setHitFilter] = useState<HitFilterValue>('all');
  const [hitQuery, setHitQuery] = useState('');
  const [priorityHitIds, setPriorityHitIds] = useState<string[]>([]);
  const [priorityAnchorIndex, setPriorityAnchorIndex] = useState<number | null>(null);
  const [autoAccept, setAutoAccept] = useState(false);
  const [hitListCollapsed, setHitListCollapsed] = useState(true);
  const [productTitleSearch, setProductTitleSearch] = useState('');

  // Import & UI feedback state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ text: string; percent: number } | null>(
    null
  );
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);
  const [targetedGroupKey, setTargetedGroupKey] = useState<string | null>(null);

  // Main HIT image & BBox projection state
  const [mainImageError, setMainImageError] = useState(false);
  const [projectedBbox, setProjectedBbox] = useState<ProjectedBBox | null>(null);

  // Multi-image zoom & comparison viewer state
  const [viewerItems, setViewerItems] = useState<ViewerImageItem[]>([]);
  const [activeViewerId, setActiveViewerId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 4800);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore real-time listener (only when auth is ready & user is signed in)
  useEffect(() => {
    if (!authReady || !currentUser) {
      setStoredExports([]);
      return;
    }
    const unsubscribe = subscribeToUserExports(
      currentUser.uid,
      (batches) => {
        setStoredExports(batches);
      },
      (err) => {
        const parsed = parseStructuredFirestoreError(err);
        showToast(`Erreur lecture Firebase : ${parsed.userMessage}`, true);
      }
    );
    return () => unsubscribe();
  }, [authReady, currentUser, showToast]);

  const handleSignInGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Connecté à Firebase avec Google.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('auth/popup-closed-by-user')) {
        return;
      }
      showToast(`Connexion Google interrompue : ${msg}`, true);
    }
  }, [showToast]);

  const handleSignOutGoogle = useCallback(async () => {
    if (firebaseExporting) return;
    try {
      await signOut(auth);
      showToast('Déconnecté de Firebase.');
    } catch (error) {
      showToast(
        `Déconnexion impossible : ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  }, [firebaseExporting, showToast]);

  const applyImportedModel = useCallback(
    (newModel: ConsensusModel, toastText?: string) => {
      setModel(newModel);
      setDecisions(new Map());
      setDrafts(new Map());
      setComments(new Map());
      setSubmittedHitLog([]);
      setSubmittedHitStates(new Map());
      setHitFilter('all');
      setHitQuery('');
      setPriorityHitIds([]);
      setPriorityAnchorIndex(null);
      setAutoAccept(false);
      setHitListCollapsed(true);
      setProductTitleSearch('');
      setActiveHitId(newModel.hitOrder.length ? newModel.hitOrder[0] : null);

      const validFiles = newModel.fileReports.filter((r) => r.valid).length;
      if (!newModel.sourceRows.length) {
        showToast('Aucune ligne exploitable : vérifiez les colonnes obligatoires du fichier.', true);
      } else {
        showToast(
          toastText ||
            `${pluralize(
              validFiles,
              'fichier valide traité',
              'fichiers valides traités'
            )} — les suggestions restent non validées.`
        );
      }
    },
    [showToast]
  );

  const importFiles = useCallback(
    async (fileList: FileList | File[] | null | undefined) => {
      const files = Array.from(fileList || []);
      if (!files.length || importing || firebaseExporting) return;

      setImporting(true);
      setImportProgress({ text: 'Préparation de l’import…', percent: 4 });

      try {
        const prepared = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setImportProgress({
            text: `Lecture de ${file.name} (${i + 1} / ${files.length})…`,
            percent: Math.round(10 + (i / files.length) * 55),
          });
          await nextPaint();
          const text = await readFileAsText(file);
          prepared.push(prepareImportFile(file.name, text));
        }

        setImportProgress({
          text: 'Décomposition JSON, regroupement des workers et calcul des votes…',
          percent: 76,
        });
        await nextPaint();
        const newModel = createModel(prepared);

        setImportProgress({ text: 'Préparation de l’interface…', percent: 94 });
        await nextPaint();
        applyImportedModel(newModel);
      } catch (error) {
        showToast(
          `Échec de l’import : ${error instanceof Error ? error.message : 'erreur inconnue'}.`,
          true
        );
      } finally {
        setImporting(false);
        setImportProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [importing, firebaseExporting, applyImportedModel, showToast]
  );

  const handleLoadDemoSample = useCallback(() => {
    const csv = buildDemoCsvSample();
    const prepared = [prepareImportFile('exemple_consensus_qa.csv', csv)];
    const demoModel = createModel(prepared);
    applyImportedModel(
      demoModel,
      'Exemple chargé (2 HIT, 3 produits) : validez les ASIN puis soumettez un HIT pour tester l’export Firebase.'
    );
  }, [applyImportedModel]);

  // Reset main image error & bbox when active HIT changes
  useEffect(() => {
    setMainImageError(false);
    setProjectedBbox(null);
  }, [activeHitId, model]);

  // Derived HIT lists & stats
  const priorityPresent = useMemo(() => {
    if (!model) return [];
    return priorityHitIds.filter((id) => model.hits.has(id));
  }, [model, priorityHitIds]);

  const missingPriorityCount = useMemo(() => {
    if (!model) return 0;
    return priorityHitIds.filter((id) => !model.hits.has(id)).length;
  }, [model, priorityHitIds]);

  const filteredHitIds = useMemo(() => {
    if (!model) return [];
    if (priorityHitIds.length > 0) return priorityPresent;
    return model.hitOrder.filter((hitId) => {
      const hit = model.hits.get(hitId);
      if (!hit) return false;
      const groups = hit.groupKeys
        .map((k) => model.groups.get(k))
        .filter((g): g is ConsensusGroup => Boolean(g));
      if (hitFilter === 'pending') {
        return groups.some((g) => getGroupStatus(g, decisions) === 'pending');
      }
      if (hitFilter === 'review') {
        return groups.some((g) => getGroupStatus(g, decisions) === 'review');
      }
      if (hitFilter === 'tie') {
        return groups.some((g) => g.isTie);
      }
      return true;
    });
  }, [model, priorityHitIds.length, priorityPresent, hitFilter, decisions]);

  const canKeepRemovedPriorityHit = useMemo(() => {
    return Boolean(
      model &&
        priorityHitIds.length > 0 &&
        activeHitId &&
        model.hits.has(activeHitId) &&
        !priorityHitIds.includes(activeHitId) &&
        priorityAnchorIndex !== null
    );
  }, [model, priorityHitIds, activeHitId, priorityAnchorIndex]);

  const effectiveActiveHitId = useMemo(() => {
    if (!model) return null;
    if (activeHitId && (filteredHitIds.includes(activeHitId) || canKeepRemovedPriorityHit)) {
      return activeHitId;
    }
    return filteredHitIds[0] || null;
  }, [model, activeHitId, filteredHitIds, canKeepRemovedPriorityHit]);

  const activeHit = useMemo(
    () => (model && effectiveActiveHitId ? model.hits.get(effectiveActiveHitId) || null : null),
    [model, effectiveActiveHitId]
  );

  const exportableHitIds = useMemo(
    () => getExportableHitIds(model, decisions, submittedHitStates),
    [model, decisions, submittedHitStates]
  );

  const stats = useMemo(
    () =>
      model
        ? calculateDashboardStats(model, decisions)
        : {
            hitCount: 0,
            uniqueAsinCount: 0,
            groupCount: 0,
            validatedCount: 0,
            pendingCount: 0,
            reviewCount: 0,
            tieCount: 0,
            validationRate: 0,
            meanAgreement: null,
          },
    [model, decisions]
  );

  const getNavigationTarget = useCallback(
    (direction: 'prev' | 'next'): string | null => {
      if (!effectiveActiveHitId) return null;
      let idx = filteredHitIds.indexOf(effectiveActiveHitId);
      if (idx === -1 && priorityHitIds.length > 0 && priorityAnchorIndex !== null) {
        idx = direction === 'next' ? priorityAnchorIndex - 1 : priorityAnchorIndex;
      }
      const targetIdx = direction === 'next' ? idx + 1 : idx - 1;
      return targetIdx >= 0 && targetIdx < filteredHitIds.length
        ? filteredHitIds[targetIdx]
        : null;
    },
    [effectiveActiveHitId, filteredHitIds, priorityHitIds.length, priorityAnchorIndex]
  );

  const handleSelectHit = useCallback(
    (hitId: string) => {
      if (!model || !model.hits.has(hitId)) return;
      setActiveHitId(hitId);
      if (priorityHitIds.length > 0) {
        const pIdx = priorityHitIds.indexOf(hitId);
        setPriorityAnchorIndex(pIdx === -1 ? null : pIdx);
      }
    },
    [model, priorityHitIds]
  );

  const handleChangeHitQuery = useCallback((value: string) => {
    setHitQuery(value);
    setPriorityHitIds(parsePriorityHitIds(value));
    setPriorityAnchorIndex(null);
  }, []);

  // Finalization plan for active HIT
  const finalizationPlan = useMemo(() => {
    if (!model || !activeHit) {
      return {
        ready: false,
        total: 0,
        resolved: 0,
        remaining: 0,
        draftEntries: [] as Array<{ groupKey: string; group: ConsensusGroup; signature: string }>,
        unresolvedGroups: [] as ConsensusGroup[],
        majorityCandidates: [] as ConsensusGroup[],
        alreadySubmitted: false,
        stale: false,
      };
    }

    const draftEntries: Array<{ groupKey: string; group: ConsensusGroup; signature: string }> = [];
    const unresolvedGroups: ConsensusGroup[] = [];
    const majorityCandidates: ConsensusGroup[] = [];
    let resolved = 0;

    activeHit.groupKeys.forEach((groupKey) => {
      const group = model.groups.get(groupKey);
      if (!group) return;
      const signature = drafts.get(groupKey);
      const allowed =
        Boolean(signature) &&
        getConsensusOptions(group).some((opt) => opt.value === signature);
      const decision = decisions.get(groupKey);
      const isNewDraft =
        allowed &&
        Boolean(signature) &&
        (!decision || decision.status !== 'validated' || decision.signature !== signature);

      if (isNewDraft && signature) {
        draftEntries.push({ groupKey, group, signature });
        resolved++;
      } else if (getGroupStatus(group, decisions) === 'validated') {
        resolved++;
      } else {
        unresolvedGroups.push(group);
        if (
          getGroupStatus(group, decisions) === 'pending' &&
          Boolean(group.majoritySuggestion) &&
          !group.isTie &&
          group.validVoteCount > 0
        ) {
          majorityCandidates.push(group);
        }
      }
    });

    const submitted = submittedHitStates.get(activeHit.HITId);
    return {
      ready: activeHit.groupKeys.length > 0 && resolved === activeHit.groupKeys.length,
      total: activeHit.groupKeys.length,
      resolved,
      remaining: unresolvedGroups.length,
      draftEntries,
      unresolvedGroups,
      majorityCandidates,
      alreadySubmitted: Boolean(submitted && !submitted.stale),
      stale: Boolean(submitted && submitted.stale),
    };
  }, [model, activeHit, drafts, decisions, submittedHitStates]);

  const scrollToAsinGroup = useCallback((groupKey: string) => {
    const el = document.getElementById(`asin-card-${encodeURIComponent(groupKey)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTargetedGroupKey(groupKey);
      window.setTimeout(() => {
        setTargetedGroupKey((prev) => (prev === groupKey ? null : prev));
      }, 1500);
    }
  }, []);

  const handleSaveDraft = useCallback(
    (groupKey: string, signature: string) => {
      if (!model) return;
      const group = model.groups.get(groupKey);
      if (!group) return;
      const decision = decisions.get(groupKey);

      if (!signature) {
        setDrafts((prev) => {
          const next = new Map(prev);
          next.delete(groupKey);
          return next;
        });
        return;
      }

      const allowed = getConsensusOptions(group).some((opt) => opt.value === signature);
      if (!allowed) {
        showToast('Cette réponse ne fait pas partie des attributs disponibles pour ce groupe.', true);
        return;
      }

      setDrafts((prev) => {
        const next = new Map(prev);
        if (decision && decision.status === 'validated' && decision.signature === signature) {
          next.delete(groupKey);
        } else {
          next.set(groupKey, signature);
        }
        return next;
      });
    },
    [model, decisions, showToast]
  );

  const handleSaveComment = useCallback(
    (groupKey: string, value: string) => {
      if (!model) return;
      const group = model.groups.get(groupKey);
      if (!group) return;

      setComments((prev) => {
        const next = new Map(prev);
        if (value.trim()) next.set(groupKey, value);
        else next.delete(groupKey);
        return next;
      });

      setDecisions((prev) => {
        if (!prev.has(groupKey)) return prev;
        const next = new Map(prev);
        const existing = next.get(groupKey)!;
        next.set(groupKey, {
          ...existing,
          comment: value.trim() ? value : '',
          commentChangedAt: new Date().toISOString(),
        });
        return next;
      });

      setSubmittedHitStates((prev) => {
        const sub = prev.get(group.HITId);
        if (!sub || sub.stale) return prev;
        const next = new Map(prev);
        next.set(group.HITId, {
          ...sub,
          stale: true,
          changedAt: new Date().toISOString(),
        });
        return next;
      });
    },
    [model]
  );

  const handleMarkReview = useCallback(
    (groupKey: string) => {
      if (!model) return;
      const group = model.groups.get(groupKey);
      if (!group) return;

      setDecisions((prev) => {
        const next = new Map(prev);
        const old = next.get(groupKey);
        next.set(groupKey, {
          groupKey,
          signature: '',
          status: 'review',
          comment: asText(comments.get(groupKey)),
          validationRevision: old ? old.validationRevision + 1 : 1,
          decisionChangedAt: new Date().toISOString(),
        });
        return next;
      });

      setDrafts((prev) => {
        const next = new Map(prev);
        next.delete(groupKey);
        return next;
      });

      setSubmittedHitStates((prev) => {
        const sub = prev.get(group.HITId);
        if (!sub || sub.stale) return prev;
        const next = new Map(prev);
        next.set(group.HITId, { ...sub, stale: true, changedAt: new Date().toISOString() });
        return next;
      });

      showToast(
        `Le groupe ${group.ASIN} est marqué « À revoir » : aucun consensus ne sera exporté tant qu’il n’est pas validé.`
      );
    },
    [model, comments, showToast]
  );

  const handleUseMajoritySuggestions = useCallback(() => {
    if (!finalizationPlan.majorityCandidates.length) {
      showToast('Aucune réponse majoritaire ne peut être reprise pour les ASIN sans choix.', true);
      return;
    }
    setDrafts((prev) => {
      const next = new Map(prev);
      finalizationPlan.majorityCandidates.forEach((group) => {
        if (group.majoritySuggestion) {
          next.set(group.key, group.majoritySuggestion);
        }
      });
      return next;
    });
    showToast(
      `${pluralize(
        finalizationPlan.majorityCandidates.length,
        'réponse majoritaire reprise',
        'réponses majoritaires reprises'
      )}. Vérifiez-les puis cliquez sur « Soumettre le HIT ».`
    );
  }, [finalizationPlan.majorityCandidates, showToast]);

  const handleFinalizeActiveHit = useCallback(() => {
    if (!model || !activeHit) return;
    const hitId = activeHit.HITId;

    if (!finalizationPlan.ready) {
      const firstUnresolved = finalizationPlan.unresolvedGroups[0];
      if (firstUnresolved) {
        scrollToAsinGroup(firstUnresolved.key);
      }
      showToast(
        `Soumission bloquée : ${pluralize(
          finalizationPlan.remaining,
          'ASIN reste à traiter',
          'ASIN restent à traiter'
        )}.`,
        true
      );
      return;
    }

    if (finalizationPlan.alreadySubmitted && !finalizationPlan.draftEntries.length) {
      showToast('Ce HIT est déjà soumis et à jour.');
      return;
    }

    const now = new Date().toISOString();
    const nextDecisions = new Map(decisions);
    const nextDrafts = new Map(drafts);

    finalizationPlan.draftEntries.forEach((entry) => {
      const old = nextDecisions.get(entry.groupKey);
      nextDecisions.set(entry.groupKey, {
        groupKey: entry.groupKey,
        signature: entry.signature,
        status: 'validated',
        comment: asText(comments.get(entry.groupKey)),
        validationRevision: old ? old.validationRevision + 1 : 1,
        decisionChangedAt: now,
      });
      nextDrafts.delete(entry.groupKey);
    });

    const qaCommentsSnap = activeHit.groupKeys
      .map((gk) => {
        const g = model.groups.get(gk);
        return {
          groupKey: gk,
          ASIN: g ? g.ASIN : '',
          comment: asText(comments.get(gk)),
        };
      })
      .filter((c) => Boolean(c.comment.trim()));

    const prevSub = submittedHitStates.get(hitId);
    const revision = prevSub ? prevSub.revision + 1 : 1;
    const entryId = `submitted:${hitId}:${now}:${submittedHitLog.length}`;
    const logEntry: SubmittedHitLogEntry = {
      id: entryId,
      HITId: hitId,
      submittedAt: now,
      total: activeHit.groupKeys.length,
      validated: activeHit.groupKeys.length,
      qaComments: qaCommentsSnap,
      revision,
    };

    const nextSubStates = new Map(submittedHitStates);
    nextSubStates.set(hitId, {
      HITId: hitId,
      lastEntryId: entryId,
      revision,
      stale: false,
      submittedAt: now,
    });

    setDecisions(nextDecisions);
    setDrafts(nextDrafts);
    setSubmittedHitLog((prev) => [logEntry, ...prev]);
    setSubmittedHitStates(nextSubStates);

    const orderSource = priorityHitIds.length > 0 ? priorityPresent : model.hitOrder;
    const currentOrderIdx = orderSource.indexOf(hitId);
    const nextHitAfter =
      currentOrderIdx >= 0 && currentOrderIdx + 1 < orderSource.length
        ? orderSource[currentOrderIdx + 1]
        : null;

    const listedInPriority = priorityHitIds.includes(hitId);
    if (listedInPriority) {
      const visibleIdx = priorityPresent.indexOf(hitId);
      const updatedPriority = priorityHitIds.filter((id) => id !== hitId);
      setPriorityHitIds(updatedPriority);
      setPriorityAnchorIndex(visibleIdx === -1 ? null : visibleIdx);
      setHitQuery(updatedPriority.join('\n'));
    }

    const willAdvance = autoAccept && Boolean(nextHitAfter);
    if (willAdvance && nextHitAfter) {
      if (!listedInPriority) {
        setHitFilter('all');
        setHitQuery('');
      }
      setActiveHitId(nextHitAfter);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const draftCount = finalizationPlan.draftEntries.length;
    let msg = draftCount
      ? `${pluralize(draftCount, 'choix enregistré', 'choix enregistrés')}, puis HIT soumis.`
      : 'HIT soumis et prêt pour l’export.';
    if (willAdvance) msg += ' Passage au HIT suivant.';
    showToast(msg);
  }, [
    model,
    activeHit,
    finalizationPlan,
    decisions,
    drafts,
    comments,
    submittedHitStates,
    submittedHitLog.length,
    priorityHitIds,
    priorityPresent,
    autoAccept,
    scrollToAsinGroup,
    showToast,
  ]);

  const handleRemoveSubmittedHit = useCallback(
    (hitId: string) => {
      setSubmittedHitStates((prev) => {
        const next = new Map(prev);
        next.delete(hitId);
        return next;
      });
      setSubmittedHitLog((prev) => prev.filter((e) => e.HITId !== hitId));
      showToast(
        'HIT retiré des soumis : ses décisions QA sont conservées, mais il est exclu de l’export jusqu’à une nouvelle soumission.'
      );
    },
    [showToast]
  );

  const handleJumpToSubmittedHit = useCallback(
    (hitId: string) => {
      setHitFilter('all');
      setHitQuery('');
      setPriorityHitIds([]);
      setPriorityAnchorIndex(null);
      setActiveHitId(hitId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const handleDownloadLocalExport = useCallback(
    (format: 'csv' | 'tsv') => {
      if (!model) return;
      const pack = buildExportPackage(model, decisions, submittedHitStates);
      if (!pack.exportableHitIds.length) {
        showToast('Aucun HIT soumis et à jour : aucun export n’a été créé.', true);
        return;
      }
      const delimiter = format === 'tsv' ? '\t' : ',';
      const content = serializeDelimited(pack.headers, pack.rows, delimiter);
      const mime =
        format === 'tsv'
          ? 'text/tab-separated-values;charset=utf-8'
          : 'text/csv;charset=utf-8';
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `worker_consensus_export.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      showToast(
        `Export ${format.toUpperCase()} créé : ${pluralize(
          pack.rows.length,
          'ligne',
          'lignes'
        )} provenant de ${pluralize(pack.exportableHitIds.length, 'HIT soumis', 'HIT soumis')}.`
      );
    },
    [model, decisions, submittedHitStates, showToast]
  );

  const handleCopyToClipboard = useCallback(async () => {
    if (!model) return;
    const pack = buildExportPackage(model, decisions, submittedHitStates);
    if (!pack.exportableHitIds.length) {
      showToast('Aucun HIT soumis et à jour : aucune copie n’a été créée.', true);
      return;
    }
    const content = serializeDelimited(pack.headers, pack.rows, '\t');
    try {
      await navigator.clipboard.writeText(content);
      showToast(
        `Export TSV copié dans le presse-papiers avec les en-têtes : ${pluralize(
          pack.rows.length,
          'ligne',
          'lignes'
        )}.`
      );
    } catch {
      showToast(
        'Copie directe indisponible dans ce navigateur. Utilisez Exporter puis choisissez TSV.',
        true
      );
    }
  }, [model, decisions, submittedHitStates, showToast]);

  const handleOpenViewerImage = useCallback((item: ViewerImageItem) => {
    setViewerItems((prev) => {
      const exists = prev.some((p) => p.id === item.id);
      if (exists) return prev;
      return [...prev, item];
    });
    setActiveViewerId(item.id);
  }, []);

  const handleCloseViewerItem = useCallback((id: string) => {
    setViewerItems((prev) => {
      const remaining = prev.filter((item) => item.id !== id);
      setActiveViewerId((curr) =>
        curr === id ? (remaining[remaining.length - 1]?.id ?? null) : curr
      );
      return remaining;
    });
  }, []);

  // Main HIT image metadata
  const mainSource = activeHit?.primaryContext || null;
  const queryAsin = mainSource ? asText(mainSource.inputQueryProductAsin).trim() : '';
  const rawQueryTitle = mainSource ? asText(mainSource.inputQueryProductTitle).trim() : '';
  const queryTitle =
    rawQueryTitle && rawQueryTitle.toLowerCase() !== 'null' ? rawQueryTitle : '';
  const validQueryAsin = ASIN_PATTERN.test(queryAsin) ? queryAsin : '';
  const mainContentUrl =
    mainSource && validQueryAsin
      ? buildProductUrl(mainSource.marketplace, validQueryAsin)
      : '';

  const prevHitId = getNavigationTarget('prev');
  const nextHitId = getNavigationTarget('next');
  const activeIndexInFiltered = effectiveActiveHitId
    ? filteredHitIds.indexOf(effectiveActiveHitId)
    : -1;

  return (
    <div className="min-h-screen flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        multiple
        onChange={(e) => void importFiles(e.target.files)}
        className="sr-only"
      />

      <AppHeader
        hasModel={Boolean(model)}
        importing={importing}
        firebaseExporting={firebaseExporting}
        exportableHitCount={exportableHitIds.length}
        storedExportsCount={storedExports.length}
        currentUser={currentUser}
        authReady={authReady}
        onTriggerFileSelect={() => fileInputRef.current?.click()}
        onExportLocal={handleDownloadLocalExport}
        onCopyToClipboard={() => void handleCopyToClipboard()}
        onOpenFirebaseModal={(tab) => {
          setFirebaseModalTab(tab);
          setFirebaseModalOpen(true);
        }}
        onSignInGoogle={() => void handleSignInGoogle()}
        onSignOutGoogle={() => void handleSignOutGoogle()}
      />

      <main className="w-full max-w-[1600px] mx-auto flex-1 px-4 sm:px-8 pt-6 pb-32">
        {/* Import progress bar */}
        {importProgress && (
          <section aria-live="polite" className="mb-5">
            <div className="flex justify-between gap-3 mb-1.5 text-xs text-slate-300">
              <span>{importProgress.text}</span>
              <span className="font-mono font-bold">{importProgress.percent} %</span>
            </div>
            <SvgProgressBar
              percent={importProgress.percent}
              fillClass="fill-cyan-400"
              heightClass="h-2"
            />
          </section>
        )}

        {!model ? (
          /* Empty State */
          <section
            aria-labelledby="emptyTitle"
            className="max-w-3xl mx-auto mt-10 rounded-3xl border border-slate-400/20 bg-gradient-to-br from-[#19304b]/75 to-[#0a1727]/85 p-7 sm:p-12 text-center shadow-2xl"
          >
            <div className="grid place-items-center w-14 h-14 mx-auto mb-4 rounded-2xl border border-cyan-400/45 bg-cyan-500/12 text-cyan-200 shadow-lg shadow-cyan-500/15">
              <FileSpreadsheet className="w-7 h-7" />
            </div>

            <h2
              id="emptyTitle"
              className="m-0 text-2xl sm:text-3xl font-extrabold tracking-tight text-white"
            >
              Commencer par un fichier de résultats
            </h2>

            <p className="max-w-xl mx-auto mt-3 mb-6 text-sm text-slate-300 leading-relaxed">
              Importez vos fichiers CSV ou TSV pour analyser les votes workers, valider manuellement le consensus QA, puis sauvegarder vos données exportées vers votre base gratuite{' '}
              <strong className="text-emerald-300">Firebase Cloud Firestore</strong>.
            </p>

            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void importFiles(e.dataTransfer?.files);
              }}
              className={`grid place-items-center min-h-40 p-6 rounded-2xl border-2 border-dashed transition ${
                dragOver
                  ? 'border-cyan-400 bg-cyan-500/15 shadow-lg shadow-cyan-500/15'
                  : 'border-cyan-400/45 bg-black/15 hover:border-cyan-300/75 hover:bg-cyan-500/8'
              }`}
            >
              <div className="text-sm text-slate-300">
                <strong className="text-white">Déposez vos fichiers CSV / TSV ici</strong>
                <br />
                <span className="text-xs text-slate-400">
                  ou cliquez pour choisir un ou plusieurs fichiers à importer
                </span>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-400/55 bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md">
                <Upload className="w-4 h-4" />
                Choisir les fichiers
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleLoadDemoSample}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/15 px-3.5 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/25 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                Charger un jeu d’exemple pour tester
              </button>

              <button
                type="button"
                onClick={() => {
                  setFirebaseModalTab('stored');
                  setFirebaseModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/12 px-3.5 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/22 transition"
              >
                <Database className="w-3.5 h-3.5 text-emerald-300" />
                Consulter les exports Firebase ({storedExports.length})
              </button>
            </div>
          </section>
        ) : (
          /* Active Dashboard */
          <section aria-label="Tableau de bord de consensus">
            <DashboardTopBar
              model={model}
              decisions={decisions}
              submittedHitLog={submittedHitLog}
              submittedHitStates={submittedHitStates}
              activeHitId={effectiveActiveHitId}
              filteredHitIds={filteredHitIds}
              priorityHitIds={priorityHitIds}
              missingPriorityCount={missingPriorityCount}
              hitQuery={hitQuery}
              hitFilter={hitFilter}
              autoAccept={autoAccept}
              hitListCollapsed={hitListCollapsed}
              productTitleSearch={productTitleSearch}
              stats={stats}
              exportableHitCount={exportableHitIds.length}
              onSelectHit={handleSelectHit}
              onChangeHitQuery={handleChangeHitQuery}
              onChangeHitFilter={setHitFilter}
              onToggleAutoAccept={setAutoAccept}
              onToggleHitList={() => setHitListCollapsed((v) => !v)}
              onChangeProductTitleSearch={setProductTitleSearch}
              onJumpToSubmittedHit={handleJumpToSubmittedHit}
              onRemoveSubmittedHit={handleRemoveSubmittedHit}
            />

            {!activeHit ? (
              <div className="rounded-2xl border border-slate-400/20 bg-slate-900/60 p-8 text-center">
                <h2 className="m-0 text-lg font-bold text-white">Aucun HIT visible</h2>
                <p className="m-0 mt-1.5 text-xs text-slate-400">
                  {priorityHitIds.length > 0
                    ? 'Aucun HIT de la liste prioritaire n’est présent dans le fichier.'
                    : 'Modifiez la recherche ou le filtre pour afficher des HIT.'}
                </p>
              </div>
            ) : (
              <div>
                {/* HIT Navigation Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h2
                      onClick={(e) => selectElementContents(e.currentTarget)}
                      title="Cliquer pour sélectionner le HITId"
                      className="m-0 text-lg sm:text-2xl font-extrabold tracking-tight text-white truncate cursor-text select-all"
                    >
                      {activeHit.HITId}
                    </h2>
                    <p className="m-0 mt-1 text-xs text-slate-400">
                      {priorityHitIds.length > 0
                        ? activeIndexInFiltered >= 0
                          ? `${activeIndexInFiltered + 1} sur ${filteredHitIds.length} dans la liste prioritaire`
                          : 'HIT soumis, retiré de la liste prioritaire'
                        : `${activeIndexInFiltered + 1} sur ${filteredHitIds.length} dans la vue courante`}{' '}
                      ·{' '}
                      {!finalizationPlan.ready
                        ? pluralize(
                            finalizationPlan.remaining,
                            'ASIN reste à traiter',
                            'ASIN restent à traiter'
                          )
                        : finalizationPlan.alreadySubmitted &&
                            !finalizationPlan.draftEntries.length
                          ? 'HIT soumis dans cette session.'
                          : finalizationPlan.draftEntries.length
                            ? pluralize(
                                finalizationPlan.draftEntries.length,
                                'choix préparé sera validé à la soumission',
                                'choix préparés seront validés à la soumission'
                              )
                            : 'Toutes les réponses sont validées.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={!prevHitId}
                      onClick={() => prevHitId && handleSelectHit(prevHitId)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-400/25 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Précédent
                    </button>
                    <button
                      type="button"
                      disabled={!nextHitId}
                      onClick={() => nextHitId && handleSelectHit(nextHitId)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-400/25 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
                    >
                      Suivant
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* HIT Overview: Main Query Image + ASIN Score Jump Panel */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
                  {/* Main Image Card */}
                  <article className="lg:col-span-5 rounded-2xl border border-slate-400/20 bg-gradient-to-br from-[#19304b]/75 to-[#0a1727]/85 p-4 shadow-xl">
                    <div className="mb-3">
                      <h3 className="m-0 grid gap-1 text-sm font-bold">
                        {mainContentUrl ? (
                          <a
                            href={mainContentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-100 underline underline-offset-2"
                          >
                            {validQueryAsin}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span
                            onClick={(e) => selectElementContents(e.currentTarget)}
                            className="text-white cursor-text select-all"
                          >
                            {validQueryAsin || 'Image principale'}
                          </span>
                        )}

                        {queryTitle && (
                          <span className="text-xs font-medium text-slate-200 line-clamp-2">
                            <HighlightedText
                              text={queryTitle}
                              searchQuery={productTitleSearch}
                              selectable
                              title="Cliquer pour sélectionner le titre requête"
                            />
                          </span>
                        )}
                      </h3>
                    </div>

                    <div className="grid place-items-center min-h-56 rounded-xl border border-white/10 bg-[#030914] overflow-hidden p-2">
                      {!mainSource ||
                      !mainSource.mainImageUrl ||
                      !validHttpUrl(mainSource.mainImageUrl) ||
                      mainImageError ? (
                        <div className="p-6 text-xs text-slate-400 text-center leading-relaxed">
                          Image principale indisponible ou non chargeable. Les données de consensus restent disponibles.
                        </div>
                      ) : (
                        <div className="relative inline-block max-w-full leading-none">
                          <img
                            src={mainSource.mainImageUrl}
                            alt={`Image principale du HIT ${activeHit.HITId}`}
                            onError={() => setMainImageError(true)}
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              const proj = projectBBoxToImage(
                                mainSource.bbox,
                                img.naturalWidth,
                                img.naturalHeight
                              );
                              setProjectedBbox(proj.valid ? proj : null);
                            }}
                            onClick={() =>
                              handleOpenViewerImage({
                                id: `main:${activeHit.HITId}`,
                                src: mainSource.mainImageUrl,
                                alt: `Image principale ${activeHit.HITId}`,
                                title: `HIT ${activeHit.HITId} (Image requête)`,
                                subtitle: queryTitle || validQueryAsin || undefined,
                              })
                            }
                            className="block max-w-full max-h-[460px] h-auto object-contain cursor-zoom-in"
                            title="Cliquer pour agrandir dans la visionneuse"
                          />
                          {projectedBbox?.valid &&
                            projectedBbox.viewBox &&
                            projectedBbox.x !== undefined &&
                            projectedBbox.y !== undefined &&
                            projectedBbox.width !== undefined &&
                            projectedBbox.height !== undefined && (
                              <svg
                                viewBox={projectedBbox.viewBox}
                                aria-label="Bounding box"
                                className="absolute inset-0 w-full h-full pointer-events-none"
                              >
                                <rect
                                  x={projectedBbox.x}
                                  y={projectedBbox.y}
                                  width={projectedBbox.width}
                                  height={projectedBbox.height}
                                  vectorEffect="non-scaling-stroke"
                                  className="fill-rose-500/12 stroke-rose-400 stroke-[3.5]"
                                />
                              </svg>
                            )}
                        </div>
                      )}
                    </div>
                  </article>

                  {/* ASIN Score Jump Card */}
                  <article className="lg:col-span-7 rounded-2xl border border-slate-400/20 bg-gradient-to-br from-[#19304b]/75 to-[#0a1727]/85 p-4 shadow-xl">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="m-0 text-sm font-bold text-white">ASIN · score d’accord</h3>
                      <span className="text-[11px] text-slate-400">
                        ASIN : fiche produit · score : atteindre la carte
                      </span>
                    </div>

                    <div className="grid gap-2 max-h-[430px] overflow-y-auto pr-1">
                      {activeHit.groupKeys.map((gk) => {
                        const group = model.groups.get(gk);
                        if (!group) return null;
                        const status = getGroupStatus(group, decisions);
                        const ratio = group.validVoteCount
                          ? Math.round(group.agreementRate || 0)
                          : 0;
                        const maxVotes = group.voteDistribution.size
                          ? Math.max(...Array.from(group.voteDistribution.values()))
                          : 0;
                        const voteText = group.validVoteCount
                          ? `${group.isTie ? 'Égalité · ' : ''}${maxVotes}/${group.validVoteCount} votes critère`
                          : 'Aucun vote exploitable';
                        const rateText = group.validVoteCount
                          ? formatPercent(group.agreementRate)
                          : '—';
                        const band = scoreBandClasses(
                          group.validVoteCount ? group.agreementRate : null
                        );
                        const prod = group.primaryProduct;
                        const prodTitle = prod?.productTitle || 'Titre produit indisponible';
                        const hasUrl = Boolean(prod?.productUrl && validHttpUrl(prod.productUrl));

                        return (
                          <div
                            key={group.key}
                            className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(160px,0.8fr)] gap-2.5 items-stretch rounded-xl border border-white/10 bg-black/20 p-2.5 hover:border-cyan-400/35 transition"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {hasUrl && prod ? (
                                <a
                                  href={prod.productUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs font-extrabold text-cyan-300 underline underline-offset-2 hover:text-cyan-100 shrink-0"
                                >
                                  {group.ASIN}
                                </a>
                              ) : (
                                <code className="font-mono text-xs font-extrabold text-cyan-100 shrink-0">
                                  {group.ASIN}
                                </code>
                              )}
                              <span className="text-[11px] text-slate-300 line-clamp-2 min-w-0">
                                <HighlightedText
                                  text={prodTitle}
                                  searchQuery={productTitleSearch}
                                  selectable
                                  title="Cliquer pour sélectionner le titre"
                                />
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => scrollToAsinGroup(group.key)}
                              title={`Atteindre la carte ASIN ${group.ASIN}`}
                              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${band.card}`}
                            >
                              <div className="min-w-0">
                                <b className="block text-xs font-extrabold text-white">
                                  {rateText}
                                </b>
                                <span className="block text-[10px] text-slate-200/85 truncate">
                                  {voteText}
                                </span>
                                <div className="mt-1">
                                  <SvgProgressBar percent={ratio} fillClass={band.fill} />
                                </div>
                              </div>
                              <StatusBadge status={status} compact />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                </div>

                {/* ASIN Cards Section */}
                <div className="flex items-end justify-between gap-3 mb-3">
                  <div>
                    <h2 className="m-0 text-base font-bold text-white">ASIN du HIT</h2>
                    <p className="m-0 mt-0.5 text-xs text-slate-400">
                      {pluralize(
                        activeHit.groupKeys.length,
                        'groupe HIT + ASIN',
                        'groupes HIT + ASIN'
                      )}{' '}
                      · toutes les cartes restent visibles dans la même vue.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  {activeHit.groupKeys.map((gk) => {
                    const group = model.groups.get(gk);
                    if (!group) return null;
                    return (
                      <AsinCard
                        key={group.key}
                        group={group}
                        decisions={decisions}
                        drafts={drafts}
                        comments={comments}
                        productTitleSearch={productTitleSearch}
                        targeted={targetedGroupKey === group.key}
                        onSaveDraft={handleSaveDraft}
                        onMarkReview={handleMarkReview}
                        onSaveComment={handleSaveComment}
                        onOpenImage={handleOpenViewerImage}
                      />
                    );
                  })}
                </div>

                {/* Fixed Bottom-Left Finalization Dock */}
                <div
                  role="group"
                  aria-label="Actions de finalisation du HIT"
                  className={`fixed z-40 bottom-4 left-4 right-4 sm:right-auto flex flex-wrap gap-2 p-2 rounded-2xl border backdrop-blur-xl shadow-2xl ${
                    !finalizationPlan.ready
                      ? 'border-amber-400/50 bg-[#322612]/95'
                      : 'border-emerald-400/50 bg-[#081f27]/95'
                  }`}
                >
                  <button
                    type="button"
                    disabled={finalizationPlan.majorityCandidates.length === 0}
                    onClick={handleUseMajoritySuggestions}
                    className="flex-1 sm:flex-initial min-h-9 px-3.5 py-2 rounded-xl border border-slate-300/25 bg-white/5 text-xs font-semibold text-slate-100 hover:bg-white/12 transition"
                  >
                    {finalizationPlan.majorityCandidates.length > 0
                      ? `Reprendre ${pluralize(
                          finalizationPlan.majorityCandidates.length,
                          'réponse majoritaire',
                          'réponses majoritaires'
                        )}`
                      : 'Aucune majorité à reprendre'}
                  </button>

                  <button
                    type="button"
                    disabled={
                      finalizationPlan.ready &&
                      finalizationPlan.alreadySubmitted &&
                      finalizationPlan.draftEntries.length === 0
                    }
                    onClick={handleFinalizeActiveHit}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-9 px-4 py-2 rounded-xl border border-emerald-400/55 bg-gradient-to-r from-emerald-600 to-teal-700 text-xs font-bold text-white shadow-lg hover:brightness-110 transition"
                  >
                    <CheckCheck className="w-4 h-4" />
                    {finalizationPlan.ready &&
                    finalizationPlan.alreadySubmitted &&
                    finalizationPlan.draftEntries.length === 0
                      ? '✓ HIT déjà soumis'
                      : finalizationPlan.stale || finalizationPlan.alreadySubmitted
                        ? '↻ Resoumettre le HIT'
                        : 'Soumettre le HIT'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Firebase Export & Cloud Database Modal */}
      <FirebaseExportModal
        open={firebaseModalOpen}
        initialTab={firebaseModalTab}
        model={model}
        decisions={decisions}
        submittedHitStates={submittedHitStates}
        comments={comments}
        currentUser={currentUser}
        storedExports={storedExports}
        onClose={() => setFirebaseModalOpen(false)}
        onSignInGoogle={handleSignInGoogle}
        onSignOutGoogle={handleSignOutGoogle}
        onNotify={showToast}
        onExportActiveChange={setFirebaseExporting}
      />

      {/* Multi-Image Zoom & Side-by-Side Viewer */}
      <ImageViewerModal
        items={viewerItems}
        activeId={activeViewerId}
        onSelectId={setActiveViewerId}
        onCloseItem={handleCloseViewerItem}
        onCloseAll={() => {
          setViewerItems([]);
          setActiveViewerId(null);
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 bottom-24 sm:bottom-6 z-50 max-w-md rounded-xl border px-4 py-3 text-xs font-medium shadow-2xl transition ${
            toast.isError
              ? 'border-rose-400/60 bg-[#1f0b14]/95 text-rose-100'
              : 'border-cyan-400/50 bg-[#081b2c]/95 text-cyan-50'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
