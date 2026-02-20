import type { OverviewApiResponse, DailyApiResponse, ReadingsApiResponse } from './types';

let currentController: AbortController | null = null;

function abortPrevious(): AbortSignal {
  if (currentController) currentController.abort();
  currentController = new AbortController();
  return currentController.signal;
}

export async function fetchOverview(params: {
  date_from?: string;
  date_to?: string;
  resolution?: string;
}): Promise<OverviewApiResponse> {
  const signal = abortPrevious();
  const query = new URLSearchParams();
  if (params.date_from) query.set('date_from', params.date_from);
  if (params.date_to) query.set('date_to', params.date_to);
  if (params.resolution) query.set('resolution', params.resolution);
  const resp = await fetch(`/api/overview?${query}`, { signal });
  return resp.json();
}

export async function fetchDaily(params: {
  date?: string;
}): Promise<DailyApiResponse> {
  const signal = abortPrevious();
  const query = new URLSearchParams();
  if (params.date) query.set('date', params.date);
  const resp = await fetch(`/api/daily?${query}`, { signal });
  return resp.json();
}

export async function fetchReadings(params: {
  page?: number;
  gateway_id?: string;
  date_from?: string;
  date_to?: string;
  sort?: string;
  order?: string;
}): Promise<ReadingsApiResponse> {
  const signal = abortPrevious();
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.gateway_id) query.set('gateway_id', params.gateway_id);
  if (params.date_from) query.set('date_from', params.date_from);
  if (params.date_to) query.set('date_to', params.date_to);
  if (params.sort) query.set('sort', params.sort);
  if (params.order) query.set('order', params.order);
  const resp = await fetch(`/api/readings?${query}`, { signal });
  return resp.json();
}
