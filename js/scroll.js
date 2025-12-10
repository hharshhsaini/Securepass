/**
 * scroll.js - Smooth Scrolling & Scroll Animations
 * 
 * Handles:
 * - Smooth scroll for anchor links
 * - Scroll-triggered animations using IntersectionObserver
 * - Navigation active state updates
 * - Navbar scroll effects
 * - Parallax and interactive effects
 */

/**
 * Initialize scroll functionality
 */
export function initScroll() {
  setupSmoothScroll();
  setupScrollAnimations();
  setupNavHighlight();
  setupNavbarScroll();
  setupParallaxOrbs();
  setupCardMouseEffect();
}

/**
 * Set up smooth scrolling for anchor links
 */
function setupSmoothScroll() {
  // Handle all links with scroll-to class or hash links
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"], .scroll-to');
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    
    const target = document.querySelector(href);
    if (!target) return;
    
    event.preventDefault();
    
    // Calculate offset for fixed nav
    const navHeight = document.querySelector('.main-nav')?.offsetHeight || 0;
    const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;
    
    window.scrollTo({
      top: targetPosition,
      behavior: 'smooth'
    });
    
    // Update URL without jumping
    history.pushState(null, '', href);
  });
}

/**
 * Set up scroll-triggered animations using IntersectionObserver
 */
function setupScrollAnimations() {
  // Check if IntersectionObserver is supported
  if (!('IntersectionObserver' in window)) {
    // Fallback: show all elements immediately
    document.querySelectorAll('[data-animate]').forEach(el => {
      el.classList.add('in-view');
    });
    return;
  }
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          // Optionally unobserve after animation
          // observer.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      rootMargin: '0px 0px -100px 0px', // Trigger slightly before element is fully visible
      threshold: 0.1
    }
  );
  
  // Observe all elements with data-animate attribute
  document.querySelectorAll('[data-animate]').forEach(el => {
    observer.observe(el);
  });
  
  // Also observe cards in generator section
  document.querySelectorAll('.generator-section .card').forEach(el => {
    if (!el.hasAttribute('data-animate')) {
      el.setAttribute('data-animate', 'fade-up');
      observer.observe(el);
    }
  });
}

/**
 * Set up navigation highlight based on scroll position
 */
function setupNavHighlight() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  
  if (sections.length === 0 || navLinks.length === 0) return;
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          
          navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${id}`) {
              link.classList.add('active');
            }
          });
        }
      });
    },
    {
      root: null,
      rootMargin: '-50% 0px -50% 0px',
      threshold: 0
    }
  );
  
  sections.forEach(section => {
    observer.observe(section);
  });
}

/**
 * Scroll to a specific element
 * 
 * @param {string|HTMLElement} target - Selector or element
 * @param {number} offset - Additional offset in pixels
 */
export function scrollToElement(target, offset = 0) {
  const element = typeof target === 'string' 
    ? document.querySelector(target) 
    : target;
    
  if (!element) return;
  
  const navHeight = document.querySelector('.main-nav')?.offsetHeight || 0;
  const targetPosition = element.getBoundingClientRect().top + window.scrollY - navHeight - offset;
  
  window.scrollTo({
    top: targetPosition,
    behavior: 'smooth'
  });
}

/**
 * Setup navbar scroll effect - adds glass effect on scroll
 */
function setupNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  
  let ticking = false;
  
  const updateNavbar = () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    ticking = false;
  };
  
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateNavbar);
      ticking = true;
    }
  }, { passive: true });
  
  // Initial check
  updateNavbar();
}

/**
 * Setup parallax effect for floating orbs
 */
function setupParallaxOrbs() {
  const orbs = document.querySelectorAll('.orb');
  if (orbs.length === 0) return;
  
  let ticking = false;
  
  const updateOrbs = () => {
    const scrollY = window.scrollY;
    
    orbs.forEach((orb, index) => {
      const speed = 0.1 + (index * 0.05);
      const yOffset = scrollY * speed;
      orb.style.transform = `translateY(${yOffset}px)`;
    });
    
    ticking = false;
  };
  
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateOrbs);
      ticking = true;
    }
  }, { passive: true });
}

/**
 * Setup mouse tracking effect for feature cards
 */
function setupCardMouseEffect() {
  const cards = document.querySelectorAll('.feature-card');
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      card.style.setProperty('--mouse-x', `${x}%`);
      card.style.setProperty('--mouse-y', `${y}%`);
    });
  });
}
