
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
    <a class="latest-card" href="article.html?${post.is_draft ? `draft=${encodeURIComponent(post.id)}` : `id=${encodeURIComponent(post.id)}`}">
      <span class="note-tag">${post.is_draft ? "TEAM DRAFT / " : ""}${escapeHTML(categoryLabels(post.category))} / ${formatDate(post.date)}</span>
      <h3>${escapeHTML(post.title)}</h3>
      <p>${escapeHTML(richTextPlainText(post.body).slice(0, 140))}${richTextPlainText(post.body).length > 140 ? "…" : ""}</p>
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

  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const draftId = searchParams.get("draft");
  let post;
  let isDraft = false;
  let canEdit = false;
  try {
    post = draftId
      ? await window.fieldnotesData.getDraft(draftId)
      : (await window.fieldnotesData.getPosts()).find(item => String(item.id) === id);
    isDraft = Boolean(draftId && post);
    const session = await window.fieldnotesData.getSession();
    canEdit = Boolean(session?.user?.id && !isDraft && session.user.id === post.author_id);
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
  if (backLink) backLink.href = isDraft ? "team.html" : `${post.category[0] || "ux"}.html`;

  container.innerHTML = `
    <p class="eyebrow note-heading"><span class="note-icon" aria-hidden="true"></span>${isDraft ? "DRAFT / TEAM ONLY" : `PROCESS BLOG / ${escapeHTML(categoryLabels(post.category))}`}</p>
    <p class="article-date">${formatDate(post.date || post.updated_at)} · ${escapeHTML(categoryLabels(post.category))}</p>
    <div class="article-author">${authorMarkup(post)}</div>
    <h1>${escapeHTML(post.title)}</h1>
    ${isDraft ? `<div class="article-draft-banner"><span>This draft is only visible to logged-in team members.</span><button id="publish-draft-button" class="submit-button" type="button">PUBLISH DRAFT <span>↗</span></button><p id="draft-message" class="form-message" aria-live="polite"></p></div>` : ""}
    ${canEdit ? `<div class="article-edit-actions"><button id="edit-post-button" class="text-button" type="button">EDIT POST</button></div><form id="article-edit-form" class="article-edit-form" hidden>
      <label for="edit-post-title">TITLE</label>
      <input id="edit-post-title" type="text" maxlength="80" required value="${escapeHTML(post.title)}">
      <label for="edit-post-body">YOUR NOTE</label>
      <div class="rich-text-editor-wrap article-rich-text-editor-wrap">
        <div class="rich-text-toolbar article-rich-text-toolbar" aria-label="Text formatting"><button type="button" data-command="clearHighlight" aria-label="Remove highlight">×</button><button type="button" data-command="formatBlock" data-value="h1">H1</button><button type="button" data-command="formatBlock" data-value="h2">H2</button><button type="button" data-command="formatBlock" data-value="h3">H3</button><button type="button" data-command="formatBlock" data-value="h4">H4</button><button type="button" data-command="bold"><strong>B</strong></button><button type="button" data-command="italic"><em>I</em></button><button type="button" data-command="underline"><u>U</u></button><span class="toolbar-divider"></span><button type="button" class="highlight-yellow" data-command="hiliteColor" data-value="#fff176">●</button><button type="button" class="highlight-pink" data-command="hiliteColor" data-value="#f1a7c5">●</button><button type="button" class="highlight-blue" data-command="hiliteColor" data-value="#8ed8ff">●</button><button type="button" class="highlight-green" data-command="hiliteColor" data-value="#d8f36a">●</button></div>
        <div id="edit-post-body" class="rich-text-editor" contenteditable="true" role="textbox" aria-multiline="true">${sanitizeRichText(post.body)}</div>
      </div>
      <label for="edit-post-conclusion">KEY TAKEAWAY <span class="optional">(optional)</span></label>
      <textarea id="edit-post-conclusion" rows="5" maxlength="500">${escapeHTML(post.conclusion || "")}</textarea>
      <label for="edit-post-ai">AI USE <span class="optional">(optional)</span></label>
      <textarea id="edit-post-ai" rows="4" maxlength="500">${escapeHTML(post.ai_usage || "")}</textarea>
      <div class="article-edit-form-actions"><button class="submit-button" type="submit">SAVE CHANGES <span>↗</span></button><button id="cancel-post-edit-button" class="text-button" type="button">CANCEL</button></div>
      <p id="post-edit-message" class="form-message" aria-live="polite"></p>
    </form>` : ""}
    <div class="article-body">${sanitizeRichText(post.body)}</div>
    ${mediaAttachmentsMarkup(post)}
    ${post.conclusion ? `<aside class="article-takeaway"><span class="takeaway-icon" aria-hidden="true"></span><div class="takeaway-copy"><span class="eyebrow">KEY TAKEAWAY</span><p>${escapeHTML(post.conclusion)}</p></div></aside>` : ""}
    ${post.ai_usage ? `<aside class="article-ai"><span class="ai-icon" aria-hidden="true">✦</span><div><span class="eyebrow">AI USE</span><p>${escapeHTML(post.ai_usage)}</p></div></aside>` : ""}
    ${linkAttachmentsMarkup(post)}
  `;

  if (canEdit) {
    const editButton = document.getElementById("edit-post-button");
    const editForm = document.getElementById("article-edit-form");
    const editMessage = document.getElementById("post-edit-message");
    const editBody = document.getElementById("edit-post-body");
    setupRichTextToolbar(document.querySelector(".article-rich-text-toolbar"), editBody);
    editButton.addEventListener("click", () => {
      editForm.hidden = false;
      editButton.hidden = true;
      editForm.querySelector("input").focus();
    });
    document.getElementById("cancel-post-edit-button").addEventListener("click", () => {
      editForm.hidden = true;
      editButton.hidden = false;
    });
    editForm.addEventListener("submit", async event => {
      event.preventDefault();
      const saveButton = editForm.querySelector("button[type=submit]");
      saveButton.disabled = true;
      editMessage.textContent = "Saving changes...";
      try {
        await window.fieldnotesData.updatePost(post.id, {
          title: document.getElementById("edit-post-title").value.trim(),
          body: sanitizeRichText(editBody.innerHTML).trim(),
          conclusion: document.getElementById("edit-post-conclusion").value.trim() || null,
          ai_usage: document.getElementById("edit-post-ai").value.trim() || null
        });
        window.location.reload();
      } catch (error) {
        saveButton.disabled = false;
        editMessage.textContent = `Could not save changes: ${error.message}`;
        console.error("Editing published post failed", error);
      }
    });
  }

  if (isDraft) {
    document.getElementById("publish-draft-button").addEventListener("click", async event => {
      const button = event.currentTarget;
      const message = document.getElementById("draft-message");
      button.disabled = true;
      message.textContent = "Publishing...";
      try {
        const publishedPost = await window.fieldnotesData.publishDraft(post.id);
        window.location.href = `article.html?id=${encodeURIComponent(publishedPost.id)}`;
      } catch (error) {
        button.disabled = false;
        message.textContent = `Could not publish the draft: ${error.message}`;
        console.error("Publishing draft from article failed", error);
      }
    });
  }

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
