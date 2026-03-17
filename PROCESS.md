1. Timeline

3-14-26: 5:12pm: 2.5 hrs
- Initial project setup: Create and run basic frontend, placeholder backend, setup docker
3-17-26: 8:20am: 2 hrs
- First Claude.md Instructions, Updated UI, added recordings, store transcriptions, display basic results but always passing scores
3-17-26: 11:50am: 2.25 hrs
- Clean up backend to account for unusual inputs, Setup LLM extraction with Claude, troubleshooted issues with Anthropic API


2. Technical Decisions

For each major choice (language, framework, database, STT model, LLM provider, etc.), explain
what you considered and why you chose what you did.

Angular (frontend) - Framework I am most familiar with and could iterate on most quickly
Node.js + Fastify (backend) - Maintain consistency by using javascript, and use Fastify to simplify the implementation
SQLite (database) - Lightweight storage, easy to read and access results
Docker (backend container) - Required
Whisper - Lightweight and fast, good enough for the purposes of this app
Claude API  (LLM Provider) - As I used Claude as a coding assistant, it was most familiar with this API and could it working better and faster


3. Tools & Environment - List every tool, library, editor, extension, and service you used during development. Be comprehensive — we want to understand your full development environment and workflow.

- VSCode: Claude Code extension, Docker extension, WSL extension, GitHub Repositories extension, GitHub Copilot Chat extension
- Github Copilot


4. Resources Consulted - What documentation, articles, tutorials, forums, or other references did you use? How did they help?

- ChatGPT: Initial Brainstorming, choosing tools, advice on setup
- Docker official documentation 
- Stack Overflow: Issues with npm, git broken pipe bug, etc
- Anthropic API documentation


5. Challenges & Solutions - What problems did you run into? How did you diagnose and solve them? What took longer than expected?

- Docker took longer than expected to install and run. I've never used it before and tried installing it from the WSL command line but it didn't have everything I needed to run the project. I went to the official Docker documentation and downloaded the desktop app. 
- Using WSL commands created some confusion as Claude installed using the windows command line. After I updated CLAUDE.md to note this things went much more smoothly. 
- Getting the Anthropic API to analyze the 12 column schema on question 3 was difficult. After trying several simplifications I switched to Sonnet rather than Opus and changed the format to return JSON and it worked. 

6. If You Had More Time
What would you improve, add, or change with another 16 hours?

