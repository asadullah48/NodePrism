import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { MetricPayloadSchema } from '@nodeprism/shared';
import { getIO } from '../lib/socket';

export const metricsRouter = Router();

metricsRouter.post('/', async (req, res) => {
  const parsed = MetricPayloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const metric = await prisma.metric.create({ data: parsed.data });

  // Broadcast to all connected dashboard clients
  getIO().emit('metric:update', metric);

  res.status(201).json(metric);
});

metricsRouter.get('/:serverId', async (req, res) => {
  const metrics = await prisma.metric.findMany({
    where: { serverId: req.params.serverId },
    orderBy: { timestamp: 'desc' },
    take: 60,
  });
  res.json(metrics.reverse());
});
