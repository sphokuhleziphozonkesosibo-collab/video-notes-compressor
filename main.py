import os
import glob
import uuid
import shutil
import hashlib
import subprocess
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from PIL import Image
from groq import Groq
from google import genai

load_dotenv()
groq_key = os.getenv("GROQ_API_KEY")
gemini_key = os.getenv("GEMINI_API_KEY")

if not groq_key or not gemini_key:
    raise RuntimeError("Missing GROQ_API_KEY or GEMINI_API_KEY in .env file!")

groq_client = Groq(api_key=groq_key)
gemini_client = genai.Client(api_key=gemini_key)

app = FastAPI(title="Top 1% Lecture Compressor - 3-Hour Marathon Edition")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
CHUNKS_DIR = "chunks"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHUNKS_DIR, exist_ok=True)

app.mount("/audio", StaticFiles(directory=UPLOAD_DIR), name="audio")

JOBS = {}
CACHE = {}

def calculate_file_hash(filepath: str) -> str:
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            sha256.update(chunk)
    return sha256.hexdigest()

def chunk_and_transcribe_long_audio(audio_path: str, job_id: str):
    """
    Slices any length audio into 15-minute chunks using FFmpeg so Groq's 
    25MB limit is NEVER exceeded, even for 3-hour or 4-hour lectures.
    """
    job_chunk_dir = os.path.join(CHUNKS_DIR, job_id)
    os.makedirs(job_chunk_dir, exist_ok=True)

    # 15 minutes = 900 seconds
    chunk_pattern = os.path.join(job_chunk_dir, "chunk_%03d.mp3")
    split_cmd = [
        "ffmpeg", "-y",
        "-i", audio_path,
        "-f", "segment",
        "-segment_time", "900",
        "-c", "copy",
        chunk_pattern
    ]
    subprocess.run(split_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    chunk_files = sorted(glob.glob(os.path.join(job_chunk_dir, "chunk_*.mp3")))
    
    formatted_segments = []
    formatted_transcript = ""
    current_time_offset = 0.0

    # Process each 15-minute slice
    for idx, chunk_file in enumerate(chunk_files):
        with open(chunk_file, "rb") as file:
            transcription = groq_client.audio.transcriptions.create(
                file=(chunk_file, file.read()),
                model="whisper-large-v3",
                response_format="verbose_json",
                timestamp_granularities=["segment"]
            )

        for seg in transcription.segments:
            real_start = int(seg['start'] + current_time_offset)
            hours, remainder = divmod(real_start, 3600)
            minutes, seconds = divmod(remainder, 60)
            
            if hours > 0:
                time_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            else:
                time_str = f"{minutes:02d}:{seconds:02d}"

            formatted_transcript += f"[{time_str}] {seg['text']}\n"
            formatted_segments.append({
                "start": real_start,
                "timestamp": time_str,
                "text": seg['text'].strip()
            })

        # Advance offset by 15 mins (or actual chunk duration)
        current_time_offset += 900.0

    # Cleanup chunk files to save disk space
    shutil.rmtree(job_chunk_dir, ignore_errors=True)
    return formatted_segments, formatted_transcript

# ----------------- BACKGROUND WORKER -----------------

def run_talk_pipeline(job_id: str, temp_video_path: str, filename: str, file_hash: str):
    try:
        if file_hash in CACHE:
            JOBS[job_id]["status"] = "completed"
            JOBS[job_id]["step"] = 4
            JOBS[job_id]["status_message"] = "Cached result found! Loaded in 0.05s."
            JOBS[job_id]["result"] = CACHE[file_hash]
            if os.path.exists(temp_video_path):
                os.remove(temp_video_path)
            return

        audio_filename = f"{job_id}_{os.path.splitext(filename)[0]}.mp3"
        temp_audio_path = os.path.join(UPLOAD_DIR, audio_filename)

        # Stage 1: Compress Video
        JOBS[job_id]["step"] = 1
        JOBS[job_id]["status_message"] = "Compressing 2-3 hour recording to low-bitrate taxi audio..."
        
        cmd = [
            "ffmpeg", "-y",
            "-i", temp_video_path,
            "-vn", "-ac", "1", "-b:a", "32k",
            temp_audio_path
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        orig_mb = os.path.getsize(temp_video_path) / (1024 * 1024)
        comp_mb = os.path.getsize(temp_audio_path) / (1024 * 1024)
        saved_pct = round(((orig_mb - comp_mb) / orig_mb) * 100, 1)

        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)

        # Stage 2: 15-Minute Chunked Whisper Transcription
        JOBS[job_id]["step"] = 2
        JOBS[job_id]["status_message"] = "Transcribing long lecture with multi-chunk Whisper..."
        
        formatted_segments, formatted_transcript = chunk_and_transcribe_long_audio(temp_audio_path, job_id)

        # Stage 3: LLM Synthesis with SA Code-Switching handling
        JOBS[job_id]["step"] = 3
        JOBS[job_id]["status_message"] = "Extracting exam warnings & translating code-switching..."
        
        system_prompt = """
        You are an expert university lecture summarizer for students in South Africa (UKZN, UJ, Wits, DUT).
        Analyze the lecture transcript with timestamps and produce clean, highly structured Markdown notes:

        1. 📌 **Core Concept (Plain English)**: What is this lecture about in 2 sentences?
        2. 🚨 **Exam Warnings**: Any specific warnings, marks, or hints the lecturer mentioned with their exact timestamp (e.g. [45:10]).
        3. 📐 **Key Rules / Formulas**: Any formulas or strict rules mentioned. Include timestamps.
        4. 📝 **Key Definitions**: Clean bullet points with timestamps.
        5. 🇿🇦 **Code-Switching Adaptation**: If the lecturer mixed English with isiZulu or Afrikaans colloquialisms, accurately translate the meaning into clean academic English notes while keeping the exact timestamp.
        """

        summary_response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Here is the lecture transcript:\n\n{formatted_transcript[:60000]}"}
            ],
            temperature=0.2
        )

        final_result = {
            "mode": "talk",
            "file_name": filename,
            "audio_url": f"http://127.0.0.1:8000/audio/{audio_filename}",
            "audio_size_mb": round(comp_mb, 2),
            "data_saved_pct": saved_pct,
            "segments": formatted_segments,
            "transcript": formatted_transcript,
            "notes": summary_response.choices[0].message.content
        }

        CACHE[file_hash] = final_result
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["step"] = 4
        JOBS[job_id]["status_message"] = "3-Hour Pipeline Complete!"
        JOBS[job_id]["result"] = final_result

    except Exception as e:
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)


def run_math_pipeline(job_id: str, temp_img_path: str, filename: str, file_hash: str):
    try:
        if file_hash in CACHE:
            JOBS[job_id]["status"] = "completed"
            JOBS[job_id]["step"] = 4
            JOBS[job_id]["status_message"] = "Cached result found!"
            JOBS[job_id]["result"] = CACHE[file_hash]
            if os.path.exists(temp_img_path):
                os.remove(temp_img_path)
            return

        JOBS[job_id]["step"] = 1
        JOBS[job_id]["status_message"] = "Analyzing whiteboard handwriting & algebraic steps..."
        
        img = Image.open(temp_img_path)
        prompt = """
        You are an expert university mathematics assistant analyzing a lecture whiteboard.
        Produce structured study notes:
        1. 🧠 **Method Detected**: Technique used (e.g., Factorization, Integration by Parts, Substitution).
        2. 📐 **Problem in LaTeX**: Write initial problem cleanly ($$ format).
        3. 🔢 **Step-by-Step Working**: Every single algebraic step with reasoning (Formula -> Substitution -> Simplification -> Answer).
        4. ✅ **Final Answer**: The final roots/solution.
        """

        response = gemini_client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=[img, prompt]
        )

        if os.path.exists(temp_img_path):
            os.remove(temp_img_path)

        final_result = {
            "mode": "math",
            "file_name": filename,
            "solution": response.text
        }

        CACHE[file_hash] = final_result
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["step"] = 4
        JOBS[job_id]["status_message"] = "Math extraction complete!"
        JOBS[job_id]["result"] = final_result

    except Exception as e:
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)

# ----------------- CHAT WITH LECTURE (FEATURE #5) -----------------

class ChatRequest(BaseModel):
    question: str
    transcript: str

@app.post("/api/chat")
async def chat_with_lecture(req: ChatRequest):
    """Answers any student question directly from the lecture transcript with clickable timestamps."""
    prompt = f"""
    You are an intelligent teaching assistant for this specific university lecture.
    Answer the student's question ONLY using the transcript below.
    Always cite the exact timestamp (e.g. [14:20]) where the lecturer explained it so the student can jump to the audio.
    If it's a math or accounting question, show the formula or method used.

    Lecture Transcript:
    {req.transcript[:50000]}

    Student Question:
    {req.question}
    """

    chat_res = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )

    return {"answer": chat_res.choices[0].message.content}

# ----------------- ROUTES -----------------

@app.get("/")
def home():
    return {"status": "online", "cache_size": len(CACHE)}

@app.post("/api/process/talk")
async def start_talk_job(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    temp_video_path = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")

    with open(temp_video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_hash = calculate_file_hash(temp_video_path)

    JOBS[job_id] = {
        "status": "processing",
        "step": 0,
        "status_message": "Hashing file & preparing 3-hour processing pipeline...",
        "result": None,
        "error": None
    }

    background_tasks.add_task(run_talk_pipeline, job_id, temp_video_path, file.filename, file_hash)
    return {"job_id": job_id, "status": "processing"}

@app.post("/api/process/math")
async def start_math_job(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    temp_img_path = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")

    with open(temp_img_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_hash = calculate_file_hash(temp_img_path)

    JOBS[job_id] = {
        "status": "processing",
        "step": 0,
        "status_message": "Checking cache and loading board image...",
        "result": None,
        "error": None
    }

    background_tasks.add_task(run_math_pipeline, job_id, temp_img_path, file.filename, file_hash)
    return {"job_id": job_id, "status": "processing"}

@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    return JOBS[job_id]