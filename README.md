<h1 align="center">PDF Quiz Trainer</h1>

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Poppins&weight=700&size=30&duration=3200&pause=900&color=0E7490&center=true&vCenter=true&width=980&lines=PDF+Quiz+Trainer;Built+with+React+%2B+TypeScript+%2B+shadcn%2Fui;Upload+PDFs+and+Practice+Any+Quiz+Set" alt="Animated project intro" />
</p>

<p align="center">
  A reusable quiz platform that can be used for all quiz sets, not tied to any single exam.
</p>

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [How It Works](#how-it-works)
- [Expected PDF Format](#expected-pdf-format)
- [Getting Started](#getting-started)
- [RAG Roadmap (Can Be Added Later)](#rag-roadmap-can-be-added-later)
- [Notes](#notes)

## Overview

PDF Quiz Trainer converts MCQ-style PDFs into an interactive quiz experience. It is designed to work across different subjects and quiz banks.

## Features

- Upload PDFs that contain MCQs and answer keys.
- Extract and parse quiz questions from PDF text.
- Shuffle questions and options on each run.
- Show immediate Correct or Wrong feedback.
- Display final score after completion.

## Tech Stack

<p>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/shadcn%2Fui-111111?style=for-the-badge&logo=shadcnui&logoColor=white" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
</p>

## How It Works

1. Upload an MCQ PDF.
2. Extract raw text from the PDF.
3. Parse questions, options, and answer keys.
4. Render a randomized quiz session.
5. Show instant feedback and final score.

## Expected PDF Format

Use this structure for best extraction quality:

```text
1. What is ...?
A) Option one
B) Option two
C) Option three
D) Option four
Answer: B
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

4. Preview production build:

```bash
npm run preview
```

## RAG Roadmap (Can Be Added Later)

RAG is not required for the current workflow. For fixed MCQ banks and deterministic answer checking, direct parsing plus quiz logic is usually faster and simpler.

RAG can be implemented later for advanced capabilities such as:

- Natural language search across large study notes.
- Explanation generation from multiple source documents.
- Semantic retrieval across many PDFs.

## Notes

- Extraction quality depends on selectable text inside PDFs.
- Scanned or image-only PDFs need OCR before parsing.
