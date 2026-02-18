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
  mint: 'bg-emerald-50 border-emerald-100 text-emerald-600 ring-emerald-200',
  lemon: 'bg-yellow-50 border-yellow-100 text-yellow-600 ring-yellow-200',
  sky: 'bg-sky-50 border-sky-100 text-sky-600 ring-sky-200',
  lavender: 'bg-violet-50 border-violet-100 text-violet-600 ring-violet-200',
  peach: 'bg-orange-50 border-orange-100 text-orange-600 ring-orange-200',
  rose: 'bg-rose-50 border-rose-100 text-rose-600 ring-rose-200',
  aqua: 'bg-cyan-50 border-cyan-100 text-cyan-600 ring-cyan-200',
  lime: 'bg-lime-50 border-lime-100 text-lime-700 ring-lime-200',
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
        'hover:-translate-y-0.5 hover:shadow-md active:scale-95',
        shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        sizeStyles.container,
        VARIANT_STYLES[variant],
        active ? 'ring-2' : '',
        className
      )}
    >
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/40 to-transparent" />
      <Icon className={cn('relative z-[1]', sizeStyles.icon, active ? 'opacity-100' : 'opacity-90')} strokeWidth={2.2} />
    </span>
  );
};

