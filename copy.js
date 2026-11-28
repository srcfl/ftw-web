// Copy buttons on the text pages. Each copies the text of the element its data-copy names.
// The buttons start hidden, so a page without scripts shows only the text to select.
const sv = document.documentElement.lang === 'sv';
const words = sv ? { copy: 'Kopiera', done: 'Kopierat', select: 'Markera texten' } : { copy: 'Copy', done: 'Copied', select: 'Select it' };
document.querySelectorAll('button.copy[data-copy]').forEach(button => {
  button.hidden = false;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.querySelector(button.dataset.copy).textContent);
      button.textContent = words.done;
      button.classList.add('done');
    } catch {
      button.textContent = words.select;
    }
    setTimeout(() => { button.textContent = words.copy; button.classList.remove('done'); }, 1800);
  });
});
