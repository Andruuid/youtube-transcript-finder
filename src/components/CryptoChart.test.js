import { buildChartSeries } from './CryptoChart';
jest.mock('echarts/core',()=>({use:jest.fn()}));
jest.mock('echarts/charts',()=>({}));
jest.mock('echarts/components',()=>({}));
jest.mock('echarts/renderers',()=>({}));

const base={points:[],channels:[],prices:{},coins:[],series:'overall',mode:'raw',from:'2023-01-01',to:'2023-01-03'};
test('multi-coin overlays share the first common base date and preserve missing days',()=>{
  const lines=buildChartSeries({...base,coins:['BTC','SOL'],prices:{
    BTC:{candles:[{day:'2023-01-01',close:10},{day:'2023-01-02',close:20},{day:'2023-01-03',close:30}]},
    SOL:{candles:[{day:'2023-01-02',close:5}]}
  }});
  expect(lines[0].data.map(d=>d[1])).toEqual([null,100,150]);
  expect(lines[1].data.map(d=>d[1])).toEqual([null,100,null]);
  expect(lines[0].connectNulls).toBe(false);
});
test('multiple videos retain individual evidence points and create one daily mean',()=>{
  const lines=buildChartSeries({...base,channels:[{channelId:1,title:'Creator'}],points:[
    {id:1,channelId:1,publishedAt:'2023-01-01T10:00:00Z',scores:{overall:4},warnings:[]},
    {id:2,channelId:1,publishedAt:'2023-01-01T20:00:00Z',scores:{overall:8},warnings:[{asset:'overall'}]}
  ]});
  expect(lines[0].data.map(d=>d[1])).toEqual([6,null,null]);
  expect(lines[1].data.map(d=>d.analysisId)).toEqual([1,2]);
  expect(lines[1].data[1].symbol).toBe('diamond');
});
test('relative tone never falls back to raw scores when calibration is unavailable',()=>{
  const lines=buildChartSeries({...base,mode:'adjusted',channels:[{channelId:1,title:'Creator'}],points:[{id:1,channelId:1,publishedAt:'2023-01-01',scores:{overall:8},warnings:[]}]});
  expect(lines[1].data).toEqual([]);
});
