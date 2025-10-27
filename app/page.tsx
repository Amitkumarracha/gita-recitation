"use client"

import { useState } from "react"
import Header from "@/components/header"
import Navigation from "@/components/navigation"
import PronunciationModule from "@/components/pronunciation-module"
import RecitationModule from "@/components/recitation-module"
import ChatbotModule from "@/components/chatbot-module"
import Footer from "@/components/footer"

export default function Home() {
  const [activeModule, setActiveModule] = useState<"pronunciation" | "recitation" | "chatbot">("pronunciation")

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      <Header />
      <Navigation activeModule={activeModule} setActiveModule={setActiveModule} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        {activeModule === "pronunciation" && <PronunciationModule />}
        {activeModule === "recitation" && <RecitationModule />}
        {activeModule === "chatbot" && <ChatbotModule />}
      </main>

      <Footer />
    </div>
  )
}
