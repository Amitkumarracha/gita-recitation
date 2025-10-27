"use client"

import { useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import transcriptData from "@/data/transcript.json"

interface LineProgress {
  lineIndex: number
  translit: string
  raw: string
  score: number
  attempts: number
  mastered: boolean
  recordingUrl?: string
  feedback?: {
    score: number
    incorrectWords: Array<{ word: string; reason: string }>
    correctWords: string[]
    recognizedText?: string
    referenceText?: string
  }
}

interface ShlokaProgress {
  shlokaNumber: number
  lines: LineProgress[]
  totalScore: number
  mastered: boolean
  completedLines: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
const USER_ID = "guest" // replace with your auth user id if available
const BASE_XP = 20

function normalizeIAST(s?: string) {
  if (!s) return ""
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function computeFallbackCorrectWords(recognized?: string, reference?: string) {
  const a = normalizeIAST(recognized).split(" ").filter(Boolean)
  const b = normalizeIAST(reference).split(" ").filter(Boolean)
  const minLen = Math.min(a.length, b.length)
  const out: string[] = []
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) out.push(b[i])
  }
  return Array.from(new Set(out))
}

export default function RecitationModule() {
  const [shlokas, setShlokas] = useState<ShlokaProgress[]>(() => {
    return transcriptData
      .filter((item) => item.shloka > 0)
      .map((item) => ({
        shlokaNumber: item.shloka,
        lines: item.lines.map((line: any) => ({
          lineIndex: line.line_index,
          translit: line.translit,
          raw: line.raw,
          score: 0,
          attempts: 0,
          mastered: false,
          recordingUrl: undefined,
          feedback: undefined,
        })),
        totalScore: 0,
        mastered: false,
        completedLines: 0,
      }))
  })

  const [selectedShloka, setSelectedShloka] = useState(1)
  const [totalXP, setTotalXP] = useState(BASE_XP)
  const [badges, setBadges] = useState(0)
  const [chapterProgress, setChapterProgress] = useState(0)
  const [showMasteryAnimation, setShowMasteryAnimation] = useState(false)
  const [micPermissionPrompted, setMicPermissionPrompted] = useState<Set<string>>(new Set())

  const [activeLineKey, setActiveLineKey] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const currentShloka = shlokas.find((s) => s.shlokaNumber === selectedShloka)

  const requestMicrophoneAccess = async (lineKey: string) => {
    if (micPermissionPrompted.has(lineKey)) return true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicPermissionPrompted((prev) => new Set([...prev, lineKey]))
      return true
    } catch (error) {
      console.error("[v0] Microphone access denied:", error)
      alert("Microphone access is required to practice pronunciation.")
      return false
    }
  }

  const startRecording = async (lineKey: string) => {
    const hasPermission = await requestMicrophoneAccess(lineKey)
    if (!hasPermission) return

    try {
      if (!("MediaRecorder" in window)) {
        alert("Recording is not supported in this browser.")
        return
      }

      const mimeType =
        (window as any).MediaRecorder.isTypeSupported?.("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm"

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []

      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        // stop tracks to free mic
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null

        // Analyze after stop
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        await analyzePronunciation(lineKey, blob)
        setActiveLineKey(null)
      }

      mr.start()
      setActiveLineKey(lineKey)
      setIsRecording(true)
    } catch (err) {
      console.error("[v0] Failed to start recording:", err)
      alert("Could not start recording. Please try again.")
    }
  }

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return
    setIsRecording(false)
    try {
      mediaRecorderRef.current.stop()
    } catch (err) {
      console.error("[v0] Failed to stop recorder:", err)
    }
  }

  const analyzePronunciation = async (lineKey: string, audioBlob: Blob) => {
    setIsAnalyzing(true)

    try {
      const [shlokaNum, lineIdx] = lineKey.split("-").map(Number)

      // Build form data for backend (includes shloka_no and line_no)
      const formData = new FormData()
      formData.append("audio", audioBlob, `rec_${shlokaNum}_${lineIdx}.webm`)
      formData.append("user_id", USER_ID)
      formData.append("shloka_no", String(shlokaNum))
      formData.append("line_no", String(lineIdx))

      // Backend: Whisper small STT + Gemini reference + scoring + word tracking
      const response = await fetch(`${API_BASE}/api/guided/submit`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => "unknown error")
        throw new Error(`Analysis failed: ${response.status} ${errText}`)
      }

      const result = await response.json()

      // Robustly read fields from backend
      const accuracy = typeof result.accuracy === "number" ? result.accuracy : Number(result.score ?? 0)
      const threshold = Number(result.pass_threshold ?? 70)
      const lineCompleted = Boolean(result.line_completed)

      // Wrong words (various possible keys)
      const rawMistakes =
        result.mistakes ||
        result.incorrect_words ||
        result.wrong_words ||
        []

      const incorrectWords = Array.isArray(rawMistakes)
        ? rawMistakes.map((m: any) => {
            const heard = m.heard ?? m.user ?? m.word ?? ""
            const correct = m.should_be ?? m.correct ?? ""
            let reason = ""
            if (heard && correct) reason = `should be: ${correct}`
            else if (!heard && correct) reason = `missing: ${correct}`
            else if (heard && !correct) reason = "extra word"
            return { word: heard || correct, reason }
          })
        : []

      // Correct words (prefer backend; fallback to local alignment)
      const correctWordsFromBackend =
        result.correct_words ||
        result.matches ||
        []

      const recognizedText = result.recognized_text || ""
      const referenceText = result.reference_text || ""

      const correctWords: string[] =
        Array.isArray(correctWordsFromBackend) && correctWordsFromBackend.length > 0
          ? correctWordsFromBackend
          : computeFallbackCorrectWords(recognizedText, referenceText)

      // Update state
      setShlokas((prev) =>
        prev.map((shloka) => {
          if (shloka.shlokaNumber !== shlokaNum) return shloka

          const updatedLines = shloka.lines.map((l) => {
            if (l.lineIndex !== lineIdx) return l

            const newScore = lineCompleted ? 100 : Math.round(Number(accuracy) || 0)
            const blobUrl = URL.createObjectURL(audioBlob)

            return {
              ...l,
              score: newScore,
              attempts: typeof result.attempts === "number" ? result.attempts : l.attempts + 1,
              mastered: lineCompleted || (Number(accuracy) >= threshold),
              recordingUrl: blobUrl,
              feedback: {
                score: newScore,
                incorrectWords,
                correctWords,
                recognizedText,
                referenceText,
              },
            }
          })

          const completedLines = updatedLines.filter((x) => x.mastered).length
          const allLinesMastered =
            result.shloka_progress?.percent === 100 ||
            completedLines === updatedLines.length

          const avgScore =
            updatedLines.reduce((s, x) => s + (x.score || 0), 0) /
            (updatedLines.length || 1)

          return {
            ...shloka,
            lines: updatedLines,
            totalScore: Math.round(avgScore),
            mastered: allLinesMastered,
            completedLines:
              Number(result.shloka_progress?.lines_completed ?? completedLines),
          }
        })
      )

      // Update top stats from backend totals
      setTotalXP(BASE_XP + Number(result.totals?.xp_total ?? 0))
      const newBadges = Number(result.totals?.shlokas_mastered ?? 0)
      setBadges((prev) => {
        if (currentShloka && newBadges === shlokas.length && newBadges !== prev) {
          setShowMasteryAnimation(true)
          setTimeout(() => setShowMasteryAnimation(false), 5000)
        }
        return newBadges
      })
      setChapterProgress(Number(result.totals?.chapter_progress_percent ?? 0))
    } catch (error) {
      console.error("[v0] Error analyzing pronunciation:", error)
      alert("Error analyzing pronunciation. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const masteredShlokas = shlokas.filter((s) => s.mastered).length

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-100 to-purple-50 border-0 p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">{totalXP}</div>
            <div className="text-gray-700 font-semibold">Total XP Earned</div>
            <div className="text-xs text-gray-600 mt-1">Base: {BASE_XP} XP + 5 per line</div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-green-100 to-green-50 border-0 p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">{badges}</div>
            <div className="text-gray-700 font-semibold">Shlokas Mastered</div>
            <div className="text-xs text-gray-600 mt-1">
              {badges} of {shlokas.length} mastered
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-100 to-yellow-50 border-0 p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-yellow-600 mb-2">⭐</div>
            <div className="text-gray-700 font-semibold">{badges} Badges</div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-blue-100 to-blue-50 border-0 p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">{chapterProgress.toFixed(0)}%</div>
            <div className="text-gray-700 font-semibold">Chapter Progress</div>
          </div>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card className="bg-white border-2 border-gray-200 p-6">
        <div className="mb-2 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">Chapter 15 Progress</h3>
        <span className="text-sm font-semibold text-gray-600">
            {badges} of {shlokas.length} shlokas mastered
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-400 to-green-600 h-full transition-all duration-500"
            style={{ width: `${chapterProgress}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-600">{chapterProgress.toFixed(0)}% Complete</div>
      </Card>

      {/* Shloka Selection Grid */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Select a Shloka to Practice</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {shlokas.map((shloka) => {
            const completionPercentage = (shloka.completedLines / shloka.lines.length) * 100
            return (
              <button
                key={shloka.shlokaNumber}
                onClick={() => setSelectedShloka(shloka.shlokaNumber)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedShloka === shloka.shlokaNumber
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-bold text-gray-900">Shloka {shloka.shlokaNumber}</span>
                  {shloka.mastered && <span className="text-lg">✓</span>}
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {shloka.completedLines}/{shloka.lines.length} lines
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Current Shloka Practice Area */}
      {currentShloka && (
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 p-8">
          <div className="space-y-6">
            {/* Shloka Header */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Shloka {currentShloka.shlokaNumber}: {currentShloka.completedLines}/{currentShloka.lines.length} lines
                completed, {Math.round(currentShloka.totalScore)}% accuracy
              </h3>
            </div>

            {/* Line-by-Line Practice */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Practice Each Line:</h4>
              {currentShloka.lines.map((line) => {
                const lineKey = `${currentShloka.shlokaNumber}-${line.lineIndex}`
                const isActiveLine = activeLineKey === lineKey && isRecording

                return (
                  <div key={lineKey} className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <span className="font-semibold text-gray-900">
                          Shloka {currentShloka.shlokaNumber}, Line {line.lineIndex}
                        </span>
                        <div className="text-sm italic text-gray-700 mt-1">{line.translit}</div>
                      </div>
                      <div className="flex gap-3 text-sm ml-4">
                        <span className="text-gray-600">{line.attempts} attempts</span>
                        <span className="font-bold text-blue-600">{line.score}%</span>
                        {line.mastered && <span className="text-green-600 font-semibold">✓</span>}
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${line.score}%` }}
                      />
                    </div>

                    {line.feedback && (
                      <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm font-semibold text-gray-900 mb-2">Pronunciation Feedback</div>
                        {(line.feedback.recognizedText || line.feedback.referenceText) && (
                          <div className="mb-2 text-xs">
                            {line.feedback.referenceText && (
                              <div className="text-gray-700">
                                <span className="font-semibold">Reference:</span> {line.feedback.referenceText}
                              </div>
                            )}
                            {line.feedback.recognizedText && (
                              <div className="text-gray-700">
                                <span className="font-semibold">You said:</span> {line.feedback.recognizedText}
                              </div>
                            )}
                          </div>
                        )}
                        {line.feedback.incorrectWords.length > 0 && (
                          <div className="mb-2">
                            <div className="text-xs font-semibold text-red-700 mb-1">Words to improve:</div>
                            {line.feedback.incorrectWords.map((item, idx) => (
                              <div key={idx} className="text-xs text-red-600 mb-1">
                                <span className="font-semibold">✗ {item.word}</span> - {item.reason}
                              </div>
                            ))}
                          </div>
                        )}
                        {line.feedback.correctWords.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-green-700 mb-1">Correct pronunciation:</div>
                            <div className="text-xs text-green-600">✓ {line.feedback.correctWords.join(", ")}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Record / Stop flow */}
                    {!isActiveLine ? (
                      <Button
                        onClick={() => startRecording(lineKey)}
                        disabled={line.mastered || isAnalyzing}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {line.mastered ? "✓ Line Mastered" : "Practice This Line"}
                      </Button>
                    ) : (
                      <Button
                        onClick={stopRecording}
                        disabled={isAnalyzing}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAnalyzing ? "Analyzing..." : "Stop Recording"}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Shloka Completion Message */}
            {currentShloka.mastered && (
              <div className="bg-green-100 border-l-4 border-green-500 p-4 rounded">
                <div className="font-bold text-green-800">🎉 Shloka Mastered!</div>
                <div className="text-sm text-green-700 mt-1">
                  Excellent! You've mastered all lines of this shloka. Badge awarded!
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Mastery Animation */}
      {showMasteryAnimation && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="animate-bounce text-center">
            <div className="text-8xl mb-4">🏆</div>
            <div className="text-4xl font-bold text-blue-600 drop-shadow-lg">You've Mastered Chapter 15!</div>
            <div className="text-xl text-gray-700 mt-2 drop-shadow-lg">All 20 Shlokas Complete!</div>
          </div>
        </div>
      )}
    </div>
  )
}