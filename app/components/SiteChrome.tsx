import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap nav-wrap">
        <Link className="brand" href="/" aria-label="Ganesh Festival home">
          <span className="brand-seal">श्री</span>
          <span><strong>Ganesh Festival</strong><small>Community 2026</small></span>
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
        <div><strong>Ganesh Festival 2026</strong><p>Built for our community, maintained by volunteers.</p></div>
        <div><p>Questions or corrections?</p><a href="mailto:festival.committee@example.com">Contact the festival committee</a></div>
        <div><p>Privacy first</p><span>Personal household details are never displayed publicly.</span></div>
      </div>
    </footer>
  );
}
