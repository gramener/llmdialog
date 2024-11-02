import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@1";
import { gemini } from "https://cdn.jsdelivr.net/npm/asyncllm@1/dist/gemini.js";
import { anthropic } from "https://cdn.jsdelivr.net/npm/asyncllm@1/dist/anthropic.js";

const $demos = document.querySelector("#demos");
const $dialogForm = document.querySelector("#dialog-form");
const $dialogResult = document.querySelector("#dialog-result");
const $dialogReset = document.querySelector("#dialog-reset");
const marked = new Marked();
const conversation = [];
let headers;

const urls = {
  groq: () => `https://llmfoundry.straive.com/groq/openai/v1/chat/completions`,
  openai: () => `https://llmfoundry.straive.com/openai/v1/chat/completions`,
  anthropic: () => `https://llmfoundry.straive.com/anthropic/v1/messages`,
  gemini: (model) =>
    `https://llmfoundry.straive.com/gemini/v1beta/models/${model}:streamGenerateContent?alt=sse`,
  azure: (model) =>
    `https://llmfoundry.straive.com/azure/openai/deployments/${model}/chat/completions?api-version=2024-05-01-preview`,
  openrouter: () =>
    `https://llmfoundry.straive.com/openrouter/v1/chat/completions`,
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

fetch("https://llmfoundry.straive.com/token", { credentials: "include" })
  .then((res) => res.json())
  .then(
    ({ token }) =>
      (headers = {
        Authorization: `Bearer ${token}:llmdialog`,
        "Content-Type": "application/json",
      }),
  );

render(loading, $demos);
await fetch("config.json")
  .then((res) => res.json())
  .then(({ models, demos }) => {
    for (let $model of document.querySelectorAll("select[name^=model]"))
      render(
        Object.entries(models).map(
          ([name, model]) => html`<option value="${model}">${name}</option>`,
        ),
        $model,
      );

    render(
      demos.map(
        ({ icon, title, body, ...demo }) => html`
          <div class="col py-3">
            <a
              class="demo card h-100 text-decoration-none"
              href="#"
              data-demo="${JSON.stringify(demo)}"
            >
              <div class="card-body">
                <i class="bi ${icon} fs-2 text-primary mb-3"></i>
                <h5 class="card-title">${title}</h5>
                <p class="card-text">${body}</p>
              </div>
            </a>
          </div>
        `,
      ),
      $demos,
    );
  });

$demos.addEventListener("click", (e) => {
  const $demo = e.target.closest("[data-demo]");
  if ($demo) {
    e.preventDefault();
    // Set form values from demo
    for (const [key, value] of Object.entries(JSON.parse($demo.dataset.demo))) {
      const $el = $dialogForm.querySelector(`[name="${key}"]`);
      console.log(key, value, $el);
      if ($el) {
        $el.value = value;
        $el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    // Clear conversation
    conversation.length = 0;
    draw();
  }
});

$dialogForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData($dialogForm);
  if (conversation.length == 0) conversation.push([0, formData.get("chat0")]);

  const turn = (conversation.at(-1)[0] + 1) % 2;
  const [source, model] = formData.get(`model${turn}`).split(":");
  const messages = [
    { role: "system", content: formData.get(`prompt${turn}`) },
    ...conversation.map(([user, text], i) => ({
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
      temperature: 0,
    }),
  );

  conversation.push([turn, "..."]);
  draw();
  const n = conversation.length - 1;
  let response;
  for await (response of asyncLLM(urls[source](model), {
    method: "POST",
    headers,
    body,
  })) {
    conversation[n][1] = response.content;
    draw();
  }
});

function draw() {
  const names = [...$dialogForm.querySelectorAll("[name^=name]")].map(
    (el) => el.value,
  );
  render(
    html`<table class="table">
      <tbody>
        ${conversation.map(
          ([turn, text], i) =>
            html`<tr class="bot-${turn}" data-id="${i}">
              <td class="table-primary">${names[turn]}</td>
              <td>${unsafeHTML(marked.parse(text))}</td>
              <td>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger delete"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>`,
        )}
      </tbody>
    </table>`,
    $dialogResult,
  );
}

$dialogResult.addEventListener("click", (e) => {
  const $delete = e.target.closest(".delete");
  if ($delete) {
    const $chat = $delete.closest("[data-id]");
    conversation.splice($chat.dataset.id, 1);
    draw();
  }
});

$dialogReset.addEventListener("click", (e) => {
  e.preventDefault();
  conversation.length = 0;
  draw();
});
