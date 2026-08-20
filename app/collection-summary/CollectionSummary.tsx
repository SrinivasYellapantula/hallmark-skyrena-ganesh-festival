"use client";

import { useEffect, useState } from "react";
import { currency } from "../lib/constants";

type Summary = {
  blockNo: string;
  occupiedFlats: number;
  occupiedDonatedFlats: number;
  optedOutFlats: number;
  donatingFlats: number;
  outsideMasterDonatingFlats: number;
  pendingFlats: number;
  totalCollection: number;
  verifiedCollection: number;
  festivalCollection: number;
  idolCollection: number;
  mahaprasadamCollection: number;
  maximumDonation: number;
  averageDonation: number;
};
type Payload = { user: { role: "admin" | "block"; blockNo: string | null }; blocks: Summary[]; competitionBlocks: Summary[]; overall: Summary };

export function CollectionSummary() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/collection-summary", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error(body.error ?? "Unable to load the collection summary.");
        setData(body);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load the collection summary."));
  }, []);

  if (error) return <section className="wrap collection-summary-shell"><p className="form-error" role="alert">{error}</p></section>;
  if (!data) return <section className="wrap collection-summary-shell"><div className="summary-loading">Loading collection summary…</div></section>;

  const blockUser = data.user.role === "block";
  return <section className="wrap collection-summary-shell">
    <header className="collection-summary-heading">
      <div><div className="eyebrow"><span />Collection overview</div><h1>{blockUser ? `Block ${data.user.blockNo} Collection Summary` : "Collection Summary"}</h1><p>{blockUser ? "A live view of your block’s donation progress." : "The overall festival position, followed by block-wise figures."}</p></div>
      <div className="summary-definition"><strong>Recorded collection</strong><span>Includes active payments awaiting verification.</span><strong>Verified collection</strong><span>Payments confirmed by an administrator.</span></div>
    </header>

    {blockUser ? <><SummaryCard summary={data.blocks[0] ?? data.overall} featured /><BlockChallenge summaries={data.competitionBlocks} /></> : <>
      <div className="section-title overall-title"><span className="card-kicker">Festival-wide position</span><h2>Overall Summary</h2></div>
      <SummaryCard summary={data.overall} featured />
      <BlockChallenge summaries={data.competitionBlocks} />
      <div className="section-title"><span className="card-kicker">Block-wise progress</span><h2>Blocks A–E</h2></div>
      <div className="block-summary-grid">{data.blocks.map((block) => <SummaryCard key={block.blockNo} summary={block} />)}</div>
    </>}
  </section>;
}

function BlockChallenge({ summaries }: { summaries: Summary[] }) {
  const ranked = [...summaries].sort((a, b) => participation(b) - participation(a) || b.totalCollection - a.totalCollection || a.blockNo.localeCompare(b.blockNo));
  const highestParticipation = ranked[0];
  const highestCollection = [...summaries].sort((a, b) => b.totalCollection - a.totalCollection || a.blockNo.localeCompare(b.blockNo))[0];
  const highestAverage = [...summaries].sort((a, b) => b.averageDonation - a.averageDonation || a.blockNo.localeCompare(b.blockNo))[0];
  const maxCollection = Math.max(1, ...summaries.map((summary) => summary.totalCollection));

  return <section className="block-challenge">
    <div className="section-title"><span className="card-kicker">Friendly block challenge</span><h2>Participation Leaderboard</h2><p>Ranked by the percentage of occupied flats that have donated, so every block competes fairly.</p></div>
    <div className="challenge-layout">
      <div className="challenge-leaderboard table-wrap">
        <table>
          <thead><tr><th>Rank</th><th>Block</th><th>Participation</th><th className="leaderboard-optional">Donated</th><th>Pending</th><th className="leaderboard-optional">Opted out</th><th>Collection</th></tr></thead>
          <tbody>{ranked.map((summary, index) => <tr key={summary.blockNo}><td><span className={`rank-medal rank-${index + 1}`}>{index + 1}</span></td><td><strong>Block {summary.blockNo}</strong></td><td><div className="challenge-participation"><span className="challenge-track"><i style={{ width: `${participation(summary)}%` }} /></span><strong>{participation(summary)}%</strong></div></td><td className="leaderboard-optional">{summary.occupiedDonatedFlats}<small>of {summary.occupiedFlats}</small></td><td><strong>{summary.pendingFlats}</strong></td><td className="leaderboard-optional">{summary.optedOutFlats}</td><td><strong>{currency(summary.totalCollection)}</strong></td></tr>)}</tbody>
        </table>
      </div>
      <div className="challenge-highlights">
        <Highlight symbol="★" label="Highest participation" block={highestParticipation} value={`${participation(highestParticipation)}%`} />
        <Highlight symbol="₹" label="Highest collection" block={highestCollection} value={currency(highestCollection?.totalCollection ?? 0)} />
        <Highlight symbol="↗" label="Best average per donating flat" block={highestAverage} value={currency(highestAverage?.averageDonation ?? 0)} />
      </div>
    </div>
    <div className="challenge-comparison">
      <header><div><span className="card-kicker">Contribution comparison</span><h3>Collection Split by Block</h3></div><div className="challenge-legend"><span><i className="festival" />Main festival</span><span><i className="idol" />Idol</span><span><i className="mahaprasadam" />Mahaprasadam</span></div></header>
      <div className="challenge-bars">{summaries.map((summary) => <div className="challenge-bar-row" key={summary.blockNo}><strong>Block {summary.blockNo}</strong><div className="challenge-stack-track" aria-label={`Block ${summary.blockNo}: ${currency(summary.totalCollection)} total collection`}><div className="challenge-stack-fill" style={{ width: `${(summary.totalCollection / maxCollection) * 100}%` }}><i className="festival" style={{ flexGrow: summary.festivalCollection }} /><i className="idol" style={{ flexGrow: summary.idolCollection }} /><i className="mahaprasadam" style={{ flexGrow: summary.mahaprasadamCollection }} /></div></div><span>{currency(summary.totalCollection)}</span></div>)}</div>
    </div>
  </section>;
}

function Highlight({ symbol, label, block, value }: { symbol: string; label: string; block?: Summary; value: string }) {
  return <article><span className="highlight-symbol">{symbol}</span><div><small>{label}</small><strong>{block ? `Block ${block.blockNo}` : "—"}</strong></div><b>{value}</b></article>;
}

function participation(summary?: Summary) {
  return summary?.occupiedFlats ? Math.round((summary.occupiedDonatedFlats / summary.occupiedFlats) * 100) : 0;
}

function SummaryCard({ summary, featured = false }: { summary: Summary; featured?: boolean }) {
  const coverage = summary.occupiedFlats ? Math.round((summary.occupiedDonatedFlats / summary.occupiedFlats) * 100) : 0;
  return <article className={`collection-summary-card ${featured ? "featured" : ""}`}>
    <header><div><span>{summary.blockNo === "Overall" ? "All five blocks" : `Block ${summary.blockNo}`}</span><strong>{coverage}% covered</strong></div><div className="coverage-track" aria-label={`${coverage}% of occupied flats donated`}><i style={{ width: `${coverage}%` }} /></div></header>
    <div className="collection-core-metrics">
      <div><span>Occupied flats donated</span><strong>{summary.occupiedDonatedFlats}</strong><small>of {summary.occupiedFlats} occupied</small></div>
      <div><span>Door-to-door pending</span><strong>{summary.pendingFlats}</strong><small>still to approach</small></div>
      <div><span>Opted out</span><strong>{summary.optedOutFlats}</strong><small>do not visit</small></div>
      <div className="collection-total"><span>Recorded collection</span><strong>{currency(summary.totalCollection)}</strong><small>including verification pending</small></div>
    </div>
    <dl className="collection-detail-metrics">
      <div><dt>Total donating flats</dt><dd>{summary.donatingFlats}</dd></div>
      <div><dt>Main festival donation</dt><dd>{currency(summary.festivalCollection)}</dd></div>
      <div><dt>Donating flats outside occupied master</dt><dd>{summary.outsideMasterDonatingFlats}</dd></div>
      <div><dt>Idol donation</dt><dd>{currency(summary.idolCollection)}</dd></div>
      <div><dt>Average per donated flat</dt><dd>{currency(summary.averageDonation)}</dd></div>
      <div><dt>Additional Mahaprasadam support</dt><dd>{currency(summary.mahaprasadamCollection)}</dd></div>
      <div><dt>Verified collection</dt><dd>{currency(summary.verifiedCollection)}</dd></div>
      <div><dt>Maximum flat donation</dt><dd>{currency(summary.maximumDonation)}</dd></div>
    </dl>
  </article>;
}
