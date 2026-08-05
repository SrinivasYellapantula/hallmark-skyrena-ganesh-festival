import Link from "next/link";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";

export default function Home() {
  return (
    <main>
      <SiteHeader />
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Authorized committee workspace</div>
          <h1>Together, we make the celebration <em>meaningful.</em></h1>
          <p className="hero-lede">
            Record UPI contributions, coordinate block visits and keep every verified rupee accountable.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/contribute">Contribute now <span aria-hidden="true">→</span></Link>
            <Link className="button quiet" href="/transparency">View live accounts</Link>
          </div>
          <p className="microcopy">Minimum festival contribution ₹2,000 · UPI only · Payment proof required</p>
        </div>
        <div className="hero-art" aria-label="2026 Ganesh Chaturthi community celebration">
          <div className="sun-disc" />
          <div className="arch arch-one" />
          <div className="arch arch-two" />
          <div className="festival-mark">
            <span className="year">2026</span>
            <strong>GANESH<br />CHATURTHI</strong>
            <small>COMMUNITY CELEBRATIONS</small>
          </div>
          <div className="garland" aria-hidden="true">● ● ● ● ● ● ● ● ●</div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="wrap trust-grid">
          <div><span>01</span><strong>One consistent form</strong><p>Every block follows the same collection process.</p></div>
          <div><span>02</span><strong>Committee verified</strong><p>Only reconciled payments enter public totals.</p></div>
          <div><span>03</span><strong>Transparent accounts</strong><p>Collections and approved expenses stay visible.</p></div>
        </div>
      </section>

      <section className="wrap section home-grid">
        <div>
          <div className="eyebrow"><span /> Simple by design</div>
          <h2>One contribution.<br />Three useful outcomes.</h2>
        </div>
        <div className="steps-list">
          <article><b>Register</b><p>Share household details and the count attending Annadaanam.</p></article>
          <article><b>Contribute</b><p>Record the main donation and any additional Annadaanam support.</p></article>
          <article><b>Track</b><p>Keep your reference number and watch verified community totals grow.</p></article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
