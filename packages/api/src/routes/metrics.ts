import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { MetricPayloadSchema } from '@nodeprism/shared';
import { getIO } from '../lib/socket';

export const metricsRouter = Router();

metricsRouter.post('/', async (req, res) => {
  const parsed = MetricPayloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  try {
    const metric = await prisma.metric.create({ data: parsed.data });
    getIO().emit('metric:update', metric);
    res.status(201).json(metric);
  } catch (err) {
    console.error('POST /metrics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

metricsRouter.get('/:serverId', async (req, res) => {
  try {
    const metrics = await prisma.metric.findMany({
      where: { serverId: req.params.serverId },
      orderBy: { timestamp: 'desc' },
      take: 60,
    });
    res.json(metrics.reverse());
  } catch (err) {
    console.error('GET /metrics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
