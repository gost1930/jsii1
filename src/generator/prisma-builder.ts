import type { ModelDefinition } from './types';

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export const PrismaSchemaBuilder = {
  build(models: ModelDefinition[]): string {
    const enums = PrismaSchemaBuilder.collectEnums(models);
    const header = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

`;
    const enumBlocks = enums.length
      ? enums.map((e) => `enum ${e.name} {\n${e.values.map((v) => `  ${v}`).join('\n')}\n}`).join('\n\n') + '\n\n'
      : '';
    const bodies = models.map((m) => PrismaSchemaBuilder.buildModel(m, models));
    return header + enumBlocks + bodies.join('\n');
  },

  collectEnums(models: ModelDefinition[]): { name: string; values: string[] }[] {
    const seen = new Map<string, string[]>();
    for (const m of models) {
      for (const f of m.fields) {
        if (f.enumValues?.length) {
          const enumName = capitalize(f.name);
          if (!seen.has(enumName)) {
            seen.set(enumName, f.enumValues);
          }
        }
      }
    }
    return Array.from(seen.entries()).map(([name, values]) => ({ name, values }));
  },

  buildModel(model: ModelDefinition, allModels: ModelDefinition[]): string {
    const lines: string[] = [`model ${model.name} {`];

    const explicitHasMany = new Set(
      model.fields
        .filter((f) => f.relation?.type === 'hasMany')
        .map((f) => f.relation!.model)
    );
    const reverseRelations = allModels
      .filter((m) => m.name !== model.name && !explicitHasMany.has(m.name))
      .flatMap((m) =>
        m.fields
          .filter((f) => f.relation?.type === 'belongsTo' && f.relation.model === model.name)
          .map((f) => ({ fieldName: f.name, sourceModelName: m.name }))
      );
    for (const rel of reverseRelations) {
      const fn = rel.sourceModelName.charAt(0).toLowerCase() + rel.sourceModelName.slice(1);
      const pluralized = fn.endsWith('y') ? fn.slice(0, -1) + 'ies' : fn + 's';
      lines.push(`  ${pluralized} ${rel.sourceModelName}[]`);
    }

    for (const f of model.fields) {
      if (f.relation?.type === 'hasMany') {
        lines.push(`  ${f.name} ${f.relation.model}[]`);
      } else if (f.relation?.type === 'belongsTo') {
        const fkName = `${f.name}Id`;
        const targetIdField = PrismaSchemaBuilder.findIdField(f.relation.model, allModels);
        const targetType = targetIdField?.type ?? 'Int';
        lines.push(`  ${fkName} ${targetType}`);
        lines.push(`  ${f.name} ${f.relation.model} @relation(fields: [${fkName}], references: [${targetIdField?.name ?? 'id'}])`);
      } else {
        const fieldType = f.enumValues?.length ? capitalize(f.name) : f.type;
        const parts = [`  ${f.name} ${fieldType}${f.isOptional ? '?' : ''}`];
        if (f.isId) parts.push('@id');
        if (f.isId && f.type === 'Int' && f.defaultValue === 'autoincrement') parts.push('@default(autoincrement())');
        if (f.isId && f.type === 'String' && f.defaultValue === 'uuid') parts.push('@default(uuid())');
        if (f.isId && f.type === 'String' && f.defaultValue === 'cuid') parts.push('@default(cuid())');
        if (f.isUnique) parts.push('@unique');
        if (f.hasDefault && f.defaultValue && !f.isId) {
          const dv = f.enumValues?.length ? f.defaultValue : f.defaultValue;
          parts.push(`@default(${dv})`);
        }
        lines.push(parts.join(' '));
      }
    }

    // Soft delete field (only if not already defined in model fields)
    if (model.softDelete && !model.fields.some((f) => f.name === 'deletedAt')) {
      lines.push('  deletedAt DateTime?');
    }

    lines.push('}');
    return lines.join('\n');
  },

  findIdField(modelName: string, allModels: ModelDefinition[]) {
    const m = allModels.find((x) => x.name === modelName);
    return m?.fields.find((f) => f.isId);
  },
};
