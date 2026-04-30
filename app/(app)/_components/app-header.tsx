"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";
import "./app-header.css";

type NavItem = { href: string; label: string };

export function AppHeader({
  navItems,
  signOutAction,
  userName,
  userEmail,
}: {
  navItems: NavItem[];
  signOutAction: () => Promise<void>;
  userName?: string | null;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`app-header${scrolled ? " app-header--scrolled" : ""}`}>
      <div className="app-header-inner">
        <Link href="/dashboard" className="app-header-brand">
          <Image
            src="/janet-cares-logo.png"
            alt="Janet Cares"
            width={880}
            height={203}
            priority
            className="app-header-logo"
          />
        </Link>
        <nav className="desktop-nav">
          {navItems.map(({ href, label }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`app-nav-link${isActive ? " active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
          <form action={signOutAction} className="app-nav-signout-form">
            <button type="submit" className="app-nav-signout">
              Sign out
            </button>
          </form>
        </nav>
        <MobileNav
          items={navItems}
          signOutAction={signOutAction}
          userName={userName}
          userEmail={userEmail}
        />
      </div>
    </header>
  );
}
