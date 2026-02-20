export function shell(config: { timezone: string }): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GeoStar Energy Dashboard</title>
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
      <li><a href="/" data-link>Overview</a></li>
      <li><a href="/daily" data-link>Daily</a></li>
      <li><a href="/readings" data-link>Readings</a></li>
    </ul>
  </nav>
  <main class="container" id="app"></main>
  <footer class="container">
    <p class="muted" style="text-align: center; margin-top: 2rem;">
      GeoStar Energy Dashboard
    </p>
  </footer>
  <script>window.__config = { timezone: ${JSON.stringify(config.timezone)} };</script>
  <script src="/client.js"></script>
</body>
</html>`;
}
