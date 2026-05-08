const yearNode = document.querySelector("#year");

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

const revealNodes = document.querySelectorAll(".reveal");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (!prefersReducedMotion.matches) {
  document.body.classList.add("motion-ready");

  requestAnimationFrame(() => {
    revealNodes.forEach((node) => {
      node.classList.add("is-visible");
    });
  });
}
