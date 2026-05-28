export function parseStructuredSummary(video) {
  const raw = video?.structuredSummaryJson;
  if (!raw || !String(raw).trim()) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasStructuredSummary(video) {
  if (video?.hasStructuredSummary != null) return !!video.hasStructuredSummary;
  return parseStructuredSummary(video) != null;
}

function readString(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function readStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

/** Normalize imported JSON into a stable shape for rendering. */
export function normalizeStructuredSummary(data) {
  if (!data) return null;

  const productDescription =
    data.product_description && typeof data.product_description === 'object'
      ? data.product_description
      : {};
  const originStory =
    data.origin_story && typeof data.origin_story === 'object' ? data.origin_story : {};
  const marketing =
    data.marketing && typeof data.marketing === 'object' ? data.marketing : {};

  return {
    videoTitle: readString(data.video_title),
    productName: readString(data.product_name),
    revenueHighlight: readString(data.revenue_highlight),
    problemSolved: readString(data.problem_solved),
    productDescription: {
      whatItIs: readString(productDescription.what_it_is),
      howItWorks: readString(productDescription.how_it_works),
      businessModel: readString(productDescription.business_model),
      techStack: readStringList(productDescription.tech_stack)
    },
    originStory: {
      inspiration: readString(originStory.inspiration),
      validation: readString(originStory.validation),
      timeline: readString(originStory.timeline)
    },
    marketing: {
      channels: readStringList(marketing.channels),
      strategies: readStringList(marketing.strategies),
      keyTactics: readString(marketing.key_tactics),
      growthType: readString(marketing.growth_type)
    },
    founderLessons: readString(data.founder_lessons)
  };
}
