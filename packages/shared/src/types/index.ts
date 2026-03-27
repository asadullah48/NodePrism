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
