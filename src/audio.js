import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export class AudioService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.currentAudio = null;
        this.apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
        
        // Default voice and model configuration
        this.defaultVoiceId = "CwhRBWXzGAHq8TQ4Fs17"; // Default voice ID
        this.defaultModelId = "eleven_turbo_v2_5";
        this.outputFormat = "mp3_44100_128";

        // Initialize ElevenLabs client if API key is available
        if (this.apiKey) {
            this.elevenlabs = new ElevenLabsClient({
                apiKey: this.apiKey
            });
            // Temporarily disabled: Fetch available voices on initialization
            // this.initializeVoices();
        } else {
            console.warn('ElevenLabs API Key is missing. TTS will not work.');
            this.elevenlabs = null;
        }

        this.initSpeechRecognition();
    }

    async initializeVoices() {
        if (!this.elevenlabs) {
            return;
        }

        try {
            const voicesResponse = await this.elevenlabs.voices.search({});
            const voices = voicesResponse.voices;

            // Log all fetched voices with their IDs
            console.log('Fetched ElevenLabs voices:');
            voices.forEach((voice, index) => {
                console.log(`  ${index + 1}. Name: "${voice.name}", ID: "${voice.voiceId}"`);
            });

            // Use the first voice by default
            if (voices.length > 0) {
                this.defaultVoiceId = voices[0].voiceId;
                console.log(`Using default voice: "${voices[0].name}" (ID: ${this.defaultVoiceId})`);
            } else {
                console.warn('No voices found. TTS may not work.');
            }
        } catch (error) {
            console.error('Error fetching voices:', error);
            // Fallback to a known working voice_id if available
            // Note: This is a temporary fallback - user should verify their API key
            this.defaultVoiceId = null;
        }
    }

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
        } else {
            console.warn('Speech Recognition API not supported in this browser.');
        }
    }


    startListening(onResult, onEnd, onError) {
        if (!this.recognition) {
            if (onError) onError('Speech API not supported');
            return;
        }

        // If already listening, just return (prevent double start)
        if (this.isListening) {
            return;
        }

        this.recognition.onstart = () => {
            this.isListening = true;
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (onResult) onResult(transcript);
        };

        this.recognition.onerror = (event) => {
            // Handle "no-speech" silently (it just means the user didn't say anything)
            if (event.error === 'no-speech') {
                // Reset state but don't spam error logs
                this.isListening = false;
                if (onEnd) onEnd(); // Treat as end of session
                return;
            }
            
            console.error('Speech recognition error', event.error);
            if (onError) onError(event.error);
            this.isListening = false;
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (onEnd) onEnd();
        };

        try {
            this.recognition.start();
        } catch (e) {
            console.error('Failed to start recognition:', e);
            this.isListening = false;
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    async speak(text, onStart, onEnd) {
        if (!this.elevenlabs) {
            console.error('ElevenLabs API Key is missing. Cannot generate speech.');
            // Fallback to Web Speech API
            this.speakWithWebSpeechAPI(text, onStart, onEnd);
            return;
        }

        if (!this.defaultVoiceId) {
            console.error('No voice ID available. Please wait for voices to be fetched.');
            // Fallback to Web Speech API
            this.speakWithWebSpeechAPI(text, onStart, onEnd);
            return;
        }

        // Cancel any current speech
        this.cancelSpeech();

        try {
            // Generate audio using ElevenLabs streaming API
            const audioStream = await this.elevenlabs.textToSpeech.stream(this.defaultVoiceId, {
                text: text,
                modelId: this.defaultModelId,
                outputFormat: this.outputFormat
            });

            // Collect audio chunks from the stream
            const audioChunks = [];
            for await (const chunk of audioStream) {
                if (chunk) {
                    audioChunks.push(chunk);
                }
            }

            // Combine all chunks into a single Uint8Array
            const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const combinedAudio = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of audioChunks) {
                combinedAudio.set(chunk, offset);
                offset += chunk.length;
            }

            // Convert audio response to blob URL for playback
            const audioBlob = new Blob([combinedAudio], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(audioBlob);

            // Create Audio object for playback
            this.currentAudio = new Audio(audioUrl);

            // Set up event handlers
            this.currentAudio.onplay = () => {
                if (onStart) onStart();
            };

            this.currentAudio.onended = () => {
                // Clean up
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                if (onEnd) onEnd();
            };

            this.currentAudio.onerror = (error) => {
                console.error('Audio playback error:', error);
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                if (onEnd) onEnd();
            };

            // Start playback
            await this.currentAudio.play();

        } catch (error) {
            console.error('ElevenLabs TTS error:', error);
            // Fallback to Web Speech API
            this.speakWithWebSpeechAPI(text, onStart, onEnd);
        }
    }

    speakWithWebSpeechAPI(text, onStart, onEnd) {
        // Cancel any current speech
        this.cancelSpeech();

        if (!('speechSynthesis' in window)) {
            console.error('Web Speech API not supported in this browser.');
            if (onEnd) onEnd();
            return;
        }

        try {
            // Cancel any ongoing speech synthesis
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            
            // Set up event handlers
            utterance.onstart = () => {
                if (onStart) onStart();
            };

            utterance.onend = () => {
                if (onEnd) onEnd();
            };

            utterance.onerror = (error) => {
                console.error('Web Speech API error:', error);
                if (onEnd) onEnd();
            };

            // Start speech synthesis
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Error using Web Speech API:', error);
            if (onEnd) onEnd();
        }
    }

    cancelSpeech() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            // Clean up blob URL if possible
            if (this.currentAudio.src && this.currentAudio.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.currentAudio.src);
            }
            this.currentAudio = null;
        }
        
        // Also cancel Web Speech API if active
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }
}

