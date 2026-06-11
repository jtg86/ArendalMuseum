// HTML-overlay for nærstudie av et bilde: høyoppløst 1200px-fil + metadata.
export class Overlay {
  constructor(categories, periods) {
    this.el = document.getElementById('overlay');
    this.img = document.getElementById('overlay-img');
    this.title = document.getElementById('overlay-title');
    this.meta = document.getElementById('overlay-meta');
    this.category = document.getElementById('overlay-category');
    this.link = document.getElementById('overlay-link');
    this.closeBtn = document.getElementById('overlay-close');
    this.catLabels = new Map(categories.map((c) => [c.id, c.label]));
    this.periodLabels = new Map(periods.map((p) => [p.id, p.label]));
    this.isOpen = false;
    this.onClose = null; // settes av main.js — kalles fra klikk-handleren (kan re-locke peker)

    this.closeBtn.addEventListener('click', () => this.close(true));
  }

  open(item) {
    this.img.src = item.src;
    this.img.alt = item.title;
    this.title.textContent = item.title;
    this.meta.textContent = `${item.year} · ${item.creator}`;
    this.category.textContent = `${this.catLabels.get(item.category) ?? ''} · ${this.periodLabels.get(item.period) ?? ''}`;
    this.link.href = item.nbUrl;
    this.el.classList.remove('hidden');
    this.isOpen = true;
  }

  // fromClick: true når lukkingen skjer i en klikk-handler, slik at
  // pekerlåsen kan gjenopprettes direkte (nettleserkrav).
  close(fromClick) {
    this.el.classList.add('hidden');
    this.img.src = '';
    this.isOpen = false;
    if (this.onClose) this.onClose(fromClick);
  }
}
