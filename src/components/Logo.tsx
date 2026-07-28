import React from 'react';
import { Link } from 'react-router-dom';

export default function Logo() {
  return (
    <div className="flex flex-col items-center">
      {/* Título */}
      <span className="font-sans text-[12px] font-medium text-muted-foreground tracking-[0.18em] uppercase mb-2">
        Calculadora
      </span>

      {/* Divisor Horizontal */}
      <div className="w-full h-px bg-border mb-3"></div>

      {/* Logo */}
      <Link to="/" className="flex items-center justify-center select-none cursor-pointer hover:opacity-90 transition-opacity" style={{ textDecoration: 'none' }}>
        <div className="flex flex-col items-center">
          <div className="flex items-baseline">
            <span className="text-2xl md:text-[28px] font-serif font-bold text-primary tracking-tight">
              Vírgula
            </span>
            <span className="text-2xl md:text-[28px] font-serif font-bold text-accent leading-none">
              ,
            </span>
          </div>

          <span className="font-sans text-[10px] md:text-[11px] font-medium text-muted-foreground tracking-[0.22em] uppercase leading-none mt-0.5">
            Contábil
          </span>
        </div>
      </Link>
    </div>
  );
}
