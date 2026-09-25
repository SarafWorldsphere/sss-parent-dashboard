// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — NoticeBoard (component)
// Was: a compact notice-board card on the old dashboard with translation.
// Notices are now handled by /parent/notices page (its own page.tsx) and
// referenced via the StatCard. Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { translateText } from '../lib/api';

export default function NoticeBoard({ notices, currentLang = 'en' }: { notices: any[], currentLang?: string }) {
  const [translatedNotices, setTranslatedNotices] = useState<any[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  useEffect(() => {
    const translateAll = async () => {
      if (!notices || notices.length === 0) return;
      
      if (currentLang === 'en') {
        setTranslatedNotices(notices.map(n => ({ ...n, translatedTitle: n.title, translatedContent: n.content })));
        return;
      }

      setIsTranslating(true);
      try {
        const translated = await Promise.all(
          notices.map(async (n) => {
            const titleRes = await translateText(n.title, currentLang);
            const contentRes = await translateText(n.content, currentLang);
            return { ...n, translatedTitle: titleRes.translated_text, translatedContent: contentRes.translated_text };
          })
        );
        setTranslatedNotices(translated);
      } catch (error) {
        console.error("Translation failed", error);
        setTranslatedNotices(notices.map(n => ({ ...n, translatedTitle: n.title, translatedContent: n.content })));
      } finally {
        setIsTranslating(false);
      }
    };

    translateAll();
  }, [notices, currentLang]);

  const handleSpeak = (text: string, index: number) => {
    if (!('speechSynthesis' in window)) return;
    
    if (speakingIdx === index) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }

    window.speechSynthesis.cancel();
    setSpeakingIdx(index);
    
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      const langMap: Record<string, string> = { 'te': 'te-IN', 'hi': 'hi-IN', 'ta': 'ta-IN', 'kn': 'kn-IN', 'en': 'en-IN' };
      utterance.lang = langMap[currentLang] || 'en-US';
      
      utterance.onend = () => setSpeakingIdx(null);
      utterance.onerror = (e) => {
        console.error("Speech error", e);
        setSpeakingIdx(null);
      };
      
      // Prevent GC bug in some browsers
      (window as any).__utterance = utterance;
      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[320px]">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 text-xl">📢</span>
          <h2 className="text-lg font-bold text-gray-800">Notice Board</h2>
        </div>
        {isTranslating ? (
           <span className="text-xs text-orange-500 animate-pulse font-medium">Translating...</span>
        ) : (
           <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">View All</button>
        )}
      </div>

      {!notices || notices.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 italic">No notices available</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {translatedNotices.map((notice, idx) => {
            let formattedDate = notice.date;
            try {
               if (notice.date) {
                   formattedDate = new Date(notice.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
               }
            } catch(e) {}

            return (
              <div key={idx} className="p-4 bg-orange-50/50 rounded-xl border border-orange-100 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="flex justify-between items-start mb-1 gap-4">
                  <h3 className="font-bold text-gray-800 text-sm">{notice.translatedTitle}</h3>
                  <span className="text-[10px] font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full whitespace-nowrap">{formattedDate}</span>
                </div>
                <div className="flex items-start gap-2">
                  <p className="text-sm text-gray-600 mb-2 leading-relaxed flex-1">{notice.translatedContent}</p>
                  <button 
                    onClick={() => handleSpeak(`${notice.translatedTitle}. ${notice.translatedContent}`, idx)}
                    className={`shrink-0 p-2 rounded-full transition-colors ${speakingIdx === idx ? 'bg-orange-200 text-orange-700 animate-pulse' : 'hover:bg-orange-100 text-orange-500'}`}
                    title="Listen"
                  >
                    🔊
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-orange-200/50">
                  <div className="w-5 h-5 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-[10px]">
                    {notice.posted_by_name?.charAt(0) || 'A'}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">{notice.posted_by_name}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
