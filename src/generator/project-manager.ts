import type { ModelDefinition } from './types';
import type { PrismaClient } from '../generated/prisma/client';

export class ProjectManager {
  private models: ModelDefinition[] = [];
  private prisma?: PrismaClient;

  constructor(initial?: ModelDefinition[], prisma?: PrismaClient) {
    if (initial) this.models = [...initial];
    if (prisma) this.prisma = prisma;
  }

  setPrisma(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async loadFromDb() {
    if (!this.prisma) return;
    const rows = await this.prisma.storedModel.findMany();
    this.models = rows.map((r: { data: string }) => JSON.parse(r.data));
  }

  private async persist() {
    if (!this.prisma) return;
    await this.prisma.storedModel.deleteMany();
    for (const model of this.models) {
      await this.prisma.storedModel.create({
        data: { name: model.name, data: JSON.stringify(model) },
      });
    }
  }

  async add(model: ModelDefinition): Promise<void> {
    const existing = this.models.find((m) => m.name === model.name);
    if (existing) {
      Object.assign(existing, model);
    } else {
      this.models.push(model);
    }
    await this.persist();
  }

  async remove(name: string): Promise<void> {
    this.models = this.models.filter((m) => m.name !== name);
    await this.persist();
  }

  get(name: string): ModelDefinition | undefined {
    return this.models.find((m) => m.name === name);
  }

  getAll(): ModelDefinition[] {
    return [...this.models];
  }

  async clear(): Promise<void> {
    this.models = [];
    await this.persist();
  }

  get count(): number {
    return this.models.length;
  }
}
