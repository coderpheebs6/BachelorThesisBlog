const publicNavActions = document.querySelector(".nav-actions");

function publicEscapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function publicProfileMarkup(profile) {
  const name = profile?.display_name || "?";
  const initials = name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  return profile?.avatar_url && /^https:\/\//i.test(profile.avatar_url)
    ? `<img src="${publicEscapeHTML(profile.avatar_url)}" alt="">`
    : publicEscapeHTML(initials);
}

function createPublicChatDrawer() {
  const drawer = document.createElement("aside");
  drawer.className = "public-chat-drawer";
  drawer.innerHTML = `
    <div class="public-chat-heading">
      <div><p class="eyebrow">TEAM SPACE</p><h2>Team<br><span>chat.</span></h2></div>
      <button class="public-chat-close" type="button" aria-label="Close team chat">CLOSE ×</button>
    </div>
    <div class="public-chat-messages"></div>
    <form class="public-chat-form">
      <div class="public-chat-input-row">
        <div class="public-chat-input" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Write a message..."></div>
        <button class="submit-button" type="submit">SEND</button>
      </div>
      <p class="form-message"></p>
    </form>
  `;
  const overlay = document.createElement("div");
  overlay.className = "public-chat-overlay";
  document.body.append(drawer, overlay);
  return { drawer, overlay };
}

async function initPublicNav() {
  if (!publicNavActions || !window.fieldnotesData) return;
  const session = await window.fieldnotesData.getSession();
  if (!session) return;

  const profile = await window.fieldnotesData.getProfile();
  publicNavActions.querySelector(".team-link")?.remove();
  publicNavActions.insertAdjacentHTML("beforeend", `
    <button class="public-chat-button" type="button" aria-label="Open team chat">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8l-5 3v-3.2a2 2 0 0 1-1-1.8v-7a2 2 0 0 1 2-2Z"></path></svg>
    </button>
    <a class="public-profile-button" href="team.html" aria-label="Open team profile">${publicProfileMarkup(profile)}</a>
  `);

  const { drawer, overlay } = createPublicChatDrawer();
  const closeButton = drawer.querySelector(".public-chat-close");
  const messagesElement = drawer.querySelector(".public-chat-messages");
  const form = drawer.querySelector(".public-chat-form");
  const input = drawer.querySelector(".public-chat-input");
  const formMessage = drawer.querySelector(".form-message");

  async function renderMessages() {
    const messages = await window.fieldnotesData.getChatMessages();
    messagesElement.innerHTML = messages.map(message => `
      <article class="public-chat-message">
        <strong>${publicEscapeHTML(message.author_name)}</strong>
        <time>${new Date(message.created_at).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
        <p>${publicEscapeHTML(message.message)}</p>
      </article>
    `).join("") || `<p class="muted">No messages yet.</p>`;
  }

  function close() {
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
  }

  publicNavActions.querySelector(".public-chat-button").addEventListener("click", async () => {
    drawer.classList.add("is-open");
    overlay.classList.add("is-open");
    await renderMessages();
    input.focus();
  });
  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", close);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const message = input.textContent.trim();
    if (!message) return;
    try {
      await window.fieldnotesData.addChatMessage(message);
      input.replaceChildren();
      formMessage.textContent = "";
      await renderMessages();
    } catch (error) {
      formMessage.textContent = `Could not send message: ${error.message}`;
    }
  });
  window.fieldnotesData.subscribeToChatMessages(renderMessages);
}

initPublicNav().catch(error => console.error("Public navigation setup failed", error));
