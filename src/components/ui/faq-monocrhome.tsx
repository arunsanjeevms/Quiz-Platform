import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  FileUp,
  MoonStar,
  Play,
  Shuffle,
  SunMedium,
  Trophy,
  UploadCloud,
} from "lucide-react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

const INTRO_STYLE_ID = "quiz-mono-animations";

const stageLabels = [
  { id: "welcome", label: "Welcome" },
  { id: "upload", label: "Upload PDF" },
  { id: "setup", label: "Quiz Options" },
  { id: "quiz", label: "Quiz" },
  { id: "result", label: "Result" },
] as const;

type ThemeMode = "dark" | "light";
type Stage = (typeof stageLabels)[number]["id"];
type StatusTone = "muted" | "success" | "error";

type QuizOption = {
  key: string;
  text: string;
  isCorrect: boolean;
};

type QuizQuestion = {
  id: number;
  questionText: string;
  options: QuizOption[];
};

const palettes = {
  dark: {
    surface: "bg-neutral-950 text-neutral-100",
    panel: "bg-neutral-900/55",
    border: "border-white/10",
    heading: "text-white",
    muted: "text-neutral-400",
    toggle: "border-white/20 text-white",
    toggleSurface: "bg-white/10",
    stepActive: "border-white bg-white text-black",
    stepDone: "border-emerald-300/50 bg-emerald-300/15 text-emerald-100",
    stepIdle: "border-white/20 bg-white/5 text-neutral-300",
    primaryButton: "bg-white text-black hover:bg-neutral-200",
    secondaryButton: "border-white/25 bg-white/10 text-white hover:bg-white/20",
    input: "border-white/20 bg-black/30 text-white file:text-neutral-300",
    option: "border-white/15 bg-white/[0.03] hover:border-white/30",
    optionCorrect: "border-emerald-300/45 bg-emerald-400/15",
    optionWrong: "border-rose-300/45 bg-rose-400/15",
    success: "text-emerald-300",
    error: "text-rose-300",
    glow: "rgba(255,255,255,0.08)",
    aurora:
      "radial-gradient(ellipse 60% 100% at 10% 0%, rgba(226, 232, 240, 0.15), transparent 64%), #000000",
    overlay: "linear-gradient(130deg, rgba(255,255,255,0.05) 0%, transparent 65%)",
  },
  light: {
    surface: "bg-slate-100 text-neutral-900",
    panel: "bg-white/70",
    border: "border-neutral-200",
    heading: "text-neutral-900",
    muted: "text-neutral-600",
    toggle: "border-neutral-200 text-neutral-900",
    toggleSurface: "bg-white",
    stepActive: "border-neutral-900 bg-neutral-900 text-white",
    stepDone: "border-emerald-600/40 bg-emerald-100 text-emerald-900",
    stepIdle: "border-neutral-300 bg-white text-neutral-600",
    primaryButton: "bg-neutral-900 text-white hover:bg-neutral-700",
    secondaryButton: "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100",
    input: "border-neutral-300 bg-white text-neutral-900 file:text-neutral-600",
    option: "border-neutral-300 bg-white/80 hover:border-neutral-500",
    optionCorrect: "border-emerald-600/40 bg-emerald-100",
    optionWrong: "border-rose-600/35 bg-rose-100",
    success: "text-emerald-700",
    error: "text-rose-700",
    glow: "rgba(15,15,15,0.08)",
    aurora:
      "radial-gradient(ellipse 60% 100% at 10% 0%, rgba(15, 23, 42, 0.08), rgba(255, 255, 255, 0.98) 70%)",
    overlay: "linear-gradient(130deg, rgba(15,23,42,0.08) 0%, transparent 70%)",
  },
} as const;

function QuizMonochrome() {
  const getRootTheme = (): ThemeMode => {
    if (typeof document === "undefined") return "dark";
    if (document.documentElement.classList.contains("dark")) return "dark";
    if (document.documentElement.classList.contains("light")) return "light";
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  };

  const [theme, setTheme] = useState<ThemeMode>(getRootTheme);
  const [stage, setStage] = useState<Stage>("welcome");
  const [introReady, setIntroReady] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [status, setStatus] = useState<{ tone: StatusTone; text: string }>({
    tone: "muted",
    text: "Upload a PDF with options and answer keys.",
  });

  const [extractedQuestions, setExtractedQuestions] = useState<QuizQuestion[]>([]);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const palette = useMemo(() => palettes[theme], [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(INTRO_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = INTRO_STYLE_ID;
    style.innerHTML = `
      @keyframes quiz-mono-fade-up {
        0% { transform: translate3d(0, 24px, 0); opacity: 0; filter: blur(10px); }
        100% { transform: translate3d(0, 0, 0); opacity: 1; filter: blur(0); }
      }
      @keyframes quiz-mono-shimmer {
        0% { background-position: -170% 0; }
        100% { background-position: 170% 0; }
      }
      @keyframes quiz-mono-beacon {
        0% { transform: scale(0.9); opacity: 0.4; }
        50% { transform: scale(1.15); opacity: 0.12; }
        100% { transform: scale(1.35); opacity: 0; }
      }
      .quiz-mono-stage {
        animation: quiz-mono-fade-up 620ms cubic-bezier(0.2, 0.75, 0.2, 1) both;
      }
      .quiz-mono-title {
        background: linear-gradient(110deg, rgba(255,255,255,0.3) 10%, rgba(255,255,255,1) 42%, rgba(255,255,255,0.3) 68%);
        background-size: 220% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: quiz-mono-shimmer 4.8s linear infinite;
      }
      .light .quiz-mono-title,
      html:not(.dark) .quiz-mono-title {
        background: linear-gradient(110deg, rgba(15,23,42,0.35) 10%, rgba(15,23,42,0.95) 45%, rgba(15,23,42,0.35) 72%);
        background-size: 220% 100%;
      }
      .quiz-mono-beacon {
        position: absolute;
        inset: -20%;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.2);
        animation: quiz-mono-beacon 2.6s ease-out infinite;
        pointer-events: none;
      }
      .light .quiz-mono-beacon,
      html:not(.dark) .quiz-mono-beacon {
        border-color: rgba(15,23,42,0.2);
      }
    `;

    document.head.appendChild(style);

    return () => {
      if (style.parentNode) style.remove();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIntroReady(true);
      return;
    }

    const frame = window.requestAnimationFrame(() => setIntroReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const applyThemeFromRoot = () => setTheme(getRootTheme());

    applyThemeFromRoot();

    const observer = new MutationObserver(applyThemeFromRoot);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const toggleTheme = () => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const next: ThemeMode = root.classList.contains("dark") ? "light" : "dark";

    root.classList.toggle("dark", next === "dark");
    root.classList.toggle("light", next === "light");
    setTheme(next);

    try {
      window.localStorage.setItem("bento-theme", next);
    } catch (_err) {
      // Ignore storage persistence failures.
    }
  };

  const statusClass =
    status.tone === "success" ? palette.success : status.tone === "error" ? palette.error : palette.muted;

  const stepIndex = stageLabels.findIndex((item) => item.id === stage);

  const currentQuestion = quizQuestions[currentIndex] ?? null;
  const isLastQuestion = currentIndex === quizQuestions.length - 1;
  const selectedIsCorrect =
    selectedOptionIndex !== null && currentQuestion
      ? currentQuestion.options[selectedOptionIndex]?.isCorrect === true
      : false;

  const correctOptionText = currentQuestion?.options.find((option) => option.isCorrect)?.text ?? "";

  const percentage = quizQuestions.length > 0 ? Math.round((score / quizQuestions.length) * 100) : 0;

  const progressLabel = quizQuestions.length > 0 ? `${currentIndex + 1} / ${quizQuestions.length}` : "0 / 0";

  const progressWidth = quizQuestions.length > 0 ? `${((currentIndex + 1) / quizQuestions.length) * 100}%` : "0%";

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setExtractedQuestions([]);
    setStatus({
      tone: file ? "muted" : "muted",
      text: file ? "PDF selected. Click Extract Questions." : "Upload a PDF with options and answer keys.",
    });
  };

  const extractQuestions = async () => {
    if (!selectedFile) {
      setStatus({ tone: "error", text: "Please choose a PDF first." });
      return;
    }

    setIsExtracting(true);
    setStatus({ tone: "muted", text: "Reading PDF and extracting questions..." });

    try {
      const text = await readPdfAsText(selectedFile);
      const parsed = parseQuestions(text);

      if (parsed.length === 0) {
        setExtractedQuestions([]);
        setStatus({
          tone: "error",
          text: "No valid MCQ pattern found. Keep each question with A/B/C/D and Answer: X.",
        });
        return;
      }

      setExtractedQuestions(parsed);
      setStatus({
        tone: "success",
        text: `Extracted ${parsed.length} questions. Continue to Quiz Options.`,
      });
    } catch (error) {
      console.error(error);
      setExtractedQuestions([]);
      setStatus({ tone: "error", text: "Could not parse this PDF. Try a text-based PDF." });
    } finally {
      setIsExtracting(false);
    }
  };

  const startQuiz = () => {
    if (extractedQuestions.length === 0) {
      setStatus({ tone: "error", text: "Extract questions first." });
      setStage("upload");
      return;
    }

    const prepared = extractedQuestions.map((question) => ({
      ...question,
      options: shuffleOptions ? shuffleArray(question.options) : [...question.options],
    }));

    const arranged = shuffleQuestions ? shuffleArray(prepared) : prepared;

    setQuizQuestions(arranged);
    setCurrentIndex(0);
    setScore(0);
    setSelectedOptionIndex(null);
    setShowAnswer(false);
    setStage("quiz");
  };

  const selectAnswer = (index: number) => {
    if (!currentQuestion || showAnswer) {
      return;
    }

    setSelectedOptionIndex(index);
    setShowAnswer(true);

    if (currentQuestion.options[index]?.isCorrect) {
      setScore((prev) => prev + 1);
    }
  };

  const goNext = () => {
    if (!showAnswer) {
      return;
    }

    if (isLastQuestion) {
      setStage("result");
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setSelectedOptionIndex(null);
    setShowAnswer(false);
  };

  const performanceText =
    percentage >= 85
      ? "Excellent signal lock. You are exam ready."
      : percentage >= 60
      ? "Strong progress. One more revision cycle will sharpen retention."
      : "Keep drilling. Repeat with shuffle enabled for better memory recall.";

  return (
    <div className={`relative min-h-screen w-full overflow-hidden transition-colors duration-700 ${palette.surface}`}>
      <div className="absolute inset-0 z-0" style={{ background: palette.aurora }} />
      <img
        src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=2200&q=80"
        alt=""
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-[0.09] grayscale"
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-80"
        style={{ background: palette.overlay, mixBlendMode: theme === "dark" ? "screen" : "multiply" }}
      />

      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-14 lg:px-12 lg:py-20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <p
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-[0.4em] ${
                palette.border
              } ${palette.muted}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${theme === "dark" ? "bg-white" : "bg-neutral-900"}`} />
              NPTEL Quiz Flow
            </p>
            <h1 className={`text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl ${palette.heading}`}>
              <span className={introReady ? "quiz-mono-title" : ""}>Memorize Smarter, Not Harder.</span>
            </h1>
            <p className={`max-w-2xl text-sm sm:text-base ${palette.muted}`}>
              Welcome animation, PDF upload, quiz setup with shuffle options, and final score in one guided flow.
            </p>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className={`relative inline-flex h-12 items-center gap-3 rounded-full border px-5 text-sm font-medium transition-colors duration-500 ${palette.toggleSurface} ${palette.toggle}`}
            aria-pressed={theme === "dark" ? "true" : "false"}
          >
            <span className="relative flex h-6 w-6 items-center justify-center">
              <span className="quiz-mono-beacon" aria-hidden="true" />
              {theme === "dark" ? <MoonStar className="relative h-4 w-4" /> : <SunMedium className="relative h-4 w-4" />}
            </span>
            {theme === "dark" ? "Night" : "Day"} mode
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {stageLabels.map((item, index) => {
            const variant =
              index === stepIndex ? palette.stepActive : index < stepIndex ? palette.stepDone : palette.stepIdle;

            return (
              <span
                key={item.id}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] transition-colors ${variant}`}
              >
                {index + 1}. {item.label}
              </span>
            );
          })}
        </div>

        <div
          key={stage}
          className={`quiz-mono-stage rounded-3xl border p-6 shadow-[0_36px_120px_-65px_rgba(0,0,0,0.9)] sm:p-8 ${palette.panel} ${palette.border}`}
        >
          {stage === "welcome" && (
            <div className="flex min-h-[330px] flex-col items-start justify-center gap-8">
              <p className={`text-xs uppercase tracking-[0.35em] ${palette.muted}`}>Step 1: Welcome Animation</p>
              <div className="space-y-5">
                <h2 className={`text-3xl font-semibold leading-tight sm:text-5xl ${palette.heading}`}>
                  Focus on the signal,
                  <br />
                  not the noise.
                </h2>
                <p className={`max-w-2xl text-sm sm:text-lg ${palette.muted}`}>
                  This flow is tuned for last-night revision: import your answer-key PDF, randomize quiz behavior, and
                  get immediate correct or wrong feedback.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStage("upload")}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all ${palette.primaryButton}`}
              >
                <Play className="h-4 w-4" />
                Start Workflow
              </button>
            </div>
          )}

          {stage === "upload" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <p className={`text-xs uppercase tracking-[0.35em] ${palette.muted}`}>Step 2: Upload PDF</p>
                <h2 className={`text-2xl font-semibold sm:text-3xl ${palette.heading}`}>Import Question Bank</h2>
                <p className={`text-sm sm:text-base ${palette.muted}`}>
                  Upload your PDF that includes question, options, and correct answer lines.
                </p>
              </div>

              <label
                htmlFor="pdfFile"
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${palette.border} ${palette.input}`}
              >
                <UploadCloud className="h-5 w-5" />
                <span>{selectedFile ? selectedFile.name : "Choose PDF file"}</span>
              </label>
              <input id="pdfFile" type="file" accept=".pdf,application/pdf" className="sr-only" onChange={onFileChange} />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={extractQuestions}
                  disabled={!selectedFile || isExtracting}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${palette.primaryButton}`}
                >
                  <FileUp className="h-4 w-4" />
                  {isExtracting ? "Extracting..." : "Extract Questions"}
                </button>

                <button
                  type="button"
                  onClick={() => setStage("welcome")}
                  className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${palette.secondaryButton}`}
                >
                  Back
                </button>
              </div>

              <p className={`text-sm ${statusClass}`}>{status.text}</p>

              {extractedQuestions.length > 0 && (
                <div className={`rounded-2xl border p-4 ${palette.border}`}>
                  <p className={`text-sm ${palette.muted}`}>
                    Ready: <span className={`font-semibold ${palette.heading}`}>{extractedQuestions.length}</span> questions
                    extracted.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStage("setup")}
                    className={`mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${palette.primaryButton}`}
                  >
                    Continue to Quiz Options
                  </button>
                </div>
              )}
            </div>
          )}

          {stage === "setup" && (
            <div className="space-y-7">
              <div className="space-y-3">
                <p className={`text-xs uppercase tracking-[0.35em] ${palette.muted}`}>Step 3: Start Quiz</p>
                <h2 className={`text-2xl font-semibold sm:text-3xl ${palette.heading}`}>Configure Randomization</h2>
                <p className={`text-sm sm:text-base ${palette.muted}`}>
                  Choose how the quiz should randomize content before you begin.
                </p>
              </div>

              <div className="space-y-3">
                <label className={`flex items-start gap-3 rounded-2xl border p-4 ${palette.border}`}>
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(event) => setShuffleQuestions(event.target.checked)}
                    className="mt-1 h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <p className={`text-sm font-semibold ${palette.heading}`}>1. Shuffle Questions</p>
                    <p className={`text-sm ${palette.muted}`}>
                      Randomize question order each time to improve long-term recall.
                    </p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 rounded-2xl border p-4 ${palette.border}`}>
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(event) => setShuffleOptions(event.target.checked)}
                    className="mt-1 h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <p className={`text-sm font-semibold ${palette.heading}`}>2. Shuffle Options</p>
                    <p className={`text-sm ${palette.muted}`}>
                      Rearrange option positions so your memory focuses on content, not fixed order.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={startQuiz}
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${palette.primaryButton}`}
                >
                  <Shuffle className="h-4 w-4" />
                  Start Quiz
                </button>
                <button
                  type="button"
                  onClick={() => setStage("upload")}
                  className={`inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition ${palette.secondaryButton}`}
                >
                  Back to Upload
                </button>
              </div>
            </div>
          )}

          {stage === "quiz" && currentQuestion && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className={`text-xs uppercase tracking-[0.35em] ${palette.muted}`}>Step 4: Quiz Running</p>
                  <span className={`text-xs font-medium ${palette.muted}`}>{progressLabel}</span>
                </div>
                <div className={`h-2 overflow-hidden rounded-full border ${palette.border}`}>
                  <div className="h-full rounded-full bg-white transition-all duration-500 dark:bg-neutral-100" style={{ width: progressWidth }} />
                </div>
                <h2 className={`text-xl font-semibold leading-tight sm:text-3xl ${palette.heading}`}>
                  {currentQuestion.questionText}
                </h2>
              </div>

              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const selected = selectedOptionIndex === index;
                  const showCorrect = showAnswer && option.isCorrect;
                  const showWrong = showAnswer && selected && !option.isCorrect;

                  const stateClass = showCorrect
                    ? palette.optionCorrect
                    : showWrong
                    ? palette.optionWrong
                    : palette.option;

                  return (
                    <button
                      key={`${currentQuestion.id}-${index}-${option.key}`}
                      type="button"
                      onClick={() => selectAnswer(index)}
                      disabled={showAnswer}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${stateClass}`}
                    >
                      <span className="pt-0.5">
                        {showCorrect ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : selected ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Circle className="h-5 w-5 opacity-70" />
                        )}
                      </span>
                      <span className="text-sm sm:text-base">{option.text}</span>
                    </button>
                  );
                })}
              </div>

              <div className="min-h-8">
                {showAnswer && (
                  <p className={`text-sm font-medium ${selectedIsCorrect ? palette.success : palette.error}`}>
                    {selectedIsCorrect ? "Correct answer." : `Wrong answer. Correct option: ${correctOptionText}`}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!showAnswer}
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${palette.primaryButton}`}
                >
                  {isLastQuestion ? <Trophy className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isLastQuestion ? "Show Result" : "Next Question"}
                </button>
              </div>
            </div>
          )}

          {stage === "result" && (
            <div className="space-y-7">
              <div className="space-y-3">
                <p className={`text-xs uppercase tracking-[0.35em] ${palette.muted}`}>Step 5: Final Result</p>
                <h2 className={`text-2xl font-semibold sm:text-3xl ${palette.heading}`}>Session Complete</h2>
              </div>

              <div className={`rounded-2xl border p-5 ${palette.border}`}>
                <p className={`text-sm ${palette.muted}`}>Your Score</p>
                <p className={`mt-2 text-3xl font-semibold ${palette.heading}`}>
                  {score} / {quizQuestions.length} ({percentage}%)
                </p>
                <p className={`mt-3 text-sm ${palette.muted}`}>{performanceText}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={startQuiz}
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${palette.primaryButton}`}
                >
                  <Shuffle className="h-4 w-4" />
                  Play Again
                </button>
                <button
                  type="button"
                  onClick={() => setStage("upload")}
                  className={`inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition ${palette.secondaryButton}`}
                >
                  Upload Another PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

async function readPdfAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const allPages: string[] = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let currentLine = "";

    const items = content.items as Array<{ str?: string; hasEOL?: boolean }>;

    for (const item of items) {
      const text = typeof item.str === "string" ? item.str : "";
      currentLine += `${text} `;
      if (item.hasEOL) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    allPages.push(lines.join("\n"));
  }

  return allPages.join("\n");
}

function parseQuestions(rawText: string): QuizQuestion[] {
  const normalized = rawText
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  const optionPrepped = normalized.replace(/\s([A-H]\s*[\).:-])/g, "\n$1");
  const questionBlocks = optionPrepped.split(/\n(?=\d+\s*[).]\s+)/g).filter(Boolean);

  const parsed: QuizQuestion[] = [];

  for (const block of questionBlocks) {
    const questionMatch = block.match(/^\s*(\d+)\s*[).]\s*([\s\S]*)$/);
    if (!questionMatch) {
      continue;
    }

    const questionNumber = Number(questionMatch[1]);
    const body = questionMatch[2].trim();

    const answerMatch = body.match(/(?:^|\n)\s*(?:answer|ans|correct(?:\s*option)?)\s*[:\-]?\s*\(?([A-H])\)?/i);
    const answerKey = answerMatch ? answerMatch[1].toUpperCase() : null;

    const firstOptionIndex = body.search(/(?:^|\n)\s*[A-H]\s*[).:-]\s+/i);
    if (firstOptionIndex < 0) {
      continue;
    }

    const questionText = body.slice(0, firstOptionIndex).replace(/\s+/g, " ").trim();

    const options: QuizOption[] = [];
    const optionRegex =
      /(?:^|\n)\s*([A-H])\s*[).:-]\s*([\s\S]*?)(?=(?:\n\s*[A-H]\s*[).:-]\s*)|(?:\n\s*(?:answer|ans|correct(?:\s*option)?)\s*[:\-])|$)/gi;

    let optionMatch: RegExpExecArray | null;
    while ((optionMatch = optionRegex.exec(body)) !== null) {
      const key = optionMatch[1].toUpperCase();
      const text = optionMatch[2].replace(/\s+/g, " ").trim();

      if (text) {
        options.push({
          key,
          text,
          isCorrect: key === answerKey,
        });
      }
    }

    if (!questionText || !answerKey || options.length < 2 || !options.some((item) => item.isCorrect)) {
      continue;
    }

    parsed.push({
      id: questionNumber,
      questionText,
      options,
    });
  }

  return parsed;
}

function shuffleArray<T>(source: T[]): T[] {
  const arr = [...source];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export default QuizMonochrome;
export { QuizMonochrome };
