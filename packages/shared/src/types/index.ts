export interface Server {
  id: string;
  name: string;
  host: string;
  createdAt: Date;
}

export interface Metric {
  id: string;
  serverId: string;
  cpu: number;      // percentage 0-100
  memory: number;   // percentage 0-100
  disk: number;     // percentage 0-100
  network: number;  // bytes/s
  timestamp: Date;
}

export interface MetricPayload {
  serverId: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface SocketEvents {
  'metric:update': (metric: Metric) => void;
}

export interface UptimeCheck {
  id: string;
  name: string;
  type: 'http' | 'tcp';
  target: string;       // URL for http, "host:port" for tcp
  interval: number;     // seconds
  createdAt: Date;
}

export interface Incident {
  id: string;
  checkId: string;
  startedAt: Date;
  resolvedAt: Date | null;
}

export interface UptimeCheckWithStatus extends UptimeCheck {
  status: 'up' | 'down';
}

// Payload sent by the checker to POST /api/checks/:id/result.
// `secret` is a shared auth token, not a check result field.
export interface CheckResult {
  success: boolean;
  latencyMs: number;
  secret: string;
}
