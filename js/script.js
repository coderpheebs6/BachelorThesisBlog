
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

function postCoverMarkup(post) {
  const image = normalizeAttachments(post).find(attachment => attachment.type === "image" && /^https:\/\//i.test(attachment.url || ""));
  const url = image?.url || richTextFirstImage(post.body);
  return url
    ? `<span class="card-cover"><img src="${escapeHTML(url)}" alt="" loading="lazy"></span>`
    : "";
}

function readingMinutes(post) {
  const words = richTextPlainText(post.body).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function renderHeroAvatars(posts) {
  const stack = document.getElementById("hero-avatars");
  if (!stack) return;
  const authors = new Map();
  posts.forEach(post => {
    const name = post.author_name;
    if (name && !authors.has(name)) authors.set(name, post);
  });
  if (!authors.size) return;
  stack.innerHTML = [...authors.values()].slice(0, 5).map(post => {
    const name = post.author_name;
    const initials = name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
    const content = post.author_avatar && /^https:\/\//i.test(post.author_avatar)
      ? `<img src="${escapeHTML(post.author_avatar)}" alt="" class="avatar-image">`
      : `<span class="avatar-initials">${escapeHTML(initials)}</span>`;
    return `<span class="avatar" title="${escapeHTML(name)}">${content}</span>`;
  }).join("");
}

const latestContainer = document.getElementById("latest-posts");
const backToTop = document.querySelector(".back-to-top");

backToTop?.addEventListener("click", event => {
  event.preventDefault();
  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
});

if (latestContainer) {
  window.fieldnotesData.getPosts().then(posts => {
    const latestPosts = posts.slice(0, 5);
    renderHeroAvatars(posts);
    document.querySelectorAll("[data-count]").forEach(counter => {
      const total = posts.filter(post => post.category.includes(counter.dataset.count)).length;
      counter.textContent = `${String(total).padStart(2, "0")} NOTES`;
    });

    if (latestPosts.length) {
      latestContainer.innerHTML = latestPosts.map(post => `
      <a class="latest-card" data-category="${escapeHTML(post.category[0] || "ux")}" href="article.html?${post.is_draft ? `draft=${encodeURIComponent(post.id)}` : `id=${encodeURIComponent(post.id)}`}">
        ${postCoverMarkup(post)}
        <span class="note-tag">${post.is_draft ? "TEAM DRAFT / " : ""}${escapeHTML(post.category.map(value => value.toUpperCase()).join(" · "))} / ${formatDate(post.date)}</span>
        <h3>${escapeHTML(post.title)}</h3>
        <p>${escapeHTML(richTextPlainText(post.body).slice(0, 140))}${richTextPlainText(post.body).length > 140 ? "…" : ""}</p>
        <span class="note-footer">${authorMarkup(post)}<span class="read-more">${readingMinutes(post)} MIN READ <span class="read-more-arrow">↗</span></span></span>
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

  const hero = document.querySelector(".hero");
  const cursorTags = [...document.querySelectorAll(".cursor-tag")];
  if (hero && cursorTags.length && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    // Each tag drifts toward the mouse (a different amount per tag) and its arrow tilts toward it.
    const strengths = [26, 38, 20];
    const tagBaseAngles = cursorTags.map(tag => tag.classList.contains("cursor-tag-design") ? -45 : -135);
    const movers = cursorTags.map((tag, index) => ({
      tag,
      strength: strengths[index] ?? 28,
      baseAngle: tagBaseAngles[index],
      x: gsap.quickTo(tag, "x", { duration: 0.9, ease: "power3.out" }),
      y: gsap.quickTo(tag, "y", { duration: 0.9, ease: "power3.out" })
    }));

    hero.addEventListener("pointermove", event => {
      const bounds = hero.getBoundingClientRect();
      const nx = (event.clientX - bounds.left) / bounds.width - 0.5;
      const ny = (event.clientY - bounds.top) / bounds.height - 0.5;
      movers.forEach(mover => {
        mover.x(nx * mover.strength * 2);
        mover.y(ny * mover.strength * 2);
        const rect = mover.tag.getBoundingClientRect();
        const angle = Math.atan2(event.clientY - rect.top, event.clientX - rect.left) * 180 / Math.PI;
        let tilt = angle - mover.baseAngle;
        tilt = ((tilt + 540) % 360) - 180;
        gsap.to(mover.tag, { "--tilt": `${gsap.utils.clamp(-28, 28, tilt)}deg`, duration: 0.6, ease: "power2.out", overwrite: "auto" });
      });
    });

    hero.addEventListener("pointerleave", () => {
      movers.forEach(mover => {
        mover.x(0);
        mover.y(0);
        gsap.to(mover.tag, { "--tilt": "0deg", duration: 0.8, ease: "power2.out", overwrite: "auto" });
      });
    });
  }

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
