import * as path from 'node:path';
import * as fs from 'node:fs';
import { exec } from 'node:child_process';
import type { ModelDefinition } from './types';
import { ProjectManager } from './project-manager';
import { BackendGenerator } from './backend-generator';
import { FrontendGenerator } from './frontend-generator';
import { EXPORT_DIR } from './writer';
import { logStream } from '../utils/log-stream';
import { prisma } from '../config/database';

const projectManager = new ProjectManager(undefined, prisma);

let regenerationInProgress = false;
const regenerationQueue: (() => Promise<void>)[] = [];

function execAsync(command: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = exec(command, { cwd, timeout: 180000 }, (err, stdout, stderr) => {
      const output = stdout?.trim() || '';
      const errorOutput = stderr?.trim() || '';
      if (err) {
        reject({ err, stdout: output, stderr: errorOutput });
      } else {
        resolve(output);
      }
    });
    child.stdout?.on('data', (data: string) => {
      const line = data.toString().trim();
      if (line) logStream.info(line);
    });
    child.stderr?.on('data', (data: string) => {
      const line = data.toString().trim();
      if (line) logStream.warn(line);
    });
  });
}

let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await projectManager.loadFromDb();
    initialized = true;
  }
}

export async function addModel(model: ModelDefinition) {
  await ensureInitialized();
  await projectManager.add(model);
  queueRegeneration();
}

export async function removeModel(name: string) {
  await ensureInitialized();
  await projectManager.remove(name);
  if (projectManager.count > 0) queueRegeneration();
}

export async function setModels(models: ModelDefinition[]) {
  await ensureInitialized();
  await projectManager.clear();
  for (const m of models) {
    await projectManager.add(m);
  }
  queueRegeneration();
}

export async function getModels(): Promise<ModelDefinition[]> {
  await ensureInitialized();
  return projectManager.getAll();
}

async function runInstall(cwd: string, label: string) {
  const nodeModulesPath = path.join(cwd, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    logStream.info(`Skipping ${label} npm install — node_modules already exists`);
    return;
  }
  logStream.info(`Installing ${label} dependencies...`);
  try {
    await execAsync('npm install', cwd);
    logStream.success(`${label} dependencies installed.`);
  } catch {
    logStream.warn(`Warning: npm install failed for ${label}. Run it manually.`);
  }
}

async function runPrismaGenerate() {
  const cwd = path.join(EXPORT_DIR, 'backend');
  const schemaPath = path.join(cwd, 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) return;
  try {
    logStream.info('Generating Prisma client...');
    await execAsync('npx prisma format', cwd);
    await execAsync('npx prisma generate', cwd);
    logStream.success('Prisma client generated successfully.');
  } catch {
    logStream.warn('Prisma generation skipped — run `npx prisma generate` manually after installing deps.');
  }
}

function queueRegeneration() {
  const doRegenerate = async () => {
    regenerationInProgress = true;
    try {
      const models = projectManager.getAll();
      if (models.length === 0) return;

      logStream.info(`Regenerating scaffold for ${models.length} model(s): ${models.map((m) => m.name).join(', ')}`);

      BackendGenerator.generateAll(models, true);
      FrontendGenerator.generateAll(models);

      const backendDir = path.join(EXPORT_DIR, 'backend');
      const clientDir = path.join(EXPORT_DIR, 'client');

      await runInstall(backendDir, 'backend');
      await runInstall(clientDir, 'client');

      await runPrismaGenerate();

      logStream.success(`Scaffold generated at: ${EXPORT_DIR}`);
    } catch (err: any) {
      logStream.error(`Regeneration failed: ${err.message}`);
    } finally {
      regenerationInProgress = false;
      const next = regenerationQueue.shift();
      if (next) next();
    }
  };

  if (regenerationInProgress) {
    regenerationQueue.push(doRegenerate);
  } else {
    doRegenerate();
  }
}

export function regenerate(_fullRegenerate = false) {
  queueRegeneration();
}

export async function scaffold(model: ModelDefinition, _exportDir?: string) {
  await setModels([model]);
}

export async function clearAllModels() {
  await ensureInitialized();
  await projectManager.clear();
}

const defaultSeedModels: ModelDefinition[] = [
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'Int', isId: true, isRequired: true, defaultValue: 'autoincrement' },
      { name: 'email', type: 'String', isRequired: true, isUnique: true },
      { name: 'name', type: 'String', isOptional: true },
      { name: 'role', type: 'String', isRequired: true, hasDefault: true, defaultValue: '"USER"' },
      { name: 'active', type: 'Boolean', isRequired: true, hasDefault: true, defaultValue: 'true' },
      { name: 'createdAt', type: 'DateTime', isRequired: true, hasDefault: true, defaultValue: 'now()' },
      { name: 'updatedAt', type: 'DateTime', isRequired: true, hasDefault: true, defaultValue: 'now()' },
    ],
  },
  {
    name: 'Post',
    fields: [
      { name: 'id', type: 'Int', isId: true, isRequired: true, defaultValue: 'autoincrement' },
      { name: 'title', type: 'String', isRequired: true },
      { name: 'body', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', isRequired: true, hasDefault: true, defaultValue: 'now()' },
      { name: 'author', type: 'String', isRequired: false, relation: { type: 'belongsTo', model: 'User' } },
    ],
  },
];

export async function seedDefaultModels() {
  await ensureInitialized();
  await projectManager.add(defaultSeedModels[0]);
  queueRegeneration();
}
