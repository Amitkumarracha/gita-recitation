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
  }
}

interface ShlokaProgress {
  shlokaNumber: number
  lines: LineProgress[]
  totalScore: number
  mastered: boolean
  completedLines: number
}

export default function RecitationModule() {
  const [shlokas, setShlokas] = useState<ShlokaProgress[]>(() => {
    return transcriptData
      .filter((item) => item.shloka > 0)
      .map((item) => ({
        shlokaNumber: item.shloka,
        lines: item.lines.map((line) => ({
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
  const [totalXP, setTotalXP] = useState(20)
  const [badges, setBadges] = useState(0)
  const [chapterProgress, setChapterProgress] = useState(0)
  const [showMasteryAnimation, setShowMasteryAnimation] = useState(false)
  const [micPermissionPrompted, setMicPermissionPrompted] = useState<Set<string>>(new Set())
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const currentShloka = shlokas.find((s) => s.shlokaNumber === selectedShloka)
  const masteredShlokas = shlokas.filter((s) => s.mastered).length
  const progressPercentage = (masteredShlokas / shlokas.length) * 100

  const requestMicrophoneAccess = async (lineKey: string) => {
    if (micPermissionPrompted.has(lineKey)) return true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setMicPermissionPrompted((prev) => new Set([...prev, lineKey]))
      return true
    } catch (error) {
      console.error("[v0] Microphone access denied:", error)
      alert("Microphone access is required to practice pronunciation.")
      return false
    }
  }

  const analyzePronunciation = async (lineKey: string) => {
    const hasPermission = await requestMicrophoneAccess(lineKey)
    if (!hasPermission) return

    if (audioChunksRef.current.length === 0) {
      alert("Please record audio first before analyzing.")
      return
    }

    setIsAnalyzing(true)

    try {
      // Replace this URL with your actual backend endpoint
      // Expected endpoint: POST /api/analyze-pronunciation
      // Request body: { audio: Blob, transliteration: string, sanskrit: string }
      // Expected response: { score: number, incorrectWords: Array<{word, reason}>, correctWords: string[] }

      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
      const formData = new FormData()
      formData.append("audio", audioBlob)

      const [shlokaNum, lineIdx] = lineKey.split("-").map(Number)
      const line = currentShloka?.lines.find((l) => l.lineIndex === lineIdx)

      if (line) {
        formData.append("transliteration", line.translit)
        formData.append("sanskrit", line.raw)

        // BACKEND INTEGRATION POINT 1: Pronunciation Analysis
        // Uncomment and update the endpoint URL below:
        /*
        const response = await fetch("/api/analyze-pronunciation", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) throw new Error("Analysis failed")
        const result = await response.json()
        const accuracy = result.score
        const feedback = result
        */

        // For now, using mock data - replace with actual backend call above
        const accuracy = Math.floor(Math.random() * 40) + 60
        const feedback = {
          score: accuracy,
          incorrectWords: [
            { word: "भ", reason: "Pronunciation too soft, needs more emphasis" },
            { word: "वान्", reason: "Nasal sound not clear enough" },
          ],
          correctWords: ["श्री", "उ", "वाच"],
        }

        const isMastered = accuracy >= 70

        setShlokas((prevShlokas) =>
          prevShlokas.map((shloka) => {
            if (shloka.shlokaNumber === shlokaNum) {
              const updatedLines = shloka.lines.map((l) => {
                if (l.lineIndex === lineIdx) {
                  const wasNotMastered = !l.mastered
                  const newMastered = isMastered

                  if (wasNotMastered && newMastered) {
                    setTotalXP((prev) => prev + 5)
                  }

                  return {
                    ...l,
                    score: accuracy,
                    attempts: l.attempts + 1,
                    mastered: newMastered,
                    feedback,
                  }
                }
                return l
              })

              const completedLines = updatedLines.filter((l) => l.mastered).length
              const allLinesMastered = completedLines === updatedLines.length
              const newTotalScore = Math.round(updatedLines.reduce((sum, l) => sum + l.score, 0) / updatedLines.length)

              if (allLinesMastered && !shloka.mastered) {
                setBadges((prev) => {
                  const newBadgeCount = prev + 1
                  setChapterProgress((prevProgress) => Math.min(prevProgress + 5, 100))

                  if (newBadgeCount === 20) {
                    setShowMasteryAnimation(true)
                    setTimeout(() => setShowMasteryAnimation(false), 5000)
                  }
                  return newBadgeCount
                })
              }

              return {
                ...shloka,
                lines: updatedLines,
                totalScore: newTotalScore,
                mastered: allLinesMastered,
                completedLines,
              }
            }
            return shloka
          }),
        )
      }
    } catch (error) {
      console.error("[v0] Error analyzing pronunciation:", error)
      alert("Error analyzing pronunciation. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-100 to-purple-50 border-0 p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">{totalXP}</div>
            <div className="text-gray-700 font-semibold">Total XP Earned</div>
            <div className="text-xs text-gray-600 mt-1">Base: 20 XP + 5 per line</div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-green-100 to-green-50 border-0 p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">{masteredShlokas}</div>
            <div className="text-gray-700 font-semibold">Shlokas Mastered</div>
            <div className="text-xs text-gray-600 mt-1">
              {masteredShlokas} of {shlokas.length} mastered
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
            {masteredShlokas} of {shlokas.length} shlokas mastered
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
                        <div className="text-sm font-semibold text-gray-900 mb-2">Pronunciation Feedback:</div>
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

                    <Button
                      onClick={() => analyzePronunciation(lineKey)}
                      disabled={line.mastered || isAnalyzing}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {line.mastered ? "✓ Line Mastered" : isAnalyzing ? "Analyzing..." : "Practice This Line"}
                    </Button>
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
