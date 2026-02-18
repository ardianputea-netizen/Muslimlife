import { ASMAUL_HUSNA_99 } from './asmaulHusna';
import { AZKAR_CATALOG } from './dua-dzikir/azkarCatalog';

export const ASMAUL_HUSNA = ASMAUL_HUSNA_99.map((item) => ({
  arab: item.arabic,
  latin: item.latin,
  arti: item.meaningId,
  sourceLabel: item.sourceLabel,
}));

export const AZKAR_MORNING = AZKAR_CATALOG.map((item) => ({
  title: item.title,
  arab: item.arabicText,
  arti: item.meaningId,
  sourceLabel: item.sourceLabel,
}));
