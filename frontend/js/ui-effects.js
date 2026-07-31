(() => {
  const selector = [
    '.reveal-on-scroll',
    '.card',
    '.service-card',
    '.booking-card',
    '.stat-card',
    '.panel',
    '.admin-card',
    '.process-grid article',
    '.section-head',
    '.trust-banner',
    '.contact-layout',
    '.form-card'
  ].join(',');

  const revealTargets = [...new Set(document.querySelectorAll(selector))];

  revealTargets.forEach((element, index) => {
    element.classList.add('reveal-on-scroll');
    if (!element.style.transitionDelay) {
      element.style.transitionDelay = `${Math.min(index % 6, 5) * 70}ms`;
    }
  });

  const reveal = (element) => element.classList.add('revealed');

  if (!('IntersectionObserver' in window)) {
    revealTargets.forEach(reveal);
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          reveal(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px 80px 0px' });

    revealTargets.forEach((element) => observer.observe(element));

    // Prevent the interface from remaining invisible if an observer is delayed
    // or blocked by an older browser extension/cache state.
    window.setTimeout(() => {
      revealTargets.forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.top < window.innerHeight + 120) reveal(element);
      });
    }, 350);
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('.btn, button');
    if (!target || target.disabled) return;
    const rect = target.getBoundingClientRect();
    const wave = document.createElement('span');
    const diameter = Math.max(rect.width, rect.height);
    wave.className = 'ripple-wave';
    wave.style.width = wave.style.height = `${diameter}px`;
    wave.style.left = `${event.clientX - rect.left - diameter / 2}px`;
    wave.style.top = `${event.clientY - rect.top - diameter / 2}px`;
    target.appendChild(wave);
    window.setTimeout(() => wave.remove(), 700);
  });
})();
