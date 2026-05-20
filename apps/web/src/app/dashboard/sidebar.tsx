'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard/documents', label: 'Documents' },
  { href: '/dashboard/chat', label: 'Chat' },
  { href: '/dashboard/usage', label: 'Usage' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-52 flex-shrink-0 flex-col bg-[var(--black)]">
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--lime)] text-[var(--black)]'
                  : 'text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
