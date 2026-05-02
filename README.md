# Local Personal AI Assistant MVP

A local-first TypeScript CLI assistant that reads and writes a small personal workspace, talks to Ollama, and can optionally generate Kokoro TTS audio.

## Setup

Install Node dependencies:

```bash
npm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Pull the suggested Ollama model:

```bash
ollama pull qwen3-coder-next
```

Make sure Ollama is running:

```bash
ollama serve
```

Run the assistant:

```bash
npm run dev
```

Try:

```text
What do I need to do today?
```

## Configuration

`.env` values:

```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3-coder-next
ASSISTANT_DATA_DIR=assistant_data
ENABLE_TTS=false
TTS_PYTHON=python
TTS_SCRIPT=tts/kokoro_tts.py
TTS_OUTPUT_DIR=assistant_data/audio
```

Change `OLLAMA_MODEL` to use another local model without changing code.

## Workspace

The assistant is scoped to `assistant_data`:

- `profile.md` for stable information about you
- `projects.md` for active projects
- `tasks.json` for structured tasks
- `daily.md` for current day notes
- `memory.md` for long-term assistant memory
- `inbox.md` for unprocessed thoughts

The model can request tools, but the app validates and executes them. The first MVP does not allow shell execution.

## Kokoro TTS

TTS is optional. To enable it, install Kokoro dependencies in your Python environment, then set:

```env
ENABLE_TTS=true
```

The script is:

```bash
python tts/kokoro_tts.py --text "Hello from the assistant" --output-dir assistant_data/audio
```

The script tries to use `kokoro` and `soundfile`. If Kokoro is not installed yet, it writes a short placeholder WAV so the Node integration can still be tested.

## Scripts

```bash
npm run dev
npm run build
npm run start
```
