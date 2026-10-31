const loginPanel = document.getElementById("login-panel");
const editorPanel = document.getElementById("editor-panel");
const loginForm = document.getElementById("login-form");
const teamForm = document.getElementById("team-form");
const loginMessage = document.getElementById("login-message");
const teamMessage = document.getElementById("team-message");
const teamPosts = document.getElementById("team-posts");
const teamDrafts = document.getElementById("team-drafts");
const profileForm = document.getElementById("profile-form");
const profileMessage = document.getElementById("profile-message");
const avatarPreview = document.getElementById("avatar-preview");
const profileCard = document.getElementById("profile-card");
const profileCardAvatar = document.getElementById("profile-card-avatar");
const profileCardName = document.getElementById("profile-card-name");
const editProfileButton = document.getElementById("edit-profile-button");
const deleteModal = document.getElementById("delete-modal");
const deleteModalMessage = document.getElementById("delete-modal-message");
const cancelDeleteButton = document.getElementById("cancel-delete-button");
const confirmDeleteButton = document.getElementById("confirm-delete-button");
const previewModal = document.getElementById("preview-modal");
const closePreviewButton = document.getElementById("close-preview-button");
const previewCategory = document.getElementById("preview-category");
const previewTitle = document.getElementById("preview-title");
const previewDate = document.getElementById("preview-date");
const previewBody = document.getElementById("preview-body");
const previewTakeaway = document.getElementById("preview-takeaway");
const previewAi = document.getElementById("preview-ai");
const noteFormLabel = document.getElementById("note-form-label");
const noteSubmitButton = document.getElementById("note-submit-button");
const categoryPicker = document.getElementById("category");
const categoryMessage = document.getElementById("category-message");
const attachmentList = document.getElementById("attachment-list");
const attachmentLinkInput = document.getElementById("attachment-link");
const attachmentLinkNameInput = document.getElementById("attachment-link-name");
const attachmentImagesInput = document.getElementById("attachment-images");
const attachmentVideosInput = document.getElementById("attachment-videos");
const cancelEditButton = document.getElementById("cancel-edit-button");
const teamChatMessages = document.getElementById("team-chat-messages");
const teamChatForm = document.getElementById("team-chat-form");
const teamChatInput = document.getElementById("team-chat-input");
const chatMessage = document.getElementById("chat-message");
const saveDraftButton = document.getElementById("save-draft-button");
const chatToggleButton = document.getElementById("chat-toggle-button");
const teamChatSection = document.getElementById("team-chat-section");
const closeChatButton = document.getElementById("close-chat-button");
const chatOverlay = document.getElementById("chat-overlay");
const chatCommandMenu = document.getElementById("chat-command-menu");
let pendingDeleteId = null;
let editingPostId = null;
let editingDraftId = null;
let unsubscribeChat = null;
let latestSeenChatMessage = null;
let hasLoadedChatMessages = false;
const ownPostsById = new Map();
const ownDraftsById = new Map();
let chatPosts = [];
let chatPostsLoaded = false;
let chatPostsLoading = null;
let chatPostsError = null;
let chatCommandSelection = 0;
let editingAttachments = [];

function getChatInputText() {
  return teamChatInput.textContent;
}

function getChatInputBeforeCaret() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return getChatInputText();
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(teamChatInput);
  range.setEnd(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset);
  return range.toString();
}

function serializeChatInput() {
  return [...teamChatInput.childNodes].map(node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType === Node.ELEMENT_NODE && node.matches(".chat-input-post-link")) {
      return `[[post:${node.dataset.postId}|${encodeURIComponent(node.textContent)}]]`;
    }
    return node.textContent;
  }).join("");
}

function renderChatText(message) {
  const escaped = escapeHTML(message);
  return escaped.replace(/\[\[post:([^|\]]+)\|([^\]]+)\]\]/g, (_, id, encodedTitle) => {
    let title = encodedTitle;
    try {
      title = decodeURIComponent(encodedTitle);
    } catch {
      title = encodedTitle;
    }
    return `<a class="chat-post-link" href="article.html?id=${encodeURIComponent(id)}">${escapeHTML(title)}</a>`;
  });
}

async function renderChatMessages(messages) {
  const session = await window.fieldnotesData.getSession();
  const currentUserId = session?.user?.id;
  teamChatMessages.innerHTML = messages.length
    ? messages.map(item => `
      <article class="team-chat-message${item.author_id === currentUserId ? " is-own-message" : ""}">
        <div class="team-chat-message-meta">
          <div class="team-chat-author">
            <span class="chat-avatar">${item.author_avatar && /^https:\/\//i.test(item.author_avatar)
              ? `<img src="${escapeHTML(item.author_avatar)}" alt="">`
              : escapeHTML(item.author_name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase())}</span>
            <strong>${escapeHTML(item.author_name)}</strong>
          </div>
          <time datetime="${escapeHTML(item.created_at)}">${formatChatTime(item.created_at)}</time>
        </div>
        <p class="team-chat-message-body">${renderChatText(item.message)}</p>
        ${item.author_id === currentUserId ? `
          <div class="team-chat-message-actions">
            <button class="chat-edit-button" data-id="${escapeHTML(item.id)}" type="button">EDIT</button>
            <button class="chat-delete-button" data-id="${escapeHTML(item.id)}" type="button">DELETE</button>
          </div>
        ` : ""}
      </article>
    `).join("")
    : `<p class="muted">No messages yet. Start the conversation.</p>`;
  teamChatMessages.scrollTop = teamChatMessages.scrollHeight;
}

function hideChatCommandMenu() {
  chatCommandMenu.hidden = true;
  chatCommandMenu.innerHTML = "";
  chatCommandSelection = 0;
}

function showChatCommandMenu(query) {
  const filteredPosts = chatPosts.filter(post =>
    post.title.toLowerCase().includes(query.toLowerCase())
  );
  chatCommandSelection = Math.min(chatCommandSelection, Math.max(filteredPosts.length - 1, 0));

  chatCommandMenu.innerHTML = filteredPosts.length
    ? filteredPosts.map((post, index) => `
      <button class="chat-command-item${index === chatCommandSelection ? " is-selected" : ""}" type="button" data-post-id="${escapeHTML(post.id)}">
        <span class="chat-command-icon">↗</span>
        <span><strong>${escapeHTML(post.title)}</strong><small>${escapeHTML(post.category.join(" · ").toUpperCase())} / POST</small></span>
      </button>
    `).join("")
    : `<p class="chat-command-empty">No posts found.</p>`;
  chatCommandMenu.hidden = false;
}

function getFilteredChatPosts(query) {
  return chatPosts.filter(post => post.title.toLowerCase().includes(query.toLowerCase()));
}

async function updateChatCommandMenu() {
  const beforeCursor = getChatInputBeforeCaret();
  const match = beforeCursor.match(/(?:^|\s)\/([^\s]*)$/);
  if (!match) {
    hideChatCommandMenu();
    return;
  }
  if (!chatPostsLoaded) {
    chatCommandMenu.hidden = false;
    chatCommandMenu.innerHTML = `<p class="chat-command-empty">Loading posts...</p>`;
    await loadChatPosts();
  }
  const currentBeforeCursor = getChatInputBeforeCaret();
  const currentMatch = currentBeforeCursor.match(/(?:^|\s)\/([^\s]*)$/);
  if (!currentMatch) return;
  if (chatPostsError) {
    chatCommandMenu.hidden = false;
    chatCommandMenu.innerHTML = `<p class="chat-command-empty">Could not load posts: ${escapeHTML(chatPostsError)}</p>`;
    return;
  }
  chatCommandSelection = 0;
  showChatCommandMenu(currentMatch[1]);
}

teamChatInput.addEventListener("input", updateChatCommandMenu);
teamChatInput.addEventListener("keydown", event => {
  if (event.key === "Escape") hideChatCommandMenu();
  if (chatCommandMenu.hidden) return;

  const beforeCursor = getChatInputBeforeCaret();
  const match = beforeCursor.match(/(?:^|\s)\/([^\s]*)$/);
  if (!match) return;
  const filteredPosts = getFilteredChatPosts(match[1]);
  if (!filteredPosts.length) return;

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    chatCommandSelection = (chatCommandSelection + direction + filteredPosts.length) % filteredPosts.length;
    showChatCommandMenu(match[1]);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    insertChatPostLink(filteredPosts[chatCommandSelection]);
  }
});

function insertChatPostLink(post) {
  if (!post) return;

  const beforeCursor = getChatInputBeforeCaret();
  const match = beforeCursor.match(/(?:^|\s)\/([^\s]*)$/);
  if (!match) return;
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const textNode = range.startContainer;
  const typedText = textNode.textContent.slice(0, range.startOffset);
  const slashIndex = typedText.lastIndexOf("/");
  const replacementRange = document.createRange();
  replacementRange.setStart(textNode, slashIndex);
  replacementRange.setEnd(textNode, range.startOffset);
  replacementRange.deleteContents();
  const link = document.createElement("a");
  link.className = "chat-input-post-link";
  link.dataset.postId = post.id;
  link.textContent = post.title;
  link.href = `article.html?id=${encodeURIComponent(post.id)}`;
  link.target = "_blank";
  link.rel = "noopener";
  replacementRange.insertNode(link);
  const space = document.createTextNode(" ");
  link.after(space);
  selection.removeAllRanges();
  const caret = document.createRange();
  caret.setStartAfter(space);
  caret.collapse(true);
  selection.addRange(caret);
  hideChatCommandMenu();
  teamChatInput.focus();
}

chatCommandMenu.addEventListener("click", event => {
  const button = event.target.closest(".chat-command-item");
  if (!button) return;
  insertChatPostLink(chatPosts.find(item => String(item.id) === button.dataset.postId));
});

teamChatMessages.addEventListener("click", async event => {
  const editButton = event.target.closest(".chat-edit-button");
  const deleteButton = event.target.closest(".chat-delete-button");
  const messageCard = event.target.closest(".team-chat-message");
  if (!messageCard) return;

  if (editButton) {
    const body = messageCard.querySelector(".team-chat-message-body");
    const currentMessage = body.textContent;
    const editor = document.createElement("textarea");
    editor.className = "team-chat-edit-input";
    editor.maxLength = 1000;
    editor.value = currentMessage;
    const actions = document.createElement("div");
    actions.className = "team-chat-edit-actions";
    actions.innerHTML = `<button class="chat-save-button" type="button">SAVE</button><button class="chat-cancel-button" type="button">CANCEL</button>`;
    body.replaceWith(editor);
    messageCard.querySelector(".team-chat-message-actions").replaceWith(actions);
    editor.focus();
    actions.addEventListener("click", async actionEvent => {
      if (actionEvent.target.closest(".chat-cancel-button")) {
        await renderChatMessagesFromDatabase();
        return;
      }
      if (!actionEvent.target.closest(".chat-save-button")) return;
      const message = editor.value.trim();
      if (!message) return;
      try {
        await window.fieldnotesData.updateChatMessage(editButton.dataset.id, message);
        await renderChatMessagesFromDatabase();
      } catch (error) {
        showMessage(chatMessage, `Could not edit message: ${error.message}`);
        console.error("Editing team chat message failed", error);
      }
    }, { once: true });
    return;
  }

  if (deleteButton && window.confirm("Delete this message?")) {
    try {
      await window.fieldnotesData.deleteChatMessage(deleteButton.dataset.id);
      await renderChatMessagesFromDatabase();
    } catch (error) {
      showMessage(chatMessage, `Could not delete message: ${error.message}`);
      console.error("Deleting team chat message failed", error);
    }
  }
});

async function renderChatMessagesFromDatabase() {
  try {
    const messages = await window.fieldnotesData.getChatMessages();
    const latestMessage = messages[messages.length - 1];
    const isChatOpen = teamChatSection.classList.contains("is-open");
    if (!hasLoadedChatMessages && latestMessage) latestSeenChatMessage = latestMessage.created_at;
    if (isChatOpen && latestMessage) latestSeenChatMessage = latestMessage.created_at;
    const hasUnread = hasLoadedChatMessages && !isChatOpen && latestMessage
      && latestMessage.created_at > latestSeenChatMessage;
    chatToggleButton.querySelector(".chat-unread-badge")?.classList.toggle("is-visible", Boolean(hasUnread));
    hasLoadedChatMessages = true;
    await renderChatMessages(messages);
  } catch (error) {
    teamChatMessages.innerHTML = `<p class="form-message">Could not load team messages: ${escapeHTML(error.message)}</p>`;
    console.error("Loading team chat failed", error);
  }

}

async function loadChatPosts() {
  if (chatPostsLoading) return chatPostsLoading;

  chatPostsLoading = (async () => {
    chatPostsError = null;
    try {
      chatPosts = (await window.fieldnotesData.getPosts())
        .sort((first, second) => new Date(second.date) - new Date(first.date));
      chatPostsLoaded = true;
    } catch (error) {
      chatPosts = [];
      chatPostsLoaded = false;
      chatPostsError = error.message;
      console.error("Loading posts for chat links failed", error);
    } finally {
      chatPostsLoading = null;
    }
  })();

  await chatPostsLoading;
}

function closeDeleteModal() {
  pendingDeleteId = null;
  deleteModal.classList.remove("is-open");
  deleteModal.setAttribute("aria-hidden", "true");
}

function openDeleteModal(post) {
  pendingDeleteId = post.id;
  deleteModalMessage.textContent = `"${post.title}" will be permanently removed from your published notes.`;
  deleteModal.classList.add("is-open");
  deleteModal.setAttribute("aria-hidden", "false");
  cancelDeleteButton.focus();
}

function closePreview() {
  previewModal.classList.remove("is-open");
  previewModal.setAttribute("aria-hidden", "true");
}

function openPreview(post) {
  previewCategory.textContent = `${post.category.join(" · ").toUpperCase()} / THESIS NOTE`;
  previewTitle.textContent = post.title;
  previewDate.textContent = formatDate(post.date);
  previewBody.textContent = post.body;
  const previewMedia = document.getElementById("preview-media");
  const mediaAttachments = getAttachments(post).filter(attachment => attachment.type === "image" || attachment.type === "video");
  previewMedia.innerHTML = renderAttachments({ attachments: mediaAttachments });
  previewMedia.hidden = !mediaAttachments.length;
  const previewLinks = document.getElementById("preview-links");
  const links = getAttachments(post).filter(attachment => attachment.type === "link");
  previewLinks.innerHTML = links.length
    ? `<span class="eyebrow">LINKS</span>${links.map(link => `
        <p class="post-attachment"><a href="${escapeHTML(safeAttachmentUrl(link.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.name || link.url)} ↗</a></p>
      `).join("")}`
    : "";
  previewLinks.hidden = !links.length;
  previewTakeaway.hidden = !post.conclusion;
  previewTakeaway.innerHTML = post.conclusion
    ? `<span class="takeaway-icon" aria-hidden="true"></span><div><strong>KEY TAKEAWAY</strong><p>${escapeHTML(post.conclusion)}</p></div>`
    : "";
  previewAi.hidden = !post.ai_usage;
  previewAi.innerHTML = post.ai_usage
    ? `<span class="ai-icon" aria-hidden="true">✦</span><div><span class="eyebrow">AI USE</span><p>${escapeHTML(post.ai_usage)}</p></div>`
    : "";
  previewModal.classList.add("is-open");
  previewModal.setAttribute("aria-hidden", "false");
  closePreviewButton.focus();
}

function showMessage(element, message) {
  element.textContent = message;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatChatTime(timestamp) {
  return new Date(timestamp).toLocaleString("nl-BE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function safeAttachmentUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function getAttachments(post) {
  if (Array.isArray(post.attachments)) return post.attachments;
  return post.attachment_url ? [{ type: post.attachment_type || "link", url: post.attachment_url }] : [];
}

function renderAttachments(post) {
  return getAttachments(post).map(attachment => {
    const url = safeAttachmentUrl(attachment.url);
    if (!url) return "";
    if (attachment.type === "image") {
      return `<figure class="post-attachment"><img src="${escapeHTML(url)}" alt="Attached process image" loading="lazy"></figure>`;
    }
    if (attachment.type === "video") {
      return `<figure class="post-attachment"><video controls preload="metadata" src="${escapeHTML(url)}"></video></figure>`;
    }
    return `<p class="post-attachment"><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">OPEN ATTACHED LINK ↗</a></p>`;
  }).join("");
}

function renderAttachmentList() {
  attachmentList.innerHTML = editingAttachments.map((attachment, index) => `
    <div class="attachment-item">
      <span>${escapeHTML(attachment.name || attachment.url)}</span>
      <small>${escapeHTML(attachment.type.toUpperCase())}</small>
      <button class="attachment-remove" type="button" data-attachment-index="${index}" aria-label="Remove attachment">REMOVE</button>
    </div>
  `).join("");
}

function getNoteFormValues() {
  return {
    category: [...categoryPicker.querySelectorAll(".category-option.is-selected")].map(button => button.dataset.category),
    title: document.getElementById("title").value.trim(),
    body: document.getElementById("body").value.trim(),
    conclusion: document.getElementById("conclusion").value.trim() || null,
    ai_usage: document.getElementById("ai-usage").value.trim() || null,
    attachments: [...editingAttachments],
    attachment_type: editingAttachments[0]?.type || null,
    attachment_url: editingAttachments[0]?.url || null
  };
}

function fillNoteForm(note) {
  editingAttachments = getAttachments(note);
  const categories = Array.isArray(note.category) ? note.category : [note.category || "ux"];
  categoryPicker.querySelectorAll(".category-option").forEach(button => {
    const selected = categories.includes(button.dataset.category);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.getElementById("title").value = note.title || "";
  document.getElementById("body").value = note.body || "";
  document.getElementById("conclusion").value = note.conclusion || "";
  document.getElementById("ai-usage").value = note.ai_usage || "";
  attachmentLinkInput.value = "";
  attachmentLinkNameInput.value = "";
  attachmentImagesInput.value = "";
  attachmentVideosInput.value = "";
  renderAttachmentList();
}

function resetCategoryPicker() {
  categoryPicker.querySelectorAll(".category-option").forEach(button => {
    const selected = button.dataset.category === "ux";
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  categoryMessage.textContent = "";
  editingAttachments = [];
  attachmentLinkNameInput.value = "";
  attachmentLinkInput.value = "";
  attachmentImagesInput.value = "";
  attachmentVideosInput.value = "";
  renderAttachmentList();
}

async function loadDraft() {
  try {
    const draft = (await window.fieldnotesData.getDrafts())[0];
    if (!draft) return;
    editingDraftId = draft.id;
    fillNoteForm(draft);
  } catch (error) {
    showMessage(teamMessage, `Could not load your draft: ${error.message}`);
    console.error("Loading draft failed", error);
  }
}

async function renderTeamDrafts() {
  try {
    const drafts = await window.fieldnotesData.getDrafts();
    ownDraftsById.clear();
    drafts.forEach(draft => ownDraftsById.set(String(draft.id), draft));
    teamDrafts.innerHTML = drafts.length
      ? drafts.map(draft => `
        <article class="team-post team-draft" data-id="${escapeHTML(draft.id)}">
          <div class="team-post-content">
            <div class="team-post-meta">
              <span class="team-post-category">${escapeHTML(draft.category.join(" · ").toUpperCase())}</span>
              <span class="team-post-status is-draft">DRAFT</span>
              <time>${formatDate(draft.updated_at)}</time>
            </div>
            <h2>${escapeHTML(draft.title || "Untitled draft")}</h2>
            <p class="team-post-excerpt">${escapeHTML(draft.body?.slice(0, 120) || "No note content yet.")}</p>
          </div>
          <div class="team-post-actions">
            <button class="text-button edit-team-draft" data-id="${escapeHTML(draft.id)}" type="button">EDIT</button>
            <button class="text-button delete-team-draft" data-id="${escapeHTML(draft.id)}" type="button">DELETE</button>
          </div>
        </article>
      `).join("")
      : `<p class="muted">You have no saved drafts yet.</p>`;
  } catch (error) {
    teamDrafts.innerHTML = `<p class="form-message">Could not load drafts: ${escapeHTML(error.message)}</p>`;
    console.error("Loading drafts failed", error);
  }
}

function renderProfile(profile) {
  const name = profile?.display_name || "";
  if (!name) {
    profileForm.hidden = false;
    profileCard.hidden = true;
    return;
  }

  const initials = name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  profileCardAvatar.innerHTML = profile.avatar_url
    ? `<img src="${escapeHTML(profile.avatar_url)}" alt="">`
    : `<span>${escapeHTML(initials)}</span>`;
  profileCardName.textContent = name;
  profileForm.hidden = true;
  profileCard.hidden = false;
}

async function renderTeamPosts() {
  try {
    const session = await window.fieldnotesData.getSession();
    if (!session) return;
    const posts = await window.fieldnotesData.getPosts();
    const ownPosts = posts.filter(post => post.author_id === session.user.id);
    ownPostsById.clear();
    ownPosts.forEach(post => ownPostsById.set(String(post.id), post));
    teamPosts.innerHTML = ownPosts.length
      ? ownPosts.map(post => `
        <article class="team-post" data-id="${escapeHTML(post.id)}">
          <div class="team-post-content" tabindex="0" role="button" aria-label="Preview ${escapeHTML(post.title)}">
            <div class="team-post-meta">
              <span class="team-post-category">${escapeHTML(post.category.join(" · ").toUpperCase())}</span>
              <span class="team-post-status is-published">PUBLISHED</span>
              <time>${formatDate(post.date)}</time>
            </div>
            <h2>${escapeHTML(post.title)}</h2>
            <p class="team-post-excerpt">${escapeHTML(post.body?.slice(0, 120) || "No note content yet.")}</p>
          </div>
          <div class="team-post-actions">
            <button class="text-button edit-team-post" data-id="${escapeHTML(post.id)}" type="button">EDIT</button>
            <button class="text-button delete-team-post" data-id="${escapeHTML(post.id)}" type="button">DELETE</button>
          </div>
        </article>
      `).join("")
      : `<p class="muted">You have not published any notes yet.</p>`;
  } catch (error) {
    showMessage(teamMessage, `Could not load notes: ${error.message}`);
    console.error("Loading notes failed", error);
  }
}

async function updateAuthView() {
  const session = await window.fieldnotesData.getSession();
  loginPanel.hidden = Boolean(session);
  editorPanel.hidden = !session;
  if (!session && unsubscribeChat) {
    unsubscribeChat();
    unsubscribeChat = null;
  }
  if (session) {
    const profile = await window.fieldnotesData.getProfile();
    if (profile) {
      document.getElementById("profile-name").value = profile.display_name || "";
      if (profile.avatar_url) {
        avatarPreview.innerHTML = `<img src="${escapeHTML(profile.avatar_url)}" alt="Current profile photo">`;
      }
    }
    renderProfile(profile);
    renderTeamPosts();
    renderTeamDrafts();
    renderChatMessagesFromDatabase();
    loadChatPosts();
    if (!unsubscribeChat) {
      unsubscribeChat = window.fieldnotesData.subscribeToChatMessages(() => {
        renderChatMessagesFromDatabase();
      });
    }

  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage(loginMessage, "Logging in...");

  const { error } = await window.fieldnotesData.signIn(
    document.getElementById("email").value.trim(),
    document.getElementById("password").value
  );

  if (error) {
    showMessage(loginMessage, "Login failed. Check your email and password.");
    return;
  }

  loginForm.reset();
  updateAuthView();
});

profileForm.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage(profileMessage, "Saving profile...");

  try {
    const file = document.getElementById("profile-avatar").files[0];
    let avatarUrl = (await window.fieldnotesData.getProfile())?.avatar_url || null;

    if (file) {
      try {
        avatarUrl = await window.fieldnotesData.uploadAvatar(file);
      } catch (error) {
        throw new Error(`photo upload failed: ${error.message}`);
      }
    }

    try {
      await window.fieldnotesData.saveProfile({
        display_name: document.getElementById("profile-name").value.trim(),
        avatar_url: avatarUrl
      });
    } catch (error) {
      throw new Error(`profile save failed: ${error.message}`);
    }
    renderProfile({
      display_name: document.getElementById("profile-name").value.trim(),
      avatar_url: avatarUrl
    });
    showMessage(profileMessage, "Profile saved. It will be used automatically.");
  } catch (error) {
    showMessage(profileMessage, `Could not save your profile: ${error.message}`);
    console.error("Profile save failed", error);
  }
});

editProfileButton.addEventListener("click", () => {
  profileForm.hidden = false;
  profileCard.hidden = true;
  document.getElementById("profile-name").focus();
});

function openChat() {
  teamChatSection.hidden = false;
  chatOverlay.hidden = false;
  requestAnimationFrame(() => {
    teamChatSection.classList.add("is-open");
    chatOverlay.classList.add("is-open");
  });
  chatToggleButton.setAttribute("aria-expanded", "true");
  chatToggleButton.querySelector(".chat-unread-badge")?.classList.remove("is-visible");
  renderChatMessagesFromDatabase();
  document.body.classList.add("chat-is-open");
  teamChatInput.focus();
}

function closeChat() {
  teamChatSection.classList.remove("is-open");
  chatOverlay.classList.remove("is-open");
  chatToggleButton.setAttribute("aria-expanded", "false");
  document.body.classList.remove("chat-is-open");
  window.setTimeout(() => {
    if (!teamChatSection.classList.contains("is-open")) teamChatSection.hidden = true;
    if (!chatOverlay.classList.contains("is-open")) chatOverlay.hidden = true;
  }, 260);
}

chatToggleButton.addEventListener("click", openChat);
closeChatButton.addEventListener("click", closeChat);
chatOverlay.addEventListener("click", closeChat);

teamChatForm.addEventListener("submit", async event => {
  event.preventDefault();
  const message = serializeChatInput().trim();
  if (!message) return;

  showMessage(chatMessage, "Sending...");
  try {
    await window.fieldnotesData.addChatMessage(message);
    teamChatInput.replaceChildren();
    showMessage(chatMessage, "");
    await renderChatMessagesFromDatabase();
  } catch (error) {
    showMessage(chatMessage, `Could not send message: ${error.message}`);
    console.error("Sending team chat message failed", error);
  }
});

teamForm.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage(teamMessage, editingPostId ? "Saving changes..." : "Publishing...");

  try {
    const note = await getNoteFormValues();
    if (editingPostId) {
      await window.fieldnotesData.updatePost(editingPostId, note);
      editingPostId = null;
      noteFormLabel.textContent = "01 / WRITE THE NOTE";
      noteSubmitButton.innerHTML = "PUBLISH NOTE <span>↗</span>";
      cancelEditButton.hidden = true;
      showMessage(teamMessage, "Note updated.");
    } else {
      await window.fieldnotesData.addPost({ ...note, date: new Date().toISOString() });
      showMessage(teamMessage, "Note published.");
    }
    teamForm.reset();
    resetCategoryPicker();
    await renderTeamPosts();
    await renderTeamDrafts();
  } catch (error) {
    showMessage(teamMessage, `Could not save the note: ${error.message}`);
    console.error("Saving note failed", error);
  }
});

categoryPicker.addEventListener("click", event => {
  const button = event.target.closest(".category-option");
  if (!button) return;
  const selectedButtons = categoryPicker.querySelectorAll(".category-option.is-selected");
  if (button.classList.contains("is-selected") && selectedButtons.length === 1) {
    categoryMessage.textContent = "Choose at least one thesis pillar.";
    return;
  }
  button.classList.toggle("is-selected");
  button.setAttribute("aria-pressed", String(button.classList.contains("is-selected")));
  categoryMessage.textContent = "";
});

function addLinkAttachment() {
  const url = safeAttachmentUrl(attachmentLinkInput.value.trim());
  const name = attachmentLinkNameInput.value.trim();
  if (!name || !url) return false;
  editingAttachments.push({ type: "link", url, name: name || url });
  attachmentLinkInput.value = "";
  attachmentLinkNameInput.value = "";
  renderAttachmentList();
  attachmentLinkNameInput.focus();
  showMessage(teamMessage, "");
  return true;
}

[attachmentLinkNameInput, attachmentLinkInput].forEach(input => {
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addLinkAttachment();
  });
});

async function addUploadedAttachments(input, type) {
  if (!input.files.length) return;
  try {
    showMessage(teamMessage, "Uploading media...");
    const uploads = await window.fieldnotesData.uploadPostMedia(input.files);
    editingAttachments.push(...uploads.map(upload => ({ ...upload, type })));
    input.value = "";
    renderAttachmentList();
    showMessage(teamMessage, "");
  } catch (error) {
    showMessage(teamMessage, `Could not upload media: ${error.message}`);
    console.error("Uploading post media failed", error);
  }
}

attachmentImagesInput.addEventListener("change", () => addUploadedAttachments(attachmentImagesInput, "image"));
attachmentVideosInput.addEventListener("change", () => addUploadedAttachments(attachmentVideosInput, "video"));
attachmentList.addEventListener("click", event => {
  const button = event.target.closest(".attachment-remove");
  if (!button) return;
  editingAttachments.splice(Number(button.dataset.attachmentIndex), 1);
  renderAttachmentList();
});

saveDraftButton.addEventListener("click", async () => {
  showMessage(teamMessage, "Saving draft...");
  try {
    const draft = getNoteFormValues();
    if (!draft.title && !draft.body && !draft.conclusion && !draft.ai_usage && !draft.attachments.length) {
      showMessage(teamMessage, "Add some content before saving a draft.");
      return;
    }
    await window.fieldnotesData.saveDraft({ ...draft, id: editingDraftId });
    teamForm.reset();
    resetCategoryPicker();
    editingPostId = null;
    editingDraftId = null;
    editingAttachments = [];
    noteFormLabel.textContent = "01 / WRITE THE NOTE";
    noteSubmitButton.innerHTML = "PUBLISH NOTE <span>↗</span>";
    cancelEditButton.hidden = true;
    showMessage(teamMessage, "Draft saved.");
    await renderTeamDrafts();
  } catch (error) {
    showMessage(teamMessage, `Could not save your draft: ${error.message}`);
    console.error("Saving draft failed", error);
  }
});

teamDrafts.addEventListener("click", async event => {
  const editButton = event.target.closest(".edit-team-draft");
  const deleteButton = event.target.closest(".delete-team-draft");
  if (editButton) {
    const draft = ownDraftsById.get(String(editButton.dataset.id));
    if (!draft) return;
    editingDraftId = draft.id;
    fillNoteForm(draft);
    teamForm.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("title").focus();
    showMessage(teamMessage, "Draft loaded.");
    return;
  }
  if (deleteButton && window.confirm("Delete this draft?")) {
    try {
      await window.fieldnotesData.deleteDraft(deleteButton.dataset.id);
      await renderTeamDrafts();
    } catch (error) {
      showMessage(teamMessage, `Could not delete the draft: ${error.message}`);
      console.error("Deleting draft failed", error);
    }
  }
});

teamPosts.addEventListener("click", async event => {
  const postContent = event.target.closest(".team-post-content");
  if (postContent) {
    const post = ownPostsById.get(String(postContent.closest(".team-post").dataset.id));
    if (post) openPreview(post);
    return;
  }
  const editButton = event.target.closest(".edit-team-post");
  if (editButton) {
    const post = ownPostsById.get(String(editButton.dataset.id));
    if (!post) {
      showMessage(teamMessage, "Could not find your note. Please refresh the page.");
      return;
    }
    try {
      editingPostId = post.id;
      fillNoteForm(post);
      noteFormLabel.textContent = "01 / EDIT THE NOTE";
      noteSubmitButton.innerHTML = "SAVE CHANGES <span>↗</span>";
      cancelEditButton.hidden = false;
      teamForm.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("title").focus();
    } catch (error) {
      showMessage(teamMessage, `Could not open the note for editing: ${error.message}`);
      console.error("Opening note edit failed", error);
    }
    return;
  }

  const button = event.target.closest(".delete-team-post");
  if (!button) return;

  try {
    const post = ownPostsById.get(String(button.dataset.id));
    if (!post) {
      showMessage(teamMessage, "Could not find your note. Please refresh the page.");
      return;
    }

    openDeleteModal(post);
  } catch (error) {
    showMessage(teamMessage, `Could not prepare the note for deletion: ${error.message}`);
    console.error("Preparing note deletion failed", error);
  }
});

teamPosts.addEventListener("keydown", event => {
  if ((event.key !== "Enter" && event.key !== " ") || !event.target.closest(".team-post-content")) return;
  event.preventDefault();
  const content = event.target.closest(".team-post-content");
  const post = ownPostsById.get(String(content.closest(".team-post").dataset.id));
  if (post) openPreview(post);
});

cancelEditButton.addEventListener("click", () => {
  editingPostId = null;
  teamForm.reset();
  noteFormLabel.textContent = "01 / WRITE THE NOTE";
  noteSubmitButton.innerHTML = "PUBLISH NOTE <span>↗</span>";
  cancelEditButton.hidden = true;
  resetMediaPicker();
  showMessage(teamMessage, "");
});

cancelDeleteButton.addEventListener("click", () => {
  closeDeleteModal();
});

confirmDeleteButton.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  const postId = pendingDeleteId;
  closeDeleteModal();
  try {
    await window.fieldnotesData.deletePost(postId);
    await renderTeamPosts();
  } catch (error) {
    showMessage(teamMessage, "Could not delete the note.");
    console.error("Deleting note failed", error);
  }
});

deleteModal.addEventListener("click", event => {
  if (event.target === deleteModal) closeDeleteModal();
});

closePreviewButton.addEventListener("click", closePreview);
previewModal.addEventListener("click", event => {
  if (event.target === previewModal) closePreview();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && deleteModal.classList.contains("is-open")) closeDeleteModal();
  if (event.key === "Escape" && previewModal.classList.contains("is-open")) closePreview();
  if (event.key === "Escape" && teamChatSection.classList.contains("is-open")) closeChat();
});

document.getElementById("logout-button").addEventListener("click", async () => {
  await window.fieldnotesData.signOut();
  updateAuthView();
});

window.fieldnotesData.onAuthStateChange(() => updateAuthView());
updateAuthView();
