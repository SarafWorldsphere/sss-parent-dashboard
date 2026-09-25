from fastapi import APIRouter, HTTPException
from schemas import TranslateRequest, TranslateResponse
from services.translation_service import translate_text

router = APIRouter()

@router.post("/translate", response_model=TranslateResponse)
def translate(request: TranslateRequest):
    try:
        return translate_text(request.text, request.target_lang)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
