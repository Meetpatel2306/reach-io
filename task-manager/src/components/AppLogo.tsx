'use client';

interface AppLogoProps {
  size?: number;
  className?: string;
}

export default function AppLogo({ size = 40, className = '' }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="lBg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent-light, var(--accent-primary))" />
          <stop offset="100%" stopColor="var(--accent-primary)" />
        </linearGradient>
      </defs>
      {/* Background */}
      <rect width="100" height="100" rx="24" fill="url(#lBg)" />
      {/* Lightning bolt */}
      <path
        d="M56 14L30 52H46L38 86L70 44H54L56 14Z"
        fill="white"
      />
    </svg>
  );
}
