import { Hono } from 'hono';
import type { Env, OverviewStats, DailyTotal, HourlyBreakdown, EnergyReading } from '../types';
import { overviewPage, dailyPage, readingsPage } from '../templates/dashboard';

const app = new Hono<{ Bindings: Env }>();

/**
 * Get the UTC offset in milliseconds for a given timezone on a given date.
 * Handles DST automatically via the Intl API.
 */
function getTimezoneOffsetMs(timezone: string, dateStr: string): number {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  });
  const formatted = formatter.format(date);
  const match = formatted.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2]);
  const minutes = parseInt(match[3]);
  return sign * (hours * 3600000 + minutes * 60000);
}

// Helper to get default date range (last 7 days in the configured timezone)
function getDefaultDateRange(timezone: string): { date_from: string; date_to: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  const to = formatter.format(now);
  const from = formatter.format(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  return { date_from: from, date_to: to };
}

// Helper to convert date string to Unix ms, adjusted for timezone
function dateToUnixMs(dateStr: string, timezone: string, endOfDay = false): number {
  const offsetMs = getTimezoneOffsetMs(timezone, dateStr);
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date.getTime() - offsetMs;
}

// Overview page (/)
app.get('/', async (c) => {
  const db = c.env.GEOSTAR_DB;

  const timezone = c.env.TIMEZONE || 'America/Los_Angeles';

  // Get date filters (default to last 7 days)
  const defaults = getDefaultDateRange(timezone);
  const date_from = c.req.query('date_from') || defaults.date_from;
  const date_to = c.req.query('date_to') || defaults.date_to;

  const offsetMs = getTimezoneOffsetMs(timezone, date_from);
  const fromMs = dateToUnixMs(date_from, timezone);
  const toMs = dateToUnixMs(date_to, timezone, true);

  // Get totals for the date range
  const statsResult = await db
    .prepare(
      `
      SELECT
        COALESCE(SUM(total_power), 0) as total_energy,
        COALESCE(SUM(COALESCE(total_heat_1, 0) + COALESCE(total_heat_2, 0)), 0) as total_heating,
        COALESCE(SUM(COALESCE(total_cool_1, 0) + COALESCE(total_cool_2, 0)), 0) as total_cooling,
        COALESCE(SUM(
          COALESCE(runtime_heat_1, 0) + COALESCE(runtime_heat_2, 0) +
          COALESCE(runtime_cool_1, 0) + COALESCE(runtime_cool_2, 0) +
          COALESCE(runtime_electric_heat, 0) + COALESCE(runtime_fan_only, 0)
        ), 0) as total_runtime
      FROM energy_readings
      WHERE timestamp >= ? AND timestamp <= ?
    `,
    )
    .bind(fromMs, toMs)
    .first<{ total_energy: number; total_heating: number; total_cooling: number; total_runtime: number }>();

  const stats: OverviewStats = {
    total_energy: statsResult?.total_energy || 0,
    total_heating: statsResult?.total_heating || 0,
    total_cooling: statsResult?.total_cooling || 0,
    total_runtime: statsResult?.total_runtime || 0,
  };

  // Get daily totals (grouped by date and gateway for front-end filtering)
  const dailyResult = await db
    .prepare(
      `
      SELECT
        date((timestamp + ?) /1000, 'unixepoch') as date,
        gateway_id,
        COALESCE(SUM(total_power), 0) as total_energy,
        COALESCE(SUM(COALESCE(total_heat_1, 0) + COALESCE(total_heat_2, 0)), 0) as total_heating,
        COALESCE(SUM(COALESCE(total_cool_1, 0) + COALESCE(total_cool_2, 0)), 0) as total_cooling,
        COALESCE(SUM(
          COALESCE(runtime_heat_1, 0) + COALESCE(runtime_heat_2, 0) +
          COALESCE(runtime_cool_1, 0) + COALESCE(runtime_cool_2, 0) +
          COALESCE(runtime_electric_heat, 0) + COALESCE(runtime_fan_only, 0)
        ), 0) as total_runtime
      FROM energy_readings
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY date, gateway_id
      ORDER BY date DESC, gateway_id
    `,
    )
    .bind(offsetMs, fromMs, toMs)
    .all<DailyTotal>();

  const dailyTotals = dailyResult.results || [];

  // Get list of gateways
  const gatewaysResult = await db
    .prepare('SELECT DISTINCT gateway_id FROM energy_readings ORDER BY gateway_id')
    .all<{ gateway_id: string }>();
  const gateways = (gatewaysResult.results || []).map((r) => r.gateway_id);

  return c.html(overviewPage(stats, dailyTotals, gateways, { date_from, date_to }));
});

// Daily details page (/daily)
app.get('/daily', async (c) => {
  const db = c.env.GEOSTAR_DB;

  const timezone = c.env.TIMEZONE || 'America/Los_Angeles';

  // Get date (default to today in configured timezone)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  const date = c.req.query('date') || today;

  const offsetMs = getTimezoneOffsetMs(timezone, date);
  const fromMs = dateToUnixMs(date, timezone);
  const toMs = dateToUnixMs(date, timezone, true);

  // Get daily summary
  const summaryResult = await db
    .prepare(
      `
      SELECT
        COALESCE(SUM(total_power), 0) as total_energy,
        COALESCE(SUM(COALESCE(total_heat_1, 0) + COALESCE(total_heat_2, 0)), 0) as total_heating,
        COALESCE(SUM(COALESCE(total_cool_1, 0) + COALESCE(total_cool_2, 0)), 0) as total_cooling
      FROM energy_readings
      WHERE timestamp >= ? AND timestamp <= ?
    `,
    )
    .bind(fromMs, toMs)
    .first<{ total_energy: number; total_heating: number; total_cooling: number }>();

  const summary = {
    total_energy: summaryResult?.total_energy || 0,
    total_heating: summaryResult?.total_heating || 0,
    total_cooling: summaryResult?.total_cooling || 0,
  };

  // Get hourly breakdown (grouped by hour and gateway)
  const hourlyResult = await db
    .prepare(
      `
      SELECT
        printf('%02d', cast(strftime('%H', (timestamp + ?) /1000, 'unixepoch') as integer)) as hour,
        gateway_id,
        COALESCE(SUM(total_power), 0) as total_energy,
        COALESCE(SUM(COALESCE(total_heat_1, 0) + COALESCE(total_heat_2, 0)), 0) as total_heating,
        COALESCE(SUM(COALESCE(total_cool_1, 0) + COALESCE(total_cool_2, 0)), 0) as total_cooling,
        COALESCE(SUM(total_heat_1), 0) as heat_1,
        COALESCE(SUM(total_heat_2), 0) as heat_2,
        COALESCE(SUM(total_cool_1), 0) as cool_1,
        COALESCE(SUM(total_cool_2), 0) as cool_2
      FROM energy_readings
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY hour, gateway_id
      ORDER BY hour, gateway_id
    `,
    )
    .bind(offsetMs, fromMs, toMs)
    .all<HourlyBreakdown>();

  const hourlyData = hourlyResult.results || [];

  // Get list of gateways
  const gatewaysResult = await db
    .prepare('SELECT DISTINCT gateway_id FROM energy_readings ORDER BY gateway_id')
    .all<{ gateway_id: string }>();
  const gateways = (gatewaysResult.results || []).map((r) => r.gateway_id);

  return c.html(dailyPage(date, summary, hourlyData, gateways));
});

// Valid sort columns to prevent SQL injection
const VALID_SORT_COLUMNS = ['timestamp', 'gateway_id', 'total_power'];

// Readings page (/readings) - paginated raw readings
app.get('/readings', async (c) => {
  const db = c.env.GEOSTAR_DB;

  const page = parseInt(c.req.query('page') || '1');
  const gateway_id = c.req.query('gateway_id') || '';
  const date_from = c.req.query('date_from') || '';
  const date_to = c.req.query('date_to') || '';
  const sort = c.req.query('sort') || 'timestamp';
  const order = c.req.query('order') || 'desc';
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  // Validate sort column to prevent SQL injection
  const sortColumn = VALID_SORT_COLUMNS.includes(sort) ? sort : 'timestamp';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  // Build where clause
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (gateway_id) {
    conditions.push('gateway_id = ?');
    params.push(gateway_id);
  }
  const timezone = c.env.TIMEZONE || 'America/Los_Angeles';
  if (date_from) {
    conditions.push('timestamp >= ?');
    params.push(dateToUnixMs(date_from, timezone));
  }
  if (date_to) {
    conditions.push('timestamp <= ?');
    params.push(dateToUnixMs(date_to, timezone, true));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM energy_readings ${whereClause}`;
  const countResult = await db
    .prepare(countQuery)
    .bind(...params)
    .first<{ count: number }>();
  const total = countResult?.count || 0;

  // Get readings
  const readingsQuery = `
    SELECT * FROM energy_readings
    ${whereClause}
    ORDER BY ${sortColumn} ${sortOrder}
    LIMIT ? OFFSET ?
  `;
  const readingsResult = await db
    .prepare(readingsQuery)
    .bind(...params, pageSize, offset)
    .all<EnergyReading>();
  const readings = readingsResult.results || [];

  // Get list of gateways for filter dropdown
  const gatewaysResult = await db
    .prepare('SELECT DISTINCT gateway_id FROM energy_readings ORDER BY gateway_id')
    .all<{ gateway_id: string }>();
  const gateways = (gatewaysResult.results || []).map((r) => r.gateway_id);

  return c.html(
    readingsPage(
      readings,
      page,
      total,
      { gateway_id, date_from, date_to, sort: sortColumn, order: sortOrder.toLowerCase() },
      gateways,
    ),
  );
});

export default app;
