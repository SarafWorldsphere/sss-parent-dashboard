import axios from 'axios';
import { translateText as aiTranslateText } from "@/lib/aiService";

export const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8000',
});

export const fetchDashboardData = async (studentId: number) => {
  const response = await api.get(`/dashboard/${studentId}`);
  return response.data;
};

export const fetchParentChildren = async (parentId: number) => {
  const response = await api.get(`/parents/${parentId}/children`);
  return response.data;
};

/* =========================================================
   ASSIGNMENTS
   ========================================================= */

export const fetchAssignmentsHistory = async (studentId: number) => {
  try {
    const response = await api.get(`/assignments/history/${studentId}`);

    console.log("Assignments history response:", response.data);

    return response.data;
  } catch (error) {
    console.error("Error fetching assignments history:", error);
    return [];
  }
};

export const fetchAssignmentAnalytics = async (studentId: number) => {
  try {
    const response = await api.get(`/assignments/analytics/${studentId}`);

    return response.data;
  } catch (error) {
    console.error("Error fetching assignment analytics:", error);

    return {
      total: 0,
      submitted: 0,
      pending: 0,
      overdue: 0,
      graded: 0,
      completion_pct: 0,
    };
  }
};

/**
 * Submit assignment.
 *
 * Backend expects JSON:
 *
 * {
 *   assignment_id: number,
 *   student_id: number,
 *   submission_text: string,
 *   file_path?: string | null
 * }
 *
 * No values are hardcoded here.
 * All values come from the caller.
 */
export const submitAssignment = async (
  formData: FormData
) => {
  console.log(
    "======================================"
  );

  console.log(
    "SUBMIT ASSIGNMENT"
  );

  console.log(
    "API URL:",
    api.defaults.baseURL
  );

  console.log(
    "======================================"
  );

  for (
    const [key, value]
    of formData.entries()
  ) {
    if (value instanceof File) {
      console.log(
        `${key}: FILE`,
        {
          name: value.name,
          type: value.type,
          size: value.size,
        }
      );
    } else {
      console.log(
        `${key}:`,
        value
      );
    }
  }

  try {
    const response = await api.post(
      "/assignments/submit",
      formData
    );

    console.log(
      "SUBMISSION API RESPONSE:",
      response.data
    );

    return response.data;

  } catch (error: any) {

    console.error(
      "======================================"
    );

    console.error(
      "SUBMIT ASSIGNMENT FAILED"
    );

    console.error(
      "Status:",
      error?.response?.status
    );

    console.error(
      "Response:",
      error?.response?.data
    );

    console.error(
      "Detail:",
      error?.response?.data?.detail
    );

    console.error(
      "Message:",
      error?.message
    );

    throw error;
  }
};

export const getAssignmentFileName = (assignment: {
  file_name?: string | null;
  filename?: string | null;
  attachment?: string | null;
  file_path?: string | null;
  file_url?: string | null;
}) => {
  if (assignment.file_name) {
    return assignment.file_name;
  }

  if (assignment.filename) {
    return assignment.filename;
  }

  if (assignment.attachment) {
    return assignment.attachment.split("/").pop() || null;
  }

  if (assignment.file_path) {
    return assignment.file_path.split("/").pop() || null;
  }

  if (assignment.file_url) {
    try {
      return decodeURIComponent(
        assignment.file_url.split("/").pop() || ""
      );
    } catch {
      return assignment.file_url.split("/").pop() || null;
    }
  }

  return null;
};

/**
 * Get the best available URL for an uploaded assignment file.
 */
export const getAssignmentFileUrl = (assignment: {
  file_url?: string | null;
  file_path?: string | null;
  attachment?: string | null;
  drive_link?: string | null;
}) => {
  if (assignment.file_url) {
    return assignment.file_url;
  }

  if (assignment.file_path) {
    return assignment.file_path;
  }

  if (assignment.attachment) {
    return assignment.attachment;
  }

  if (assignment.drive_link) {
    return assignment.drive_link;
  }

  return null;
};

/* =========================================================
   QUIZ
   ========================================================= */

export const fetchQuizHistory = async (studentId: number) => {
  try {
    const response = await api.get(`/quiz/history/${studentId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching quiz history:", error);
    return [];
  }
};

/* =========================================================
   REMARKS
   ========================================================= */

export const fetchRemarksHistory = async (studentId: number) => {
  try {
    const response = await api.get(`/remarks/history/${studentId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching remarks history:", error);
    return [];
  }
};

/* =========================================================
   NOTICES
   ========================================================= */

export const fetchNoticesHistory = async (studentId: number) => {
  try {
    const response = await api.get(`/notices/history/${studentId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching notices history:", error);
    return [];
  }
};

/* =========================================================
   TRANSLATION
   ========================================================= */

export const translateText = async (
  text: string,
  targetLang: string
) => {
  if (!text) {
    return {
      translated_text: text,
      original_text: text,
    };
  }

  if (targetLang === "en") {
    return {
      translated_text: text,
      original_text: text,
    };
  }

  try {
    const response = await aiTranslateText(
      text,
      targetLang
    );

    return {
      translated_text:
        response.translated_text ??
        response.translation ??
        response.text ??
        text,

      original_text: text,
    };
  } catch (error) {
    console.error("Translation Error:", error);

    return {
      translated_text: text,
      original_text: text,
    };
  }
};

/* =========================================================
   ASSESSMENTS
   ========================================================= */

export const fetchAssessmentHistory = async (
  studentId: number
) => {
  try {
    const response = await api.get(
      `/assessments/history/${studentId}`
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error fetching assessment history:",
      error
    );

    return [];
  }
};

export const fetchAssessmentAnalytics = async (
  studentId: number
) => {
  try {
    const response = await api.get(
      `/assessments/analytics/${studentId}`
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error fetching assessment analytics:",
      error
    );

    return {
      total_assessments: 0,
      average_percentage: 0,
      highest_score: 0,
      lowest_score: 0,
      trend_data: [],
      subject_data: [],
      subjects: [],
    };
  }
};

/* =========================================================
   NOTIFICATIONS
   ========================================================= */

export const fetchNotifications = async (
  studentId: number
) => {
  const response = await api.get(
    `/notifications/${studentId}`
  );

  return response.data;
};

export const fetchUnreadCommCount = async (
  studentId: number
): Promise<number> => {
  try {
    const response = await api.get(
      `/notifications/unread-count/${studentId}`
    );

    return response.data?.unread_comm_count ?? 0;
  } catch (error) {
    console.error(
      "Error fetching unread communication count:",
      error
    );

    return 0;
  }
};

/* =========================================================
   COMMUNICATION CENTER
   ========================================================= */

export const closeConversation = async (
  convId: number
) => {
  try {
    await api.patch(
      `/comm/conversations/${convId}/status`,
      null,
      {
        params: {
          status: "CLOSED",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error closing conversation:",
      error
    );
  }
};

export const fetchConversationRecipients = async (
  studentId: number
) => {
  try {
    const response = await api.get(
      `/comm/teachers/${studentId}`
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error fetching conversation recipients:",
      error
    );

    return [];
  }
};

export const fetchConversations = async (
  studentId: number,
  parentId: number
) => {
  try {
    const response = await api.get(
      `/comm/conversations/${studentId}`,
      {
        params: {
          parent_id: parentId,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error fetching conversations:",
      error
    );

    return [];
  }
};

export const createConversation = async (payload: {
  student_id: number;
  parent_id: number;
  subject: string;
  category: string;
  recipient_name: string;
  first_message: string;
}) => {
  const response = await api.post(
    "/comm/conversations",
    payload
  );

  return response.data;
};

export const fetchConversationMessages = async (
  convId: number
) => {
  try {
    const response = await api.get(
      `/comm/conversations/${convId}/messages`
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error fetching conversation messages:",
      error
    );

    return [];
  }
};

export const sendConversationMessage = async (
  convId: number,
  senderType: string,
  senderName: string,
  message: string
) => {
  const response = await api.post(
    `/comm/conversations/${convId}/messages`,
    {
      sender_type: senderType,
      sender_name: senderName,
      message,
    }
  );

  return response.data;
};

/* =========================================================
   DISABLED OLD APIs
   ========================================================= */

// DISABLED: fetchCallRequestsHistory
//
// export const fetchCallRequestsHistory = async (studentId: number) => {
//   const response = await api.get(`/call-requests/history/${studentId}`);
//   return response.data;
// };

// DISABLED: requestCall
//
// export const requestCall = async (
//   parentId: number,
//   studentId: number,
//   message: string
// ) => {
//   const response = await api.post('/request-call', {
//     parent_id: parentId,
//     student_id: studentId,
//     message,
//   });
//
//   return response.data;
// };

// DISABLED: Old chat-thread system
//
// export const fetchChatThreads = async (
//   parentId: number,
//   studentId: number
// ) => {
//   const response = await api.get(
//     `/chat/threads/${parentId}/${studentId}`
//   );
//
//   return response.data;
// };

// DISABLED: Attendance API
//
// export const fetchAttendanceData = async (studentId: number) => {
//   try {
//     const response = await api.get(`/attendance/${studentId}`);
//     return response.data;
//   } catch {
//     return null;
//   }
// };
//
// export const fetchLeaveRequests = async (studentId: number) => {
//   try {
//     const response = await api.get(
//       `/attendance/leave-requests/${studentId}`
//     );
//
//     return response.data;
//   } catch {
//     return [];
//   }
// };
//
// export const submitLeaveRequest = async (payload: {
//   student_id: number;
//   parent_id: number;
//   from_date: string;
//   to_date: string;
//   reason: string;
//   parent_note?: string;
// }) => {
//   const response = await api.post(
//     '/attendance/leave-request',
//     payload
//   );
//
//   return response.data;
// };
//
// export const updateLeaveStatus = async (
//   leaveRequestId: number,
//   status: string,
//   reviewedBy: number
// ) => {
//   const response = await api.patch(
//     `/attendance/leave-request/${leaveRequestId}`,
//     {
//       status,
//       reviewed_by: reviewedBy,
//     }
//   );
//
//   return response.data;
// };
export const fetchParentByEmail = async (email: string) => {
  const response = await api.get('/parents/by-email', {
    params: { email },
  });

  return response.data;
};
