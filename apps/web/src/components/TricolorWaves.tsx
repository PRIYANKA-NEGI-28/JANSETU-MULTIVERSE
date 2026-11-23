export default function TricolorWaves() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.22]">
      <svg
        className="absolute w-[200%] h-full top-0 left-[-50%]"
        viewBox="0 0 1440 800"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="saffronGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.04" />
            <stop offset="50%" stopColor="#fdba74" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="whiteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="50%" stopColor="#f3f4f6" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.03" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Wave 1: Saffron (Top Stream) */}
        <path
          d="M0,240 C360,140 720,340 1080,200 C1440,60 1800,280 2160,160 L2160,800 L0,800 Z"
          fill="url(#saffronGrad)"
          className="animate-wave-slow"
        />

        {/* Wave 2: White (Middle Stream) */}
        <path
          d="M0,320 C400,240 800,200 1200,340 C1600,480 1800,200 2160,280 L2160,800 L0,800 Z"
          fill="url(#whiteGrad)"
          className="animate-wave-medium"
        />

        {/* Wave 3: Green (Bottom Stream) */}
        <path
          d="M0,400 C450,510 900,270 1350,430 C1800,590 1980,330 2160,370 L2160,800 L0,800 Z"
          fill="url(#greenGrad)"
          className="animate-wave-fast"
        />
      </svg>
    </div>
  );
}
