import { Request, Response, NextFunction } from 'express';
import {
  generateProject, listModels, getModel, updateModel, deleteModel,
  addField, removeField, addRelation, removeRelation, initProject,
} from '../../app/services/builder.service';
import { sendSuccess } from '../../../utils/api-response';
import { logStream } from '../../../utils/log-stream';

export const BuilderController = {
  health(_req: Request, res: Response) {
    sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() });
  },

  logStream(req: Request, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const existing = logStream.getLogs();
    for (const entry of existing) {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }

    const handler = (entry: any) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };
    logStream.on('log', handler);

    req.on('close', () => {
      logStream.off('log', handler);
    });
  },

  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await generateProject(req.body);
      sendSuccess(res, result.model, result.message, 201);
    } catch (err) {
      next(err);
    }
  },

  async initProject(_req: Request, res: Response, next: NextFunction) {
    try {
      const models = await initProject();
      sendSuccess(res, models, 'Project initialized with seed models');
    } catch (err) {
      next(err);
    }
  },

  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const models = await listModels();
      sendSuccess(res, models);
    } catch (err) {
      next(err);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const model = await getModel(req.params.name as string);
      sendSuccess(res, model);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { fields, roles, softDelete, enablePagination } = req.body;
      const extra = { roles, softDelete, enablePagination };
      const result = await updateModel(req.params.name as string, fields, extra);
      sendSuccess(res, result.model, result.message);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await deleteModel(req.params.name as string);
      sendSuccess(res, null, result.message);
    } catch (err) {
      next(err);
    }
  },

  async createField(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await addField(req.params.name as string, req.body);
      sendSuccess(res, result.model, result.message, 201);
    } catch (err) {
      next(err);
    }
  },

  async deleteField(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await removeField(req.params.name as string, req.params.fieldName as string);
      sendSuccess(res, result.model, result.message);
    } catch (err) {
      next(err);
    }
  },

  async createRelation(req: Request, res: Response, next: NextFunction) {
    try {
      const { fieldName, type: relationType, model: targetModel } = req.body;
      const result = await addRelation(req.params.name as string, fieldName, relationType, targetModel);
      sendSuccess(res, result.model, result.message, 201);
    } catch (err) {
      next(err);
    }
  },

  async deleteRelation(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await removeRelation(req.params.name as string, req.params.relationName as string);
      sendSuccess(res, result.model, result.message);
    } catch (err) {
      next(err);
    }
  },
};
