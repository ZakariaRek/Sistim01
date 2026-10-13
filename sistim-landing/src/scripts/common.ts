// Small DOM wiring shared by every page (landing and consultation).

// Email: rebuilt at runtime from a reversed base64 string (light anti-scraping)
export function decodeEmail(encoded: string) {
  try { return [...atob(encoded)].reverse().join(''); } catch { return ''; }
}
document.querySelectorAll<HTMLAnchorElement>('a[data-eml]').forEach((a) => {
  const email = decodeEmail(a.dataset.eml || '');
  if (!email) return;
  a.href = `mailto:${email}`;
  a.querySelectorAll('[data-eml-text]').forEach((el) => (el.textContent = email));
});

// Language memory: a manual switch always wins over device detection on "/"
document.querySelectorAll<HTMLAnchorElement>('a[data-lang-link]').forEach((a) => {
  a.addEventListener('click', () => {
    try { localStorage.setItem('sistim-lang', a.dataset.langLink || 'en'); } catch {}
  });
});
