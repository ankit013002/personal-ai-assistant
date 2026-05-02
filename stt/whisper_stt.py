import argparse
import math
import os
import time
import wave


def record_fixed_wav(path: str, seconds: float, sample_rate: int) -> None:
    try:
        import sounddevice as sd  # type: ignore
        import soundfile as sf  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "Recording requires sounddevice and soundfile. Install with: "
            "python -m pip install sounddevice soundfile"
        ) from exc

    print(f"Recording for {seconds:g}s...", flush=True)
    print("__STT_READY__", flush=True)
    audio = sd.rec(int(seconds * sample_rate), samplerate=sample_rate, channels=1, dtype="float32")
    sd.wait()
    sf.write(path, audio, sample_rate)


def record_vad_wav(
    path: str,
    max_seconds: float,
    sample_rate: int,
    silence_seconds: float,
    vad_threshold: float,
) -> None:
    try:
        import numpy as np  # type: ignore
        import sounddevice as sd  # type: ignore
        import soundfile as sf  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "Recording requires numpy, sounddevice, and soundfile. Install with: "
            "python -m pip install numpy sounddevice soundfile"
        ) from exc

    chunk_seconds = 0.1
    chunk_frames = int(sample_rate * chunk_seconds)
    max_chunks = max(1, math.ceil(max_seconds / chunk_seconds))
    silence_chunks_needed = max(1, math.ceil(silence_seconds / chunk_seconds))
    pre_roll_chunks = max(1, math.ceil(0.35 / chunk_seconds))

    chunks = []
    pre_roll = []
    speech_started = False
    silent_chunks = 0

    with sd.InputStream(samplerate=sample_rate, channels=1, dtype="float32") as stream:
        print(f"Listening until speech ends, up to {max_seconds:g}s...", flush=True)
        print("__STT_READY__", flush=True)
        for _ in range(max_chunks):
            audio, _ = stream.read(chunk_frames)
            rms = float(np.sqrt(np.mean(np.square(audio))))
            is_speech = rms >= vad_threshold

            if speech_started:
                chunks.append(audio.copy())
                if is_speech:
                    silent_chunks = 0
                else:
                    silent_chunks += 1
                    if silent_chunks >= silence_chunks_needed:
                        break
            else:
                pre_roll.append(audio.copy())
                pre_roll = pre_roll[-pre_roll_chunks:]
                if is_speech:
                    speech_started = True
                    chunks.extend(chunk.copy() for chunk in pre_roll)
                    silent_chunks = 0

    if not chunks:
      print("No clear speech detected; saving the full short buffer.", flush=True)
      chunks = pre_roll

    if not chunks:
        raise RuntimeError("No microphone audio was captured.")

    recorded = np.concatenate(chunks, axis=0)
    sf.write(path, recorded, sample_rate)


def ensure_wav(path: str) -> None:
    with wave.open(path, "rb") as wav:
        if wav.getnchannels() < 1 or wav.getframerate() < 8000:
            raise RuntimeError("Recorded audio is invalid or too low quality.")


def transcribe_with_faster_whisper(path: str, model_name: str) -> str:
    from faster_whisper import WhisperModel  # type: ignore

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(path, beam_size=5)
    return " ".join(segment.text.strip() for segment in segments).strip()


def transcribe_with_openai_whisper(path: str, model_name: str) -> str:
    import whisper  # type: ignore

    model = whisper.load_model(model_name)
    result = model.transcribe(path)
    return str(result.get("text", "")).strip()


def transcribe(path: str, model_name: str) -> str:
    try:
        return transcribe_with_faster_whisper(path, model_name)
    except Exception as faster_exc:
        try:
            return transcribe_with_openai_whisper(path, model_name)
        except Exception as whisper_exc:
            raise RuntimeError(
                "Transcription requires faster-whisper or openai-whisper. Install one of:\n"
                "  python -m pip install faster-whisper\n"
                "  python -m pip install openai-whisper\n"
                f"faster-whisper error: {faster_exc}\n"
                f"openai-whisper error: {whisper_exc}"
            ) from whisper_exc


def main() -> None:
    parser = argparse.ArgumentParser(description="Record microphone audio and transcribe it locally with Whisper.")
    parser.add_argument("--mode", choices=["fixed", "vad"], default="vad")
    parser.add_argument("--record-seconds", type=float, default=6)
    parser.add_argument("--max-record-seconds", type=float, default=10)
    parser.add_argument("--silence-seconds", type=float, default=1)
    parser.add_argument("--vad-threshold", type=float, default=0.01)
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument("--output-dir", default="assistant_data/audio")
    parser.add_argument("--model", default="base")
    parser.add_argument("--audio-path", default=None, help="Transcribe an existing WAV instead of recording.")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    audio_path = args.audio_path or os.path.abspath(
        os.path.join(args.output_dir, f"user_{int(time.time() * 1000)}.wav")
    )

    if args.audio_path is None:
        if args.mode == "fixed":
            record_fixed_wav(audio_path, args.record_seconds, args.sample_rate)
        else:
            record_vad_wav(
                audio_path,
                args.max_record_seconds,
                args.sample_rate,
                args.silence_seconds,
                args.vad_threshold,
            )

    ensure_wav(audio_path)
    transcript = transcribe(audio_path, args.model)
    print(transcript)


if __name__ == "__main__":
    main()
