const state = {
  extractedQuestions: [],
  quizQuestions: [],
  currentIndex: 0,
  score: 0,
  answered: false,
  currentStep: "upload",
};

const refs = {
  pdfFile: document.getElementById("pdfFile"),
  extractBtn: document.getElementById("extractBtn"),
  startQuizBtn: document.getElementById("startQuizBtn"),
  statusText: document.getElementById("statusText"),
  uploadScreen: document.getElementById("uploadScreen"),
  quizScreen: document.getElementById("quizScreen"),
  resultScreen: document.getElementById("resultScreen"),
  stepUpload: document.getElementById("stepUpload"),
  stepQuiz: document.getElementById("stepQuiz"),
  stepResult: document.getElementById("stepResult"),
  questionHeading: document.getElementById("questionHeading"),
  progressPill: document.getElementById("progressPill"),
  questionText: document.getElementById("questionText"),
  optionsContainer: document.getElementById("optionsContainer"),
  feedbackText: document.getElementById("feedbackText"),
  nextBtn: document.getElementById("nextBtn"),
  restartBtn: document.getElementById("restartBtn"),
  scoreText: document.getElementById("scoreText"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  backToUploadBtn: document.getElementById("backToUploadBtn"),
};

const stepOrder = ["upload", "quiz", "result"];

showStep("upload");

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

refs.pdfFile.addEventListener("change", () => {
  const hasFile = refs.pdfFile.files && refs.pdfFile.files.length > 0;
  refs.extractBtn.disabled = !hasFile;
  refs.startQuizBtn.disabled = true;
  state.extractedQuestions = [];
  setStatus(hasFile ? "PDF selected. Click Extract Questions." : "Upload a PDF to begin.", "muted");
  showStep("upload");
});

refs.extractBtn.addEventListener("click", async () => {
  const file = refs.pdfFile.files && refs.pdfFile.files[0];
  if (!file) {
    setStatus("Please choose a PDF first.", "error");
    return;
  }

  if (!window.pdfjsLib) {
    setStatus("PDF parser failed to load. Check internet and refresh.", "error");
    return;
  }

  refs.extractBtn.disabled = true;
  refs.startQuizBtn.disabled = true;
  setStatus("Reading PDF and extracting questions...", "muted");

  try {
    const fullText = await readPdfAsText(file);
    const questions = parseQuestions(fullText);

    if (questions.length === 0) {
      setStatus(
        "No valid MCQs found. Keep each question with options (A/B/C/D) and an Answer line.",
        "error"
      );
      state.extractedQuestions = [];
      return;
    }

    state.extractedQuestions = questions;
    refs.startQuizBtn.disabled = false;
    setStatus(`Extracted ${questions.length} questions. Click Start Quiz.`, "success");
  } catch (error) {
    console.error(error);
    setStatus("Failed to parse this PDF. Try a cleaner PDF text format.", "error");
  } finally {
    refs.extractBtn.disabled = false;
  }
});

refs.startQuizBtn.addEventListener("click", () => {
  if (state.extractedQuestions.length === 0) {
    setStatus("Extract questions before starting.", "error");
    return;
  }

  startQuiz();
});

refs.nextBtn.addEventListener("click", () => {
  if (state.currentIndex >= state.quizQuestions.length - 1) {
    showSummary();
    return;
  }

  state.currentIndex += 1;
  renderQuestion();
});

refs.restartBtn.addEventListener("click", () => {
  if (state.extractedQuestions.length === 0) {
    showStep("upload");
    return;
  }

  startQuiz();
});

refs.playAgainBtn.addEventListener("click", () => {
  if (state.extractedQuestions.length === 0) {
    showStep("upload");
    return;
  }

  startQuiz();
});

refs.backToUploadBtn.addEventListener("click", () => {
  showStep("upload");

  if (state.extractedQuestions.length > 0) {
    setStatus(`Ready with ${state.extractedQuestions.length} extracted questions.`, "success");
    refs.startQuizBtn.disabled = false;
  } else {
    setStatus("Upload a PDF to begin.", "muted");
    refs.startQuizBtn.disabled = true;
  }
});

function setStatus(message, mode) {
  refs.statusText.textContent = message;
  refs.statusText.className = `status ${mode}`;
}

function showStep(stepName) {
  state.currentStep = stepName;

  refs.uploadScreen.classList.toggle("hidden", stepName !== "upload");
  refs.quizScreen.classList.toggle("hidden", stepName !== "quiz");
  refs.resultScreen.classList.toggle("hidden", stepName !== "result");

  const chips = {
    upload: refs.stepUpload,
    quiz: refs.stepQuiz,
    result: refs.stepResult,
  };

  const activeIndex = stepOrder.indexOf(stepName);
  for (let i = 0; i < stepOrder.length; i += 1) {
    const name = stepOrder[i];
    const chip = chips[name];
    chip.classList.toggle("active", i === activeIndex);
    chip.classList.toggle("done", i < activeIndex);
  }
}

async function readPdfAsText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const allPages = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const lines = [];
    let currentLine = "";

    for (const item of content.items) {
      currentLine += `${item.str} `;
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

function parseQuestions(rawText) {
  const normalized = rawText
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  // Encourage stable parsing by making option markers start from a new line.
  const optionPrepped = normalized.replace(/\s([A-H]\s*[\)\.:-])/g, "\n$1");

  const questionBlocks = optionPrepped.split(/\n(?=\d+\s*[\).]\s+)/g).filter(Boolean);
  const parsed = [];

  for (const block of questionBlocks) {
    const questionMatch = block.match(/^\s*(\d+)\s*[\).]\s*([\s\S]*)$/);
    if (!questionMatch) {
      continue;
    }

    const questionNumber = Number(questionMatch[1]);
    const body = questionMatch[2].trim();

    const answerMatch = body.match(/(?:^|\n)\s*(?:answer|ans|correct(?:\s*option)?)\s*[:\-]?\s*\(?([A-H])\)?/i);
    const answerKey = answerMatch ? answerMatch[1].toUpperCase() : null;

    const firstOptionIndex = body.search(/(?:^|\n)\s*[A-H]\s*[\).:-]\s+/i);
    if (firstOptionIndex < 0) {
      continue;
    }

    let questionText = body.slice(0, firstOptionIndex).trim();
    questionText = questionText.replace(/\s+/g, " ");

    const options = [];
    const optionRegex = /(?:^|\n)\s*([A-H])\s*[\).:-]\s*([\s\S]*?)(?=(?:\n\s*[A-H]\s*[\).:-]\s*)|(?:\n\s*(?:answer|ans|correct(?:\s*option)?)\s*[:\-])|$)/gi;

    let optionMatch;
    while ((optionMatch = optionRegex.exec(body)) !== null) {
      const key = optionMatch[1].toUpperCase();
      const text = optionMatch[2].replace(/\s+/g, " ").trim();
      if (text) {
        options.push({ key, text, isCorrect: key === answerKey });
      }
    }

    if (!questionText || options.length < 2 || !answerKey) {
      continue;
    }

    if (!options.some((opt) => opt.key === answerKey)) {
      continue;
    }

    parsed.push({
      id: questionNumber,
      questionText,
      answerKey,
      options,
    });
  }

  return parsed;
}

function startQuiz() {
  state.currentIndex = 0;
  state.score = 0;
  state.quizQuestions = shuffleArray(
    state.extractedQuestions.map((q) => ({
      ...q,
      options: shuffleArray(q.options.map((opt) => ({ ...opt }))),
    }))
  );

  showStep("quiz");
  renderQuestion();
}

function renderQuestion() {
  const question = state.quizQuestions[state.currentIndex];
  state.answered = false;

  refs.questionHeading.textContent = `Question ${state.currentIndex + 1}`;
  refs.progressPill.textContent = `${state.currentIndex + 1} / ${state.quizQuestions.length}`;
  refs.questionText.textContent = question.questionText;
  refs.feedbackText.textContent = "";
  refs.feedbackText.className = "feedback";
  refs.nextBtn.classList.add("hidden");

  refs.optionsContainer.innerHTML = "";

  for (const option of question.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-btn";
    button.dataset.key = option.key;
    button.innerHTML = `<span class="option-key">${option.key}</span><span>${option.text}</span>`;

    button.addEventListener("click", () => {
      handleAnswer(button.dataset.key || "");
    });

    refs.optionsContainer.appendChild(button);
  }
}

function handleAnswer(selectedKey) {
  if (state.answered) {
    return;
  }

  state.answered = true;
  const question = state.quizQuestions[state.currentIndex];
  const isCorrect = selectedKey === question.answerKey;

  if (isCorrect) {
    state.score += 1;
    refs.feedbackText.textContent = "Correct.";
    refs.feedbackText.className = "feedback correct";
  } else {
    refs.feedbackText.textContent = `Wrong. Correct answer: ${question.answerKey}`;
    refs.feedbackText.className = "feedback wrong";
  }

  const optionButtons = refs.optionsContainer.querySelectorAll(".option-btn");
  optionButtons.forEach((button) => {
    const key = button.dataset.key;
    button.disabled = true;

    if (key === question.answerKey) {
      button.classList.add("correct");
      return;
    }

    if (key === selectedKey && !isCorrect) {
      button.classList.add("wrong");
    }
  });

  if (state.currentIndex >= state.quizQuestions.length - 1) {
    refs.nextBtn.textContent = "Show Result";
  } else {
    refs.nextBtn.textContent = "Next";
  }

  refs.nextBtn.classList.remove("hidden");
}

function showSummary() {
  const total = state.quizQuestions.length;
  const percentage = total > 0 ? Math.round((state.score / total) * 100) : 0;

  showStep("result");
  refs.scoreText.textContent = `Score: ${state.score} / ${total} (${percentage}%)`;
}

function shuffleArray(source) {
  const arr = [...source];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}
