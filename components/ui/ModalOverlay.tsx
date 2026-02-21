import React from 'react';
import { cn } from '@/lib/utils';

interface ModalOverlayProps {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  contentClassName?: string;
  closeLabel?: string;
}

export const ModalOverlay: React.FC<ModalOverlayProps> = ({
  children,
  onClose,
  className,
  contentClassName,
  closeLabel = 'Tutup',
}) => {
  return (
    <div
      className={cn(
        'fixed inset-0 z-[110] flex items-end bg-black/45 backdrop-blur-sm dark:bg-black/60',
        className
      )}
      role="dialog"
      aria-modal="true"
    >
      <button type="button" onClick={onClose} className="absolute inset-0" aria-label={closeLabel} />
      <div
        className={cn(
          'relative w-full rounded-t-3xl border border-border bg-[hsl(var(--popover))] text-foreground shadow-[0_-12px_36px_rgba(2,6,23,0.28)] ring-1 ring-border/60',
          'dark:shadow-[0_-10px_28px_rgba(2,6,23,0.5)]',
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
};
