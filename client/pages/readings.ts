import { fetchReadings } from '../api';
import { navigate, getCurrentPage } from '../router';
import { escapeHtml, formatPower, formatTimestamp, gatewayBadge, getGatewayName } from '../utils';
import { destroyChart } from '../components/chart';

export async function readingsPage(url: URL) {
  const app = document.getElementById('app')!;

  // Destroy any active charts
  destroyChart('overview');
  destroyChart('daily');

  // Remove daily keyboard nav if present
  if ((window as any).__dailyKeyNav) {
    document.removeEventListener('keydown', (window as any).__dailyKeyNav);
    (window as any).__dailyKeyNav = null;
  }

  // Always re-render skeleton for readings (no chart to persist)
  app.innerHTML = `<div id="readings-page" aria-busy="true">
    <h1>Raw Readings</h1>
    <div id="readings-filters" class="filters"></div>
    <p class="muted" id="readings-count"></p>
    <div id="readings-table-container"></div>
    <div id="readings-pagination" class="pagination"></div>
  </div>`;

  const pageNum = parseInt(url.searchParams.get('page') || '1');
  const gatewayId = url.searchParams.get('gateway_id') || '';
  const dateFrom = url.searchParams.get('date_from') || '';
  const dateTo = url.searchParams.get('date_to') || '';
  const sort = url.searchParams.get('sort') || 'timestamp';
  const order = url.searchParams.get('order') || 'desc';

  const data = await fetchReadings({ page: pageNum, gateway_id: gatewayId, date_from: dateFrom, date_to: dateTo, sort, order });

  if (getCurrentPage() !== '/readings') return;

  document.getElementById('readings-page')!.removeAttribute('aria-busy');

  const { readings, page, total, gateways, filters } = data;
  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);
  const currentSort = filters.sort || 'timestamp';
  const currentOrder = filters.order || 'desc';

  // Build query string helper
  function buildQuery(params: Record<string, string | number | undefined>): string {
    const query = new URLSearchParams();
    if (filters.gateway_id) query.set('gateway_id', filters.gateway_id);
    if (filters.date_from) query.set('date_from', filters.date_from);
    if (filters.date_to) query.set('date_to', filters.date_to);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value));
    });
    return query.toString();
  }

  function sortHeader(column: string, label: string): string {
    const isActive = currentSort === column;
    const newOrder = isActive && currentOrder === 'desc' ? 'asc' : 'desc';
    const arrow = isActive ? (currentOrder === 'desc' ? ' ↓' : ' ↑') : '';
    const query = buildQuery({ sort: column, order: newOrder, page: 1 });
    return `<a href="/readings?${query}" data-link style="text-decoration: none; color: inherit;${isActive ? ' font-weight: 600; color: var(--pico-primary);' : ''}">${label}${arrow}</a>`;
  }

  // Render filters
  const gatewayOptions = gateways
    .map((g) => `<option value="${escapeHtml(g)}" ${filters.gateway_id === g ? 'selected' : ''}>${escapeHtml(getGatewayName(g))}</option>`)
    .join('');

  document.getElementById('readings-filters')!.innerHTML = `
    <div>
      <label for="gateway_id">Heat Pump</label>
      <select id="gateway_id" name="gateway_id">
        <option value="">All Units</option>
        ${gatewayOptions}
      </select>
    </div>
    <div>
      <label for="readings_date_from">From</label>
      <input type="date" id="readings_date_from" name="date_from" value="${filters.date_from || ''}">
    </div>
    <div>
      <label for="readings_date_to">To</label>
      <input type="date" id="readings_date_to" name="date_to" value="${filters.date_to || ''}">
    </div>
    <a href="/readings" data-link role="button" class="secondary outline">Clear</a>
  `;

  // Wire filter controls
  function applyReadingsFilters() {
    const gw = (document.getElementById('gateway_id') as HTMLSelectElement).value;
    const df = (document.getElementById('readings_date_from') as HTMLInputElement).value;
    const dt = (document.getElementById('readings_date_to') as HTMLInputElement).value;
    const q = new URLSearchParams();
    if (gw) q.set('gateway_id', gw);
    if (df) q.set('date_from', df);
    if (dt) q.set('date_to', dt);
    q.set('sort', currentSort);
    q.set('order', currentOrder);
    navigate('/readings?' + q.toString());
  }

  document.getElementById('gateway_id')!.addEventListener('change', applyReadingsFilters);
  document.getElementById('readings_date_from')!.addEventListener('change', applyReadingsFilters);
  document.getElementById('readings_date_to')!.addEventListener('change', applyReadingsFilters);

  // Render count
  document.getElementById('readings-count')!.textContent = `Showing ${readings.length} of ${total.toLocaleString()} readings (15-minute intervals)`;

  // Render table
  const readingRows = readings
    .map(
      (row) => `<tr>
        <td class="muted">${formatTimestamp(row.timestamp)}</td>
        <td>${gatewayBadge(row.gateway_id)}</td>
        <td class="text-right">${formatPower(row.total_heat_1)}</td>
        <td class="text-right">${formatPower(row.total_heat_2)}</td>
        <td class="text-right">${formatPower(row.total_cool_1)}</td>
        <td class="text-right">${formatPower(row.total_cool_2)}</td>
        <td class="text-right">${formatPower(row.total_electric_heat)}</td>
        <td class="text-right">${formatPower(row.total_fan_only)}</td>
        <td class="text-right"><strong>${formatPower(row.total_power)}</strong></td>
      </tr>`,
    )
    .join('');

  document.getElementById('readings-table-container')!.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>${sortHeader('timestamp', 'Timestamp')}</th>
          <th>Unit</th>
          <th class="text-right">Heat 1</th>
          <th class="text-right">Heat 2</th>
          <th class="text-right">Cool 1</th>
          <th class="text-right">Cool 2</th>
          <th class="text-right">Elec Heat</th>
          <th class="text-right">Fan</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${readingRows || '<tr><td colspan="9" class="muted">No readings found</td></tr>'}
      </tbody>
    </table>
  `;

  // Render pagination
  if (totalPages > 1) {
    let paginationHtml = '';
    if (page > 1) {
      paginationHtml += `<a href="/readings?${buildQuery({ page: page - 1, sort: currentSort, order: currentOrder })}" data-link role="button" class="outline">&larr; Previous</a>`;
    }
    paginationHtml += `<span style="padding: 0.5rem 1rem;">Page ${page} of ${totalPages}</span>`;
    if (page < totalPages) {
      paginationHtml += `<a href="/readings?${buildQuery({ page: page + 1, sort: currentSort, order: currentOrder })}" data-link role="button" class="outline">Next &rarr;</a>`;
    }
    document.getElementById('readings-pagination')!.innerHTML = paginationHtml;
  }
}
