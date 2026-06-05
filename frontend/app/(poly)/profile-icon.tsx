import Link from "next/link";

export default function ProfileIcons() {
  return (
    <Link
      href="/profile"
      className="dashboard-profile-icon"
      aria-label="Open profile dashboard"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M10 11.2c2.3 0 4.2-1.9 4.2-4.2S12.3 2.8 10 2.8 5.8 4.7 5.8 7s1.9 4.2 4.2 4.2Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M3.6 17.2c1.7-2.4 3.9-3.6 6.4-3.6s4.7 1.2 6.4 3.6"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </Link>
  );
}
