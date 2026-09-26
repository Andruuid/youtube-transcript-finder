import React, { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, ScatterChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer]);
const DAY = 86400000;
const COLORS = ['#62dfbd', '#a699ff', '#63baff'];
const COIN_COLORS = { BTC: '#f5ba64', ETH: '#9cacf7', SOL: '#e98ce6' };
const utcDate = value => new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' });
const escape = (value) => String(value).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));

export function buildChartSeries({ points, channels, prices, coins, series, mode, from, to }) {
  const start = Date.parse(from), end = Date.parse(to);
  const days = Array.from({ length: Math.floor((end - start) / DAY) + 1 }, (_, i) => start + i * DAY);
  const result = [];
  channels.forEach((channel, i) => {
    const rows = points.filter(p => p.channelId === channel.channelId);
    const value = p => mode === 'raw' ? p.scores[series] : p.calibration?.[series]?.adjusted ?? null;
    const daily = new Map();
    rows.forEach(p => {
      const score = value(p);
      if (score == null) return;
      const day = Math.floor(Date.parse(p.publishedAt) / DAY) * DAY;
      daily.set(day, [...(daily.get(day) || []), score]);
    });
    const color = COLORS[i];
    result.push({ id: `average-${channel.channelId}`, name: channel.title, type: 'line', yAxisIndex: 0,
      data: days.map(d => [d, daily.has(d) ? daily.get(d).reduce((a, b) => a + b, 0) / daily.get(d).length : null]),
      symbol: 'none', connectNulls: false, lineStyle: { width: 2, color, opacity: 0.65 }, itemStyle: { color },
      markLine: i === 0 ? { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#6f7e8d', opacity: 0.5 }, data: [{ yAxis: 5.5 }] } : undefined });
    result.push({ id: `videos-${channel.channelId}`, name: channel.title, type: 'scatter', yAxisIndex: 0,
      data: rows.filter(p => value(p) != null).map(p => ({ value: [Date.parse(p.publishedAt), value(p)], analysisId: p.id, title: p.title,
        raw: p.scores[series], baseline: p.calibration?.[series]?.baseline, warnings: p.warnings.filter(w => w.asset === series).length,
        itemStyle: { color: p.warnings.some(w => w.asset === series) ? '#fa947f' : color }, symbol: p.warnings.some(w => w.asset === series) ? 'diamond' : 'circle' })),
      symbolSize: 8, itemStyle: { color, borderColor: '#101c25', borderWidth: 1 }, emphasis: { scale: 1.7 } });
  });
  const candleMaps = Object.fromEntries(coins.map(coin => [coin, new Map((prices[coin]?.candles || []).map(c => [Date.parse(c.day), c.close]))]));
  const commonStart = coins.length > 1 ? days.find(d => coins.every(c => candleMaps[c].has(d))) : null;
  coins.forEach(coin => {
    result.push({ id: `price-${coin}`, name: coins.length > 1 ? `${coin} · indexed` : `${coin} · USD`, type: 'line', yAxisIndex: 1,
      data: days.map(d => [d, !candleMaps[coin].has(d) || (coins.length > 1 && (commonStart == null || d < commonStart)) ? null :
        coins.length > 1 ? candleMaps[coin].get(d) / candleMaps[coin].get(commonStart) * 100 : candleMaps[coin].get(d)]),
      connectNulls: false, showSymbol: false, lineStyle: { color: COIN_COLORS[coin], width: 2, opacity: 0.85 }, itemStyle: { color: COIN_COLORS[coin] },
      areaStyle: coins.length === 1 ? { color: COIN_COLORS[coin], opacity: 0.045 } : undefined });
  });
  return result;
}

export default function CryptoChart({ data, params, coins, mode, onSelect }) {
  const container = useRef(null), chart = useRef(null), callback = useRef(onSelect);
  callback.current = onSelect;
  const lines = useMemo(() => buildChartSeries({ points: data?.points || [], channels: data?.coverage || [], prices: data?.prices || {}, coins, mode, ...params }), [data, coins, mode, params]);
  useEffect(() => {
    chart.current = echarts.init(container.current, null, { renderer: 'canvas' });
    chart.current.on('click', event => { if (event.data?.analysisId) callback.current(event.data.analysisId); });
    const observer = new ResizeObserver(() => chart.current?.resize());
    observer.observe(container.current);
    return () => { observer.disconnect(); chart.current.dispose(); chart.current = null; };
  }, []);
  useEffect(() => {
    chart.current.setOption({
      useUTC: true, animationDuration: 400, backgroundColor: 'transparent', textStyle: { fontFamily: 'Segoe UI, sans-serif' },
      grid: { left: 48, right: 76, top: 50, bottom: 80 },
      legend: { type: 'scroll', top: 4, left: 16, right: 16, pageIconColor: '#9ab3c1', pageIconInactiveColor: '#334854', pageTextStyle: { color: '#8d9dac' }, textStyle: { color: '#aab8c5', fontSize: 11 }, itemWidth: 15, itemHeight: 8 },
      xAxis: { type: 'time', min: Date.parse(params.from), max: Date.parse(params.to) + DAY - 1,
        axisLine: { lineStyle: { color: '#2c3b46' } }, axisTick: { show: false }, axisLabel: { color: '#8d9dac', hideOverlap: true }, splitLine: { show: false } },
      yAxis: [{ type: 'value', min: 1, max: 10, interval: 3, name: 'SENTIMENT', nameTextStyle: { color: '#8d9dac', fontSize: 10 },
        axisLabel: { color: '#8d9dac' }, splitLine: { lineStyle: { color: '#23313b', type: 'dashed' } } },
      { type: 'value', scale: true, name: coins.length > 1 ? 'INDEX · 100' : 'PRICE · USD', nameTextStyle: { color: '#a99b83', fontSize: 10 },
        axisLabel: { color: '#a99b83', formatter: v => coins.length > 1 ? Math.round(v) : v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}` }, splitLine: { show: false } }],
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross', snap: true }, backgroundColor: '#182832', borderColor: '#3a4d5a', textStyle: { color: '#e3edf4' }, confine: true,
        formatter: entries => (Array.isArray(entries) ? entries : [entries]).filter(p => p.value?.[1] != null).map(p => p.data?.analysisId ? `<div style="max-width:300px;white-space:normal"><strong>${escape(p.data.title)}</strong><br/>${escape(utcDate(p.value[0]))} · ${escape(p.seriesName)}<br/>${mode === 'raw' ? 'Bullishness' : 'Relative tone'}: <b>${Number(p.value[1]).toFixed(1)} / 10</b>${mode !== 'raw' ? `<br/>Raw ${p.data.raw} · baseline ${p.data.baseline?.toFixed(1)}` : ''}${p.data.warnings ? '<br/>◆ Explicit derisk statement' : ''}<br/><span style="color:#8d9dac">Click the point to read evidence</span></div>` : `${escape(p.seriesName)} · ${escape(utcDate(p.value[0]))}: <b>${Number(p.value[1]).toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>`).join('<br/>') },
      axisPointer: { link: [{ xAxisIndex: 'all' }], label: { backgroundColor: '#324856' } },
      dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'slider', xAxisIndex: 0, bottom: 12, height: 24, borderColor: '#263845',
        backgroundColor: '#101c25', fillerColor: '#62dfbd12', handleStyle: { color: '#62dfbd' }, textStyle: { color: '#8d9dac' }, dataBackground: { lineStyle: { color: '#526875' }, areaStyle: { color: '#263845' } } }],
      series: lines
    }, { replaceMerge: ['series'] });
  }, [lines, params, coins, mode]);
  useEffect(() => { chart.current?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 }); }, [params.from, params.to]);
  return <div ref={container} className="crypto-chart" role="img" aria-label="Influencer sentiment from 1 to 10 overlaid with daily cryptocurrency prices. Select a video below to read its evidence." />;
}
