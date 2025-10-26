document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelectorAll('a.transition-link');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      document.body.classList.add('page-transition', 'page-slide-exit-active');
      setTimeout(() => { window.location.href = href; }, 500);
    });
  });
});
