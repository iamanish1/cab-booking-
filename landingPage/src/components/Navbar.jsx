import { useState, useEffect } from "react";
import { Menu, X, Zap } from "lucide-react";
import "./Navbar.css";

const NAV_LINKS = [
  { label: "Features",     href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Drive With Us",href: "#drive" },
  { label: "Download",     href: "#download" },
];

export default function Navbar() {
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [activeLink, setActive]   = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close menu on resize
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setMenuOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleLink = (href) => {
    setActive(href);
    setMenuOpen(false);
  };

  return (
    <header className={`navbar${scrolled ? " scrolled" : ""}${menuOpen ? " menu-open" : ""}`}>
      <div className="nav-inner">
        {/* Logo */}
        <a href="#" className="nav-logo" onClick={() => setMenuOpen(false)}>
          <div className="logo-icon-wrap">
            <Zap size={16} strokeWidth={2.5} />
          </div>
          <span className="logo-text">EasyRide</span>
        </a>

        {/* Desktop nav */}
        <nav className="nav-links-desktop">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={`nav-link${activeLink === l.href ? " active" : ""}`}
              onClick={() => handleLink(l.href)}
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <a href="#download" className="btn btn-white nav-cta">
          Get the App
        </a>

        {/* Hamburger */}
        <button
          className="hamburger"
          onClick={() => setMenuOpen((p) => !p)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile nav */}
      <div className={`nav-mobile${menuOpen ? " open" : ""}`}>
        {NAV_LINKS.map((l) => (
          <a key={l.label} href={l.href} className="nav-mobile-link" onClick={() => handleLink(l.href)}>
            {l.label}
          </a>
        ))}
        <a href="#download" className="btn btn-white nav-mobile-cta" onClick={() => setMenuOpen(false)}>
          Download Free App
        </a>
      </div>
    </header>
  );
}
