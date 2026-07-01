import express from 'express';
import cors from 'cors';
import apiRouter from './api';
import { errorHandler } from './middlewares/error-handler';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.json({ message: 'Server is running' });
});

app.use('/api', apiRouter);

app.use(errorHandler);

export default app;
