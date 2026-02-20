export const GATEWAY_NAMES: Record<string, string> = {
  '8813BF342F64': '3-Ton',
  '8813BF34217C': '4-Ton',
};

export function getGatewayName(gatewayId: string): string {
  return GATEWAY_NAMES[gatewayId] || gatewayId;
}

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatPower(kWh: number | null): string {
  if (kWh === null) return '-';
  return kWh.toFixed(2);
}

export function formatRuntime(hours: number | null): string {
  if (hours === null) return '-';
  return hours.toFixed(1);
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

export function gatewayBadge(gatewayId: string): string {
  const safeId = escapeHtml(gatewayId);
  const name = getGatewayName(gatewayId);
  return `<span class="gateway-badge" title="${safeId}">${escapeHtml(name)}</span>`;
}
