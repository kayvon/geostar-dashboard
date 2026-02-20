import { Hono } from 'hono';
import type { Env, OverviewStats, DailyTotal, HourlyBreakdown, EnergyReading, Resolution } from '../types';

const api = new Hono<{ Bindings: Env }>();

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

function getDefaultDateRange(timezone: string): { date_from: string; date_to: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  const to = formatter.format(now);
  const from = formatter.format(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  return { date_from: from, date_to: to };
}

function dateToUnixMs(dateStr: string, timezone: string, endOfDay = false): number {
  const offsetMs = getTimezoneOffsetMs(timezone, dateStr);
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date.getTime() - offsetMs;
}

// GET /api/overview
api.get('/overview', async (c) => {
  const db = c.env.GEOSTAR_DB;
  const timezone = c.env.TIMEZONE || 'America/Los_Angeles';

  const defaults = getDefaultDateRange(timezone);
  const date_from = c.req.query('date_from') || defaults.date_from;
  const date_to = c.req.query('date_to') || defaults.date_to;
  const rawResolution = c.req.query('resolution') || 'daily';
  const resolution: Resolution = (['daily', 'hourly', '15min'].includes(rawResolution) ? rawResolution : 'daily') as Resolution;

  const offsetMs = getTimezoneOffsetMs(timezone, date_from);
  const fromMs = dateToUnixMs(date_from, timezone);
  const toMs = dateToUnixMs(date_to, timezone, true);

  const statsResult = await db
    .prepare(
      `SELECT
        COALESCE(SUM(total_power), 0) as total_energy,
        COALESCE(SUM(COALESCE(total_heat_1, 0) + COALESCE(total_heat_2, 0)), 0) as total_heating,
        COALESCE(SUM(COALESCE(total_cool_1, 0) + COALESCE(total_cool_2, 0)), 0) as total_cooling,
        COALESCE(SUM(
          COALESCE(runtime_heat_1, 0) + COALESCE(runtime_heat_2, 0) +
          COALESCE(runtime_cool_1, 0) + COALESCE(runtime_cool_2, 0) +
          COALESCE(runtime_electric_heat, 0) + COALESCE(runtime_fan_only, 0)
        ), 0) as total_runtime
      FROM energy_readings
      WHERE timestamp >= ? AND timestamp <= ?`,
    )
    .bind(fromMs, toMs)
    .first<{ total_energy: number; total_heating: number; total_cooling: number; total_runtime: number }>();

  const stats: OverviewStats = {
    total_energy: statsResult?.total_energy || 0,
    total_heating: statsResult?.total_heating || 0,
    total_cooling: statsResult?.total_cooling || 0,
    total_runtime: statsResult?.total_runtime || 0,
  };

  let dateBucketExpr: string;
  let bucketBinds: number[];
  switch (resolution) {
    case 'hourly':
      dateBucketExpr = `date((timestamp + ?) /1000, 'unixepoch') || ' ' || printf('%02d', cast(strftime('%H', (timestamp + ?) /1000, 'unixepoch') as integer)) || ':00'`;
      bucketBinds = [offsetMs, offsetMs];
      break;
    case '15min':
      dateBucketExpr = `date((timestamp + ?) /1000, 'unixepoch') || ' ' || printf('%02d', cast(strftime('%H', (timestamp + ?) /1000, 'unixepoch') as integer)) || ':' || printf('%02d', (cast(strftime('%M', (timestamp + ?) /1000, 'unixepoch') as integer) / 15) * 15)`;
      bucketBinds = [offsetMs, offsetMs, offsetMs];
      break;
    default:
      dateBucketExpr = `date((timestamp + ?) /1000, 'unixepoch')`;
      bucketBinds = [offsetMs];
      break;
  }

  const dailyResult = await db
    .prepare(
      `SELECT
        ${dateBucketExpr} as date,
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
      ORDER BY date DESC, gateway_id`,
    )
    .bind(...bucketBinds, fromMs, toMs)
    .all<DailyTotal>();

  const gatewaysResult = await db
    .prepare('SELECT DISTINCT gateway_id FROM energy_readings ORDER BY gateway_id')
    .all<{ gateway_id: string }>();
  const gateways = (gatewaysResult.results || []).map((r) => r.gateway_id);

  return c.json({
    stats,
    totals: dailyResult.results || [],
    gateways,
    filters: { date_from, date_to, resolution },
  });
});

// GET /api/daily
api.get('/daily', async (c) => {
  const db = c.env.GEOSTAR_DB;
  const timezone = c.env.TIMEZONE || 'America/Los_Angeles';

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  const date = c.req.query('date') || today;

  const offsetMs = getTimezoneOffsetMs(timezone, date);
  const fromMs = dateToUnixMs(date, timezone);
  const toMs = dateToUnixMs(date, timezone, true);

  const summaryResult = await db
    .prepare(
      `SELECT
        COALESCE(SUM(total_power), 0) as total_energy,
        COALESCE(SUM(COALESCE(total_heat_1, 0) + COALESCE(total_heat_2, 0)), 0) as total_heating,
        COALESCE(SUM(COALESCE(total_cool_1, 0) + COALESCE(total_cool_2, 0)), 0) as total_cooling
      FROM energy_readings
      WHERE timestamp >= ? AND timestamp <= ?`,
    )
    .bind(fromMs, toMs)
    .first<{ total_energy: number; total_heating: number; total_cooling: number }>();

  const summary = {
    total_energy: summaryResult?.total_energy || 0,
    total_heating: summaryResult?.total_heating || 0,
    total_cooling: summaryResult?.total_cooling || 0,
  };

  const hourlyResult = await db
    .prepare(
      `SELECT
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
      ORDER BY hour, gateway_id`,
    )
    .bind(offsetMs, fromMs, toMs)
    .all<HourlyBreakdown>();

  const gatewaysResult = await db
    .prepare('SELECT DISTINCT gateway_id FROM energy_readings ORDER BY gateway_id')
    .all<{ gateway_id: string }>();
  const gateways = (gatewaysResult.results || []).map((r) => r.gateway_id);

  return c.json({
    date,
    summary,
    hourly: hourlyResult.results || [],
    gateways,
  });
});

// GET /api/readings
const VALID_SORT_COLUMNS = ['timestamp', 'gateway_id', 'total_power'];

api.get('/readings', async (c) => {
  const db = c.env.GEOSTAR_DB;
  const timezone = c.env.TIMEZONE || 'America/Los_Angeles';

  const page = parseInt(c.req.query('page') || '1');
  const gateway_id = c.req.query('gateway_id') || '';
  const date_from = c.req.query('date_from') || '';
  const date_to = c.req.query('date_to') || '';
  const sort = c.req.query('sort') || 'timestamp';
  const order = c.req.query('order') || 'desc';
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const sortColumn = VALID_SORT_COLUMNS.includes(sort) ? sort : 'timestamp';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (gateway_id) {
    conditions.push('gateway_id = ?');
    params.push(gateway_id);
  }
  if (date_from) {
    conditions.push('timestamp >= ?');
    params.push(dateToUnixMs(date_from, timezone));
  }
  if (date_to) {
    conditions.push('timestamp <= ?');
    params.push(dateToUnixMs(date_to, timezone, true));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM energy_readings ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();
  const total = countResult?.count || 0;

  const readingsResult = await db
    .prepare(
      `SELECT * FROM energy_readings
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?`,
    )
    .bind(...params, pageSize, offset)
    .all<EnergyReading>();

  const gatewaysResult = await db
    .prepare('SELECT DISTINCT gateway_id FROM energy_readings ORDER BY gateway_id')
    .all<{ gateway_id: string }>();
  const gateways = (gatewaysResult.results || []).map((r) => r.gateway_id);

  return c.json({
    readings: readingsResult.results || [],
    page,
    total,
    gateways,
    filters: { gateway_id, date_from, date_to, sort: sortColumn, order: sortOrder.toLowerCase() },
  });
});

export default api;
