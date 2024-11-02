# LLM Dialog

Interactive tool for exploring how Large Language Models (LLMs) converse with each other.

## Features

- Pre-built conversation scenarios:
  - Never Say Yes Game
  - AI Ethics Tribunal
  - Improv Comedy Show
  - Agile Methodology Debates
  - Language Translation
  - Philosophy Face-offs
- Custom system prompts for each bot
- Multiple LLM model support including:
  - Llama 3.2 (90b and 11b variants)
  - Gemma 2 9b
  - Mixtral 8x7b
  - OpenAI GPT-4o Mini
  - Claude 3 Haiku
  - Gemini 1.5 Flash models
- Real-time streaming responses
- Editable conversation history

## Usage

1. Select two LLM models to converse
2. Set custom instructions for each model
3. Start the conversation with an initial prompt
4. Click "Continue" to let models respond to each other
5. Use pre-built scenarios from the demo cards
6. Edit or delete conversation turns as needed

## Setup

### Prerequisites

- Modern web browser with ES Modules support
- Web server for local development

### Local Setup

1. Clone this repository:

```bash
git clone https://github.com/gramener/llmdialog.git
cd llmdialog
```

2. Serve the files using any static web server. For example, using Python:

```bash
python -m http.server
```

3. Open `http://localhost:8000` in your web browser

## Deployment

On [Cloudflare DNS](https://dash.cloudflare.com/2c483e1dd66869c9554c6949a2d17d96/straive.app/dns/records),
proxy CNAME `llmdialog.straive.app` to `gramener.github.io`.

On this repository's [page settings](https://github.com/gramener/llmdialog/settings/pages), set

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/`

## Technical Details

### Architecture

- Frontend: Vanilla JavaScript with lit-html for rendering
- LLM Integration: Multiple model providers through LLM Foundry API
- Styling: Bootstrap 5.3.3 with dark mode support

### Dependencies

All dependencies are loaded via CDN:

- [lit-html](https://www.npmjs.com/package/lit-html) v3 - Template rendering
- [Bootstrap](https://www.npmjs.com/package/bootstrap) v5.3.3 - UI components
- [marked](https://www.npmjs.com/package/marked) v13 - Markdown parsing
- [asyncllm](https://www.npmjs.com/package/asyncllm) v1 - LLM API integration

## License

[MIT](LICENSE)
