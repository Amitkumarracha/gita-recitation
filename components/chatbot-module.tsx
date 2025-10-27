"use client"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  language: "en" | "hi"
}

export default function ChatbotModule() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Namaste! I am here to help you understand the Bhagavad Gita Chapter 15. Ask me about the meaning of verses, spiritual philosophy, or ISKCON teachings. What would you like to know?",
      language: "en",
    },
  ])
  const [input, setInput] = useState("")
  const [language, setLanguage] = useState<"en" | "hi">("en")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const generateResponse = async (userMessage: string): Promise<string> => {
    try {
      // Replace this URL with your actual backend endpoint
      // Expected endpoint: POST /api/gita-chatbot
      // Request body: { message: string, language: "en" | "hi" }
      // Expected response: { response: string }

      // BACKEND INTEGRATION POINT 3: Gita Chatbot
      // Uncomment and update the endpoint URL below:
      /*
      const response = await fetch("/api/gita-chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, language }),
      })

      if (!response.ok) throw new Error("Chat request failed")
      const result = await response.json()
      return result.response
      */

      // For now, using mock responses - replace with actual backend call above
      const responses: Record<string, string> = {
        meaning:
          language === "en"
            ? "Chapter 15 describes the Ashwattha tree (banyan tree) as a metaphor for the material world. Its roots are upward (in the spiritual realm) and branches downward (in the material world). The Vedas are its leaves, and understanding this tree is key to liberation."
            : "अध्याय 15 अश्वत्थ वृक्ष (बरगद के पेड़) को भौतिक दुनिया के रूप में वर्णित करता है। इसकी जड़ें ऊपर की ओर (आध्यात्मिक क्षेत्र में) और शाखाएं नीचे की ओर (भौतिक दुनिया में) हैं।",
        philosophy:
          language === "en"
            ? "The philosophy teaches that attachment to the material world keeps us bound. By understanding the temporary nature of material existence and focusing on Krishna consciousness, we can transcend this cycle and achieve eternal bliss."
            : "यह दर्शन सिखाता है कि भौतिक दुनिया से जुड़ाव हमें बांधे रखता है। भौतिक अस्तित्व की अस्थायी प्रकृति को समझकर और कृष्ण चेतना पर ध्यान केंद्रित करके, हम इस चक्र को पार कर सकते हैं।",
        iskcon:
          language === "en"
            ? "ISKCON teaches that the path to liberation is through devotion to Krishna (Bhakti Yoga). By chanting the Hare Krishna mantra, studying the Gita, and serving the divine, we can achieve spiritual enlightenment and eternal happiness."
            : "ISKCON सिखाता है कि मुक्ति का मार्ग कृष्ण के प्रति भक्ति के माध्यम से है। हरे कृष्ण मंत्र का जाप करके, गीता का अध्ययन करके और दिव्य की सेवा करके, हम आध्यात्मिक ज्ञान प्राप्त कर सकते हैं।",
      }

      const lowerMessage = userMessage.toLowerCase()
      if (lowerMessage.includes("meaning")) return responses.meaning
      if (lowerMessage.includes("philosophy")) return responses.philosophy
      if (lowerMessage.includes("iskcon")) return responses.iskcon

      return language === "en"
        ? "That is a wonderful question. The Bhagavad Gita teaches us about dharma (duty), bhakti (devotion), and the path to spiritual enlightenment. Would you like to know more about any specific aspect?"
        : "यह एक अद्भुत प्रश्न है। भगवद्गीता हमें धर्म, भक्ति और आध्यात्मिक ज्ञान के मार्ग के बारे में सिखाती है।"
    } catch (error) {
      console.error("[v0] Error generating response:", error)
      return language === "en"
        ? "I apologize, but I encountered an error. Please try again."
        : "मुझे खेद है, लेकिन मुझे एक त्रुटि का सामना करना पड़ा। कृपया पुनः प्रयास करें।"
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      language,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await generateResponse(input)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        language,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 h-full">
      {/* Language Selector */}
      <div className="flex gap-2 justify-center">
        <Button
          onClick={() => setLanguage("en")}
          className={`px-4 py-2 rounded-lg font-semibold ${
            language === "en" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          English
        </Button>
        <Button
          onClick={() => setLanguage("hi")}
          className={`px-4 py-2 rounded-lg font-semibold ${
            language === "hi" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          हिंदी
        </Button>
      </div>

      {/* Chat Container */}
      <Card className="bg-white border-2 border-gray-200 p-6 h-96 overflow-y-auto flex flex-col">
        <div className="flex-1 space-y-4 mb-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-100 text-gray-900 rounded-bl-none"
                }`}
              >
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-lg rounded-bl-none">
                <p className="text-sm">Typing...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex gap-2 mt-4 border-t pt-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder={language === "en" ? "Ask about the Gita..." : "गीता के बारे में पूछें..."}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg disabled:opacity-50"
          >
            Send
          </Button>
        </div>
      </Card>

      {/* Quick Questions */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-3">Quick Questions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              text: language === "en" ? "What is the meaning of Chapter 15?" : "अध्याय 15 का अर्थ क्या है?",
              query: "meaning",
            },
            { text: language === "en" ? "Explain the philosophy" : "दर्शन समझाएं", query: "philosophy" },
            { text: language === "en" ? "ISKCON teachings" : "ISKCON की शिक्षाएं", query: "iskcon" },
            { text: language === "en" ? "How to practice?" : "अभ्यास कैसे करें?", query: "practice" },
          ].map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInput(q.query)
                setTimeout(() => handleSend(), 0)
              }}
              className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg text-left hover:bg-blue-100 transition-colors text-sm font-medium text-gray-900"
            >
              {q.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
