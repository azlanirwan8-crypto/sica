import idDict from '../locales/id.json';
import enDict from '../locales/en.json';

export type SupportedLocale = 'id' | 'en';

const dictionaries: Record<SupportedLocale, typeof idDict> = {
  id: idDict,
  en: enDict,
};

export function getDictionary(locale: SupportedLocale = 'id'): typeof idDict {
  return dictionaries[locale] ?? dictionaries.id;
}
