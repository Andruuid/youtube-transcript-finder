import { apiFetch } from './apiClient';

async function parseJsonResponse(res, fallbackMessage) {
  const raw = await res.text();
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    throw new Error(body.error || raw || fallbackMessage);
  }
  return body;
}

function isJsonFile(name) {
  return /\.json$/i.test(String(name || ''));
}

async function readJsonFromFileHandle(handle, filename) {
  const file = await handle.getFile();
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON in ${filename}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${filename} must contain a JSON object`);
  }
  return { filename, data };
}

async function readJsonFromBrowserFile(file) {
  const filename = file.name || 'unknown.json';
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON in ${filename}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${filename} must contain a JSON object`);
  }
  return { filename, data };
}

/**
 * Pick a folder and read all top-level .json files.
 * @returns {Promise<Array<{ filename: string, data: object }>>}
 */
export async function pickAndReadStructuredSummaryFolder() {
  if (typeof window.showDirectoryPicker === 'function') {
    const dir = await window.showDirectoryPicker({ mode: 'read' });
    const items = [];
    const errors = [];

    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !isJsonFile(name)) continue;
      try {
        items.push(await readJsonFromFileHandle(handle, name));
      } catch (error) {
        errors.push(error?.message || String(error));
      }
    }

    if (items.length === 0 && errors.length === 0) {
      throw new Error('No .json files found in the selected folder.');
    }
    if (items.length === 0 && errors.length > 0) {
      throw new Error(errors[0]);
    }

    return { items, errors };
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.json,application/json';
    input.setAttribute('webkitdirectory', '');
    input.style.display = 'none';

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener('change', async () => {
      const files = [...(input.files || [])].filter((f) => isJsonFile(f.name));
      cleanup();
      if (files.length === 0) {
        reject(new Error('No .json files found in the selected folder.'));
        return;
      }

      const items = [];
      const errors = [];
      for (const file of files) {
        try {
          items.push(await readJsonFromBrowserFile(file));
        } catch (error) {
          errors.push(error?.message || String(error));
        }
      }

      if (items.length === 0) {
        reject(new Error(errors[0] || 'No valid JSON files found.'));
        return;
      }
      resolve({ items, errors });
    });

    input.addEventListener('cancel', () => {
      cleanup();
      reject(new Error('Folder selection cancelled.'));
    });

    document.body.appendChild(input);
    input.click();
  });
}

export async function importStructuredSummariesFromFolder(youtubeChannelId) {
  const { items, errors = [] } = await pickAndReadStructuredSummaryFolder();
  const res = await apiFetch(
    `/api/channels/${encodeURIComponent(youtubeChannelId)}/import-structured-summaries`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    }
  );
  const result = await parseJsonResponse(res, 'Structured summary import failed');
  return { ...result, readErrors: errors };
}

function formatImportResultMessage(result) {
  const parts = [];
  if (result.imported > 0) {
    parts.push(`Imported ${result.imported} structured summar${result.imported === 1 ? 'y' : 'ies'}.`);
  }
  if (result.skipped > 0) {
    parts.push(`${result.skipped} file${result.skipped === 1 ? '' : 's'} skipped.`);
  }
  if (result.readErrors?.length) {
    parts.push(`${result.readErrors.length} file${result.readErrors.length === 1 ? '' : 's'} failed to parse locally.`);
  }
  return parts.join(' ');
}

export function summarizeStructuredImportResult(result) {
  const message = formatImportResultMessage(result);
  const partialFailures =
    (result.skipped || 0) > 0 ||
    (result.readErrors?.length || 0) > 0 ||
    (result.results || []).some((row) => row.status !== 'imported');
  return { message, partialFailures };
}
