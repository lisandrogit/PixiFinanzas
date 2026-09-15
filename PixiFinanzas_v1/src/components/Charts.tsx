import React from 'react';
import ReactECharts from 'echarts-for-react';

const FONT = 'Roboto, system-ui, sans-serif';
const AXIS = { fontFamily: FONT, fontSize: 10, color: '#7d7979' };
const GRID_LINE = { lineStyle: { color: '#e2dfdf' } };

// Tema oscuro opcional (paleta v2 del rediseño Figma) — todas las funciones
// de este módulo siguen siendo light por defecto para no afectar a las
// pantallas que todavía no fueron migradas; `dark` es aditivo.
const V2_FONT = "'DM Sans', system-ui, sans-serif";
const AXIS_DARK = { fontFamily: V2_FONT, fontSize: 10, color: '#7b83a6' };
const GRID_LINE_DARK = { lineStyle: { color: '#232840' } };
const AXIS_LINE_DARK = { lineStyle: { color: '#232840' } };
const INK_DARK = '#e8eaf2';

// Hex literales de la paleta v2 (deben coincidir con tailwind.config.js
// `theme.extend.colors.v2`) para usar como colores de series — ECharts no
// puede consumir clases de Tailwind, así que las páginas ya migradas
// importan estas constantes en vez de repetir los hex a mano.
export const V2_ACCENT = '#00d4aa';
export const V2_ACCENT2 = '#5b8dee';
export const V2_INK = INK_DARK;
export const V2_PALETTE = ['#00d4aa', '#5b8dee', '#f59e0b', '#ff4d6d', '#a78bfa'];

const baseGrid = { left: 56, right: 20, top: 24, bottom: 28 };
// Charts with a legend need extra bottom room so the legend row doesn't sit
// on top of the x-axis labels — ECharts positions both independently of one
// another, they don't reflow to avoid each other.
const legendGrid = { left: 56, right: 20, top: 24, bottom: 60 };

function moneyShort(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

export function LineComboChart({ labels, series, height = 300, dark = false }: {
  labels: string[];
  series: { name: string; data: number[]; color: string; area?: boolean; dashed?: boolean }[];
  height?: number;
  dark?: boolean;
}) {
  const axis = dark ? AXIS_DARK : AXIS;
  const option = {
    textStyle: { fontFamily: dark ? V2_FONT : FONT },
    grid: legendGrid,
    tooltip: { trigger: 'axis', textStyle: { fontFamily: dark ? V2_FONT : FONT } },
    legend: { bottom: 6, textStyle: { fontFamily: dark ? V2_FONT : FONT, fontSize: 11, color: dark ? '#7b83a6' : undefined } },
    xAxis: { type: 'category', data: labels, axisLine: dark ? AXIS_LINE_DARK : { lineStyle: { color: '#d7d3d3' } }, axisLabel: axis, axisTick: { show: false } },
    yAxis: { type: 'value', splitLine: dark ? GRID_LINE_DARK : GRID_LINE, axisLabel: { ...axis, formatter: moneyShort } },
    series: series.map((s) => ({
      name: s.name, type: 'line', data: s.data, smooth: 0.25, symbol: 'circle', symbolSize: 6,
      lineStyle: { width: s.dashed ? 2 : 2.5, color: s.color, type: s.dashed ? 'dashed' : 'solid' },
      itemStyle: { color: s.color },
      areaStyle: s.area ? { color: s.color, opacity: 0.12 } : undefined,
    })),
  };
  return <ReactECharts option={option} style={{ height }} notMerge />;
}

export function BarComboChart({ labels, groups, totalLine, height = 300, dark = false }: {
  labels: string[];
  groups: { name: string; data: number[]; color: string }[];
  totalLine?: number[];
  height?: number;
  dark?: boolean;
}) {
  const axis = dark ? AXIS_DARK : AXIS;
  const inkColor = dark ? INK_DARK : '#201e1d';
  const series: any[] = groups.map((g) => ({
    name: g.name, type: 'bar', data: g.data, itemStyle: { color: g.color, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 18,
  }));
  if (totalLine) {
    series.push({ name: 'Total', type: 'line', data: totalLine, lineStyle: { color: inkColor, width: 2, type: 'dashed' }, symbol: 'circle', symbolSize: 5, itemStyle: { color: inkColor } });
  }
  const option = {
    textStyle: { fontFamily: dark ? V2_FONT : FONT },
    grid: legendGrid,
    tooltip: { trigger: 'axis', textStyle: { fontFamily: dark ? V2_FONT : FONT } },
    legend: { bottom: 6, textStyle: { fontFamily: dark ? V2_FONT : FONT, fontSize: 11, color: dark ? '#7b83a6' : undefined } },
    xAxis: { type: 'category', data: labels, axisLine: dark ? AXIS_LINE_DARK : { lineStyle: { color: '#d7d3d3' } }, axisLabel: axis, axisTick: { show: false } },
    yAxis: { type: 'value', splitLine: dark ? GRID_LINE_DARK : GRID_LINE, axisLabel: { ...axis, formatter: moneyShort } },
    series,
  };
  return <ReactECharts option={option} style={{ height }} notMerge />;
}

export function BarLineChart({ labels, bars, line, height = 260, lineFormatter, dark = false, barColor }: {
  labels: string[]; bars: number[]; line?: number[]; height?: number; lineFormatter?: (v: number) => string; dark?: boolean; barColor?: string;
}) {
  const axis = dark ? AXIS_DARK : AXIS;
  const inkColor = dark ? INK_DARK : '#201e1d';
  const option = {
    textStyle: { fontFamily: dark ? V2_FONT : FONT },
    grid: baseGrid,
    tooltip: { trigger: 'axis', textStyle: { fontFamily: dark ? V2_FONT : FONT } },
    xAxis: { type: 'category', data: labels, axisLine: dark ? AXIS_LINE_DARK : { lineStyle: { color: '#d7d3d3' } }, axisLabel: { ...axis, fontSize: 9 }, axisTick: { show: false } },
    yAxis: { type: 'value', splitLine: dark ? GRID_LINE_DARK : GRID_LINE, axisLabel: { ...axis, formatter: lineFormatter || moneyShort } },
    series: [
      { type: 'bar', data: bars, itemStyle: { color: barColor || (dark ? V2_ACCENT2 : '#1565d8'), borderRadius: [3, 3, 0, 0] }, barMaxWidth: 20 },
      ...(line ? [{ type: 'line', data: line, lineStyle: { color: inkColor, width: 2 }, symbol: 'circle', symbolSize: 5, itemStyle: { color: inkColor } }] : []),
    ],
  };
  return <ReactECharts option={option} style={{ height }} notMerge />;
}

const GAUGE_COLORS: [number, string][] = [
  [0.2, '#16794f'], [0.4, '#5fae73'], [0.6, '#e0b02c'], [0.8, '#e07a3c'], [1, '#c9372a'],
];

// Color de zona (verde→rojo) para un valor de -30 a 30 — usado tanto por el
// propio needle del gauge como por el indicador "en vivo" que lo acompaña en
// Home.tsx, para que ambos coincidan siempre.
export function gaugeColorFor(pct: number): string {
  const clamped = Math.max(-30, Math.min(30, pct));
  const norm = (clamped + 30) / 60;
  for (const [stop, color] of GAUGE_COLORS) if (norm <= stop) return color;
  return GAUGE_COLORS[GAUGE_COLORS.length - 1][1];
}

export function SaludGauge({ variacionPct, height = 220, dark = false }: { variacionPct: number; height?: number; dark?: boolean }) {
  const clamped = Math.max(-30, Math.min(30, variacionPct));
  const pointerColor = gaugeColorFor(variacionPct);
  const option = {
    // Sweep suave tanto en el montaje inicial como cuando el valor cambia
    // (ej. al tildar/destildar categorías) — sin esto el needle salta de golpe.
    animationDuration: 1100,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 900,
    animationEasingUpdate: 'cubicOut',
    series: [{
      type: 'gauge',
      startAngle: 180, endAngle: 0, min: -30, max: 30,
      radius: '100%', center: ['50%', '78%'],
      axisLine: { lineStyle: { width: 22, color: GAUGE_COLORS } },
      pointer: {
        width: 6, length: '58%',
        itemStyle: { color: pointerColor, shadowColor: pointerColor, shadowBlur: 10 },
      },
      anchor: {
        show: true, showAbove: true, size: 14,
        itemStyle: { color: dark ? INK_DARK : '#201e1d', borderColor: pointerColor, borderWidth: 3 },
      },
      axisTick: { show: false }, splitLine: { length: 10, lineStyle: { color: dark ? '#141720' : '#fff', width: 2 } },
      axisLabel: { fontFamily: dark ? V2_FONT : FONT, fontSize: 10, color: dark ? '#7b83a6' : '#605d5d', distance: -34 },
      detail: { show: false },
      data: [{ value: clamped }],
    }],
  };
  // Its flex parent uses items-start (so the pill below it hugs its own content
  // instead of stretching), which leaves this chart's own width unconstrained —
  // w-full forces it to fill the row regardless of the parent's cross-axis alignment.
  return <ReactECharts option={option} style={{ height }} notMerge className="w-full" />;
}
