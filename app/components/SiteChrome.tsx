import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap nav-wrap">
        <Link className="brand" href="/" aria-label="Hallmark Skyrena Ganesh Chaturthi home">
          <span className="brand-seal">श्री</span>
          <span><strong>Hallmark Skyrena</strong><small>Ganesh Chaturthi 2026</small></span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/contribute">Contribute</Link>
          <Link href="/transparency">Transparency</Link>
          <Link className="admin-link" href="/admin">Committee</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div><strong>Hallmark Skyrena</strong><p>Ganesh Chaturthi 2026 · Built for our community, maintained by volunteers.</p></div>
        <div><p>Questions or corrections?</p><span>Committee contact will be added before launch.</span></div>
        <div><p>Privacy first</p><span>Personal household details are never displayed publicly.</span></div>
      </div>
    </footer>
  );
}
