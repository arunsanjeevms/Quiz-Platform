import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  FileUp,
  Play,
  Shuffle,
  Trophy,
  UploadCloud,
} from "lucide-react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs";

const INTRO_STYLE_ID = "quiz-mono-animations";

const stageLabels = [
  { id: "welcome", label: "Welcome" },
  { id: "upload", label: "Upload PDF" },
  { id: "setup", label: "Quiz Options" },
  { id: "quiz", label: "Quiz" },
  { id: "result", label: "Result" },
] as const;

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

const palette = {
  surface: "bg-neutral-950 text-neutral-100",
  panel: "bg-neutral-900/55",
  border: "border-white/10",
  heading: "text-white",
  muted: "text-neutral-400",
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
  aurora:
    "radial-gradient(ellipse 60% 100% at 10% 0%, rgba(226, 232, 240, 0.15), transparent 64%), #000000",
  overlay: "linear-gradient(130deg, rgba(255,255,255,0.05) 0%, transparent 65%)",
} as const;

function QuizMonochrome() {
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
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
      @keyframes quiz-mono-quote-fade {
        0%, 100% { opacity: 0.45; transform: translate3d(0, 8px, 0); }
        50% { opacity: 1; transform: translate3d(0, 0, 0); }
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
      .quiz-mono-quote {
        animation: quiz-mono-quote-fade 3.8s ease-in-out infinite;
      }
      .quiz-mono-beacon {
        position: absolute;
        inset: -20%;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.2);
        animation: quiz-mono-beacon 2.6s ease-out infinite;
        pointer-events: none;
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

    const syncFullscreenState = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);

      if (active || stage !== "quiz") {
        setFullscreenMessage("");
        return;
      }

      setFullscreenMessage("Fullscreen is required. Re-enter fullscreen to continue the test.");
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, [stage]);

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
  const quizLocked = stage === "quiz" && !isFullscreen;

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

  const requestQuizFullscreen = async () => {
    if (typeof document === "undefined") {
      return false;
    }

    if (document.fullscreenElement) {
      setIsFullscreen(true);
      setFullscreenMessage("");
      return true;
    }

    const root = document.documentElement;
    if (!root.requestFullscreen) {
      setFullscreenMessage("Your browser does not support fullscreen mode.");
      return false;
    }

    try {
      await root.requestFullscreen();
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) {
        setFullscreenMessage("Please enter fullscreen to continue the quiz.");
      } else {
        setFullscreenMessage("");
      }
      return active;
    } catch (error) {
      console.error(error);
      setFullscreenMessage("Fullscreen permission was blocked. Allow fullscreen to continue.");
      return false;
    }
  };

  const startQuiz = async () => {
    if (extractedQuestions.length === 0) {
      setStatus({ tone: "error", text: "Extract questions first." });
      setStage("upload");
      return;
    }

    const fullscreenEnabled = await requestQuizFullscreen();
    if (!fullscreenEnabled) {
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
    if (!currentQuestion || showAnswer || !isFullscreen) {
      return;
    }

    setSelectedOptionIndex(index);
    setShowAnswer(true);

    if (currentQuestion.options[index]?.isCorrect) {
      setScore((prev) => prev + 1);
    }
  };

  const goNext = () => {
    if (!showAnswer || !isFullscreen) {
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
        style={{ background: palette.overlay, mixBlendMode: "screen" }}
      />

      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-14 lg:px-12 lg:py-20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <p
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-[0.4em] ${
                palette.border
              } ${palette.muted}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
               Quiz Flow Engine
            </p>
            <h1 className={`text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl ${palette.heading}`}>
                          <span className={introReady ? "quiz-mono-title" : ""}>Stop Guessing. Start Mastering !</span>
            </h1>
            <p className={`max-w-2xl text-sm sm:text-base ${palette.muted}`}>
            Built for the last mile of your preparation           </p>
          </div>

          {/* <div className={`relative inline-flex h-12 items-center gap-3 rounded-full border bg-white/10 px-5 text-sm font-medium text-white ${palette.border}`}>
            <span className="relative flex h-3 w-3 items-center justify-center">
              <span className="quiz-mono-beacon" aria-hidden="true" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            Dark Mode
          </div> */}
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
                  <span className="quiz-mono-quote">Memorize Smarter,</span>
                  <br />
                  <span className="quiz-mono-quote">Not Harder.</span>
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

              <p className={`text-xs uppercase tracking-[0.18em] ${palette.muted}`}>
                Quiz mode will switch to fullscreen and stay locked until you re-enter fullscreen if you exit.
              </p>
            </div>
          )}

          {stage === "quiz" && currentQuestion && (
            <div className="relative">
              <div className={`space-y-6 transition-opacity duration-200 ${quizLocked ? "pointer-events-none select-none opacity-35" : ""}`}>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className={`text-xs uppercase tracking-[0.35em] ${palette.muted}`}>Step 4: Quiz Running</p>
                    <span className={`text-xs font-medium ${palette.muted}`}>{progressLabel}</span>
                  </div>
                  <div className={`h-2 overflow-hidden rounded-full border ${palette.border}`}>
                    <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: progressWidth }} />
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
                        disabled={showAnswer || quizLocked}
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
                    disabled={!showAnswer || quizLocked}
                    className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${palette.primaryButton}`}
                  >
                    {isLastQuestion ? <Trophy className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isLastQuestion ? "Show Result" : "Next Question"}
                  </button>
                </div>
              </div>

              {quizLocked && (
                <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-3xl border bg-black/85 p-6 text-center backdrop-blur-sm ${palette.border}`}>
                  <p className={`text-sm uppercase tracking-[0.25em] ${palette.muted}`}>Quiz Paused</p>
                  <h3 className={`text-xl font-semibold ${palette.heading}`}>Return to Fullscreen</h3>
                  <p className={`max-w-md text-sm ${palette.muted}`}>
                    {fullscreenMessage || "Fullscreen is required. Re-enter fullscreen to continue the test."}
                  </p>
                  <button
                    type="button"
                    onClick={requestQuizFullscreen}
                    className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${palette.primaryButton}`}
                  >
                    Continue in Fullscreen
                  </button>
                </div>
              )}
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

                          <p className={`pt-1 text-xs uppercase tracking-[0.1em] ${palette.muted} text-center`}>
                              Developed by Arun Sanjeev
                          </p>
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
