import React, { useMemo, useState } from 'react';
import { HandHeart, Moon, MoonStar, Utensils, X } from 'lucide-react';
import { RAMADHAN_ABSEN_ITEMS, RamadhanAbsenItemKey } from '@/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ChecklistItemKey = 'sahur' | 'puasa' | 'tarawih' | 'sedekah';

interface DailyAbsenProps {
  selectedDate: string;
  isLoading: boolean;
  selectedDay: {
    sahur: boolean;
    puasa: boolean;
    tarawih: boolean;
    sedekah: boolean;
    notes?: string | null;
  } | null;
  savingItem: ChecklistItemKey | null;
  onToggle: (item: RamadhanAbsenItemKey) => void;
}

const ICON_BY_KEY: Record<RamadhanAbsenItemKey, React.ComponentType<{ className?: string }>> = {
  sahur: Utensils,
  puasa: Moon,
  tarawih: MoonStar,
  sedekah: HandHeart,
};

const ICON_BG_BY_KEY: Record<RamadhanAbsenItemKey, string> = {
  sahur: 'bg-amber-50 text-amber-700',
  puasa: 'bg-indigo-50 text-indigo-700',
  tarawih: 'bg-violet-50 text-violet-700',
  sedekah: 'bg-rose-50 text-rose-700',
};

export const DailyAbsen: React.FC<DailyAbsenProps> = ({
  selectedDate,
  isLoading,
  selectedDay,
  savingItem,
  onToggle,
}) => {
  const [openInfoKey, setOpenInfoKey] = useState<RamadhanAbsenItemKey | null>(null);
  const [showCongrats, setShowCongrats] = useState(false);

  const hasSelection = Boolean(selectedDay);
  const disabledState = isLoading || !hasSelection;

  const checkedMap = useMemo(
    () => ({
      sahur: Boolean(selectedDay?.sahur),
      puasa: Boolean(selectedDay?.puasa),
      tarawih: Boolean(selectedDay?.tarawih),
      sedekah: Boolean(selectedDay?.sedekah),
    }),
    [selectedDay]
  );

  const allCompleted = checkedMap.sahur && checkedMap.puasa && checkedMap.tarawih && checkedMap.sedekah;

  React.useEffect(() => {
    if (!selectedDay) return;
    if (allCompleted) {
      setShowCongrats(true);
    }
  }, [allCompleted, selectedDay]);

  return (
    <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-800">ABSEN HARIAN</h2>
        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{selectedDate}</span>
      </div>

      {isLoading || !selectedDay ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-24 rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <TooltipProvider>
          <div className="space-y-3">
            {RAMADHAN_ABSEN_ITEMS.map((item) => {
              const Icon = ICON_BY_KEY[item.key];
              const checked = checkedMap[item.key];
              const infoOpen = openInfoKey === item.key;
              const switching = savingItem === item.key;

              return (
                <Card
                  key={item.key}
                  className={cn(
                    'rounded-2xl border border-gray-100 bg-white shadow-sm',
                    checked ? 'border-emerald-200 bg-emerald-50/30' : ''
                  )}
                >
                  <CardContent className="p-3">
                    <Collapsible open={infoOpen}>
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'h-11 w-11 shrink-0 rounded-xl flex items-center justify-center',
                            ICON_BG_BY_KEY[item.key]
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-gray-900">{item.title}</p>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 rounded-full p-0 text-amber-600 hover:bg-amber-100 hover:text-amber-700"
                                  aria-label={`Lihat niat atau keutamaan ${item.title}`}
                                  onClick={() => setOpenInfoKey((prev) => (prev === item.key ? null : item.key))}
                                >
                                  !
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Lihat niat/keutamaan</TooltipContent>
                            </Tooltip>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{item.subtitle}</p>
                        </div>

                        <Switch
                          checked={checked}
                          disabled={disabledState || switching}
                          aria-label={`Absen ${item.title}`}
                          onCheckedChange={() => onToggle(item.key)}
                        />
                      </div>

                      <CollapsibleContent
                        forceMount
                        className={cn(
                          'overflow-hidden transition-all duration-300 data-[state=closed]:max-h-0 data-[state=open]:max-h-60 data-[state=closed]:opacity-0 data-[state=open]:opacity-100'
                        )}
                      >
                        <div className="pt-3">
                          <Separator className="my-2 border-t border-dashed border-emerald-200/80 bg-transparent" />
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <Badge
                                variant="secondary"
                                className="bg-white text-emerald-700 border border-emerald-200"
                              >
                                {item.infoBadge}
                              </Badge>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 rounded-full p-0 text-gray-500 hover:bg-white"
                                aria-label={`Tutup info ${item.title}`}
                                onClick={() => setOpenInfoKey(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {item.infoArabic ? (
                              <p className="mt-2 text-sm leading-relaxed text-right text-gray-800">{item.infoArabic}</p>
                            ) : null}
                            {item.infoLatin ? (
                              <p className="mt-2 text-xs leading-relaxed text-gray-700">
                                <span className="font-semibold">Latin:</span> {item.infoLatin}
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs leading-relaxed text-gray-700">
                              <span className="font-semibold">Indonesia:</span> {item.infoIndonesian}
                            </p>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      {selectedDay?.notes ? (
        <p className="text-xs text-gray-500 mt-3">Catatan: {selectedDay.notes}</p>
      ) : (
        <p className="text-xs text-gray-400 mt-3">Belum ada catatan harian.</p>
      )}

      {showCongrats ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xs rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl"
          >
            <div className="text-center">
              <p className="text-4xl">🎉✅</p>
              <h3 className="mt-2 text-base font-bold text-gray-900">MasyaAllah, lengkap!</h3>
              <p className="mt-1 text-xs text-gray-600">
                Kamu sudah menyelesaikan semua absen harian hari ini.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setShowCongrats(false)}
              className="mt-4 w-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Alhamdulillah
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
};
