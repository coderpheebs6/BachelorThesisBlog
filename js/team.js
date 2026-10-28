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
let pendingDeleteId = null;

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

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
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
    teamPosts.innerHTML = ownPosts.length
      ? ownPosts.map(post => `
        <article class="team-post">
          <div>
            <span class="note-tag">${escapeHTML(post.category)} / ${formatDate(post.date)}</span>
            <h2>${escapeHTML(post.title)}</h2>
            <span class="muted">${escapeHTML(post.author_name || "PKL Studio team")}</span>
          </div>
          <button class="text-button delete-team-post" data-id="${escapeHTML(post.id)}" type="button">DELETE</button>
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

teamForm.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage(teamMessage, "Publishing...");

  try {
    await window.fieldnotesData.addPost({
      category: document.getElementById("category").value,
      title: document.getElementById("title").value.trim(),
      body: document.getElementById("body").value.trim(),
      conclusion: document.getElementById("conclusion").value.trim() || null,
      date: new Date().toISOString()
    });
    teamForm.reset();
    showMessage(teamMessage, "Note published.");
    renderTeamPosts();
  } catch {
    showMessage(teamMessage, "Could not publish the note.");
  }
});

teamPosts.addEventListener("click", async event => {
  const button = event.target.closest(".delete-team-post");
  if (!button) return;

  try {
    const session = await window.fieldnotesData.getSession();
    const post = (await window.fieldnotesData.getPosts())
      .find(item => item.id === button.dataset.id && item.author_id === session?.user.id);
    if (!post) {
      showMessage(teamMessage, "Could not find your note.");
      return;
    }

    openDeleteModal(post);
  } catch (error) {
    showMessage(teamMessage, `Could not prepare the note for deletion: ${error.message}`);
    console.error("Preparing note deletion failed", error);
  }
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

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && deleteModal.classList.contains("is-open")) closeDeleteModal();
});

document.getElementById("logout-button").addEventListener("click", async () => {
  await window.fieldnotesData.signOut();
  updateAuthView();
});

window.fieldnotesData.onAuthStateChange(() => updateAuthView());
updateAuthView();
