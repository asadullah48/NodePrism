export interface CheckResult {
  success: boolean;
  latencyMs: number;
}

export async function checkHttp(target: string): Promise<CheckResult> {
  const start = Date.now();
  try {
    const response = await fetch(target, {
      signal: AbortSignal.timeout(10_000),
    });
    return { success: response.ok, latencyMs: Date.now() - start };
  } catch {
    return { success: false, latencyMs: 0 };
  }
}
