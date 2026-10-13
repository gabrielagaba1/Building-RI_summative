const KEYS = {
  records: 'amafaranga:records',
  settings: 'amafaranga:settings',
  theme: 'amafaranga:theme'
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadRecords = () => read(KEYS.records, null);
export const saveRecords = records => write(KEYS.records, records);
export const loadSettings = () => read(KEYS.settings, null);
export const saveSettings = settings => write(KEYS.settings, settings);
export const loadTheme = () => read(KEYS.theme, 'system');
export const saveTheme = theme => write(KEYS.theme, theme);
