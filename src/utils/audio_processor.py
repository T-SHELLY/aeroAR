import os
import speech_recognition as sr
from pydub import AudioSegment
from io import BytesIO

def convert_to_wav(file_storage) -> BytesIO:
    """
    Converts an uploaded audio file (mp3, m4a, etc.) to WAV format.
    Returns a BytesIO object containing the WAV data.
    """
    try:
        # Pydub requires ffmpeg or libav usually.
        # We read the file into memory first
        file_content = file_storage.read()
        file_storage.seek(0) # Reset pointer just in case
        
        # Determine format from extension is tricky with FileStorage, 
        # so we let pydub guess or just try generic loading (from_file)
        audio = AudioSegment.from_file(BytesIO(file_content))
        
        # Export as wav
        wav_io = BytesIO()
        audio.export(wav_io, format="wav")
        wav_io.seek(0)
        return wav_io
    except Exception as e:
        print(f"Error converting audio to WAV: {e}")
        return None

def transcribe_audio(audio_path) -> str:
    """
    Transcribes an audio file at the given path using SpeechRecognition.
    Returns the transcribed text or an error message/empty string.
    Expects a WAV file path.
    """
    recognizer = sr.Recognizer()
    
    try:
        # The file is already WAV, so we can load it directly
        with sr.AudioFile(audio_path) as source:
            # Record the audio data
            audio_data = recognizer.record(source)
            # Recognize using OpenAI Whisper (local model) which supports punctuation
            # Using "tiny" model for better performance on resource-constrained EC2 instances
            text = recognizer.recognize_whisper(audio_data, model="tiny")
            return text.strip()
    except sr.UnknownValueError:
        return "[Audio not clear enough to transcribe]"
    except sr.RequestError as e:
        return f"[Transcription service error: {e}]"
    except Exception as e:
        print(f"Transcription error: {e}")
        return "[Error generating transcript]"
