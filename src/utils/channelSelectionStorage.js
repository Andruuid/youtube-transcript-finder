const SELECTED_CHANNELS_KEY = 'app-selected-channel-ids';
const FOCUSED_CHANNEL_KEY = 'app-focused-channel-id';
const LEGACY_SELECTED_CHANNELS_KEY = 'transcript-library-selected-channel-ids';
const LEGACY_FOCUSED_CHANNEL_KEY = 'transcript-library-focused-channel-id';

export function hasStoredSelectedChannelIds() {
  try {
    return (
      localStorage.getItem(SELECTED_CHANNELS_KEY) !== null ||
      localStorage.getItem(LEGACY_SELECTED_CHANNELS_KEY) !== null
    );
  } catch {
    return false;
  }
}

export function readStoredSelectedChannelIds() {
  try {
    const raw =
      localStorage.getItem(SELECTED_CHANNELS_KEY) ??
      localStorage.getItem(LEGACY_SELECTED_CHANNELS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(
      parsed.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())
    );
  } catch {
    return null;
  }
}

export function writeStoredSelectedChannelIds(channelIds) {
  try {
    localStorage.setItem(SELECTED_CHANNELS_KEY, JSON.stringify([...channelIds]));
    localStorage.removeItem(LEGACY_SELECTED_CHANNELS_KEY);
  } catch {
    // ignore quota / private browsing
  }
}

export function readStoredFocusedChannelId() {
  try {
    return (
      localStorage.getItem(FOCUSED_CHANNEL_KEY) ||
      localStorage.getItem(LEGACY_FOCUSED_CHANNEL_KEY) ||
      ''
    );
  } catch {
    return '';
  }
}

export function writeStoredFocusedChannelId(channelId) {
  try {
    if (channelId) {
      localStorage.setItem(FOCUSED_CHANNEL_KEY, channelId);
    } else {
      localStorage.removeItem(FOCUSED_CHANNEL_KEY);
    }
    localStorage.removeItem(LEGACY_FOCUSED_CHANNEL_KEY);
  } catch {
    // ignore quota / private browsing
  }
}

/** Keep only IDs that still exist in the loaded channel list. */
export function reconcileSelectedChannelIds(previousIds, availableChannelIds) {
  const available = new Set(availableChannelIds);
  const next = new Set();
  for (const id of previousIds) {
    if (available.has(id)) next.add(id);
  }
  return next;
}
