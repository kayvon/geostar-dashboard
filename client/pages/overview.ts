import { fetchOverview } from '../api';
import { navigate, getCurrentPage } from '../router';
import { escapeHtml, formatPower, formatRuntime, gatewayBadge, getGatewayName } from '../utils';
import { createOrUpdateOverviewChart, destroyChart, updateChartVisibility } from '../components/chart';
import { initFilters, wireFilterClicks, setFilterChangeHandler, resetFilters, getFilterState, isGatewayVisible } from '../components/filters';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

// Module-scoped state — persistent across invocations
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let latestTotals: Array<{ gateway_id: string; date: string; total_energy: number; total_heating: number; total_cooling: number; total_runtime: number }> = [];
let latestGateways: string[] = [];

function buildOverviewUrl(dateFrom: string, dateTo: string, resolution: string): string {
  return `/?date_from=${dateFrom}&date_to=${dateTo}&resolution=${resolution}`;
}

function navigateWithDates() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const from = (document.getElementById('date_from') as HTMLInputElement).value;
    const to = (document.getElementById('date_to') as HTMLInputElement).value;
    const res = (document.getElementById('resolution') as HTMLSelectElement).value;
    if (from && to) navigate(buildOverviewUrl(from, to, res));
  }, 500);
}

export async function overviewPage(url: URL) {
  const app = document.getElementById('app')!;

  // Destroy daily chart if coming from another page
  destroyChart('daily');

  const dateFrom = url.searchParams.get('date_from') || '';
  const dateTo = url.searchParams.get('date_to') || '';
  const resolution = url.searchParams.get('resolution') || 'daily';

  const isFirstRender = !document.getElementById('overview-page');

  // Render skeleton once
  if (isFirstRender) {
    resetFilters();
    app.innerHTML = `<div id="overview-page">
      <h1 style="margin-bottom: 0.5rem;">Energy Overview</h1>
      <div class="filters" id="overview-filters"></div>
      <div class="stats-grid" id="overview-stats">
        <div class="stat-card" data-stat="energy">
          <h3>Total Energy</h3>
          <div class="value" id="stat-energy">-</div>
          <span class="unit">kWh</span>
        </div>
        <div class="stat-card" data-stat="heating">
          <h3>Heating</h3>
          <div class="value" id="stat-heating">-</div>
          <span class="unit">kWh</span>
        </div>
        <div class="stat-card" data-stat="cooling">
          <h3>Cooling</h3>
          <div class="value" id="stat-cooling">-</div>
          <span class="unit">kWh</span>
        </div>
        <div class="stat-card" data-stat="runtime">
          <h3>Runtime</h3>
          <div class="value" id="stat-runtime">-</div>
          <span class="unit">hours</span>
        </div>
      </div>
      <div id="overview-chart-container"><canvas id="overview-chart"></canvas></div>
      <div id="table-wrapper" class="table-scroll-container">
        <table id="daily-table">
          <thead id="overview-thead"></thead>
          <tbody id="overview-tbody"></tbody>
        </table>
      </div>
    </div>`;
  }

  // Show loading on tbody only
  const tbody = document.getElementById('overview-tbody')!;
  tbody.setAttribute('aria-busy', 'true');

  const data = await fetchOverview({ date_from: dateFrom, date_to: dateTo, resolution });

  // If we navigated away while loading, bail
  if (getCurrentPage() !== '/') return;

  tbody.removeAttribute('aria-busy');

  const { stats, totals, gateways, filters } = data;

  // Stash for filter handler
  latestTotals = totals;
  latestGateways = gateways;

  // --- Filters: full render on first load, surgical update on nav ---
  if (isFirstRender) {
    const filtersEl = document.getElementById('overview-filters')!;
    filtersEl.innerHTML = `
      <div>
        <label for="date_from">From</label>
        <input type="date" id="date_from" name="date_from" value="${filters.date_from}">
      </div>
      <div>
        <label for="date_to">To</label>
        <input type="date" id="date_to" name="date_to" value="${filters.date_to}">
      </div>
      <div>
        <label for="resolution">Resolution</label>
        <select id="resolution" name="resolution">
          <option value="daily"${filters.resolution === 'daily' ? ' selected' : ''}>Daily</option>
          <option value="hourly"${filters.resolution === 'hourly' ? ' selected' : ''}>Hourly</option>
          <option value="15min"${filters.resolution === '15min' ? ' selected' : ''}>15-min</option>
        </select>
      </div>
      ${initFilters(gateways)}
      <a href="/" data-link role="button" class="secondary outline">Reset</a>
    `;

    // Wire event listeners once
    document.getElementById('date_from')!.addEventListener('change', navigateWithDates);
    document.getElementById('date_to')!.addEventListener('change', navigateWithDates);
    document.getElementById('resolution')!.addEventListener('change', navigateWithDates);

    wireFilterClicks();
    setFilterChangeHandler(() => {
      applyOverviewFilters(latestTotals, latestGateways);
      updateChartVisibility('overview');
    });
  } else {
    // Surgical update: set values on existing inputs
    (document.getElementById('date_from') as HTMLInputElement).value = filters.date_from;
    (document.getElementById('date_to') as HTMLInputElement).value = filters.date_to;
    const resSelect = document.getElementById('resolution') as HTMLSelectElement;
    resSelect.value = filters.resolution;
  }

  // --- Stats: update values in place ---
  document.getElementById('stat-energy')!.textContent = formatPower(stats.total_energy);
  document.getElementById('stat-heating')!.textContent = formatPower(stats.total_heating);
  document.getElementById('stat-cooling')!.textContent = formatPower(stats.total_cooling);
  document.getElementById('stat-runtime')!.textContent = formatRuntime(stats.total_runtime);

  // --- Table header ---
  document.getElementById('overview-thead')!.innerHTML = `<tr>
    <th>${filters.resolution === 'daily' ? 'Date' : 'Date/Time'}</th>
    <th>Unit</th>
    <th class="text-right">Energy (kWh)</th>
    <th class="text-right">Heating (kWh)</th>
    <th class="text-right">Cooling (kWh)</th>
    <th class="text-right">Runtime (hrs)</th>
  </tr>`;

  // --- Table rows ---
  if (totals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">No data for selected range</td></tr>';
  } else {
    tbody.innerHTML = totals
      .map(
        (row) => `<tr data-gateway="${escapeHtml(row.gateway_id)}"
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
        </tr>`,
      )
      .join('');
  }

  // --- Chart datasets ---
  const dateSet = new Set<string>();
  totals.forEach((row) => dateSet.add(row.date));
  const labels = Array.from(dateSet).sort();

  const datasets: any[] = [];
  gateways.forEach((gw, i) => {
    const d = labels.map((date) => {
      const match = totals.find((r) => r.date === date && r.gateway_id === gw);
      return match ? match.total_energy : 0;
    });
    datasets.push({
      label: getGatewayName(gw),
      data: d,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '22',
      borderWidth: 2,
      tension: 0.3,
      _gatewayId: gw,
    });
  });

  // Total series
  const totalData = new Array(labels.length).fill(0);
  datasets.forEach((ds) => {
    ds.data.forEach((v: number, i: number) => {
      totalData[i] += v;
    });
  });
  datasets.push({
    label: 'Total',
    data: totalData,
    borderColor: '#111827',
    backgroundColor: '#11182722',
    borderWidth: 3,
    tension: 0.3,
    _gatewayId: '__total',
  });

  // Create/update chart — onZoom updates inputs then debounces navigate
  const dateFromEl = document.getElementById('date_from') as HTMLInputElement;
  const dateToEl = document.getElementById('date_to') as HTMLInputElement;
  const canvas = document.getElementById('overview-chart') as HTMLCanvasElement;
  createOrUpdateOverviewChart(canvas, { labels, datasets, resolution: filters.resolution }, (newFrom, newTo) => {
    dateFromEl.value = newFrom;
    dateToEl.value = newTo;
    navigateWithDates();
  });

  // Apply current filter state
  applyOverviewFilters(totals, gateways);
  updateChartVisibility('overview');
}

function applyOverviewFilters(
  totals: Array<{ gateway_id: string; total_energy: number; total_heating: number; total_cooling: number; total_runtime: number }>,
  _gateways: string[],
) {
  let totalEnergy = 0, totalHeating = 0, totalCooling = 0, totalRuntime = 0;

  document.querySelectorAll('#overview-tbody tr[data-gateway]').forEach((row) => {
    const gw = row.getAttribute('data-gateway') || '';
    if (isGatewayVisible(gw)) {
      row.classList.remove('hidden');
      totalEnergy += parseFloat(row.getAttribute('data-energy') || '0');
      totalHeating += parseFloat(row.getAttribute('data-heating') || '0');
      totalCooling += parseFloat(row.getAttribute('data-cooling') || '0');
      totalRuntime += parseFloat(row.getAttribute('data-runtime') || '0');
    } else {
      row.classList.add('hidden');
    }
  });

  // Update stat cards
  const energyEl = document.getElementById('stat-energy');
  const heatingEl = document.getElementById('stat-heating');
  const coolingEl = document.getElementById('stat-cooling');
  const runtimeEl = document.getElementById('stat-runtime');
  if (energyEl) energyEl.textContent = formatPower(totalEnergy);
  if (heatingEl) heatingEl.textContent = formatPower(totalHeating);
  if (coolingEl) coolingEl.textContent = formatPower(totalCooling);
  if (runtimeEl) runtimeEl.textContent = formatRuntime(totalRuntime);
}
