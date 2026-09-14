import React, { useMemo } from 'react';

// Fondo decorativo de la pantalla de login (rediseño v2 / Figma) — SVG puro,
// sin lógica ni datos, portado 1:1 desde el Figma Make.
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export default function SpaceBackground() {
  const stars = useMemo(() => {
    const rand = seededRandom(42);
    return Array.from({ length: 320 }, (_, i) => ({
      x: rand() * 100,
      y: rand() * 100,
      r: rand() * 1.4 + 0.2,
      opacity: rand() * 0.7 + 0.15,
      twinkle: rand() > 0.7,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="space-bg" cx="72%" cy="18%" r="90%">
            <stop offset="0%" stopColor="#0a0d1a" />
            <stop offset="40%" stopColor="#060810" />
            <stop offset="100%" stopColor="#020306" />
          </radialGradient>

          <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff8e8" stopOpacity="1" />
            <stop offset="18%" stopColor="#ffe08a" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#f5a623" stopOpacity="0.4" />
            <stop offset="75%" stopColor="#e8681a" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#c0440a" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="sun-corona" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff6e0" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#f5a623" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="nebula1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a2a6c" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1a2a6c" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="nebula2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0d1f3c" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0d1f3c" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="milkyway" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0" />
            <stop offset="30%" stopColor="#1e3a5f" stopOpacity="0.06" />
            <stop offset="50%" stopColor="#2a5298" stopOpacity="0.09" />
            <stop offset="70%" stopColor="#1e3a5f" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="earth-ocean" cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#1a6fa8" />
            <stop offset="35%" stopColor="#0e4f82" />
            <stop offset="65%" stopColor="#083766" />
            <stop offset="100%" stopColor="#04193a" />
          </radialGradient>

          <radialGradient id="earth-atmo" cx="50%" cy="50%" r="50%">
            <stop offset="82%" stopColor="#1a6fa8" stopOpacity="0" />
            <stop offset="90%" stopColor="#4fb3f6" stopOpacity="0.45" />
            <stop offset="96%" stopColor="#a8d8f8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#d6edff" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="earth-glow" cx="50%" cy="50%" r="50%">
            <stop offset="75%" stopColor="#1a6fa8" stopOpacity="0" />
            <stop offset="88%" stopColor="#1a6fa8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0d3d6e" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="earth-shadow" cx="78%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#000610" stopOpacity="0.88" />
            <stop offset="55%" stopColor="#000610" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#000610" stopOpacity="0" />
          </radialGradient>

          <filter id="cloud-blur">
            <feGaussianBlur stdDeviation="1.8" />
          </filter>

          <filter id="star-glow">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          <clipPath id="earth-clip">
            <circle cx="520" cy="580" r="310" />
          </clipPath>

          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="60%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
          </radialGradient>
        </defs>

        <rect width="1440" height="900" fill="url(#space-bg)" />

        <ellipse cx="720" cy="450" rx="900" ry="220" fill="url(#milkyway)" transform="rotate(-25 720 450)" />

        <ellipse cx="200" cy="150" rx="380" ry="260" fill="url(#nebula1)" />
        <ellipse cx="1150" cy="700" rx="320" ry="220" fill="url(#nebula2)" />
        <ellipse cx="900" cy="120" rx="250" ry="180" fill="url(#nebula1)" opacity="0.6" />

        {stars.map((s, i) => (
          <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white" opacity={s.opacity}>
            {s.twinkle && (
              <animate
                attributeName="opacity"
                values={`${s.opacity};${s.opacity * 0.3};${s.opacity}`}
                dur={`${2.5 + (i % 7) * 0.6}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
        ))}

        {[
          { x: 120, y: 80, r: 1.8 },
          { x: 340, y: 55, r: 1.5 },
          { x: 800, y: 45, r: 2 },
          { x: 1100, y: 130, r: 1.7 },
          { x: 1320, y: 280, r: 1.6 },
          { x: 95, y: 320, r: 1.4 },
          { x: 680, y: 200, r: 1.3 },
        ].map((s, i) => (
          <circle key={`bright-${i}`} cx={s.x} cy={s.y} r={s.r} fill="white" opacity="0.9" filter="url(#star-glow)" />
        ))}

        {/* Sol — distante, arriba a la derecha */}
        <ellipse cx="1290" cy="85" rx="280" ry="280" fill="url(#sun-corona)" />
        <circle cx="1290" cy="85" r="150" fill="url(#sun-glow)" opacity="0.7" />
        <circle cx="1290" cy="85" r="70" fill="url(#sun-glow)" opacity="0.9" />
        <circle cx="1290" cy="85" r="28" fill="#fff8e8" opacity="0.98" />
        <circle cx="1290" cy="85" r="22" fill="white" opacity="1" />
        <line x1="1230" y1="85" x2="1180" y2="85" stroke="#ffe08a" strokeWidth="0.5" opacity="0.25" />
        <line x1="1290" y1="25" x2="1290" y2="-10" stroke="#ffe08a" strokeWidth="0.5" opacity="0.2" />

        {/* Tierra */}
        <circle cx="520" cy="580" r="360" fill="url(#earth-glow)" />
        <circle cx="520" cy="580" r="310" fill="url(#earth-ocean)" />

        <g clipPath="url(#earth-clip)" opacity="0.82">
          <path d="M 280 380 Q 295 360 315 355 Q 340 350 355 370 Q 370 390 365 420 Q 360 450 340 480 Q 325 510 310 540 Q 295 565 285 590 Q 275 620 280 650 Q 290 680 305 700 Q 295 720 280 730 Q 265 720 258 700 Q 250 670 255 640 Q 260 610 258 580 Q 255 555 248 530 Q 240 500 245 470 Q 250 440 265 415 Z" fill="#2d6a4f" />
          <path d="M 305 700 Q 320 710 335 720 Q 350 740 345 760 Q 335 775 315 778 Q 295 775 285 758 Q 278 740 285 725 Q 295 712 305 700 Z" fill="#2d6a4f" />

          <path d="M 520 350 Q 535 338 555 335 Q 575 333 590 342 Q 605 352 608 370 Q 610 388 600 405 Q 590 420 575 430 Q 558 440 545 455 Q 532 470 528 490 Q 524 510 530 530 Q 538 555 535 580 Q 530 605 518 625 Q 505 642 492 648 Q 478 650 468 638 Q 458 625 462 605 Q 466 582 472 560 Q 476 538 470 515 Q 465 492 468 468 Q 472 445 480 425 Q 488 406 500 390 Q 510 372 520 350 Z" fill="#2d7d46" />
          <path d="M 565 435 Q 580 425 598 428 Q 618 432 630 448 Q 642 465 638 485 Q 632 505 618 515 Q 600 523 582 518 Q 565 512 558 498 Q 550 482 555 465 Q 560 450 565 435 Z" fill="#2d7d46" />

          <path d="M 620 320 Q 650 305 690 298 Q 730 292 770 295 Q 808 298 840 310 Q 872 323 890 342 Q 908 362 905 385 Q 900 408 882 425 Q 860 440 835 448 Q 808 455 780 458 Q 750 460 720 455 Q 690 448 665 438 Q 638 426 622 410 Q 606 393 608 372 Q 610 348 620 320 Z" fill="#3a8f5c" />
          <path d="M 750 460 Q 775 462 800 472 Q 825 483 840 500 Q 855 518 848 538 Q 840 558 820 568 Q 798 576 775 572 Q 752 567 738 552 Q 724 536 726 515 Q 728 492 738 476 Q 744 466 750 460 Z" fill="#2d7d46" />

          <path d="M 760 620 Q 782 608 808 610 Q 835 613 850 630 Q 865 648 858 668 Q 850 688 830 698 Q 808 706 785 700 Q 762 692 752 674 Q 742 655 748 637 Q 753 626 760 620 Z" fill="#3a8f5c" opacity="0.75" />

          <g filter="url(#cloud-blur)" opacity="0.55">
            <ellipse cx="380" cy="420" rx="95" ry="32" fill="white" />
            <ellipse cx="430" cy="415" rx="70" ry="25" fill="white" />
            <ellipse cx="355" cy="430" rx="60" ry="22" fill="white" />
          </g>
          <g filter="url(#cloud-blur)" opacity="0.5">
            <ellipse cx="640" cy="500" rx="110" ry="28" fill="white" />
            <ellipse cx="700" cy="494" rx="75" ry="22" fill="white" />
          </g>
          <g filter="url(#cloud-blur)" opacity="0.48">
            <ellipse cx="490" cy="640" rx="130" ry="30" fill="white" />
            <ellipse cx="550" cy="648" rx="80" ry="24" fill="white" />
          </g>
          <g filter="url(#cloud-blur)" opacity="0.7">
            <ellipse cx="520" cy="285" rx="160" ry="55" fill="white" />
            <ellipse cx="520" cy="875" rx="180" ry="60" fill="white" />
          </g>
        </g>

        <circle cx="520" cy="580" r="310" fill="url(#earth-shadow)" />

        <circle cx="520" cy="580" r="310" fill="none" stroke="#4fb3f6" strokeWidth="18" opacity="0.22" />
        <circle cx="520" cy="580" r="310" fill="url(#earth-atmo)" />

        <rect width="1440" height="900" fill="url(#vignette)" />

        <rect x="700" y="0" width="740" height="900" fill="black" opacity="0.18" />
      </svg>
    </div>
  );
}
