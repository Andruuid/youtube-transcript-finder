export const CHANNEL_LIST_EXPORT_VERSION = 1;

export function buildChannelListExportPayload(channels) {
  return {
    version: CHANNEL_LIST_EXPORT_VERSION,
    app: 'YTTranscripts',
    exportedAt: new Date().toISOString(),
    channels: (channels || []).map((c) => ({
      youtubeChannelId: c.youtubeChannelId,
      title: c.title,
      ...(c.handle ? { handle: c.handle } : {})
    }))
  };
}

export function downloadChannelListJson(channels) {
  const payload = buildChannelListExportPayload(channels);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `yttranscripts-channels-${date}.json`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

function extractChannelInput(item) {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    return trimmed || null;
  }
  if (!item || typeof item !== 'object') return null;
  const candidates = [
    item.channelInput,
    item.input,
    item.url,
    item.handle,
    item.youtubeChannelId,
    item.channelId,
    item.id
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Parses exported JSON or a plain array of channel inputs / objects.
 * @returns {{ entries: Array<{ input: string, label: string }> }}
 */
export function parseChannelListImport(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON file');
  }

  let rawItems;
  if (Array.isArray(data)) {
    rawItems = data;
  } else if (data && typeof data === 'object' && Array.isArray(data.channels)) {
    rawItems = data.channels;
  } else {
    throw new Error(
      'JSON must be an array of channels or an object with a "channels" array'
    );
  }

  if (rawItems.length === 0) {
    throw new Error('No channels found in JSON file');
  }

  const entries = [];
  const seen = new Set();
  for (const item of rawItems) {
    const input = extractChannelInput(item);
    if (!input) continue;
    const key = input.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const label =
      typeof item === 'object' && item?.title ? String(item.title) : input;
    entries.push({ input, label });
  }

  if (entries.length === 0) {
    throw new Error('No valid channel entries found in JSON file');
  }

  return { entries };
}
