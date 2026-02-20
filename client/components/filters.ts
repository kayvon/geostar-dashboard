import { escapeHtml, getGatewayName } from '../utils';

interface FilterState {
  gateways: Set<string>;
}

const filterState: FilterState = {
  gateways: new Set(),
};

let onFilterChange: (() => void) | null = null;

export function getFilterState(): FilterState {
  return filterState;
}

export function setFilterChangeHandler(handler: () => void) {
  onFilterChange = handler;
}

export function resetFilters() {
  filterState.gateways.clear();
}

function applyAndNotify() {
  updateFilterUI();
  if (onFilterChange) onFilterChange();
}

function updateFilterUI() {
  document.querySelectorAll('.filter-pill[data-filter="gateway"]').forEach((pill) => {
    const el = pill as HTMLElement;
    pill.classList.toggle('active', filterState.gateways.has(el.dataset.value || ''));
  });
  const hasActive = filterState.gateways.size > 0;
  document.getElementById('clear-filters')?.classList.toggle('hidden', !hasActive);
}

export function initFilters(gateways: string[]): string {
  const pills = gateways
    .map(
      (g) =>
        `<button class="filter-pill" data-filter="gateway" data-value="${escapeHtml(g)}" type="button">${escapeHtml(getGatewayName(g))}</button>`,
    )
    .join('');

  return `<div>
    <span>Filters</span>
    <div class="filter-bar">
      <div class="filter-pills">
        ${pills}
        <button class="filter-clear hidden" id="clear-filters" title="Clear all filters">&times;</button>
      </div>
    </div>
  </div>`;
}

export function wireFilterClicks() {
  const bar = document.querySelector('.filter-bar');
  if (!bar) return;
  bar.addEventListener('click', (e) => {
    const pill = (e.target as Element).closest('.filter-pill') as HTMLElement | null;
    if (pill?.dataset.filter === 'gateway') {
      const id = pill.dataset.value || '';
      if (filterState.gateways.has(id)) {
        filterState.gateways.delete(id);
      } else {
        filterState.gateways.clear();
        filterState.gateways.add(id);
      }
      applyAndNotify();
    }
    if ((e.target as Element).closest('.filter-clear')) {
      filterState.gateways.clear();
      applyAndNotify();
    }
  });
}

export function isGatewayVisible(gatewayId: string): boolean {
  return filterState.gateways.size === 0 || filterState.gateways.has(gatewayId);
}
