// Notion-style blocks for the rich text editor: code blocks, inline code and tables.
// - setupRichBlocks(toolbar, editor): adds the toolbar buttons and keyboard behaviour
//   (called from setupRichTextToolbar in data.js).
// - enhanceRichContent(root): on a published post, gives code blocks a header with the
//   language and a copy button, adds syntax colours and makes wide tables scrollable.
(() => {
  const HLJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js";
  const languages = () => window.richTextCodeLanguages || [["plaintext", "Plain text"]];
  const languageLabel = value => (languages().find(([v]) => v === value) || [, "Plain text"])[1];

  // ---------- Editor ----------

  // The direct child of the editor that contains the caret (the "block" you are in).
  function currentBlock(editor, node) {
    while (node && node.parentNode !== editor) node = node.parentNode;
    return node && node !== editor ? node : null;
  }

  function caretInside(editor) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    const node = selection.anchorNode;
    return node && editor.contains(node) ? node : null;
  }

  function closestIn(editor, node, selector) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    const found = element?.closest(selector);
    return found && editor.contains(found) ? found : null;
  }

  function placeCaret(node, atEnd = false) {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(!atEnd);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function emptyParagraph() {
    const p = document.createElement("p");
    p.appendChild(document.createElement("br"));
    return p;
  }

  // Puts a new block where the caret is: it replaces an empty line, otherwise it goes
  // below the current block. There is always a paragraph after it to keep typing in.
  function insertBlock(editor, block) {
    const node = caretInside(editor);
    const current = node ? currentBlock(editor, node) : null;
    if (current && current.nodeType === Node.ELEMENT_NODE && !current.textContent.trim() && !current.matches("figure, table, pre") && !current.querySelector("img, table, pre")) {
      current.replaceWith(block);
    } else if (current) {
      current.after(block);
    } else {
      editor.appendChild(block);
    }
    if (!block.nextElementSibling) block.after(emptyParagraph());
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function makeCodeBlock(text) {
    const pre = document.createElement("pre");
    pre.dataset.lang = "javascript";
    const code = document.createElement("code");
    // A trailing line break keeps the last (empty) line visible while typing.
    code.textContent = `${text}\n`;
    pre.appendChild(code);
    return pre;
  }

  // Text of a piece of the editor with its line breaks (<br>, paragraphs, divs).
  function textWithLines(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/ /g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return "";
    if (node.tagName === "BR") return "\n";
    const inner = [...node.childNodes].map(textWithLines).join("");
    return /^(P|DIV|H[1-4]|LI|PRE)$/.test(node.tagName || "") ? `\n${inner}` : inner;
  }

  // Turns the selected lines (also over several paragraphs) into one code block,
  // placed exactly where the selection was. Without a selection: a new empty block.
  function insertCodeBlock(editor) {
    const selection = window.getSelection();
    const hasSelection = caretInside(editor) && selection.rangeCount && !selection.isCollapsed;
    if (!hasSelection) {
      const pre = makeCodeBlock("");
      insertBlock(editor, pre);
      placeCaret(pre.querySelector("code").firstChild, false);
      return;
    }

    const range = selection.getRangeAt(0);
    const text = textWithLines(range.extractContents()).replace(/^\n+/, "").replace(/\n+$/, "");
    const pre = makeCodeBlock(text);

    // Split the block the selection started in at the cut, and put the code in between.
    const startBlock = currentBlock(editor, range.startContainer);
    if (!startBlock || startBlock.nodeType === Node.TEXT_NODE) {
      range.insertNode(pre);
    } else {
      const rest = document.createRange();
      rest.setStart(range.startContainer, range.startOffset);
      rest.setEndAfter(startBlock.lastChild || startBlock);
      const remainder = startBlock.cloneNode(false);
      remainder.appendChild(rest.extractContents());
      startBlock.after(pre);
      if (remainder.textContent.trim()) pre.after(remainder);
      if (!startBlock.textContent.trim() && !startBlock.querySelector("img")) startBlock.remove();
    }
    // Leftover empty lines around the new block are removed.
    const isLeftover = node => node && (
      (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) ||
      (node.nodeType === Node.ELEMENT_NODE && (node.tagName === "BR" ||
        (/^(P|DIV|H[1-4])$/.test(node.tagName) && !node.textContent.trim() && !node.querySelector("img"))))
    );
    while (isLeftover(pre.previousSibling)) pre.previousSibling.remove();
    while (isLeftover(pre.nextSibling)) pre.nextSibling.remove();
    if (!pre.nextSibling) pre.after(emptyParagraph());
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    placeCaret(pre.querySelector("code"), true);
  }

  function insertInlineCode(editor) {
    const selection = window.getSelection();
    if (!caretInside(editor) || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const existing = closestIn(editor, range.commonAncestorContainer, "code");
    if (existing && !existing.closest("pre")) {
      // Already inline code: turn it back into normal text.
      existing.replaceWith(document.createTextNode(existing.textContent));
      return;
    }
    const code = document.createElement("code");
    code.textContent = range.toString() || "code";
    range.deleteContents();
    range.insertNode(code);
    // Continue typing as normal text after it; add a space only when none follows yet.
    const next = code.nextSibling;
    if (next?.nodeType === Node.TEXT_NODE && /^\s/.test(next.textContent)) {
      const range = document.createRange();
      range.setStart(next, 1);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      const after = document.createTextNode(" ");
      code.after(after);
      placeCaret(after, true);
    }
  }

  // ---------- Photos in the text ----------

  // A photo with an editable caption below it. The image itself cannot be typed in.
  function makeFigure(src, name = "") {
    const figure = document.createElement("figure");
    figure.className = "rich-image";
    figure.dataset.size = "full";
    const image = document.createElement("img");
    image.src = src;
    image.alt = "";
    image.contentEditable = "false";
    image.draggable = false;
    const caption = document.createElement("figcaption");
    caption.dataset.placeholder = "Add a caption…";
    figure.append(image, caption);
    if (name) figure.title = name;
    return figure;
  }

  // Images loaded from a saved post get the same editor behaviour as new ones.
  function prepareFigures(editor) {
    editor.querySelectorAll("figure.rich-image").forEach(figure => {
      const image = figure.querySelector("img");
      if (image) { image.contentEditable = "false"; image.draggable = false; }
      const caption = figure.querySelector("figcaption") || figure.appendChild(document.createElement("figcaption"));
      caption.dataset.placeholder = "Add a caption…";
    });
  }

  // Uploads the photos and puts them where the caret is, in the order chosen.
  async function insertImages(editor, files, showStatus) {
    const images = [...files].filter(file => file.type.startsWith("image/"));
    if (!images.length) return;
    // A placeholder shows where the photos will appear while they upload.
    const placeholder = document.createElement("p");
    placeholder.className = "rich-image-uploading";
    placeholder.textContent = images.length > 1 ? `Uploading ${images.length} photos…` : "Uploading photo…";
    placeholder.contentEditable = "false";
    insertBlock(editor, placeholder);
    showStatus?.("");
    try {
      const uploads = await window.fieldnotesData.uploadPostMedia(images);
      const figures = uploads.map(upload => makeFigure(upload.url, upload.name));
      placeholder.replaceWith(...figures);
      const last = figures[figures.length - 1];
      if (!last.nextElementSibling) last.after(emptyParagraph());
      placeCaret(last.querySelector("figcaption"));
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (error) {
      placeholder.remove();
      showStatus?.(`Could not upload the photo: ${error.message}`);
      console.error("Uploading an inline photo failed", error);
    }
  }

  function makeCell(tag) {
    const cell = document.createElement(tag);
    cell.appendChild(document.createElement("br"));
    return cell;
  }

  function insertTable(editor) {
    const table = document.createElement("table");
    const head = table.createTHead().insertRow();
    ["Column 1", "Column 2", "Column 3"].forEach(label => {
      const th = document.createElement("th");
      th.textContent = label;
      head.appendChild(th);
    });
    const body = table.createTBody();
    for (let r = 0; r < 2; r++) {
      const row = body.insertRow();
      for (let c = 0; c < 3; c++) row.appendChild(makeCell("td"));
    }
    insertBlock(editor, table);
    placeCaret(head.cells[0], true);
  }

  function tableAction(editor, cell, action) {
    if (!cell) return;
    const row = cell.parentElement;
    const table = cell.closest("table");
    const column = cell.cellIndex;
    const rows = [...table.rows];
    if (action === "row-add") {
      const newRow = document.createElement("tr");
      [...row.cells].forEach(() => newRow.appendChild(makeCell("td")));
      // A row added from the header row goes to the top of the body.
      if (row.parentElement.tagName === "THEAD") table.tBodies[0].prepend(newRow);
      else row.after(newRow);
      placeCaret(newRow.cells[column]);
    } else if (action === "col-add") {
      rows.forEach(r => r.cells[column].after(makeCell(r.parentElement.tagName === "THEAD" ? "th" : "td")));
      placeCaret(row.cells[column + 1]);
    } else if (action === "row-remove") {
      if (row.parentElement.tagName === "THEAD") return; // the header row stays
      const next = row.nextElementSibling || row.previousElementSibling || table.tHead?.rows[0];
      row.remove();
      if (!table.tBodies[0]?.rows.length) return removeTable(table);
      placeCaret(next.cells[Math.min(column, next.cells.length - 1)], true);
    } else if (action === "col-remove") {
      if (row.cells.length === 1) return removeTable(table);
      rows.forEach(r => r.cells[column].remove());
      placeCaret(row.cells[Math.max(column - 1, 0)], true);
    } else if (action === "table-remove") {
      removeTable(table);
    }
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function removeTable(table) {
    const p = emptyParagraph();
    table.replaceWith(p);
    placeCaret(p);
  }

  function insertTextAtCaret(text) {
    const range = window.getSelection().getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Leave a code block or table: go to the paragraph below it (made if needed).
  // Leave a code block, table or photo: continue on a new empty line right below it
  // (an empty line that is already there is reused, text below is never touched).
  function exitBlock(block) {
    let next = block.nextSibling;
    const isEmptyLine = next?.nodeType === Node.ELEMENT_NODE && next.tagName === "P" && !next.textContent.trim() && !next.querySelector("img");
    if (!isEmptyLine) {
      next = emptyParagraph();
      block.after(next);
    }
    placeCaret(next);
  }

  function setupRichBlocks(toolbar, editor) {
    if (!toolbar || !editor || toolbar.dataset.richBlocks) return;
    toolbar.dataset.richBlocks = "true";

    toolbar.insertAdjacentHTML("beforeend", `
      <span class="toolbar-divider"></span>
      <button type="button" data-action="inline-code" aria-label="Inline code" title="Inline code">\`code\`</button>
      <button type="button" data-action="code-block" aria-label="Code block" title="Code block">{ }</button>
      <button type="button" data-action="table" aria-label="Table" title="Table">▦ Table</button>
      <button type="button" data-action="image" aria-label="Photo" title="Photo in the text (you can also paste or drop one)">▣ Photo</button>
      <input class="rich-image-input" type="file" accept="image/*" multiple hidden>
      <span class="rich-context rich-context-image" hidden>
        <span class="rich-context-label">Size</span>
        <button type="button" data-action="size-small" title="Small">S</button>
        <button type="button" data-action="size-medium" title="Medium">M</button>
        <button type="button" data-action="size-full" title="Full width">L</button>
        <button type="button" data-action="image-remove" title="Remove the photo">Remove photo</button>
      </span>
      <span class="rich-context rich-context-code" hidden>
        <label class="rich-context-label">Language
          <select class="rich-language-select" aria-label="Code language">
            ${languages().map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
          </select>
        </label>
      </span>
      <span class="rich-context rich-context-table" hidden>
        <button type="button" data-action="row-add" title="Add a row below">+ Row</button>
        <button type="button" data-action="col-add" title="Add a column to the right">+ Col</button>
        <button type="button" data-action="row-remove" title="Remove this row">− Row</button>
        <button type="button" data-action="col-remove" title="Remove this column">− Col</button>
        <button type="button" data-action="table-remove" title="Remove the table">Delete table</button>
      </span>`);

    const codeTools = toolbar.querySelector(".rich-context-code");
    const tableTools = toolbar.querySelector(".rich-context-table");
    const languageSelect = toolbar.querySelector(".rich-language-select");
    const imageTools = toolbar.querySelector(".rich-context-image");
    const imageInput = toolbar.querySelector(".rich-image-input");
    // The block the caret was last in; the language select steals focus, so keep it.
    let activePre = null;
    let activeCell = null;
    let activeFigure = null;
    // Where the caret was before the file picker opened, so photos land there.
    let savedRange = null;

    // Upload errors appear in the form's own message line.
    const showStatus = text => {
      const message = editor.closest("form")?.querySelector(".form-message");
      if (message) message.textContent = text;
      else if (text) alert(text);
    };

    const updateContext = () => {
      const node = caretInside(editor);
      if (!node) return;
      activePre = closestIn(editor, node, "pre");
      activeCell = closestIn(editor, node, "td, th");
      activeFigure = closestIn(editor, node, "figure.rich-image");
      codeTools.hidden = !activePre;
      tableTools.hidden = !activeCell;
      imageTools.hidden = !activeFigure;
      imageTools.querySelectorAll("[data-action^='size-']").forEach(button => {
        button.classList.toggle("is-active", button.dataset.action === `size-${activeFigure?.dataset.size || "full"}`);
      });
      if (activePre) languageSelect.value = activePre.dataset.lang || "plaintext";
    };
    prepareFigures(editor);
    // A saved post or draft can be loaded into the editor later, so check again on focus.
    editor.addEventListener("focus", () => prepareFigures(editor));
    document.addEventListener("selectionchange", updateContext);

    toolbar.addEventListener("mousedown", event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      event.preventDefault();
      editor.focus();
      const action = button.dataset.action;
      if (action === "code-block") insertCodeBlock(editor);
      else if (action === "inline-code") insertInlineCode(editor);
      else if (action === "table") insertTable(editor);
      else if (action === "image") {
        const selection = window.getSelection();
        savedRange = caretInside(editor) && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
        imageInput.click();
      } else if (action.startsWith("size-") && activeFigure) {
        activeFigure.dataset.size = action.replace("size-", "");
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (action === "image-remove" && activeFigure) {
        const next = activeFigure.nextElementSibling;
        activeFigure.remove();
        if (next) placeCaret(next);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      } else tableAction(editor, activeCell, action);
      updateContext();
    });

    imageInput.addEventListener("change", () => {
      editor.focus();
      if (savedRange) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
      insertImages(editor, imageInput.files, showStatus);
      imageInput.value = "";
    });

    // Clicking a photo puts the caret in its caption, so the photo tools appear.
    editor.addEventListener("click", event => {
      const figure = event.target.closest("figure.rich-image");
      if (figure && event.target.tagName === "IMG") placeCaret(figure.querySelector("figcaption"), true);
    });

    // Photos can also be dropped into the text or pasted (e.g. a screenshot).
    editor.addEventListener("drop", event => {
      const files = [...(event.dataTransfer?.files || [])].filter(file => file.type.startsWith("image/"));
      if (!files.length) return;
      event.preventDefault();
      const position = document.caretRangeFromPoint?.(event.clientX, event.clientY);
      if (position && editor.contains(position.startContainer)) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(position);
      }
      insertImages(editor, files, showStatus);
    });
    editor.addEventListener("dragover", event => {
      if ([...(event.dataTransfer?.items || [])].some(item => item.kind === "file")) event.preventDefault();
    });

    languageSelect.addEventListener("change", () => {
      if (activePre) activePre.dataset.lang = languageSelect.value;
      if (activePre?.firstChild) placeCaret(activePre.firstChild, true);
    });

    editor.addEventListener("keydown", event => {
      const node = caretInside(editor);
      const pre = closestIn(editor, node, "pre");
      const cell = closestIn(editor, node, "td, th");
      const caption = closestIn(editor, node, "figcaption");

      if (caption) {
        // Enter under a photo continues below it; Backspace in an empty caption
        // does nothing, so the photo is not merged away by accident.
        if (event.key === "Enter") {
          event.preventDefault();
          exitBlock(caption.closest("figure"));
        } else if (event.key === "Backspace" && !caption.textContent) {
          event.preventDefault();
        }
        return;
      }

      if (pre) {
        if (event.key === "Enter" && (event.shiftKey || event.metaKey || event.ctrlKey)) {
          // Shift/Cmd + Enter: continue writing below the code block.
          event.preventDefault();
          exitBlock(pre);
        } else if (event.key === "Enter") {
          event.preventDefault();
          insertTextAtCaret("\n");
          const code = pre.querySelector("code") || pre;
          if (!code.textContent.endsWith("\n")) code.appendChild(document.createTextNode("\n"));
        } else if (event.key === "Tab") {
          event.preventDefault();
          insertTextAtCaret("  ");
        } else if (event.key === "Backspace" && !pre.textContent.replace(/\n/g, "")) {
          // Backspace in an empty code block turns it back into a normal line.
          event.preventDefault();
          const p = emptyParagraph();
          pre.replaceWith(p);
          placeCaret(p);
        } else if (event.key === "Escape") {
          exitBlock(pre);
        }
        return;
      }

      // Notion shortcut: a line with only ``` becomes a code block on Enter or space.
      if (!cell && (event.key === "Enter" || event.key === " ") && node) {
        const block = currentBlock(editor, node);
        if (block && block.textContent.trim() === "```") {
          event.preventDefault();
          const newPre = makeCodeBlock("");
          block.replaceWith(newPre);
          if (!newPre.nextElementSibling) newPre.after(emptyParagraph());
          placeCaret(newPre.querySelector("code").firstChild, false);
          editor.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }
      }

      if (cell && event.key === "Tab") {
        // Tab / Shift+Tab move between cells; Tab in the last cell adds a row.
        event.preventDefault();
        const cells = [...cell.closest("table").querySelectorAll("th, td")];
        const index = cells.indexOf(cell) + (event.shiftKey ? -1 : 1);
        if (index >= cells.length) tableAction(editor, cell, "row-add");
        else if (index >= 0) placeCaret(cells[index], true);
      } else if (cell && event.key === "Enter" && !event.shiftKey) {
        // Enter goes to the cell below; from the last row it leaves the table.
        // Shift+Enter still makes a new line inside the cell.
        event.preventDefault();
        const table = cell.closest("table");
        const below = table.rows[cell.parentElement.rowIndex + 1];
        if (below && !(event.metaKey || event.ctrlKey)) placeCaret(below.cells[cell.cellIndex], true);
        else exitBlock(table);
      }
    });

    // Pasting into a code block keeps only the plain text.
    editor.addEventListener("paste", event => {
      const pastedImages = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith("image/"));
      if (pastedImages.length) {
        event.preventDefault();
        insertImages(editor, pastedImages, showStatus);
        return;
      }
      if (!closestIn(editor, caretInside(editor), "pre")) return;
      event.preventDefault();
      insertTextAtCaret(event.clipboardData.getData("text/plain"));
    });
  }

  // ---------- Published posts ----------

  let hljsPromise = null;
  function loadHighlighter() {
    if (window.hljs) return Promise.resolve(window.hljs);
    hljsPromise ||= new Promise(resolve => {
      const script = document.createElement("script");
      script.src = HLJS_URL;
      script.onload = () => resolve(window.hljs);
      script.onerror = () => resolve(null); // without colours the code is still readable
      document.head.appendChild(script);
    });
    return hljsPromise;
  }

  function enhanceRichContent(root) {
    if (!root) return;
    const blocks = [...root.querySelectorAll("pre")].filter(pre => !pre.closest(".code-block"));
    blocks.forEach(pre => {
      const wrapper = document.createElement("figure");
      wrapper.className = "code-block";
      wrapper.innerHTML = `
        <figcaption class="code-block-header">
          <span>${languageLabel(pre.dataset.lang)}</span>
          <button type="button" class="code-copy-button">COPY</button>
        </figcaption>`;
      pre.replaceWith(wrapper);
      wrapper.appendChild(pre);
      const button = wrapper.querySelector(".code-copy-button");
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(pre.textContent);
          button.textContent = "COPIED ✓";
        } catch {
          button.textContent = "COPY FAILED";
        }
        setTimeout(() => { button.textContent = "COPY"; }, 1600);
      });
    });

    root.querySelectorAll("table").forEach(table => {
      if (table.parentElement.classList.contains("table-scroll")) return;
      const scroll = document.createElement("div");
      scroll.className = "table-scroll";
      table.replaceWith(scroll);
      scroll.appendChild(table);
    });

    const toHighlight = blocks.filter(pre => pre.dataset.lang && pre.dataset.lang !== "plaintext");
    if (!toHighlight.length) return;
    loadHighlighter().then(hljs => {
      if (!hljs) return;
      toHighlight.forEach(pre => {
        const code = pre.querySelector("code");
        if (!code || !hljs.getLanguage(pre.dataset.lang)) return;
        code.innerHTML = hljs.highlight(code.textContent, { language: pre.dataset.lang }).value;
        code.classList.add("hljs");
      });
    });
  }

  window.setupRichBlocks = setupRichBlocks;
  window.enhanceRichContent = enhanceRichContent;
})();
