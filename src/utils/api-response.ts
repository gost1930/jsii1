import { Response } from 'express';

export function sendSuccess(res: Response, data: unknown, message?: string, status = 200) {
  res.status(status).json({ message: message ?? 'Success', data });
}

export function sendError(res: Response, status: number, message: string, details?: string) {
  res.status(status).json({ error: message, details });
}
