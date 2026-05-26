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

/** @param {string} label */
export function estimateNicheNodeWidth(label) {
  return Math.min(340, Math.max(108, label.length * 6.2 + 52));
}

/** @param {{ id: string, label: string, children?: object[] }} node */
export function toD3TreeData(node) {
  const result = {
    name: node.label,
    attributes: {
      id: node.id,
      nodeWidth: estimateNicheNodeWidth(node.label)
    }
  };
  if (node.children?.length) {
    result.children = node.children.map(toD3TreeData);
  }
  return result;
}
