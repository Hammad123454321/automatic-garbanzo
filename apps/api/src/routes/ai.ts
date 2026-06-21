import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ok, badRequest, serverError } from '../utils/response';
import { config } from '../config/env';

const router = Router();
router.use(authenticate);

// AI product description generator
router.post('/product-description', async (req: Request, res: Response) => {
  try {
    const { name, category, tags } = req.body;
    if (!name) return badRequest(res, 'Product name required');

    if (!config.openai.apiKey) {
      // Return a template if no API key
      return ok(res, {
        description: `${name} — a premium offering crafted with quality ingredients and care. Perfect for any occasion.`,
        tags: tags || [name.toLowerCase(), category?.toLowerCase()].filter(Boolean),
      });
    }

    const OpenAI = await import('openai');
    const openai = new OpenAI.default({ apiKey: config.openai.apiKey });

    const completion = await openai.chat.completions.create({
      model: 'claude-sonnet-4-6',
      messages: [{
        role: 'user',
        content: `Write a concise, appealing product description (2-3 sentences) for a POS menu item called "${name}"${category ? ` in the ${category} category` : ''}. Also suggest 3-5 relevant tags. Return JSON: { "description": "...", "tags": ["..."] }`,
      }],
      max_tokens: 200,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);
    return ok(res, result);
  } catch (e) {
    return serverError(res, e);
  }
});

// AI product suggestions based on sales data
router.post('/product-suggestions', async (req: Request, res: Response) => {
  try {
    const { storeId, topProducts, lowPerformers } = req.body;
    if (!storeId) return badRequest(res, 'storeId required');

    // In production, this uses real sales data to generate AI suggestions
    const suggestions = [
      { type: 'restock', message: 'Reorder your top 5 selling items — inventory is running low on 3 of them.' },
      { type: 'bundle', message: 'Consider creating a combo deal with your two most frequently co-purchased items.' },
      { type: 'retire', message: 'Remove or discount slow-moving items that haven\'t sold in 30+ days.' },
      { type: 'timing', message: 'Your peak hours are 12–2 PM. Consider targeted lunch promotions.' },
    ];

    return ok(res, suggestions);
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
