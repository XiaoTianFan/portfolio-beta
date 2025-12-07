export class AudioService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.currentAudio = null;
        
        // Default voice and model configuration
        this.defaultVoiceId = "CwhRBWXzGAHq8TQ4Fs17"; // Default voice ID
        this.defaultModelId = "eleven_turbo_v2_5";
        this.outputFormat = "mp3_44100_128";
        
        // Use proxy endpoint instead of direct API
        // In local dev, use Vercel server on port 3000; in production, use relative path
        const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const apiBase = isLocalDev ? 'http://localhost:3000' : '';
        this.apiUrl = `${apiBase}/api/elevenlabs`;

        this.initSpeechRecognition();
    }

    async initializeVoices() {
        // Voice initialization disabled - using default voice ID
        console.log(`Using default voice ID: ${this.defaultVoiceId}`);
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
        if (!this.defaultVoiceId) {
            console.error('No voice ID available.');
            // Fallback to Web Speech API
            this.speakWithWebSpeechAPI(text, onStart, onEnd);
            return;
        }

        // Cancel any current speech
        this.cancelSpeech();

        try {
            // Call the proxy endpoint instead of using the SDK
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    voiceId: this.defaultVoiceId,
                    text: text,
                    modelId: this.defaultModelId,
                    outputFormat: this.outputFormat
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `API request failed with status ${response.status}`);
            }

            const data = await response.json();
            
            // Decode base64 audio data
            const audioBytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
            
            // Convert audio response to blob URL for playback
            const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });
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

