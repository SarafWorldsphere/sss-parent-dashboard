// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — QuizCard
// Was: a compact quiz summary card on the old dashboard. Dashboard redesign
// shows a single "Quiz Avg" StatCard linking to /parent/quiz.
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
export default function QuizCard({ quizzes }: { quizzes: any[] }) {
  let validQuizzes = (quizzes || []).filter(q => q.score !== '--' && q.total !== '--');
  let avgScore = 0;
  let avgTotal = 0;
  if (validQuizzes.length > 0) {
      let totalScore = validQuizzes.reduce((acc, q) => acc + Number(q.score), 0);
      let maxTotal = validQuizzes.reduce((acc, q) => acc + Number(q.total), 0);
      avgScore = Number((totalScore / validQuizzes.length).toFixed(2));
      avgTotal = Number((maxTotal / validQuizzes.length).toFixed(0));
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[320px]">
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
        <h2 className="text-lg font-bold text-gray-800">Quiz Performance</h2>
        <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">View All</button>
      </div>

      {!quizzes || quizzes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 italic">No quizzes available</p>
        </div>
      ) : (
        <div className="space-y-5 flex-1 mt-2">
          {quizzes.map((quiz, idx) => {
            const scoreNum = Number(quiz.score) || 0;
            const totalNum = Number(quiz.total) || 1; // avoid div by 0
            const percentage = quiz.score === '--' ? 0 : Math.min(100, Math.round((scoreNum / totalNum) * 100));
            
            return (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-800">{quiz.subject}</span>
                  <span className="text-gray-600 font-medium">{quiz.score} / {quiz.total}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-orange-600 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <div className="mt-auto pt-4 border-t border-orange-100 bg-orange-50/50 -mx-6 -mb-6 p-4 rounded-b-xl flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-700">Average Score</span>
        <span className="text-orange-600 font-bold text-lg">{validQuizzes.length > 0 ? `${avgScore} / ${avgTotal}` : '--'}</span>
      </div>
    </div>
  );
}
