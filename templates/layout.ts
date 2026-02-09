// Gateway ID to friendly name mapping
export const GATEWAY_NAMES: Record<string, string> = {
  '8813BF342F64': '3-Ton',
  '8813BF34217C': '4-Ton',
};

export function getGatewayName(gatewayId: string): string {
  return GATEWAY_NAMES[gatewayId] || gatewayId;
}

// HTML escape to prevent XSS
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - GeoStar Energy Dashboard</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --pico-font-size: 16px;
    }
    .container {
      max-width: 1200px;
      padding: 1rem;
    }
    nav {
      margin-bottom: 1rem;
    }
    nav ul {
      margin: 0;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .stat-card {
      background: var(--pico-card-background-color);
      border: 1px solid var(--pico-muted-border-color);
      border-radius: var(--pico-border-radius);
      padding: 1rem;
      text-align: center;
    }
    .stat-card h3 {
      margin: 0 0 0.5rem 0;
      font-size: 0.9rem;
      color: var(--pico-muted-color);
      text-transform: uppercase;
    }
    .stat-card .value {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--pico-primary);
    }
    .stat-card .unit {
      font-size: 0.9rem;
      color: var(--pico-muted-color);
      margin-left: 0.25rem;
    }
    table {
      font-size: 0.9rem;
    }
    .filters {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
      align-items: end;
    }
    .filters label {
      margin-bottom: 0;
    }
    .filters input, .filters select {
      margin-bottom: 0;
    }
    .pagination {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      margin-top: 1rem;
    }
    .pagination a {
      padding: 0.5rem 1rem;
    }
    .muted {
      color: var(--pico-muted-color);
    }
    .text-right {
      text-align: right;
    }
    .gateway-badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 500;
      background: #dbeafe;
      color: #1e40af;
    }
    .hidden {
      display: none !important;
    }
    .summary-section {
      background: var(--pico-card-background-color);
      border: 1px solid var(--pico-muted-border-color);
      border-radius: var(--pico-border-radius);
      padding: 0.5rem 1rem;
      margin-bottom: 0.75rem;
      font-size: 0.9rem;
    }
    .table-scroll-container {
      max-height: 40vh;
      overflow-y: auto;
      border: 1px solid var(--pico-muted-border-color);
      border-radius: var(--pico-border-radius);
    }
    .table-scroll-container table {
      font-size: 0.75rem;
      margin-bottom: 0;
    }
    .table-scroll-container thead {
      position: sticky;
      top: 0;
      background: var(--pico-background-color);
      z-index: 1;
    }
    tr.chart-highlight, tr.chart-highlight > td {
      background: var(--pico-primary-focus) !important;
      transition: background 0.15s ease;
    }
    @media (max-height: 700px) {
      .table-scroll-container { max-height: 30vh; }
    }
    @media (max-height: 500px) {
      .table-scroll-container { max-height: none; }
    }
    .filter-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      height: calc(1rem * var(--pico-line-height) + 0.75rem + 12px);
    }
    .filter-pills {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      overflow-x: auto;
      height: 100%;
    }
    .filter-pill {
      all: unset;
      box-sizing: border-box;
      padding: 0.3rem 0.75rem;
      border-radius: 999px;
      border: 1px solid var(--pico-muted-border-color);
      background: #dbeafeaa;
      color: var(--pico-primary);
      cursor: pointer;
      white-space: nowrap;
      font-size: 0.85rem;
      line-height: normal;
    }
    .filter-pill.active {
      background: var(--pico-primary);
      color: var(--pico-primary-inverse);
      border-color: var(--pico-primary);
    }
    .filter-clear {
      all: unset;
      cursor: pointer;
      font-size: 1.2rem;
      color: var(--pico-muted-color);
      padding: 0.25rem 0.5rem;
      line-height: normal;
    }
  </style>
</head>
<body>
  <nav class="container">
    <ul>
      <li><strong>GeoStar Energy</strong></li>
    </ul>
    <ul>
      <li><a href="/">Overview</a></li>
      <li><a href="/daily">Daily</a></li>
      <li><a href="/readings">Readings</a></li>
    </ul>
  </nav>
  <main class="container">
    ${content}
  </main>
  <footer class="container">
    <p class="muted" style="text-align: center; margin-top: 2rem;">
      GeoStar Energy Dashboard
    </p>
  </footer>
  <script>
    // --- Filter State Machine (ad-hoc, xstate-migration-ready) ---
    const filterState = {
      gateways: new Set(),
      kwhMin: null,
    };

    function dispatch(event) {
      switch (event.type) {
        case 'TOGGLE_GATEWAY': {
          const { id } = event;
          if (filterState.gateways.has(id)) {
            filterState.gateways.delete(id);
          } else {
            filterState.gateways.clear();
            filterState.gateways.add(id);
          }
          break;
        }
        case 'SET_KWH_MIN':
          filterState.kwhMin = event.value;
          break;
        case 'CLEAR_ALL':
          filterState.gateways.clear();
          filterState.kwhMin = null;
          break;
      }
      applyFilters();
      updateFilterUI();
    }

    function applyFilters() {
      const rows = document.querySelectorAll('[data-gateway]');
      let totalEnergy = 0, totalHeating = 0, totalCooling = 0, totalRuntime = 0;

      rows.forEach(row => {
        const gw = row.getAttribute('data-gateway');
        const energy = parseFloat(row.getAttribute('data-energy') || '0');

        const matchGateway = filterState.gateways.size === 0 || filterState.gateways.has(gw);
        const matchKwh = filterState.kwhMin === null || energy > filterState.kwhMin;

        if (matchGateway && matchKwh) {
          row.classList.remove('hidden');
          totalEnergy += energy;
          totalHeating += parseFloat(row.getAttribute('data-heating') || '0');
          totalCooling += parseFloat(row.getAttribute('data-cooling') || '0');
          totalRuntime += parseFloat(row.getAttribute('data-runtime') || '0');
        } else {
          row.classList.add('hidden');
        }
      });

      // Update stat cards (overview page)
      document.querySelectorAll('[data-stat]').forEach(card => {
        const statType = card.getAttribute('data-stat');
        const valueEl = card.querySelector('.value');
        if (!valueEl) return;
        let value;
        switch(statType) {
          case 'energy': value = totalEnergy; break;
          case 'heating': value = totalHeating; break;
          case 'cooling': value = totalCooling; break;
          case 'runtime': value = totalRuntime; break;
        }
        if (value !== undefined) {
          valueEl.textContent = statType === 'runtime' ? formatRuntime(value) : formatPower(value);
        }
      });

      // Update daily summary (daily page)
      const summaryEnergy = document.getElementById('summary-energy');
      const summaryHeating = document.getElementById('summary-heating');
      const summaryCooling = document.getElementById('summary-cooling');
      if (summaryEnergy) summaryEnergy.textContent = formatPower(totalEnergy);
      if (summaryHeating) summaryHeating.textContent = formatPower(totalHeating);
      if (summaryCooling) summaryCooling.textContent = formatPower(totalCooling);

      updateChart();
    }

    function updateFilterUI() {
      document.querySelectorAll('.filter-pill[data-filter="gateway"]').forEach(pill => {
        pill.classList.toggle('active', filterState.gateways.has(pill.dataset.value));
      });
      const hasActiveFilters = filterState.gateways.size > 0 || filterState.kwhMin !== null;
      document.getElementById('clear-filters')?.classList.toggle('hidden', !hasActiveFilters);
    }

    // Wire up filter pill clicks
    document.querySelector('.filter-bar')?.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (pill?.dataset.filter === 'gateway') {
        dispatch({ type: 'TOGGLE_GATEWAY', id: pill.dataset.value });
      }
      if (e.target.closest('.filter-clear')) {
        dispatch({ type: 'CLEAR_ALL' });
      }
    });

    function formatPower(kWh) {
      return kWh.toFixed(2);
    }

    function formatRuntime(hours) {
      return hours.toFixed(1);
    }

    // Chart.js initialization for daily page
    (function() {
      const canvas = document.getElementById('energy-chart');
      if (!canvas || typeof __chartData === 'undefined') return;

      const { hourlyData, gateways } = __chartData;
      const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

      // Build per-gateway series
      const datasets = [];
      gateways.forEach((gw, i) => {
        const data = new Array(24).fill(0);
        hourlyData.forEach(row => {
          if (row.gateway_id === gw.id) {
            const h = parseInt(row.hour, 10);
            data[h] = row.total_energy;
          }
        });
        datasets.push({
          label: gw.name,
          data: data,
          borderColor: colors[i % colors.length],
          backgroundColor: colors[i % colors.length] + '22',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2,
          _gatewayId: gw.id,
        });
      });

      // Total series
      const totalData = new Array(24).fill(0);
      datasets.forEach(ds => {
        ds.data.forEach((v, i) => { totalData[i] += v; });
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

      const labels = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0') + ':00');

      const chart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          aspectRatio: 2.5,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top' },
            tooltip: { mode: 'index', intersect: false },
          },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'kWh' } },
          },
          onHover: (event, activeElements) => {
            document.querySelectorAll('#hourly-table tr.chart-highlight').forEach(r => r.classList.remove('chart-highlight'));
            if (!activeElements.length) return;
            const hourIndex = activeElements[0].index;
            const hourStr = String(hourIndex).padStart(2, '0');
            const wrapper = document.getElementById('table-wrapper');
            const rows = document.querySelectorAll('#hourly-table tr[data-hour="' + hourStr + '"]');
            let firstVisible = null;
            rows.forEach(r => {
              if (!r.classList.contains('hidden')) {
                r.classList.add('chart-highlight');
                if (!firstVisible) firstVisible = r;
              }
            });
            if (firstVisible && wrapper) {
              const rowRect = firstVisible.getBoundingClientRect();
              const wrapperRect = wrapper.getBoundingClientRect();
              const scrollTarget = wrapper.scrollTop + (rowRect.top - wrapperRect.top) - (wrapper.clientHeight / 2) + (rowRect.height / 2);
              wrapper.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
            }
          },
        },
      });

      window.__energyChart = chart;
    })();

    // Overview chart IIFE
    (function() {
      const canvas = document.getElementById('overview-chart');
      if (!canvas || typeof __overviewChartData === 'undefined') return;

      const { dailyTotals, gateways } = __overviewChartData;
      const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

      // Extract unique sorted dates
      const dateSet = new Set();
      dailyTotals.forEach(row => dateSet.add(row.date));
      const labels = Array.from(dateSet).sort();

      // Build per-gateway series
      const datasets = [];
      gateways.forEach((gw, i) => {
        const data = labels.map(date => {
          const match = dailyTotals.find(r => r.date === date && r.gateway_id === gw.id);
          return match ? match.total_energy : 0;
        });
        datasets.push({
          label: gw.name,
          data: data,
          borderColor: colors[i % colors.length],
          backgroundColor: colors[i % colors.length] + '22',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2,
          _gatewayId: gw.id,
        });
      });

      // Total series
      const totalData = new Array(labels.length).fill(0);
      datasets.forEach(ds => {
        ds.data.forEach((v, i) => { totalData[i] += v; });
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

      // Drag-to-zoom plugin for selection overlay
      const dragState = { active: false, startX: null, endX: null, clampLeft: false, clampRight: false };

      const dragZoomPlugin = {
        id: 'dragZoom',
        afterDraw(chart) {
          if (!dragState.active || dragState.startX === null || dragState.endX === null) return;
          const { ctx, chartArea } = chart;
          const left = Math.min(dragState.startX, dragState.endX);
          const right = Math.max(dragState.startX, dragState.endX);
          const x = Math.max(left, chartArea.left);
          const w = Math.min(right, chartArea.right) - x;
          ctx.save();
          ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
          ctx.fillRect(x, chartArea.top, w, chartArea.bottom - chartArea.top);
          // Draw bold edge borders when zooming beyond loaded data
          const edgeColor = 'rgba(37, 99, 235, 0.6)';
          const h = chartArea.bottom - chartArea.top;
          if (dragState.clampLeft) {
            ctx.fillStyle = edgeColor;
            ctx.shadowColor = 'rgba(37, 99, 235, 0.35)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 2;
            ctx.fillRect(chartArea.left - 1, chartArea.top, 3, h);
            ctx.shadowColor = 'transparent';
          }
          if (dragState.clampRight) {
            ctx.fillStyle = edgeColor;
            ctx.shadowColor = 'rgba(37, 99, 235, 0.35)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = -2;
            ctx.fillRect(chartArea.right - 2, chartArea.top, 3, h);
            ctx.shadowColor = 'transparent';
          }
          ctx.restore();
        },
      };

      const chart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        plugins: [dragZoomPlugin],
        options: {
          responsive: true,
          aspectRatio: 2.5,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top' },
            tooltip: { mode: 'index', intersect: false },
          },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'kWh' } },
          },
          onHover: (event, activeElements) => {
            document.querySelectorAll('#daily-table tr.chart-highlight').forEach(r => r.classList.remove('chart-highlight'));
            if (!activeElements.length) return;
            const dateIndex = activeElements[0].index;
            const dateStr = labels[dateIndex];
            const wrapper = document.getElementById('table-wrapper');
            const rows = document.querySelectorAll('#daily-table tr[data-date="' + dateStr + '"]');
            let firstVisible = null;
            rows.forEach(r => {
              if (!r.classList.contains('hidden')) {
                r.classList.add('chart-highlight');
                if (!firstVisible) firstVisible = r;
              }
            });
            if (firstVisible && wrapper) {
              const rowRect = firstVisible.getBoundingClientRect();
              const wrapperRect = wrapper.getBoundingClientRect();
              const scrollTarget = wrapper.scrollTop + (rowRect.top - wrapperRect.top) - (wrapper.clientHeight / 2) + (rowRect.height / 2);
              wrapper.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
            }
          },
        },
      });

      canvas.style.cursor = 'crosshair';

      // Drag-to-zoom event listeners
      canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < chart.chartArea.left || x > chart.chartArea.right) return;
        dragState.active = true;
        dragState.startX = x;
        dragState.endX = x;
      });

      canvas.addEventListener('mousemove', (e) => {
        if (!dragState.active) return;
        const rect = canvas.getBoundingClientRect();
        dragState.endX = e.clientX - rect.left;
        chart.draw();
      });

      canvas.addEventListener('mouseup', (e) => {
        if (!dragState.active) return;
        dragState.active = false;
        const rect = canvas.getBoundingClientRect();
        dragState.endX = e.clientX - rect.left;

        const xScale = chart.scales.x;
        let startIdx = xScale.getValueForPixel(Math.min(dragState.startX, dragState.endX));
        let endIdx = xScale.getValueForPixel(Math.max(dragState.startX, dragState.endX));
        startIdx = Math.max(0, Math.round(startIdx));
        endIdx = Math.min(labels.length - 1, Math.round(endIdx));

        if (startIdx === endIdx) return;

        const dateFrom = document.getElementById('date_from');
        const dateTo = document.getElementById('date_to');
        dateFrom.value = labels[startIdx];
        dateTo.value = labels[endIdx];
        dateFrom.dispatchEvent(new Event('change'));

        dragState.startX = null;
        dragState.endX = null;
        dragState.clampLeft = false;
        dragState.clampRight = false;
      });

      canvas.addEventListener('mouseleave', () => {
        if (dragState.active) {
          dragState.active = false;
          dragState.startX = null;
          dragState.endX = null;
          dragState.clampLeft = false;
          dragState.clampRight = false;
          chart.draw();
        }
      });
      
      function addDays(dateStr, days) {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
      }

      let wheelCursorTimer = null;
      let lastWheelTime = 0;
      const wheelThrottleMs = 50;

      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastWheelTime < wheelThrottleMs) return;
        lastWheelTime = now;
        const dateFrom = document.getElementById('date_from');
        const dateTo = document.getElementById('date_to');
        if (!dateFrom || !dateTo) return;

        const curFrom = dateFrom.value || labels[0];
        const curTo = dateTo.value || labels[labels.length - 1];

        let newFrom, newTo;
        if (e.deltaY > 0) {
          // Scroll down = zoom out
          newFrom = addDays(curFrom, -1);
          const today = new Date().toISOString().slice(0, 10);
          newTo = curTo >= today ? curTo : addDays(curTo, 1);
        } else {
          // Scroll up = zoom in
          newFrom = addDays(curFrom, 1);
          newTo = addDays(curTo, -1);
          if (newFrom >= newTo) return; // minimum 1-day range
        }

        dateFrom.value = newFrom;
        dateTo.value = newTo;
        dateFrom.dispatchEvent(new Event('change'));

        // Visual feedback: highlight pending range on chart
        const xScale = chart.scales.x;
        const fromIdx = labels.indexOf(newFrom);
        const toIdx = labels.indexOf(newTo);
        const leftPx = fromIdx >= 0 ? xScale.getPixelForValue(fromIdx) : chart.chartArea.left;
        const rightPx = toIdx >= 0 ? xScale.getPixelForValue(toIdx) : chart.chartArea.right;
        dragState.active = true;
        dragState.startX = leftPx;
        dragState.endX = rightPx;
        dragState.clampLeft = fromIdx < 0;
        dragState.clampRight = toIdx < 0;
        chart.draw();

        // Cursor feedback while scrolling
        canvas.style.cursor = 'ew-resize';
        clearTimeout(wheelCursorTimer);
        wheelCursorTimer = setTimeout(() => {
          dragState.active = false;
          dragState.startX = null;
          dragState.endX = null;
          dragState.clampLeft = false;
          dragState.clampRight = false;
          chart.draw();
          canvas.style.cursor = 'crosshair';
        }, 600);
      }, { passive: false });

      window.__overviewChart = chart;
    })();

    // Debounced date navigation for overview page
    (function() {
      const dateFrom = document.getElementById('date_from');
      const dateTo = document.getElementById('date_to');
      if (!dateFrom || !dateTo || document.getElementById('date')) return;

      let debounceTimer = null;
      function navigateWithDates() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const from = dateFrom.value;
          const to = dateTo.value;
          if (from && to) {
            window.location.href = '/?date_from=' + from + '&date_to=' + to;
          }
        }, 500);
      }
      dateFrom.addEventListener('change', navigateWithDates);
      dateTo.addEventListener('change', navigateWithDates);
    })();

    // Keyboard navigation for daily page (arrow keys + vim h/l)
    (function() {
      const dateInput = document.getElementById('date');
      if (!dateInput) return;
      const prevLink = dateInput.parentElement?.querySelector('a:first-child');
      const nextLink = dateInput.parentElement?.querySelector('a:last-child');
      if (!prevLink || !nextLink) return;

      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowLeft' || e.key === 'h') {
          prevLink.click();
        } else if (e.key === 'ArrowRight' || e.key === 'l') {
          nextLink.click();
        }
      });
    })();

    function updateChart() {
      [window.__energyChart, window.__overviewChart].filter(Boolean).forEach(chart => {
        const activeGateways = filterState.gateways;
        const visibleGatewayData = [];
        chart.data.datasets.forEach(ds => {
          if (ds._gatewayId === '__total') return;
          ds.hidden = activeGateways.size > 0 && !activeGateways.has(ds._gatewayId);
          if (!ds.hidden) visibleGatewayData.push(ds.data);
        });
        const totalDs = chart.data.datasets.find(ds => ds._gatewayId === '__total');
        if (totalDs) {
          if (activeGateways.size === 1) {
            totalDs.hidden = true;
          } else {
            totalDs.hidden = false;
            const newTotal = new Array(totalDs.data.length).fill(0);
            visibleGatewayData.forEach(data => {
              data.forEach((v, i) => { newTotal[i] += v; });
            });
            totalDs.data = newTotal;
          }
        }
        chart.update();
      });
    }
  </script>
</body>
</html>`;
}

export function formatTimestamp(unixMs: number): string {
  const date = new Date(unixMs);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return dateStr;
}

export function formatNumber(num: number): string {
  return num.toLocaleString();
}

export function formatPower(kWh: number | null): string {
  if (kWh === null) return '-';
  return kWh.toFixed(2);
}

export function formatRuntime(hours: number | null): string {
  if (hours === null) return '-';
  return hours.toFixed(1);
}

export function gatewayBadge(gatewayId: string): string {
  const safeId = escapeHtml(gatewayId);
  const name = getGatewayName(gatewayId);
  return `<span class="gateway-badge" title="${safeId}">${escapeHtml(name)}</span>`;
}
