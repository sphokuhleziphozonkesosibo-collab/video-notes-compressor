"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { 
  FileVideo, 
  Image as ImageIcon, 
  UploadCloud, 
  Sparkles, 
  Copy, 
  Check, 
  Loader2, 
  BookOpen, 
  AlertCircle, 
  Headphones, 
  Download, 
  Zap, 
  Search, 
  Printer, 
  Layers, 
  MessageSquare, 
  Send, 
  Sun, 
  Moon, 
  GraduationCap, 
  FileText, 
  Eye, 
  Mic, 
  Square 
} from "lucide-react";

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mode, setMode] = useState<"talk" | "math">("talk");
  const [file, setFile] = useState<File | null>(null);

  // Tabs: "notes" | "exam" | "audio" | "tutor"
  const [activeTab, setActiveTab] = useState<"notes" | "exam" | "audio" | "tutor">("notes");
  
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

  // Exam Paper State
  const [examDifficulty, setExamDifficulty] = useState<"test" | "exam">("exam");
  const [examData, setExamData] = useState<any>(null);
  const [examLoading, setExamLoading] = useState(false);
  const [mcqAnswers, setMcqAnswers] = useState<{ [key: number]: number }>({});
  const [mcqSubmitted, setMcqSubmitted] = useState(false);
  const [revealedSolutions, setRevealedSolutions] = useState<{ [key: number]: boolean }>({});

  // Chat & Voice Recording State
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "ai"; text: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("app_theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);

    const savedNotes = localStorage.getItem("academic_lecture_notes");
    if (savedNotes) {
      try { setResult(JSON.parse(savedNotes)); } catch (e) {}
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("app_theme", next);
  };

  // Polling Hook
  useEffect(() => {
    if (!jobId || jobStatus === "completed" || jobStatus === "failed") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/jobs/${jobId}`);
        if (!res.ok) return;

        const data = await res.json();
        setJobStatus(data.status);
        setStatusMessage(data.status_message);

        if (data.status === "completed") {
          setResult(data.result);
          localStorage.setItem("academic_lecture_notes", JSON.stringify(data.result));
          setLoading(false);
          setActiveTab("notes");
          clearInterval(interval);
        } else if (data.status === "failed") {
          setError(data.error || "An error occurred during processing.");
          setLoading(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [jobId, jobStatus]);

  const changeSpeed = (s: number) => {
    setPlaybackSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a lecture, PDF exam, or board image.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setExamData(null);
    setStatusMessage("Hashing & initializing pipeline...");

    const formData = new FormData();
    formData.append("file", file);

    const endpoint = mode === "talk" 
      ? "http://127.0.0.1:8000/api/process/talk" 
      : "http://127.0.0.1:8000/api/process/math";

    try {
      const response = await fetch(endpoint, { method: "POST", body: formData });
      if (!response.ok) throw new Error("Processing failed.");
      const data = await response.json();
      setJobId(data.job_id);
      setJobStatus("processing");
    } catch (err: any) {
      setError(err.message || "Cannot connect to server. Is FastAPI running on port 8000?");
      setLoading(false);
    }
  };

  // Generate Exam
  const handleGenerateExam = async () => {
    if (!result?.transcript) return;
    setExamLoading(true);
    setExamData(null);
    setMcqAnswers({});
    setMcqSubmitted(false);
    setRevealedSolutions({});

    try {
      const res = await fetch("http://127.0.0.1:8000/api/generate-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: result.transcript,
          difficulty: examDifficulty
        })
      });
      const data = await res.json();
      setExamData(data);
    } catch (err) {
      alert("Failed to generate exam. Ensure backend is running.");
    } finally {
      setExamLoading(false);
    }
  };

  // Text Chat
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuestion.trim() || !result?.transcript) return;
    const q = chatQuestion;
    setChatMessages((prev) => [...prev, { sender: "user", text: q }]);
    setChatQuestion("");
    setChatLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, transcript: result.transcript }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { sender: "ai", text: data.answer }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { sender: "ai", text: "Error answering question." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
        stream.getTracks().forEach((track) => track.stop());

        setChatLoading(true);
        const formData = new FormData();
        formData.append("audio", audioBlob, "voice_question.mp3");
        formData.append("transcript", result.transcript);

        try {
          const res = await fetch("http://127.0.0.1:8000/api/voice-chat", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          setChatMessages((prev) => [
            ...prev,
            { sender: "user", text: `🎙️ "${data.user_question}"` },
            { sender: "ai", text: data.answer },
          ]);
        } catch (err) {
          alert("Failed to process voice question.");
        } finally {
          setChatLoading(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone permission denied or not supported.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const seekAudio = (sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sec;
      audioRef.current.play();
    }
  };

  const exportAnkiCards = () => {
    if (!result?.notes) return;
    const lines = result.notes.split("\n");
    let csvContent = "Front,Back\n";
    lines.forEach((line: string) => {
      if (line.includes("**") && (line.includes("–") || line.includes("-") || line.includes(":"))) {
        const parts = line.replace(/^[-*]\s*/, "").split(/\s*[–\-:]\s*/);
        if (parts.length >= 2) {
          const front = parts[0].replace(/\*\*/g, "").trim();
          const back = parts.slice(1).join(" - ").replace(/\*\*/g, "").trim();
          if (front && back) {
            csvContent += `"${front.replace(/"/g, '""')}","${back.replace(/"/g, '""')}"\n`;
          }
        }
      }
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "lecture_anki_deck.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLight = theme === "light";
  const bgClass = isLight ? "bg-[#fbfbfd] text-slate-800" : "bg-[#0b0f17] text-slate-100";
  const cardClass = isLight ? "bg-white border-slate-200/80 shadow-sm" : "bg-[#111827] border-slate-800 shadow-xl";
  const mutedText = isLight ? "text-slate-500" : "text-slate-400";

  return (
    <main className={`min-h-screen transition-colors duration-200 font-sans p-4 sm:p-8 md:p-12 ${bgClass} print:bg-white print:p-0`}>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Top Header */}
        <header className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow">
              🎓
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight block">LectureOS</span>
              <span className={`text-[10px] ${mutedText}`}>Multi-Discipline Academic Suite</span>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isLight ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-850"
            }`}
          >
            {isLight ? <Moon className="w-3.5 h-3.5 text-indigo-600" /> : <Sun className="w-3.5 h-3.5" />}
            <span>{isLight ? "Dark" : "Light"}</span>
          </button>
        </header>

        {/* Hero */}
        <div className="text-center space-y-2 pt-2 print:hidden">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Academic Lecture Compressor
          </h1>
          <p className={`text-xs sm:text-sm max-w-lg mx-auto ${mutedText}`}>
            Physics, Chemistry, Computer Science, Engineering Maths, and Law. 3-Hour audio, PDF past papers, and voice Q&A.
          </p>
        </div>

        {/* Upload Box */}
        <div className={`border rounded-2xl p-6 sm:p-8 ${cardClass} print:hidden space-y-5`}>
          <div className="flex justify-center">
            <div className={`inline-flex p-1 rounded-xl border text-xs font-semibold ${isLight ? "bg-slate-100 border-slate-200" : "bg-slate-900 border-slate-800"}`}>
              <button
                onClick={() => { setMode("talk"); setFile(null); }}
                className={`px-4 py-1.5 rounded-lg transition-all ${mode === "talk" ? "bg-indigo-600 text-white shadow-sm" : mutedText}`}
              >
                🎙️ Lecture Audio/Video (3 Hours)
              </button>
              <button
                onClick={() => { setMode("math"); setFile(null); }}
                className={`px-4 py-1.5 rounded-lg transition-all ${mode === "math" ? "bg-indigo-600 text-white shadow-sm" : mutedText}`}
              >
                📐 Board Capture / PDF Document
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              isLight ? "border-slate-200 hover:border-indigo-400 bg-slate-50/50" : "border-slate-800 hover:border-indigo-500 bg-slate-950/30"
            }`}>
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept={mode === "talk" ? "video/*,audio/*" : "image/*,.pdf"}
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center space-y-2">
                <UploadCloud className="w-8 h-8 text-indigo-600" />
                <p className="font-semibold text-sm">
                  {file ? file.name : "Select or drag lecture file"}
                </p>
                <p className={`text-[11px] ${mutedText}`}>
                  {mode === "talk" 
                    ? "MP4, MP3, MKV (Supports 3-hour recordings)" 
                    : "PDF Past Exam Papers, PNG/JPG Whiteboard captures"}
                </p>
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !file}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-sm shadow-sm disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{statusMessage}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Synthesize Lecture Materials</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* RESULTS: TABS */}
        {result && (
          <div className="space-y-5">
            
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-semibold print:hidden">
              {[
                { id: "notes", label: "📖 Study Notes", icon: BookOpen },
                { id: "exam", label: "🎓 University Exam Paper", icon: GraduationCap },
                { id: "audio", label: "🎧 Audio & Search", icon: Headphones },
                { id: "tutor", label: "💬 Voice AI Tutor", icon: MessageSquare }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-3 flex items-center gap-1.5 transition-all relative ${
                      isActive ? "text-indigo-600 font-bold" : `${mutedText} hover:text-slate-700 dark:hover:text-slate-200`
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: NOTES */}
            {activeTab === "notes" && (
              <div className={`border rounded-2xl p-6 sm:p-8 space-y-6 ${cardClass}`}>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 print:hidden">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                    Academic Formatted
                  </span>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={exportAnkiCards}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-600" /> Anki Deck
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(result.notes || result.solution);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <article className={`prose max-w-none leading-relaxed text-sm ${isLight ? "prose-slate" : "prose-invert"}`}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {result.notes || result.solution}
                  </ReactMarkdown>
                </article>
              </div>
            )}

            {/* TAB 2: EXAM PAPER */}
            {activeTab === "exam" && (
              <div className={`border rounded-2xl p-6 sm:p-8 space-y-6 ${cardClass}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-indigo-600" />
                      University Examination Paper
                    </h3>
                    <p className={`text-xs ${mutedText}`}>Section A (Diagnostic MCQs) & Section B (Long Form with Mark Rubrics).</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={examDifficulty}
                      onChange={(e) => setExamDifficulty(e.target.value as any)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${
                        isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-900 border-slate-800"
                      }`}
                    >
                      <option value="test">Class Test (Standard)</option>
                      <option value="exam">Final Exam Paper (Challenging)</option>
                    </select>

                    <button
                      onClick={handleGenerateExam}
                      disabled={examLoading}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white flex items-center gap-1.5 shadow-sm"
                    >
                      {examLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Generate Paper
                    </button>
                  </div>
                </div>

                {!examData && !examLoading && (
                  <div className="text-center py-10 space-y-2">
                    <FileText className={`w-8 h-8 mx-auto ${mutedText}`} />
                    <p className={`text-xs ${mutedText}`}>Click "Generate Paper" above to formulate an exam paper based on this lecture.</p>
                  </div>
                )}

                {examData && (
                  <div className="space-y-8">
                    <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/50 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-indigo-900 dark:text-indigo-200">{examData.exam_title}</h4>
                        <span className={`text-[11px] ${mutedText}`}>Official Faculty Assessment</span>
                      </div>
                      <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-indigo-600 text-white">
                        Total: {examData.total_marks || 35} Marks
                      </span>
                    </div>

                    {/* Section A MCQ */}
                    {examData.section_a_mcq && (
                      <div className="space-y-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Section A: Diagnostic Questions</span>
                        {examData.section_a_mcq.map((q: any, idx: number) => (
                          <div key={q.id} className={`p-4 rounded-xl border space-y-3 ${isLight ? "bg-slate-50/70 border-slate-200" : "bg-slate-900/50 border-slate-800"}`}>
                            <div className="flex justify-between items-start">
                              <h5 className="font-semibold text-xs sm:text-sm">Q{idx + 1}. {q.question}</h5>
                              <span className="text-[11px] font-bold text-indigo-600">[{q.marks} Marks]</span>
                            </div>

                            <div className="grid grid-cols-1 gap-1.5">
                              {q.options.map((opt: string, optIdx: number) => {
                                const isSelected = mcqAnswers[q.id] === optIdx;
                                const isCorrect = q.correct_index === optIdx;
                                let style = isLight ? "bg-white border-slate-200 hover:border-indigo-300" : "bg-slate-900 border-slate-800";

                                if (mcqSubmitted) {
                                  if (isCorrect) style = "bg-emerald-500/10 border-emerald-500 text-emerald-600 font-semibold";
                                  else if (isSelected) style = "bg-red-500/10 border-red-500 text-red-600";
                                } else if (isSelected) {
                                  style = "bg-indigo-600 text-white font-semibold";
                                }

                                return (
                                  <button
                                    key={optIdx}
                                    onClick={() => !mcqSubmitted && setMcqAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                                    className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${style}`}
                                  >
                                    <span>{opt}</span>
                                    {mcqSubmitted && isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                  </button>
                                );
                              })}
                            </div>

                            {mcqSubmitted && (
                              <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[11px] text-indigo-700 dark:text-indigo-300">
                                <strong>Marking Guide:</strong> {q.explanation}
                              </div>
                            )}
                          </div>
                        ))}

                        {!mcqSubmitted && (
                          <button
                            onClick={() => setMcqSubmitted(true)}
                            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-xs"
                          >
                            Mark Section A
                          </button>
                        )}
                      </div>
                    )}

                    {/* Section B Long Questions */}
                    {examData.section_b_long && (
                      <div className="space-y-6 pt-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                          Section B: Long-Form Structured Questions (Derivations / Calculations / Code)
                        </span>

                        {examData.section_b_long.map((q: any, idx: number) => {
                          const isRevealed = revealedSolutions[q.id];
                          return (
                            <div key={q.id} className={`p-5 rounded-xl border space-y-4 ${isLight ? "bg-slate-50/70 border-slate-200" : "bg-slate-900/50 border-slate-800"}`}>
                              <div className="flex justify-between items-start">
                                <h5 className="font-bold text-sm">Question {idx + 1}: Problem & Working</h5>
                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-600/10 text-indigo-600">
                                  {q.marks} Marks
                                </span>
                              </div>

                              <p className="text-xs sm:text-sm leading-relaxed">{q.question}</p>

                              {q.rubric && (
                                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-850 space-y-1.5 text-xs">
                                  <strong className="block text-[11px] uppercase tracking-wider text-indigo-600">Examiner's Mark Allocation Rubric:</strong>
                                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                                    {q.rubric.map((r: string, rIdx: number) => (
                                      <li key={rIdx}>{r}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <button
                                onClick={() => setRevealedSolutions(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isRevealed ? "Hide Model Solution" : "Reveal Step-by-Step Model Solution"}</span>
                              </button>

                              {isRevealed && (
                                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 text-xs">
                                  <strong className="text-emerald-600 block text-xs">Examiner's Complete Solution:</strong>
                                  <div className="prose prose-sm max-w-none text-xs">
                                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                      {q.model_solution}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: AUDIO */}
            {activeTab === "audio" && (
              <div className={`border rounded-2xl p-6 sm:p-8 space-y-6 ${cardClass}`}>
                {result?.audio_url && (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                        <Headphones className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Taxi Stream Audio 🚕</h4>
                        <span className={`text-[11px] ${mutedText}`}>{result.audio_size_mb} MB • 32kbps mono voice</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
                        {[1.0, 1.25, 1.5, 2.0].map((s) => (
                          <button
                            key={s}
                            onClick={() => changeSpeed(s)}
                            className={`px-2 py-0.5 rounded ${playbackSpeed === s ? "bg-indigo-600 text-white" : mutedText}`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>

                      <audio ref={audioRef} controls src={result.audio_url} className="h-9 w-44" />
                      <a href={result.audio_url} download className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold">
                        MP3
                      </a>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Timestamp Search & Audio Jump</span>
                    <input
                      type="text"
                      placeholder="Filter words..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`px-3 py-1 rounded-lg border text-xs w-48 ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
                    />
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-2">
                    {result.segments
                      ?.filter((s: any) => s.text.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((seg: any, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => seekAudio(seg.start)}
                          className={`p-2 rounded-lg border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                            isLight ? "hover:bg-slate-50 border-slate-200" : "hover:bg-slate-850 border-slate-800"
                          }`}
                        >
                          <span className="font-mono font-bold text-indigo-600">[{seg.timestamp}]</span>
                          <span className={mutedText}>{seg.text}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: TUTOR */}
            {activeTab === "tutor" && (
              <div className={`border rounded-2xl p-6 sm:p-8 space-y-4 ${cardClass}`}>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                    Lecture AI Tutor (Text or Voice)
                  </h3>
                  <p className={`text-xs ${mutedText}`}>
                    Type your question, or <strong>click the microphone to ask with your voice</strong>!
                  </p>
                </div>

                <form onSubmit={handleAskQuestion} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={chatQuestion}
                    onChange={(e) => setChatQuestion(e.target.value)}
                    placeholder="Type or click the microphone to ask out loud..."
                    className={`flex-1 px-3.5 py-2 text-xs rounded-xl border focus:outline-none ${
                      isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
                    }`}
                  />

                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      title="Speak your question"
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 transition-all"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      title="Stop and send question"
                      className="p-2 rounded-xl bg-red-600 text-white animate-pulse transition-all"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={chatLoading}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs flex items-center gap-1"
                  >
                    {chatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Ask</span>
                  </button>
                </form>

                {isRecording && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold flex items-center gap-2 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                    <span>Listening to your voice... Click the red square when finished speaking!</span>
                  </div>
                )}

                <div className="space-y-2.5 max-h-72 overflow-y-auto pt-2">
                  {chatMessages.map((m, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                        m.sender === "user"
                          ? "bg-indigo-600 text-white ml-8"
                          : isLight ? "bg-slate-100 text-slate-800 mr-8" : "bg-slate-900 border border-slate-800 mr-8"
                      }`}
                    >
                      <strong className="block text-[10px] uppercase tracking-wider mb-1 opacity-70">
                        {m.sender === "user" ? "You" : "Lecture Tutor"}
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

      </div>
    </main>
  );
}