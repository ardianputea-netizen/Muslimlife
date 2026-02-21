import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AppIconVariant =
  | 'mint'
  | 'lemon'
  | 'sky'
  | 'lavender'
  | 'peach'
  | 'rose'
  | 'aqua'
  | 'lime';

interface AppIconProps {
  icon: LucideIcon;
  variant: AppIconVariant;
  size?: 'sm' | 'md';
  shape?: 'circle' | 'squircle';
  active?: boolean;
  className?: string;
}

const VARIANT_STYLES: Record<AppIconVariant, string> = {
  mint: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:bg-emerald-400/20 dark:border-border dark:text-emerald-300 dark:ring-1 dark:ring-emerald-400/30',
  lemon: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:bg-amber-400/20 dark:border-border dark:text-amber-300 dark:ring-1 dark:ring-amber-400/30',
  sky: 'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:bg-sky-400/20 dark:border-border dark:text-sky-300 dark:ring-1 dark:ring-sky-400/30',
  lavender: 'bg-violet-500/10 border-violet-500/20 text-violet-700 dark:bg-violet-400/20 dark:border-border dark:text-violet-300 dark:ring-1 dark:ring-violet-400/30',
  peach: 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:bg-orange-400/20 dark:border-border dark:text-orange-300 dark:ring-1 dark:ring-orange-400/30',
  rose: 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:bg-rose-400/20 dark:border-border dark:text-rose-300 dark:ring-1 dark:ring-rose-400/30',
  aqua: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-700 dark:bg-cyan-400/20 dark:border-border dark:text-cyan-300 dark:ring-1 dark:ring-cyan-400/30',
  lime: 'bg-lime-500/10 border-lime-500/20 text-lime-700 dark:bg-lime-400/20 dark:border-border dark:text-lime-300 dark:ring-1 dark:ring-lime-400/30',
};

const SIZE_STYLES: Record<NonNullable<AppIconProps['size']>, { container: string; icon: string }> = {
  sm: { container: 'h-10 w-10', icon: 'h-5 w-5' },
  md: { container: 'h-12 w-12', icon: 'h-6 w-6' },
};

export const AppIcon: React.FC<AppIconProps> = ({
  icon: Icon,
  variant,
  size = 'md',
  shape = 'circle',
  active = false,
  className,
}) => {
  const sizeStyles = SIZE_STYLES[size];

  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex items-center justify-center border shadow-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md active:scale-95 dark:shadow-[0_0_0_1px_hsl(var(--border))]',
        shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        sizeStyles.container,
        VARIANT_STYLES[variant],
        active ? 'ring-2 ring-primary/45 dark:ring-primary/55' : '',
        className
      )}
    >
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/50 to-transparent dark:from-white/10 dark:to-transparent" />
      <Icon className={cn('relative z-[1]', sizeStyles.icon, active ? 'opacity-100' : 'opacity-95')} strokeWidth={2.2} />
    </span>
  );
};
