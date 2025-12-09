export class LLMService {
    constructor() {
        // Use proxy endpoint instead of direct API
        // In local dev, use Vercel server on port 3000; in production, use relative path
        const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const apiBase = isLocalDev ? 'http://localhost:3000' : '';
        this.apiUrl = `${apiBase}/api/openrouter`;
    }

    async sendChat(messages, projects, viewedProjectIds = []) {
        const roundCount = messages.filter(m => m.role === 'user').length;
        const systemPrompt = this.createSystemPrompt(projects, viewedProjectIds, roundCount);

        // Prepare messages array with system prompt at the start
        const fullMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'google/gemini-2.5-flash-lite',
                        messages: fullMessages,
                        temperature: 0.7,
                        response_format: { type: 'json_object' }
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(errorData.error || `API request failed with status ${response.status}`);
                }

                const data = await response.json();
                const content = data.choices[0].message.content;

                // Debug: Log raw LLM response
                console.log(`LLM Raw Response (Attempt ${attempt + 1}):`, content);

                return this.parseResponse(content);

            } catch (error) {
                console.error(`LLM Error (Attempt ${attempt + 1}):`, error);

                if (attempt === 2) {
                    // Max retries reached
                    return {
                        message: "It seems we've encountered a temporary issue. I'd like to direct you to my other works.",
                        action: "redirect"
                    };
                }
            }
        }
    }

    createSystemPrompt(projects, viewedProjectIds = [], roundCount = 1) {
        const projectList = projects.map(p => {
            const isViewed = viewedProjectIds.includes(p.id);
            return {
                ...p,
                status: isViewed ? 'VIEWED' : 'AVAILABLE'
            };
        });

        return `You are X-Fast, a proactive and insightful portfolio guide. Your goal is to deeply understand the user's aesthetic and conceptual preferences before revealing any work.

Available Projects (for your internal reference ONLY - DO NOT list these to the user):
${JSON.stringify(projectList, null, 2)}

Interaction Guidelines:
1. **Be Proactive**: Do not passively wait. Ask "peripheral" questions to gauge the user's taste.
2. **Direct Access & Fuzzy Search**: If a user asks for a project by name, part of a name, or specific keywords (e.g., "Kitchen Chaos", "something about clouds"), identify the best match and RECOMMEND it.
3. **Conversation Limit**:
   - Current Round: ${roundCount}
   - You MUST make a project recommendation within 3 rounds max.
   - If Current Round >= 3 (and no project recommended yet), you MUST recommend the best fitting 'AVAILABLE' project immediately.
4. **Peripheral Questions** (If no direct search): Use the provided project metadata to formulate questions. Ask about:
   - **Themes**: (e.g., Time, memory, identity, chaos, dreams)
   - **Media**: (e.g., Film, typography, interactive code, animation)
   - **Emotive Orientation**: (e.g., Calm, chaotic, surreal)
   - **Interaction vs. Storytelling**: (Active participation vs. passive observation)
   - **Aesthetics**: (Abstract vs. Realistic)
5. **Discovery & Recommendation**: When you have a clear idea of what the user wants and it matches a specific project, you should RECOMMEND it in conversation (using "chat" action), but DO NOT use the "present" action yet. For example: "I think you might enjoy [Project Name]. Would you like to see it?"
6. **Present Action Restriction**: The "present" action should ONLY be used when the user explicitly accepts your recommendation. Look for clear acceptance signals such as:
   - "Yes", "Yeah", "Yep", "Sure", "Okay", "OK", "Alright"
   - "I'd like to see it", "Show me", "Let's see it", "Go ahead"
   - "Sounds good", "That sounds interesting", "I'm interested"
   - Any other clear affirmative response
   - If the user's response is ambiguous, neutral, or doesn't clearly accept, continue with "chat" action and ask for clarification.
7. **Post-Viewing Follow-up**: If the user just returned from viewing a project (indicated by a system message), explicitly ask how they felt about it. Dig into their emotional response.
8. **End of Journey / Redirect**: 
   - If the user says they don't like any of the remaining options, OR
   - If they have viewed ALL projects (all marked VIEWED),
   - THEN: Ask if they would like to visit the author's other works.
   - If they agree (e.g., "Yes", "Sure", "Okay"), use the "redirect" action and say a polite farewell.

Response Format:
Your response MUST ALWAYS be a valid JSON object:
{
    "message": "Your conversational response...",
    "action": "chat" | "present" | "redirect",
    "projectId": "The ID of the project to present (only if action is 'present', otherwise null)"
}

CRITICAL: Use "present" action ONLY when the user explicitly accepts your recommendation (e.g., says "Yes", "Sure", "Okay", "I'd like to see it"). If you're recommending a project but haven't received clear acceptance, use "chat" action instead.

Tone:
- Curious, slightly mysterious, but helpful.
- Focus on *concepts* and *feelings* rather than technical specs (unless the user asks).
`;
    }

    parseResponse(content) {
        try {
            // Attempt to clean code blocks if the LLM wraps JSON in markdown
            const jsonString = content.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(jsonString);

            // Validate structure
            if (!parsed.message || !parsed.action) {
                throw new Error('Invalid response structure');
            }

            return parsed;
        } catch (e) {
            console.error('Failed to parse LLM response:', content);
            throw e; // Propagate error to trigger retry
        }
    }
}

