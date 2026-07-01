import { Router } from 'express';
import builderRoutes from '../routes/builder';

const router = Router();

router.use(builderRoutes);

export default router;
