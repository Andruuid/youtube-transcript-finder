const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Max chars when stringifying metadata / snippets for logs and user-facing errors. */
const DETAIL_CAP = 2500;

function safeJsonSnippet(obj, maxLen = DETAIL_CAP) {
  try {
    const s = JSON.stringify(obj);
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  } catch {
    return String(obj);
  }
}

/**
 * Builds a detailed message from OpenRouter error docs shape:
 * `{ error: { code, message, metadata?: { provider_name, raw, reasons, … } } }`
 * Also handles `choices[0].finish_reason === 'error'`.
 */
function formatOpenRouterFailure(httpStatus, body, rawText) {
  const parts = [];
  if (httpStatus != null) parts.push(`HTTP ${httpStatus}`);

  const err = body?.error;
  if (err != null) {
    if (typeof err === 'string') {
      parts.push(err);
    } else if (typeof err === 'object') {
      if (err.message != null && err.message !== '') {
        parts.push(String(err.message));
      }
      if (err.code !== undefined && err.code !== '') {
        parts.push(`code=${String(err.code)}`);
      }
      if (err.metadata != null && typeof err.metadata === 'object') {
        const m = err.metadata;
        if (m.provider_name) parts.push(`provider=${String(m.provider_name)}`);
        if (m.model_slug) parts.push(`model_slug=${String(m.model_slug)}`);
        if (Array.isArray(m.reasons) && m.reasons.length) {
          parts.push(`reasons=${safeJsonSnippet(m.reasons, 800)}`);
        }
        if (m.raw !== undefined && m.raw !== null) {
          parts.push(`provider_raw=${safeJsonSnippet(m.raw, 1200)}`);
        }
        const remainingKeys = Object.keys(m).filter(
          (k) => !['provider_name', 'model_slug', 'reasons', 'raw', 'flagged_input'].includes(k)
        );
        if (remainingKeys.length) {
          const subset = {};
          for (const k of remainingKeys) subset[k] = m[k];
          parts.push(`metadata_extra=${safeJsonSnippet(subset, 800)}`);
        }
      }
    }
  }

  const choice = body?.choices?.[0];
  if (choice?.finish_reason === 'error') {
    parts.push('finish_reason=error');
    if (choice.native_finish_reason) {
      parts.push(`native_finish_reason=${String(choice.native_finish_reason)}`);
    }
    if (choice.message != null) {
      parts.push(`choice.message=${safeJsonSnippet(choice.message, 600)}`);
    }
  }

  if (parts.length <= 1 && rawText) {
    const stripped = rawText.trim();
    if (stripped) parts.push(stripped.slice(0, 600));
  }

  const joined = parts.filter(Boolean).join(' — ');
  return joined || 'Unknown OpenRouter error';
}

function messageContentToString(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === 'string') return p;
        if (p?.type === 'text' && typeof p.text === 'string') return p.text;
        return '';
      })
      .join('');
  }
  return '';
}

/** Primary model plus comma-separated `SUMMARIZERMODEL_FALLBACKS`, deduped in order. */
function resolveModelChain() {
  const primary = String(process.env.SUMMARIZERMODEL_NAME || '').trim();
  const fallbacksRaw = String(process.env.SUMMARIZERMODEL_FALLBACKS || '').trim();
  const fallbacks = fallbacksRaw
    ? fallbacksRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const chain = [primary, ...fallbacks].filter(Boolean);
  const seen = new Set();
  return chain.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });
}

/** Whether to try the next fallback model (rate limits / transient overload). */
function isRetryableOpenRouterFailure(httpStatus, body, detailStr) {
  if (httpStatus === 429 || httpStatus === 503) return true;
  const code = body?.error?.code;
  if (code === 429 || code === 503 || String(code) === '429' || String(code) === '503') {
    return true;
  }
  const low = (detailStr || '').toLowerCase();
  return (
    low.includes('rate limit') ||
    low.includes('rate-limit') ||
    low.includes('too many requests') ||
    low.includes('temporarily rate-limited') ||
    low.includes('temporarily rate limited') ||
    low.includes('overloaded') ||
    low.includes('capacity')
  );
}

/**
 * One chat/completions call; returns structured outcome for routing / fallbacks.
 */
async function openRouterCompletion(model, headers, userContent) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: userContent }]
    })
  });

  const raw = await res.text();
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch (parseErr) {
    console.error('[openrouter] summarize JSON parse failed', {
      model,
      httpStatus: res.status,
      rawHead: raw.slice(0, 400),
      parseErr: parseErr?.message
    });
    body = {};
  }

  const choice0 = body?.choices?.[0];
  console.log('[openrouter] summarize response', {
    model,
    httpStatus: res.status,
    ok: res.ok,
    choiceCount: Array.isArray(body?.choices) ? body.choices.length : 0,
    finishReason: choice0?.finish_reason,
    hasTopLevelError: Boolean(body?.error)
  });

  if (!res.ok) {
    const detail = formatOpenRouterFailure(res.status, body, raw);
    console.error('[openrouter] summarize HTTP error', { model, detail });
    console.error('[openrouter] summarize error body', safeJsonSnippet(body));
    return { ok: false, httpStatus: res.status, body, detail };
  }

  if (body?.error && (!Array.isArray(body?.choices) || body.choices.length === 0)) {
    const detail = formatOpenRouterFailure(res.status, body, raw);
    console.error('[openrouter] summarize 200 with error field', { model, detail });
    console.error('[openrouter] summarize error body', safeJsonSnippet(body));
    return { ok: false, httpStatus: res.status, body, detail };
  }

  if (choice0?.finish_reason === 'error') {
    const detail = formatOpenRouterFailure(res.status, body, raw);
    console.error('[openrouter] summarize finish_reason=error', { model, detail });
    console.error('[openrouter] summarize choice/body', safeJsonSnippet(body));
    return { ok: false, httpStatus: res.status, body, detail };
  }

  const text = messageContentToString(choice0?.message?.content);
  const trimmed = text.trim();
  if (!trimmed) {
    console.error('[openrouter] summarize empty content', {
      model,
      finishReason: choice0?.finish_reason,
      bodySnippet: safeJsonSnippet(body, 1500)
    });
    return {
      ok: false,
      httpStatus: res.status,
      body,
      detail:
        'Model returned an empty summary. Check server logs for [openrouter] empty content.'
    };
  }

  return { ok: true, text: trimmed };
}

/**
 * @param {{ transcript: string, mode: 'short' | 'long' }} opts
 * @returns {Promise<{ summary: string, model: string }>}
 */
export async function summarizeTranscriptViaOpenRouter(opts) {
  const transcript = String(opts.transcript || '').trim();
  const mode = opts.mode === 'long' ? 'long' : 'short';

  if (!transcript) {
    throw new Error('Transcript text is required');
  }

  const apiKey = String(process.env.OPENROUTER_API_KEY || '').trim();
  const models = resolveModelChain();
  const promptShort = String(process.env.SUMUPSMALL_PROMPT || '').trim();
  const promptLong = String(process.env.SUMUPLONG_PROMPT || '').trim();

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured on the server');
  }
  if (models.length === 0) {
    throw new Error('SUMMARIZERMODEL_NAME is not configured on the server');
  }

  const instruction = mode === 'short' ? promptShort : promptLong;
  if (!instruction) {
    throw new Error(
      mode === 'short'
        ? 'SUMUPSMALL_PROMPT is not configured on the server'
        : 'SUMUPLONG_PROMPT is not configured on the server'
    );
  }

  const referer = String(process.env.OPENROUTER_HTTP_REFERER || '').trim();
  const title = String(process.env.OPENROUTER_TITLE || '').trim();

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  if (referer) headers['HTTP-Referer'] = referer;
  if (title) headers['X-OpenRouter-Title'] = title;

  const userContent = `${instruction}\n\n---\n\nTranscript:\n\n${transcript}`;

  console.log('[openrouter] summarize request', {
    mode,
    models,
    transcriptChars: transcript.length,
    instructionChars: instruction.length,
    payloadUserChars: userContent.length
  });

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    console.log('[openrouter] summarize trying model', {
      mode,
      model,
      attempt: i + 1,
      total: models.length
    });

    const result = await openRouterCompletion(model, headers, userContent);

    if (result.ok) {
      console.log('[openrouter] summarize success', { mode, model });
      return { summary: result.text, model };
    }

    const retryable = isRetryableOpenRouterFailure(
      result.httpStatus,
      result.body,
      result.detail
    );
    const hasMore = i < models.length - 1;

    console.warn('[openrouter] summarize model failed', {
      model,
      retryable,
      hasMore,
      detail: result.detail
    });

    if (!retryable) {
      throw new Error(result.detail);
    }
    if (!hasMore) {
      throw new Error(
        `All summarizer models failed (${models.length} tried). Last: ${result.detail}`
      );
    }

    console.log('[openrouter] summarize falling back to next model');
  }

  throw new Error('OpenRouter summarizer finished without a result');
}
