import React from "react";

export interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
  className?: string;
}

const sizeConfig = {
  sm: {
    container: "gap-1",
    number: "text-[19px] font-black leading-none",
    textWrapper: "text-[8px] leading-[0.85] tracking-tight font-extrabold",
  },
  md: {
    container: "gap-1.5",
    number: "text-2xl font-black leading-none",
    textWrapper: "text-[9px] leading-[0.85] tracking-tight font-extrabold",
  },
  lg: {
    container: "gap-2",
    number: "text-4xl font-black leading-none",
    textWrapper: "text-[13px] leading-[0.85] tracking-tight font-extrabold",
  },
};

const variantClasses: Record<"light" | "dark", string> = {
  light: "text-white",
  dark: "text-ink-950 dark:text-white",
};

export default function BrandLogo({
  size = "md",
  variant,
  className = "",
}: BrandLogoProps) {
  const conf = sizeConfig[size] || sizeConfig.md;
  const colorClass = variant ? variantClasses[variant] : "text-current";

  return (
    <span
      className={`inline-flex items-center select-none font-display ${conf.container} ${colorClass} ${className}`.trim()}
      aria-hidden="true"
    >
      <span className={conf.number}>4</span>
      <span className={`flex flex-col justify-between uppercase ${conf.textWrapper}`}>
        <span>THE</span>
        <span>PEOPLE</span>
      </span>
    </span>
  );
}

