import { loadTheme, saveTheme } from './storage.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');
let chosen = null;

export function preference() {
  const saved = chosen ?? loadTheme();
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

export const effective = () => {
  const choice = preference();
  return choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
};

function apply(choice) {
  if (choice === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
}

export function setTheme(choice) {
  chosen = choice;
  saveTheme(choice);
  if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(() => apply(choice));
  } else {
    apply(choice);
  }
}

export const toggleTheme = () => setTheme(effective() === 'dark' ? 'light' : 'dark');

export const onSystemChange = listener => media.addEventListener('change', listener);
