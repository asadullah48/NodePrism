import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { prisma } from '../lib/prisma';
import { CreateUptimeCheckSchema, CheckResultSchema } from '@nodeprism/shared';
import { resolveIncidentAction } from '../lib/incidents';
import { sendSlackAlert } from '../lib/slack';

export const checksRouter = Router();

// List all checks with current status
checksRouter.get('/', async (_req, res) => {
  try {
    const checks = await prisma.uptimeCheck.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        incidents: {
          where: { resolvedAt: null },
          take: 1,
        },
      },
    });

    const result = checks.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      target: c.target,
      interval: c.interval,
      createdAt: c.createdAt,
      status: c.incidents.length > 0 ? 'down' : 'up',
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /checks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a check
checksRouter.post('/', async (req, res) => {
  const parsed = CreateUptimeCheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    const check = await prisma.uptimeCheck.create({ data: parsed.data });
    res.status(201).json(check);
  } catch (err) {
    console.error('POST /checks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Receive a ping result from the checker
checksRouter.post('/:id/result', async (req, res) => {
  const parsed = CheckResultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const expectedSecret = process.env.CHECKER_SECRET;
  const authHeader = req.headers.authorization ?? '';
  const providedSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const authorized =
    !!expectedSecret &&
    providedSecret.length === expectedSecret.length &&
    timingSafeEqual(Buffer.from(providedSecret), Buffer.from(expectedSecret));
  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const check = await prisma.uptimeCheck.findUnique({
      where: { id: req.params.id },
    });
    if (!check) return res.status(404).json({ error: 'Check not found' });

    const openIncident = await prisma.incident.findFirst({
      where: { checkId: check.id, resolvedAt: null },
    });

    const action = resolveIncidentAction(
      parsed.data.success,
      openIncident?.id ?? null
    );

    if (action === 'open') {
      await prisma.incident.create({ data: { checkId: check.id } });
      await sendSlackAlert(
        `:red_circle: *${check.name}* is DOWN\nTarget: \`${check.target}\`\nLatency: ${parsed.data.latencyMs}ms`
      );
    } else if (action === 'close' && openIncident) {
      const downtimeMs = Date.now() - openIncident.startedAt.getTime();
      const minutes = Math.round(downtimeMs / 60000);
      await prisma.incident.update({
        where: { id: openIncident.id },
        data: { resolvedAt: new Date() },
      });
      await sendSlackAlert(
        `:large_green_circle: *${check.name}* is back UP (was down ${minutes}m)\nTarget: \`${check.target}\``
      );
    }

    res.json({ action });
  } catch (err) {
    console.error('POST /checks/:id/result error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List incidents for a check
checksRouter.get('/:id/incidents', async (req, res) => {
  try {
    const incidents = await prisma.incident.findMany({
      where: { checkId: req.params.id },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    res.json(incidents);
  } catch (err) {
    console.error('GET /checks/:id/incidents error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a check (cascades to incidents via Prisma onDelete: Cascade)
checksRouter.delete('/:id', async (req, res) => {
  try {
    const check = await prisma.uptimeCheck.findUnique({
      where: { id: req.params.id },
    });
    if (!check) return res.status(404).json({ error: 'Check not found' });

    await prisma.uptimeCheck.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /checks/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
