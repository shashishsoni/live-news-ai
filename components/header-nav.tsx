"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/global-news", label: "Global" },
  { href: "/india-news", label: "India" },
  { href: "/categories", label: "Categories" },
  { href: "/fact-check", label: "Fact Check" },
  { href: "/sources", label: "Sources" },
  { href: "/accuracy-policy", label: "Accuracy" },
  { href: "/contact", label: "Contact" }
];

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="main-nav" aria-label="Primary navigation">
      {links.map((link) => {
        const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

        return (
          <Link key={link.href} className={isActive ? "active" : undefined} href={link.href} aria-current={isActive ? "page" : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
