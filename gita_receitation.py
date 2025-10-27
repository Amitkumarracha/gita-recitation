# gita_receitation.py
# Flask backend for Guided Recitation: Whisper small + Gemini reference + scoring + progress
# Endpoints:
#   GET  /api/guided/audio?shloka=<int>&line=<int>
#   POST /api/guided/submit  (FormData: user_id, shloka_no, line_no, audio)
#   GET  /api/progress/ch15?user_id=<id>

import os
import re
import sqlite3
import tempfile
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher
from typing import Dict, Any, List, Tuple

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

# Whisper (requires ffmpeg)
import whisper

# Gemini
import google.generativeai as genai

# -----------------------
# Config and constants
# -----------------------
load_dotenv()

CHAPTER = 15
# Lines per shloka in Chapter 15 (update if needed)
LINES_PER_SHLOKA = {
    1: 5,
    2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 4,
    11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4
}
TOTAL_SHLOKAS = len(LINES_PER_SHLOKA)

REF_AUDIO_ROOT = os.getenv("REF_AUDIO_ROOT", "reference_audio")
PASS_THRESHOLD = int(os.getenv("PASS_THRESHOLD", "70"))

# Gemini model selection: prefer 2.5 pro if available, fallback gracefully
GEMINI_MODEL_CANDIDATES = [
    os.getenv("GEMINI_MODEL", "gemini-2.5-pro"),
    "gemini-2.0-pro",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
]

# Optional fallback text for stability (only shloka 1 here; expand as needed)
FALLBACK_LINES = {
    1: {
        1: "śrī-bhagavān uvāca",
        2: "ūrdhva-mūlam adhaḥ-śākham",
        3: "aśvatthaṃ prāhur avyayam",
        4: "chandāṃsi yasya parṇāni",
        5: "yas taṃ veda sa veda-vit",
    }
}

# -----------------------
# App and services
# -----------------------
app = Flask(__name__)
CORS(app)

# Lazy-loaded Whisper small model
_WHISPER_MODEL = None


def get_whisper_model():
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        # "small" is a good balance of quality and speed
        _WHISPER_MODEL = whisper.load_model("small")
    return _WHISPER_MODEL


# Configure Gemini
api_key = os.getenv("GOOGLE_API_KEY", "")
if not api_key:
    print("WARNING: GOOGLE_API_KEY not set; Gemini calls will fallback to local text if available.")
genai.configure(api_key=api_key)


def get_gemini_model():
    last_err = None
    for name in GEMINI_MODEL_CANDIDATES:
        try:
            return genai.GenerativeModel(name)
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(f"Failed to initialize any Gemini model. Last error: {last_err}")


try:
    _GEMINI_MODEL = get_gemini_model()
except Exception as _e:
    _GEMINI_MODEL = None
    print(f"WARNING: Gemini model unavailable. Will use FALLBACK_LINES when possible. Error: {_e}")


# -----------------------
# Utility: audio locator
# -----------------------
ALLOWED_EXTS = [".mp3", ".wav", ".m4a", ".ogg", ".webm"]


def locate_reference_audio(root: str, shloka_no: int, line_no: int) -> str | None:
    """
    Finds: shloka{n}/ch15_shloka{n}_line{m}_geetachanting.{ext}
    """
    sdir = Path(root) / f"shloka{shloka_no}"
    base = f"ch15_shloka{shloka_no}_line{line_no}_geetachanting"
    if not sdir.exists():
        return None
    for ext in ALLOWED_EXTS:
        candidate = sdir / f"{base}{ext}"
        if candidate.exists():
            return str(candidate)
    # fallback to any matching name
    for p in sdir.glob(f"{base}.*"):
        return str(p)
    return None


# -----------------------
# Text normalization & scoring
# -----------------------
def strip_diacritics(s: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")


def normalize_text(s: str) -> str:
    if not s:
        return ""
    s = s.lower().strip()
    s = strip_diacritics(s)
    # keep letters, spaces, and hyphens
    s = re.sub(r"[^a-z\s\-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokens(s: str) -> List[str]:
    return normalize_text(s).split()


def string_accuracy(user_text: str, ref_text: str) -> float:
    a = normalize_text(user_text)
    b = normalize_text(ref_text)
    if not a or not b:
        return 0.0
    return round(SequenceMatcher(None, a, b).ratio() * 100.0, 2)


def align_words(user_text: str, ref_text: str) -> Tuple[List[Dict[str, str]], List[str]]:
    """
    Returns (mistakes, correct_words).
      mistakes: list of {heard, should_be}
      correct_words: list of words that matched in-place
    Uses token-level alignment with difflib.
    """
    ref_tokens = tokens(ref_text)
    user_tokens = tokens(user_text)

    sm = SequenceMatcher(None, ref_tokens, user_tokens)
    mistakes: List[Dict[str, str]] = []
    correct_words: List[str] = []

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            # exact matches in normalized form
            correct_words.extend(ref_tokens[i1:i2])
        elif tag == "replace":
            # pairwise mismatches
            r_segment = ref_tokens[i1:i2]
            u_segment = user_tokens[j1:j2]
            for r, u in zip(r_segment, u_segment):
                if r != u:
                    mistakes.append({"heard": u, "should_be": r})
            # leftovers
            if len(r_segment) > len(u_segment):
                for r in r_segment[len(u_segment):]:
                    mistakes.append({"heard": "", "should_be": r})
            elif len(u_segment) > len(r_segment):
                for u in u_segment[len(r_segment):]:
                    mistakes.append({"heard": u, "should_be": ""})
        elif tag == "delete":
            for r in ref_tokens[i1:i2]:
                mistakes.append({"heard": "", "should_be": r})
        elif tag == "insert":
            for u in user_tokens[j1:j2]:
                mistakes.append({"heard": u, "should_be": ""})

    # dedupe correct words for a cleaner UI
    seen = set()
    dedup_correct = []
    for w in correct_words:
        if w not in seen:
            seen.add(w)
            dedup_correct.append(w)

    return mistakes, dedup_correct


# -----------------------
# Whisper STT
# -----------------------
def transcribe_audio(file_path: str) -> str:
    model = get_whisper_model()
    # If CPU only, ensure fp16=False
    result = model.transcribe(file_path, fp16=False)
    text = (result.get("text") or "").strip()
    return text


# -----------------------
# Gemini reference text
# -----------------------
def get_reference_line_from_gemini(shloka_no: int, line_no: int) -> str:
    """
    Ask Gemini for exactly one line (IAST-like, whisper-style) and return plain text.
    Fallback to local known lines if model unavailable.
    """
    if _GEMINI_MODEL is None:
        return FALLBACK_LINES.get(shloka_no, {}).get(line_no, "")

    prompt = f"""
You are a precise text retriever.

Task: Return exactly one line (no extra words) from the Bhagavad Gita, Chapter 15.
- Provide the requested shloka and line only.
- Style similar to a Whisper STT output:
  - lowercase
  - keep hyphens in compounds
  - avoid punctuation other than hyphens
  - single line with no quotes/explanations

chapter: 15
shloka: {shloka_no}
line: {line_no}

Return only the line text.
"""
    try:
        resp = _GEMINI_MODEL.generate_content(prompt)
        text = (resp.text or "").strip()
        # guard against extra lines
        text = text.splitlines()[0].strip()
        return text
    except Exception:
        return FALLBACK_LINES.get(shloka_no, {}).get(line_no, "")


# -----------------------
# Progress store (SQLite)
# -----------------------
class ProgressStore:
    def __init__(self, db_path: str = "progress.db"):
        self.db_path = db_path
        self._init_db()

    def _conn(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        with self._conn() as con:
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS line_progress (
                    user_id TEXT,
                    chapter INTEGER,
                    shloka INTEGER,
                    line INTEGER,
                    attempts INTEGER DEFAULT 0,
                    best_accuracy REAL DEFAULT 0,
                    completed INTEGER DEFAULT 0,
                    PRIMARY KEY (user_id, chapter, shloka, line)
                )
                """
            )
            con.commit()

    def upsert_attempt(self, user_id: str, shloka: int, line: int, accuracy: float, pass_threshold: int) -> Dict[str, Any]:
        with self._conn() as con:
            row = con.execute(
                """
                SELECT attempts, best_accuracy, completed
                FROM line_progress
                WHERE user_id=? AND chapter=? AND shloka=? AND line=?
                """,
                (user_id, CHAPTER, shloka, line),
            ).fetchone()

            attempts = 0
            best = 0.0
            completed = 0
            if row:
                attempts, best, completed = row

            prev_completed = completed
            attempts += 1
            best = max(best, accuracy)
            if accuracy >= pass_threshold:
                completed = 1

            con.execute(
                """
                INSERT INTO line_progress(user_id, chapter, shloka, line, attempts, best_accuracy, completed)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, chapter, shloka, line)
                DO UPDATE SET attempts=excluded.attempts,
                              best_accuracy=excluded.best_accuracy,
                              completed=excluded.completed
                """,
                (user_id, CHAPTER, shloka, line, attempts, best, completed),
            )
            con.commit()

        first_time_line_completion = (prev_completed == 0 and completed == 1)
        xp_added = 5 if first_time_line_completion else 0

        return {
            "attempts": attempts,
            "best_accuracy": best,
            "line_completed": completed == 1,
            "xp_added": xp_added,
        }

    def get_shloka_progress(self, user_id: str, shloka: int) -> Dict[str, Any]:
        lines_total = int(LINES_PER_SHLOKA.get(shloka, 4))
        with self._conn() as con:
            rows = con.execute(
                """
                SELECT line, completed FROM line_progress
                WHERE user_id=? AND chapter=? AND shloka=?
                """,
                (user_id, CHAPTER, shloka),
            ).fetchall()
        completed_lines = sum(1 for _, c in rows if c == 1)
        percent = round((completed_lines / lines_total) * 100.0, 2) if lines_total else 0.0
        return {
            "shloka": shloka,
            "lines_completed": completed_lines,
            "total_lines": lines_total,
            "percent": percent,
        }

    def get_summary(self, user_id: str) -> Dict[str, Any]:
        with self._conn() as con:
            rows = con.execute(
                """
                SELECT shloka, line, completed
                FROM line_progress
                WHERE user_id=? AND chapter=?
                """,
                (user_id, CHAPTER),
            ).fetchall()

        per_shloka_completed: Dict[int, int] = {s: 0 for s in LINES_PER_SHLOKA}
        for shloka, line, completed in rows:
            if completed == 1:
                per_shloka_completed[shloka] += 1

        shlokas_mastered = 0
        for s, done in per_shloka_completed.items():
            if done >= LINES_PER_SHLOKA[s]:
                shlokas_mastered += 1

        completed_lines_total = sum(per_shloka_completed.values())
        xp_total = completed_lines_total * 5  # 5 XP per completed line
        chapter_progress = min(100.0, shlokas_mastered * 5.0)  # +5% per mastered shloka

        return {
            "chapter": CHAPTER,
            "xp_total": xp_total,
            "shlokas_mastered": shlokas_mastered,
            "chapter_progress_percent": round(chapter_progress, 2),
            "per_shloka": [
                {
                    "shloka": s,
                    "lines_completed": per_shloka_completed[s],
                    "total_lines": LINES_PER_SHLOKA[s],
                    "percent": round((per_shloka_completed[s] / LINES_PER_SHLOKA[s]) * 100.0, 2)
                    if LINES_PER_SHLOKA[s]
                    else 0.0,
                }
                for s in sorted(LINES_PER_SHLOKA.keys())
            ],
        }


store = ProgressStore("progress.db")


# -----------------------
# Routes
# -----------------------
@app.get("/api/guided/audio")
def get_reference_audio():
    try:
        shloka = int(request.args.get("shloka", "0"))
        line = int(request.args.get("line", "0"))
    except Exception:
        return jsonify({"error": "invalid parameters"}), 400

    path = locate_reference_audio(REF_AUDIO_ROOT, shloka, line)
    if not path:
        return jsonify({"error": "reference audio not found"}), 404
    return send_file(path, as_attachment=False)


@app.get("/api/progress/ch15")
def chapter15_progress():
    user_id = request.args.get("user_id", "guest")
    summary = store.get_summary(user_id)
    return jsonify(summary)


@app.post("/api/guided/submit")
def submit_attempt():
    user_id = request.form.get("user_id", "guest")
    try:
        shloka = int(request.form.get("shloka_no", "0"))
        line = int(request.form.get("line_no", "0"))
    except Exception:
        return jsonify({"error": "invalid shloka_no/line_no"}), 400

    if "audio" not in request.files:
        return jsonify({"error": "no audio uploaded"}), 400

    audio_file = request.files["audio"]
    if not audio_file:
        return jsonify({"error": "empty audio file"}), 400

    # Save temp audio
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            audio_path = tmp.name
            audio_file.save(audio_path)
    except Exception as e:
        return jsonify({"error": f"failed to save audio: {e}"}), 500

    try:
        # 1) Whisper STT
        recognized_text = transcribe_audio(audio_path)

        # 2) Gemini reference line
        reference_text = get_reference_line_from_gemini(shloka, line)

        # 3) Scoring and word alignment
        accuracy = string_accuracy(recognized_text, reference_text)
        mistakes, correct_words = align_words(recognized_text, reference_text)

        # 4) Pass/Fail and store attempt
        result = store.upsert_attempt(user_id, shloka, line, accuracy, PASS_THRESHOLD)

        # 5) Summary for UI updates
        summary = store.get_summary(user_id)
        shloka_progress = next((s for s in summary["per_shloka"] if s["shloka"] == shloka), None)

        payload = {
            "recognized_text": recognized_text,
            "reference_text": reference_text,
            "accuracy": accuracy,
            "pass_threshold": PASS_THRESHOLD,
            "line_completed": result["line_completed"],
            "attempts": result["attempts"],
            "xp_added": result["xp_added"],
            "mistakes": mistakes,
            "correct_words": correct_words,
            "shloka_progress": shloka_progress,
            "totals": {
                "xp_total": summary["xp_total"],
                "shlokas_mastered": summary["shlokas_mastered"],
                "chapter_progress_percent": summary["chapter_progress_percent"],
            },
        }
        return jsonify(payload)
    except Exception as e:
        return jsonify({"error": f"processing failed: {e}"}), 500
    finally:
        try:
            os.remove(audio_path)
        except Exception:
            pass


# -----------------------
# Main
# -----------------------
if __name__ == "__main__":
    # Ensure reference audio root exists (warn only)
    if not Path(REF_AUDIO_ROOT).exists():
        print(f"WARNING: REF_AUDIO_ROOT not found: {REF_AUDIO_ROOT}")

    app.run(host="0.0.0.0", port=8000, debug=True)