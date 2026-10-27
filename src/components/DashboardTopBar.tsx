import React from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import {
  ConsensusModel,
  DashboardStats,
  GroupDecision,
  HitFilterValue,
  SubmittedHitLogEntry,
  SubmittedHitState,
} from '../types/consensus';
import {
  calculateHitConsensusScore,
  formatPercent,
  getGroupStatus,
  pluralize,
} from '../utils/consensusEngine';
import { scoreBandClasses, StatusBadge } from './StatusBadge';

interface DashboardTopBarProps {
  model: ConsensusModel;
  decisions: Map<string, GroupDecision>;
  submittedHitLog: SubmittedHitLogEntry[];
  submittedHitStates: Map<string, SubmittedHitState>;
  activeHitId: string | null;
  filteredHitIds: string[];
  priorityHitIds: string[];
  missingPriorityCount: number;
  hitQuery: string;
  hitFilter: HitFilterValue;
  autoAccept: boolean;
  hitListCollapsed: boolean;
  productTitleSearch: string;
  stats: DashboardStats;
  exportableHitCount: number;
  onSelectHit: (hitId: string) => void;
  onChangeHitQuery: (value: string) => void;
  onChangeHitFilter: (value: HitFilterValue) => void;
  onToggleAutoAccept: (checked: boolean) => void;
  onToggleHitList: () => void;
  onChangeProductTitleSearch: (value: string) => void;
  onJumpToSubmittedHit: (hitId: string) => void;
  onRemoveSubmittedHit: (hitId: string) => void;
}

function formatSubmittedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export const DashboardTopBar: React.FC<DashboardTopBarProps> = ({
  model,
  decisions,
  submittedHitLog,
  submittedHitStates,
  activeHitId,
  filteredHitIds,
  priorityHitIds,
  missingPriorityCount,
  hitQuery,
  hitFilter,
  autoAccept,
  hitListCollapsed,
  productTitleSearch,
  stats,
  exportableHitCount,
  onSelectHit,
  onChangeHitQuery,
  onChangeHitFilter,
  onToggleAutoAccept,
  onToggleHitList,
  onChangeProductTitleSearch,
  onJumpToSubmittedHit,
  onRemoveSubmittedHit,
}) => {
  const isPriority = priorityHitIds.length > 0;
  const hitCountLabel = isPriority
    ? `${filteredHitIds.length} / ${priorityHitIds.length} listés${
        missingPriorityCount
          ? ` · ${missingPriorityCount} introuvable${missingPriorityCount > 1 ? 's' : ''}`
          : ''
      }`
    : `${filteredHitIds.length} / ${model.hitOrder.length}`;

  const currentSubmittedCount = Array.from(submittedHitStates.values()).filter(
    (s) => !s.stale
  ).length;
  const staleSubmittedCount = Array.from(submittedHitStates.values()).filter((s) => s.stale).length;

  const submittedSummary = currentSubmittedCount
    ? `${pluralize(currentSubmittedCount, 'HIT actuellement soumis', 'HIT actuellement soumis')}${
        staleSubmittedCount
          ? ` · ${pluralize(staleSubmittedCount, 'mise à jour requise', 'mises à jour requises')}`
          : ''
      }`
    : submittedHitLog.length
      ? `Aucun HIT à jour · ${pluralize(staleSubmittedCount, 'mise à jour requise', 'mises à jour requises')}`
      : 'Aucun HIT soumis dans cette session';

  const errorIssuesCount = model.issues.filter((i) => i.level === 'error').length;
  const warningIssuesCount = model.issues.filter((i) => i.level === 'warning').length;
  const issuesSummaryText = model.issues.length
    ? `${pluralize(errorIssuesCount, 'erreur', 'erreurs')} · ${pluralize(
        warningIssuesCount,
        'avertissement',
        'avertissements'
      )}`
    : 'Aucune anomalie';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch mb-5">
      {/* Left 4 cols: HIT navigation & floating list */}
      <aside
        aria-label="Navigation des HIT"
        className="lg:col-span-4 relative rounded-2xl border border-slate-400/20 bg-[#071322]/85 shadow-xl"
      >
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <h2 className="m-0 text-sm font-bold text-white">HIT à examiner</h2>
            <div className="inline-flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-slate-400 whitespace-nowrap">{hitCountLabel}</span>
              <label
                className="inline-flex items-center gap-1 text-[11px] text-cyan-200 whitespace-nowrap cursor-pointer"
                title="Après soumission, passer automatiquement au HIT suivant"
              >
                <input
                  type="checkbox"
                  checked={autoAccept}
                  onChange={(e) => onToggleAutoAccept(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-400"
                />
                <span>Auto. accepter</span>
              </label>
              <button
                type="button"
                onClick={onToggleHitList}
                aria-expanded={!hitListCollapsed}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-400/20 text-[11px] text-cyan-200 hover:bg-white/5"
              >
                {hitListCollapsed ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Afficher</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Réduire</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <textarea
            value={hitQuery}
            onChange={(e) => onChangeHitQuery(e.target.value)}
            rows={1}
            spellCheck={false}
            placeholder="HITId prioritaire, un par ligne…"
            aria-label="Liste prioritaire de HIT, un identifiant par ligne"
            className="block w-full h-9 min-h-9 max-h-20 resize-y rounded-lg border border-slate-400/20 bg-[#040c16]/80 px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />

          <select
            value={hitFilter}
            onChange={(e) => onChangeHitFilter(e.target.value as HitFilterValue)}
            aria-label="Filtrer les HIT"
            className="mt-2 block w-full rounded-lg border border-slate-400/20 bg-[#040c16]/80 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
          >
            <option value="all">Tous les HIT</option>
            <option value="pending">Contient des groupes à valider</option>
            <option value="review">Contient des groupes à revoir</option>
            <option value="tie">Contient une égalité</option>
          </select>
        </div>

        {!hitListCollapsed && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-[56vh] overflow-y-auto p-2 rounded-xl border border-cyan-400/45 bg-[#071322]/98 shadow-2xl">
            {filteredHitIds.length === 0 ? (
              <div className="p-3 text-xs text-slate-400">
                {isPriority
                  ? 'Aucun HIT de la liste prioritaire n’est présent dans le fichier.'
                  : 'Aucun HIT ne correspond au filtre.'}
              </div>
            ) : (
              filteredHitIds.map((hitId) => {
                const hit = model.hits.get(hitId);
                if (!hit) return null;
                const groups = hit.groupKeys
                  .map((k) => model.groups.get(k))
                  .filter((g): g is NonNullable<typeof g> => Boolean(g));
                const validated = groups.filter(
                  (g) => getGroupStatus(g, decisions) === 'validated'
                ).length;
                const review = groups.filter(
                  (g) => getGroupStatus(g, decisions) === 'review'
                ).length;
                const score = calculateHitConsensusScore(model, hit);
                const submitted = submittedHitStates.get(hitId);
                const band = scoreBandClasses(score.agreementRate);
                const isActive = hitId === activeHitId;

                return (
                  <button
                    key={hitId}
                    type="button"
                    onClick={() => onSelectHit(hitId)}
                    className={`w-full mb-1 p-2.5 rounded-xl border text-left transition ${
                      isActive
                        ? 'border-cyan-400/50 bg-gradient-to-r from-cyan-500/18 to-violet-500/14 text-white'
                        : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="block text-xs font-bold truncate" title={hitId}>
                      {hitId}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10.5px]">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[9.5px] font-extrabold text-white ${band.card}`}
                        title={
                          score.totalVotes
                            ? `Accord global pondéré : ${score.majorityVotes}/${score.totalVotes} votes`
                            : 'Aucun vote exploitable'
                        }
                      >
                        {score.totalVotes ? `${formatPercent(score.agreementRate)} accord` : '— accord'}
                      </span>
                      <StatusBadge
                        status={
                          review > 0
                            ? 'review'
                            : validated === groups.length
                              ? 'validated'
                              : 'pending'
                        }
                        compact
                      />
                      {submitted && (
                        <StatusBadge status={submitted.stale ? 'review' : 'submitted'} compact />
                      )}
                      <span className="text-slate-400">
                        {validated}/{groups.length} validés
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </aside>

      {/* Right 8 cols: Utility drawers */}
      <div className="lg:col-span-8 flex flex-col gap-2.5 min-w-0">
        {/* Submitted HITs journal */}
        <details className="group rounded-xl border border-emerald-400/35 bg-emerald-950/20 overflow-hidden">
          <summary className="flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer select-none list-none">
            <h2 className="m-0 text-xs font-bold text-emerald-200">Journal des HIT soumis</h2>
            <span className="text-[11px] text-emerald-300/80 truncate">{submittedSummary}</span>
          </summary>
          <div className="border-t border-emerald-400/20 max-h-52 overflow-y-auto">
            {submittedHitLog.length === 0 ? (
              <div className="p-3.5 text-xs text-slate-400">
                Lorsque tous les choix d’un HIT sont prêts, utilisez l’action « Soumettre le HIT » en bas à gauche pour les valider et rendre le HIT exportable vers CSV, TSV ou Firebase.
              </div>
            ) : (
              submittedHitLog.map((entry) => {
                const state = submittedHitStates.get(entry.HITId);
                const isCurrent = state && state.lastEntryId === entry.id;
                const badgeVariant =
                  isCurrent && !state.stale ? 'submitted' : state?.stale ? 'review' : 'info';
                const badgeText = isCurrent
                  ? state.stale
                    ? 'À resoumettre'
                    : '✓ Soumis'
                  : 'Historique';

                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch border-t border-white/5 first:border-t-0"
                  >
                    <button
                      type="button"
                      onClick={() => onJumpToSubmittedHit(entry.HITId)}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-emerald-500/10"
                    >
                      <code className="text-[11px] font-bold text-emerald-100 truncate">
                        {entry.HITId}
                      </code>
                      <div className="flex items-center gap-2">
                        <span className="text-[10.5px] text-emerald-200/75 whitespace-nowrap">
                          {entry.validated}/{entry.total} ASIN ·{' '}
                          {formatSubmittedDate(entry.submittedAt)}
                        </span>
                        <StatusBadge status={badgeVariant} compact customLabel={badgeText} />
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveSubmittedHit(entry.HITId)}
                      title={`Retirer le HIT ${entry.HITId} des HIT soumis et de l'export`}
                      aria-label={`Retirer le HIT ${entry.HITId} des HIT soumis`}
                      className="grid place-items-center w-10 border-l border-white/10 text-rose-200 hover:bg-rose-500/20 hover:text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </details>

        {/* Product title multi-line highlight search */}
        <div className="rounded-xl border border-amber-400/35 bg-amber-950/20 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <strong className="text-xs font-bold text-amber-200">
              Surligner les titres produit
            </strong>
            <span className="text-[10.5px] text-amber-200/80 truncate">{issuesSummaryText}</span>
          </div>
          <textarea
            value={productTitleSearch}
            onChange={(e) => onChangeProductTitleSearch(e.target.value)}
            rows={1}
            spellCheck={false}
            placeholder="Surligner les titres produit, un mot ou une expression par ligne…"
            aria-label="Mots ou expressions à surligner dans les titres produit"
            className="block w-full h-9 min-h-9 max-h-24 resize-y rounded-lg border border-amber-400/35 bg-[#07111f]/80 px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
          />
        </div>

        {/* Validation stats drawer */}
        <details className="rounded-xl border border-slate-400/20 bg-[#09192b]/65 overflow-hidden">
          <summary className="flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer select-none list-none">
            <strong className="text-xs font-bold text-white">Statistiques de validation</strong>
            <span className="text-[11px] text-slate-400 truncate">
              {pluralize(exportableHitCount, 'HIT soumis exportable', 'HIT soumis exportables')} sur{' '}
              {model.hitOrder.length} · cliquez pour afficher
            </span>
          </summary>
          <div className="p-3.5 border-t border-slate-400/15 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              {
                label: 'HIT distincts',
                value: stats.hitCount,
                meta: 'groupes principaux',
                tone: 'text-white',
              },
              {
                label: 'ASIN distincts',
                value: stats.uniqueAsinCount,
                meta: 'tous HIT confondus',
                tone: 'text-white',
              },
              {
                label: 'Groupes HIT + ASIN',
                value: stats.groupCount,
                meta: 'unité du consensus',
                tone: 'text-white',
              },
              {
                label: 'Validés',
                value: stats.validatedCount,
                meta: `${formatPercent(stats.validationRate)} du total`,
                tone: 'text-emerald-400',
              },
              {
                label: 'À valider',
                value: stats.pendingCount,
                meta: 'sans validation manuelle',
                tone: 'text-amber-400',
              },
              {
                label: 'À revoir',
                value: stats.reviewCount,
                meta: 'anomalie ou revue',
                tone: 'text-rose-400',
              },
              {
                label: 'Égalités',
                value: stats.tieCount,
                meta: 'aucun gagnant suggéré',
                tone: stats.tieCount ? 'text-rose-400' : 'text-white',
              },
              {
                label: 'Accord moyen',
                value: formatPercent(stats.meanAgreement),
                meta: 'groupes votables',
                tone: 'text-cyan-300',
              },
            ].map((card) => (
              <article
                key={card.label}
                className="rounded-xl border border-slate-400/20 bg-slate-900/70 p-3"
              >
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                  {card.label}
                </div>
                <div className={`mt-1.5 text-xl sm:text-2xl font-extrabold ${card.tone}`}>
                  {card.value}
                </div>
                <div className="mt-1 text-[10.5px] text-slate-500">{card.meta}</div>
              </article>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
};
