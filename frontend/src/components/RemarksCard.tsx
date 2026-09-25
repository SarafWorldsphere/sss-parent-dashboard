// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — RemarksCard
// Was: a compact teacher-remarks card on the old dashboard with translation.
// Dashboard redesign removed mini-cards; remarks are accessed via
// /parent/remarks page. Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { translateText } from '../lib/api';

export default function RemarksCard({ remarks, currentLang }: { remarks: any[], currentLang: string }) {
  const [translatedRemarks, setTranslatedRemarks] = useState<any[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  useEffect(() => {
    const translateAll = async () => {
      if (!remarks || remarks.length === 0) return;
      
      if (currentLang === 'en') {
        setTranslatedRemarks(remarks.map(r => ({ ...r, translatedText: r.comment })));
        return;
      }

      setIsTranslating(true);
      try {
        const translated = await Promise.all(
          remarks.map(async (r) => {
            const res = await translateText(r.comment, currentLang);
            return { ...r, translatedText: res.translated_text };
          })
        );
        setTranslatedRemarks(translated);
      } catch (error) {
        console.error("Translation failed", error);
        setTranslatedRemarks(remarks.map(r => ({ ...r, translatedText: r.comment })));
      } finally {
        setIsTranslating(false);
      }
    };

    translateAll();
  }, [remarks, currentLang]);

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
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
        <h2 className="text-lg font-bold text-gray-800">Teacher Remarks</h2>
        {isTranslating ? (
           <span className="text-xs text-orange-500 animate-pulse font-medium">Translating...</span>
        ) : (
           <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">View All</button>
        )}
      </div>

      {!remarks || remarks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 italic">No remarks available</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {translatedRemarks.map((remark, index) => {
            let formattedDate = remark.date;
            try {
               if (remark.date) {
                   formattedDate = new Date(remark.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
               }
            } catch(e) {}
            
            return (
              <div key={index} className="p-4 bg-[#F9FAFB] rounded-xl border border-gray-100 hover:border-orange-200 transition-colors group relative">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                      {remark.teacher_name?.charAt(0) || 'T'}
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm">{remark.teacher_name}</h3>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">{formattedDate}</span>
                </div>
                <div className="flex items-start gap-2 mt-2">
                  <p className="text-sm text-gray-600 leading-relaxed italic border-l-2 border-orange-300 pl-3 flex-1">
                    &quot;{remark.translatedText}&quot;
                  </p>
                  <button 
                    onClick={() => handleSpeak(remark.translatedText, index)}
                    className={`shrink-0 p-2 rounded-full transition-colors ${speakingIdx === index ? 'bg-orange-100 text-orange-600 animate-pulse' : 'hover:bg-gray-200 text-gray-500'}`}
                    title="Listen"
                  >
                    🔊
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
