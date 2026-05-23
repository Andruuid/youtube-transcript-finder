export function splitTranscriptParagraphs(text) {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split one paragraph into alternating plain / highlight segments for keyword search. */
function paragraphToSearchParts(para, query) {
  const q = query.trim();
  if (!q) return [{ type: 'text', value: para }];
  const re = new RegExp(escapeRegExp(q), 'gi');
  const parts = [];
  let last = 0;
  let m = re.exec(para);
  while (m !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', value: para.slice(last, m.index) });
    }
    parts.push({ type: 'mark', value: m[0] });
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
    m = re.exec(para);
  }
  if (last < para.length) {
    parts.push({ type: 'text', value: para.slice(last) });
  }
  return parts.length ? parts : [{ type: 'text', value: para }];
}

export function buildTranscriptHighlightModel(text, query) {
  const paras = splitTranscriptParagraphs(text || '');
  let hitCount = 0;
  const paragraphs = paras.map((para) =>
    paragraphToSearchParts(para, query).map((part) => {
      if (part.type !== 'mark') return part;
      const idx = hitCount;
      hitCount += 1;
      return { ...part, hitIndex: idx };
    })
  );
  return { paragraphs, hitCount };
}
