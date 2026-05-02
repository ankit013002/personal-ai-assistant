import argparse
import math
import os
import struct
import time
import wave


def write_placeholder_wav(path: str, text: str) -> None:
    sample_rate = 24000
    duration = max(0.4, min(3.0, len(text) / 80))
    frames = int(sample_rate * duration)
    with wave.open(path, "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        for i in range(frames):
            sample = int(1200 * math.sin(2 * math.pi * 440 * i / sample_rate))
            wav.writeframes(struct.pack("<h", sample))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Kokoro TTS audio for assistant text.")
    parser.add_argument("--text", required=True)
    parser.add_argument("--output-dir", default="assistant_data/audio")
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--speed", type=float, default=1.0)
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    output_path = os.path.abspath(os.path.join(args.output_dir, f"assistant_{int(time.time() * 1000)}.wav"))

    try:
        from kokoro import KPipeline  # type: ignore
        import soundfile as sf  # type: ignore

        pipeline = KPipeline(lang_code="a")
        generator = pipeline(args.text, voice=args.voice, speed=args.speed)
        for _, _, audio in generator:
            sf.write(output_path, audio, 24000)
            break
    except Exception as exc:
        print(f"Kokoro unavailable, wrote placeholder WAV instead: {exc}", flush=True)
        write_placeholder_wav(output_path, args.text)

    print(output_path)


if __name__ == "__main__":
    main()
