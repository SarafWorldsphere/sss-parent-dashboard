import axios from "axios";

// 🚀 FIX 3: Environment Variable Support
// This prevents "Mixed Content" errors when deploying to Vercel/Netlify.
// It falls back to your EC2 IP for local testing if the env var isn't set yet.
const AI_BASE_URL = process.env.NEXT_PUBLIC_AI_BASE_URL || "/ai/parent";

const DEFAULT_EMAIL = "parent_user@sss.edu"; // Replace with dynamic logged-in user email when ready
const DEFAULT_CLIENT = "SSS";

export const aiApi = axios.create({
  baseURL: AI_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ----------------------------
// Translation
// ----------------------------

const LANGUAGE_MAP: Record<string, string> = {
  en: "English",
  te: "Telugu",
  hi: "Hindi",
  ta: "Tamil",
  kn: "Kannada",
  ml: "Malayalam",
  or: "Odia",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  pa: "Punjabi",
};

export const translateText = async (
  text: string,
  targetLanguage: string
) => {
  if (!text?.trim()) {
    return {
      translated_text: "",
    };
  }

  const normalizedLanguage =
    LANGUAGE_MAP[targetLanguage.toLowerCase()] ??
    targetLanguage;

  if (
    normalizedLanguage.toLowerCase() === "english" ||
    targetLanguage.toLowerCase() === "en"
  ) {
    return {
      translated_text: text,
    };
  }

  try {
    const response = await aiApi.post("/translate", {
      text: text.trim(),
      target_language: normalizedLanguage,
      user_email: DEFAULT_EMAIL,
      client_name: DEFAULT_CLIENT,
    });

    return response.data;
  } catch (error: any) {
    console.error(
      "Translation API failed:",
      error?.response?.data ?? error?.message
    );
    return {
      translated_text: text,
      error: true,
    };
  }
};

// ----------------------------
// Assessment Summary
// ----------------------------
export const fetchAssessmentSummary = async (payload: {
  student_name: string;
  subject: string;
  test_name: string;
  marks_obtained: number;
  total_marks: number;
  teacher_remarks?: string;
  language?: string;
}) => {
  const response = await aiApi.post("/assessment-summary", {
    ...payload,
    user_email: DEFAULT_EMAIL,
    client_name: DEFAULT_CLIENT,
  });

  return response.data;
};

// ----------------------------
// Text To Voice
// ----------------------------
export const textToVoice = async (
  text: string,
  language: string
) => {
  const response = await aiApi.post("/text-to-voice", {
    text,
    language,
    user_email: DEFAULT_EMAIL,
    client_name: DEFAULT_CLIENT,
  });

  const base64 = response.data.audio_base64;
  
  // 🚀 FIX 1: SUPER FAST NATIVE DECODING
  // This replaces the old `for` loop, preventing the UI thread from freezing!
  const fetchResponse = await fetch(`data:audio/mpeg;base64,${base64}`);
  const blob = await fetchResponse.blob();

  return blob;
};

// ----------------------------
// Compatibility function
// ----------------------------
export const speakWithAI = async ({
  text,
  targetLang,
}: {
  text: string;
  targetLang: string;
}) => {
  try {
    const audio = await textToVoice(text, targetLang);
    return {
      success: true,
      data: audio,
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      data: null,
    };
  }
};

// ----------------------------
// Voice To Text
// ----------------------------
export const voiceToText = async (
  file: File,
  language: string
) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("language", language);
    formData.append("user_email", DEFAULT_EMAIL);
    formData.append("client_name", DEFAULT_CLIENT);

    const response = await axios.post(
      `${AI_BASE_URL}/voice-to-text`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (err: any) {
    console.error("Voice To Text Error:", err.message);
    throw err;
  }
};

// ----------------------------
// Due Date Alert
// ----------------------------

export interface DueDateAlertRequest {
  student_name: string;
  assignment_title: string;
  subject: string;
  due_date: string;
  description: string;
}

export interface DueDateAlertResponse {
  status: string;
  alert_title: string;
  notification_message: string;
  suggested_parent_action: string;
}

export const fetchDueDateAlert = async (
  payload: DueDateAlertRequest
): Promise<DueDateAlertResponse> => {
  try {
    console.log("Request payload:", payload);

    const response = await aiApi.post("/due-date-alert", {
      ...payload,
      user_email: DEFAULT_EMAIL,
      client_name: DEFAULT_CLIENT,
    });

    console.log("Status:", response.status);
    console.log("Response data:", response.data);

    return response.data as DueDateAlertResponse;
  } catch (error: any) {
    console.error("Status:", error?.response?.status);
    console.error("Error response:", error?.response?.data);
    console.error("Error message:", error.message);

    return {
      status: "error",
      alert_title: "",
      notification_message: "",
      suggested_parent_action: "",
    };
  }
};

// ----------------------------
// AI Analytics
// ----------------------------
export const fetchAIAnalytics = async (payload: {
  scope: string;
  subject?: string;
  userInfo: {
    parentId: number;
  };
}) => {
  try {
    const response = await aiApi.post("/analytics", {
      ...payload,
      user_email: DEFAULT_EMAIL,
      client_name: DEFAULT_CLIENT,
    });

    return {
      success: true,
      data:
        response.data.analysis ??
        response.data.result ??
        response.data,
    };
  } catch (error: any) {
    console.error("AI Analytics Error:", error);
    return {
      success: false,
      error:
        error?.response?.data?.error ??
        error?.message ??
        "unknown",
      data: null,
    };
  }
};

// ----------------------------
// User Info Builder
// ----------------------------
export const buildUserInfo = (parentId: number) => {
  return {
    parentId,
  };
};