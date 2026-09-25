// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — AssignmentCard
// Was: a compact assignment list card on the old dashboard sidebar.
// Dashboard redesign removed all mini-list cards; assignments are now
// accessed via the StatCard link to /parent/assignments.
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
export default function AssignmentCard({ assignments }: { assignments: any[] }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[320px]">
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
        <h2 className="text-lg font-bold text-gray-800">Assignments</h2>
        <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">View All</button>
      </div>
      
      {!assignments || assignments.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 italic">No assignments available</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {assignments.map((assignment, idx) => {
            const getStatusColor = (status: string) => {
              if (status === 'Completed') return 'border-green-200 text-green-600 bg-green-50';
              if (status === 'Pending') return 'border-orange-200 text-orange-500 bg-orange-50';
              return 'border-red-200 text-red-500 bg-red-50';
            };

            let formattedDate = assignment.due_date;
            try {
                if (assignment.due_date) {
                    formattedDate = new Date(assignment.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                }
            } catch(e) {}

            return (
              <div key={idx} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-gray-400">
                    <span className="text-lg">📄</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">{assignment.assignment_title}</h3>
                    <p className="text-xs text-gray-500 mt-1">Due: {formattedDate}</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getStatusColor(assignment.status)}`}>
                  {assignment.status === 'Completed' && <span className="text-[10px]">✓</span>}
                  {assignment.status === 'Pending' && <span className="text-[10px]">⏱</span>}
                  {assignment.status === 'Overdue' && <span className="text-[10px]">!</span>}
                  {assignment.status}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
        Total Assignments: {assignments?.length || 0}
      </div>
    </div>
  );
}
