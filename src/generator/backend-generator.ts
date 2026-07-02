import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ModelDefinition } from './types';
import { prismaTypeToTs, joiType, findDisplayName } from './types';
import { EXPORT_DIR, overwriteFile } from './writer';
import { PrismaSchemaBuilder } from './prisma-builder';
import { execSync } from 'node:child_process';
import { backendDevLibraries, backendLibraries } from '@/utils/backEndLibs';

function camelCase(s: string) { return s.charAt(0).toLowerCase() + s.slice(1); }
function kebabCase(s: string) { return s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''); }
function plural(s: string) { return s.endsWith('y') ? s.slice(0, -1) + 'ies' : s + 's'; }
function editableFields(fields: ModelDefinition['fields']) {
  return fields.filter((f) => f.name && !f.isId && f.name !== 'createdAt' && f.name !== 'updatedAt' && f.name !== 'deletedAt' && !f.relation);
}
function searchableFields(fields: ModelDefinition['fields']) {
  return fields.filter((f) => f.name && f.type === 'String' && !f.isId && !f.relation);
}

export const BackendGenerator = {
  bootstrap() {
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'package.json'), BackendGenerator.packageJson());
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'tsconfig.json'), BackendGenerator.tsconfig());
    overwriteFile(path.join(EXPORT_DIR, 'backend', '.env'), 'DATABASE_URL=postgresql://localhost:5432/mydb\nJWT_SECRET=change-me-to-a-random-secret\n');
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'src', 'app.ts'), BackendGenerator.app());
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'src', 'server.ts'), BackendGenerator.server());
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'prisma.config.ts'), BackendGenerator.prismaConfigFile());
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'src', 'config', 'prisma.ts'), BackendGenerator.prismaClientConfig());
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'src', 'core', 'app', 'base', 'try-catch-block.ts'), BackendGenerator.tryCatchBlock());
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'src', 'utils', 'BadRequestError.ts'), BackendGenerator.constraintError());
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'src', 'utils', 'validate-input.ts'), BackendGenerator.validateInput());
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'src', 'middlewares', 'checkAuth.ts'), BackendGenerator.checkAuth());
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'src', 'middlewares', 'checkRole.ts'), BackendGenerator.checkRole());

    const cwd = path.join(EXPORT_DIR, 'backend');
    try {
      // const { execSync } = require('node:child_process');
      if (backendLibraries.length) execSync(`npm install ${backendLibraries.join(' ')}`, { cwd, stdio: 'inherit', timeout: 120000 });
      if (backendDevLibraries.length) execSync(`npm install --save-dev ${backendDevLibraries.join(' ')}`, { cwd, stdio: 'inherit', timeout: 120000 });
      console.log('Backend dependencies installed successfully.');
    } catch {
      console.warn('Backend dependencies installation failed — run npm install manually.');
    }
  },

  cleanupStaleFiles(models: ModelDefinition[]) {
    const be = path.join(EXPORT_DIR, 'backend');
    const current = new Set(models.map((m) => camelCase(m.name)));

    // Clean stale dirs in api/routes
    const routesDir = path.join(be, 'src', 'api', 'routes');
    if (fs.existsSync(routesDir)) {
      for (const dir of fs.readdirSync(routesDir)) {
        if (!current.has(dir)) {
          try { fs.rmSync(path.join(routesDir, dir), { recursive: true, force: true }); } catch {}
        }
      }
    }

    // Clean stale model files in core subdirs
    const coreDirs = [
      path.join(be, 'src', 'core', 'app', 'base', 'dtos'),
      path.join(be, 'src', 'core', 'app', 'base', 'schemas'),
      path.join(be, 'src', 'core', 'app', 'services'),
      path.join(be, 'src', 'core', 'domains'),
      path.join(be, 'src', 'core', 'interfaces', 'controllers'),
      path.join(be, 'src', 'core', 'interfaces', 'infrastructure', 'repositories'),
    ];
    for (const coreDir of coreDirs) {
      if (fs.existsSync(coreDir)) {
        for (const file of fs.readdirSync(coreDir)) {
          const basename = path.basename(file, path.extname(file));
          if (!current.has(basename)) {
            try { fs.unlinkSync(path.join(coreDir, file)); } catch {}
          }
        }
      }
    }
  },

  generateAll(models: ModelDefinition[], fullRegenerate = false) {
    BackendGenerator.bootstrap();
    BackendGenerator.cleanupStaleFiles(models);

    const schemaPath = path.join(EXPORT_DIR, 'backend', 'prisma', 'schema.prisma');
    if (fullRegenerate || !fs.existsSync(schemaPath)) {
      overwriteFile(schemaPath, PrismaSchemaBuilder.build(models));
    } else {
      let existingContent = fs.readFileSync(schemaPath, 'utf-8');
      const existingNames = BackendGenerator.existingPrismaModelNames(schemaPath);
      const newModels = models.filter((m) => !existingNames.has(m.name));

      if (newModels.length > 0) {
        for (const newModel of newModels) {
          for (const field of newModel.fields) {
            if (field.relation?.type === 'belongsTo' && existingNames.has(field.relation.model)) {
              const reverseField = plural(camelCase(newModel.name));
              const reverseLine = `  ${reverseField} ${newModel.name}[]`;
              const blockStart = new RegExp(`(^model ${field.relation.model} \\{[\r\n]*)`, 'm');
              existingContent = existingContent.replace(blockStart, `$1${reverseLine}\n`);
            }
          }
        }
        const newDefinitions = '\n' + newModels.map((m) => PrismaSchemaBuilder.buildModel(m, models)).join('\n');
        overwriteFile(schemaPath, existingContent + newDefinitions);
      }
    }

    overwriteFile(path.join(EXPORT_DIR, 'backend', 'src', 'router.ts'), BackendGenerator.router(models));
    overwriteFile(path.join(EXPORT_DIR, 'backend', 'src', 'api', 'index.ts'), BackendGenerator.apiAggregator(models));

    for (const model of models) {
      BackendGenerator.generateModelFiles(model, models);
    }

  },

  runPrismaGenerate() {
    const cwd = path.join(EXPORT_DIR, 'backend');
    const schemaPath = path.join(cwd, 'prisma', 'schema.prisma');
    if (!fs.existsSync(schemaPath)) return;
    try {
      const { execSync } = require('node:child_process');
      execSync('npx prisma format', { cwd, stdio: 'inherit', timeout: 30000 });
      execSync('npx prisma generate', { cwd, stdio: 'inherit', timeout: 30000 });
      console.log('Prisma client generated successfully.');
    } catch {
      console.warn('Prisma generation skipped — run `npx prisma generate` manually after installing deps.');
    }
  },

  existingPrismaModelNames(schemaPath: string): Set<string> {
    if (!fs.existsSync(schemaPath)) return new Set();
    const content = fs.readFileSync(schemaPath, 'utf-8');
    const names = new Set<string>();
    const regex = /^model\s+(\w+)\s*\{/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) names.add(match[1]);
    }
    return names;
  },

  generateModelFiles(model: ModelDefinition, allModels: ModelDefinition[]) {
    const be = path.join(EXPORT_DIR, 'backend');
    const mv = camelCase(model.name);

    overwriteFile(path.join(be, 'src', 'core', 'app', 'base', 'schemas', `${mv}.ts`), BackendGenerator.schema(model, allModels));
    overwriteFile(path.join(be, 'src', 'core', 'app', 'base', 'dtos', `${mv}.ts`), BackendGenerator.dto(model));
    overwriteFile(path.join(be, 'src', 'core', 'app', 'services', `${mv}.service.ts`), BackendGenerator.service(model, allModels));
    overwriteFile(path.join(be, 'src', 'core', 'domains', `${mv}.ts`), BackendGenerator.domain(model));
    overwriteFile(path.join(be, 'src', 'core', 'interfaces', 'controllers', `${mv}.ctrl.ts`), BackendGenerator.controller(model, allModels));
    overwriteFile(path.join(be, 'src', 'core', 'interfaces', 'infrastructure', 'repositories', `${mv}.repo.ts`), BackendGenerator.repo(model, allModels));
    overwriteFile(path.join(be, 'src', 'api', 'routes', mv, 'index.ts'), BackendGenerator.apiIndex(model, allModels));
    overwriteFile(path.join(be, 'src', 'api', 'routes', mv, 'public', 'index.ts'), BackendGenerator.apiPublic(model, allModels));
    overwriteFile(path.join(be, 'src', 'api', 'routes', mv, 'private', 'index.ts'), BackendGenerator.apiPrivate(model, allModels));
  },

  packageJson() {
    return JSON.stringify({
      name: 'server', version: '1.0.0', private: true,
      scripts: { dev: 'ts-node -r tsconfig-paths/register src/server.ts', build: 'tsc', start: 'node dist/server.js' },
      dependencies: {},
      devDependencies: {},
    }, null, 2);
  },

  tsconfig() {
    return JSON.stringify({
      compilerOptions: {
        target: 'es2016', module: 'commonjs', rootDir: './src', outDir: './dist',
        esModuleInterop: true, forceConsistentCasingInFileNames: true,
        strict: true, skipLibCheck: true, allowJs: true, noImplicitAny: false, ignoreDeprecations: '5.0',
        baseUrl: './',
        paths: {
          '@/*': ['src/*'], '@config/*': ['src/config/*'], '@utils/*': ['src/utils/*'],
          '@core/*': ['src/core/*'], '@api/*': ['src/api/*'], '@middlewares/*': ['src/middlewares/*'],
        },
        types: ['node'],
      },
      include: ['src/**/*'], exclude: ['node_modules'],
    }, null, 2);
  },

  app() {
    return `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import router from './router';

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Agency API', version: '1.0.0', description: 'Auto-generated API documentation' },
    servers: [{ url: '/api' }],
  },
  apis: ['./src/api/routes/**/*.ts'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(router);

export default app;
`;
  },

  server() {
    return `import dotenv from 'dotenv';
dotenv.config();
import app from './app';

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(\`Server running on http://localhost:\${PORT}\`));
`;
  },

  prismaConfigFile() {
    return `import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
`;
  },

  prismaClientConfig() {
    return `import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
`;
  },

  checkAuth() {
    return `import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const checkAuth = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err: any = new Error('Unauthorized: no token provided');
    err.status = 401;
    return next(err);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    (req as any).user = decoded;
    next();
  } catch {
    const err: any = new Error('Unauthorized: invalid token');
    err.status = 401;
    return next(err);
  }
};
`;
  },

  checkRole() {
    return `import type { Request, Response, NextFunction } from 'express';
import { ConstraintError } from '@utils/BadRequestError';

export const checkRole = (...allowed: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const userRole = ((req as any).user?.role || 'PUBLIC').toLowerCase();
    if (allowed.length && !allowed.map(r => r.toLowerCase()).includes(userRole)) {
      return next(new ConstraintError('Forbidden: insufficient role', 403, 'FORBIDDEN', 'Insufficient permissions'));
    }
    next();
  };
`;
  },

  router(models: ModelDefinition[]) {
    const imports = models.map((m) => {
      const mv = camelCase(m.name);
      return `import ${mv}Routes from '@api/routes/${mv}/index';`;
    }).join('\n');
    const uses = models.map((m) => {
      const mv = camelCase(m.name);
      return `router.use('/api/${kebabCase(plural(mv))}', ${mv}Routes);`;
    }).join('\n');

    return `import { Router } from 'express';
${imports}

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

${uses}

router.use((_req, res) => res.status(404).json({ message: 'Not found' }));
router.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: { code: err.code || 'INTERNAL_ERROR', details: err.details || '' },
  });
});

export default router;
`;
  },

  apiAggregator(models: ModelDefinition[]) {
    return `import { Router } from 'express';
${models.map((m) => `import ${camelCase(m.name)}Routes from './routes/${camelCase(m.name)}/index';`).join('\n')}

const router = Router();
${models.map((m) => `router.use('/${kebabCase(plural(camelCase(m.name)))}', ${camelCase(m.name)}Routes);`).join('\n')}
export default router;
`;
  },

  apiIndex(_model: ModelDefinition, _allModels: ModelDefinition[]) {
    return `import { Router } from 'express';
import publicRoutes from './public';
import privateRoutes from './private';
import { checkAuth } from '@middlewares/checkAuth';

const router = Router();
router.use('/public', publicRoutes);
router.use('/private', checkAuth, privateRoutes);
export default router;
`;
  },

  apiPublic(model: ModelDefinition, allModels: ModelDefinition[]) {
    const Mn = model.name;
    const mv = camelCase(model.name);
    return `import { Router } from 'express';
import { ${Mn}Controller } from '@core/interfaces/controllers/${mv}.ctrl';

/**
 * @openapi
 * tags:
 *   name: ${plural(Mn)}
 *   description: ${Mn} management
 */
const router = Router();

/**
 * @openapi
 * /${kebabCase(plural(mv))}/public:
 *   get:
 *     tags: [${plural(Mn)}]
 *     summary: List all ${plural(mv)} with filtering, pagination & sorting
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: ${plural(Mn)} list
 */
router.get('/', ${Mn}Controller.getAll);

/**
 * @openapi
 * /${kebabCase(plural(mv))}/public/{id}:
 *   get:
 *     tags: [${plural(Mn)}]
 *     summary: Get ${Mn} by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: ${Mn} details
 */
router.get('/:id', ${Mn}Controller.getById);

export default router;
`;
  },

  apiPrivate(model: ModelDefinition, _allModels: ModelDefinition[]) {
    const Mn = model.name;
    const mv = camelCase(model.name);
    const roleGuard = model.roles?.length
      ? `\nimport { checkRole } from '@middlewares/checkRole';\n\nconst roleGuard = checkRole('${model.roles.join("', '")}');\n`
      : '\n';

    const hasRoles = model.roles && model.roles.length > 0;
    const idField = model.fields.find((f) => f.isId) || { name: 'id', type: 'Int' as const };
    const idOpenApiType = idField.type === 'Int' || idField.type === 'Float' ? 'integer' : 'string';
    return `import { Router } from 'express';
import { ${Mn}Controller } from '@core/interfaces/controllers/${mv}.ctrl';${roleGuard}
/**
 * @openapi
 * /${kebabCase(plural(mv))}/private:
 *   post:
 *     tags: [${plural(Mn)}]
 *     summary: Create a new ${Mn}
 *     responses:
 *       201:
 *         description: ${Mn} created
 *   delete:
 *     tags: [${plural(Mn)}]
 *     summary: Bulk delete ${plural(Mn)}
 *     responses:
 *       200:
 *         description: Bulk deleted
 */
const router = Router();

router.post('/', ${hasRoles ? 'roleGuard, ' : ''}${Mn}Controller.create);
router.put('/:id', ${hasRoles ? 'roleGuard, ' : ''}${Mn}Controller.update);
router.delete('/:id', ${hasRoles ? 'roleGuard, ' : ''}${Mn}Controller.remove);

/**
 * @openapi
 * /${kebabCase(plural(mv))}/private/bulk-delete:
 *   post:
 *     tags: [${plural(Mn)}]
 *     summary: Bulk delete ${plural(Mn)} by IDs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: ${idOpenApiType} }
 *     responses:
 *       200:
 *         description: ${plural(Mn)} bulk deleted
 */
router.post('/bulk-delete', ${hasRoles ? 'roleGuard, ' : ''}${Mn}Controller.bulkDelete);

export default router;
`;
  },

  controller(model: ModelDefinition, _allModels: ModelDefinition[]) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import type { Request, Response } from 'express';
import { ${Mn}Service } from '@core/app/services/${mv}.service';
import { TryCatchBlock } from '@core/app/base/try-catch-block';

export const ${Mn}Controller = {
  getAll: TryCatchBlock(async (req: Request, res: Response) => {
    const { page, limit, sortBy, sortOrder, ...filters } = req.query;
    const data = await ${Mn}Service.findAll({
      page: String(page || ''),
      limit: String(limit || ''),
      sortBy: String(sortBy || ''),
      sortOrder: String(sortOrder || ''),
      filters,
    });
    res.json({ message: '${plural(Mn)} retrieved successfully', ...data });
  }),

  getById: TryCatchBlock(async (req: Request, res: Response) => {
    const data = await ${Mn}Service.findById({ id: req.params.id as string });
    res.json({ message: '${Mn} retrieved successfully', data });
  }),

  create: TryCatchBlock(async (req: Request, res: Response) => {
    const data = await ${Mn}Service.create(req.body);
    res.status(201).json({ message: '${Mn} created successfully', data });
  }),

  update: TryCatchBlock(async (req: Request, res: Response) => {
    const data = await ${Mn}Service.update({ id: req.params.id as string, ...req.body });
    res.json({ message: '${Mn} updated successfully', data });
  }),

  remove: TryCatchBlock(async (req: Request, res: Response) => {
    await ${Mn}Service.remove({ id: req.params.id as string });
    res.json({ message: '${Mn} deleted successfully' });
  }),

  bulkDelete: TryCatchBlock(async (req: Request, res: Response) => {
    const { ids } = req.body;
    await ${Mn}Service.bulkRemove(ids);
    res.json({ message: '${plural(Mn)} deleted successfully' });
  }),
};
`;
  },

  repo(model: ModelDefinition, allModels: ModelDefinition[]) {
    const mv = camelCase(model.name);
    const Mn = model.name;

    const idField = model.fields.find((f) => f.isId) || { name: 'id', type: 'Int' as const };
    const idComparator = idField.type === 'Int' || idField.type === 'Float' ? 'Number(id)' : 'id';

    const relIncludes = model.fields
      .filter((f) => f.relation?.type === 'belongsTo')
      .map((f) => {
        const target = allModels.find((m) => m.name === f.relation!.model);
        const display = target ? findDisplayName(target.fields) : 'id';
        return `          ${f.name}: { select: { ${display}: true } },`;
      });
    const includeBlock = relIncludes.length
      ? `,\n        include: {\n${relIncludes.join('\n')}\n        }`
      : '';

    const searchFields = searchableFields(model.fields);
    const searchBlock = searchFields.length
      ? '\n' + searchFields.map((f) => `    if (filters.${f.name}) where.${f.name} = { contains: filters.${f.name} as string, mode: 'insensitive' };`).join('\n')
      : '';

    const usePagination = model.enablePagination !== false;

    const softDeleteWhere = model.softDelete
      ? `, deletedAt: null`
      : '';

    const deleteAction = model.softDelete
      ? `return prisma.${mv}.update({ where: { ${idField.name}: ${idComparator}${softDeleteWhere} }, data: { deletedAt: new Date() } });`
      : `return prisma.${mv}.delete({ where: { ${idField.name}: ${idComparator} } });`;

    const bulkDeleteAction = model.softDelete
      ? `return prisma.${mv}.updateMany({ where: { ${idField.name}: { in: ids }${softDeleteWhere} }, data: { deletedAt: new Date() } });`
      : `return prisma.${mv}.deleteMany({ where: { ${idField.name}: { in: ids } } });`;

    const paginationBlock = usePagination ? `
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      prisma.${mv}.findMany({
        where,
        orderBy,
        skip,
        take: limitNum${includeBlock},
      }),
      prisma.${mv}.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };` : `
    const items = await prisma.${mv}.findMany({
        where,
        orderBy${includeBlock},
      });

    return { data: items };`;

    return `import { prisma } from '@config/prisma';

export const ${Mn}Repo = {
  findAll: async ({ page, limit, sortBy, sortOrder, filters }: any) => {
    const where: any = {};
    ${model.softDelete ? 'where.deletedAt = null;' : ''}

    // Dynamic search filters
${searchBlock ? searchBlock : ''}

    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy as string] = sortOrder === 'desc' ? 'desc' : 'asc';
    } else {
      orderBy.createdAt = 'desc';
    }
${paginationBlock}
  },

  findById: async ({ id }: { id: string }) => {
    const comparator = ${idComparator};
    return prisma.${mv}.findUnique({ where: { ${idField.name}: comparator${softDeleteWhere} }${includeBlock} });
  },

  create: async (data: any) => {
    return prisma.${mv}.create({ data });
  },

  update: async ({ id, ...data }: { id: string }) => {
    const comparator = ${idComparator};
    return prisma.${mv}.update({ where: { ${idField.name}: comparator${softDeleteWhere} }, data });
  },

  remove: async ({ id }: { id: string }) => {
    const comparator = ${idComparator};
    ${deleteAction}
  },

  bulkRemove: async (ids: any[]) => {
    ${bulkDeleteAction}
  },

  count: async (where?: any) => {
    return prisma.${mv}.count({ where });
  },
};
`;
  },

  service(model: ModelDefinition, allModels: ModelDefinition[]) {
    const mv = camelCase(model.name);
    const Mn = model.name;

    const idField = model.fields.find((f) => f.isId) || { name: 'id', type: 'Int' as const };

    const searchFields = searchableFields(model.fields);
    const softDeleteCheck = model.softDelete
      ? ' || (item && item.deletedAt)'
      : '';
    const softDeleteWhere = model.softDelete
      ? '\n    where.deletedAt = null;'
      : '';

    return `import { ${Mn}Repo } from '@core/interfaces/infrastructure/repositories/${mv}.repo';
import { ConstraintError } from '@utils/BadRequestError';
import { validateInput } from '@utils/validate-input';
import { ${mv}Schema } from '@core/app/base/schemas/${mv}';

export const ${Mn}Service = {
  findAll: async ({ page, limit, sortBy, sortOrder, filters }: any) => {
    return ${Mn}Repo.findAll({ page, limit, sortBy, sortOrder, filters });
  },

  findById: async ({ id }: { id: string }) => {
    const item = await ${Mn}Repo.findById({ id });
    if (!item${softDeleteCheck}) {
      throw new ConstraintError('${Mn} not found', 404, 'NOT_FOUND', 'Resource does not exist');
    }
    return item;
  },

  create: async (input: any) => {
    const data = validateInput(${mv}Schema, input);
    return ${Mn}Repo.create(data);
  },

  update: async ({ id, ...input }: any) => {
    const data = validateInput(${mv}Schema, input);
    const item = await ${Mn}Repo.findById({ id });
    if (!item${softDeleteCheck}) {
      throw new ConstraintError('${Mn} not found', 404, 'NOT_FOUND', 'Resource does not exist');
    }
    return ${Mn}Repo.update({ id, ...data });
  },

  remove: async ({ id }: { id: string }) => {
    const item = await ${Mn}Repo.findById({ id });
    if (!item${softDeleteCheck}) {
      throw new ConstraintError('${Mn} not found', 404, 'NOT_FOUND', 'Resource does not exist');
    }
    return ${Mn}Repo.remove({ id });
  },

  bulkRemove: async (ids: ${idField.type === 'Int' || idField.type === 'Float' ? 'number[]' : 'string[]'}) => {
    return ${Mn}Repo.bulkRemove(ids);
  },
};
`;
  },

  schema(model: ModelDefinition, allModels?: ModelDefinition[]) {
    const mv = camelCase(model.name);
    const fields = editableFields(model.fields);
    const belongsToFks = model.fields
      .filter((f) => f.relation?.type === 'belongsTo')
      .map((f) => {
        const targetIdField = allModels ? PrismaSchemaBuilder.findIdField(f.relation!.model, allModels) : undefined;
        const isString = targetIdField?.type === 'String';
        return `  ${f.name}Id: Joi${isString ? '.string()' : '.number().integer()'}.required(),`;
      });
    return `import Joi from 'joi';

export const ${mv}Schema = Joi.object({
${fields.map((f) => `  ${f.name}: ${joiType(f)},`).join('\n')}${belongsToFks.length ? '\n' + belongsToFks.join('\n') : ''}
});
`;
  },

  dto(model: ModelDefinition) {
    const Mn = model.name;
    const relationImports = model.fields
      .filter((f) => f.relation)
      .map((f) => {
        const refModel = f.relation!.model;
        const refMv = camelCase(refModel);
        return `import type { ${refModel}DTO as ${refModel} } from './${refMv}';`;
      });
    const importBlock = relationImports.length ? relationImports.join('\n') + '\n' : '';
    return `${importBlock}export type ${Mn}DTO = {
${model.fields.map((f) => `  ${f.name}: ${prismaTypeToTs(f)};`).join('\n')}
};

export type Create${Mn}DTO = {
${editableFields(model.fields).map((f) => `  ${f.name}: ${prismaTypeToTs(f)};`).join('\n')}
};
`;
  },

  domain(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import type { ${Mn}DTO } from '@core/app/base/dtos/${mv}';

export class ${Mn} implements Entity {
  constructor(private data: ${Mn}DTO) {}

  getData(): ${Mn}DTO {
    return { ...this.data };
  }
}

export interface Entity {
  getData(): object;
}
`;
  },

  tryCatchBlock() {
    return `import type { Request, Response, NextFunction } from 'express';

export const TryCatchBlock =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
`;
  },

  constraintError() {
    return `export class ConstraintError extends Error {
  public status: number;
  public code: string;
  public details: string;

  constructor(message: string, status = 400, code = 'BAD_REQUEST', details = 'bad request') {
    super(message);
    this.name = 'ConstraintError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
`;
  },

  validateInput() {
    return `import Joi from 'joi';
import { ConstraintError } from './BadRequestError';

export const validateInput = <T>(schema: Joi.ObjectSchema<T>, data: unknown): T => {
  const { value, error } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    const messages = error.details.map((d) => d.message).join('; ');
    throw new ConstraintError('Missing or invalid field(s)', 400, 'VALIDATION_ERROR', messages);
  }
  return value;
};
`;
  },
};

