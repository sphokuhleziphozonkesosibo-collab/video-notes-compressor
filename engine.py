import os
import subprocess
from dotenv import load_dotenv
from groq import Groq

# Load environment variables
load_dotenv()
api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    print("[ERROR] GROQ_API_KEY not found in .env file!")
    exit(1)

client = Groq(api_key=api_key)

def step1_compress_video(video_path: str, output_audio: str = "compressed_audio.mp3") -> str:
    """Uses FFmpeg to strip video and compress audio to 32kbps mono MP3."""
    print(f"\n[Step 1] Compressing video: '{video_path}'...")
    
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",           # No video, audio only
        "-ac", "1",      # Mono channel
        "-b:a", "32k",   # 32 kbps bitrate (low file size for human voice)
        output_audio
    ]
    
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    
    orig_mb = os.path.getsize(video_path) / (1024 * 1024)
    comp_mb = os.path.getsize(output_audio) / (1024 * 1024)
    print(f"       -> Original Video: {orig_mb:.2f} MB")
    print(f"       -> Compressed Audio: {comp_mb:.2f} MB")
    print(f"       -> Data saved: {((orig_mb - comp_mb) / orig_mb) * 100:.1f}%")
    return output_audio

def step2_transcribe_audio(audio_path: str) -> str:
    """Sends compressed audio to Whisper for timed transcription."""
    print(f"\n[Step 2] Transcribing '{audio_path}' with Whisper...")
    
    with open(audio_path, "rb") as file:
        response = client.audio.transcriptions.create(
            file=(audio_path, file.read()),
            model="whisper-large-v3",
            response_format="verbose_json",
            timestamp_granularities=["segment"]
        )
    
    # Format the transcript with readable timestamps [MM:SS]
    formatted_transcript = ""
    for segment in response.segments:
        start_min, start_sec = divmod(int(segment['start']), 60)
        formatted_transcript += f"[{start_min:02d}:{start_sec:02d}] {segment['text']}\n"
    
    print(f"       -> Successfully transcribed {len(response.segments)} speech segments.")
    return formatted_transcript

def step3_generate_notes(transcript: str) -> str:
    """Feeds the timed transcript into the LLM Brain to extract exam notes."""
    print("\n[Step 3] Analyzing transcript and generating exam notes...")
    
    system_prompt = """
    You are an expert university lecture summarizer. 
    Analyze the lecture transcript with timestamps and produce clean, highly structured Markdown notes:

    1. 📌 **Core Concept (Plain English)**: What is this lecture about in 2 sentences?
    2. 🚨 **Exam Warnings**: Any specific warnings, marks, or hints the lecturer mentioned with their exact timestamp.
    3. 📐 **Key Rules / Formulas**: Any formulas or strict rules mentioned.
    4. 📝 **Key Definitions**: Clean bullet points.
    """
    
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Here is the lecture transcript:\n\n{transcript}"}
        ],
        temperature=0.2
    )
    
    return response.choices[0].message.content

if __name__ == "__main__":
    VIDEO_FILE = "lecture.mp4"
    
    # If lecture.mp4 is missing, create a real MP4 video using sample.mp3 + FFmpeg
    if not os.path.exists(VIDEO_FILE):
        print(f"[*] '{VIDEO_FILE}' not found. Generating a local test video from 'sample.mp3'...")
        make_video_cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=navy:s=640x360:d=11",
            "-i", "sample.mp3",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-shortest",
            VIDEO_FILE
        ]
        subprocess.run(make_video_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        print("[*] Local test video 'lecture.mp4' created successfully!")

    # Execute Pipeline
    audio_file = step1_compress_video(VIDEO_FILE)
    transcript_text = step2_transcribe_audio(audio_file)
    lecture_notes = step3_generate_notes(transcript_text)
    
    # Save the output
    OUTPUT_FILE = "lecture_notes.md"
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(lecture_notes)
        
    print(f"\n[DONE!] Notes successfully saved to '{OUTPUT_FILE}'.")