"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  BookOpen,
  Bookmark,
  CalendarDays,
  ClipboardList,
  Trophy,
  Upload,
  WalletCards,
} from "lucide-react";
import { getSessionWithRecovery, supabase } from "@/lib/supabaseClient";
import "./landing.css";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.unobserve(el);
  }, [threshold]);

  return { ref, visible };
}

export default function Home() {
  const router = useRouter();
  const [heroVisible, setHeroVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTimer = setTimeout(() => setLoading(false), 520);
    const heroTimer = setTimeout(() => setHeroVisible(true), 720);
    return () => {
      clearTimeout(loadTimer);
      clearTimeout(heroTimer);
    };
  }, []);

  useEffect(() => {
    getSessionWithRecovery(supabase).then(({ session }) => {
      if (session) router.replace("/dashboard");
    });
  }, [router]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="lp-root">
      <div className={`lp-loading${loading ? "" : " is-hidden"}`} aria-hidden={!loading}>
        <div className="lp-loading-card">
          <span className="lp-loading-mark" />
          <span className="lp-loading-text">Organizing notes</span>
          <span className="lp-loading-line" />
        </div>
      </div>

      <section className="lp-hero" id="hero">
        <div className={`lp-wordmark${heroVisible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "40ms" }}>
          <span aria-hidden>
            <BookOpen size={18} strokeWidth={2.45} />
          </span>
          <strong>Poly Pages</strong>
        </div>
        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <h1
              className={`lp-hero-heading${heroVisible ? " lp-fade-in" : " lp-fade-out"}`}
              style={{ transitionDelay: "80ms" }}
            >
              Upload notes.
              <span className="lp-accent-line">Earn credits.</span>
              <span className="lp-title-desktop">Unlock class materials.</span>
              <span className="lp-title-mobile">Unlock</span>
              <span className="lp-title-mobile">materials.</span>
            </h1>
            <p className={`lp-hero-sub${heroVisible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "160ms" }}>
              Trade class materials with verified Cal Poly students. Upload approved notes to earn credits, then spend those credits on lecture notes, study guides, and exam reviews.
            </p>

            <div className={`lp-hero-actions${heroVisible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "240ms" }}>
              <Link href="/auth" className="lp-action-btn lp-action-btn--primary">
                Join now
              </Link>
              <button type="button" onClick={() => scrollToSection("how-it-works")} className="lp-action-btn lp-action-btn--secondary">
                How credits work
              </button>
            </div>

            <div className={`lp-verify-note${heroVisible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "310ms" }}>
              <span className="lp-verify-icon" aria-hidden>
                <BadgeCheck size={24} strokeWidth={2.4} />
              </span>
              <span>
                <strong>Verified Cal Poly students only</strong>
                <em>requires an @calpoly.edu email</em>
              </span>
            </div>
          </div>

          <div className={`lp-hero-visual${heroVisible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "220ms" }}>
            <div className="lp-note-scene" aria-hidden>
              <span className="lp-doodle lp-doodle--star" />
              <span className="lp-doodle lp-doodle--spark" />
              <div className="lp-note-card lp-note-card--lecture">
                <span className="lp-note-course">CSC 357</span>
                <span className="lp-note-title">Lecture Notes</span>
                <span className="lp-note-rule" />
              </div>
              <div className="lp-note-card lp-note-card--study">
                <span className="lp-note-tape" />
                <span className="lp-note-course">MATH 241</span>
                <span className="lp-note-title">Study Guide</span>
                <span className="lp-note-rule" />
              </div>
              <div className="lp-note-card lp-note-card--review">
                <span className="lp-note-pin" />
                <span className="lp-note-course">BIO 161</span>
                <span className="lp-note-title">Exam Review</span>
                <span className="lp-note-rule" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <CreditSystemSection />
      <FeaturesSection />

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div>
            <p className="lp-footer-brand">Poly Pages</p>
            <p className="lp-footer-sub">Independent student project - not affiliated with Cal Poly administration.</p>
          </div>
          <Link href="/auth" className="lp-footer-link">Join now</Link>
        </div>
      </footer>
    </div>
  );
}

function CreditSystemSection() {
  const { ref, visible } = useInView(0.15);
  const principles = [
    { Icon: BadgeCheck, title: "Verified students", desc: "@calpoly.edu only" },
    { Icon: Upload, title: "Approved uploads", desc: "Credits after review" },
    { Icon: WalletCards, title: "Balanced access", desc: "Earn when you add. Spend when you unlock." },
  ];

  return (
    <section ref={ref} id="how-it-works" className="lp-section lp-section--cream">
      <div className="lp-section-inner">
        <div className="lp-credit-system">
          <div className="lp-credit-copy">
            <p className={`lp-section-label${visible ? " lp-fade-in" : " lp-fade-out"}`}>Credit system</p>
            <h2 className={`lp-section-heading${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "90ms" }}>
              <span>Earn credits by sharing.</span>
              <span>Spend them on materials.</span>
            </h2>
            <p className={`lp-credit-intro${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "150ms" }}>
              Upload approved materials to earn credits. Spend credits to unlock files for your courses.
            </p>

            <div className="lp-credit-principles">
              {principles.map(({ Icon, title, desc }, i) => (
                <div key={title} className={`lp-credit-principle${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: `${230 + i * 85}ms` }}>
                  <span className="lp-credit-principle-icon" aria-hidden>
                    <Icon size={21} strokeWidth={2.35} />
                  </span>
                  <span className="lp-credit-principle-text">
                    <strong>{title}</strong>
                    <em>{desc}</em>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={`lp-credit-visual${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "230ms" }} aria-hidden>
            <div className="lp-credit-board">
              <div className="lp-credit-board-head">
                <span>Credit pool</span>
                <strong>Fair access</strong>
              </div>
              <div className="lp-pool-stage">
                <div className="lp-pool-column lp-pool-column--uploads">
                  <span className="lp-pool-slip lp-pool-slip--one">CSC 357</span>
                  <span className="lp-pool-slip lp-pool-slip--two">BIO 161</span>
                  <span className="lp-pool-slip lp-pool-slip--three">MATH 241</span>
                </div>
                <div className="lp-credit-pool-orb">
                  <span>+12</span>
                  <strong>credits</strong>
                </div>
                <div className="lp-pool-column lp-pool-column--materials">
                  <span className="lp-pool-slip lp-pool-slip--study">Study guide</span>
                  <span className="lp-pool-slip lp-pool-slip--review">Exam review</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const { ref, visible } = useInView(0.18);
  const features = [
    { Icon: ClipboardList, title: "Track your classes", desc: "Pin current courses and jump straight to matching notes and materials." },
    { Icon: BookOpen, title: "Find course materials", desc: "Browse lecture notes, study guides, exam reviews, and PDFs by course." },
    { Icon: CalendarDays, title: "Preview future courses", desc: "Look through materials from classes you are considering before registration." },
    { Icon: Trophy, title: "Earn from uploads", desc: "See which contributions are getting used and building credits." },
    { Icon: WalletCards, title: "Manage credits", desc: "Track your balance, unlocks, and upload history in one place." },
    { Icon: Bookmark, title: "Save useful materials", desc: "Bookmark the files you want ready when you study." },
  ];

  return (
    <section ref={ref} id="features" className="lp-section lp-section--features">
      <div className="lp-section-inner">
        <div className="lp-feature-header">
          <div>
            <h2 className={`lp-section-heading${visible ? " lp-fade-in" : " lp-fade-out"}`}>
              <span>Find notes by course.</span>
              <span>Unlock with credits.</span>
            </h2>
          </div>
        </div>
        <div className="lp-feature-card-grid">
          {features.map(({ Icon, title, desc }, i) => (
            <article key={title} className={`lp-feature-card${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: `${210 + i * 70}ms` }}>
              <span className="lp-feature-icon" aria-hidden>
                <Icon size={23} strokeWidth={2.25} />
              </span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
        <div className={`lp-final-strip${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "640ms" }}>
          <div>
            <strong>Upload what you have. Unlock what you need.</strong>
            <span>Credits keep the exchange balanced for every student.</span>
          </div>
          <Link href="/auth" className="lp-action-btn lp-action-btn--primary lp-final-cta">
            Join now
          </Link>
        </div>
      </div>
    </section>
  );
}
