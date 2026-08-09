// Applied to the live page by render.py and extract.py before any capture, so
// page numbers and the progress rail always follow the real slide order.
() => {
  const slides = [...document.querySelectorAll('section.slide')];
  slides.forEach((s, i) => {
    const pg = s.querySelector('.foot .pg');
    if (pg) pg.textContent = String(i + 1).padStart(2, '0');
    if (!s.querySelector('.prog')) {
      const bar = document.createElement('div');
      bar.className = 'prog';
      const fill = document.createElement('i');
      fill.style.width = ((i + 1) / slides.length * 100).toFixed(2) + '%';
      bar.appendChild(fill);
      s.appendChild(bar);
    }
  });
  return slides.length;
}
