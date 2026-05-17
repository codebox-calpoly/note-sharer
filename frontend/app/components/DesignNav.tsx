"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/app/components/ThemeToggle";

type NavLink = "browse" | "upload" | "leaderboard" | "moderator" | "profile";

const linkClass = (active: boolean) =>
  `design-nav-link font-medium text-lg py-2 px-3 rounded-lg transition-colors duration-200 ${
    active
      ? "design-nav-link--active text-[#6dbe8b] bg-[#6dbe8b]/15 [data-theme=dark]:bg-[#6dbe8b]/20"
      : "text-[#666666] hover:text-[#6dbe8b] hover:bg-[#6dbe8b]/5 [data-theme=dark]:text-gray-300 [data-theme=dark]:hover:text-[#6dbe8b] [data-theme=dark]:hover:bg-[#6dbe8b]/10"
  }`;

export function DesignNav({
  active,
  rightSlot,
  showModerator = false,
}: {
  active?: NavLink;
  rightSlot?: React.ReactNode;
  showModerator?: boolean;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="design-nav-header flex flex-col w-full sticky top-0 z-50 bg-white border-b border-neutral-200 transition-colors [data-theme=dark]:bg-[#262626] [data-theme=dark]:border-neutral-700">
      <div className="flex h-[72px] items-center justify-between px-4 md:px-8 w-full">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6dbe8b] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            aria-label="Go to Browse"
          >
            <h1 className="font-bold text-[#2e2e2e] text-xl md:text-2xl [data-theme=dark]:text-gray-100">
              Poly Pages
            </h1>
          </Link>
        </div>
        <nav className="hidden lg:flex items-center gap-2">
          <Link href="/dashboard" className={linkClass(active === "browse")}>
            Browse
          </Link>
          <Link href="/upload" className={linkClass(active === "upload")}>
            Upload
          </Link>
          <Link href="/leaderboard" className={linkClass(active === "leaderboard")}>
            Leaderboard
          </Link>
          {showModerator ? (
            <Link href="/moderator" className={linkClass(active === "moderator")}>
              Moderator
            </Link>
          ) : null}
          <Link href="/dashboard/profile-dashboard" className={linkClass(active === "profile")}>
            Profile
          </Link>
        </nav>
        <div className="hidden lg:flex items-center gap-3 flex-nowrap flex-shrink-0">
          <ThemeToggle />
          {rightSlot}
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="design-nav-burger lg:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5 cursor-pointer flex-shrink-0 rounded-lg hover:bg-neutral-100 [data-theme=dark]:hover:bg-white/10"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <span
            className={`design-nav-burger-line w-6 h-0.5 transition-all duration-300 ${
              mobileMenuOpen ? "rotate-45 translate-y-2" : ""
            }`}
          />
          <span
            className={`design-nav-burger-line w-6 h-0.5 transition-all duration-300 ${
              mobileMenuOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`design-nav-burger-line w-6 h-0.5 transition-all duration-300 ${
              mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""
            }`}
          />
        </button>
      </div>

      <div
        className={`design-nav-mobile-menu lg:hidden fixed left-0 w-full bg-white border-b border-neutral-200 transition-all duration-300 ease-in-out [data-theme=dark]:bg-[#262626] [data-theme=dark]:border-neutral-700 ${
          mobileMenuOpen
            ? "max-h-[80vh] opacity-100 overflow-y-auto"
            : "max-h-0 opacity-0 overflow-hidden"
        }`}
        style={{ top: "72px", zIndex: 40 }}
      >
        <nav className="flex flex-col items-stretch gap-1 px-6 py-4">
          <Link
            href="/dashboard"
            className={`py-3 px-3 rounded-lg ${linkClass(active === "browse")} w-full text-left`}
            onClick={closeMobileMenu}
          >
            Browse
          </Link>
          <Link
            href="/upload"
            className={`py-3 px-3 rounded-lg ${linkClass(active === "upload")} w-full text-left`}
            onClick={closeMobileMenu}
          >
            Upload
          </Link>
          <Link
            href="/leaderboard"
            className={`py-3 px-3 rounded-lg ${linkClass(active === "leaderboard")} w-full text-left`}
            onClick={closeMobileMenu}
          >
            Leaderboard
          </Link>
          {showModerator ? (
            <Link
              href="/moderator"
              className={`py-3 px-3 rounded-lg ${linkClass(active === "moderator")} w-full text-left`}
              onClick={closeMobileMenu}
            >
              Moderator
            </Link>
          ) : null}
          <Link
            href="/dashboard/profile-dashboard"
            className={`py-3 px-3 rounded-lg ${linkClass(active === "profile")} w-full text-left`}
            onClick={closeMobileMenu}
          >
            Profile
          </Link>
          <div className="flex items-center gap-4 pt-3 mt-2 border-t border-neutral-200 [data-theme=dark]:border-neutral-600">
            <ThemeToggle />
            <div className="flex items-center gap-2" onClick={closeMobileMenu}>
              {rightSlot}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
