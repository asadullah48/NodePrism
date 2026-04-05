import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { CreateServerSchema } from '@nodeprism/shared';

export const serversRouter = Router();

serversRouter.get('/', async (_req, res) => {
  try {
    const servers = await prisma.server.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(servers);
  } catch (err) {
    console.error('GET /servers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

serversRouter.post('/', async (req, res) => {
  const parsed = CreateServerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  try {
    const server = await prisma.server.upsert({
      where: { host: parsed.data.host },
      update: { name: parsed.data.name },
      create: parsed.data,
    });
    res.json(server);  // 200 always — upsert is idempotent
  } catch (err) {
    console.error('POST /servers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
