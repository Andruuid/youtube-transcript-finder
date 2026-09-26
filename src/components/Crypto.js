import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listChannels } from '../services/libraryService';
import { initialCryptoChannels, CRYPTO_SELECTION_KEY, loadCryptoDashboard, loadCryptoAnalyses, loadCryptoDetail, loadCryptoJobs,
  startCryptoJob, controlCryptoJob, saveCryptoBaseline } from '../services/cryptoService';
import ChannelAvatar from './ChannelAvatar';
import CryptoChart from './CryptoChart';
import './Crypto.css';

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (value, suffix = '') => value == null ? '—' : `${Number(value).toFixed(1)}${suffix}`;
const percent = value => value == null ? '—' : `${value > 0 ? '+' : ''}${Number(value).toFixed(1)}%`;
const date = value => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'No data';
const labels = { overall: 'Overall crypto', BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana' };
const activeJob = job => ['queued', 'running'].includes(job.status);

function Dialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-label={title} className={`crypto-dialog ${wide ? 'crypto-dialog-wide' : ''}`} onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <div className="crypto-dialog-heading"><h2>{title}</h2><button onClick={onClose} aria-label="Close dialog">✕</button></div>{children}
  </dialog>;
}

function AnalysisDetail({ id, onClose }) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    loadCryptoDetail(id, controller.signal).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id]);
  return <Dialog title="Behind the signal" onClose={onClose} wide>
    {error && <p role="alert" className="crypto-error">{error}</p>}
    {!data && !error && <p className="crypto-muted">Loading transcript evidence…</p>}
    {data && <>
      <div className="crypto-eyebrow">{data.channel.title} <span>· {date(data.video.publishedAt)} UTC</span></div>
      <h3 className="crypto-video-title">{data.video.title}</h3>
      <p className="crypto-summary">{data.result.summary || data.result.reason}</p>
      <div className="crypto-detail-scores">{Object.entries(data.result.scores).map(([key, score]) => <div key={key}><span>{labels[key]}</span><strong>{fmt(score)}<small> / 10</small></strong></div>)}</div>
      <p className="crypto-muted">Model confidence: {Math.round(data.result.confidence * 100)}% · {data.model} · {data.promptVersion}</p>
      <h3>What supports the score</h3>
      {data.result.evidence.map((e, i) => <blockquote key={i}><span className="crypto-tag">{labels[e.asset]}</span><p>“{e.quote}”</p><footer>{e.explanation}</footer></blockquote>)}
      <h3>Explicit calls & actions</h3>
      {!data.result.calls.length && !data.result.actions.length && <p className="crypto-muted">No explicit endorsed calls or actions found. Sentiment alone is not a trading instruction.</p>}
      {[...data.result.calls, ...data.result.actions].map((c, i) => <div className="crypto-call" key={i}><b>{c.asset.toUpperCase()} · {(c.direction || c.action).replaceAll('_', ' ')}</b><span>{c.conditional ? 'Conditional · excluded from accuracy' : 'Explicit statement'}{c.horizon ? ` · Horizon: ${c.horizon}` : ''}</span><p>“{c.quote}”</p></div>)}
      <a className="crypto-watch" href={`https://www.youtube.com/watch?v=${data.video.youtubeVideoId}`} target="_blank" rel="noreferrer">Watch original video ↗</a>
      <details className="crypto-transcript"><summary>Read full saved transcript</summary><p>{data.video.transcriptText || 'Transcript no longer available.'}</p></details>
    </>}
  </Dialog>;
}

function BaselineEditor({ profiles, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(profiles.map(p => [p.channelId, p.overrides])));
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setError('');
    try { for (const profile of profiles) await saveCryptoBaseline(profile.channelId, draft[profile.channelId]); onSaved(); onClose(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <Dialog title="Calibrate the creator, not the market" onClose={onClose}>
    <p className="crypto-muted">Automatic baselines use at least 20 earlier videos in the preceding year. Manual values change the relative-tone display only. Raw scores and accuracy stay unchanged.</p>
    {profiles.map(profile => <section className="crypto-baseline-section" key={profile.channelId}>
      <h3>{profile.title}</h3><p className="crypto-muted">{profile.version ? `Calibration v${profile.version} · ${date(profile.createdAt)}${profile.stale ? ' · New analyses: recalibrate' : ''}` : 'No calibration run yet'}</p>
      {Object.keys(labels).map(series => <label className="crypto-baseline-field" key={series}><span>{labels[series]}<small>Automatic: {profile.profile?.[series]?.baseline == null ? 'Insufficient history' : fmt(profile.profile[series].baseline)} · {profile.profile?.[series]?.samples || 0} samples</small></span>
        <input aria-label={`${profile.title} ${labels[series]} baseline`} type="number" min="1" max="10" step="0.1" placeholder="Auto" value={draft[profile.channelId]?.[series] ?? ''} onChange={e => {
          const value = e.target.value; setDraft(previous => { const values = { ...previous[profile.channelId] }; if (!value) delete values[series]; else values[series] = Number(value); return { ...previous, [profile.channelId]: values }; });
        }} /></label>)}
      <button className="crypto-text-button" onClick={() => setDraft(prev => ({ ...prev, [profile.channelId]: {} }))}>Reset this channel to automatic</button>
    </section>)}
    {error && <p className="crypto-error" role="alert">{error}</p>}
    <button className="crypto-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save baseline settings'}</button>
  </Dialog>;
}

export default function Crypto() {
  const [channels, setChannels] = useState([]), [selected, setSelected] = useState([]);
  const [from, setFrom] = useState('2021-01-01'), [to, setTo] = useState(today);
  const [series, setSeries] = useState('overall'), [horizon, setHorizon] = useState(30), [mode, setMode] = useState('raw');
  const [coins, setCoins] = useState(['BTC']), [data, setData] = useState(null), [jobs, setJobs] = useState([]);
  const [analyses, setAnalyses] = useState({ items: [], total: 0 }), [filter, setFilter] = useState('all'), [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [detail, setDetail] = useState(null), [baseline, setBaseline] = useState(false), [picker, setPicker] = useState(false), [channelSearch, setChannelSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const priceStarted = useRef(false);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  const params = useMemo(() => ({ channelIds: selected, from, to, series, horizon }), [selected, from, to, series, horizon]);
  const validRange = from >= '2021-01-01' && from <= to && to <= today();

  useEffect(() => {
    let ignore = false;
    listChannels().then(list => { if (!ignore) { setChannels(list); setSelected(initialCryptoChannels(list)); if (!list.length) setLoading(false); } }).catch(e => { if (!ignore) { setError(e.message); setLoading(false); } });
    return () => { ignore = true; };
  }, []);
  useEffect(() => { if (selected.length) localStorage.setItem(CRYPTO_SELECTION_KEY, JSON.stringify(selected)); }, [selected]);
  useEffect(() => { setPage(0); }, [selected, from, to, filter]);
  useEffect(() => {
    if (!selected.length || !validRange) return undefined;
    const controller = new AbortController();
    Promise.all([loadCryptoDashboard(params, controller.signal), loadCryptoJobs(params, controller.signal),
      loadCryptoAnalyses({ ...params, filter, skip: page * 20 }, controller.signal)])
      .then(([dashboard, jobList, list]) => { setData(dashboard); setJobs(jobList); setAnalyses(list); setError(''); setLoading(false); })
      .catch(e => { if (!controller.signal.aborted) { setError(e.message); setLoading(false); } });
    return () => controller.abort();
  }, [params, selected.length, validRange, filter, page, revision]);
  useEffect(() => { const timer = setInterval(refresh, 10000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => {
    if (!data || priceStarted.current) return;
    priceStarted.current = true;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (Object.values(data.prices).some(p => !p.latest || p.latest.slice(0, 10) < yesterday) && !jobs.some(j => j.kind === 'prices' && (activeJob(j) || j.status === 'paused'))) {
      startCryptoJob(params, 'prices').then(refresh).catch(e => setError(e.message));
    }
  }, [data, jobs, params, refresh]);

  const counts = (data?.coverage || []).reduce((totals, row) => { for (const key of ['cataloged', 'downloaded', 'eligible', 'analyzed', 'relevant', 'irrelevant', 'failed', 'missing', 'unknownDuration', 'short', 'pending']) totals[key] = (totals[key] || 0) + row[key]; return totals; }, {});
  const processing = jobs.some(j => activeJob(j) && j.kind !== 'prices');
  const selectedChannels = channels.filter(c => selected.includes(c.youtubeChannelId));
  const points = data?.points || [];
  const scored = points.filter(p => p.scores[series] != null);
  const average = scored.length ? scored.reduce((n, p) => n + p.scores[series], 0) / scored.length : null;
  const latest = scored.at(-1);
  const deriskCount = points.filter(p => p.warnings.some(w => w.asset === series)).length;
  async function action(kind) {
    setBusy(kind); setError('');
    try { await startCryptoJob(params, kind); refresh(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  async function jobAction(id, actionName) {
    setBusy(id); try { await controlCryptoJob(id, actionName); refresh(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  function preset(days) { setTo(today()); setFrom(days ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : '2021-01-01'); }
  const visibleJobs = jobs.filter(j => j.status !== 'complete').slice(0, 4);

  return <div className="crypto">
    <div className="crypto-hero">
      <div><div className="crypto-eyebrow"><span className="crypto-live-dot" /> CRYPTO INTELLIGENCE <span>/ CREATOR RESEARCH</span></div>
        <h1>Conviction meets <em>reality.</em></h1><p>What they said. How the market moved. The evidence in between.</p></div>
      <div className="crypto-model"><span>ANALYSIS ENGINE</span><b>GPT-6 Luna <i>↗</i></b><small>via OpenRouter · transcript grounded</small></div>
    </div>

    <section className="crypto-workbench" aria-label="Research controls">
      <div className="crypto-control-row">
        <div className="crypto-channel-control"><label>YOUR RESEARCH CHANNELS <span>{selected.length}/3</span></label>
          <div className="crypto-channel-chips">{selectedChannels.map(c => <span className="crypto-channel-chip" key={c.youtubeChannelId}><ChannelAvatar src={c.thumbnailUrl} /><b>{c.title}</b><button aria-label={`Remove ${c.title}`} disabled={selected.length === 1} onClick={() => setSelected(prev => prev.filter(id => id !== c.youtubeChannelId))}>×</button></span>)}
            <button className="crypto-add-channel" onClick={() => setPicker(!picker)} aria-expanded={picker}>＋ {selected.length ? 'Channels' : 'Select channels'}</button></div>
          {picker && <div className="crypto-channel-picker"><input autoFocus placeholder="Search saved channels…" aria-label="Search saved channels" value={channelSearch} onChange={e => setChannelSearch(e.target.value)} />
            <div>{channels.filter(c => `${c.title} ${c.handle || ''}`.toLowerCase().includes(channelSearch.toLowerCase())).map(c => <label key={c.youtubeChannelId}><input type="checkbox" checked={selected.includes(c.youtubeChannelId)} disabled={(!selected.includes(c.youtubeChannelId) && selected.length >= 3) || (selected.includes(c.youtubeChannelId) && selected.length === 1)} onChange={e => setSelected(prev => e.target.checked ? [...prev, c.youtubeChannelId] : prev.filter(id => id !== c.youtubeChannelId))} /><span>{c.title}</span><small>{c.downloadedCount || 0} transcripts</small></label>)}</div><button onClick={() => setPicker(false)}>Done</button></div>}
        </div>
        <div className="crypto-date-control"><label htmlFor="crypto-from">RESEARCH WINDOW · UTC</label><div><input id="crypto-from" aria-label="Start date" type="date" min="2021-01-01" max={to} value={from} onChange={e => setFrom(e.target.value)} /><span>→</span><input aria-label="End date" type="date" min={from} max={today()} value={to} onChange={e => setTo(e.target.value)} /></div></div>
      </div>
      <div className="crypto-actions-row"><div className="crypto-action-buttons">
        <button className="crypto-primary" disabled={!selected.length || !validRange || processing || !!busy || (!counts.pending && !counts.unknownDuration)} onClick={() => action('analysis')}>✦ {busy === 'analysis' ? 'Starting…' : 'Analyze'} <span>{counts.pending || 0}</span></button>
        <button disabled={!selected.length || !validRange || processing || !!busy || !counts.relevant} onClick={() => action('calibration')}>◎ Calibrate</button>
        <button disabled={!selected.length || !validRange || processing || !!busy} onClick={() => action('history')}>↓ Import history</button>
      </div><span className="crypto-muted">{counts.pending || 0} saved videos ready · under 3 minutes excluded</span></div>
    </section>
    {!validRange && <p className="crypto-error" role="alert">Choose a valid research window between January 2021 and today.</p>}
    {error && <div className="crypto-error" role="alert">{error}<button onClick={refresh}>Retry</button></div>}
    {loading && <div className="crypto-loading">Loading your research library…</div>}
    {!loading && !channels.length && <div className="crypto-empty">Add a channel in Channel Monitor to start your research.</div>}
    {!!visibleJobs.length && <section className="crypto-jobs" aria-label="Processing progress">{visibleJobs.map(job => <div className="crypto-job" key={job.id}>
      <div><span className={`crypto-status ${job.status}`}>{job.kind} · {job.status}</span><p>{job.message}</p><small>{job.total ? `${job.counts.complete || 0} of ${job.total} saved · ${job.counts.failed || 0} failed` : 'Progress is saved automatically'}</small>
        {!!job.errors.length && <details><summary>View errors</summary>{job.errors.map(e => <p key={e.youtubeVideoId}>{e.youtubeVideoId}: {e.error}</p>)}</details>}</div>
      <div>{activeJob(job) ? <button disabled={!!busy} onClick={() => jobAction(job.id, 'stop')}>Stop</button> : <><button disabled={!!busy} onClick={() => jobAction(job.id, 'resume')}>Resume</button>{!!job.counts.failed && <button disabled={!!busy} onClick={() => jobAction(job.id, 'retry')}>Retry failed</button>}</>}</div>
    </div>)}</section>}

    <section className="crypto-metrics" aria-label="Research overview">
      <div><span>AVERAGE CONVICTION</span><strong className="crypto-mint">{fmt(average)}<small>/ 10</small></strong><p>{labels[series]} · raw sentiment</p><div className="crypto-mini-meter"><i style={{ width: `${(average || 0) * 10}%` }} /></div></div>
      <div><span>LATEST SIGNAL</span><strong>{latest ? fmt(latest.scores[series]) : '—'}<small>/ 10</small></strong><p>{latest ? date(latest.publishedAt) : 'Analyze saved transcripts to begin'}</p><span className="crypto-small-tag">{latest ? latest.scores[series] >= 7 ? 'BULLISH' : latest.scores[series] <= 4 ? 'BEARISH' : 'NEUTRAL / MIXED' : 'AWAITING EVIDENCE'}</span></div>
      <div><span>DERISK STATEMENTS</span><strong className="crypto-coral">{deriskCount}<small>videos</small></strong><p>Explicit sell, take-profit & reduce-risk calls</p><span className="crypto-small-tag">◆ TRANSCRIPT VERIFIED</span></div>
      <div><span>RESEARCH COVERAGE</span><strong>{counts.analyzed || 0}<small>/ {counts.eligible || 0}</small></strong><p>Analyzed / eligible catalog videos</p><span className="crypto-small-tag">{counts.missing || 0} TRANSCRIPTS MISSING</span></div>
    </section>

    <section className="crypto-chart-panel">
      <div className="crypto-panel-heading"><div><div className="crypto-eyebrow">THE BIG PICTURE</div><h2>Sentiment vs. the market</h2></div><div className="crypto-segmented" aria-label="Score display">{['raw', 'adjusted'].map(value => <button key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>{value === 'raw' ? 'Raw score' : 'Relative tone'}</button>)}</div></div>
      <div className="crypto-chart-toolbar"><div className="crypto-chart-selectors"><select aria-label="Sentiment series" value={series} onChange={e => setSeries(e.target.value)}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label} sentiment</option>)}</select><div className="crypto-coins">{['BTC', 'ETH', 'SOL'].map(coin => <button key={coin} className={coins.includes(coin) ? `selected coin-${coin}` : ''} aria-pressed={coins.includes(coin)} onClick={() => setCoins(prev => prev.includes(coin) ? prev.filter(c => c !== coin) : [...prev, coin])}><span>●</span> {coin}</button>)}</div></div>
        <div className="crypto-presets">{[[90, '3M'], [365, '1Y'], [1095, '3Y'], [0, 'ALL']].map(([days, label]) => <button key={label} onClick={() => preset(days)}>{label}</button>)}</div></div>
      <CryptoChart data={data} params={params} coins={coins} mode={mode} onSelect={setDetail} />
      {!points.length && <div className="crypto-chart-notice"><b>Your first signal starts with a transcript.</b><span>Analyze saved videos, or import history to build a longer timeline. Price data is shown as it becomes available.</span></div>}
      {mode === 'adjusted' && <div className="crypto-chart-notice"><b>Relative tone, not a bearish trading signal.</b><span>Requires calibration and 20 earlier scored videos, or a manual baseline. Gaps mean insufficient history.</span></div>}
      <div className="crypto-chart-footer"><span>● Individual video & daily average <span className="crypto-coral">◆ Derisk statement</span> · UTC</span><button className="crypto-text-button" onClick={() => action('prices')} disabled={!!busy || jobs.some(j => j.kind === 'prices' && activeJob(j))}>↻ Refresh prices</button></div>
      <div className="crypto-price-coverage">{coins.map(coin => <span key={coin}>{coin}: {date(data?.prices[coin]?.earliest)} — {date(data?.prices[coin]?.latest)}</span>)}<span>Coinbase Exchange · daily USD close{coins.length > 1 ? ' · indexed to 100 on first common date' : ''}</span></div>
    </section>

    <div className="crypto-research-grid">
      <section className="crypto-scorecard-panel"><div className="crypto-panel-heading"><div><div className="crypto-eyebrow">ACCOUNTABILITY</div><h2>Did the calls hold up?</h2></div><select aria-label="Outcome horizon" value={horizon} onChange={e => setHorizon(Number(e.target.value))}>{[7, 30, 90].map(h => <option key={h} value={h}>{h} days later</option>)}</select></div>
        <p className="crypto-muted">Explicit directional calls · {series === 'overall' ? 'BTC benchmark for general crypto calls' : `${series} price outcomes`}</p>
        <div className="crypto-scorecard-scroll"><table className="crypto-scorecard"><thead><tr><th>Creator</th><th>Hit rate</th><th>Always bullish</th><th>Avg. return</th><th>Samples</th></tr></thead><tbody>{(data?.scorecards || []).map(card => <tr key={card.channelId}><td>{data.coverage.find(c => c.channelId === card.channelId)?.title}</td><td className="crypto-mint">{fmt(card.hitRate == null ? null : card.hitRate * 100, '%')}</td><td>{fmt(card.alwaysBullish == null ? null : card.alwaysBullish * 100, '%')}</td><td>{percent(card.averageReturn)}</td><td>{card.samples}<small>{card.pending} pending · {card.unavailable} unavailable</small></td></tr>)}</tbody></table></div>
        <div className="crypto-outcome-notes">{(data?.scorecards || []).map(card => <div key={card.channelId}><h3>{data.coverage.find(c => c.channelId === card.channelId)?.title}</h3><div className="crypto-outcome-pair"><p><span>After derisk statements</span><b>{percent(card.warningReturn)}</b><small>{card.warningSamples || 0}/{card.warningCount || 0} complete · avg. largest decline {fmt(card.warningDecline, '%')}</small></p><p><span>Sentiment-associated returns</span><b>{percent(card.sentiment?.averageReturn)}</b><small>{card.sentiment?.samples || 0} videos · bullish {percent(card.sentiment?.bullishReturn)} / bearish {percent(card.sentiment?.bearishReturn)}</small></p></div>
          {!!card.warnings?.length && <details><summary>Inspect derisk outcomes</summary>{card.warnings.map(w => <button className="crypto-warning-outcome" key={w.analysisId} onClick={() => setDetail(w.analysisId)}><span>{w.title}</span><b>{w.status === 'complete' ? `${percent(w.returnPct)} · decline ${fmt(w.declinePct, '%')}` : w.status}</b></button>)}</details>}
        </div>)}</div>
        <details className="crypto-method"><summary>How these outcomes are measured</summary><p>Entry is the first UTC daily open strictly after publication. Exit is the close of day {horizon}. Only explicit, unconditional directional calls count toward accuracy; conflicting directions are excluded. Returns are underlying asset returns, not strategy profits. The always-bullish comparison uses the same videos. Missing candle windows are unavailable; incomplete horizons are pending. Historical AI reconstruction is grounded in transcripts and does not establish investment skill by itself.</p></details>
      </section>
      <aside className="crypto-baseline-panel"><div className="crypto-eyebrow">KNOW THEIR NORMAL</div><h2>A personal baseline.</h2><p className="crypto-muted">Some creators are always optimistic. Compare each video with their own earlier tone.</p>
        {(data?.profiles || []).map(profile => <div className="crypto-baseline-card" key={profile.channelId}><div><b>{profile.title}</b><span>{profile.overrides[series] != null ? 'MANUAL' : profile.stale ? 'STALE' : profile.version ? `V${profile.version}` : 'NOT CALIBRATED'}</span></div><strong>{fmt(profile.overrides[series] ?? profile.profile?.[series]?.baseline)}<small> / 10</small></strong><p>{profile.profile?.[series]?.samples || 0} scored videos in the past year</p></div>)}
        <button onClick={() => setBaseline(true)} disabled={!data?.profiles?.length}>Edit baseline settings ↗</button><p className="crypto-footnote">Historical baselines use only earlier videos. Manual overrides never alter accuracy results.</p>
      </aside>
    </div>

    <section className="crypto-evidence-panel"><div className="crypto-panel-heading"><div><div className="crypto-eyebrow">FOLLOW THE EVIDENCE</div><h2>The research ledger <span>{analyses.total}</span></h2></div><select aria-label="Filter analyses" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All analyzed videos</option><option value="relevant">Crypto relevant</option><option value="warnings">Derisk statements</option><option value="irrelevant">Excluded as irrelevant</option></select></div>
      {!analyses.items.length ? <div className="crypto-empty"><span>◎</span><h3>No analysis in this view yet.</h3><p>{counts.pending ? `${counts.pending} saved transcripts are ready. Select Analyze to build your research ledger.` : 'Import missing history or download transcripts in Channel Monitor, then analyze them here.'}</p></div> : <div className="crypto-ledger">{analyses.items.map(row => <button className="crypto-ledger-row" key={row.id} onClick={() => setDetail(row.id)}><div className={`crypto-score-badge ${row.result.scores[series] <= 4 && row.result.scores[series] != null ? 'bearish' : ''}`}>{fmt(row.result.scores[series])}<small>/ 10</small></div><div><div className="crypto-ledger-meta">{data?.coverage.find(c => c.channelId === row.channelId)?.title} <span>· {date(row.publishedAt)}</span></div><h3>{row.title}</h3><p>{row.result.summary || row.result.reason}</p></div><div className="crypto-ledger-end"><span className="crypto-tag">{row.result.relevant ? `${Math.round(row.result.confidence * 100)}% confidence` : 'Not relevant'}</span><span>Read evidence ↗</span></div></button>)}</div>}
      {analyses.total > 20 && <div className="crypto-pagination"><button disabled={!page} onClick={() => setPage(p => p - 1)}>← Previous</button><span>{page + 1} / {Math.ceil(analyses.total / 20)}</span><button disabled={(page + 1) * 20 >= analyses.total} onClick={() => setPage(p => p + 1)}>Next →</button></div>}
    </section>
    <footer className="crypto-coverage-footer"><div>{['cataloged', 'downloaded', 'eligible', 'analyzed', 'irrelevant', 'failed', 'missing'].map(key => <span key={key}><b>{counts[key] || 0}</b> {key}</span>)}</div><p>{counts.short || 0} short videos excluded · {counts.unknownDuration || 0} durations unresolved · Coverage reflects saved data, not the creator’s complete history.</p></footer>
    {detail && <AnalysisDetail id={detail} onClose={() => setDetail(null)} />}
    {baseline && <BaselineEditor profiles={data.profiles} onClose={() => setBaseline(false)} onSaved={refresh} />}
  </div>;
}
