'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/org/dashboard', label: 'Dashboard' },
  { href: '/org/members', label: 'Members' },
  { href: '/org/invite', label: 'Invite' },
];

export function OrgNav({ orgName }: { orgName: string }) {
  const pathname = usePathname();

  return (
    <nav className="org-nav">
      <span className="org-nav-name">{orgName}</span>
      <div className="org-nav-links">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`org-nav-link ${pathname === item.href ? 'org-nav-link--active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
