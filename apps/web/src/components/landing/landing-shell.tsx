'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, Check } from 'lucide-react';
import { SicaBrand } from '@/components/brand/sica-brand';

interface NavLink {
  href: string;
  label: string;
}

export function LandingNav({ links, loginLabel, demoLabel }: { links: NavLink[]; loginLabel: string; demoLabel: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string>('');

  const spyKey = links.map((l) => l.href).join(',');

  // Bayangan header & bilah progres baca seluruh halaman.
  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setScrolled(window.scrollY > 8);
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-spy: menandai menu dari seksi yang sedang menempati sepertiga atas layar.
  useEffect(() => {
    const ids = spyKey.split(',').map((h) => h.replace(/^#/, '')).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5] }
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [spyKey]);

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md transition-all duration-300"
      style={{
        borderColor: scrolled ? 'rgba(226,232,240,0.9)' : 'transparent',
        backgroundColor: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.72)',
        boxShadow: scrolled ? '0 6px 24px -12px rgba(15,23,42,0.18)' : 'none',
      }}
    >
      {/* Bilah progres gulir */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-velzon-primary to-velzon-info transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="SICA">
          <SicaBrand height={34} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
          {links.map((l) => {
            const active = activeId === l.href.replace(/^#/, '');
            return (
              <a
                key={l.href}
                href={l.href}
                className="group relative rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-velzon-primary"
                style={{ color: active ? 'var(--sica-color-primary, #0ab39c)' : undefined }}
              >
                <span className={active ? 'text-velzon-primary' : 'text-slate-600 group-hover:text-velzon-primary'}>{l.label}</span>
                <span
                  className="absolute -bottom-0.5 left-3 right-3 h-0.5 origin-left rounded-full bg-velzon-primary transition-transform duration-300"
                  style={{ transform: active ? 'scaleX(1)' : 'scaleX(0)' }}
                />
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            className="rounded-md px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            {loginLabel}
          </Link>
          <a
            href="#cta"
            className="sica-sheen inline-flex items-center gap-1.5 rounded-md bg-velzon-primary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-velzon-primary/25 transition-transform duration-200 hover:-translate-y-0.5"
          >
            {demoLabel}
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Buka menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-5 pb-5 pt-2 lg:hidden">
          <nav className="flex flex-col" aria-label="Navigasi seluler">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-slate-100 py-3 text-sm font-medium text-slate-700"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/login" className="rounded-md border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700">
              {loginLabel}
            </Link>
            <a href="#cta" onClick={() => setOpen(false)} className="rounded-md bg-velzon-primary px-4 py-2.5 text-center text-sm font-semibold text-white">
              {demoLabel}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

export interface RoleTab {
  key: string;
  label: string;
  title: string;
  desc: string;
  points: string[];
}

export function RoleTabs({ tabs }: { tabs: RoleTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === current.key}
            onClick={() => setActive(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              t.key === current.key
                ? 'bg-velzon-primary text-white shadow-sm shadow-velzon-primary/25'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-velzon-primary/40 hover:text-velzon-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-2 lg:items-center">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{current.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{current.desc}</p>
        </div>
        <ul className="grid gap-3">
          {current.points.map((p) => (
            <li key={p} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-velzon-success/15">
                <Check className="h-3.5 w-3.5 text-velzon-success" />
              </span>
              <span className="text-sm font-medium text-slate-700">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export interface FaqItem {
  q: string;
  a: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {items.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
            >
              <span className="text-sm font-semibold text-slate-900 sm:text-base">{item.q}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-velzon-primary' : ''}`} />
            </button>
            {isOpen && <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600 sm:px-6">{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}
