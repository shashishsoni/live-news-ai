import Link from "next/link";
import { HeaderNav } from "@/components/header-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Live Update News home">
        <span className="brand-mark">LN</span>
        <span>
          <strong>Live Update</strong>
          <small>Verified news signals</small>
        </span>
      </Link>
      <HeaderNav />
      <ThemeToggle />
    </header>
  );
}
