import { ModelDefinition } from "../generator/types";

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function camelCase(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function kebabCase(s: string) {
  return s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

export function plural(s: string) {
  return s.endsWith('y') ? s.slice(0, -1) + 'ies' : s + 's';
}

export function editableFields(fields: ModelDefinition['fields']) {
  return fields.filter((f) => f.name && !f.isId && f.name !== 'createdAt' && f.name !== 'updatedAt' && !f.relation);
}

export function searchableFields(fields: ModelDefinition['fields']) {
  return fields.filter((f) => f.name && f.type === 'String' && !f.isId && !f.relation);
}