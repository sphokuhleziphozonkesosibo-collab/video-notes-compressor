"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { 
  FileVideo, 
  FileText, 
  UploadCloud, 
  Sparkles, 
  Copy, 
  Check, 
  Loader2, 
  BookOpen, 
  AlertCircle, 
  Headphones, 
  Download, 
  Search, 
  Printer, 
  Layers, 
  MessageSquare, 
  Send, 
  Sun, 
  Moon, 
  GraduationCap, 
  Eye, 
  Mic, 
  Square,
  Link as LinkIcon,
  ShieldCheck,
  PenTool,
  Folder,
  Plus,
  Trash2,
  Lock,
  User,
  LogOut
} from "lucide-react";

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  
  // Student Auth State
  const [studentToken, setStudentToken] = useState<string | null>(null);
  const [studentInfo, setStudentInfo] = useState<{ email: string; university: string } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUni, setAuthUni] = useState("University of KwaZulu-Natal (UKZN)");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Ingestion Modes: "talk" | "url" | "math" | "homework"
  const [mode, setMode] = useState<"talk" | "url" | "math" | "homework">("url");
  const [file, setFile] = useState<File | null>(null);
  const [lectureUrl, setLectureUrl] = useState("");
  const [homeworkProblem, setHomeworkProblem] = useState("");

  // Workspaces: "notes" | "flashcards" | "exam" | "audio" | "tutor"
  const [activeTab, setActiveTab] = useState<"notes" | "flashcards" | "exam" | "audio" | "tutor">("notes");
  
  // Pipeline State
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Result
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Audio Playback
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Dynamic Module Library
  const [modules, setModules] = useState<Array<{ code: string; name: string }>>([]);
  const [activeModule, setActiveModule] = useState<{ code: string; name: string } | null>(null);
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [newModuleCode, setNewModuleCode] = useState("");
  const [newModuleName, setNewModuleName] = useState("");

  // Flashcards Spaced Repetition
  const [flashcards, setFlashcards] = useState<Array<{ front: string; back: string; flipped: boolean; mastered: boolean }>>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);

  // Exam State
  const [examDifficulty, setExamDifficulty] = useState<"test" | "exam">("exam");
  const [examData, setExamData] = useState<any>(null);
  const [examLoading, setExamLoading] = useState(false);

  // Chat & Voice Recording State
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "ai"; text: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load User Data & Token on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("app_theme") as "light" | "dark" | null;
    if (savedTheme) setTheme(savedTheme);

    const token = localStorage.getItem("student_auth_token");
    if (token) {
      setStudentToken(token);
      fetch("http://127.0.0.1:8000/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(data => {
        if (data.email) {
          setStudentInfo(data);
          loadStudentModules(data.email);
          loadStudentLibrary(token);
        } else {
          logout();
        }
      })
      .catch(() => logout());
    }
  }, []);

  const loadStudentModules = (email: string) => {
    const savedMods = localStorage.getItem(`student_modules_${email.toLowerCase().trim()}`);
    if (savedMods) {
      try {
        const parsed = JSON.parse(savedMods);
        setModules(parsed);
        if (parsed.length > 0) setActiveModule(parsed[0]);
      } catch (e) {}
    } else {
      setModules([]);
      setActiveModule(null);
    }
  };

  const loadStudentLibrary = async (token: string) => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/student/lectures", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.lectures && data.lectures.length > 0) {
        setResult(data.lectures[0]);
        buildFlashcards(data.lectures[0].notes);
      }
    } catch (e) {}
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const endpoint = authMode === "login" 
      ? "http://127.0.0.1:8000/api/auth/login" 
      : "http://127.0.0.1:8000/api/auth/register";

    const payload = authMode === "login" 
      ? { email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword, university: authUni };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Authentication failed.");
      }

      const data = await res.json();
      setStudentToken(data.token);
      setStudentInfo({ email: data.email, university: data.university });
      localStorage.setItem("student_auth_token", data.token);
      loadStudentModules(data.email);
      loadStudentLibrary(data.token);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    setStudentToken(null);
    setStudentInfo(null);
    setResult(null);
    setModules([]);
    setActiveModule(null);
    localStorage.removeItem("student_auth_token");
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("app_theme", next);
  };

  const handleAddModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleCode.trim() || !studentInfo) return;

    const newMod = { 
      code: newModuleCode.trim().toUpperCase(), 
      name: newModuleName.trim() || newModuleCode.trim().toUpperCase() 
    };

    const updated = [...modules.filter((m) => m.code !== newMod.code), newMod];
    setModules(updated);
    setActiveModule(newMod);

    localStorage.setItem(
      `student_modules_${studentInfo.email.toLowerCase().trim()}`, 
      JSON.stringify(updated)
    );

    setNewModuleCode("");
    setNewModuleName("");
    setIsAddingModule(false);
  };

  const handleDeleteModule = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!studentInfo) return;

    const updated = modules.filter((m) => m.code !== code);
    setModules(updated);
    setActiveModule(updated.length > 0 ? updated[0] : null);

    localStorage.setItem(
      `student_modules_${studentInfo.email.toLowerCase().trim()}`, 
      JSON.stringify(updated)
    );
  };

  const buildFlashcards = (notesText: string) => {
    if (!notesText) return;
    const lines = notesText.split("\n");
    const cards: Array<{ front: string; back: string; flipped: boolean; mastered: boolean }> = [];
    lines.forEach((line: string) => {
      if (line.includes("**") && (line.includes("–") || line.includes("-") || line.includes(":"))) {
        const parts = line.replace(/^[-*]\s*/, "").split(/\s*[–\-:]\s*/);
        if (parts.length >= 2) {
          const front = parts[0].replace(/\*\*/g, "").trim();
          const back = parts.slice(1).join(" - ").replace(/\*\*/g, "").trim();
          if (front && back && front.length < 60) {
            cards.push({ front, back, flipped: false, mastered: false });
          }
        }
      }
    });
    if (cards.length > 0) {
      setFlashcards(cards);
      setCurrentCardIdx(0);
    }
  };

  // Polling Hook
  useEffect(() => {
    if (!jobId || jobStatus === "completed" || jobStatus === "failed") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${studentToken}` }
        });
        if (!res.ok) return;

        const data = await res.json();
        setJobStatus(data.status);
        setStatusMessage(data.status_message);

        if (data.status === "completed") {
          setResult(data.result);
          localStorage.setItem("academic_lecture_notes", JSON.stringify(data.result));
          buildFlashcards(data.result.notes || data.result.solution);
          setLoading(false);
          setActiveTab("notes");
          clearInterval(interval);
        } else if (data.status === "failed") {
          setError(data.error || "Processing failed.");
          setLoading(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [jobId, jobStatus, studentToken]);

  const changeSpeed = (s: number) => {
    setPlaybackSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToken) {
      setError("Please log in to your student account first.");
      return;
    }
    if (!activeModule) {
      setError("Please click '+ Add' on the left sidebar to add your course module first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setStatusMessage("Locking file into private student vault...");

    try {
      let res;
      if (mode === "url") {
        if (!lectureUrl.trim()) throw new Error("Please enter a valid YouTube or Teams URL.");
        res = await fetch("http://127.0.0.1:8000/api/process/url", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${studentToken}`
          },
          body: JSON.stringify({ 
            url: lectureUrl.trim(),
            module_code: activeModule ? activeModule.code : "CODE101"
          }),
        });
      } else {
        if (!file) throw new Error("Please select a file to process.");
        const formData = new FormData();
        formData.append("file", file);
        formData.append("module_code", activeModule.code);
        const endpoint = mode === "talk" ? "http://127.0.0.1:8000/api/process/talk" : "http://127.0.0.1:8000/api/process/math";
        res = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${studentToken}` },
          body: formData,
        });
      }

      if (!res.ok) throw new Error("Processing failed. Make sure backend is running.");
      const data = await res.json();
      setJobId(data.job_id);
      setJobStatus("processing");
    } catch (err: any) {
      setError(err.message || "Cannot connect to server.");
      setLoading(false);
    }
  };

  // ----------------- VOICE RECORDING LOGIC (RESTORED!) -----------------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
        ? "audio/webm;codecs=opus" 
        : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4");

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());

        setChatLoading(true);
        const formData = new FormData();
        formData.append("audio", audioBlob, "student_voice.webm");
        formData.append("transcript", result?.transcript || "");

        try {
          const res = await fetch("http://127.0.0.1:8000/api/voice-chat", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Server failed to process voice note.");
          }

          const data = await res.json();
          setChatMessages((prev) => [
            ...prev,
            { sender: "user", text: `🎙️ "${data.user_question}"` },
            { sender: "ai", text: data.answer },
          ]);
        } catch (err: any) {
          alert(`Voice error: ${err.message}`);
        } finally {
          setChatLoading(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      alert(`Microphone error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleGenerateExam = async () => {
    if (!result?.transcript) return;
    setExamLoading(true);
    setExamData(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/generate-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: result.transcript, difficulty: examDifficulty })
      });
      const data = await res.json();
      setExamData(data);
    } catch (err) {
      alert("Failed to generate exam.");
    } finally {
      setExamLoading(false);
    }
  };

  const seekAudio = (sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sec;
      audioRef.current.play();
    }
  };

  const exportWordDoc = () => {
    const text = result?.notes || result?.solution;
    if (!text) return;
    const blob = new Blob([text], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${result?.file_name || "lecture"}_study_guide.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLight = theme === "light";
  const bgMain = isLight ? "bg-[#fcfcfd] text-[#1c1d21]" : "bg-[#090a0f] text-[#f2f2f3]";
  const cardBg = isLight ? "bg-white border-[#eaebed] shadow-[0_1px_3px_rgba(0,0,0,0.04)]" : "bg-[#12141c] border-[#1e2230] shadow-2xl";
  const textMuted = isLight ? "text-[#71737d]" : "text-[#8a8c96]";
  const activePill = "bg-indigo-600 text-white shadow-sm font-semibold";
  const inactivePill = isLight ? "text-[#555761] hover:text-black" : "text-[#9a9ca6] hover:text-white";

  // ----------------- LOGIN / REGISTER PORTAL -----------------
  if (!studentToken) {
    return (
      <main className={`min-h-screen flex items-center justify-center p-4 font-sans ${bgMain}`}>
        <div className={`w-full max-w-md border rounded-3xl p-8 sm:p-10 space-y-6 ${cardBg}`}>
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl mx-auto shadow-lg shadow-indigo-600/30">
              ⚡
            </div>
            <h2 className="text-2xl font-black tracking-tight">University Student Portal</h2>
            <p className={`text-xs ${textMuted}`}>
              Sign in with your university credentials. Your private notes follow you between laptop and phone.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "register" && (
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-indigo-600 block">Select University</label>
                <select
                  value={authUni}
                  onChange={(e) => setAuthUni(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold focus:outline-none focus:border-indigo-600 ${
                    isLight ? "bg-slate-50 border-[#eaebed]" : "bg-[#18191d] border-[#25262c]"
                  }`}
                >
                  <option value="University of KwaZulu-Natal (UKZN)">University of KwaZulu-Natal (UKZN)</option>
                  <option value="University of Johannesburg (UJ)">University of Johannesburg (UJ)</option>
                  <option value="University of the Witwatersrand (Wits)">University of the Witwatersrand (Wits)</option>
                  <option value="Durban University of Technology (DUT)">Durban University of Technology (DUT)</option>
                  <option value="University of Cape Town (UCT)">University of Cape Town (UCT)</option>
                  <option value="University of Pretoria (UP)">University of Pretoria (UP)</option>
                  <option value="Other University / College">Other University / College</option>
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-600 block">Student Email</label>
              <input
                type="email"
                required
                placeholder="e.g. 21904812@stu.ukzn.ac.za"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:border-indigo-600 ${
                  isLight ? "bg-slate-50 border-[#eaebed]" : "bg-[#18191d] border-[#25262c]"
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-600 block">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:border-indigo-600 ${
                  isLight ? "bg-slate-50 border-[#eaebed]" : "bg-[#18191d] border-[#25262c]"
                }`}
              />
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{authMode === "login" ? "Access Student Vault" : "Create Student Account"}</span>
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(null); }}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              {authMode === "login" ? "New Student? Create an Account" : "Already registered? Sign In"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ----------------- MAIN LOGGED-IN WORKSPACE -----------------
  return (
    <div className={`min-h-screen font-sans ${bgMain} flex flex-col md:flex-row transition-colors duration-150`}>
      
      {/* SIDEBAR */}
      <aside className={`w-full md:w-64 border-b md:border-b-0 md:border-r p-5 space-y-6 ${isLight ? "bg-[#f9f9fb] border-[#eaebed]" : "bg-[#0c0d12] border-[#1a1c26]"} flex-shrink-0 print:hidden`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow">
              ⚡
            </div>
            <span className="font-extrabold text-sm tracking-tight">LectureOS</span>
          </div>

          <button onClick={toggleTheme} className={`p-2 rounded-xl border text-xs ${isLight ? "bg-white border-[#eaebed] text-slate-700" : "bg-[#151722] border-[#222638] text-amber-400"}`}>
            {isLight ? <Moon className="w-3.5 h-3.5 text-indigo-600" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Student Profile */}
        <div className="p-3 rounded-2xl border bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <User className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span className="text-xs font-bold truncate">{studentInfo?.email}</span>
            </div>
            <button onClick={logout} title="Sign Out" className="text-slate-400 hover:text-red-500 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className={`text-[10px] block truncate ${textMuted}`}>{studentInfo?.university}</span>
        </div>

        {/* Dynamic Modules Library (Starts Clean & Empty!) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">My Modules</span>
            <button onClick={() => setIsAddingModule(!isAddingModule)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-0.5">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          {isAddingModule && (
            <form onSubmit={handleAddModule} className="p-3 rounded-2xl border space-y-2 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/50">
              <input
                type="text"
                placeholder="Code (e.g. LAWS101, ACCT202)"
                value={newModuleCode}
                onChange={(e) => setNewModuleCode(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border bg-white dark:bg-[#18191d] uppercase focus:outline-none"
              />
              <input
                type="text"
                placeholder="Course Name"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border bg-white dark:bg-[#18191d] focus:outline-none"
              />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[10px]">Save</button>
                <button type="button" onClick={() => setIsAddingModule(false)} className="px-2 py-1 rounded-lg border text-[10px]">Cancel</button>
              </div>
            </form>
          )}

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {modules.length === 0 ? (
              <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1">
                <p className={`text-[11px] ${textMuted}`}>No courses added yet.</p>
                <button
                  onClick={() => setIsAddingModule(true)}
                  className="text-xs font-bold text-indigo-600 hover:underline block mx-auto"
                >
                  + Add your first module
                </button>
              </div>
            ) : (
              modules.map((m) => {
                const isActive = activeModule?.code === m.code;
                return (
                  <div
                    key={m.code}
                    onClick={() => setActiveModule(m)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between group ${
                      isActive 
                        ? "bg-indigo-600 text-white font-bold border-indigo-600 shadow-sm" 
                        : isLight ? "bg-white border-[#eaebed] hover:border-indigo-400" : "bg-[#12141c] border-[#1e2230]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-indigo-500"}`} />
                      <span className="truncate">{m.code}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteModule(m.code, e)}
                      className={`opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 transition-opacity ${isActive ? "text-indigo-200" : textMuted}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Navigation Modes */}
        <div className="space-y-1 pt-2 border-t border-[#eaebed] dark:border-[#1a1c26]">
          {[
            { id: "url", label: "YouTube / Teams URL 🔗", icon: LinkIcon },
            { id: "talk", label: "Upload Lecture File 🎙️", icon: FileVideo },
            { id: "math", label: "Past Exam PDF 📄", icon: FileText }
          ].map((m) => {
            const Icon = m.icon;
            const isSelected = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id as any)}
                className={`w-full p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all text-left ${
                  isSelected ? "bg-indigo-600 text-white font-bold shadow-sm" : `${textMuted} hover:bg-slate-200/50 dark:hover:bg-[#151722]`
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* MAIN CANVAS */}
      <main className="flex-1 p-4 sm:p-8 md:p-12 overflow-y-auto space-y-8 max-w-5xl">
        <div className="flex items-center justify-between text-xs font-semibold pb-4 border-b border-[#eaebed] dark:border-[#1a1c26] print:hidden">
          <div className="flex items-center gap-2 truncate">
            {activeModule ? (
              <>
                <span className="text-indigo-600 font-bold">{activeModule.code}</span>
                <span className={textMuted}>—</span>
                <span className="truncate">{activeModule.name}</span>
              </>
            ) : (
              <span className="text-amber-500 font-bold">Please click "+ Add" on the sidebar to add your course module</span>
            )}
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[11px] flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> POPIA Sandboxed
          </span>
        </div>

        {/* UPLOAD & STREAM CONTAINER */}
        <div className={`border rounded-3xl p-6 sm:p-8 ${cardBg} print:hidden space-y-5`}>
          
          {/* Segmented Switcher */}
          <div className="flex justify-center">
            <div className={`inline-flex p-1 rounded-2xl border text-xs ${isLight ? "bg-[#f4f4f6] border-[#eaebed]" : "bg-[#18191d] border-[#25262c]"}`}>
              <button
                onClick={() => setMode("url")}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${mode === "url" ? activePill : inactivePill}`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Paste YouTube / Teams URL</span>
              </button>
              <button
                onClick={() => setMode("talk")}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${mode === "talk" ? activePill : inactivePill}`}
              >
                <FileVideo className="w-3.5 h-3.5" />
                <span>Upload Recording</span>
              </button>
              <button
                onClick={() => setMode("math")}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${mode === "math" ? activePill : inactivePill}`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Past Exam PDF</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {mode === "url" ? (
              <div className={`p-6 rounded-2xl border space-y-3 ${isLight ? "bg-[#f9f9fb] border-[#d8d9de]" : "bg-[#101113] border-[#2b2d35]"}`}>
                <label className="block text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Paste YouTube, MS Teams, or Zoom URL (0MB Mobile Data Used):
                </label>
                <input
                  type="text"
                  placeholder="https://youtu.be/... or https://youtube.com/watch?v=..."
                  value={lectureUrl}
                  onChange={(e) => setLectureUrl(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border text-xs sm:text-sm focus:outline-none focus:border-indigo-600 ${
                    isLight ? "bg-white border-[#eaebed]" : "bg-[#18191d] border-[#25262c]"
                  }`}
                />
                <p className={`text-[11px] ${textMuted}`}>
                  Downloads audio cloud-to-cloud without consuming your personal internet data bundles.
                </p>
              </div>
            ) : (
              <div className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer ${
                isLight ? "border-[#d8d9de] hover:border-indigo-500 bg-[#f9f9fb]" : "border-[#2b2d35] hover:border-indigo-500 bg-[#101113]"
              }`}>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept={mode === "talk" ? "video/*,audio/*" : "image/*,.pdf"}
                  onChange={(e) => { if (e.target.files && e.target.files[0]) setFile(e.target.files[0]); }}
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center space-y-2">
                  <UploadCloud className="w-8 h-8 text-indigo-600" />
                  <p className="font-bold text-xs sm:text-sm">
                    {file ? file.name : (mode === "talk" ? "Upload 3-Hour Lecture Recording" : "Upload Past Exam Paper PDF")}
                  </p>
                  <span className={`text-[10px] ${textMuted}`}>Locked strictly to {studentInfo?.email}</span>
                </label>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === "url" ? !lectureUrl.trim() : !file)}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{loading ? statusMessage : `Process for ${activeModule ? activeModule.code : "Selected Course"}`}</span>
            </button>
          </form>
        </div>

        {/* RESULTS WORKSPACE */}
        {result && (
          <div className="space-y-6">
            <div className="flex border-b border-[#eaebed] dark:border-[#1a1c26] gap-4 sm:gap-6 text-xs sm:text-sm font-semibold print:hidden overflow-x-auto">
              {[
                { id: "notes", label: "📖 Study Notes", icon: BookOpen },
                { id: "flashcards", label: "🃏 Flip Cards", icon: Layers },
                { id: "exam", label: "🎓 Exam Simulator", icon: GraduationCap },
                { id: "audio", label: "🎧 Audio", icon: Headphones },
                { id: "tutor", label: "🎙️ Voice AI Tutor", icon: MessageSquare }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-3 flex items-center gap-1.5 transition-all relative whitespace-nowrap ${
                      isActive ? "text-indigo-600 font-bold" : `${textMuted} hover:text-black dark:hover:text-white`
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: MASTER STUDY NOTES */}
            {activeTab === "notes" && (
              <div className={`border rounded-3xl p-6 sm:p-10 space-y-6 ${cardBg}`}>
                <div className="flex flex-wrap justify-between items-center pb-4 border-b border-[#eaebed] dark:border-[#1a1c26] gap-3 print:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600">
                      {activeModule?.code} Verified
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                      Exhaustive Curriculum Depth
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button onClick={exportWordDoc} className="px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1">
                      <Download className="w-3.5 h-3.5 text-blue-600" /> Word (.doc)
                    </button>
                    <button onClick={() => window.print()} className="px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(result.notes || result.solution);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-semibold flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <article className={`max-w-none text-sm leading-relaxed space-y-4 ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      h1: ({ children }) => <h1 className="text-2xl sm:text-3xl font-black text-indigo-600 pb-3 border-b mt-6 mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-8 mb-3 pb-2 border-b">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold text-indigo-700 dark:text-indigo-300 mt-6 mb-2">{children}</h3>,
                      blockquote: ({ children }) => <div className="p-4 my-4 rounded-2xl bg-amber-500/10 border-l-4 border-amber-500 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-medium">{children}</div>,
                      table: ({ children }) => <div className="my-6 overflow-x-auto rounded-2xl border"><table className="w-full text-left text-xs sm:text-sm divide-y">{children}</table></div>,
                      thead: ({ children }) => <thead className="bg-slate-100 dark:bg-slate-900 font-bold uppercase text-[11px]">{children}</thead>,
                      th: ({ children }) => <th className="px-4 py-3">{children}</th>,
                      td: ({ children }) => <td className="px-4 py-3 border-t">{children}</td>,
                      ul: ({ children }) => <ul className="space-y-2 list-disc list-inside my-3">{children}</ul>,
                      ol: ({ children }) => <ol className="space-y-2 list-decimal list-inside my-3">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      strong: ({ children }) => <strong className="font-extrabold text-indigo-600 dark:text-indigo-400">{children}</strong>,
                    }}
                  >
                    {result.notes || result.solution}
                  </ReactMarkdown>
                </article>
              </div>
            )}

            {/* TAB 2: FLASHCARDS */}
            {activeTab === "flashcards" && (
              <div className={`border rounded-3xl p-6 sm:p-10 space-y-6 ${cardBg}`}>
                {flashcards.length > 0 ? (
                  <div className="space-y-4 max-w-md mx-auto text-center">
                    <div
                      onClick={() => {
                        const up = [...flashcards];
                        up[currentCardIdx].flipped = !up[currentCardIdx].flipped;
                        setFlashcards(up);
                      }}
                      className={`min-h-[200px] p-6 rounded-2xl border-2 flex flex-col justify-between cursor-pointer transition-all ${
                        flashcards[currentCardIdx].flipped ? "bg-indigo-600 text-white border-indigo-500" : isLight ? "bg-white border-[#eaebed]" : "bg-[#18191d] border-[#25262c]"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase">{flashcards[currentCardIdx].flipped ? "Answer" : "Question"}</span>
                      <div className="py-4 font-bold text-sm sm:text-base">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {flashcards[currentCardIdx].flipped ? flashcards[currentCardIdx].back : flashcards[currentCardIdx].front}
                        </ReactMarkdown>
                      </div>
                      <span className="text-[10px] opacity-70">Click to flip 🔄</span>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => currentCardIdx > 0 && setCurrentCardIdx(currentCardIdx - 1)} className="flex-1 py-2 border rounded-xl text-xs font-bold">
                        Previous
                      </button>
                      <button onClick={() => currentCardIdx < flashcards.length - 1 && setCurrentCardIdx(currentCardIdx + 1)} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">
                        Next Card
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={`text-center py-8 text-xs ${textMuted}`}>No flashcards available yet.</p>
                )}
              </div>
            )}

            {/* TAB 3: EXAM */}
            {activeTab === "exam" && (
              <div className={`border rounded-3xl p-6 sm:p-10 space-y-6 ${cardBg}`}>
                <div className="flex items-center justify-between pb-4 border-b">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    University Examination Simulator
                  </h3>
                  <button onClick={handleGenerateExam} disabled={examLoading} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow">
                    {examLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Generate Paper</span>
                  </button>
                </div>

                {examData && (
                  <div className="space-y-6">
                    {examData.section_a_mcq && (
                      <div className="space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Section A: Diagnostic Questions</span>
                        {examData.section_a_mcq.map((q: any, i: number) => (
                          <div key={q.id} className="p-4 border rounded-xl space-y-2 text-xs">
                            <span className="font-bold">Q{i + 1}. {q.question}</span>
                            <div className="grid grid-cols-1 gap-1 pt-1">
                              {q.options.map((opt: string, idx: number) => (
                                <button key={idx} className="p-2 border rounded-lg text-left hover:border-indigo-500">{opt}</button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: AUDIO */}
            {activeTab === "audio" && result.audio_url && (
              <div className={`border rounded-3xl p-6 space-y-4 ${cardBg}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Taxi Stream Audio 🚕 ({result.audio_size_mb} MB)</span>
                  <a href={result.audio_url} download className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold">MP3</a>
                </div>
                <audio ref={audioRef} controls src={result.audio_url} className="w-full h-10" />
              </div>
            )}

            {/* TAB 5: VOICE & TEXT AI TUTOR (MICROPHONE & SQUARE FULLY WIRED!) */}
            {activeTab === "tutor" && (
              <div className={`border rounded-3xl p-6 sm:p-10 space-y-5 ${cardBg}`}>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                    Lecture AI Tutor (Text or Voice)
                  </h3>
                  <p className={`text-xs ${textMuted}`}>
                    Click the microphone to speak your question out loud or type below.
                  </p>
                </div>

                {/* Voice & Text Input Form */}
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!chatQuestion.trim()) return;
                  const q = chatQuestion;
                  setChatMessages(p => [...p, { sender: "user", text: q }]);
                  setChatQuestion("");
                  const res = await fetch("http://127.0.0.1:8000/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question: q, transcript: result?.transcript || "" })
                  });
                  const d = await res.json();
                  setChatMessages(p => [...p, { sender: "ai", text: d.answer }]);
                }} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={chatQuestion}
                    onChange={(e) => setChatQuestion(e.target.value)}
                    placeholder="Type or click the microphone to speak..."
                    className={`flex-1 px-4 py-3 text-xs sm:text-sm rounded-xl border focus:outline-none ${
                      isLight ? "bg-white border-[#eaebed]" : "bg-[#18191d] border-[#222429]"
                    }`}
                  />

                  {/* Microphone / Stop Recording Button */}
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      title="Speak your question out loud"
                      className="p-3 rounded-xl border border-[#eaebed] dark:border-[#222429] hover:bg-slate-50 dark:hover:bg-[#1a1b1f] text-indigo-600 transition-all flex items-center justify-center"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      title="Stop recording and send question"
                      className="p-3 rounded-xl bg-red-600 text-white animate-pulse transition-all flex items-center justify-center shadow-lg shadow-red-600/30"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={chatLoading}
                    className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                  >
                    {chatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Ask</span>
                  </button>
                </form>

                {/* Pulsing Recording Alert */}
                {isRecording && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold flex items-center gap-2 animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                    <span>Recording your voice... Speak your question, then click the red square to send!</span>
                  </div>
                )}

                {/* Messages Display */}
                <div className="space-y-3 max-h-72 overflow-y-auto pt-2">
                  {chatMessages.map((m, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        m.sender === "user"
                          ? "bg-indigo-600 text-white ml-8 shadow-sm"
                          : isLight ? "bg-[#f4f4f6] text-black mr-8" : "bg-[#18191d] border border-[#222429] mr-8"
                      }`}
                    >
                      <strong className="block text-[10px] uppercase tracking-wider mb-1 opacity-70">
                        {m.sender === "user" ? "You" : "Lecture AI Tutor"}
                      </strong>
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}