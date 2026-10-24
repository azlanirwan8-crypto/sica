'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Pengalih tema = kosakata atribut Velzon (UI_UX_DESIGN §2.6), bukan kosakata lama.
 *
 * Empat knob ditulis ke `<html>`:
 *   data-bs-theme    light | dark
 *   data-topbar      light | dark   (gelap = pengganti mode "semi-dark" lama)
 *   data-layout      horizontal     (satu-satunya nilai yang hari ini nyata; `vertical`
 *                                    menunggu menu-as-data — ROADMAP UI-VLN-6)
 *   data-layout-style   default | gradient | separated
 *   data-layout-width   fluid | boxed
 *
 * Bentuk penyimpanan lama (`solid`/`minimal`/`semi-dark`) sengaja tidak dialihkan:
 * nilainya gagal validasi whitelist dan jatuh ke default — satu kali reset
 * preferensi, bukan dua kosakata yang hidup berdampingan.
 */
export type ThemeMode = 'light' | 'dark';
export type TopbarMode = 'light' | 'dark';
export type LayoutStyle = 'default' | 'gradient' | 'separated';
export type LayoutWidth = 'fluid' | 'boxed';

const STORAGE_KEY = 'sica.ui.theme';

export type ThemeState = {
  readonly mode: ThemeMode;
  readonly topbar: TopbarMode;
  readonly style: LayoutStyle;
  readonly width: LayoutWidth;
};

const DEFAULT_STATE: ThemeState = { mode: 'light', topbar: 'light', style: 'default', width: 'fluid' };

/**
 * Himpunan nilai yang sah — satu sumber untuk validasi penyimpanan DAN untuk
 * panel kustomiser. Label tidak ikut di sini: teks UI milik `locales/*.json`
 * (AGENTS §3.5), bukan milik kode.
 */
export const THEME_MODE_VALUES: readonly ThemeMode[] = ['light', 'dark'];
export const TOPBAR_VALUES: readonly TopbarMode[] = ['light', 'dark'];
export const LAYOUT_STYLE_VALUES: readonly LayoutStyle[] = ['default', 'gradient', 'separated'];
export const LAYOUT_WIDTH_VALUES: readonly LayoutWidth[] = ['fluid', 'boxed'];

const ThemeContext = React.createContext<{
  readonly state: ThemeState;
  readonly setMode: (mode: ThemeMode) => void;
  readonly setTopbar: (topbar: TopbarMode) => void;
  readonly setStyle: (style: LayoutStyle) => void;
  readonly setWidth: (width: LayoutWidth) => void;
}>({
  state: DEFAULT_STATE,
  setMode: () => undefined,
  setTopbar: () => undefined,
  setStyle: () => undefined,
  setWidth: () => undefined,
});

function write(state: ThemeState, appChrome: boolean) {
  const root = document.documentElement;
  root.setAttribute('data-bs-theme', state.mode);
  root.setAttribute('data-topbar', state.topbar);
  root.setAttribute('data-layout-style', state.style);
  root.setAttribute('data-layout-width', state.width);
  if (appChrome) root.setAttribute('data-layout', 'horizontal');
  else root.removeAttribute('data-layout');
}

/** Halaman pemasaran & autentikasi tidak membawa chrome aplikasi. */
const isPublicPath = (path: string) => path === '/' || path === '/login';

function pick<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

function read(raw: string | null): ThemeState {
  if (!raw) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<ThemeState>;
    return {
      mode: pick(parsed.mode, THEME_MODE_VALUES, DEFAULT_STATE.mode),
      topbar: pick(parsed.topbar, TOPBAR_VALUES, DEFAULT_STATE.topbar),
      style: pick(parsed.style, LAYOUT_STYLE_VALUES, DEFAULT_STATE.style),
      width: pick(parsed.width, LAYOUT_WIDTH_VALUES, DEFAULT_STATE.width),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function ThemeProvider({ children }: { readonly children: React.ReactNode }) {
  const [state, setState] = React.useState<ThemeState>(DEFAULT_STATE);
  const pathname = usePathname();

  React.useEffect(() => {
    if (isPublicPath(pathname)) {
      setState(DEFAULT_STATE);
      write(DEFAULT_STATE, false);
      return;
    }
    const next = read(window.localStorage.getItem(STORAGE_KEY));
    setState(next);
    write(next, true);
  }, [pathname]);

  const update = React.useCallback((patch: Partial<ThemeState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      write(next, !isPublicPath(window.location.pathname));
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage ditolak (mode privat) — preferensi tidak persisten, sesi tetap jalan
      }
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({
      state,
      setMode: (mode: ThemeMode) => update({ mode }),
      setTopbar: (topbar: TopbarMode) => update({ topbar }),
      setStyle: (style: LayoutStyle) => update({ style }),
      setWidth: (width: LayoutWidth) => update({ width }),
    }),
    [state, update],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): {
  readonly state: ThemeState;
  readonly setMode: (mode: ThemeMode) => void;
  readonly setTopbar: (topbar: TopbarMode) => void;
  readonly setStyle: (style: LayoutStyle) => void;
  readonly setWidth: (width: LayoutWidth) => void;
} {
  return React.useContext(ThemeContext);
}

/**
 * Tombol gelap/terang pada baris atas — padanan `dark-mode` switch Velzon.
 * Semua knob lain (baris atas, gaya latar, lebar halaman) hidup di satu tempat:
 * `components/layout/design-panel.tsx`. Membagi knob ke dua permukaan berarti
 * dua salinan UI untuk satu status; `useTheme()` tetap sumbernya.
 */
export function ThemeModeToggle({ className }: { readonly className?: string }) {
  const { state, setMode } = useTheme();
  const dict = getDictionary('id');
  const dark = state.mode === 'dark';

  return (
    <button
      type="button"
      className={cn('navbar-btn', className)}
      onClick={() => setMode(dark ? 'light' : 'dark')}
      aria-label={dict.app.themeLabel}
      aria-pressed={dark}
      title={dark ? dict.app.modeLight : dict.app.modeDark}
    >
      <i className={dark ? 'ri-sun-line text-lg' : 'ri-moon-line text-lg'} aria-hidden />
    </button>
  );
}

/**
 * Skrip pencegahan kedip tema; dipasang sebelum aset lain di <head>.
 * Nilai bawaannya HARUS sama dengan DEFAULT_STATE di atas — dua salinan karena
 * skrip ini berjalan sebelum React sempat mengeksekusi modulnya.
 */
export const themeInitScript = `(function(){try{var p=location.pathname==='/'||location.pathname==='/login';var s=JSON.parse(localStorage.getItem('${STORAGE_KEY}')||'{}');var r=document.documentElement;var m=['light','dark'].indexOf(s.mode)>=0?s.mode:'light';var t=['light','dark'].indexOf(s.topbar)>=0?s.topbar:'light';var l=['default','gradient','separated'].indexOf(s.style)>=0?s.style:'default';var w=['fluid','boxed'].indexOf(s.width)>=0?s.width:'fluid';if(p){m='light';t='light';l='default';w='fluid';r.removeAttribute('data-layout');}else{r.setAttribute('data-layout','horizontal');}r.setAttribute('data-bs-theme',m);r.setAttribute('data-topbar',t);r.setAttribute('data-layout-style',l);r.setAttribute('data-layout-width',w);}catch(e){var d=document.documentElement;d.setAttribute('data-bs-theme','light');d.setAttribute('data-topbar','light');d.setAttribute('data-layout-style','default');d.setAttribute('data-layout-width','fluid');}})();`;
