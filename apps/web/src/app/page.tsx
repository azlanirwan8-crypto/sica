import React from 'react';
import Link from 'next/link';
import {
  Database,
  ShieldCheck,
  Smartphone,
  Landmark,
  Lock,
  Fingerprint,
  ScrollText,
  KeyRound,
  Globe,
  MessageCircle,
  CreditCard,
  ScanLine,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { getDictionary } from '../lib/i18n';
import { SicaBrand } from '@/components/brand/sica-brand';
import { LandingNav, RoleTabs, FaqAccordion } from '@/components/landing/landing-shell';
import { Reveal } from '@/components/landing/motion';
import { ModuleCatalog } from '@/components/landing/module-catalog';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SECURITY_ICONS: LucideIcon[] = [ShieldCheck, KeyRound, Fingerprint, ScrollText, Lock, Landmark];
const INTEGRATION_ICONS: LucideIcon[] = [Database, CreditCard, MessageCircle, Globe, ScanLine, Smartphone];

/**
 * Langkah stagger landing (ms). Ditulis sebagai konstanta lokal — bukan impor
 * dari `motion.tsx` — karena halaman ini Server Component dan tidak boleh
 * memanggil fungsi modul client saat render server.
 */
const STAGGER = 48;

/** Ubin ikon dekoratif — ikon tidak pernah membawa makna sendiri. */
function IconTile({ Icon, className }: { Icon: LucideIcon; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-hover',
        className
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={1.9} />
    </span>
  );
}

/** Judul seksi seragam: eyebrow → h2 → penjelasan. Satu h2 per seksi. */
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly align?: 'center' | 'left';
}) {
  return (
    <Reveal className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tightest sm:text-4xl">{title}</h2>
      {subtitle ? <p className="mt-4 text-[15px] leading-relaxed2 text-slate-600">{subtitle}</p> : null}
    </Reveal>
  );
}

export default function HomePage() {
  const t = getDictionary('id').landing;

  const navLinks = [
    { href: '#modul', label: t.nav.modules },
    { href: '#peran', label: t.nav.roles },
    { href: '#keamanan', label: t.nav.security },
    { href: '#integrasi', label: t.nav.integrations },
    { href: '#faq', label: t.nav.faq },
  ];

  return (
    <div className="min-h-screen bg-sica-canvas text-slate-600 antialiased selection:bg-primary/20">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-sica-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-hover"
      >
        Lewati ke konten
      </a>

      <LandingNav links={navLinks} loginLabel={t.nav.login} demoLabel={t.nav.demo} />

      <main id="konten" tabIndex={-1}>
        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section className="border-b hairline bg-sica-card">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.9fr)] lg:items-center lg:gap-20 lg:px-8 lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border hairline bg-sica-inset px-3 py-1.5 text-xs font-semibold text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                {t.hero.status}
              </p>
              <h1 className="mt-6 max-w-3xl text-[2.35rem] font-semibold leading-[1.08] tracking-tightest text-[color:var(--sica-text-heading)] sm:text-5xl lg:text-[3.7rem]">
                {t.hero.titleA}{' '}
                <span className="text-primary-hover">{t.hero.titleHighlight}</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed2 text-slate-600 sm:text-lg">
                {t.hero.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="#modul" className={cn(buttonVariants({ variant: 'default', size: 'xl' }))}>
                  {t.hero.ctaPrimary}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
                <Link href="/login" className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}>
                  {t.hero.ctaSecondary}
                </Link>
              </div>
            </div>

            <aside className="border-l-2 border-primary/30 pl-6 sm:pl-8" aria-label={t.hero.areasTitle}>
              <p className="eyebrow">{t.hero.areasEyebrow}</p>
              <h2 className="mt-3 text-lg font-semibold tracking-tightest text-[color:var(--sica-text-heading)]">
                {t.hero.areasTitle}
              </h2>
              <ul className="mt-5 divide-y divide-[color:var(--sica-divider)]">
                {t.hero.areas.map((area, index) => (
                  <li key={area.title} className="flex gap-4 py-4 first:pt-0">
                    <span className="mt-0.5 font-mono text-xs text-primary-hover">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-[color:var(--sica-text-heading)]">{area.title}</h3>
                      <p className="mt-1 text-[13px] leading-relaxed2 text-slate-500">{area.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        {/* ── CATALOG: scope, not availability ───────────────────────────── */}
        <section id="modul" className="scroll-mt-20 border-y hairline bg-sica-card py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHeading eyebrow={t.catalog.eyebrow} title={t.catalog.title} subtitle={t.catalog.subtitle} />
            <div className="mt-12">
              <ModuleCatalog copy={t.catalog} />
            </div>
          </div>
        </section>

        {/* ── ROLES ──────────────────────────────────────────────────────── */}
        <section id="peran" className="scroll-mt-20 border-y hairline bg-sica-canvas py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHeading eyebrow={t.roles.eyebrow} title={t.roles.title} subtitle={t.roles.subtitle} />
            <Reveal delay={STAGGER} className="mx-auto mt-12 max-w-5xl">
              <RoleTabs tabs={t.roles.tabs} scopeLabel={t.roles.scopeLabel} />
            </Reveal>
          </div>
        </section>

        {/* ── SECURITY ───────────────────────────────────────────────────── */}
        <section id="keamanan" className="scroll-mt-20 bg-secondary py-20 text-white sm:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider2 text-white/85">
                {t.security.eyebrow}
              </span>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tightest text-white sm:text-4xl">
                {t.security.title}
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {t.security.items.map((s, i) => (
                <Reveal key={s.title} delay={(i % 3) * STAGGER}>
                  <article className="h-full rounded-xl border border-white/12 bg-white/[0.06] p-6 transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.1]">
                    <span
                      aria-hidden
                      className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/12 text-white"
                    >
                      {React.createElement(SECURITY_ICONS[i] ?? ShieldCheck, { className: 'h-5 w-5', strokeWidth: 1.9 })}
                    </span>
                    <h3 className="mt-4 text-[15px] font-semibold text-white">{s.title}</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed2 text-white/70">{s.desc}</p>
                  </article>
                </Reveal>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-3xl text-center text-[12.5px] leading-relaxed2 text-white/70">
              {t.security.note}
            </p>
          </div>
        </section>

        {/* ── INTEGRATIONS ───────────────────────────────────────────────── */}
        <section id="integrasi" className="scroll-mt-20 bg-sica-canvas py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHeading
              eyebrow={t.integrations.eyebrow}
              title={t.integrations.title}
              subtitle={t.integrations.note}
              align="left"
            />
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {t.integrations.items.map((it, i) => {
                const Icon = INTEGRATION_ICONS[i] ?? Globe;
                return (
                  <Reveal key={it.title} delay={(i % 3) * STAGGER}>
                    <Card interactive className="h-full">
                      <CardContent className="flex gap-4">
                        <IconTile Icon={Icon} className="h-10 w-10" />
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-[color:var(--sica-text-heading)]">{it.title}</h3>
                          <p className="mt-1.5 text-[13px] leading-relaxed2 text-slate-600">{it.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-20 border-t hairline bg-sica-card py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-5 lg:px-8">
            <SectionHeading eyebrow={t.faq.eyebrow} title={t.faq.title} />
            <Reveal delay={STAGGER} className="mt-12">
              <FaqAccordion items={t.faq.items} />
            </Reveal>
          </div>
        </section>

        {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
        <section id="cta" className="scroll-mt-20 bg-sica-canvas px-5 py-20 sm:py-28 lg:px-8">
          <Reveal variant="in" className="relative mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary px-6 py-16 text-center shadow-raised sm:px-12 sm:py-20">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    'radial-gradient(50% 60% at 80% 10%, rgb(255 255 255 / 0.55) 0%, transparent 60%)',
                }}
              />
              <h2 className="relative text-2xl font-bold leading-tight tracking-tightest text-white sm:text-3xl lg:text-4xl">
                {t.cta.title}
              </h2>
              <p className="relative mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed2 text-white/80">
                {t.cta.subtitle}
              </p>
              <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#modul"
                  className={cn(
                    buttonVariants({ variant: 'default', size: 'xl' }),
                    'border-transparent bg-[color:var(--sica-surface-card)] text-primary-hover hover:bg-[color:var(--sica-surface-raised)]'
                  )}
                >
                  {t.cta.primary}
                </a>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'xl' }),
                    'border-white/45 bg-transparent text-white hover:bg-white/10 hover:text-white'
                  )}
                >
                  {t.cta.secondary}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="border-t hairline bg-sica-card">
        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SicaBrand height={44} />
              <p className="mt-3 max-w-xl text-[13px] leading-relaxed2 text-slate-600">{t.footer.tagline}</p>
            </div>
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium" aria-label={t.footer.navigation}>
              <a className="inline-flex min-h-11 min-w-11 items-center text-slate-600 hover:text-primary-hover sm:min-h-0 sm:min-w-0" href="#modul">{t.nav.modules}</a>
              <a className="inline-flex min-h-11 min-w-11 items-center text-slate-600 hover:text-primary-hover sm:min-h-0 sm:min-w-0" href="#keamanan">{t.nav.security}</a>
              <a className="inline-flex min-h-11 min-w-11 items-center text-slate-600 hover:text-primary-hover sm:min-h-0 sm:min-w-0" href="#faq">{t.nav.faq}</a>
            </nav>
          </div>

          <div className="mt-8 border-t hairline pt-5 text-center text-[12.5px] text-slate-500 sm:text-left">
            <div>© {new Date().getFullYear()} SICA. {t.footer.copyright}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
