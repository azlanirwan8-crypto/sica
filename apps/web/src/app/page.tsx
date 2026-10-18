import React from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Database,
  ShieldCheck,
  Smartphone,
  Building2,
  Landmark,
  Users,
  Lock,
  Fingerprint,
  ScrollText,
  KeyRound,
  Globe,
  Mail,
  MessageCircle,
  CreditCard,
  ScanLine,
  Workflow,
  MapPin,
  Timer,
  Zap,
  Server,
  FileText,
  Headset,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Quote,
  Star,
} from 'lucide-react';
import { getDictionary } from '../lib/i18n';
import { SicaBrand } from '@/components/brand/sica-brand';
import { LandingNav, RoleTabs, FaqAccordion } from '@/components/landing/landing-shell';
import { HeroMockup } from '@/components/landing/hero-mockup';
import { Reveal, CountUp } from '@/components/landing/motion';
import { ModuleCatalog } from '@/components/landing/module-catalog';
import { BenchmarkSection } from '@/components/landing/benchmark';

const PROBLEM_ICONS = [Zap, ScanLine, FileText, Lock];
const SECURITY_ICONS = [ShieldCheck, KeyRound, Fingerprint, ScrollText, Lock, Landmark];
const INTEGRATION_ICONS = [Database, CreditCard, MessageCircle, Globe, ScanLine, Smartphone];

type IconComponent = React.ComponentType<{ className?: string }>;

function IconTile({ Icon, tone }: { Icon: IconComponent; tone: string }) {
  return (
    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

export default function HomePage() {
  const t = getDictionary('id').landing;

  const navLinks = [
    { href: '#modul', label: t.nav.modules },
    { href: '#alur', label: t.nav.features },
    { href: '#peran', label: t.nav.roles },
    { href: '#keamanan', label: t.nav.security },
    { href: '#harga', label: t.nav.pricing },
    { href: '#faq', label: t.nav.faq },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-700 antialiased selection:bg-velzon-primary selection:text-white">
      <LandingNav links={navLinks} loginLabel={t.nav.login} demoLabel={t.nav.demo} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-slate-50 via-white to-white">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(60% 60% at 15% 0%, rgba(53,119,241,0.18) 0%, transparent 60%), radial-gradient(50% 50% at 90% 10%, rgba(10,179,156,0.14) 0%, transparent 60%)',
          }}
        />
        {/* Blob ambient bergerak halus di latar hero */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <span className="sica-blob absolute -left-24 top-10 h-72 w-72 rounded-full bg-velzon-primary/10 blur-3xl" />
          <span className="sica-blob absolute -right-16 top-32 h-80 w-80 rounded-full bg-velzon-success/10 blur-3xl" style={{ animationDelay: '-6s' }} />
        </div>
        <div className="mx-auto max-w-7xl px-5 pb-16 pt-14 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="sica-anim sica-fade-up inline-flex items-center gap-2 rounded-full border border-velzon-primary/20 bg-velzon-primary-light px-3.5 py-1.5 text-xs font-semibold text-velzon-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {t.hero.badge}
            </span>

            <h1 className="sica-anim sica-fade-up mt-6 text-[2rem] font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]" style={{ animationDelay: '120ms' }}>
              {t.hero.titleA}{' '}
              <span className="bg-gradient-to-r from-velzon-primary to-velzon-info bg-clip-text text-transparent">
                {t.hero.titleHighlight}
              </span>
            </h1>

            <p className="sica-anim sica-fade-up mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-600 sm:text-lg" style={{ animationDelay: '200ms' }}>{t.hero.subtitle}</p>

            <div className="sica-anim sica-fade-up mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '280ms' }}>
              <Link
                href="/login"
                className="sica-sheen inline-flex h-12 items-center gap-2 rounded-lg bg-velzon-primary px-7 text-sm font-semibold text-white shadow-lg shadow-velzon-primary/25 transition-all hover:-translate-y-0.5 hover:bg-velzon-primary-hover"
              >
                {t.hero.ctaPrimary}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#modul"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-7 text-sm font-semibold text-slate-700 transition-colors hover:border-velzon-primary/50 hover:text-velzon-primary"
              >
                {t.hero.ctaSecondary}
              </a>
            </div>

            <ul className="sica-anim sica-fade-up mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500" style={{ animationDelay: '360ms' }}>
              {[t.hero.trust1, t.hero.trust2, t.hero.trust3].map((label) => (
                <li key={label} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-velzon-success" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <Reveal delay={420} className="mt-14">
            <HeroMockup
              caption={t.hero.previewCaption}
              periodLabel="Semester Ganjil 2026/2027"
            stats={[
              { label: 'IPK Kumulatif', value: '3.74', tone: 'text-velzon-success' },
              { label: 'SKS Lulus', value: '29 / 144', tone: 'text-velzon-info' },
              { label: 'Kehadiran', value: '87.5%', tone: 'text-velzon-success' },
              { label: 'Status UKT', value: 'LUNAS', tone: 'text-velzon-success' },
            ]}
            scheduleTitle="Jadwal Kuliah Hari Ini"
            schedule={[
              { time: '08:00 – 09:40', course: 'IF3201 Rekayasa Perangkat Lunak Lanjut', room: 'Ruang Teori 302', status: 'SELESAI', tone: 'bg-velzon-success/10 text-velzon-success' },
              { time: '10:00 – 12:30', course: 'IF3204 Basis Data Terdistribusi', room: 'Lab Komputasi A', status: 'BERLANGSUNG', tone: 'bg-velzon-primary/10 text-velzon-primary' },
              { time: '13:30 – 15:10', course: 'IF3208 Keamanan Siber & Kriptografi', room: 'Ruang Seminar 101', status: 'MENDATANG', tone: 'bg-velzon-warning/15 text-[#b57614]' },
            ]}
            />
          </Reveal>
        </div>
      </section>

      {/* ── STATS BAND ───────────────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-slate-900 py-12">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <h2 className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{t.stats.heading}</h2>
          </Reveal>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {t.stats.items.map((s, i) => (
              <Reveal key={s.label} delay={i * 90} variant="in">
                <div className="text-center">
                  <div className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                    <CountUp value={s.value} />
                  </div>
                  <div className="mx-auto mt-2 max-w-[15rem] text-[13px] leading-relaxed text-slate-400">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEMS ─────────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-velzon-primary">{t.problem.eyebrow}</span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">{t.problem.title}</h2>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {t.problem.items.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <article className="sica-lift group h-full rounded-2xl border border-slate-200 bg-white p-6 hover:border-velzon-primary/30 hover:shadow-xl hover:shadow-slate-900/5">
                  <span className="inline-flex transition-transform duration-300 group-hover:scale-110">
                    <IconTile Icon={PROBLEM_ICONS[i] ?? GraduationCap} tone="bg-velzon-primary-light text-velzon-primary" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATALOG (19 modul, filter per peran) ─────────────────────────── */}
      <section id="modul" className="scroll-mt-20 border-y border-slate-200 bg-sica-canvas py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-velzon-primary">{t.catalog.eyebrow}</span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">{t.catalog.title}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">{t.catalog.subtitle}</p>
          </Reveal>
          <div className="mt-12">
            <ModuleCatalog copy={{ ...t.catalog, coreLabel: t.modules.coreLabel, addonLabel: t.modules.addonLabel }} />
          </div>
        </div>
      </section>

      {/* ── BENCHMARK ────────────────────────────────────────────────────── */}
      <section id="benchmark" className="scroll-mt-20 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-velzon-primary">{t.benchmark.eyebrow}</span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">{t.benchmark.title}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">{t.benchmark.subtitle}</p>
          </Reveal>
          <div className="mt-12">
            <BenchmarkSection copy={t.benchmark} />
          </div>
        </div>
      </section>

      {/* ── DEEP DIVE: KRS & PRESENSI ────────────────────────────────────── */}
      <section id="alur" className="scroll-mt-20 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl space-y-16 px-5 lg:space-y-24 lg:px-8">
          {[
            { data: t.deepdive.krs, Icon: Workflow, accent: 'text-velzon-primary', bg: 'bg-velzon-primary-light', bar: 'from-velzon-primary to-velzon-info' },
            { data: t.deepdive.attendance, Icon: MapPin, accent: 'text-velzon-success', bg: 'bg-velzon-success/10', bar: 'from-velzon-success to-velzon-info' },
          ].map(({ data, Icon, accent, bg, bar }, sectionIdx) => (
            <div key={data.title} className={`grid items-center gap-10 lg:grid-cols-2 ${sectionIdx % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <Reveal variant={sectionIdx % 2 ? 'right' : 'left'}>
                <span className={`inline-flex items-center gap-2 rounded-full ${bg} px-3 py-1.5 text-xs font-bold ${accent}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {data.eyebrow}
                </span>
                <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{data.title}</h2>
                <ol className="mt-8 space-y-6">
                  {data.steps.map((s, idx) => (
                    <li key={s.title} className="relative flex gap-4">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${bar} text-xs font-bold text-white shadow-sm`}>
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{s.title}</div>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Reveal>

              <Reveal variant="in" delay={120} className="relative">
                <div className="absolute -inset-3 -z-10 rounded-3xl bg-gradient-to-tr from-slate-100 to-slate-50" />
                <div className="sica-float rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5">
                  {sectionIdx === 0 ? <KrsVisual /> : <AttendanceVisual />}
                </div>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ── ROLES ────────────────────────────────────────────────────────── */}
      <section id="peran" className="scroll-mt-20 border-y border-slate-200 bg-sica-canvas py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-velzon-primary">{t.roles.eyebrow}</span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">{t.roles.title}</h2>
          </Reveal>
          <Reveal delay={120} className="mx-auto mt-12 max-w-5xl">
            <RoleTabs tabs={t.roles.tabs} />
          </Reveal>
        </div>
      </section>

      {/* ── SECURITY ─────────────────────────────────────────────────────── */}
      <section id="keamanan" className="scroll-mt-20 bg-slate-900 py-16 text-slate-300 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-velzon-info">{t.security.eyebrow}</span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">{t.security.title}</h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.security.items.map((s, i) => (
              <Reveal key={s.title} delay={(i % 3) * 90}>
                <article className="sica-lift h-full rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-velzon-info/40 hover:bg-white/[0.08]">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-velzon-info/15 text-velzon-info">
                    {React.createElement(SECURITY_ICONS[i] ?? ShieldCheck, { className: 'h-5 w-5' })}
                  </span>
                  <h3 className="mt-4 text-[15px] font-bold text-white">{s.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{s.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS ─────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-velzon-primary">{t.integrations.eyebrow}</span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">{t.integrations.title}</h2>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.integrations.items.map((it, i) => {
              const Icon = INTEGRATION_ICONS[i] ?? Globe;
              return (
                <Reveal key={it.title} delay={(i % 3) * 80}>
                  <article className="sica-lift flex h-full gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-velzon-primary/30 hover:shadow-lg hover:shadow-slate-900/5">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{it.title}</h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{it.desc}</p>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section id="harga" className="scroll-mt-20 border-y border-slate-200 bg-sica-canvas py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-velzon-primary">{t.pricing.eyebrow}</span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">{t.pricing.title}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">{t.pricing.subtitle}</p>
          </Reveal>
          <div className="mt-12 grid items-start gap-6 lg:grid-cols-3">
            {t.pricing.plans.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 110}>
              <article
                className={`sica-lift relative h-full rounded-2xl border bg-white p-6 sm:p-7 ${
                  plan.featured ? 'border-velzon-primary shadow-xl shadow-velzon-primary/10 lg:-mt-4 lg:pb-10' : 'border-slate-200 shadow-sm'
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-velzon-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                    <Star className="h-3 w-3" />
                    Paling dipilih
                  </span>
                )}
                <div className="flex items-center gap-2 text-slate-500">
                  {plan.featured ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">{plan.name}</h3>
                </div>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900">{plan.price}</span>
                  <span className="text-xs font-medium text-slate-500">
                    {plan.price.startsWith('Rp') || plan.price.startsWith('IDR') ? t.pricing.annualNote : ''}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{plan.desc}</p>
                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-velzon-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#cta"
                  className={`mt-7 flex h-11 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                    plan.featured
                      ? 'bg-velzon-primary text-white hover:bg-velzon-primary-hover'
                      : 'border border-slate-300 text-slate-700 hover:border-velzon-primary/50 hover:text-velzon-primary'
                  }`}
                >
                  {plan.cta}
                </a>
              </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-velzon-primary">{t.testimonials.eyebrow}</span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">{t.testimonials.title}</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {t.testimonials.items.map((q, i) => (
              <Reveal key={q.name} delay={i * 100}>
                <figure className="sica-lift flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg hover:shadow-slate-900/5">
                  <Quote className="h-6 w-6 text-velzon-primary/25" />
                  <blockquote className="mt-3 flex-1 text-[15px] font-medium leading-relaxed text-slate-800">“{q.quote}”</blockquote>
                  <figcaption className="mt-5 border-t border-slate-100 pt-4">
                    <div className="text-sm font-bold text-slate-900">{q.name}</div>
                    <div className="text-xs text-slate-500">{q.org}</div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-slate-400">{t.testimonials.disclaimer}</p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-20 border-t border-slate-200 bg-sica-canvas py-16 lg:py-24">
        <div className="mx-auto max-w-4xl px-5 lg:px-8">
          <Reveal className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-velzon-primary">{t.faq.eyebrow}</span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">{t.faq.title}</h2>
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <FaqAccordion items={t.faq.items} />
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section id="cta" className="scroll-mt-20 px-5 py-16 lg:px-8 lg:py-24">
        <Reveal variant="in" className="relative mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-velzon-primary via-[#2f6ad8] to-velzon-secondary px-6 py-14 text-center shadow-2xl shadow-velzon-primary/25 sm:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(50% 60% at 80% 10%, #ffffff 0%, transparent 60%)' }}
          />
          <h2 className="relative text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">{t.cta.title}</h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-blue-50">{t.cta.subtitle}</p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="mailto:halo@sica.ac.id?subject=Permintaan%20Demo%20SICA"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-7 text-sm font-bold text-velzon-primary shadow-lg transition-transform hover:-translate-y-0.5"
            >
              <Headset className="h-4 w-4" />
              {t.cta.primary}
            </a>
            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/40 px-7 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {t.cta.secondary}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="relative mt-6 text-xs text-blue-100/80">{t.footer.contactNote}</p>
        </div>
        </Reveal>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div>
              <SicaBrand height={44} />
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-slate-600">{t.footer.tagline}</p>
              <div className="mt-5 flex items-center gap-3 text-slate-400">
                <Mail className="h-4 w-4" />
                <span className="text-xs font-medium">halo@sica.ac.id</span>
              </div>
            </div>

            {[
              { title: t.footer.product, links: t.footer.productLinks },
              { title: t.footer.company, links: t.footer.companyLinks },
              { title: t.footer.resources, links: t.footer.resourceLinks },
              { title: t.footer.legal, links: t.footer.legalLinks },
            ].map((col) => (
              <div key={col.title}>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-900">{col.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((label) => (
                    <li key={label}>
                      <span className="cursor-default text-[13px] text-slate-600 transition-colors hover:text-velzon-primary">{label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row">
            <div>© 2026 PT SICA Solusi Akademik Indonesia. {t.footer.copyright}</div>
            <div className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-velzon-success" />
              <span>SICA v1.0 Enterprise</span>
              <Timer className="ml-2 h-3.5 w-3.5 text-slate-400" />
              <span>Uptime target 99,9%</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Visual ringkasan kuota KRS untuk deep-dive section. */
function KrsVisual() {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
        <span>Kuota SKS Semester Aktif</span>
        <span className="text-velzon-primary">12 / 24 SKS</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-velzon-primary to-velzon-info" style={{ width: '50%' }} />
      </div>
      <div className="mt-5 space-y-2.5">
        {[
          { code: 'IF3201', name: 'Rekayasa Perangkat Lunak Lanjut', sks: 3, ok: true },
          { code: 'IF3204', name: 'Basis Data Terdistribusi', sks: 3, ok: true },
          { code: 'IF3208', name: 'Keamanan Siber & Kriptografi', sks: 3, ok: true },
          { code: 'IF3210', name: 'Machine Learning Terapan', sks: 3, ok: true },
        ].map((r) => (
          <div key={r.code} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold text-slate-800">
                {r.code} · {r.name}
              </div>
              <div className="text-[11px] text-slate-500">{r.sks} SKS · Senin 08:00</div>
            </div>
            <span className="shrink-0 rounded-md bg-velzon-success/10 px-2 py-1 text-[10px] font-bold text-velzon-success">
              {r.ok ? 'TIDAK BENTROK' : 'BENTROK'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Visual verifikasi presensi QR untuk deep-dive section. */
function AttendanceVisual() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-slate-500">Sesi IF3204 · Pertemuan 5</div>
        <span className="inline-flex items-center gap-1 rounded-full bg-velzon-success/10 px-2.5 py-1 text-[10px] font-bold text-velzon-success">
          <Timer className="h-3 w-3" />
          18 dtk lagi
        </span>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="grid h-24 w-24 shrink-0 grid-cols-4 grid-rows-4 gap-1 rounded-xl border border-slate-200 bg-white p-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className={`rounded-[2px] ${[0, 1, 3, 4, 6, 9, 10, 12, 15].includes(i) ? 'bg-slate-900' : 'bg-slate-100'}`} />
          ))}
        </div>
        <div className="space-y-2 text-[12px]">
          {[
            { label: 'Tanda tangan HMAC', ok: true },
            { label: 'Masa berlaku QR', ok: true },
            { label: 'Geofencing 50 m', ok: true },
            { label: 'Mock location', ok: false },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${row.ok ? 'bg-velzon-success/15 text-velzon-success' : 'bg-velzon-danger/15 text-velzon-danger'}`}>
                {row.ok ? '✓' : '×'}
              </span>
              <span className={row.ok ? 'font-medium text-slate-700' : 'font-medium text-velzon-danger'}>{row.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span>Jarak ke ruang kelas</span>
          <span className="text-velzon-success">12 m / maks 50 m</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-velzon-success" style={{ width: '24%' }} />
        </div>
      </div>
    </div>
  );
}
