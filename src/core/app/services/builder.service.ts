import { camelCase } from '@/utils/fnHelpers';
import { addModel, getModels, removeModel as scaffoldRemove, regenerate, clearAllModels, seedDefaultModels } from '../../../generator/scaffold';
import type { ModelDefinition, ModelField } from '../../../generator/types';
import { AppError } from '../../../utils/AppError';

export async function generateProject(model: ModelDefinition) {
  try {
    await addModel(model);
    return { message: `Model "${model.name}" added successfully`, model };
  } catch (err: any) {
    throw new AppError(500, 'SCAFFOLD_ERROR', 'Failed to scaffold model', err.message);
  }
}

export async function listModels() {
  return getModels();
}

export async function getModel(name: string) {
  const models = await getModels();
  const model = models.find((m) => m.name === name);
  if (!model) throw new AppError(404, 'NOT_FOUND', `Model "${name}" not found`);
  return model;
}

export async function updateModel(name: string, fields: ModelField[], extra?: Partial<Pick<ModelDefinition, 'roles' | 'softDelete' | 'enablePagination'>>) {
  const models = await getModels();
  const existing = models.find((m) => m.name === name);
  if (!existing) throw new AppError(404, 'NOT_FOUND', `Model "${name}" not found`);
  existing.fields = fields;
  if (extra) {
    if (extra.roles !== undefined) existing.roles = extra.roles;
    if (extra.softDelete !== undefined) existing.softDelete = extra.softDelete;
    if (extra.enablePagination !== undefined) existing.enablePagination = extra.enablePagination;
  }
  await addModel(existing);
  regenerate(true);
  return { message: `Model "${name}" updated`, model: existing };
}

export async function deleteModel(name: string) {
  await scaffoldRemove(name);
  return { message: `Model "${name}" removed` };
}

export async function initProject() {
  await clearAllModels();
  await seedDefaultModels();
  return getModels();
}

export async function addField(modelName: string, field: ModelField) {
  const models = await getModels();
  const model = models.find((m) => m.name === modelName);
  if (!model) throw new AppError(404, 'NOT_FOUND', `Model "${modelName}" not found`);
  if (model.fields.some((f) => f.name === field.name)) {
    throw new AppError(409, 'CONFLICT', `Field "${field.name}" already exists on "${modelName}"`);
  }
  model.fields.push(field);
  await addModel(model);
  regenerate(true);
  return { message: `Field "${field.name}" added to "${modelName}"`, model };
}

export async function removeField(modelName: string, fieldName: string) {
  const models = await getModels();
  const model = models.find((m) => m.name === modelName);
  if (!model) throw new AppError(404, 'NOT_FOUND', `Model "${modelName}" not found`);
  const idx = model.fields.findIndex((f) => f.name === fieldName);
  if (idx === -1) throw new AppError(404, 'NOT_FOUND', `Field "${fieldName}" not found on "${modelName}"`);
  model.fields.splice(idx, 1);
  await addModel(model);
  regenerate(true);
  return { message: `Field "${fieldName}" removed from "${modelName}"`, model };
}

export async function addRelation(modelName: string, fieldName: string, relationType: 'belongsTo' | 'hasMany', targetModel: string) {
  const models = await getModels();
  const model = models.find((m) => m.name === modelName);
  if (!model) throw new AppError(404, 'NOT_FOUND', `Model "${modelName}" not found`);
  const target = models.find((m) => m.name === targetModel);
  if (!target) throw new AppError(404, 'NOT_FOUND', `Target model "${targetModel}" not found`);

  if (model.fields.some((f) => f.name === fieldName)) {
    throw new AppError(409, 'CONFLICT', `Field "${fieldName}" already exists on "${modelName}"`);
  }

  if (relationType === 'belongsTo') {
    const idField = target.fields.find((f) => f.isId);
    model.fields.push({
      name: fieldName,
      type: (idField?.type as any) || 'Int',
      isRequired: false,
      relation: { type: 'belongsTo', model: targetModel },
    });
    const reverseName = camelCase(modelName);
    if (!target.fields.some((f) => f.name === reverseName && f.relation?.type === 'hasMany')) {
      target.fields.push({
        name: reverseName,
        type: 'Int',
        isOptional: true,
        relation: { type: 'hasMany', model: modelName },
      });
    }
  } else {
    model.fields.push({
      name: fieldName,
      type: 'Int',
      isOptional: true,
      relation: { type: 'hasMany', model: targetModel },
    });
    const reverseName = camelCase(modelName);
    if (!target.fields.some((f) => f.name === reverseName && f.relation?.type === 'belongsTo')) {
      const idField = model.fields.find((f) => f.isId);
      target.fields.push({
        name: reverseName,
        type: (idField?.type as any) || 'Int',
        isRequired: false,
        relation: { type: 'belongsTo', model: modelName },
      });
    }
  }

  await addModel(model);
  await addModel(target);
  regenerate(true);
  return { message: `Relation "${fieldName}" (${relationType} ${targetModel}) added to "${modelName}"`, model };
}

export async function removeRelation(modelName: string, fieldName: string) {
  const models = await getModels();
  const model = models.find((m) => m.name === modelName);
  if (!model) throw new AppError(404, 'NOT_FOUND', `Model "${modelName}" not found`);
  const field = model.fields.find((f) => f.name === fieldName);
  if (!field) throw new AppError(404, 'NOT_FOUND', `Relation "${fieldName}" not found on "${modelName}"`);

  if (field.relation) {
    const reverseName = camelCase(modelName);
    const other = models.find((m) => m.name === field.relation!.model);
    if (other) {
      const reverseType = field.relation.type === 'belongsTo' ? 'hasMany' : 'belongsTo';
      const revIdx = other.fields.findIndex((f) => f.name === reverseName && f.relation?.type === reverseType);
      if (revIdx !== -1) other.fields.splice(revIdx, 1);
      await addModel(other);
    }
  }

  const idx = model.fields.findIndex((f) => f.name === fieldName);
  if (idx !== -1) model.fields.splice(idx, 1);
  await addModel(model);
  regenerate(true);
  return { message: `Relation "${fieldName}" removed from "${modelName}"`, model };
}
