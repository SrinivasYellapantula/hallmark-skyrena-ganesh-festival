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
            Record resident donations, coordinate block visits and keep every verified rupee accountable.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/contribute">Record New Donation <span aria-hidden="true">→</span></Link>
            <Link className="button quiet" href="/transparency">View live accounts</Link>
          </div>
          <p className="microcopy">Voluntary contribution · UPI, IMPS or NEFT · Payment proof required</p>
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
          <h2>One resident visit.<br />Three simple steps.</h2>
        </div>
        <div className="steps-list">
          <article><b>Capture details</b><p>Record the resident’s household information and Lunch Mahaprasadam attendance.</p></article>
          <article><b>Record payment</b><p>Enter donation amounts, the UPI reference and payment confirmation.</p></article>
          <article><b>Follow up</b><p>Track completed and pending flats while verified community totals update.</p></article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
