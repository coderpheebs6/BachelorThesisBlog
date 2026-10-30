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

function publicRenderChatText(message) {
  const escaped = publicEscapeHTML(message);
  return escaped.replace(/\[\[post:([^|\]]+)\|([^\]]+)\]\]/g, (_, id, encodedTitle) => {
    let title = encodedTitle;
    try {
      title = decodeURIComponent(encodedTitle);
    } catch {
      title = encodedTitle;
    }
    return `<a class="chat-post-link" href="article.html?id=${encodeURIComponent(id)}">${publicEscapeHTML(title)}</a>`;
  });
}

function getPublicChatInputBeforeCaret(input) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return input.textContent;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(input);
  range.setEnd(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset);
  return range.toString();
}

function serializePublicChatInput(input) {
  return [...input.childNodes].map(node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType === Node.ELEMENT_NODE && node.matches(".chat-input-post-link")) {
      return `[[post:${node.dataset.postId}|${encodeURIComponent(node.textContent)}]]`;
    }
    return node.textContent;
  }).join("");
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
      <div class="chat-command-menu public-chat-command-menu" hidden></div>
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
      <span class="chat-unread-badge" aria-hidden="true"></span>
    </button>
    <a class="public-profile-button" href="team.html" aria-label="Open team profile">${publicProfileMarkup(profile)}</a>
  `);

  const { drawer, overlay } = createPublicChatDrawer();
  const closeButton = drawer.querySelector(".public-chat-close");
  const messagesElement = drawer.querySelector(".public-chat-messages");
  const form = drawer.querySelector(".public-chat-form");
  const input = drawer.querySelector(".public-chat-input");
  const commandMenu = drawer.querySelector(".public-chat-command-menu");
  const formMessage = drawer.querySelector(".form-message");
  const chatButton = publicNavActions.querySelector(".public-chat-button");
  const unreadBadge = chatButton.querySelector(".chat-unread-badge");
  const sessionUserId = session.user.id;
  let latestSeenMessage = null;
  let hasLoadedMessages = false;
  let chatPosts = [];
  let chatPostsLoaded = false;
  let chatPostsLoading = null;
  let chatPostsError = null;
  let chatCommandSelection = 0;

  function hideChatCommandMenu() {
    commandMenu.hidden = true;
    commandMenu.innerHTML = "";
    chatCommandSelection = 0;
  }

  function getFilteredChatPosts(query) {
    return chatPosts.filter(post => post.title.toLowerCase().includes(query.toLowerCase()));
  }

  function showChatCommandMenu(query) {
    const filteredPosts = getFilteredChatPosts(query);
    chatCommandSelection = Math.min(chatCommandSelection, Math.max(filteredPosts.length - 1, 0));
    commandMenu.innerHTML = filteredPosts.length
      ? filteredPosts.map((post, index) => `
        <button class="chat-command-item${index === chatCommandSelection ? " is-selected" : ""}" type="button" data-post-id="${publicEscapeHTML(post.id)}">
          <span class="chat-command-icon">↗</span>
          <span><strong>${publicEscapeHTML(post.title)}</strong><small>${publicEscapeHTML(post.category.join(" · ").toUpperCase())} / POST</small></span>
        </button>
      `).join("")
      : `<p class="chat-command-empty">No posts found.</p>`;
    commandMenu.hidden = false;
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
        console.error("Loading posts for public chat links failed", error);
      } finally {
        chatPostsLoading = null;
      }
    })();
    await chatPostsLoading;
  }

  async function updateChatCommandMenu() {
    const beforeCursor = getPublicChatInputBeforeCaret(input);
    const match = beforeCursor.match(/(?:^|\s)\/([^\s]*)$/);
    if (!match) {
      hideChatCommandMenu();
      return;
    }
    if (!chatPostsLoaded) {
      commandMenu.hidden = false;
      commandMenu.innerHTML = `<p class="chat-command-empty">Loading posts...</p>`;
      await loadChatPosts();
    }
    const currentMatch = getPublicChatInputBeforeCaret(input).match(/(?:^|\s)\/([^\s]*)$/);
    if (!currentMatch) return;
    if (chatPostsError) {
      commandMenu.hidden = false;
      commandMenu.innerHTML = `<p class="chat-command-empty">Could not load posts: ${publicEscapeHTML(chatPostsError)}</p>`;
      return;
    }
    chatCommandSelection = 0;
    showChatCommandMenu(currentMatch[1]);
  }

  function insertChatPostLink(post) {
    if (!post) return;
    const beforeCursor = getPublicChatInputBeforeCaret(input);
    if (!beforeCursor.match(/(?:^|\s)\/([^\s]*)$/)) return;
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;
    const typedText = textNode.textContent.slice(0, range.startOffset);
    const replacementRange = document.createRange();
    replacementRange.setStart(textNode, typedText.lastIndexOf("/"));
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
    input.focus();
  }

  function updateUnread(messages, markAsRead = false) {
    const latestMessage = messages[messages.length - 1];
    if (!hasLoadedMessages && latestMessage) latestSeenMessage = latestMessage.created_at;
    if (markAsRead && latestMessage) latestSeenMessage = latestMessage.created_at;
    const hasUnread = hasLoadedMessages && !drawer.classList.contains("is-open")
      && latestMessage && latestMessage.created_at > latestSeenMessage;
    unreadBadge.classList.toggle("is-visible", Boolean(hasUnread));
    chatButton.setAttribute("aria-label", hasUnread ? "Open team chat, unread messages" : "Open team chat");
    hasLoadedMessages = true;
  }

  function renderPublicMessages(messages) {
    messagesElement.innerHTML = messages.length
      ? messages.map(message => {
        const initials = (message.author_name || "?").split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
        const avatar = message.author_avatar && /^https:\/\//i.test(message.author_avatar)
          ? `<img src="${publicEscapeHTML(message.author_avatar)}" alt="">`
          : publicEscapeHTML(initials);
        return `
          <article class="team-chat-message public-chat-message${message.author_id === sessionUserId ? " is-own-message" : ""}">
            <div class="team-chat-message-meta">
              <div class="team-chat-author">
                <span class="chat-avatar">${avatar}</span>
                <strong>${publicEscapeHTML(message.author_name || "PKL Studio team")}</strong>
              </div>
              <time>${new Date(message.created_at).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
            </div>
            <p class="team-chat-message-body">${publicRenderChatText(message.message)}</p>
          </article>
        `;
      }).join("")
      : `<p class="muted">No messages yet. Start the conversation.</p>`;
    messagesElement.scrollTop = messagesElement.scrollHeight;
  }

  async function renderMessages() {
    const messages = await window.fieldnotesData.getChatMessages();
    updateUnread(messages);
    renderPublicMessages(messages);
  }

  function close() {
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
  }

  chatButton.addEventListener("click", async () => {
    drawer.classList.add("is-open");
    overlay.classList.add("is-open");
    const messages = await window.fieldnotesData.getChatMessages();
    updateUnread(messages, true);
    renderPublicMessages(messages);
    input.focus();
  });
  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", close);
  input.addEventListener("input", updateChatCommandMenu);
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") hideChatCommandMenu();
    if (commandMenu.hidden) return;
    const match = getPublicChatInputBeforeCaret(input).match(/(?:^|\s)\/([^\s]*)$/);
    if (!match) return;
    const filteredPosts = getFilteredChatPosts(match[1]);
    if (!filteredPosts.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      chatCommandSelection = (chatCommandSelection + direction + filteredPosts.length) % filteredPosts.length;
      showChatCommandMenu(match[1]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      insertChatPostLink(filteredPosts[chatCommandSelection]);
    }
  });
  commandMenu.addEventListener("click", event => {
    const button = event.target.closest(".chat-command-item");
    if (button) insertChatPostLink(chatPosts.find(post => String(post.id) === button.dataset.postId));
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const message = serializePublicChatInput(input).trim();
    if (!message) return;
    try {
      await window.fieldnotesData.addChatMessage(message);
      input.replaceChildren();
      hideChatCommandMenu();
      formMessage.textContent = "";
      await renderMessages();
    } catch (error) {
      formMessage.textContent = `Could not send message: ${error.message}`;
    }
  });
  window.fieldnotesData.subscribeToChatMessages(renderMessages);
}

initPublicNav().catch(error => console.error("Public navigation setup failed", error));
