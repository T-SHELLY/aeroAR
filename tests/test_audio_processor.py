import unittest
import os
import sys
import warnings
from io import BytesIO

# Suppress ResourceWarnings from 3rd party libs (like whisper)
warnings.simplefilter("ignore", ResourceWarning)

# Add src to the path so we can import the utils
src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../src'))
sys.path.append(src_path)

from utils.audio_processor import convert_to_wav, transcribe_audio

class TestAudioProcessor(unittest.TestCase):
    def setUp(self):
        self.test_audio_dir = os.path.join(os.path.dirname(__file__), 'audios')
        self.sample_mp3 = os.path.join(self.test_audio_dir, 'oil-filter.mp3')
        self.temp_wav = os.path.join(self.test_audio_dir, 'temp_test.wav')

    def tearDown(self):
        # Cleanup temp file
        if os.path.exists(self.temp_wav):
            os.remove(self.temp_wav)

    def test_pipeline(self):
        """Test the full pipeline: MP3 -> WAV -> Transcribe"""
        
        # 1. Convert MP3 to WAV
        if not os.path.exists(self.sample_mp3):
            self.fail(f"Test file not found: {self.sample_mp3}")

        print(f"Testing conversion of {self.sample_mp3}...")
        with open(self.sample_mp3, 'rb') as f:
            wav_io = convert_to_wav(f)
            
        self.assertIsNotNone(wav_io, "Conversion returned None")
        self.assertIsInstance(wav_io, BytesIO)
            
        # Verify header
        content = wav_io.getvalue()
        self.assertTrue(content.startswith(b'RIFF'), "Output does not start with RIFF header")
        self.assertTrue(b'WAVE' in content[:16], "Output does not contain WAVE format marker")
        print("Conversion successful.")

        # 2. Save WAV for transcription
        with open(self.temp_wav, 'wb') as f:
            f.write(content)
            
        # 3. Transcribe
        print("Testing transcription...")
        text = transcribe_audio(self.temp_wav)
        print(f"Transcribed Text: {text}")
        
        self.assertIsInstance(text, str)
        self.assertNotEqual(text, "[Error generating transcript]")
        if text.startswith("["):
            print(f"Note: Transcription returned a service message: {text}")
        else:
            self.assertTrue(len(text) > 0, "Transcription returned empty string")

if __name__ == '__main__':
    unittest.main()
