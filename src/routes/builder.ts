import { Router } from 'express';
import { BuilderController } from '../core/interfaces/controllers/builder.controller';
import { validateModelDefinition, validateModelFields, validateField, validateRelation } from '../middlewares/validate';

const router = Router();

router.get('/health', BuilderController.health);

// Log stream SSE
router.get('/logs', BuilderController.logStream);

router.get('/models', BuilderController.list);
router.get('/models/:name', BuilderController.getOne);
router.put('/models/:name', validateModelFields, BuilderController.update);
router.delete('/models/:name', BuilderController.remove);

router.post('/models/:name/fields', validateField, BuilderController.createField);
router.delete('/models/:name/fields/:fieldName', BuilderController.deleteField);

router.post('/models/:name/relations', validateRelation, BuilderController.createRelation);
router.delete('/models/:name/relations/:relationName', BuilderController.deleteRelation);

router.post('/generate', validateModelDefinition, BuilderController.generate);

router.post('/init', BuilderController.initProject);

export default router;
