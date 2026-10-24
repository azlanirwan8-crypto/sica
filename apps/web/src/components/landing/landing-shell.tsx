'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Accordion } from '@/components/ui/accordion';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SicaBrand } from '@/components/brand/sica-brand';
import { cn } from '@/lib/utils';

interface NavLink {
  href: string;
  label: string;
}

/** Kelas pembungkus permukaan header: ikut tema, tanpa putih/hexa keras. */
const HEADER_SURFACE = 'bg-[color:var(--sica-surface-header)] backdrop-blur-md';

export function LandingNav({ links, loginLabel, demoLabel }: { links: NavLink[]; loginLabel: string; demoLabel: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string>('');

  const spyKey = links.map((l) => l.href).join(',');

  // Bayangan header & bilah progres baca seluruh halaman.
  useEffect(() => {
    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        setScrolled(window.scrollY > 8);
        setProgress(max > 0 ? Math.min(100, window.scrollY / max) : 0);
      });
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
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
      className={cn(
        'sticky top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300',
        scrolled
          ? cn(HEADER_SURFACE, 'hairline shadow-sm')
          : 'border-transparent bg-transparent'
      )}
    >
      {/* Bilah progres gulir */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 bg-gradient-to-r from-primary to-info"
        style={{
          transform: `scaleX(${progress})`,
        }}
      />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        <Link href="/" className="flex min-h-11 items-center rounded-md" aria-label="SICA — beranda">
          <SicaBrand height={34} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
          {links.map((l) => {
            const active = activeId === l.href.replace(/^#/, '');
            return (
              <a
                key={l.href}
                href={l.href}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'group relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'text-primary-hover' : 'text-slate-600 hover:text-primary-hover'
                )}
              >
                {l.label}
                <span
                  aria-hidden
                  className={cn(
                    'absolute -bottom-0.5 left-3 right-3 h-0.5 origin-left rounded-full bg-primary transition-transform duration-300 ease-velzon',
                    active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'
                  )}
                />
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'default' }))}>
            {loginLabel}
          </Link>
          <a href="#modul" className={cn(buttonVariants({ variant: 'default', size: 'default' }))}>
            {demoLabel}
          </a>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="landing-mobile-nav"
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          className="min-h-11 min-w-11 lg:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </Button>
      </div>

      {open && (
        <div id="landing-mobile-nav" className="border-t hairline bg-sica-card px-5 pb-5 pt-2 lg:hidden">
          <nav className="flex flex-col" aria-label="Navigasi seluler">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b hairline py-3 text-sm font-medium text-slate-700 transition-colors hover:text-primary-hover"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/login" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: 'label', size: 'lg' }), 'w-full')}>
              {loginLabel}
            </Link>
            <a href="#modul" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full')}>
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

const TAB_KEYS = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'] as const;

export function RoleTabs({ tabs, scopeLabel }: { tabs: RoleTab[]; scopeLabel: string }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');
  const listRef = useRef<HTMLDivElement | null>(null);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  if (!current) return null;

  // Navigasi tab dengan panah (roving tabindex), sebagaimana pola ARIA tabs.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(TAB_KEYS as readonly string[]).includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((t) => t.key === current.key);
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;

    const target = tabs[next];
    if (!target) return;
    setActive(target.key);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };

  return (
    <div>
      <div
        ref={listRef}
        className="role-tab-list flex min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2"
        role="tablist"
        aria-label="Peran pengguna"
        onKeyDown={onKeyDown}
      >
        {tabs.map((t) => {
          const selected = t.key === current.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`role-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`role-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={cn(
                'min-h-11 flex-none scroll-mx-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-[transform,background-color,color,border-color,box-shadow] duration-200 ease-velzon hover:-translate-y-px active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
                selected
                  ? 'bg-primary text-primary-on shadow-sm'
                  : 'border hairline bg-sica-card text-slate-600 hover:bg-primary-soft hover:text-primary-hover'
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <Card
        key={current.key}
        role="tabpanel"
        id={`role-panel-${current.key}`}
        aria-labelledby={`role-tab-${current.key}`}
        className="sica-anim sica-fade-up mt-8"
      >
        <CardHeader className="sm:pb-6">
          <CardTitle className="text-xl tracking-tightest sm:text-2xl">{current.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-8 pt-0 lg:grid-cols-2 lg:items-start">
          <p className="section-label lg:col-span-2">{scopeLabel}</p>
          <p className="text-sm leading-relaxed2 text-slate-600 sm:text-[15px]">{current.desc}</p>
          <ul className="grid gap-3">
            {current.points.map((p) => (
              <li key={p} className="flex items-start gap-3 rounded-lg border hairline bg-sica-inset px-4 py-3">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-sm font-medium text-slate-700">{p}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export interface FaqItem {
  q: string;
  a: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Card>
      <CardContent className="py-1">
        <Accordion
          defaultOpen={0}
          items={items.map((item) => ({ title: item.q, content: <p className="leading-relaxed2">{item.a}</p> }))}
        />
      </CardContent>
    </Card>
  );
}
