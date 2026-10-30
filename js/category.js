
const category = document.body.dataset.category;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function categoryLabel(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function categoryLabels(values) {
  return values.map(categoryLabel).join(" · ");
}

function safeAttachmentUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function attachmentMarkup(post, typeFilter = null) {
  const attachments = Array.isArray(post.attachments)
    ? post.attachments
    : post.attachment_url ? [{ type: post.attachment_type || "link", url: post.attachment_url }] : [];
  return attachments.filter(attachment => !typeFilter || attachment.type === typeFilter).map(attachment => {
    const url = safeAttachmentUrl(attachment.url);
    if (!url) return "";
    if (attachment.type === "image") return `<figure class="post-attachment"><img src="${escapeHTML(url)}" alt="Attached process image" loading="lazy"></figure>`;
    if (attachment.type === "video") return `<figure class="post-attachment"><video controls preload="metadata" src="${escapeHTML(url)}"></video></figure>`;
    return `<p class="post-attachment"><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(attachment.name || "OPEN ATTACHED LINK")} ↗</a></p>`;
  }).join("");
}

function linkAttachmentsMarkup(post) {
  const markup = attachmentMarkup(post, "link");
  return markup ? `<section class="article-links"><span class="eyebrow">LINKS</span>${markup}</section>` : "";
}

function mediaAttachmentsMarkup(post) {
  const attachments = Array.isArray(post.attachments)
    ? post.attachments
    : post.attachment_url ? [{ type: post.attachment_type || "link", url: post.attachment_url }] : [];
  return attachments
    .filter(attachment => attachment.type === "image" || attachment.type === "video")
    .map(attachment => {
      const url = safeAttachmentUrl(attachment.url);
      if (!url) return "";
      return attachment.type === "image"
        ? `<figure class="post-attachment"><img src="${escapeHTML(url)}" alt="Attached process image" loading="lazy"></figure>`
        : `<figure class="post-attachment"><video controls preload="metadata" src="${escapeHTML(url)}"></video></figure>`;
    }).join("");
}

function authorMarkup(post) {
  const name = post.author_name || "Devine thesis team";
  const initials = name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  const avatar = post.author_avatar && /^https:\/\//i.test(post.author_avatar)
    ? `<img src="${escapeHTML(post.author_avatar)}" alt="" class="avatar-image">`
    : `<span class="avatar-initials">${escapeHTML(initials)}</span>`;

  return `<span class="author"><span class="avatar">${avatar}</span><span>${escapeHTML(name)}</span></span>`;
}

async function renderCategory() {
  const container = document.getElementById("category-posts");
  if (!container) return;

  let posts;
  try {
    posts = (await window.fieldnotesData.getPosts())
      .filter(post => post.category.includes(category));
  } catch {
    container.innerHTML = `<p class="empty-state">The archive is temporarily unavailable.</p>`;
    return;
  }

  const count = document.getElementById("post-count");
  if (count) {
    count.textContent = `${String(posts.length).padStart(2, "0")} NOTES`;
  }

  if (!posts.length) {
    container.innerHTML = `
      <p class="empty-state">
        No notes have been published here yet.
      </p>`;
    return;
  }

  container.innerHTML = posts.map(post => `
    <a class="latest-card" href="article.html?id=${encodeURIComponent(post.id)}">
      <span class="note-tag">${escapeHTML(categoryLabels(post.category))} / ${formatDate(post.date)}</span>
      <h3>${escapeHTML(post.title)}</h3>
      <p>${escapeHTML(post.body.slice(0, 140))}${post.body.length > 140 ? "…" : ""}</p>
      <span class="note-footer">${authorMarkup(post)}<span class="read-more">READ NOTE ↗</span></span>
    </a>
  `).join("");

  if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.from(".latest-card", {
      opacity: 0,
      y: 25,
      stagger: 0.1,
      duration: 0.6,
      ease: "power3.out"
    });
  }
}

async function renderArticle() {
  const container = document.getElementById("article-content");
  if (!container) return;

  const id = new URLSearchParams(window.location.search).get("id");
  let post;
  try {
    post = (await window.fieldnotesData.getPosts()).find(item => String(item.id) === id);
  } catch {
    container.innerHTML = `<p class="empty-state">The archive is temporarily unavailable.</p>`;
    return;
  }

  if (!post) {
    container.innerHTML = `
      <p class="eyebrow">404 / NOTE NOT FOUND</p>
      <h1>This note went missing.</h1>
      <a class="nav-link" href="index.html">← BACK TO THE ARCHIVE</a>
    `;
    return;
  }

  document.title = `${post.title} — Devine thesis`;

  const backLink = document.getElementById("back-link");
  if (backLink) backLink.href = `${post.category[0] || "ux"}.html`;

  container.innerHTML = `
    <p class="eyebrow note-heading"><span class="note-icon" aria-hidden="true"></span>PROCESS BLOG / ${escapeHTML(categoryLabels(post.category))}</p>
    <p class="article-date">${formatDate(post.date)} · ${escapeHTML(categoryLabels(post.category))}</p>
    <div class="article-author">${authorMarkup(post)}</div>
    <h1>${escapeHTML(post.title)}</h1>
    <div class="article-body">${escapeHTML(post.body)}</div>
    ${mediaAttachmentsMarkup(post)}
    ${post.conclusion ? `<aside class="article-takeaway"><span class="takeaway-icon" aria-hidden="true"></span><div class="takeaway-copy"><span class="eyebrow">KEY TAKEAWAY</span><p>${escapeHTML(post.conclusion)}</p></div></aside>` : ""}
    ${post.ai_usage ? `<aside class="article-ai"><span class="ai-icon" aria-hidden="true">✦</span><div><span class="eyebrow">AI USE</span><p>${escapeHTML(post.ai_usage)}</p></div></aside>` : ""}
    ${linkAttachmentsMarkup(post)}
  `;

  if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.from("#article-content > *", {
      opacity: 0,
      y: 20,
      stagger: 0.12,
      duration: 0.7,
      ease: "power3.out"
    });
  }
}

renderCategory();
renderArticle();
