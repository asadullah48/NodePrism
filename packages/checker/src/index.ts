import 'dotenv/config';
import { startRunner } from './runner';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const CHECKER_SECRET = process.env.CHECKER_SECRET ?? '';

if (!CHECKER_SECRET) {
  console.error('CHECKER_SECRET is required in .env');
  process.exit(1);
}

console.log(`Checker starting. API: ${API_URL}`);
startRunner(API_URL, CHECKER_SECRET).catch((err) => {
  console.error('Runner failed:', err);
  process.exit(1);
});
