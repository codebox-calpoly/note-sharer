"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSessionWithRecovery, supabase } from "@/lib/supabaseClient";
import "./page.css";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.unobserve(el);
  }, [threshold]);
  return { ref, visible };
}

export default function Home() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setHeroVisible(true), 100); return () => clearTimeout(t); }, []);
  useEffect(() => {
    getSessionWithRecovery(supabase).then(({ session }) => {
      if (session) router.replace("/dashboard");
    });
  }, [router]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="lp-root" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>

      {/* NAV */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-brand">
            <span className="lp-logo-wrap">
              <img src="/assets/brand/poly-pages-logo.svg" alt="Poly Pages" className="lp-logo-img" />
            </span>
            <span className="lp-brand-name">Poly Pages</span>
            <span className="lp-badge">Cal Poly SLO</span>
          </div>

          <nav className="lp-nav-links">
            {["How It Works", "Why Us", "Features"].map((label) => (
              <button key={label} type="button"
                onClick={() => scrollToSection(label.toLowerCase().replace(/ /g, "-"))}
                className="lp-nav-link">
                {label}
              </button>
            ))}
          </nav>

          <div className="lp-nav-right">
            <Link href="/auth" className="lp-cta-btn lp-cta-btn--sm">Sign In / Register</Link>
          </div>

          <button type="button" className="lp-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            <span className={`lp-ham-line lp-ham-line--1${mobileMenuOpen ? " open" : ""}`} />
            <span className={`lp-ham-line lp-ham-line--2${mobileMenuOpen ? " open" : ""}`} />
            <span className={`lp-ham-line lp-ham-line--3${mobileMenuOpen ? " open" : ""}`} />
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lp-mobile-menu">
            {["How It Works", "Why Us", "Features"].map((label) => (
              <button key={label} type="button"
                onClick={() => scrollToSection(label.toLowerCase().replace(/ /g, "-"))}
                className="lp-mobile-link">
                {label}
              </button>
            ))}
            <Link href="/auth" className="lp-cta-btn lp-cta-btn--full">Sign In / Register</Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="lp-hero" id="hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-text">
            <div className={`lp-eyebrow${heroVisible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "0ms" }}>
              ✦ Cal Poly · Note Sharing Platform
            </div>
            <h1 className={`lp-hero-heading${heroVisible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "100ms", fontFamily: "var(--font-playfair), Georgia, serif" }}>
              Share notes.<br />
              <em className="lp-hero-em">Earn credits.</em><br />
              Learn together.
            </h1>
            <p className={`lp-hero-sub${heroVisible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "200ms" }}>
              A note-sharing platform built for Cal Poly SLO students. Upload your notes, earn credits, and unlock help from students across campus.
            </p>
            <div className={`lp-hero-actions${heroVisible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "300ms" }}>
              <Link href="/auth" className="lp-cta-btn lp-cta-btn--lg">Get Started →</Link>
              <button type="button" onClick={() => scrollToSection("how-it-works")} className="lp-ghost-btn">See how it works</button>
            </div>
            <div className={`lp-trust-row${heroVisible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "400ms" }}>
              <div className="lp-trust-avatars">
                {["J", "M", "A", "K"].map((l, i) => (
                  <span key={i} className="lp-trust-avatar" style={{ background: ["#6dbe8b","#f9c784","#a78bfa","#60a5fa"][i] }}>{l}</span>
                ))}
              </div>
              <span className="lp-trust-text"><strong>Cal Poly students only</strong> — verified by @calpoly.edu email</span>
            </div>
          </div>

          <div className={`lp-hero-visual${heroVisible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "200ms" }}>
            <div className="lp-mockup-stack">
              {/* Floating note cards */}
              <div className="lp-card lp-card--back">
                <div className="lp-card-tag">LECTURE NOTES</div>
                <div className="lp-card-title">CSC 357 — Systems Programming</div>
                <div className="lp-card-meta">Score: +12 · 3 credits</div>
              </div>
              <div className="lp-card lp-card--front">
                <div className="lp-card-tag lp-card-tag--green">STUDY GUIDE</div>
                <div className="lp-card-title">MATH 241 — Calculus IV</div>
                <div className="lp-card-meta">Score: +8 · 3 credits</div>
                <div className="lp-card-badge">JUST UPLOADED</div>
              </div>
              {/* Phone mockup — always dark */}
              <img
                className="lp-phone-img"
                src="/assets/landing/mobile-app-preview.jpeg"
                alt="App on mobile"
              />
            </div>
          </div>
        </div>

        <div className="lp-blob lp-blob--1" aria-hidden />
        <div className="lp-blob lp-blob--2" aria-hidden />
      </section>

      {/* HOW IT WORKS */}
      <HowItWorksSection />

      {/* WHY US */}
      <WhySection />

      {/* FEATURES */}
      <FeaturesSection />

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div>
            <p className="lp-footer-brand">Poly Pages</p>
            <p className="lp-footer-sub">Independent student project · Not affiliated with Cal Poly administration</p>
            <p className="lp-footer-sub" style={{ marginTop: 4 }}>CodeBox TM</p>
          </div>
          <a href="/terms-and-conditions" className="lp-footer-link">Community Guidelines</a>
        </div>
      </footer>
    </div>
  );
}

function HowItWorksSection() {
  const { ref, visible } = useInView(0.15);
  const steps = [
    { num: "01", title: "Upload Your Notes", desc: "Share your study materials and lecture notes as PDFs. Every upload goes through a quick review." },
    { num: "02", title: "Earn Credits", desc: "Get credits automatically when your notes are approved. Quality notes earn bonus credits from upvotes." },
    { num: "03", title: "Unlock Materials", desc: "Spend credits to access notes from other students across every department on campus." },
  ];
  return (
    <section ref={ref} id="how-it-works" className="lp-section lp-section--cream">
      <div className="lp-section-inner">
        <div className={`lp-section-label${visible ? " lp-fade-in" : " lp-fade-out"}`}>✦ How It Works</div>
        <h2 className={`lp-section-heading${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "100ms" }}>
          Three steps to better studying
        </h2>
        <div className="lp-steps-grid">
          {steps.map((s, i) => (
            <div key={i} className={`lp-step-card${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: `${200 + i * 120}ms` }}>
              <span className="lp-step-num">{s.num}</span>
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  const { ref, visible } = useInView(0.1);
  const items = [
    { emoji: "🔍", title: "Organized & searchable", desc: "Find exactly what you need with smart categorization and search across all subjects and courses." },
    { emoji: "⚖️", title: "Fair credit system", desc: "Contribute to earn, use credits to access. A balanced ecosystem that rewards quality and participation." },
    { emoji: "🎓", title: "Built for students", desc: "Designed with real student needs in mind. Community-driven and focused on collaborative learning." },
    { emoji: "✨", title: "Distraction free", desc: "No clutter, no ads. Just a simple, intuitive platform designed to help you study better." },
  ];
  return (
    <section ref={ref} id="why-us" className="lp-section">
      <div className="lp-section-inner">
        <div className={`lp-section-label${visible ? " lp-fade-in" : " lp-fade-out"}`}>✦ Why Poly Pages</div>
        <h2 className={`lp-section-heading${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "100ms" }}>
          A calmer way to study with your campus
        </h2>
        <div className="lp-why-grid">
          {items.map((item, i) => (
            <div key={i} className={`lp-why-card${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: `${200 + i * 100}ms` }}>
              <span className="lp-why-emoji">{item.emoji}</span>
              <h3 className="lp-why-title">{item.title}</h3>
              <p className="lp-why-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const { ref, visible } = useInView(0.2);
  return (
    <section ref={ref} id="features" className="lp-section lp-section--dark">
      <div className="lp-section-inner lp-features-inner">
        <div className={`lp-section-label lp-section-label--light${visible ? " lp-fade-in" : " lp-fade-out"}`}>✦ Features</div>
        <h2 className={`lp-section-heading lp-section-heading--light${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "100ms" }}>
          Built for campus collaboration
        </h2>
        <p className={`lp-features-sub${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "200ms" }}>
          Join a growing community of students helping each other succeed. Share knowledge, support peers, and achieve more together.
        </p>
        <div className={`lp-features-pills${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "300ms" }}>
          {["PDF uploads", "Credit system", "Course search", "Professor tags", "Bookmarks", "Leaderboard", "Dark mode", "Mobile friendly"].map((f) => (
            <span key={f} className="lp-pill">{f}</span>
          ))}
        </div>
        <div className={`lp-features-cta${visible ? " lp-fade-in" : " lp-fade-out"}`} style={{ transitionDelay: "400ms" }}>
          <Link href="/auth" className="lp-cta-btn lp-cta-btn--lg lp-cta-btn--white">Start sharing notes →</Link>
        </div>
      </div>
    </section>
  );
}
