import { Request, Response, NextFunction } from 'express';

const PRISMA_TYPES = ['Int', 'String', 'Boolean', 'DateTime', 'Float'];

export function validateModelDefinition(req: Request, res: Response, next: NextFunction) {
  const model = req.body;

  if (!model?.name || !model.fields || !Array.isArray(model.fields)) {
    res.status(400).json({ error: 'Invalid model definition. Requires name (string) and fields (array).' });
    return;
  }

  if (model.fields.length === 0) {
    res.status(400).json({ error: 'Model must have at least one field.' });
    return;
  }

  for (const f of model.fields) {
    if (!f.name) {
      res.status(400).json({ error: 'Each field must have a non-empty name.' });
      return;
    }
  }

  next();
}

export function validateField(req: Request, res: Response, next: NextFunction) {
  const field = req.body;

  if (!field?.name || !PRISMA_TYPES.includes(field.type)) {
    res.status(400).json({
      error: 'Invalid field. Requires name (string) and type (' + PRISMA_TYPES.join('|') + ').',
    });
    return;
  }

  if (!field.name.trim()) {
    res.status(400).json({ error: 'Field name must not be empty.' });
    return;
  }

  next();
}

export function validateModelFields(req: Request, res: Response, next: NextFunction) {
  if (!req.body?.fields || !Array.isArray(req.body.fields)) {
    res.status(400).json({ error: 'Invalid request. Requires fields (array).' });
    return;
  }
  for (const f of req.body.fields) {
    if (!f.name) {
      res.status(400).json({ error: 'Each field must have a non-empty name.' });
      return;
    }
  }
  next();
}

export function validateRelation(req: Request, res: Response, next: NextFunction) {
  const { fieldName, type, model: targetModel } = req.body;

  if (!fieldName || !type || !targetModel) {
    res.status(400).json({ error: 'Invalid relation. Requires fieldName, type (belongsTo|hasMany), and model (target).' });
    return;
  }

  if (type !== 'belongsTo' && type !== 'hasMany') {
    res.status(400).json({ error: 'Relation type must be "belongsTo" or "hasMany".' });
    return;
  }

  next();
}
