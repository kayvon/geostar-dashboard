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

// Track current keyboard nav handler so we can swap it without re-adding listeners
let keyNavDates: { prev: string; next: string } | null = null;

function ensureKeyNav() {
  if ((window as any).__dailyKeyNavBound) return;
  (window as any).__dailyKeyNavBound = true;
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!keyNavDates) return;
    const tag = (e.target as Element).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' || e.key === 'h') {
      navigate('/daily?date=' + keyNavDates.prev);
    } else if (e.key === 'ArrowRight' || e.key === 'l') {
      navigate('/daily?date=' + keyNavDates.next);
    }
  });
}

export async function dailyPage(url: URL) {
  const app = document.getElementById('app')!;
  destroyChart('overview');

  const date = url.searchParams.get('date') || '';
  const isFirstRender = !document.getElementById('daily-page');

  if (isFirstRender) {
    resetFilters();
    app.innerHTML = `<div id="daily-page">
      <h1 style="margin-bottom: 0.5rem;">Daily Details</h1>
      <div class="filters" id="daily-filters"></div>
      <div class="summary-section" id="daily-summary">
        <strong>Daily Summary:</strong>
        Total Energy: <strong id="summary-energy">-</strong> kWh |
        Heating: <strong id="summary-heating">-</strong> kWh |
        Cooling: <strong id="summary-cooling">-</strong> kWh
      </div>
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

  // Only show busy on the table, not the chart area
  const tbody = document.getElementById('hourly-tbody')!;
  tbody.setAttribute('aria-busy', 'true');

  const data = await fetchDaily({ date });

  if (getCurrentPage() !== '/daily') return;

  tbody.removeAttribute('aria-busy');

  const { date: currentDate, summary, hourly, gateways } = data;
  const prevDate = addDays(currentDate, -1);
  const nextDate = addDays(currentDate, 1);

  // Update keyboard nav targets (no listener churn)
  keyNavDates = { prev: prevDate, next: nextDate };
  ensureKeyNav();

  // --- Filters: full render on first load, surgical update on nav ---
  if (isFirstRender) {
    const filtersEl = document.getElementById('daily-filters')!;
    filtersEl.innerHTML = `
      <div>
        <label for="date">Date</label>
        <div style="display: flex; align-items: center; gap: 0.25rem;">
          <a href="/daily?date=${prevDate}" data-link id="prev-day" role="button" class="outline secondary" style="padding: 0.4rem 0.6rem; margin: 0;">&lsaquo;</a>
          <input type="date" id="date" name="date" value="${currentDate}" style="margin: 0;">
          <a href="/daily?date=${nextDate}" data-link id="next-day" role="button" class="outline secondary" style="padding: 0.4rem 0.6rem; margin: 0;">&rsaquo;</a>
        </div>
      </div>
      ${initFilters(gateways)}
    `;
    document.getElementById('date')!.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (val) navigate('/daily?date=' + val);
    });
    wireFilterClicks();
    setFilterChangeHandler(() => {
      applyDailyFilters();
      updateChartVisibility('daily');
    });
  } else {
    // Just update the date value and prev/next links
    (document.getElementById('date') as HTMLInputElement).value = currentDate;
    const prevLink = document.getElementById('prev-day') as HTMLAnchorElement;
    const nextLink = document.getElementById('next-day') as HTMLAnchorElement;
    prevLink.href = `/daily?date=${prevDate}`;
    nextLink.href = `/daily?date=${nextDate}`;
  }

  // --- Summary: update values in place ---
  document.getElementById('summary-energy')!.textContent = formatPower(summary.total_energy);
  document.getElementById('summary-heating')!.textContent = formatPower(summary.total_heating);
  document.getElementById('summary-cooling')!.textContent = formatPower(summary.total_cooling);

  // --- Table ---
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

  // --- Chart: build data and update in place ---
  const labels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');

  const gatewayData: Record<string, number[]> = {};
  gateways.forEach((gw) => {
    const d = new Array(24).fill(0);
    hourly.forEach((row) => {
      if (row.gateway_id === gw) {
        d[parseInt(row.hour, 10)] = row.total_energy;
      }
    });
    gatewayData[gw] = d;
  });

  // Compute total
  const totalData = new Array(24).fill(0);
  gateways.forEach((gw) => {
    gatewayData[gw].forEach((v, i) => { totalData[i] += v; });
  });

  const canvas = document.getElementById('energy-chart') as HTMLCanvasElement;
  createOrUpdateDailyChart(canvas, gateways, gatewayData, totalData, labels);

  applyDailyFilters();
  updateChartVisibility('daily');
}

function applyDailyFilters() {
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
