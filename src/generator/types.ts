export type PrismaType = 'Int' | 'String' | 'Boolean' | 'DateTime' | 'Float';

export interface RelationDef {
  type: 'hasMany' | 'belongsTo';
  model: string;
}

export interface ModelField {
  name: string;
  type: string;
  isId?: boolean;
  isUnique?: boolean;
  isRequired?: boolean;
  isOptional?: boolean;
  hasDefault?: boolean;
  defaultValue?: string;
  relation?: RelationDef;
  enumValues?: string[];
}

export interface ModelDefinition {
  name: string;
  fields: ModelField[];
  roles?: string[];
  softDelete?: boolean;
  enablePagination?: boolean;
}

export type FileMap = Record<string, string>;

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function prismaTypeToTs(field: ModelField): string {
  if (field.relation) {
    return field.relation.type === 'hasMany' ? `${field.relation.model}[]` : field.relation.model;
  }
  if (field.enumValues?.length) {
    const base = field.type;
    return field.isOptional ? `${base} | null` : base;
  }
  const base = prismaTypeToTsScalar(field.type as PrismaType);
  return field.isOptional ? `${base} | null` : base;
}

function prismaTypeToTsScalar(t: PrismaType): string {
  switch (t) {
    case 'Int':
    case 'Float':
      return 'number';
    case 'String':
      return 'string';
    case 'Boolean':
      return 'boolean';
    case 'DateTime':
      return 'Date';
  }
}

export function joiType(field: ModelField): string {
  if (field.relation) return 'Joi.any()';
  if (field.enumValues?.length) {
    const base = `Joi.string().valid('${field.enumValues.join("', '")}')`;
    return field.isRequired ? `${base}.required()` : `${base}.allow('', null)`;
  }
  if (field.type === 'String') {
    const base = 'Joi.string()';
    return field.isRequired ? `${base}.required()` : `${base}.allow('', null)`;
  }
  if (field.type === 'Int') {
    const base = 'Joi.number().integer()';
    return field.isRequired ? `${base}.required()` : `${base}.allow(null)`;
  }
  if (field.type === 'Float') {
    const base = 'Joi.number()';
    return field.isRequired ? `${base}.required()` : `${base}.allow(null)`;
  }
  if (field.type === 'Boolean') {
    const base = 'Joi.boolean()';
    return field.isRequired ? `${base}.required()` : `${base}.allow(null)`;
  }
  if (field.type === 'DateTime') {
    return 'Joi.date().iso()';
  }
  return 'Joi.any()';
}

export function zodType(field: ModelField, allModels?: ModelDefinition[]): string {
  if (field.relation) return 'z.any()';
  if (field.enumValues?.length) {
    const base = `z.enum(['${field.enumValues.join("', '")}'])`;
    return field.isOptional ? `${base}.nullable().optional()` : base;
  }
  const t = field.type === 'String' ? "z.string().min(1, 'Required')"
    : field.type === 'Boolean' ? 'z.boolean()'
    : field.type === 'Int' ? 'z.number().int()'
    : field.type === 'Float' ? 'z.number()'
    : field.type === 'DateTime' ? "z.string().datetime()" : 'z.any()';
  return field.isOptional ? `${t}.nullable().optional()` : t;
}

export function findDisplayName(fields: ModelField[]): string {
  const priority = ['title', 'name', 'label', 'email', 'username'];
  for (const p of priority) {
    const f = fields.find((x) => x.name === p && x.type === 'String');
    if (f) return f.name;
  }
  const firstString = fields.find((f) => f.type === 'String' && !f.isId);
  return firstString?.name ?? 'id';
}

export function isFileField(name: string): boolean {
  return /(image|file|avatar)$/i.test(name);
}
