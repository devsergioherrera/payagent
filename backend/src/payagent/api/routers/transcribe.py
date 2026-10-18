from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel

from payagent.api.deps import get_transcriber
from payagent.app.transcribe import MAX_BYTES, AudioTooLarge, EmptyAudio, TranscriptionFailed

router = APIRouter()


class Transcript(BaseModel):
    text: str


@router.post("/transcribe")
def transcribe(audio: UploadFile, service=Depends(get_transcriber)) -> Transcript:
    data = audio.file.read(MAX_BYTES + 1)  # bounded read: never load an unbounded upload
    try:
        return Transcript(text=service.transcribe(data, audio.content_type or "audio/webm"))
    except EmptyAudio:
        raise HTTPException(status_code=422, detail="No recibí audio")
    except AudioTooLarge:
        raise HTTPException(status_code=413, detail="El audio es demasiado largo")
    except TranscriptionFailed:
        raise HTTPException(status_code=502, detail="No pude transcribir el audio")
