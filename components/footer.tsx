export default function Footer() {
  return (
    <footer className="w-full bg-gray-900 text-white mt-12 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h4 className="font-bold text-lg mb-3">About This Project</h4>
            <p className="text-gray-400 text-sm">
              A spiritual learning platform dedicated to helping practitioners perfect their Sanskrit pronunciation and
              deepen their understanding of the Bhagavad Gita Chapter 15.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-3">ISKCON Resources</h4>
            <ul className="text-gray-400 text-sm space-y-2">
              <li>
                <a href="#" className="hover:text-white transition">
                  ISKCON Official Website
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  Bhagavad Gita Online
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  Spiritual Guidance
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-3">Contact & Support</h4>
            <p className="text-gray-400 text-sm">
              For questions or feedback, please reach out to our development team. This project is created with devotion
              to serve the spiritual community.
            </p>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-6 text-center text-gray-400 text-sm">
          <p>© 2025 Bhagavad Gita Chapter 15 Pronunciation Helper. Created with devotion for spiritual learners.</p>
          <p className="mt-2">Hari Om 🙏</p>
        </div>
      </div>
    </footer>
  )
}
