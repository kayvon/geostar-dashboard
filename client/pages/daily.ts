import { fetchDaily } from '../api';
import { navigate, getCurrentPage } from '../router';
import { escapeHtml, formatPower, gatewayBadge, getGatewayName } from '../utils';
import { createOrUpdateDailyChart, destroyChart, updateChartVisibility } from '../components/chart';
import { initFilters, wireFilterClicks, setFilterChangeHandler, resetFilters, isGatewayVisible } from '../components/filters';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function dailyPage(url: URL) {
  const app = document.getElementById('app')!;

  // Destroy overview chart if coming from another page
  destroyChart('overview');

  const date = url.searchParams.get('date') || '';

  // Render skeleton if not already daily page
  if (!document.getElementById('daily-page')) {
    resetFilters();
    app.innerHTML = `<div id="daily-page">
      <h1 style="margin-bottom: 0.5rem;">Daily Details</h1>
      <div class="filters" id="daily-filters"></div>
      <div class="summary-section" id="daily-summary"></div>
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
          <tbody id="hourly-tbody"></tbody>
        </table>
      </div>
    </div>`;
  }

  const page = document.getElementById('daily-page')!;
  page.setAttribute('aria-busy', 'true');

  const data = await fetchDaily({ date });

  if (getCurrentPage() !== '/daily') return;

  page.removeAttribute('aria-busy');

  const { date: currentDate, summary, hourly, gateways } = data;
  const prevDate = addDays(currentDate, -1);
  const nextDate = addDays(currentDate, 1);

  // Render filters
  const filtersEl = document.getElementById('daily-filters')!;
  filtersEl.innerHTML = `
    <div>
      <label for="date">Date</label>
      <div style="display: flex; align-items: center; gap: 0.25rem;">
        <a href="/daily?date=${prevDate}" data-link role="button" class="outline secondary" style="padding: 0.4rem 0.6rem; margin: 0;">&lsaquo;</a>
        <input type="date" id="date" name="date" value="${currentDate}" style="margin: 0;">
        <a href="/daily?date=${nextDate}" data-link role="button" class="outline secondary" style="padding: 0.4rem 0.6rem; margin: 0;">&rsaquo;</a>
      </div>
    </div>
    ${initFilters(gateways)}
  `;

  // Wire date input
  document.getElementById('date')!.addEventListener('change', (e) => {
    const val = (e.target as HTMLInputElement).value;
    if (val) navigate('/daily?date=' + val);
  });

  // Keyboard navigation
  function handleKeyNav(e: KeyboardEvent) {
    if ((e.target as Element).tagName === 'INPUT' || (e.target as Element).tagName === 'SELECT' || (e.target as Element).tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' || e.key === 'h') {
      navigate('/daily?date=' + prevDate);
    } else if (e.key === 'ArrowRight' || e.key === 'l') {
      navigate('/daily?date=' + nextDate);
    }
  }
  // Remove old listener, add new
  document.removeEventListener('keydown', (window as any).__dailyKeyNav);
  (window as any).__dailyKeyNav = handleKeyNav;
  document.addEventListener('keydown', handleKeyNav);

  // Render summary
  document.getElementById('daily-summary')!.innerHTML = `
    <strong>Daily Summary:</strong>
    Total Energy: <strong id="summary-energy">${formatPower(summary.total_energy)}</strong> kWh |
    Heating: <strong id="summary-heating">${formatPower(summary.total_heating)}</strong> kWh |
    Cooling: <strong id="summary-cooling">${formatPower(summary.total_cooling)}</strong> kWh
  `;

  // Render table
  const tbody = document.getElementById('hourly-tbody')!;
  if (hourly.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">No data for selected date</td></tr>';
  } else {
    tbody.innerHTML = hourly
      .map(
        (row) => `<tr data-gateway="${escapeHtml(row.gateway_id)}"
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
        </tr>`,
      )
      .join('');
  }

  // Build chart datasets
  const labels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');
  const datasets: any[] = [];

  gateways.forEach((gw, i) => {
    const d = new Array(24).fill(0);
    hourly.forEach((row) => {
      if (row.gateway_id === gw) {
        const h = parseInt(row.hour, 10);
        d[h] = row.total_energy;
      }
    });
    datasets.push({
      label: getGatewayName(gw),
      data: d,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '22',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 2,
      _gatewayId: gw,
    });
  });

  // Total series
  const totalData = new Array(24).fill(0);
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
    pointRadius: 2,
    _gatewayId: '__total',
  });

  const canvas = document.getElementById('energy-chart') as HTMLCanvasElement;
  createOrUpdateDailyChart(canvas, datasets, labels);

  // Wire filters
  wireFilterClicks();
  setFilterChangeHandler(() => {
    applyDailyFilters(summary, hourly);
    updateChartVisibility('daily');
  });

  applyDailyFilters(summary, hourly);
  updateChartVisibility('daily');
}

function applyDailyFilters(
  _summary: { total_energy: number; total_heating: number; total_cooling: number },
  _hourly: Array<any>,
) {
  let totalEnergy = 0, totalHeating = 0, totalCooling = 0;

  document.querySelectorAll('#hourly-tbody tr[data-gateway]').forEach((row) => {
    const gw = row.getAttribute('data-gateway') || '';
    if (isGatewayVisible(gw)) {
      row.classList.remove('hidden');
      totalEnergy += parseFloat(row.getAttribute('data-energy') || '0');
      totalHeating += parseFloat(row.getAttribute('data-heating') || '0');
      totalCooling += parseFloat(row.getAttribute('data-cooling') || '0');
    } else {
      row.classList.add('hidden');
    }
  });

  const summaryEnergy = document.getElementById('summary-energy');
  const summaryHeating = document.getElementById('summary-heating');
  const summaryCooling = document.getElementById('summary-cooling');
  if (summaryEnergy) summaryEnergy.textContent = formatPower(totalEnergy);
  if (summaryHeating) summaryHeating.textContent = formatPower(totalHeating);
  if (summaryCooling) summaryCooling.textContent = formatPower(totalCooling);
}
