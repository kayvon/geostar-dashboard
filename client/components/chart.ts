import { navigate } from '../router';
import { getGatewayName } from '../utils';
import { getFilterState } from './filters';

declare const Chart: any;

let overviewChart: any = null;
let dailyChart: any = null;

// Module-scoped mutable refs so event handlers never hold stale closures
let overviewLabels: string[] = [];
let overviewOnZoom: ((dateFrom: string, dateTo: string) => void) | null = null;

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

export function destroyChart(which: 'overview' | 'daily') {
  if (which === 'overview' && overviewChart) {
    overviewChart.destroy();
    overviewChart = null;
    overviewLabels = [];
    overviewOnZoom = null;
  }
  if (which === 'daily' && dailyChart) {
    dailyChart.destroy();
    dailyChart = null;
  }
}

// --- Overview Chart ---

interface OverviewChartData {
  labels: string[];
  datasets: any[];
  resolution: string;
}

const dragState = { active: false, startX: null as number | null, endX: null as number | null, clampLeft: false, clampRight: false };

const dragZoomPlugin = {
  id: 'dragZoom',
  afterDraw(chart: any) {
    if (!dragState.active || dragState.startX === null || dragState.endX === null) return;
    const { ctx, chartArea } = chart;
    const left = Math.min(dragState.startX, dragState.endX);
    const right = Math.max(dragState.startX, dragState.endX);
    const x = Math.max(left, chartArea.left);
    const w = Math.min(right, chartArea.right) - x;
    ctx.save();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.fillRect(x, chartArea.top, w, chartArea.bottom - chartArea.top);
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

const OVERVIEW_TRANSITION_MS = 400;

export function createOrUpdateOverviewChart(
  canvas: HTMLCanvasElement,
  data: OverviewChartData,
  onZoom: (dateFrom: string, dateTo: string) => void,
): any {
  const { labels, datasets, resolution } = data;
  const pointRadius = resolution === 'daily' ? 2 : resolution === 'hourly' ? 1 : 0;

  // Always update module-scoped refs so event handlers see fresh data
  overviewLabels = labels;
  overviewOnZoom = onZoom;

  if (overviewChart) {
    // In-place dataset mutation for animated transitions
    overviewChart.data.labels = labels;

    const existingIds = new Set(overviewChart.data.datasets.map((ds: any) => ds._gatewayId));
    const newIds = new Set(datasets.map((ds: any) => ds._gatewayId));

    // Update existing datasets in place
    overviewChart.data.datasets.forEach((ds: any) => {
      if (!newIds.has(ds._gatewayId)) return; // will be removed below
      const src = datasets.find((d: any) => d._gatewayId === ds._gatewayId);
      if (!src) return;
      for (let i = 0; i < src.data.length; i++) ds.data[i] = src.data[i];
      ds.data.length = src.data.length;
      ds.pointRadius = pointRadius;
    });

    // Remove stale datasets
    overviewChart.data.datasets = overviewChart.data.datasets.filter(
      (ds: any) => newIds.has(ds._gatewayId),
    );

    // Add new datasets
    datasets.forEach((ds: any) => {
      if (!existingIds.has(ds._gatewayId)) {
        ds.pointRadius = pointRadius;
        overviewChart.data.datasets.push(ds);
      }
    });

    overviewChart.options.scales.x = resolution !== 'daily' ? {
      ticks: {
        maxTicksLimit: 24,
        callback: function (_value: any, index: number) {
          const label = overviewLabels[index];
          if (!label) return label;
          return label.length > 10 ? label.slice(5) : label;
        },
      },
    } : {};
    overviewChart.update({ duration: OVERVIEW_TRANSITION_MS, easing: 'easeInOutQuart' });
    return overviewChart;
  }

  // Set point radius on all datasets for first render
  datasets.forEach((ds: any) => { ds.pointRadius = pointRadius; });

  overviewChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    plugins: [dragZoomPlugin],
    options: {
      responsive: true,
      aspectRatio: 2.5,
      interaction: { mode: 'index', intersect: false },
      transitions: {
        active: { animation: { duration: OVERVIEW_TRANSITION_MS } },
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: resolution !== 'daily' ? {
          ticks: {
            maxTicksLimit: 24,
            callback: function (_value: any, index: number) {
              const label = overviewLabels[index];
              if (!label) return label;
              return label.length > 10 ? label.slice(5) : label;
            },
          },
        } : {},
        y: { beginAtZero: true, title: { display: true, text: 'kWh' } },
      },
      onHover: (_event: any, activeElements: any[]) => {
        document.querySelectorAll('#daily-table tr.chart-highlight').forEach((r) => r.classList.remove('chart-highlight'));
        if (!activeElements.length) return;
        const dateIndex = activeElements[0].index;
        const dateStr = overviewLabels[dateIndex];
        const wrapper = document.getElementById('table-wrapper');
        const rows = document.querySelectorAll(`#daily-table tr[data-date="${dateStr}"]`);
        let firstVisible: Element | null = null;
        rows.forEach((r) => {
          if (!r.classList.contains('hidden')) {
            r.classList.add('chart-highlight');
            if (!firstVisible) firstVisible = r;
          }
        });
        if (firstVisible && wrapper) {
          const rowRect = firstVisible.getBoundingClientRect();
          const wrapperRect = wrapper.getBoundingClientRect();
          const scrollTarget = wrapper.scrollTop + (rowRect.top - wrapperRect.top) - wrapper.clientHeight / 2 + rowRect.height / 2;
          wrapper.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
        }
      },
    },
  });

  canvas.style.cursor = 'crosshair';

  // Double-click to navigate to daily page
  canvas.addEventListener('dblclick', (e) => {
    const points = overviewChart.getElementsAtEventForMode(e, 'index', { intersect: false }, false);
    if (!points.length) return;
    const dateStr = overviewLabels[points[0].index];
    if (dateStr) navigate('/daily?date=' + dateStr.slice(0, 10));
  });

  // Drag-to-zoom
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < overviewChart.chartArea.left || x > overviewChart.chartArea.right) return;
    dragState.active = true;
    dragState.startX = x;
    dragState.endX = x;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!dragState.active) return;
    const rect = canvas.getBoundingClientRect();
    dragState.endX = e.clientX - rect.left;
    overviewChart.draw();
  });

  canvas.addEventListener('mouseup', () => {
    if (!dragState.active) return;
    dragState.active = false;
    const xScale = overviewChart.scales.x;
    let startIdx = xScale.getValueForPixel(Math.min(dragState.startX!, dragState.endX!));
    let endIdx = xScale.getValueForPixel(Math.max(dragState.startX!, dragState.endX!));
    startIdx = Math.max(0, Math.round(startIdx));
    endIdx = Math.min(overviewLabels.length - 1, Math.round(endIdx));

    dragState.startX = null;
    dragState.endX = null;
    dragState.clampLeft = false;
    dragState.clampRight = false;

    if (startIdx === endIdx) return;
    if (overviewOnZoom) overviewOnZoom(overviewLabels[startIdx].slice(0, 10), overviewLabels[endIdx].slice(0, 10));
  });

  canvas.addEventListener('mouseleave', () => {
    if (dragState.active) {
      dragState.active = false;
      dragState.startX = null;
      dragState.endX = null;
      dragState.clampLeft = false;
      dragState.clampRight = false;
      overviewChart.draw();
    }
  });

  // Scroll-to-zoom
  function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  let wheelCursorTimer: ReturnType<typeof setTimeout> | null = null;
  let lastWheelTime = 0;
  const wheelThrottleMs = 50;

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelTime < wheelThrottleMs) return;
      lastWheelTime = now;

      const dateFrom = document.getElementById('date_from') as HTMLInputElement | null;
      const dateTo = document.getElementById('date_to') as HTMLInputElement | null;
      if (!dateFrom || !dateTo) return;

      const curFrom = dateFrom.value || overviewLabels[0];
      const curTo = dateTo.value || overviewLabels[overviewLabels.length - 1];

      let newFrom: string, newTo: string;
      if (e.deltaY > 0) {
        newFrom = addDays(curFrom, -1);
        const today = new Date().toISOString().slice(0, 10);
        newTo = curTo >= today ? curTo : addDays(curTo, 1);
      } else {
        newFrom = addDays(curFrom, 1);
        newTo = addDays(curTo, -1);
        if (newFrom >= newTo) return;
      }

      // Visual feedback
      const xScale = overviewChart.scales.x;
      const fromIdx = overviewLabels.indexOf(newFrom);
      const toIdx = overviewLabels.indexOf(newTo);
      const leftPx = fromIdx >= 0 ? xScale.getPixelForValue(fromIdx) : overviewChart.chartArea.left;
      const rightPx = toIdx >= 0 ? xScale.getPixelForValue(toIdx) : overviewChart.chartArea.right;
      dragState.active = true;
      dragState.startX = leftPx;
      dragState.endX = rightPx;
      dragState.clampLeft = fromIdx < 0;
      dragState.clampRight = toIdx < 0;
      overviewChart.draw();

      canvas.style.cursor = 'ew-resize';
      if (wheelCursorTimer) clearTimeout(wheelCursorTimer);
      wheelCursorTimer = setTimeout(() => {
        dragState.active = false;
        dragState.startX = null;
        dragState.endX = null;
        dragState.clampLeft = false;
        dragState.clampRight = false;
        overviewChart.draw();
        canvas.style.cursor = 'crosshair';
      }, 600);

      if (overviewOnZoom) overviewOnZoom(newFrom, newTo);
    },
    { passive: false },
  );

  return overviewChart;
}

// --- Daily Chart ---

const DAILY_TRANSITION_MS = 400;

export function createOrUpdateDailyChart(
  canvas: HTMLCanvasElement,
  gateways: string[],
  gatewayData: Record<string, number[]>,
  totalData: number[],
  labels: string[],
): any {
  if (dailyChart) {
    // Mutate existing dataset .data arrays in place so Chart.js animates
    dailyChart.data.datasets.forEach((ds: any) => {
      if (ds._gatewayId === '__total') {
        for (let i = 0; i < totalData.length; i++) ds.data[i] = totalData[i];
      } else if (gatewayData[ds._gatewayId]) {
        const src = gatewayData[ds._gatewayId];
        for (let i = 0; i < src.length; i++) ds.data[i] = src[i];
      }
    });
    dailyChart.update({ duration: DAILY_TRANSITION_MS, easing: 'easeInOutQuart' });
    return dailyChart;
  }

  // First render: build dataset objects
  const datasets: any[] = [];
  gateways.forEach((gw, i) => {
    datasets.push({
      label: getGatewayName(gw),
      data: [...gatewayData[gw]],
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '22',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 2,
      _gatewayId: gw,
    });
  });
  datasets.push({
    label: 'Total',
    data: [...totalData],
    borderColor: '#111827',
    backgroundColor: '#11182722',
    borderWidth: 3,
    tension: 0.3,
    pointRadius: 2,
    _gatewayId: '__total',
  });

  dailyChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      aspectRatio: 2.5,
      interaction: { mode: 'index', intersect: false },
      transitions: {
        active: { animation: { duration: DAILY_TRANSITION_MS } },
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'kWh' },
        },
      },
      onHover: (_event: any, activeElements: any[]) => {
        document.querySelectorAll('#hourly-table tr.chart-highlight').forEach((r) => r.classList.remove('chart-highlight'));
        if (!activeElements.length) return;
        const hourIndex = activeElements[0].index;
        const hourStr = String(hourIndex).padStart(2, '0');
        const wrapper = document.getElementById('table-wrapper');
        const rows = document.querySelectorAll(`#hourly-table tr[data-hour="${hourStr}"]`);
        let firstVisible: Element | null = null;
        rows.forEach((r) => {
          if (!r.classList.contains('hidden')) {
            r.classList.add('chart-highlight');
            if (!firstVisible) firstVisible = r;
          }
        });
        if (firstVisible && wrapper) {
          const rowRect = firstVisible.getBoundingClientRect();
          const wrapperRect = wrapper.getBoundingClientRect();
          const scrollTarget = wrapper.scrollTop + (rowRect.top - wrapperRect.top) - wrapper.clientHeight / 2 + rowRect.height / 2;
          wrapper.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
        }
      },
    },
  });

  return dailyChart;
}

// --- Shared filter/visibility update ---

export function updateChartVisibility(which: 'overview' | 'daily') {
  const chart = which === 'overview' ? overviewChart : dailyChart;
  if (!chart) return;

  const activeGateways = getFilterState().gateways;
  const visibleGatewayData: number[][] = [];

  chart.data.datasets.forEach((ds: any) => {
    if (ds._gatewayId === '__total') return;
    ds.hidden = activeGateways.size > 0 && !activeGateways.has(ds._gatewayId);
    if (!ds.hidden) visibleGatewayData.push(ds.data);
  });

  const totalDs = chart.data.datasets.find((ds: any) => ds._gatewayId === '__total');
  if (totalDs) {
    if (activeGateways.size === 1) {
      totalDs.hidden = true;
    } else {
      totalDs.hidden = false;
      const newTotal = new Array(totalDs.data.length).fill(0);
      visibleGatewayData.forEach((data) => {
        data.forEach((v: number, i: number) => {
          newTotal[i] += v;
        });
      });
      totalDs.data = newTotal;
    }
  }

  chart.update();
}
