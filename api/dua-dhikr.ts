import type { ServerlessRequestLike, ServerlessResponseLike } from '../lib/server/api/duaDhikr';
import {
  handleDuaDhikrCategories,
  handleDuaDhikrCategoryDetail,
  handleDuaDhikrCategoryItems,
  handleDuaDhikrPassthrough,
} from '../lib/server/api/duaDhikr';

type QueryValue = string | string[] | undefined;

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  const route = String(pickQuery(req.query?.route) || '').trim().toLowerCase();

  if (route === 'categories') {
    await handleDuaDhikrCategories(req, res);
    return;
  }

  if (route === 'category-items') {
    await handleDuaDhikrCategoryItems(req, res);
    return;
  }

  if (route === 'category-detail') {
    await handleDuaDhikrCategoryDetail(req, res);
    return;
  }

  if (route === 'passthrough') {
    await handleDuaDhikrPassthrough(req, res);
    return;
  }

  res.status(400).json({ success: false, ok: false, message: 'route dua-dhikr tidak valid.' });
}
