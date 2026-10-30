
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function authorMarkup(post) {
  const name = post.author_name || "Devine thesis team";
  const initials = name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  const avatar = post.author_avatar && /^https:\/\//i.test(post.author_avatar)
    ? `<img src="${escapeHTML(post.author_avatar)}" alt="" class="avatar-image">`
    : `<span class="avatar-initials">${escapeHTML(initials)}</span>`;
  return `<span class="author"><span class="avatar">${avatar}</span><span>${escapeHTML(name)}</span></span>`;
}

const latestContainer = document.getElementById("latest-posts");
const backToTop = document.querySelector(".back-to-top");

backToTop?.addEventListener("click", event => {
  event.preventDefault();
  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
});

if (latestContainer) {
  window.fieldnotesData.getPosts().then(posts => {
    const latestPosts = posts.slice(0, 4);

    if (latestPosts.length) {
      latestContainer.innerHTML = latestPosts.map(post => `
      <a class="latest-card" href="article.html?id=${encodeURIComponent(post.id)}">
        <span class="note-tag">${escapeHTML(post.category.map(value => value.toUpperCase()).join(" · "))} / ${formatDate(post.date)}</span>
        <h3>${escapeHTML(post.title)}</h3>
        <p>${escapeHTML(post.body.slice(0, 140))}${post.body.length > 140 ? "…" : ""}</p>
        <span class="note-footer">${authorMarkup(post)}<span class="read-more">READ NOTE ↗</span></span>
      </a>
      `).join("");
    }
  }).catch(() => {
    latestContainer.innerHTML = `<p class="muted">The archive is temporarily unavailable.</p>`;
  });
}

if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  gsap.from(".navbar", {
    y: -20,
    opacity: 0,
    duration: 0.7,
    ease: "power3.out"
  });

  gsap.from(".hero-eyebrow", {
    opacity: 0,
    y: 15,
    delay: 0.15,
    duration: 0.6
  });

  gsap.from(".hero-title", {
    opacity: 0,
    y: 55,
    delay: 0.25,
    duration: 1,
    ease: "power4.out"
  });

  gsap.from(".hero-bottom", {
    opacity: 0,
    y: 25,
    delay: 0.55,
    duration: 0.8,
    ease: "power3.out"
  });

  gsap.from(".category-card", {
    opacity: 0,
    y: 45,
    stagger: 0.15,
    duration: 0.8,
    delay: 0.25,
    ease: "power3.out",
    clearProps: "transform"
  });

  gsap.from(".latest-section", {
    opacity: 0,
    y: 30,
    duration: 0.8,
    scrollTrigger: undefined,
    delay: 0.5,
    ease: "power2.out"
  });

  document.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("mouseenter", () => {
      gsap.to(card, {
        y: -7,
        duration: 0.25,
        ease: "power2.out"
      });
    });

    card.addEventListener("mouseleave", () => {
      gsap.to(card, {
        y: 0,
        duration: 0.35,
        ease: "power2.out"
      });
    });
  });
}
