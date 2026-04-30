"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./mobile-nav.css";

type NavItem = { href: string; label: string };

function getInitials(name: string | null): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function MobileNav({
  items,
  signOutAction,
  userName,
  userEmail,
}: {
  items: NavItem[];
  signOutAction: () => Promise<void>;
  userName?: string | null;
  userEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
            <div className="mobile-nav-header">
              <div className="mobile-nav-avatar" aria-hidden="true">
                {getInitials(userName ?? null)}
              </div>
              <div className="mobile-nav-identity">
                {userName && (
                  <div className="mobile-nav-name">{userName}</div>
                )}
                {userEmail && (
                  <div className="mobile-nav-email">{userEmail}</div>
                )}
              </div>
            </div>
            <div className="mobile-nav-links">
              {items.map(({ href, label }) => {
                const isActive =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`mobile-nav-link${isActive ? " active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
            <form action={signOutAction} className="mobile-nav-signout-form">
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
