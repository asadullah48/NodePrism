import { z } from 'zod';

export const MetricPayloadSchema = z.object({
  serverId: z.string().min(1),
  cpu: z.number().min(0).max(100),
  memory: z.number().min(0).max(100),
  disk: z.number().min(0).max(100),
  network: z.number().min(0),
});

export type MetricPayloadInput = z.infer<typeof MetricPayloadSchema>;

export const CreateServerSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1).regex(
    /^[a-zA-Z0-9._-]+$/,
    'Host must be a valid hostname or IP address'
  ),
});

export type CreateServerInput = z.infer<typeof CreateServerSchema>;

export const CreateUptimeCheckSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['http', 'tcp']),
  target: z.string().min(1),
  interval: z.number().int().min(10).max(3600).default(60),
});

export type CreateUptimeCheckInput = z.infer<typeof CreateUptimeCheckSchema>;

export const CheckResultSchema = z.object({
  success: z.boolean(),
  latencyMs: z.number().min(0),
  secret: z.string().min(1),
});

export type CheckResultInput = z.infer<typeof CheckResultSchema>;
