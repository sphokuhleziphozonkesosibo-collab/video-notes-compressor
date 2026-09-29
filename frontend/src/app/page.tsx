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
  CheckCircle2,
  CircleDashed,
  Cpu,
  Search,
  Printer,
  Layers,
  MessageSquare,
  Send
} from "lucide-react";

export default function Home() {
  const [mode, setMode] = useState<"talk" | "math">("talk");
  const [file, setFile] = useState<File | null>(null);
  
  // Job & Progress states
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Result states
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Chat with Video state (Feature #5)
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "ai"; text: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Restore from LocalStorage for Offline Viewing
  useEffect(() => {
    const cachedData = localStorage.getItem("last_lecture_notes");
    if (cachedData) {
      try {
        setResult(JSON.parse(cachedData));
      } catch (e) {
        console.error("Cache load failed", e);
      }
    }
  }, []);

  // Polling hook
  useEffect(() => {
    if (!jobId || jobStatus === "completed" || jobStatus === "failed") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/jobs/${jobId}`);
        if (!res.ok) return;

        const data = await res.json();
        setJobStatus(data.status);
        setCurrentStep(data.step);
        setStatusMessage(data.status_message);

        if (data.status === "completed") {
          setResult(data.result);
          localStorage.setItem("last_lecture_notes", JSON.stringify(data.result));
          setLoading(false);
          clearInterval(interval);
        } else if (data.status === "failed") {
          setError(data.error || "An error occurred during processing.");
          setLoading(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [jobId, jobStatus]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to process.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setJobId(null);
    setCurrentStep(0);
    setStatusMessage("Initializing 3-hour pipeline & hashing...");

    const formData = new FormData();
    formData.append("file", file);

    const endpoint = mode === "talk" 
      ? "http://127.0.0.1:8000/api/process/talk" 
      : "http://127.0.0.1:8000/api/process/math";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Upload failed.");
      }

      const data = await response.json();
      setJobId(data.job_id);
      setJobStatus("processing");
    } catch (err: any) {
      setError(err.message || "Failed to connect to backend server.");
      setLoading(false);
    }
  };

  const seekAudio = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play();
    }
  };

  const printNotes = () => {
    window.print();
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
    link.setAttribute("download", `${result.file_name || "lecture"}_anki_deck.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = () => {
    const textToCopy = result?.notes || result?.solution;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Feature #5: Ask question about the lecture
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuestion.trim() || !result?.transcript) return;

    const userQ = chatQuestion;
    setChatMessages((prev) => [...prev, { sender: "user", text: userQ }]);
    setChatQuestion("");
    setChatLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userQ,
          transcript: result.transcript,
        }),
      });

      const data = await res.json();
      setChatMessages((prev) => [...prev, { sender: "ai", text: data.answer }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Failed to answer. Backend error." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const filteredSegments = result?.segments?.filter((seg: any) =>
    seg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 md:p-12 font-sans selection:bg-indigo-500 selection:text-white print:bg-white print:text-black print:p-0">
      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* Navigation & Header */}
        <header className="text-center space-y-4 pt-4 print:hidden">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider shadow-inner">
            <Zap className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400" /> 
            3-Hour Marathon Certified Engine
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white">
            Study in <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">10 Minutes</span>, Not 3 Hours.
          </h1>
          
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            Multi-chunk 3-hour transcription, code-switching translation (isiZulu/Eng), and interactive AI lecture chat with audio seek.
          </p>
        </header>

        {/* Mode Selector */}
        <div className="flex justify-center print:hidden">
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur shadow-2xl">
            <button
              onClick={() => { setMode("talk"); setFile(null); }}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                mode === "talk"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileVideo className="w-4 h-4" />
              Talk Mode (Theory & 3-Hour Lectures)
            </button>
            <button
              onClick={() => { setMode("math"); setFile(null); }}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                mode === "math"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Maths Mode (Whiteboards)
            </button>
          </div>
        </div>

        {/* Upload Container */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-6 sm:p-10 backdrop-blur-xl shadow-2xl space-y-6 print:hidden">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-3xl p-8 sm:p-12 text-center transition-all bg-slate-950/40 group cursor-pointer">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept={mode === "talk" ? "video/*,audio/*" : "image/*"}
                onChange={handleFileChange}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center space-y-4"
              >
                <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-semibold text-slate-100 text-base sm:text-lg">
                    {file ? file.name : `Click or drag your ${mode === "talk" ? "2-3 hour recording" : "whiteboard photo"}`}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    {mode === "talk" ? "MP4, MKV, MP3 up to 3 Hours (Chunked & SHA-256 Cached)" : "PNG, JPG of blackboard or screen"}
                  </p>
                </div>
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !file}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-90 font-bold text-white shadow-xl shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2.5 text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Pipeline Active...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Compress & Extract Notes</span>
                </>
              )}
            </button>
          </form>

          {/* Stepper Progress Bar */}
          {loading && (
            <div className="pt-6 border-t border-slate-800/80 space-y-6 animate-in fade-in duration-500">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold">
                  <Cpu className="w-4 h-4 animate-pulse" />
                  <span>{statusMessage}</span>
                </div>
                <span className="text-slate-400 font-mono">Job: {jobId?.slice(0, 8)}...</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { step: 1, label: mode === "talk" ? "FFmpeg Compression" : "Handwriting OCR" },
                  { step: 2, label: mode === "talk" ? "15-Min Chunk Whisper" : "LaTeX Conversion" },
                  { step: 3, label: mode === "talk" ? "Exam Hint & Code-Switch" : "Method Extraction" }
                ].map((s) => (
                  <div 
                    key={s.step} 
                    className={`p-3.5 rounded-2xl border transition-all flex items-center gap-3 ${
                      currentStep > s.step 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : currentStep === s.step
                        ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300 ring-2 ring-indigo-500/20"
                        : "bg-slate-950/40 border-slate-800/60 text-slate-600"
                    }`}
                  >
                    {currentStep > s.step ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    ) : currentStep === s.step ? (
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-400 flex-shrink-0" />
                    ) : (
                      <CircleDashed className="w-5 h-5 text-slate-700 flex-shrink-0" />
                    )}
                    <span className="text-xs font-semibold leading-tight">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Taxi Ride Audio Player */}
        {result?.audio_url && (
          <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur print:hidden">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-lg shadow-indigo-500/20">
                <Headphones className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base">
                    Taxi Ride Audio 🚕
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    Saved {result.data_saved_pct}% Data!
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Compressed to only <strong className="text-slate-200">{result.audio_size_mb} MB</strong>. Click any timestamp below to jump audio!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <audio ref={audioRef} controls src={result.audio_url} className="h-10 w-full sm:w-60" />
              <a
                href={result.audio_url}
                download
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                Download MP3
              </a>
            </div>
          </div>
        )}

        {/* Study Notes Card */}
        {result && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-8 shadow-2xl backdrop-blur print:bg-white print:border-none print:shadow-none print:p-0">
            
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/80 print:hidden">
              <div className="flex items-center gap-3 text-indigo-400 font-bold text-lg">
                <BookOpen className="w-6 h-6" />
                <span>Generated Study Notes</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">Offline Cached</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={exportAnkiCards}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" /> Export Anki Deck
                </button>
                <button
                  onClick={printNotes}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / PDF
                </button>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy Markdown"}
                </button>
              </div>
            </div>

            {/* Markdown Body */}
            <article className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-indigo-300 prose-table:border-slate-800 prose-th:border-slate-800 prose-th:text-indigo-200 prose-td:border-slate-800 leading-relaxed print:prose-neutral">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {result.notes || result.solution}
              </ReactMarkdown>
            </article>

            {/* Feature #5: Chat With Your Lecture */}
            {result.transcript && (
              <div className="pt-8 border-t border-slate-800/80 space-y-6 print:hidden">
                <div className="flex items-center gap-2.5 text-indigo-400 font-bold">
                  <MessageSquare className="w-5 h-5" />
                  <span>Chat With This Lecture (Ask Anything)</span>
                </div>

                <form onSubmit={handleAskQuestion} className="flex gap-2">
                  <input
                    type="text"
                    value={chatQuestion}
                    onChange={(e) => setChatQuestion(e.target.value)}
                    placeholder="e.g. What did he say about Question 3? Or explain deferred tax..."
                    className="flex-1 px-4 py-3 text-sm rounded-2xl bg-slate-950 border border-slate-800 focus:outline-none focus:border-indigo-500 text-slate-100 placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatQuestion.trim()}
                    className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white disabled:opacity-40 transition-all flex items-center gap-2"
                  >
                    {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Ask</span>
                  </button>
                </form>

                {chatMessages.length > 0 && (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                          msg.sender === "user"
                            ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-200 ml-12"
                            : "bg-slate-950 border border-slate-800 text-slate-300 mr-12"
                        }`}
                      >
                        <strong className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
                          {msg.sender === "user" ? "You" : "Lecture AI"}
                        </strong>
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search Inside Lecture Transcript */}
            {result.segments && (
              <div className="pt-8 border-t border-slate-800/80 space-y-4 print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <Search className="w-4 h-4 text-indigo-400" />
                    Search Inside Lecture & Jump Audio:
                  </h4>
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Search words (e.g. tax, formula)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 focus:outline-none focus:border-indigo-500 text-slate-200 placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                  {filteredSegments?.map((seg: any, idx: number) => (
                    <div 
                      key={idx}
                      onClick={() => seekAudio(seg.start)}
                      className="p-3 rounded-xl bg-slate-950/50 hover:bg-indigo-950/30 border border-slate-800/60 hover:border-indigo-500/40 transition-all cursor-pointer flex items-start gap-3 group"
                    >
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-mono text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        [{seg.timestamp}]
                      </span>
                      <p className="text-xs text-slate-300 group-hover:text-white transition-colors leading-relaxed">
                        {seg.text}
                      </p>
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