"use client";

import { useState } from "react";
import Link from "next/link";
import "./mobile-nav.css";

type NavItem = { href: string; label: string };

export function MobileNav({
  items,
  signOutAction,
}: {
  items: NavItem[];
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="hamburger"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className={`hamburger-bar ${open ? "open" : ""}`} />
        <span className={`hamburger-bar ${open ? "open" : ""}`} />
        <span className={`hamburger-bar ${open ? "open" : ""}`} />
      </button>

      {open && (
        <div className="mobile-nav-overlay" onClick={() => setOpen(false)}>
          <nav
            className="mobile-nav-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {items.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="mobile-nav-link"
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            <form action={signOutAction}>
              <button type="submit" className="mobile-nav-signout">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      )}
    </>
  );
}
