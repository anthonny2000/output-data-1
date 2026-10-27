import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  ConsensusGroup,
  GroupDecision,
  ViewerImageItem,
} from '../types/consensus';
import {
  buildAnswerPaletteMap,
  formatPercent,
  getConsensusOptions,
  getGroupStatus,
  validHttpUrl,
  workerAnswerLabel,
} from '../utils/consensusEngine';
import { HighlightedText, selectElementContents } from './HighlightedText';
import { StatusBadge, SvgProgressBar } from './StatusBadge';

interface AsinCardProps {
  group: ConsensusGroup;
  decisions: Map<string, GroupDecision>;
  drafts: Map<string, string>;
  comments: Map<string, string>;
  productTitleSearch: string;
  targeted: boolean;
  onSaveDraft: (groupKey: string, signature: string) => void;
  onMarkReview: (groupKey: string) => void;
  onSaveComment: (groupKey: string, comment: string) => void;
  onOpenImage: (item: ViewerImageItem) => void;
}

export const AsinCard: React.FC<AsinCardProps> = ({
  group,
  decisions,
  drafts,
  comments,
  productTitleSearch,
  targeted,
  onSaveDraft,
  onMarkReview,
  onSaveComment,
  onOpenImage,
}) => {
  const [imageBroken, setImageBroken] = useState(false);

  const status = getGroupStatus(group, decisions);
  const paletteMap = buildAnswerPaletteMap(group);
  const allOptions = getConsensusOptions(group);
  const selectableSet = new Set(allOptions.map((o) => o.value));

  const decision = decisions.get(group.key);
  const draft = drafts.get(group.key);
  const selectedSignature =
    draft !== undefined ? draft : decision && decision.status === 'validated' ? decision.signature : '';

  const qaComment = comments.get(group.key) || '';

  const product = group.primaryProduct || {
    asin: group.ASIN,
    id: '',
    imageUrl: '',
    productTitle: '',
    productUrlSource: '',
    productUrl: '',
    productUrlOrigin: 'unavailable' as const,
    marketplace: '',
    raw: null,
  };

  const productTitle = product.productTitle || 'Produit absent de Input.matches';
  const hasImage = !imageBroken && Boolean(product.imageUrl && validHttpUrl(product.imageUrl));
  const hasProductUrl = Boolean(product.productUrl && validHttpUrl(product.productUrl));

  const sortedVotes = Array.from(group.voteDistribution.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  const observedOptions = allOptions.filter((o) => o.category === 'observed');
  const compositeOptions = allOptions.filter((o) => o.category === 'composite');
  const excludedOptions = allOptions.filter((o) => o.category === 'excluded');
  const attributeOptions = allOptions.filter((o) => o.category === 'attribute');

  const draftNote =
    draft && (!decision || decision.signature !== draft || decision.status !== 'validated')
      ? 'Choix préparé : il sera validé lorsque vous soumettrez ce HIT.'
      : decision && decision.status === 'validated'
        ? 'Consensus enregistré manuellement.'
        : 'Choisissez une réponse puis soumettez le HIT lorsque tous les ASIN sont traités.';

  const workerDetail = `${group.validWorkerCount} worker${
    group.validWorkerCount > 1 ? 's' : ''
  } · ${group.validVoteCount} vote${group.validVoteCount > 1 ? 's' : ''} critère`;

  return (
    <article
      id={`asin-card-${encodeURIComponent(group.key)}`}
      className={`scroll-mt-24 rounded-2xl border overflow-hidden bg-gradient-to-br from-[#19304b]/75 to-[#0a1727]/85 shadow-xl transition ${
        targeted
          ? 'border-cyan-400 ring-4 ring-cyan-400/20'
          : 'border-slate-400/20'
      }`}
    >
      {/* Header */}
      <header className="p-4 border-b border-slate-400/20 bg-gradient-to-r from-cyan-500/8 via-transparent to-violet-500/8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              onClick={(e) => selectElementContents(e.currentTarget)}
              title="Cliquer pour sélectionner l’ASIN"
              className="m-0 font-mono text-sm sm:text-base font-bold tracking-wide text-white cursor-text select-all"
            >
              {group.ASIN}
            </h3>
            <p className="m-0 mt-1 text-[11px] text-slate-400">
              {group.responses.length} réponse(s) source · {group.validWorkerCount} worker(s) exploitable(s) ·{' '}
              {group.validVoteCount} vote(s) critère
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={status} />
            {group.isTie && <StatusBadge status="tie" compact />}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2.5 text-xs text-slate-200 leading-relaxed">
          {group.validVoteCount === 0 ? (
            <>
              <strong className="text-white">Aucun vote exploitable.</strong> Vous pouvez néanmoins préparer une décision manuelle parmi les attributs disponibles.
            </>
          ) : group.isTie ? (
            <>
              <strong className="text-white">Égalité.</strong> {workerDetail} ; aucun consensus n’est suggéré.
            </>
          ) : (
            <>
              <strong className="text-white">Suggestion majoritaire :</strong>{' '}
              <span className="font-mono text-cyan-200 font-semibold">
                {group.majoritySuggestion}
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5">
                Taux d’accord observé : {formatPercent(group.agreementRate)} ({workerDetail}).
              </span>
            </>
          )}
        </div>
      </header>

      {/* 3-Column Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Column 1: Product */}
        <section className="lg:col-span-3 p-4 border-b lg:border-b-0 lg:border-r border-slate-400/20 flex flex-col gap-3">
          <div>
            <h4 className="m-0 mb-2 text-xs font-semibold text-slate-100 leading-snug line-clamp-4">
              <HighlightedText text={productTitle} searchQuery={productTitleSearch} />
            </h4>

            {hasProductUrl ? (
              <a
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-100 underline underline-offset-2"
              >
                {product.productUrlOrigin === 'source'
                  ? 'Ouvrir la fiche produit'
                  : 'Ouvrir le lien reconstruit'}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-[11px] text-slate-500">Lien produit indisponible</span>
            )}

            <div className="mt-1 text-[10px] text-slate-500">
              {product.productUrlOrigin === 'source'
                ? 'Lien source de Input.matches.'
                : product.productUrlOrigin === 'reconstructed'
                  ? `Lien reconstruit : marketplace ${product.marketplace || '—'} + ASIN classifié.`
                  : 'Marketplace ou ASIN absent / invalide : lien non construit.'}
            </div>
          </div>

          <div className="relative flex-1 min-h-44 rounded-xl border border-white/10 bg-[#07111e] grid place-items-center overflow-hidden p-2">
            {hasImage ? (
              <img
                src={product.imageUrl}
                alt={`Image produit ${group.ASIN}`}
                loading="lazy"
                onError={() => setImageBroken(true)}
                onClick={() =>
                  onOpenImage({
                    id: `product:${group.key}`,
                    src: product.imageUrl,
                    alt: `Image produit ${group.ASIN}`,
                    title: `ASIN ${group.ASIN}`,
                    subtitle: productTitle,
                  })
                }
                className="max-h-56 w-auto object-contain cursor-zoom-in transition hover:scale-[1.02]"
                title="Cliquer pour agrandir ou comparer côte à côte"
              />
            ) : (
              <div className="text-[11px] text-slate-500 text-center px-3">
                Image produit indisponible
              </div>
            )}
          </div>

          {(!product.productTitle || !product.imageUrl) && (
            <div className="text-[11px] text-amber-200/90">
              ⚠ Produit incomplet ou absent de <code>Input.matches</code>.
            </div>
          )}
        </section>

        {/* Column 2: Worker Responses */}
        <section className="lg:col-span-5 p-4 border-b lg:border-b-0 lg:border-r border-slate-400/20">
          <p className="m-0 mb-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Réponses workers · cliquez pour préparer le choix
          </p>

          <div className="max-h-72 overflow-y-auto pr-1 divide-y divide-white/8">
            {group.responses.map((response) => {
              const badgeState = response.duplicateWorker
                ? 'review'
                : response.responseState === 'exploitable'
                  ? 'pending'
                  : 'invalid';
              const label = workerAnswerLabel(response);
              const palette = paletteMap.get(label);
              const canSelect =
                Boolean(response.responseSignature) &&
                selectableSet.has(response.responseSignature);

              return (
                <div
                  key={response.responseId}
                  className="grid grid-cols-[minmax(88px,0.7fr)_minmax(0,1.2fr)_auto] items-center gap-2 py-2 first:pt-0 text-[11px]"
                >
                  <div className="min-w-0">
                    <span
                      onClick={(e) => selectElementContents(e.currentTarget)}
                      title={`Cliquer pour sélectionner : ${response.WorkerId || 'Worker manquant'}`}
                      className="block font-mono text-sky-200 truncate cursor-text select-all"
                    >
                      {response.WorkerId || 'Worker manquant'}
                    </span>
                    {response.AssignmentId && (
                      <span
                        onClick={(e) => selectElementContents(e.currentTarget)}
                        title={`Cliquer pour sélectionner : ${response.AssignmentId}`}
                        className="block font-mono text-[9.5px] text-slate-500 truncate cursor-text select-all"
                      >
                        A: {response.AssignmentId}
                      </span>
                    )}
                  </div>

                  {canSelect ? (
                    <button
                      type="button"
                      onClick={() => onSaveDraft(group.key, response.responseSignature)}
                      title="Cliquer pour placer cette réponse dans la liste déroulante"
                      className={`w-full px-2 py-1.5 rounded-lg border text-[10.5px] font-bold text-left truncate transition ${
                        palette?.chip || 'border-white/20 bg-white/5 text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ) : (
                    <span
                      title={label}
                      className={`w-full px-2 py-1.5 rounded-lg border text-[10.5px] font-bold truncate opacity-70 ${
                        palette?.chip || 'border-white/15 bg-white/5 text-slate-300'
                      }`}
                    >
                      {label}
                    </span>
                  )}

                  <StatusBadge status={badgeState} compact />
                </div>
              );
            })}
          </div>
        </section>

        {/* Column 3: Votes & QA Decision */}
        <section className="lg:col-span-4 p-4 flex flex-col justify-between">
          <div>
            <p className="m-0 mb-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Vote et décision manuelle
            </p>

            <div className="grid gap-2">
              {sortedVotes.length > 0 ? (
                sortedVotes.map(([attr, count]) => {
                  const pct = group.validVoteCount ? (count / group.validVoteCount) * 100 : 0;
                  const palette = paletteMap.get(attr);
                  return (
                    <div
                      key={attr}
                      className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2"
                    >
                      <div className="min-w-0">
                        <div
                          title={attr}
                          className={`px-2 py-1 rounded-md border text-[10.5px] font-bold truncate ${
                            palette?.chip || 'border-white/20 bg-white/5 text-white'
                          }`}
                        >
                          {attr}
                        </div>
                        <div className="mt-1">
                          <SvgProgressBar
                            percent={pct}
                            fillClass={palette?.barFill || 'fill-cyan-400'}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 text-right font-mono">
                        {count}/{group.validVoteCount}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 py-1">Aucun critère comptabilisé.</div>
              )}
            </div>

            <div className="mt-3">
              <label
                htmlFor={`comment-${encodeURIComponent(group.key)}`}
                className="block mb-1 text-[11px] font-bold text-slate-300"
              >
                Commentaire QA · justification
              </label>
              <textarea
                id={`comment-${encodeURIComponent(group.key)}`}
                value={qaComment}
                onChange={(e) => onSaveComment(group.key, e.target.value)}
                rows={3}
                placeholder="Justifiez la décision retenue…"
                className="block w-full min-h-20 rounded-xl border border-slate-400/20 bg-[#040c16]/80 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {group.anomalies.length > 0 && (
              <div className="mt-2.5 text-[11px] text-amber-200 leading-relaxed">
                ⚠ {group.anomalies.join(' ')}
              </div>
            )}
          </div>

          <div className="mt-3.5 grid gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedSignature}
                onChange={(e) => onSaveDraft(group.key, e.target.value)}
                aria-label={`Consensus pour ${group.ASIN}`}
                className="w-full h-10 rounded-xl border border-slate-400/25 bg-[#040c16]/90 px-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="">Choisir une réponse…</option>
                {observedOptions.length > 0 && (
                  <optgroup label="Critères observés — votes atomiques">
                    {observedOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value} — {o.votes} vote{o.votes > 1 ? 's' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {compositeOptions.length > 0 && (
                  <optgroup label="Réponses multi-critères">
                    {compositeOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value} · multi-critères
                      </option>
                    ))}
                  </optgroup>
                )}
                {excludedOptions.length > 0 && (
                  <optgroup label="Réponses présentes mais exclues du vote">
                    {excludedOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value} · exclue
                      </option>
                    ))}
                  </optgroup>
                )}
                {attributeOptions.length > 0 && (
                  <optgroup label="Tous les autres attributs métier — choix outsider">
                    {attributeOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value} · outsider
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <button
                type="button"
                onClick={() => onMarkReview(group.key)}
                className="w-full h-10 rounded-xl border border-amber-400/50 bg-amber-900/30 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-800/40 transition"
              >
                Marquer à revoir
              </button>
            </div>

            <div className="min-h-4 text-[10.5px] text-amber-300/90">{draftNote}</div>
          </div>
        </section>
      </div>
    </article>
  );
};
