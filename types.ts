export interface Env {
  GEOSTAR_DB: D1Database;
  TIMEZONE: string;
}

export interface EnergyReading {
  id: number;
  gateway_id: string;
  timestamp: number; // Unix ms
  total_heat_1: number | null;
  total_heat_2: number | null;
  total_cool_1: number | null;
  total_cool_2: number | null;
  total_electric_heat: number | null;
  total_fan_only: number | null;
  total_loop_pump: number | null;
  total_dehumidification: number | null;
  runtime_heat_1: number | null;
  runtime_heat_2: number | null;
  runtime_cool_1: number | null;
  runtime_cool_2: number | null;
  runtime_electric_heat: number | null;
  runtime_fan_only: number | null;
  runtime_dehumidification: number | null;
  total_power: number | null;
}

export interface OverviewStats {
  total_energy: number;
  total_heating: number;
  total_cooling: number;
  total_runtime: number;
}

export interface DailyTotal {
  date: string;
  gateway_id: string;
  total_energy: number;
  total_heating: number;
  total_cooling: number;
  total_runtime: number;
}

export interface HourlyBreakdown {
  hour: string;
  gateway_id: string;
  total_energy: number;
  total_heating: number;
  total_cooling: number;
  heat_1: number;
  heat_2: number;
  cool_1: number;
  cool_2: number;
  electric_heat: number;
  fan_only: number;
}

export interface DailySummary {
  total_energy: number;
  total_heating: number;
  total_cooling: number;
  total_runtime: number;
}
