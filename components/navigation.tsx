"use client"

interface NavigationProps {
  activeModule: "pronunciation" | "recitation" | "chatbot"
  setActiveModule: (module: "pronunciation" | "recitation" | "chatbot") => void
}

export default function Navigation({ activeModule, setActiveModule }: NavigationProps) {
  const modules = [
    { id: "pronunciation", label: "Pronunciation Correction", icon: "🎤" },
    { id: "recitation", label: "Guided Recitation Practice", icon: "📈" },
    { id: "chatbot", label: "Gita Chatbot", icon: "💬" },
  ] as const

  return (
    <nav className="w-full bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex justify-center gap-0">
          {modules.map((module, idx) => (
            <button
              key={module.id}
              onClick={() => setActiveModule(module.id)}
              className={`flex-1 max-w-xs px-6 py-3 font-semibold transition-all border-b-4 text-center ${
                activeModule === module.id
                  ? "border-blue-600 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <span className="mr-2">{module.icon}</span>
              {module.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
