import os
import glob
import uuid
import json
import shutil
import hashlib
import subprocess
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
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

app = FastAPI(title="University Academic Engine - Multi-Discipline")

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

def chunk_and_transcribe(audio_path: str, job_id: str):
    job_chunk_dir = os.path.join(CHUNKS_DIR, job_id)
    os.makedirs(job_chunk_dir, exist_ok=True)

    chunk_pattern = os.path.join(job_chunk_dir, "chunk_%03d.mp3")
    split_cmd = [
        "ffmpeg", "-y", "-i", audio_path,
        "-f", "segment", "-segment_time", "900", "-c", "copy", chunk_pattern
    ]
    subprocess.run(split_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    chunk_files = sorted(glob.glob(os.path.join(job_chunk_dir, "chunk_*.mp3")))
    formatted_segments = []
    formatted_transcript = ""
    current_time_offset = 0.0

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
            time_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}" if hours > 0 else f"{minutes:02d}:{seconds:02d}"

            formatted_transcript += f"[{time_str}] {seg['text']}\n"
            formatted_segments.append({
                "start": real_start,
                "timestamp": time_str,
                "text": seg['text'].strip()
            })

        current_time_offset += 900.0

    shutil.rmtree(job_chunk_dir, ignore_errors=True)
    return formatted_segments, formatted_transcript

def run_talk_pipeline(job_id: str, temp_video_path: str, filename: str, file_hash: str):
    try:
        if file_hash in CACHE:
            JOBS[job_id]["status"] = "completed"
            JOBS[job_id]["step"] = 4
            JOBS[job_id]["status_message"] = "Cached result found!"
            JOBS[job_id]["result"] = CACHE[file_hash]
            if os.path.exists(temp_video_path):
                os.remove(temp_video_path)
            return

        audio_filename = f"{job_id}_{os.path.splitext(filename)[0]}.mp3"
        temp_audio_path = os.path.join(UPLOAD_DIR, audio_filename)

        JOBS[job_id]["step"] = 1
        JOBS[job_id]["status_message"] = "Compressing recording with FFmpeg..."
        cmd = ["ffmpeg", "-y", "-i", temp_video_path, "-vn", "-ac", "1", "-b:a", "32k", temp_audio_path]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        orig_mb = os.path.getsize(temp_video_path) / (1024 * 1024)
        comp_mb = os.path.getsize(temp_audio_path) / (1024 * 1024)
        saved_pct = round(((orig_mb - comp_mb) / orig_mb) * 100, 1)

        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)

        JOBS[job_id]["step"] = 2
        JOBS[job_id]["status_message"] = "Transcribing lecture with Whisper AI..."
        formatted_segments, formatted_transcript = chunk_and_transcribe(temp_audio_path, job_id)

        JOBS[job_id]["step"] = 3
        JOBS[job_id]["status_message"] = "Analyzing academic discipline & structuring notes..."

        system_prompt = """
        You are an elite university teaching professor.
        Analyze this transcript and automatically detect the discipline (Computer Science, Physics, Chemistry, Mathematics, Law, Commerce, Engineering, or Humanities).
        Format the lecture notes with supreme clarity and structure using GitHub Markdown:

        ### 📚 1. Executive Summary
        Two-sentence summary of the core lecture thesis and academic discipline identified.

        ### 🚨 2. High-Yield Exam Signals
        List all specific warnings, marks, question structures, or hints given by the lecturer with their exact [MM:SS] timestamps.

        ### 📐 3. Academic Tools & Formulations
        - **If STEM/Maths/Physics/Chem**: Key laws, formulas in LaTeX ($$), chemical reactions, units, and constants.
        - **If Computer Science**: Algorithms, data structures, Big-O time/space complexities, and clean code blocks.
        - **If Law/Commerce**: Relevant acts, sections, standard case tests, and statutory requirements.

        ### 🔬 4. Deep-Dive Concepts & Worked Logic
        Break down the 3-4 major concepts taught with step-by-step logic.

        ### 📝 5. Essential Glossary
        Bullet point definitions of critical terms with timestamps.
        """

        summary_response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Lecture Transcript:\n\n{formatted_transcript[:60000]}"}
            ],
            temperature=0.1
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
        JOBS[job_id]["status_message"] = "Academic notes generated!"
        JOBS[job_id]["result"] = final_result

    except Exception as e:
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)


def run_math_pipeline(job_id: str, temp_file_path: str, filename: str, file_hash: str):
    try:
        if file_hash in CACHE:
            JOBS[job_id]["status"] = "completed"
            JOBS[job_id]["step"] = 4
            JOBS[job_id]["status_message"] = "Cached result found!"
            JOBS[job_id]["result"] = CACHE[file_hash]
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            return

        JOBS[job_id]["step"] = 1
        JOBS[job_id]["status_message"] = "Analyzing academic problem / document with Gemini..."
        
        prompt = """
        You are an elite university engineering and mathematics professor analyzing this problem or exam document.
        Produce a comprehensive, step-by-step master solution guide:
        1. 🧠 **Field & Governing Principles**: Identify module, physical laws, and methods required.
        2. 📐 **Problems in LaTeX**: Write each problem statement cleanly in LaTeX ($$).
        3. 🔢 **Complete Step-by-Step Derivation & Working**: Every algebraic step, substitution, and integral with detailed reasoning.
        4. 📊 **Examiner Marking Rubric**: Provide mark allocations for each step.
        5. ✅ **Final Verified Answers**: Highlight all final solutions with proper units or interpretations.
        """

        # Handle PDF vs Image
        if filename.lower().endswith(".pdf"):
            uploaded_doc = gemini_client.files.upload(file=temp_file_path)
            response = gemini_client.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=[uploaded_doc, prompt]
            )
        else:
            img = Image.open(temp_file_path)
            response = gemini_client.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=[img, prompt]
            )

        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

        final_result = {
            "mode": "math",
            "file_name": filename,
            "solution": response.text
        }

        CACHE[file_hash] = final_result
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["step"] = 4
        JOBS[job_id]["status_message"] = "Analysis complete!"
        JOBS[job_id]["result"] = final_result

    except Exception as e:
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)

# ----------------- EXAM & CHAT ROUTES -----------------

class QuizRequest(BaseModel):
    transcript: str
    difficulty: str

@app.post("/api/generate-exam")
async def generate_comprehensive_exam(req: QuizRequest):
    diff_label = "Challenging Final Examination" if req.difficulty == "exam" else "Midterm Class Test"

    prompt = f"""
    You are a university exam convener writing a {diff_label} paper based on this lecture transcript.
    You must generate BOTH Section A (Multiple Choice) and Section B (Long Structured Questions).

    Return ONLY a single valid JSON object with this EXACT structure (no markdown wrappers, no backticks):
    {{
      "exam_title": "{diff_label} - Faculty Paper",
      "total_marks": 35,
      "section_a_mcq": [
        {{
          "id": 1,
          "question": "Question text?",
          "options": ["A", "B", "C", "D"],
          "correct_index": 0,
          "marks": 5,
          "explanation": "Why this option is correct citing timestamp..."
        }}
      ],
      "section_b_long": [
        {{
          "id": 1,
          "question": "Long structured problem statement requiring calculation, derivation, algorithm, or essay argument.",
          "marks": 10,
          "rubric": [
            "2 marks: Stating the governing principle / formula",
            "5 marks: Step-by-step substitution and working",
            "3 marks: Final answer with correct units or concluding statement"
          ],
          "model_solution": "Complete, comprehensive step-by-step solution formatted with LaTeX or code blocks."
        }}
      ]
    }}

    Lecture Transcript:
    {req.transcript[:50000]}
    """

    res = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1
    )

    raw_text = res.choices[0].message.content.strip()
    if raw_text.startswith("```json"):
        raw_text = raw_text[7:]
    if raw_text.startswith("```"):
        raw_text = raw_text[3:]
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3]

    try:
        exam_data = json.loads(raw_text.strip())
        return exam_data
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse exam JSON.")

class ChatRequest(BaseModel):
    question: str
    transcript: str

@app.post("/api/chat")
async def chat_with_lecture(req: ChatRequest):
    prompt = f"""
    Answer the student's question based strictly on this lecture. Provide formula, code, or derivation where applicable.
    Always cite the exact timestamp (e.g. [14:20]).
    Transcript: {req.transcript[:50000]}
    Question: {req.question}
    """
    chat_res = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )
    return {"answer": chat_res.choices[0].message.content}

@app.post("/api/voice-chat")
async def voice_chat_with_lecture(
    audio: UploadFile = File(...),
    transcript: str = Form(...)
):
    temp_voice_path = os.path.join(UPLOAD_DIR, f"voice_q_{uuid.uuid4()}.mp3")
    with open(temp_voice_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    try:
        with open(temp_voice_path, "rb") as file:
            student_voice_text = groq_client.audio.transcriptions.create(
                file=(temp_voice_path, file.read()),
                model="whisper-large-v3",
                response_format="text"
            ).strip()

        prompt = f"""
        Answer the student's spoken question based strictly on this lecture transcript.
        Be concise, accurate, and always cite the exact timestamp (e.g. [14:20]).
        Show mathematical formulas or code where applicable.

        Lecture Transcript:
        {transcript[:50000]}

        Student Spoken Question:
        "{student_voice_text}"
        """

        chat_res = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )

        return {
            "user_question": student_voice_text,
            "answer": chat_res.choices[0].message.content
        }
    finally:
        if os.path.exists(temp_voice_path):
            os.remove(temp_voice_path)

# ----------------- BASE ROUTES -----------------

@app.get("/")
def home():
    return {"status": "online"}

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
        "status_message": "Hashing & preparing university media pipeline...",
        "result": None,
        "error": None
    }
    background_tasks.add_task(run_talk_pipeline, job_id, temp_video_path, file.filename, file_hash)
    return {"job_id": job_id, "status": "processing"}

@app.post("/api/process/math")
async def start_math_job(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    temp_file_path = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_hash = calculate_file_hash(temp_file_path)
    JOBS[job_id] = {
        "status": "processing",
        "step": 0,
        "status_message": "Loading academic document or board capture...",
        "result": None,
        "error": None
    }
    background_tasks.add_task(run_math_pipeline, job_id, temp_file_path, file.filename, file_hash)
    return {"job_id": job_id, "status": "processing"}

@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    return JOBS[job_id]