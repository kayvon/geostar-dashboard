import { layout, formatPower, formatRuntime, formatTimestamp, escapeHtml, gatewayBadge, getGatewayName } from './layout';
import type { OverviewStats, DailyTotal, HourlyBreakdown, EnergyReading } from '../types';

export function overviewPage(
  stats: OverviewStats,
  dailyTotals: DailyTotal[],
  gateways: string[],
  filters: { date_from: string; date_to: string },
): string {
  const gatewayPills = gateways
    .map((g) => `<button class="filter-pill" data-filter="gateway" data-value="${escapeHtml(g)}" type="radio">${escapeHtml(getGatewayName(g))}</button>`)
    .join('');

  const chartData = JSON.stringify({
    dailyTotals: dailyTotals,
    gateways: gateways.map(g => ({ id: g, name: getGatewayName(g) })),
  });

  const dailyRows = dailyTotals
    .map(
      (row) => `
      <tr data-gateway="${escapeHtml(row.gateway_id)}"
          data-date="${escapeHtml(row.date)}"
          data-energy="${row.total_energy}"
          data-heating="${row.total_heating}"
          data-cooling="${row.total_cooling}"
          data-runtime="${row.total_runtime}">
        <td>${escapeHtml(row.date)}</td>
        <td>${gatewayBadge(row.gateway_id)}</td>
        <td class="text-right">${formatPower(row.total_energy)}</td>
        <td class="text-right">${formatPower(row.total_heating)}</td>
        <td class="text-right">${formatPower(row.total_cooling)}</td>
        <td class="text-right">${formatRuntime(row.total_runtime)}</td>
      </tr>
    `,
    )
    .join('');

  const content = `
    <h1 style="margin-bottom: 0.5rem;">Energy Overview</h1>

    <div class="filters">
      <div>
        <label for="date_from">From</label>
        <input type="date" id="date_from" name="date_from" value="${filters.date_from}">
      </div>
      <div>
        <label for="date_to">To</label>
        <input type="date" id="date_to" name="date_to" value="${filters.date_to}">
      </div>
      <div>
        <span>Filters</span>
        <div class="filter-bar">
          <div class="filter-pills">
            ${gatewayPills}
            <button class="filter-clear hidden" id="clear-filters" title="Clear all filters">&times;</button>
          </div>
        </div>
      </div>
      <a href="/" role="button" class="secondary outline">Reset</a>
    </div>

    <div class="stats-grid">
      <div class="stat-card" data-stat="energy">
        <h3>Total Energy</h3>
        <div class="value">${formatPower(stats.total_energy)}</div>
        <span class="unit">kWh</span>
      </div>
      <div class="stat-card" data-stat="heating">
        <h3>Heating</h3>
        <div class="value">${formatPower(stats.total_heating)}</div>
        <span class="unit">kWh</span>
      </div>
      <div class="stat-card" data-stat="cooling">
        <h3>Cooling</h3>
        <div class="value">${formatPower(stats.total_cooling)}</div>
        <span class="unit">kWh</span>
      </div>
      <div class="stat-card" data-stat="runtime">
        <h3>Runtime</h3>
        <div class="value">${formatRuntime(stats.total_runtime)}</div>
        <span class="unit">hours</span>
      </div>
    </div>

    <script>const __overviewChartData = ${chartData};</script>
    <div id="overview-chart-container"><canvas id="overview-chart"></canvas></div>

    <div id="table-wrapper" class="table-scroll-container">
      <table id="daily-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Unit</th>
            <th class="text-right">Energy (kWh)</th>
            <th class="text-right">Heating (kWh)</th>
            <th class="text-right">Cooling (kWh)</th>
            <th class="text-right">Runtime (hrs)</th>
          </tr>
        </thead>
        <tbody>
          ${dailyRows || '<tr><td colspan="6" class="muted">No data for selected range</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  return layout('Overview', content);
}

export function dailyPage(
  date: string,
  summary: { total_energy: number; total_heating: number; total_cooling: number },
  hourlyData: HourlyBreakdown[],
  gateways: string[],
): string {
  const dateObj = new Date(date + 'T12:00:00Z');
  const prev = new Date(dateObj); prev.setUTCDate(prev.getUTCDate() - 1);
  const next = new Date(dateObj); next.setUTCDate(next.getUTCDate() + 1);
  const prevDate = prev.toISOString().slice(0, 10);
  const nextDate = next.toISOString().slice(0, 10);

  const gatewayPills = gateways
    .map((g) => `<button class="filter-pill" data-filter="gateway" data-value="${escapeHtml(g)}" type="radio">${escapeHtml(getGatewayName(g))}</button>`)
    .join('');

  const hourlyRows = hourlyData
    .map(
      (row) => `
      <tr data-gateway="${escapeHtml(row.gateway_id)}"
          data-hour="${escapeHtml(row.hour)}"
          data-energy="${row.total_energy}"
          data-heating="${row.total_heating}"
          data-cooling="${row.total_cooling}">
        <td>${escapeHtml(row.hour)}:00</td>
        <td>${gatewayBadge(row.gateway_id)}</td>
        <td class="text-right">${formatPower(row.total_energy)}</td>
        <td class="text-right">${formatPower(row.heat_1)}</td>
        <td class="text-right">${formatPower(row.heat_2)}</td>
        <td class="text-right">${formatPower(row.cool_1)}</td>
        <td class="text-right">${formatPower(row.cool_2)}</td>
      </tr>
    `,
    )
    .join('');

  const chartData = JSON.stringify({
    hourlyData: hourlyData,
    gateways: gateways.map(g => ({ id: g, name: getGatewayName(g) })),
  });

  const content = `
    <h1 style="margin-bottom: 0.5rem;">Daily Details</h1>

    <div class="filters">
      <div>
        <label for="date">Date</label>
        <div style="display: flex; align-items: center; gap: 0.25rem;">
          <a href="/daily?date=${prevDate}" role="button" class="outline secondary" style="padding: 0.4rem 0.6rem; margin: 0;">&lsaquo;</a>
          <input type="date" id="date" name="date" value="${date}" onchange="window.location.href='/daily?date=' + this.value" style="margin: 0;">
          <a href="/daily?date=${nextDate}" role="button" class="outline secondary" style="padding: 0.4rem 0.6rem; margin: 0;">&rsaquo;</a>
        </div>
      </div>
      <div>
        <span>Filters</span>
        <div class="filter-bar">
          <div class="filter-pills">
            ${gatewayPills}
            <button class="filter-clear hidden" id="clear-filters" title="Clear all filters">&times;</button>
          </div>
        </div>
      </div>
    </div>

    <div class="summary-section" id="daily-summary">
      <strong>Daily Summary:</strong>
      Total Energy: <strong id="summary-energy">${formatPower(summary.total_energy)}</strong> kWh |
      Heating: <strong id="summary-heating">${formatPower(summary.total_heating)}</strong> kWh |
      Cooling: <strong id="summary-cooling">${formatPower(summary.total_cooling)}</strong> kWh
    </div>

    <script>const __chartData = ${chartData};</script>
    <div id="chart-container"><canvas id="energy-chart"></canvas></div>

    <div id="table-wrapper" class="table-scroll-container">
      <table id="hourly-table">
        <thead>
          <tr>
            <th>Hour</th>
            <th>Unit</th>
            <th class="text-right">Total (kWh)</th>
            <th class="text-right">Heat 1</th>
            <th class="text-right">Heat 2</th>
            <th class="text-right">Cool 1</th>
            <th class="text-right">Cool 2</th>
          </tr>
        </thead>
        <tbody>
          ${hourlyRows || '<tr><td colspan="7" class="muted">No data for selected date</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  return layout('Daily Details', content);
}

export function readingsPage(
  readings: EnergyReading[],
  page: number,
  total: number,
  filters: {
    gateway_id?: string;
    date_from?: string;
    date_to?: string;
    sort?: string;
    order?: string;
  },
  gateways: string[],
): string {
  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);
  const currentSort = filters.sort || 'timestamp';
  const currentOrder = filters.order || 'desc';

  // Build query string preserving filters
  const buildQuery = (params: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (filters.gateway_id) query.set('gateway_id', filters.gateway_id);
    if (filters.date_from) query.set('date_from', filters.date_from);
    if (filters.date_to) query.set('date_to', filters.date_to);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value));
    });
    return query.toString();
  };

  // Generate sortable header
  const sortHeader = (column: string, label: string) => {
    const isActive = currentSort === column;
    const newOrder = isActive && currentOrder === 'desc' ? 'asc' : 'desc';
    const arrow = isActive ? (currentOrder === 'desc' ? ' ↓' : ' ↑') : '';
    const query = buildQuery({ sort: column, order: newOrder, page: 1 });
    return `<a href="?${query}" style="text-decoration: none; color: inherit;${isActive ? ' font-weight: 600; color: var(--pico-primary);' : ''}">${label}${arrow}</a>`;
  };

  const gatewayOptions = gateways
    .map(
      (g) => `
      <option value="${escapeHtml(g)}" ${filters.gateway_id === g ? 'selected' : ''}>${escapeHtml(getGatewayName(g))}</option>
    `,
    )
    .join('');

  const readingRows = readings
    .map(
      (row) => `
      <tr>
        <td class="muted">${formatTimestamp(row.timestamp)}</td>
        <td>${gatewayBadge(row.gateway_id)}</td>
        <td class="text-right">${formatPower(row.total_heat_1)}</td>
        <td class="text-right">${formatPower(row.total_heat_2)}</td>
        <td class="text-right">${formatPower(row.total_cool_1)}</td>
        <td class="text-right">${formatPower(row.total_cool_2)}</td>
        <td class="text-right">${formatPower(row.total_electric_heat)}</td>
        <td class="text-right">${formatPower(row.total_fan_only)}</td>
        <td class="text-right"><strong>${formatPower(row.total_power)}</strong></td>
      </tr>
    `,
    )
    .join('');

  const content = `
    <h1>Raw Readings</h1>

    <form class="filters" method="get">
      <div>
        <label for="gateway_id">Heat Pump</label>
        <select id="gateway_id" name="gateway_id" onchange="this.form.submit()">
          <option value="">All Units</option>
          ${gatewayOptions}
        </select>
      </div>
      <div>
        <label for="date_from">From</label>
        <input type="date" id="date_from" name="date_from" value="${filters.date_from || ''}" onchange="this.form.submit()">
      </div>
      <div>
        <label for="date_to">To</label>
        <input type="date" id="date_to" name="date_to" value="${filters.date_to || ''}" onchange="this.form.submit()">
      </div>
      <a href="/readings" role="button" class="secondary outline">Clear</a>
    </form>

    <p class="muted">Showing ${readings.length} of ${total.toLocaleString()} readings (15-minute intervals)</p>

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

    ${
      totalPages > 1
        ? `
      <div class="pagination">
        ${page > 1 ? `<a href="?${buildQuery({ page: page - 1, sort: currentSort, order: currentOrder })}" role="button" class="outline">&larr; Previous</a>` : ''}
        <span style="padding: 0.5rem 1rem;">Page ${page} of ${totalPages}</span>
        ${page < totalPages ? `<a href="?${buildQuery({ page: page + 1, sort: currentSort, order: currentOrder })}" role="button" class="outline">Next &rarr;</a>` : ''}
      </div>
    `
        : ''
    }
  `;

  return layout('Readings', content);
}
