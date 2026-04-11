export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getProgress(currentTime: number, duration: number): number {
  if (!duration || !isFinite(duration)) return 0;
  return Math.min((currentTime / duration) * 100, 100);
}
