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
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--pico-card-background-color);
      border: 1px solid var(--pico-muted-border-color);
      border-radius: var(--pico-border-radius);
      padding: 1.5rem;
      text-align: center;
    }
    .stat-card h3 {
      margin: 0 0 0.5rem 0;
      font-size: 0.9rem;
      color: var(--pico-muted-color);
      text-transform: uppercase;
    }
    .stat-card .value {
      font-size: 2rem;
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
      padding: 1rem;
      margin-bottom: 1rem;
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
    // Front-end filtering by gateway
    function filterByGateway(gatewayId) {
      const rows = document.querySelectorAll('[data-gateway]');
      const statCards = document.querySelectorAll('[data-stat]');

      // Track totals for updating stat cards and summary
      let totalEnergy = 0, totalHeating = 0, totalCooling = 0, totalRuntime = 0;

      rows.forEach(row => {
        const rowGateway = row.getAttribute('data-gateway');
        if (!gatewayId || gatewayId === 'all' || rowGateway === gatewayId) {
          row.classList.remove('hidden');
          // Accumulate stats from visible rows
          totalEnergy += parseFloat(row.getAttribute('data-energy') || '0');
          totalHeating += parseFloat(row.getAttribute('data-heating') || '0');
          totalCooling += parseFloat(row.getAttribute('data-cooling') || '0');
          totalRuntime += parseFloat(row.getAttribute('data-runtime') || '0');
        } else {
          row.classList.add('hidden');
        }
      });

      // Update stat cards if they exist (overview page)
      statCards.forEach(card => {
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
          if (statType === 'runtime') {
            valueEl.textContent = formatRuntime(value);
          } else {
            valueEl.textContent = formatPower(value);
          }
        }
      });

      // Update daily summary if it exists (daily page)
      const summaryEnergy = document.getElementById('summary-energy');
      const summaryHeating = document.getElementById('summary-heating');
      const summaryCooling = document.getElementById('summary-cooling');

      if (summaryEnergy) summaryEnergy.textContent = formatPower(totalEnergy);
      if (summaryHeating) summaryHeating.textContent = formatPower(totalHeating);
      if (summaryCooling) summaryCooling.textContent = formatPower(totalCooling);
    }

    function formatPower(kWh) {
      return kWh.toFixed(2);
    }

    function formatRuntime(hours) {
      return hours.toFixed(1);
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
