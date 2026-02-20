export interface OverviewApiResponse {
  stats: {
    total_energy: number;
    total_heating: number;
    total_cooling: number;
    total_runtime: number;
  };
  totals: Array<{
    date: string;
    gateway_id: string;
    total_energy: number;
    total_heating: number;
    total_cooling: number;
    total_runtime: number;
  }>;
  gateways: string[];
  filters: {
    date_from: string;
    date_to: string;
    resolution: string;
  };
}

export interface DailyApiResponse {
  date: string;
  summary: {
    total_energy: number;
    total_heating: number;
    total_cooling: number;
  };
  hourly: Array<{
    hour: string;
    gateway_id: string;
    total_energy: number;
    total_heating: number;
    total_cooling: number;
    heat_1: number;
    heat_2: number;
    cool_1: number;
    cool_2: number;
  }>;
  gateways: string[];
}

export interface ReadingsApiResponse {
  readings: Array<{
    id: number;
    gateway_id: string;
    timestamp: number;
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
  }>;
  page: number;
  total: number;
  gateways: string[];
  filters: {
    gateway_id: string;
    date_from: string;
    date_to: string;
    sort: string;
    order: string;
  };
}
