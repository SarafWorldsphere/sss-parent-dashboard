from deep_translator import GoogleTranslator
from schemas import TranslateResponse
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

def translate_text(text: str, target_lang: str) -> TranslateResponse:
    if not text:
        return TranslateResponse(translated_text=text, original_text=text)
        
    try:
        translated = GoogleTranslator(source='auto', target=target_lang).translate(text)
        return TranslateResponse(translated_text=translated, original_text=text)
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        # Fallback: Return original text if translation fails
        return TranslateResponse(translated_text=text, original_text=text)
