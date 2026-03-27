import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { CreateServerSchema } from '@nodeprism/shared';

export const serversRouter = Router();

serversRouter.get('/', async (_req, res) => {
  const servers = await prisma.server.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(servers);
});

serversRouter.post('/', async (req, res) => {
  const parsed = CreateServerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const server = await prisma.server.create({ data: parsed.data });
  res.status(201).json(server);
});
