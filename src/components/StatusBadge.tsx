import React from 'react';

export type BadgeVariant =
  | 'validated'
  | 'submitted'
  | 'pending'
  | 'review'
  | 'tie'
  | 'invalid'
  | 'info';

const BADGE_CONFIG: Record<BadgeVariant, { label: string; classes: string }> = {
  validated: {
    label: '✓ Validé manuellement',
    classes: 'text-emerald-200 border-emerald-400/40 bg-emerald-500/18',
  },
  submitted: {
    label: '✓ Soumis',
    classes: 'text-emerald-100 border-emerald-400/60 bg-emerald-600/30',
  },
  pending: {
    label: 'À valider',
    classes: 'text-cyan-200 border-cyan-400/35 bg-cyan-500/12',
  },
  review: {
    label: '⚠ À revoir',
    classes: 'text-amber-200 border-amber-400/45 bg-amber-600/20',
  },
  tie: {
    label: '↔ Égalité',
    classes: 'text-rose-200 border-rose-400/45 bg-rose-600/20',
  },
  invalid: {
    label: 'Non exploitable',
    classes: 'text-rose-200 border-rose-400/35 bg-rose-600/16',
  },
  info: {
    label: 'Information',
    classes: 'text-violet-200 border-violet-400/40 bg-violet-500/18',
  },
};

interface StatusBadgeProps {
  status: BadgeVariant;
  compact?: boolean;
  customLabel?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  compact = false,
  customLabel,
}) => {
  const cfg = BADGE_CONFIG[status] || BADGE_CONFIG.info;
  return (
    <span
      className={`inline-flex items-center max-w-full rounded-full border font-extrabold leading-none whitespace-nowrap ${
        compact ? 'px-1.5 py-0.5 text-[9.5px]' : 'px-2 py-1 text-[10.5px]'
      } ${cfg.classes}`}
    >
      {customLabel || cfg.label}
    </span>
  );
};

interface SvgProgressBarProps {
  percent: number;
  trackClass?: string;
  fillClass?: string;
  heightClass?: string;
}

export const SvgProgressBar: React.FC<SvgProgressBarProps> = ({
  percent,
  trackClass = 'fill-white/10',
  fillClass = 'fill-cyan-400',
  heightClass = 'h-1.5',
}) => {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <svg
      className={`w-full overflow-hidden rounded-full ${heightClass}`}
      viewBox="0 0 100 6"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="100" height="6" className={trackClass} />
      <rect x="0" y="0" width={clamped} height="6" className={fillClass} />
    </svg>
  );
};

export function scoreBandClasses(rate: number | null): {
  card: string;
  fill: string;
} {
  if (rate === null || !Number.isFinite(rate)) {
    return {
      card: 'border-slate-400/25 bg-slate-800/40 hover:border-slate-300/45',
      fill: 'fill-slate-400',
    };
  }
  if (rate >= 90) {
    return {
      card: 'border-emerald-400/60 bg-emerald-950/60 hover:border-emerald-300',
      fill: 'fill-emerald-400',
    };
  }
  if (rate >= 80) {
    return {
      card: 'border-lime-400/55 bg-lime-950/55 hover:border-lime-300',
      fill: 'fill-lime-400',
    };
  }
  if (rate >= 70) {
    return {
      card: 'border-amber-400/55 bg-amber-950/55 hover:border-amber-300',
      fill: 'fill-amber-400',
    };
  }
  if (rate >= 60) {
    return {
      card: 'border-orange-400/55 bg-orange-950/55 hover:border-orange-300',
      fill: 'fill-orange-400',
    };
  }
  return {
    card: 'border-rose-400/55 bg-rose-950/55 hover:border-rose-300',
    fill: 'fill-rose-400',
  };
}
