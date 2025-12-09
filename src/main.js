import './style.css';
import { SceneManager } from './scene.js';
import { LLMService } from './llmService.js';
import { AudioService } from './audio.js';
import projects from './projects.json';

class App {
    constructor() {
        this.sceneManager = new SceneManager('canvas-container');
        this.isEmbedded = false;
        this.llmService = new LLMService();
        this.audioService = new AudioService();
        this.chatHistory = [];
        this.viewedProjects = new Set();
        this.isTTSActive = false;

        this.ui = {
            landing: document.getElementById('landing-ui'),
            embedded: document.getElementById('embedded-layer'),
            aboutOverlay: document.getElementById('about-overlay'),
            aboutBtn: document.getElementById('about-btn'),
            aboutCloseBtn: document.getElementById('about-close-btn'),
            landingInput: document.getElementById('landing-input'),
            chatInput: document.getElementById('chat-input'),
            iframe: document.getElementById('content-frame'),
            closeBtn: document.getElementById('close-btn'),
            chatHistory: document.getElementById('chat-history'),
            landingChatHistory: document.getElementById('landing-chat-history'),
            micBtn: document.getElementById('mic-btn'), // Added mic button reference
            ttsCursor: document.getElementById('tts-cursor'),
            ttsCursorInner: document.getElementById('tts-cursor-inner')
        };

        this.initListeners();
        this.initTTSCursor();
    }

    initListeners() {
        // Input handling
        this.ui.landingInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleInput(this.ui.landingInput.value);
                this.ui.landingInput.value = '';
            }
        });

        this.ui.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleInput(this.ui.chatInput.value);
                this.ui.chatInput.value = '';
            }
        });

        // Stop speaking if user types
        this.ui.landingInput.addEventListener('input', () => {
            this.audioService.cancelSpeech();
            this.setTTSActive(false);
        });
        this.ui.chatInput.addEventListener('input', () => {
            this.audioService.cancelSpeech();
            this.setTTSActive(false);
        });

        // Close button
        this.ui.closeBtn.addEventListener('click', () => {
            this.exitEmbeddedMode();
        });

        // About button
        if (this.ui.aboutBtn) {
            this.ui.aboutBtn.addEventListener('click', () => {
                this.openAboutOverlay();
            });
        }

        // About close button
        if (this.ui.aboutCloseBtn) {
            this.ui.aboutCloseBtn.addEventListener('click', () => {
                this.closeAboutOverlay();
            });
        }

        // Mic button handling
        if (this.ui.micBtn) {
            // Use click instead of mousedown to prevent potential multi-fire issues
            this.ui.micBtn.addEventListener('click', () => {
                if (this.audioService.isListening) {
                    // Toggle off if already listening
                    this.audioService.stopListening();
                    this.ui.micBtn.classList.remove('listening');
                    return;
                }

                this.audioService.cancelSpeech();
                this.setTTSActive(false);
                this.ui.micBtn.classList.add('listening');
                this.audioService.startListening(
                    (text) => { // onResult
                        if (!this.isEmbedded) {
                            this.ui.landingInput.value = text;
                        } else {
                            this.ui.chatInput.value = text;
                        }
                    },
                    () => { // onEnd
                        this.ui.micBtn.classList.remove('listening');
                        // Auto-submit if we have text
                        const text = this.isEmbedded ? this.ui.chatInput.value : this.ui.landingInput.value;
                        if (text.trim()) {
                            this.handleInput(text);
                            if (this.isEmbedded) this.ui.chatInput.value = '';
                            else this.ui.landingInput.value = '';
                        }
                    },
                    (err) => { // onError
                        // Error handling mostly done in service, just cleanup UI
                        this.ui.micBtn.classList.remove('listening');
                    }
                );
            });
        }
    }

    initTTSCursor() {
        // Track mouse movement to update cursor position
        document.addEventListener('mousemove', (e) => {
            if (this.isTTSActive && this.ui.ttsCursor && this.ui.ttsCursorInner) {
                this.ui.ttsCursor.style.left = e.clientX + 'px';
                this.ui.ttsCursor.style.top = e.clientY + 'px';
                this.ui.ttsCursorInner.style.left = e.clientX + 'px';
                this.ui.ttsCursorInner.style.top = e.clientY + 'px';
            }
        });
    }

    setTTSActive(active) {
        this.isTTSActive = active;
        if (active) {
            document.body.classList.add('tts-active');
            if (this.ui.ttsCursor) this.ui.ttsCursor.classList.add('active');
            if (this.ui.ttsCursorInner) this.ui.ttsCursorInner.classList.add('active');
            // Start face mouth animation
            if (this.sceneManager) {
                this.sceneManager.setFaceTalking(true);
            }
        } else {
            document.body.classList.remove('tts-active');
            if (this.ui.ttsCursor) this.ui.ttsCursor.classList.remove('active');
            if (this.ui.ttsCursorInner) this.ui.ttsCursorInner.classList.remove('active');
            // Stop face mouth animation
            if (this.sceneManager) {
                this.sceneManager.setFaceTalking(false);
            }
        }
    }

    enterEmbeddedMode(url = null, projectId = null) {
        this.isEmbedded = true;

        // Hide chat history in embedded mode
        if (this.ui.chatHistory) {
            this.ui.chatHistory.style.display = 'none';
        }

        // Hide chat input area in embedded mode
        const chatInputArea = document.querySelector('.chat-input-area');
        if (chatInputArea) {
            chatInputArea.style.display = 'none';
        }

        // Fade out landing UI
        this.ui.landing.style.opacity = '0';
        this.ui.landing.style.pointerEvents = 'none';

        // Determine project to show
        let project;
        if (url && projectId) {
            project = { url, id: projectId };
        } else if (url) {
            project = projects.find(p => p.url === url);
        }

        if (!project) {
            project = projects[Math.floor(Math.random() * projects.length)];
        }

        // Track viewed project
        if (project && project.id) {
            this.viewedProjects.add(project.id);
        }

        this.ui.iframe.src = project.url;

        // Expand blob first, then fade in embedded layer after expansion completes
        this.sceneManager.expandBlob(() => {
            // Blob expansion complete - now fade in embedded layer
            this.ui.embedded.classList.remove('hidden');
            // Force reflow
            void this.ui.embedded.offsetWidth;
            this.ui.embedded.classList.add('active');

            // Pause metablob rendering after fade-in completes
            setTimeout(() => {
                this.sceneManager.pause();
            }, 200);
        });
    }

    exitEmbeddedMode() {
        this.isEmbedded = false;
        this.audioService.cancelSpeech();
        this.setTTSActive(false);

        // Resume metablob rendering first to let the scene start loading
        this.sceneManager.resume();

        // Reset blob first, then fade out iframe after reset completes
        this.sceneManager.resetBlob(() => {
            // Blob reset complete - now fade out embedded layer
            this.ui.embedded.classList.remove('active');

            setTimeout(() => {
                this.ui.embedded.classList.add('hidden');
                this.ui.iframe.src = 'about:blank';

                // Fade in landing UI
                this.ui.landing.style.opacity = '1';
                this.ui.landing.style.pointerEvents = 'auto';

                // Show chat history again in embedded mode (for when we return)
                if (this.ui.chatHistory) {
                    this.ui.chatHistory.style.display = 'flex';
                }

                // Show chat input area again
                const chatInputArea = document.querySelector('.chat-input-area');
                if (chatInputArea) {
                    chatInputArea.style.display = 'flex';
                }

                // Chat history is preserved


                // Trigger system message and LLM follow-up
                this.triggerPostViewingFollowUp();

            }, 1000); // Fade out duration
        });
    }

    async triggerPostViewingFollowUp() {
        // Add visible system message
        this.addChatMessage('system', 'Project viewing ended.');

        // Add invisible system instruction to history
        this.chatHistory.push({
            role: 'system',
            content: 'The user has returned from viewing the project. Ask them how they felt about it. Be curious about their emotional response.'
        });

        // Show loading state
        const loadingMsg = this.addChatMessage('system', 'Thinking...', true);

        // Call LLM
        const response = await this.llmService.sendChat(this.chatHistory, projects, Array.from(this.viewedProjects));

        // Remove loading message
        loadingMsg.remove();

        this.handleLlmResponse(response);
    }

    openAboutOverlay() {
        // Fade out landing UI
        this.ui.landing.style.opacity = '0';
        this.ui.landing.style.pointerEvents = 'none';

        // Use same fade-in mechanism as L2 (opacity transition)
        setTimeout(() => {
            this.ui.aboutOverlay.classList.remove('hidden');
            // Force reflow to ensure transition works
            void this.ui.aboutOverlay.offsetWidth;
            this.ui.aboutOverlay.classList.add('active');

            // Pause metablob rendering after fade-in completes
            setTimeout(() => {
                this.sceneManager.pause();
            }, 1200); // Wait for fade-in transition (1s) + buffer
        }, 100); // Small delay to ensure landing UI fade starts
    }

    closeAboutOverlay() {
        // Resume metablob rendering first
        this.sceneManager.resume();

        // Fade out about overlay (same mechanism as L2 exit)
        this.ui.aboutOverlay.classList.remove('active');

        setTimeout(() => {
            this.ui.aboutOverlay.classList.add('hidden');

            // Fade in landing UI
            this.ui.landing.style.opacity = '1';
            this.ui.landing.style.pointerEvents = 'auto';
        }, 1000); // Fade out duration
    }

    async handleInput(text) {
        if (!text.trim()) return;

        this.audioService.cancelSpeech();
        this.setTTSActive(false);

        // Add user message to UI
        this.addChatMessage('user', text);

        // Add to history for LLM
        this.chatHistory.push({ role: 'user', content: text });

        // Show loading state
        const loadingMsg = this.addChatMessage('system', 'Thinking...', true);

        // Call LLM
        const response = await this.llmService.sendChat(this.chatHistory, projects, Array.from(this.viewedProjects));

        // Remove loading message
        loadingMsg.remove();

        this.handleLlmResponse(response);
    }

    handleLlmResponse(response) {
        // Handle Response
        if (response) {
            this.chatHistory.push({ role: 'assistant', content: JSON.stringify(response) });
            this.chatHistory[this.chatHistory.length - 1] = { role: 'assistant', content: response.message };

            // Add message but defer typing effect
            const msg = this.addChatMessage('system', response.message, false, true);

            let typingStarted = false;
            const startTypingSafe = () => {
                if (!typingStarted && msg.startTyping) {
                    typingStarted = true;
                    msg.startTyping();
                }
            };

            // Speak the response with TTS cursor animation
            this.audioService.speak(
                response.message,
                () => {
                    // onStart callback
                    this.setTTSActive(true);
                    // Start typing deferred message
                    startTypingSafe();
                },
                () => {
                    // onEnd callback
                    this.setTTSActive(false);
                    // Ensure text is shown even if onStart was missed (e.g. TTS error)
                    startTypingSafe();

                    // Handle redirect after TTS if action is 'redirect'
                    if (response.action === 'redirect') {
                        window.location.href = 'https://xiaotianfanx.com';
                    }

                    // Handle Action after TTS
                    if (response.action === 'present' && response.projectId) {
                        const project = projects.find(p => p.id === response.projectId);
                        if (project) {
                            if (!this.isEmbedded) {
                                this.enterEmbeddedMode(project.url, project.id);
                            } else {
                                this.ui.iframe.src = project.url;
                                if (project.id) this.viewedProjects.add(project.id);
                            }
                        }
                    }
                }
            );

            // 'chat' action is default, 'redirect' action is handled in onEnd callback of speak
        }
    }

    addChatMessage(sender, text, isLoading = false, deferTyping = false) {
        const msg = document.createElement('div');
        msg.className = `chat-msg ${sender} ${isLoading ? 'loading' : ''}`;
        msg.style.marginBottom = '8px';
        msg.style.padding = '8px 12px';
        msg.style.borderRadius = '12px';
        msg.style.maxWidth = '100%';
        msg.style.fontSize = '0.9rem';

        // Determine which chat history container to use
        // In embedded mode, chat history is hidden but we still add to it for consistency
        const chatContainer = this.isEmbedded
            ? this.ui.chatHistory
            : (this.ui.landingChatHistory || this.ui.chatHistory);

        if (sender === 'user') {
            msg.style.background = 'rgba(160, 160, 255, 0.2)';
            msg.style.alignSelf = 'flex-start';
            msg.style.textAlign = 'left';
        } else {
            msg.style.background = 'rgba(255, 255, 255, 0.1)';
            msg.style.alignSelf = 'flex-start';
            msg.style.textAlign = 'left';
        }

        if (isLoading) {
            msg.textContent = text;
        } else {
            if (deferTyping) {
                msg.textContent = 'Thinking...';
                msg.classList.add('loading');
            }

            // Typewriter effect for non-loading messages
            const startTyping = () => {
                if (deferTyping) {
                    msg.classList.remove('loading');
                }
                this.typewriterEffect(msg, text);
            };
            msg.startTyping = startTyping;

            if (!deferTyping) {
                startTyping();
            }
        }

        if (chatContainer) {
            chatContainer.appendChild(msg);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        return msg;
    }

    typewriterEffect(element, text) {
        element.textContent = '';
        let i = 0;
        const speed = 20; // milliseconds per character

        const type = () => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        };

        type();
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    new App();
});
