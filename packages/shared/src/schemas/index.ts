import { z } from 'zod';

export const MetricPayloadSchema = z.object({
  serverId: z.string().min(1),
  cpu: z.number().min(0).max(100),
  memory: z.number().min(0).max(100),
  disk: z.number().min(0).max(100),
  network: z.number().min(0),
});

export const CreateServerSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
});
