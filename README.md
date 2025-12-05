# Portfolio Beta

An interactive portfolio that transforms the traditional showcase into a dialogue. Rather than presenting a static collection of projects, this portfolio empowers an intelligent agent to proactively curate and present work based on conversation, context, and intent.

## Concept

The traditional portfolio is a monologue—a fixed narrative chosen by its creator. This portfolio becomes a dialogue. The agent observes, interprets, and curates in real-time, selecting projects that resonate with the moment, the question, or the emerging understanding between visitor and work.

Meaning is not inherent but constructed through interaction. Each project presentation emerges from the intersection of inquiry and intelligence. The agent doesn't simply retrieve—it reasons, connects, and chooses, transforming the portfolio from a showcase into a collaborative exploration.

## Architecture

### Core Components

- **3D Metaball Interface**: An animated, organic blob-like surface that responds to interaction and expands to reveal embedded projects
- **Animated Face**: A minimalist face that follows the cursor and animates during speech, creating a sense of presence and agency
- **AI Agent (X-Fast)**: An LLM-powered curator that asks peripheral questions to understand aesthetic preferences before presenting work
- **Voice Interface**: Speech recognition for input and text-to-speech for responses, enabling natural conversation
- **Embedded Viewer**: Projects are presented within the interface, maintaining context and continuity

### Interaction Flow

1. **Discovery**: The agent asks exploratory questions about themes, aesthetics, and preferences
2. **Recommendation**: Based on understanding, the agent suggests relevant projects
3. **Presentation**: Upon acceptance, the metaball expands to reveal the embedded project
4. **Reflection**: After viewing, the agent engages in follow-up conversation about the experience
5. **Continuation**: The dialogue continues, building understanding and curating the journey

## Technical Stack

- **Three.js**: 3D graphics and metaball rendering
- **GSAP**: Animation and transitions
- **OpenRouter API**: LLM service (Gemini 2.5 Flash Lite)
- **ElevenLabs API**: Text-to-speech synthesis
- **Web Speech API**: Voice recognition and fallback synthesis
- **Vite**: Build tool and development server
- **Vercel Serverless Functions**: API proxy for secure key management

## Setup

### Environment Variables

For local development, create a `.env` file in the root directory (optional - keys are not needed client-side anymore):

```env
# Not needed for local dev - API keys are handled server-side
```

### Vercel Deployment

When deploying to Vercel, add these environment variables in your Vercel project settings:

- `OPENROUTER_API_KEY` - Your OpenRouter API key (without `VITE_` prefix)
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key (without `VITE_` prefix)

**Important**: Do NOT use `VITE_` prefix for these keys. They are stored server-side only and accessed through the API proxy functions in `/api`.

### API Proxy

The project uses Vercel serverless functions to proxy API requests, keeping API keys secure on the server:

- `/api/openrouter` - Proxies requests to OpenRouter API
- `/api/elevenlabs` - Proxies requests to ElevenLabs API

This ensures API keys are never exposed to the browser.

## Philosophy

This approach acknowledges that meaning is constructed through interaction. By letting the agent select, we embrace uncertainty and possibility—trusting in the capacity of intelligent systems to make meaningful connections, see patterns we might miss, and curate experiences that are both surprising and deeply relevant, while remaining aware of the system's limitations and our own agency in the process.

