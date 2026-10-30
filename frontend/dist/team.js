const loginPanel = document.getElementById("login-panel");
const editorPanel = document.getElementById("editor-panel");
const loginForm = document.getElementById("login-form");
const teamForm = document.getElementById("team-form");
const loginMessage = document.getElementById("login-message");
const teamMessage = document.getElementById("team-message");
const teamPosts = document.getElementById("team-posts");
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
let pendingDeleteId = null;
let editingPostId = null;
const ownPostsById = new Map();

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
        <p class="team-chat-message-body">${escapeHTML(item.message)}</p>
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
    await renderChatMessages(await window.fieldnotesData.getChatMessages());
  } catch (error) {
    teamChatMessages.innerHTML = `<p class="form-message">Could not load team messages: ${escapeHTML(error.message)}</p>`;
    console.error("Loading team chat failed", error);
  }
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
  previewCategory.textContent = `${post.category.toUpperCase()} / THESIS NOTE`;
  previewTitle.textContent = post.title;
  previewDate.textContent = formatDate(post.date);
  previewBody.textContent = post.body;
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

function getNoteFormValues() {
  return {
    category: document.getElementById("category").value,
    title: document.getElementById("title").value.trim(),
    body: document.getElementById("body").value.trim(),
    conclusion: document.getElementById("conclusion").value.trim() || null,
    ai_usage: document.getElementById("ai-usage").value.trim() || null
  };
}

function fillNoteForm(note) {
  document.getElementById("category").value = note.category || "ux";
  document.getElementById("title").value = note.title || "";
  document.getElementById("body").value = note.body || "";
  document.getElementById("conclusion").value = note.conclusion || "";
  document.getElementById("ai-usage").value = note.ai_usage || "";
}

async function loadDraft() {
  try {
    const draft = await window.fieldnotesData.getDraft();
    if (!draft) return;
    fillNoteForm(draft);
    showMessage(teamMessage, "Draft restored.");
  } catch (error) {
    showMessage(teamMessage, `Could not load your draft: ${error.message}`);
    console.error("Loading draft failed", error);
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
            <span class="note-tag">${escapeHTML(post.category)} / PUBLISHED ${formatDate(post.date)}</span>
            <h2>${escapeHTML(post.title)}</h2>
            <span class="muted">${escapeHTML(post.author_name || "PKL Studio team")}</span>
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
    renderChatMessagesFromDatabase();
    loadDraft();
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
  const message = teamChatInput.value.trim();
  if (!message) return;

  showMessage(chatMessage, "Sending...");
  try {
    await window.fieldnotesData.addChatMessage(message);
    teamChatInput.value = "";
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
    const note = getNoteFormValues();
    if (editingPostId) {
      await window.fieldnotesData.updatePost(editingPostId, note);
      editingPostId = null;
      noteFormLabel.textContent = "01 / WRITE THE NOTE";
      noteSubmitButton.innerHTML = "PUBLISH NOTE <span>↗</span>";
      cancelEditButton.hidden = true;
      showMessage(teamMessage, "Note updated.");
    } else {
      await window.fieldnotesData.addPost({ ...note, date: new Date().toISOString() });
      await window.fieldnotesData.deleteDraft();
      showMessage(teamMessage, "Note published.");
    }
    teamForm.reset();
    await renderTeamPosts();
  } catch (error) {
    showMessage(teamMessage, `Could not save the note: ${error.message}`);
    console.error("Saving note failed", error);
  }
});

saveDraftButton.addEventListener("click", async () => {
  const draft = getNoteFormValues();
  if (!draft.title && !draft.body && !draft.conclusion && !draft.ai_usage) {
    showMessage(teamMessage, "Add some content before saving a draft.");
    return;
  }

  showMessage(teamMessage, "Saving draft...");
  try {
    await window.fieldnotesData.saveDraft(draft);
    showMessage(teamMessage, "Draft saved.");
  } catch (error) {
    showMessage(teamMessage, `Could not save your draft: ${error.message}`);
    console.error("Saving draft failed", error);
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
