export type StatusTimer = {
  stop: (finalMessage?: string) => number;
};

export function startStatusTimer(label: string): StatusTimer {
  const startedAt = Date.now();

  const render = (): void => {
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    process.stdout.write(`\r${label} ${elapsedSeconds}s`);
  };

  render();
  const interval = setInterval(render, 1000);

  return {
    stop(finalMessage?: string) {
      clearInterval(interval);
      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      const message = finalMessage ?? `${label} done in ${elapsedSeconds.toFixed(1)}s`;
      process.stdout.write(`\r${message}${" ".repeat(20)}\n`);
      return elapsedSeconds;
    }
  };
}

export function formatElapsedSeconds(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}
