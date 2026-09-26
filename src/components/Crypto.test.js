import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Crypto from './Crypto';
import { listChannels } from '../services/libraryService';
import { IVAN_CHANNEL, initialCryptoChannels, loadCryptoDashboard, loadCryptoAnalyses, loadCryptoJobs, loadCryptoDetail, startCryptoJob, saveCryptoBaseline } from '../services/cryptoService';

jest.mock('../services/libraryService', () => ({ listChannels: jest.fn() }));
jest.mock('../services/cryptoService', () => ({ ...jest.requireActual('../services/cryptoService'),
  loadCryptoDashboard: jest.fn(), loadCryptoAnalyses: jest.fn(), loadCryptoJobs: jest.fn(), loadCryptoDetail: jest.fn(),
  startCryptoJob: jest.fn(), controlCryptoJob: jest.fn(), saveCryptoBaseline: jest.fn() }));
jest.mock('./CryptoChart', () => function Chart({ onSelect }) { return <button onClick={() => onSelect(1)}>Test chart point</button>; });

const channels = [ { youtubeChannelId: IVAN_CHANNEL, title: 'Ivan on Tech', downloadedCount: 1 },
  ...['a','b','c'].map(c => ({ youtubeChannelId: 'UC'+c.repeat(22), title: `Channel ${c}`, downloadedCount: 0 })) ];
const result = { relevant: true, summary: 'A cautiously optimistic outlook.', scores: { overall: 7, BTC: 7, ETH: null, SOL: null }, confidence: .8,
  evidence: [{asset:'BTC',quote:'Bitcoin can go higher.',explanation:'Endorsed outlook'}],calls:[],actions:[] };
function dashboard() {
  const day = new Date(Date.now()-86400000).toISOString();
  return { coverage:[{channelId:75,title:'Ivan on Tech',cataloged:2,downloaded:2,eligible:2,analyzed:1,relevant:1,irrelevant:0,failed:0,missing:0,unknownDuration:0,short:0,pending:1}],
    profiles:[{channelId:75,title:'Ivan on Tech',version:null,profile:null,overrides:{}}],
    prices: Object.fromEntries(['BTC','ETH','SOL'].map(a=>[a,{earliest:'2021-01-01',latest:day,candles:[]}])),
    points:[{id:1,channelId:75,publishedAt:'2023-01-01',scores:result.scores,warnings:[]}],
    scorecards:[{channelId:75,samples:1,hitRate:1,alwaysBullish:1,averageReturn:3,pending:0,unavailable:0,warnings:[],warningCount:0,warningSamples:0,sentiment:{samples:1,averageReturn:3}}] };
}
beforeEach(()=>{
  jest.clearAllMocks(); localStorage.clear();
  HTMLDialogElement.prototype.showModal = jest.fn(function () { this.setAttribute('open', ''); });
  listChannels.mockResolvedValue(channels);
  loadCryptoDashboard.mockResolvedValue(dashboard());loadCryptoJobs.mockResolvedValue([]);
  loadCryptoAnalyses.mockResolvedValue({total:1,items:[{id:1,channelId:75,title:'Bitcoin outlook',publishedAt:'2023-01-01',result}]});
  loadCryptoDetail.mockResolvedValue({model:'openai/gpt-6-luna',promptVersion:'crypto-v1',channel:{title:'Ivan on Tech'},video:{title:'Bitcoin outlook',publishedAt:'2023-01-01',youtubeVideoId:'testvideo01',transcriptText:'Bitcoin can go higher.'},result});
  startCryptoJob.mockResolvedValue({id:'job'});saveCryptoBaseline.mockResolvedValue({});
});
test('defaults to saved Ivan, enforces three channels, and displays pending analysis count',async()=>{
  expect(initialCryptoChannels(channels)).toEqual([IVAN_CHANNEL]);
  render(<Crypto/>);
  expect(await screen.findByRole('button',{name:'✦ Analyze 1'})).toBeEnabled();
  expect(loadCryptoDashboard).toHaveBeenCalledWith(expect.objectContaining({channelIds:[IVAN_CHANNEL],from:'2021-01-01'}),expect.anything());
  fireEvent.click(screen.getByRole('button',{name:'＋ Channels'}));
  fireEvent.click(screen.getByRole('checkbox',{name:/Channel a/}));
  fireEvent.click(screen.getByRole('checkbox',{name:/Channel b/}));
  expect(screen.getByRole('checkbox',{name:/Channel c/})).toBeDisabled();
});
test('starts analysis and exposes evidence from a chart click',async()=>{
  render(<Crypto/>);
  fireEvent.click(await screen.findByRole('button',{name:'✦ Analyze 1'}));
  await waitFor(()=>expect(startCryptoJob).toHaveBeenCalledWith(expect.objectContaining({channelIds:[IVAN_CHANNEL]}),'analysis'));
  fireEvent.click(screen.getByRole('button',{name:'Test chart point'}));
  expect(await screen.findByText('What supports the score')).toBeInTheDocument();
  expect(screen.getByText('“Bitcoin can go higher.”')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Watch original video ↗'})).toHaveAttribute('href','https://www.youtube.com/watch?v=testvideo01');
});
test('manual baseline editing preserves separate raw and outcome controls',async()=>{
  render(<Crypto/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Edit baseline settings ↗'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Edit baseline settings ↗'}));
  fireEvent.change(screen.getByLabelText('Ivan on Tech Overall crypto baseline'),{target:{value:'8.5'}});
  fireEvent.click(screen.getByRole('button',{name:'Save baseline settings'}));
  await waitFor(()=>expect(saveCryptoBaseline).toHaveBeenCalledWith(75,{overall:8.5}));
  fireEvent.click(screen.getByRole('button',{name:'Relative tone'}));
  expect(screen.getByText('Relative tone, not a bearish trading signal.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Outcome horizon'),{target:{value:'90'}});
  await waitFor(()=>expect(loadCryptoDashboard).toHaveBeenLastCalledWith(expect.objectContaining({horizon:90}),expect.anything()));
});
test('empty library and API errors are actionable',async()=>{
  listChannels.mockResolvedValue([]);
  const {unmount}=render(<Crypto/>);
  expect(await screen.findByText('Add a channel in Channel Monitor to start your research.')).toBeInTheDocument();
  unmount();listChannels.mockResolvedValue(channels);loadCryptoDashboard.mockRejectedValue(new Error('API unavailable'));
  render(<Crypto/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('API unavailable');
  expect(screen.getByRole('button',{name:'Retry'})).toBeEnabled();
});

test('older saved results require explicit reanalysis and fixed-window outcomes are labeled accurately',async()=>{
  const data=dashboard();data.coverage[0].legacy=1;
  loadCryptoDashboard.mockResolvedValue(data);
  render(<Crypto/>);
  const upgrade=await screen.findByRole('button',{name:'Reanalyze older results'});
  expect(screen.getByText('1 saved analyses use an older prompt.')).toBeInTheDocument();
  expect(screen.getByRole('columnheader',{name:'Direction match'})).toBeInTheDocument();
  expect(startCryptoJob).not.toHaveBeenCalled();
  fireEvent.click(upgrade);
  await waitFor(()=>expect(startCryptoJob).toHaveBeenCalledWith(expect.objectContaining({reprocessLegacy:true}),'analysis'));
});
