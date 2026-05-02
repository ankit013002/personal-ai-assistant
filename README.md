# Local Personal AI Assistant

A local-first TypeScript CLI assistant that reads and writes a personal workspace, talks to Ollama, and can optionally use local speech-to-text plus Kokoro text-to-speech.

## Setup

Install Node dependencies:

```bash
npm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Pull an Ollama model. For machines with limited RAM, `qwen2.5-coder:7b` is a practical first choice:

```bash
ollama pull qwen2.5-coder:7b
```

The originally suggested larger model can be used on machines with enough memory:

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
OLLAMA_MODEL=qwen2.5-coder:7b
OLLAMA_TIMEOUT_MS=180000
PRELOAD_WORKSPACE_ON_START=true
WARM_OLLAMA_ON_START=true
ASSISTANT_DATA_DIR=assistant_data

ENABLE_STT=false
VOICE_MODE=false
STT_PYTHON=python
STT_SCRIPT=stt/whisper_stt.py
STT_OUTPUT_DIR=assistant_data/audio
STT_MODEL=tiny
STT_MODE=vad
STT_RECORD_SECONDS=4
STT_MAX_RECORD_SECONDS=10
STT_SILENCE_SECONDS=1
STT_VAD_THRESHOLD=0.01

ENABLE_TTS=false
WARM_TTS_ON_START=true
TTS_WARMUP_TEXT=Ready to assist you.
TTS_PYTHON=python
TTS_SCRIPT=tts/kokoro_tts.py
TTS_OUTPUT_DIR=assistant_data/audio
TTS_VOICE=af_heart
TTS_SPEED=1
```

Change `OLLAMA_MODEL` to use another local model without changing code.

## Voice Input

Typed input works by default. For one-shot voice input, set:

```env
ENABLE_STT=true
```

Install local microphone recording and transcription dependencies:

```bash
python -m pip install sounddevice soundfile faster-whisper
```

Then run the app and type:

```text
/voice
```

By default, `STT_MODE=vad` listens until speech ends, up to `STT_MAX_RECORD_SECONDS`, then transcribes locally and sends the transcript to the agent. If it clips the beginning or misses speech, lower `STT_VAD_THRESHOLD`; if it starts recording room noise, raise it slightly. You can also set `STT_MODE=fixed` to record exactly `STT_RECORD_SECONDS` seconds.

For a voice-first loop, also set:

```env
VOICE_MODE=true
```

With `VOICE_MODE=true`, pressing Enter at an empty prompt records your voice. You can still type normally.

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

Install dependencies:

```bash
python -m pip install kokoro soundfile
```

The script is:

```bash
python tts/kokoro_tts.py --text "Hello from the assistant" --output-dir assistant_data/audio --voice af_heart --speed 1
```

The script tries to use `kokoro` and `soundfile`. If Kokoro is not installed yet, it writes a short placeholder WAV so the Node integration can still be tested.

## Voice Agent Flow

For full local voice interaction:

```env
ENABLE_STT=true
VOICE_MODE=true
ENABLE_TTS=true
```

Start the app:

```bash
npm run dev
```

Press Enter to speak, wait for transcription, then the assistant will answer and play TTS audio.

## Scripts

```bash
npm run dev
npm run build
npm run start
```
