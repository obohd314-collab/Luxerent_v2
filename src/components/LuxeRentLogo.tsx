import React from "react";

interface LuxeRentLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

export const LuxeRentLogo: React.FC<LuxeRentLogoProps> = ({
  className = "",
  iconOnly = false,
  size = "md",
}) => {
  // Determine sizes based on prop
  const iconSizes = {
    sm: { width: 32, height: 32 },
    md: { width: 44, height: 44 },
    lg: { width: 56, height: 56 },
    xl: { width: 72, height: 72 },
  };

  const textSizes = {
    sm: { title: "text-base tracking-[0.15em]", subtitle: "text-[7px] tracking-[0.22em]" },
    md: { title: "text-xl tracking-[0.18em]", subtitle: "text-[9px] tracking-[0.25em]" },
    lg: { title: "text-2xl tracking-[0.2em]", subtitle: "text-[10px] tracking-[0.28em]" },
    xl: { title: "text-4xl tracking-[0.22em]", subtitle: "text-[12px] tracking-[0.3em]" },
  };

  const { width, height } = iconSizes[size];
  const { title: titleClass, subtitle: subtitleClass } = textSizes[size];

  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      {/* Golden Crown-Key Emblem */}
      <svg
        width={width}
        height={height}
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_2px_4px_rgba(179,135,40,0.25)] dark:drop-shadow-[0_4px_8px_rgba(242,227,198,0.15)] flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
      >
        <defs>
          {/* Champagne & Antique Gold Linear Gradients for 3D metallic feel */}
          <linearGradient id="luxe-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5e5c9" />
            <stop offset="35%" stopColor="#dfb76c" />
            <stop offset="70%" stopColor="#b38728" />
            <stop offset="100%" stopColor="#8d6212" />
          </linearGradient>
          
          <linearGradient id="luxe-gold-light" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#b38728" />
            <stop offset="50%" stopColor="#fef3db" />
            <stop offset="100%" stopColor="#dfb76c" />
          </linearGradient>

          <filter id="luxe-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Golden Crown */}
        {/* Base arch of the crown */}
        <path
          d="M 18,17 C 22,18.2 38,18.2 42,17 C 40,16.2 20,16.2 18,17 Z"
          fill="url(#luxe-gold-light)"
        />
        
        {/* Ornate crown outline and spikes */}
        <path
          d="M 17.5,17 
             C 17.2,16 16.5,12 18,9 
             C 18.5,8 19.5,8 20,9 
             L 24,14 
             L 30,5 
             L 36,14 
             L 40,9 
             C 40.5,8 41.5,8 42,9 
             C 43.5,12 42.8,16 42.5,17 
             Z"
          fill="url(#luxe-gold)"
        />

        {/* Little jeweled beads on the 3 main tips of the crown */}
        <circle cx="18" cy="8.2" r="1.5" fill="url(#luxe-gold-light)" />
        <circle cx="30" cy="4.2" r="1.8" fill="url(#luxe-gold-light)" />
        <circle cx="42" cy="8.2" r="1.5" fill="url(#luxe-gold-light)" />

        {/* 2. Transition collar between Crown and Key */}
        <path
          d="M 27,19 H 33 V 21 H 27 Z"
          fill="url(#luxe-gold-light)"
          rx="0.5"
        />

        {/* 3. Ornate Key Head/Grip (Combining an arch, outer guard, and luxurious inner L) */}
        {/* Outer Loop */}
        <path
          d="M 30,21 
             C 21,21 21,35 30,35 
             C 39,35 39,21 30,21 
             Z 
             M 30,23 
             C 36,23 36,33 30,33 
             C 24,33 24,23 30,23 
             Z"
          fill="url(#luxe-gold)"
          fillRule="evenodd"
        />

        {/* Inner decorative "L" monogram inside key head */}
        <path
          d="M 28,25.5 
             V 31.5 
             H 32.5
             C 33,31.5 33,30.5 32.5,30.5 
             H 29.5 
             V 25.5 
             C 29.5,25 28,25 28,25.5 
             Z"
          fill="url(#luxe-gold-light)"
        />

        {/* 4. Key Shaft extending downwards */}
        <path
          d="M 28.8,35 H 31.2 V 51 C 31.2,52.1 28.8,52.1 28.8,51 Z"
          fill="url(#luxe-gold-light)"
        />

        {/* Rounded shaft collar highlight */}
        <circle cx="30" cy="38" r="1.8" fill="url(#luxe-gold)" />

        {/* 5. Key Bit/Teeth pointing to the right */}
        {/* Double-cut high luxury lock bit */}
        <path
          d="M 31.2,43 
             H 37.5 
             C 38,43 38,45.5 37.5,45.5 
             H 33 
             V 47 
             H 36.5 
             C 37,47 37,49.5 36.5,49.5 
             H 31.2 
             Z"
          fill="url(#luxe-gold)"
        />
        
        {/* Classic detail hollow in the key bit */}
        <circle cx="34.5" cy="44.2" r="0.75" fill="#0c0a15" className="dark:fill-[#0c0a15] fill-white transition-colors" />
        <circle cx="34.5" cy="48.2" r="0.75" fill="#0c0a15" className="dark:fill-[#0c0a15] fill-white transition-colors" />

        {/* Small subtle diamond sparkle on the crown base */}
        <polygon
          points="30,13 32,15 30,17 28,15"
          fill="#ffffff"
          opacity="0.85"
        />
      </svg>

      {/* Brand Text Section */}
      {!iconOnly && (
        <div className="flex flex-col text-left leading-none">
          {/* LUXERENT Text with gradient leaf gold shading */}
          <span 
            className={`font-serif uppercase font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#b38728] via-[#f7e7c4] to-[#a2771c] dark:from-[#dfb76c] dark:via-[#fef3db] dark:to-[#b38728] drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] ${titleClass}`}
          >
            LUXERENT
          </span>
          {/* "PREMIUM RENTALS" secondary line */}
          <span 
            className={`font-sans font-medium text-[#8c6d30] dark:text-amber-400/80 transition-colors uppercase ${subtitleClass}`}
          >
            PREMIUM RENTALS
          </span>
        </div>
      )}
    </div>
  );
};
