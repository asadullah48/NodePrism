import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { initSocket } from './lib/socket';
import { serversRouter } from './routes/servers';
import { metricsRouter } from './routes/metrics';

const app = express();
const server = http.createServer(app);

initSocket(server);

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.use('/api/servers', serversRouter);
app.use('/api/metrics', metricsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT ?? 4000;
server.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
