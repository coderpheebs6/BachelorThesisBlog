const STORAGE_KEY = "blog-posts-v1";
const CATEGORIES = ["ux", "design", "code"];

const seed = [
  { id: 1, category: "ux", title: "Welkom bij het UX-deel", body: "Hier komen mijn gedachten over gebruiksvriendelijkheid.", date: Date.now() },
  { id: 2, category: "design", title: "Welkom bij het Design-deel", body: "Hier komen kleuren, typografie en layout aan bod.", date: Date.now() },
  { id: 3, category: "code", title: "Welkom bij het Code-deel", body: "Hier deel ik codevoorbeelden en tips.", date: Date.now() },
];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : seed;
  } catch (e) {
    return seed;
  }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); } catch (e) {}
}

let posts = load();

function render() {
  CATEGORIES.forEach((cat) => {
    const list = document.getElementById("list-" + cat);
    const items = posts.filter((p) => p.category === cat).sort((a, b) => b.date - a.date);
    document.getElementById("count-" + cat).textContent = items.length;
    list.replaceChildren();

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Nog niets hier. Voeg je eerste onderdeel toe.";
      list.append(empty);
      return;
    }

    items.forEach((p) => {
      const post = document.createElement("div");
      post.className = "post";

      const h = document.createElement("h3");
      h.textContent = p.title;

      const body = document.createElement("p");
      body.textContent = p.body;

      const meta = document.createElement("div");
      meta.className = "meta";
      const date = document.createElement("span");
      date.textContent = new Date(p.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Verwijderen";
      del.addEventListener("click", () => {
        posts = posts.filter((x) => x.id !== p.id);
        save();
        render();
      });
      meta.append(date, del);

      post.append(h, body, meta);
      list.append(post);
    });
  });
}

document.getElementById("post-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("title").value.trim();
  const body = document.getElementById("body").value.trim();
  const category = document.querySelector('input[name="category"]:checked').value;
  if (!title || !body) return;

  posts.push({ id: Date.now(), category, title, body, date: Date.now() });
  save();
  render();
  e.target.reset();
});

render();
