import React from 'react';

interface CountdownPanelProps {
  targetLabel: string;
  countdown: string;
}

export const CountdownPanel: React.FC<CountdownPanelProps> = ({ targetLabel, countdown }) => {
  return (
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
      <p className="text-xs font-semibold text-emerald-700">Countdown ke {targetLabel}</p>
      <p className="mt-2 text-3xl font-bold tracking-wide text-emerald-900 font-mono">{countdown}</p>
    </section>
  );
};

