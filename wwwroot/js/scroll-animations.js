(function() {
  const selectors = [
    '.section',
    '.platform-card',
    '.announcement-card',
    '.dining-menu-card',
    '.notification-item',
    '.card',
    '.content-section',
    '.health-card',
    '.holiday-card',
    '.table'
  ];

  function decorateTargets() {
    const nodes = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))];
    nodes.forEach((element, index) => {
      element.classList.add('reveal-on-scroll');
      element.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 70}ms`);
    });
    return nodes;
  }

  function initObserver() {
    const targets = decorateTargets();
    if (!('IntersectionObserver' in window)) {
      targets.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });

    targets.forEach((target) => observer.observe(target));
  }

  document.addEventListener('DOMContentLoaded', initObserver);
})();
