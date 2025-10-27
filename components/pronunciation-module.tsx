"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface Akshara {
  text: string
  status: "correct" | "incorrect" | "pending"
}

const shlokaData: Record<number, { sanskrit: string; transliteration: string; meaning: string }> = {
  1: {
    sanskrit: "श्री भगवान उवाच ऊर्ध्वमूलमध: शाखम् अश्वत्थं प्राहुर् अव्ययम्",
    transliteration: "śrī bhagavān uvāca ūrdhva-mūlam adhaḥ-śākham aśvatthaṁ prāhur avyayam",
    meaning:
      "The Supreme Lord said: There is a banyan tree that has its roots upward and its branches down, and its leaves are the Vedic hymns. Everyone describes this tree.",
  },
  2: {
    sanskrit: "अधश्च मूलान्य् अनुसन्ततानि कर्मानुबन्धीनि मनुष्यलोके",
    transliteration: "adhaś ca mūlāny anusantatāni karmānubandhīni manuṣya-loke",
    meaning: "The roots of this tree extend downward and are bound by the fruits of karma in the human world.",
  },
  3: {
    sanskrit: "न रूपम् अस्येह तथोपलभ्यते नान्तो न चादिर् न च संप्रतिष्ठा",
    transliteration: "na rūpam asyeha tathopalabhyate nānto na cādir na ca saṁpratiṣṭhā",
    meaning:
      "The form of this tree cannot be perceived in this world. No one can understand its beginning, middle, or end.",
  },
  4: {
    sanskrit: "अश्वत्थ एनं सुविरूढमूलं असङ्गशस्त्रेण दृढेन छित्त्वा",
    transliteration: "aśvattham enaṁ suvirūḍha-mūlaṁ asaṅga-śastreṇa dṛḍhena chittva",
    meaning: "One must cut down this firmly rooted tree with the weapon of detachment.",
  },
  5: {
    sanskrit: "ततः पदं तत् परिमार्गितव्यं यस्मिन् गता न निवर्तन्ति भूयः",
    transliteration: "tataḥ padaṁ tat parimārgitavyaṁ yasmin gatā na nivartanti bhūyaḥ",
    meaning: "Thereafter, one must seek that supreme abode from which, having gone, one never returns.",
  },
  6: {
    sanskrit: "अनन्यश्रितः सततं यो मां भजति सर्वगः",
    transliteration: "ananya-śritaḥ satatam yo māṁ bhajati sarva-gaḥ",
    meaning:
      "Those who are free from pride and delusion, who have conquered the evil of attachment, who are devoted to Me, and who are free from desire and anger, are eligible to become one with Me.",
  },
  7: {
    sanskrit: "मामेव ये प्रपद्यन्ते मायामेतां तरन्ति ते",
    transliteration: "māmeva ye prapadyante māyāmetāṁ taranti te",
    meaning: "Those who surrender unto Me cross over this material energy.",
  },
  8: {
    sanskrit: "अहं सर्वस्य प्रभवो मत्तः सर्वं प्रवर्तते",
    transliteration: "ahaṁ sarvasya prabhavo mattaḥ sarvaṁ pravartate",
    meaning: "I am the source of all spiritual and material worlds. Everything emanates from Me.",
  },
  9: {
    sanskrit: "मत्तः परतरं नान्यत् किञ्चिद् अस्ति धनञ्जय",
    transliteration: "mattaḥ parataraṁ nānyat kiñcid asti dhanañjaya",
    meaning: "O Dhananjaya, there is no truth superior to Me. Everything rests upon Me.",
  },
  10: {
    sanskrit: "सर्वं एतद् अथो विद्धि न त्वेवाहं न ते त्वम्",
    transliteration: "sarvaṁ etad atho viddhi na tvevāhaṁ na te tvam",
    meaning: "Know that all beings are born from this nature, and I am the source of all creation.",
  },
  11: {
    sanskrit: "यदा यदा हि धर्मस्य ग्लानिर् भवति भारत",
    transliteration: "yadā yadā hi dharmasya glānir bhavati bhārata",
    meaning:
      "Whenever and wherever there is a decline in religious practice and a predominant rise of irreligion, at that time I descend.",
  },
  12: {
    sanskrit: "परित्राणाय साधूनां विनाशाय च दुष्कृताम्",
    transliteration: "paritrāṇāya sādhūnāṁ vināśāya ca duṣkṛtām",
    meaning:
      "To deliver the pious and to annihilate the miscreants, as well as to reestablish the principles of religion, I advent Myself millennium after millennium.",
  },
  13: {
    sanskrit: "जन्म कर्म च मे दिव्यं एवं यो वेत्ति तत्त्वतः",
    transliteration: "janma karma ca me divyaṁ evaṁ yo vetti tattvataḥ",
    meaning:
      "One who knows the transcendental nature of My appearance and activities does not, upon leaving the body, take his birth again in this material world.",
  },
  14: {
    sanskrit: "त्यक्त्वा देहं पुनर् जन्म नैति माम् एति सोऽर्जुन",
    transliteration: "tyaktvā dehaṁ punar janma naiti mām eti so'rjuna",
    meaning:
      "After being freed from attachment, fear and anger, being fully absorbed in Me and taking refuge in Me, many, many persons in the past became purified by knowledge of Me.",
  },
  15: {
    sanskrit: "ये यथा मां प्रपद्यन्ते तांस् तथैव भजाम्य् अहम्",
    transliteration: "ye yathā māṁ prapadyante tāṁs tathaiva bhajāmy aham",
    meaning:
      "As all surrender unto Me, I reward them accordingly. Everyone follows My path in all respects, O son of Prithā.",
  },
  16: {
    sanskrit: "कामना एतैः क्षिप्यन्ते ये केचित् कर्मबन्धनैः",
    transliteration: "kāmanā etaiḥ kṣipyante ye kecit karma-bandhanaiḥ",
    meaning:
      "Those who are bewildered are attracted to demonic and atheistic views. In that deluded condition, their hopes for liberation, their fruitive activities, and their culture of knowledge all become frustrated.",
  },
  17: {
    sanskrit: "तेषां सत्यसङ्गल्पानां तप्यन्ते हृदयं मम",
    transliteration: "teṣāṁ satya-saṅgalpānāṁ tapyante hṛdayaṁ mama",
    meaning:
      "For those whose minds are attached to My personal form, always engaged in worshiping Me with all their hearts, I am most readily available.",
  },
  18: {
    sanskrit: "सर्वधर्मान् परित्यज्य मामेकं शरणं व्रज",
    transliteration: "sarva-dharmān parityajya mām ekam śaraṇaṁ vraja",
    meaning:
      "Abandon all varieties of religion and just surrender unto Me. I shall deliver you from all sinful reactions. Do not fear.",
  },
  19: {
    sanskrit: "इदं ते नातपस्काय नाभक्ताय कदाचन",
    transliteration: "idaṁ te nātapaskāya nābhaktāya kadācana",
    meaning:
      "This knowledge is not meant for those who are not austere, nor for those who are not devoted, nor for those who are not obedient, nor for those who are envious of Me.",
  },
  20: {
    sanskrit: "य इदं परमं गुह्यं मद्भक्तेषु प्रकाशयेत्",
    transliteration: "ya idaṁ paramaṁ guhyaṁ mad-bhakteṣu prakāśayet",
    meaning:
      "For one who explains this supreme secret to the devotees, pure devotional service is guaranteed, and at the end he will come back to Me.",
  },
}

export default function PronunciationModule() {
  const [selectedShloka, setSelectedShloka] = useState(1)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [feedback, setFeedback] = useState<Akshara[] | null>(null)
  const [micPermissionRequested, setMicPermissionRequested] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const currentVerse = shlokaData[selectedShloka]

  const startRecording = async () => {
    try {
      setMicPermissionRequested(true)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setFeedback(null)
      setRecordingTime(0)

      const interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      mediaRecorder.onstop = () => {
        clearInterval(interval)
      }
    } catch (error) {
      console.error("Error accessing microphone:", error)
      alert("Unable to access microphone. Please check permissions and try again.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const playReference = () => {
    const utterance = new SpeechSynthesisUtterance(currentVerse.transliteration)
    utterance.rate = 0.8
    window.speechSynthesis.speak(utterance)
  }

  const playRecording = () => {
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audio.play()
    }
  }

  const analyzePronunciation = async () => {
    if (audioChunksRef.current.length === 0) {
      alert("Please record audio first before analyzing.")
      return
    }

    setIsAnalyzing(true)

    try {
      // Replace this URL with your actual backend endpoint
      // Expected endpoint: POST /api/analyze-pronunciation
      // Request body: { audio: Blob, transliteration: string, sanskrit: string }
      // Expected response: { aksharas: Array<{text, status}> }

      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
      const formData = new FormData()
      formData.append("audio", audioBlob)
      formData.append("transliteration", currentVerse.transliteration)
      formData.append("sanskrit", currentVerse.sanskrit)

      // BACKEND INTEGRATION POINT 2: Pronunciation Correction Analysis
      // Uncomment and update the endpoint URL below:
      /*
      const response = await fetch("/api/analyze-pronunciation", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Analysis failed")
      const result = await response.json()
      setFeedback(result.aksharas)
      */

      // For now, using mock data - replace with actual backend call above
      const mockFeedback: Akshara[] = [
        { text: "श्री", status: "correct" },
        { text: "भ", status: "correct" },
        { text: "ग", status: "incorrect" },
        { text: "वान्", status: "correct" },
        { text: "उ", status: "correct" },
        { text: "वाच", status: "incorrect" },
      ]
      setFeedback(mockFeedback)
    } catch (error) {
      console.error("[v0] Error analyzing pronunciation:", error)
      alert("Error analyzing pronunciation. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div className="w-full max-w-xs">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Select Shloka (1-20)</label>
          <select
            value={selectedShloka}
            onChange={(e) => {
              setSelectedShloka(Number(e.target.value))
              setFeedback(null)
              audioChunksRef.current = []
              setIsRecording(false)
            }}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>
                Shloka {num}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-blue-100 to-cyan-100 border-0 p-8">
        <div className="text-center space-y-6">
          {/* Line 1: Sanskrit */}
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Sanskrit Text</p>
            <div className="text-3xl font-bold text-gray-900 leading-relaxed">[translate: {currentVerse.sanskrit}]</div>
          </div>

          {/* Line 2: Transliteration */}
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Transliteration</p>
            <div className="text-lg italic text-gray-700">{currentVerse.transliteration}</div>
          </div>

          {/* Line 3: Meaning */}
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Full Meaning in English</p>
            <div className="text-sm text-gray-600 bg-white bg-opacity-60 p-4 rounded-lg">{currentVerse.meaning}</div>
          </div>

          <div className="text-xs text-gray-500 pt-2">Shloka {selectedShloka} of Chapter 15</div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Button
            onClick={playReference}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
          >
            🔊 Play Reference
          </Button>
          <Button
            onClick={startRecording}
            disabled={isRecording}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            🎤 Start Recording
          </Button>
          <Button
            onClick={stopRecording}
            disabled={!isRecording}
            className="bg-red-400 hover:bg-red-500 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            ⏹️ Stop Recording
          </Button>
          <Button
            onClick={playRecording}
            disabled={audioChunksRef.current.length === 0}
            className="bg-blue-400 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            ▶️ Play My Recording
          </Button>
          <Button
            onClick={analyzePronunciation}
            disabled={audioChunksRef.current.length === 0 || isAnalyzing}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </Button>
        </div>

        {isRecording && <div className="text-center text-blue-600 font-semibold">Recording... {recordingTime}s</div>}
        {micPermissionRequested && !isRecording && audioChunksRef.current.length === 0 && (
          <div className="text-center text-sm text-gray-600">Microphone access granted. Ready to record.</div>
        )}
      </div>

      {/* Feedback Display */}
      {feedback && (
        <Card className="bg-white border-2 border-blue-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Pronunciation Feedback</h3>
          <div className="space-y-3">
            {feedback.map((akshara, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg font-semibold text-lg ${
                  akshara.status === "correct"
                    ? "bg-green-100 text-green-800 border-l-4 border-green-500"
                    : "bg-red-100 text-red-800 border-l-4 border-red-500"
                }`}
              >
                <span className="mr-2">{akshara.status === "correct" ? "✓" : "✗"}</span>
                {akshara.text}
                <span className="ml-2 text-sm">{akshara.status === "correct" ? "Perfect!" : "Needs improvement"}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
            <strong>Tip:</strong> Focus on the aksharas marked with ✗. Listen to the reference audio again and try to
            match the pronunciation.
          </div>
        </Card>
      )}
    </div>
  )
}
