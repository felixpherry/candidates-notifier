export function extractBroadcastId(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/\/([A-Za-z0-9]{8})(?:\/?$|\?.*$)/);

  if (match) {
    return match[1];
  }

  return trimmed;
}
