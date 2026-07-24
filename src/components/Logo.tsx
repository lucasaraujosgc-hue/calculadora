import React from 'react';
import { Link } from 'react-router-dom';

export default function Logo() {
  return (
    <Link to="/" className="flex items-baseline select-none cursor-pointer hover:opacity-80 transition-opacity">
      <span className="text-2xl md:text-[28px] font-serif font-bold text-primary tracking-tight">Vírgula</span>
      <span className="text-2xl md:text-[28px] font-serif font-bold text-accent leading-none">,</span>
      <span className="hidden md:inline font-sans text-[12px] font-medium text-muted-foreground tracking-[0.18em] uppercase ml-3">
        Contábil · Calculadora
      </span>
    </Link>
  );
}
