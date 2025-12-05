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
- **Web Speech API**: Voice recognition and synthesis
- **Vite**: Build tool and development server

## Philosophy

This approach acknowledges that meaning is constructed through interaction. By letting the agent select, we embrace uncertainty and possibility—trusting in the capacity of intelligent systems to make meaningful connections, see patterns we might miss, and curate experiences that are both surprising and deeply relevant, while remaining aware of the system's limitations and our own agency in the process.

