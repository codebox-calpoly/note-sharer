import React from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-lime-50 to-amber-50 dark:from-zinc-900 dark:via-emerald-950 dark:to-stone-950">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-emerald-900/95 dark:bg-emerald-950/95 shadow-lg z-50 border-b border-amber-500/70">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-emerald-700 text-amber-300 text-xl font-extrabold tracking-tight shadow-sm">
              NoteSharer
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium">
            <a
              href="#features"
              className="text-amber-50 hover:text-amber-300 transition-colors"
            >
              Features
            </a>
            <a
              href="#about"
              className="text-amber-50 hover:text-amber-300 transition-colors"
            >
              About
            </a>
            <a
              href="#faq"
              className="text-amber-50 hover:text-amber-300 transition-colors"
            >
              FAQ
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-24">
        <div className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/25 via-emerald-800/30 to-amber-600/25 dark:from-emerald-700/40 dark:via-emerald-900/50 dark:to-amber-700/40" />

          {/* Decorative Circles */}
          <div className="absolute top-16 left-6 w-64 h-64 bg-emerald-300/30 dark:bg-emerald-500/25 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-300/30 dark:bg-amber-500/25 rounded-full blur-3xl" />

          {/* Content */}
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold text-emerald-950 dark:text-amber-50 mb-4 tracking-tight drop-shadow-sm">
              NoteSharer
            </h1>
            <p className="text-xl md:text-2xl text-emerald-950/80 dark:text-emerald-100/80 mb-10 max-w-2xl mx-auto">
              Share notes across classes, support your peers, and crush your
              quarters together.
            </p>

            {/* Search/Action Bar */}
            <div className="max-w-2xl mx-auto mb-12">
              <div className="bg-white/95 dark:bg-emerald-950/95 rounded-full shadow-2xl p-2 flex items-center gap-2 border border-emerald-100 dark:border-emerald-800">
                <input
                  type="text"
                  placeholder="Search for courses, professors, or notes..."
                  className="flex-1 px-6 py-4 bg-transparent text-emerald-950 dark:text-amber-50 placeholder-emerald-400 focus:outline-none text-lg"
                />
                <button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-emerald-950 font-semibold px-8 py-3 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
                  Search
                </button>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="/auth"
                className="w-full sm:w-auto px-10 py-3 bg-emerald-900 text-amber-200 rounded-full font-semibold text-lg hover:bg-emerald-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 border border-emerald-950/60"
              >
                Sign in
              </a>
              <a
                href="/register"
                className="w-full sm:w-auto px-10 py-3 bg-amber-50 dark:bg-emerald-950 text-emerald-900 dark:text-amber-200 border-2 border-amber-500/80 rounded-full font-semibold text-lg hover:bg-amber-100 dark:hover:bg-emerald-900 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Create Account
              </a>
            </div>
          </div>

          {/* Wave Divider */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg
              viewBox="0 0 1440 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full"
            >
              <path
                d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
                className="fill-slate-50 dark:fill-zinc-900"
              />
            </svg>
          </div>
        </div>

        {/* Features Section */}
        <section
          id="features"
          className="bg-slate-50 dark:bg-zinc-900 py-20 border-t border-amber-500/40"
        >
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-4xl md:text-5xl font-extrabold text-center text-emerald-950 dark:text-amber-50 mb-6">
              🎉 Newest Feature: Course Accessibility!
            </h2>
            <p className="text-lg md:text-xl text-center text-emerald-900/80 dark:text-emerald-100/80 mb-14 max-w-3xl mx-auto">
              Tag notes with accessibility info so students can quickly see how
              friendly a course is for different learning needs.
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-emerald-900/40 dark:to-amber-900/20 p-8 rounded-3xl border border-emerald-200 dark:border-emerald-800 shadow-md hover:shadow-xl transition-shadow">
                <div className="text-4xl mb-4">📚</div>
                <h3 className="text-2xl font-bold text-emerald-950 dark:text-amber-50 mb-3">
                  Share Notes
                </h3>
                <p className="text-emerald-900/80 dark:text-emerald-100/80">
                  Upload lecture notes, cheat sheets, and practice exams so your
                  classmates don&apos;t fall behind.
                </p>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-emerald-50 dark:from-emerald-900/40 dark:to-amber-900/20 p-8 rounded-3xl border border-amber-300 dark:border-amber-700 shadow-md hover:shadow-xl transition-shadow">
                <div className="text-4xl mb-4">🤝</div>
                <h3 className="text-2xl font-bold text-emerald-950 dark:text-amber-50 mb-3">
                  Collaborate
                </h3>
                <p className="text-emerald-900/80 dark:text-emerald-100/80">
                  Build shared study guides for tough midterms and finals with
                  the people in your section.
                </p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-emerald-900/40 dark:to-amber-900/20 p-8 rounded-3xl border border-emerald-200 dark:border-emerald-800 shadow-md hover:shadow-xl transition-shadow">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-2xl font-bold text-emerald-950 dark:text-amber-50 mb-3">
                  Ace Your Classes
                </h3>
                <p className="text-emerald-900/80 dark:text-emerald-100/80">
                  Quickly find the best resources for each course and stay ahead
                  all quarter long.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
