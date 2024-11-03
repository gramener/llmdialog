import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@1.2.2";
import { fetchText } from "https://cdn.jsdelivr.net/npm/asyncsse@1/dist/fetchtext.js";
import { gemini } from "https://cdn.jsdelivr.net/npm/asyncllm@1/dist/gemini.js";
import { anthropic } from "https://cdn.jsdelivr.net/npm/asyncllm@1/dist/anthropic.js";

const $demos = document.querySelector("#demos");
const $dialogForm = document.querySelector("#dialog-form");
const $dialogResult = document.querySelector("#dialog-result");
const $dialogRun = document.querySelector("#dialog-run");
const $dialogReset = document.querySelector("#dialog-reset");
const $dialogHistory = document.querySelector("#dialog-history");
const marked = new Marked();
let dialogId = null;
const dialog = [];
let headers;

const urls = {
  groq: () => `https://llmfoundry.straive.com/groq/openai/v1/chat/completions`,
  openai: () => `https://llmfoundry.straive.com/openai/v1/chat/completions`,
  anthropic: () => `https://llmfoundry.straive.com/anthropic/v1/messages`,
  gemini: (model) => `https://llmfoundry.straive.com/gemini/v1beta/models/${model}:streamGenerateContent?alt=sse`,
  azure: (model) =>
    `https://llmfoundry.straive.com/azure/openai/deployments/${model}/chat/completions?api-version=2024-05-01-preview`,
  openrouter: () => `https://llmfoundry.straive.com/openrouter/v1/chat/completions`,
  deepseek: () => `https://llmfoundry.straive.com/deepseek/chat/completions`,
};
const adapters = {
  gemini,
  anthropic,
  groq: (d) => d,
  openai: (d) => d,
  azure: (d) => d,
  openrouter: (d) => d,
  deepseek: (d) => d,
};

const loading = html`<div class="text-center mx-auto my-5">
  <div class="spinner-border" role="status"></div>
</div>`;

const db = await new Promise((resolve, reject) => {
  const request = indexedDB.open("llmdialog", 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
  request.onupgradeneeded = (e) => {
    e.target.result.createObjectStore("chats", { keyPath: "id" });
  };
});

fetch("https://llmfoundry.straive.com/token", { credentials: "include" })
  .then((res) => res.json())
  .then(
    ({ token }) =>
      (headers = {
        Authorization: `Bearer ${token}:llmdialog`,
        "Content-Type": "application/json",
      })
  );

render(loading, $demos);
await fetch("config.json")
  .then((res) => res.json())
  .then(({ models, demos }) => {
    for (let $model of document.querySelectorAll("select[name^=model]"))
      render(
        Object.entries(models).map(([name, model]) => html`<option value="${model}">${name}</option>`),
        $model
      );

    render(
      [
        ...demos.map(
          ({ icon, title, body, ...demo }) => html`
            <div class="col py-3">
              <a class="demo card h-100 text-decoration-none" href="#" data-demo="${JSON.stringify(demo)}">
                <div class="card-body">
                  <i class="bi ${icon} fs-2 text-primary mb-3"></i>
                  <h5 class="card-title">${title}</h5>
                  <p class="card-text">${body}</p>
                </div>
              </a>
            </div>
          `
        ),
        html`<div class="col py-3">
          <label for="json-upload" class="demo card h-100 cursor-pointer">
            <div class="card-body d-flex flex-column justify-content-center align-items-center">
              <i class="bi bi-upload fs-2 text-primary mb-3"></i>
              <h5 class="card-title">Upload your JSON</h5>
            </div>
          </label>
          <input type="file" id="json-upload" accept=".json" class="d-none" />
        </div>`,
      ],
      $demos
    );
  });

$demos.addEventListener("click", (e) => {
  const $demo = e.target.closest("[data-demo]");
  if ($demo) {
    e.preventDefault();
    drawChat({ config: JSON.parse($demo.dataset.demo), dialog: [] }, true);
    $dialogForm.dispatchEvent(new Event("submit", { bubbles: true }));
  }
});

$demos.addEventListener("change", (e) => {
  const $upload = e.target.closest("#json-upload");
  if ($upload) {
    const file = $upload.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => drawChat(JSON.parse(e.target.result), false);
    reader.readAsText(file);
  }
});

$dialogForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  $dialogRun.disabled = true;
  const formData = new FormData($dialogForm);

  if (dialog.length == 0) dialog.push([0, formData.get("chat0")]);

  const n = +(formData.get("n") || 5);
  const turn = (dialog.at(-1)[0] + 1) % 2;
  const [source, model] = formData.get(`model${turn}`).split(":");
  const messages = [
    { role: "system", content: formData.get(`prompt${turn}`) },
    ...dialog.slice(-n * 2 + 1).map(([user, text], i) => ({
      role: (user + turn) % 2 ? "user" : "assistant",
      content: text,
    })),
  ];
  const body = JSON.stringify(
    adapters[source]({
      model,
      messages,
      max_tokens: 4096,
      stream: true,
      stream_options: { include_usage: true },
      temperature: +formData.get(`temperature${turn}`),
    })
  );

  dialog.push([turn, "<div class='spinner-border'></div>"]);
  drawDialog();
  const last = dialog.length - 1;
  let response, fetchResponse;
  for await (response of asyncLLM(
    urls[source](model),
    {
      method: "POST",
      headers,
      body,
    },
    { onResponse: (response) => (fetchResponse = response) }
  )) {
    dialog[last][1] = response.error ? `ERROR: ${response.error}` : response.content;
    drawDialog();
  }
  saveDialog({ id: dialogId, dialog, config: Object.fromEntries(formData) });
  drawHistory();
  $dialogRun.disabled = false;
  $dialogRun.focus();
  $dialogRun.scrollIntoViewIfNeeded({ behavior: "smooth", block: "end" });
});

function drawDialog() {
  const names = [...$dialogForm.querySelectorAll("[name^=name]")].map((el) => el.value);
  render(
    html`<table class="table">
      <tbody>
        ${dialog.map(
          ([turn, text], i) =>
            html`<tr class="bot-${turn}" data-id="${i}">
              <td class="table-primary">${names[turn]}</td>
              <td>${unsafeHTML(marked.parse(text))}</td>
              <td>
                <button type="button" class="btn btn-sm btn-outline-danger delete"><i class="bi bi-trash"></i></button>
              </td>
            </tr>`
        )}
      </tbody>
    </table>`,
    $dialogResult
  );
}

$dialogResult.addEventListener("click", (e) => {
  const $delete = e.target.closest(".delete");
  if ($delete) {
    const $chat = $delete.closest("[data-id]");
    dialog.splice($chat.dataset.id, 1);
    drawDialog();
  }
});

$dialogReset.addEventListener("click", (e) => {
  e.preventDefault();
  startNewDialog();
  drawDialog();
});

function startNewDialog() {
  dialogId = Date.now();
  dialog.length = 0;
}

async function saveDialog(chat) {
  const store = db.transaction("chats", "readwrite").objectStore("chats");
  await store.put(chat);
}

async function drawHistory() {
  const store = db.transaction("chats", "readonly").objectStore("chats");
  const chats = await new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // sort chats by date, latest first
  chats.sort((a, b) => b.id - a.id);

  render(
    html`
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Model</th>
            <th>Prompt</th>
          </tr>
        </thead>
        <tbody>
          ${chats.flatMap((chat) => [
            html`<tr data-id="${chat.id}" class="h-100">
              <td rowspan="2" class="h-100">
                <div class="d-flex flex-column justify-content-between h-100">
                  <div>
                    ${new Date(chat.id).toLocaleDateString("en-US", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>
                  <div>
                    <button type="button" class="btn btn-sm btn-outline-primary download-chat" data-id="${chat.id}">
                      <i class="bi bi-download"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger delete-chat" data-id="${chat.id}">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </td>
              <td class="border-0">${chat.config.name0}</td>
              <td class="border-0 text-nowrap">${chat.config.model0?.split(":")[1] || ""}</td>
              <td class="border-0">${chat.config.prompt0}</td>
            </tr>`,
            html`<tr data-id="${chat.id}">
              <td>${chat.config.name1}</td>
              <td class="text-nowrap">${chat.config.model1?.split(":")[1] || ""}</td>
              <td>${chat.config.prompt1}</td>
            </tr>`,
          ])}
        </tbody>
      </table>
    `,
    $dialogHistory
  );
}

drawHistory();

$dialogHistory.addEventListener("click", async (e) => {
  e.preventDefault();
  const chatId = +e.target.closest("[data-id]").dataset.id;
  if (e.target.closest(".delete-chat")) {
    const store = db.transaction("chats", "readwrite").objectStore("chats");
    await store.delete(chatId);
    drawHistory();
  } else if (e.target.closest(".download-chat")) {
    const chat = await getChat(chatId);
    const blob = new Blob([JSON.stringify(chat)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llmdialog-${chatId}.json`;
    a.click();
  } else {
    drawChat(await getChat(chatId), false);
  }
});

async function getChat(chatId) {
  const store = db.transaction("chats", "readonly").objectStore("chats");
  return await new Promise((resolve, reject) => {
    const request = store.get(chatId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function setConfig(config) {
  for (const [key, value] of Object.entries(config)) {
    const $el = $dialogForm.querySelector(`[name="${key}"]`);
    if ($el) {
      $el.value = value;
      $el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
}

function drawChat(chat, focus = false) {
  setConfig(chat.config);
  startNewDialog();
  dialog.push(...chat.dialog);
  drawDialog();
  if (focus) {
    $dialogRun.focus();
    $dialogRun.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    $dialogResult.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
