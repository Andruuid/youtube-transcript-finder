import { HEALTH_NICHE_ROOT } from './healthNicheTree';
import { WEALTH_NICHE_ROOT } from './wealthNicheTree';
import { RELATIONSHIPS_NICHE_ROOT } from './relationshipsNicheTree';

export const NICHE_MARKETS = [
  {
    id: 'health',
    label: 'Health',
    accentColor: '#0d9488',
    accentColorLight: '#14b8a6',
    root: HEALTH_NICHE_ROOT
  },
  {
    id: 'wealth',
    label: 'Wealth',
    accentColor: '#e11d48',
    accentColorLight: '#fb7185',
    root: WEALTH_NICHE_ROOT
  },
  {
    id: 'relationships',
    label: 'Relationships',
    accentColor: '#d97706',
    accentColorLight: '#fbbf24',
    root: RELATIONSHIPS_NICHE_ROOT
  }
];

/** @param {string} label @param {boolean} [hasChildren] */
export function estimateNicheNodeWidth(label, hasChildren = false) {
  const chrome = 44 + (hasChildren ? 18 : 0) + 22;
  const textWidth = label.length * 7.5;
  return Math.min(480, Math.max(112, Math.ceil(textWidth + chrome)));
}

/** @param {string} label @param {number} width @param {boolean} [hasChildren] */
export function estimateNicheNodeHeight(label, width, hasChildren = false) {
  const chrome = 44 + (hasChildren ? 18 : 0) + 22;
  const textAreaWidth = Math.max(80, width - chrome);
  const charsPerLine = Math.max(6, Math.floor(textAreaWidth / 7.5));
  const lineCount = Math.ceil(label.length / charsPerLine);
  const lineHeight = 22;
  const verticalPadding = 20;
  return Math.max(46, lineCount * lineHeight + verticalPadding);
}

/** @param {{ id: string, label: string, children?: object[] }} node */
export function toD3TreeData(node) {
  const hasChildren = Boolean(node.children?.length);
  const nodeWidth = estimateNicheNodeWidth(node.label, hasChildren);
  const result = {
    name: node.label,
    attributes: {
      id: node.id,
      nodeWidth,
      nodeHeight: estimateNicheNodeHeight(node.label, nodeWidth, hasChildren)
    }
  };
  if (node.children?.length) {
    result.children = node.children.map(toD3TreeData);
  }
  return result;
}
