1. Timeline

3-14-26: 5:12pm: 2.5 hrs
- Initial project setup: Create and run basic frontend, placeholder backend, setup docker
3-17-26: 8:20am: 2 hrs
- Claude.md Instructions, Updated UI, added recordings, store transcriptions, display results


2. Technical Decisions

For each major choice (language, framework, database, STT model, LLM provider, etc.), explain
what you considered and why you chose what you did.

Angular (frontend) - Framework I am most familiar with and could iterate on most quickly
Node.js + Fastify (backend) - 
SQLite (database) - Lightweight storage, easy to read and access results
Docker (backend container) - Required
Whisper - Lightweight and fast, good enough for the purposes of this app


3. Tools & Environment - List every tool, library, editor, extension, and service you used during development. Be comprehensive — we want to understand your full development environment and workflow.

- VSCode: Claude Code extension, Docker extension, WSL extension, GitHub Repositories extension, GitHub Copilot Chat extension
- Github Copilot


4. Resources Consulted - What documentation, articles, tutorials, forums, or other references did you use? How did they help?

- ChatGPT: Initial Brainstorming, choosing tools, advice on setup
- Docker official documentation 


5. Challenges & Solutions - What problems did you run into? How did you diagnose and solve them? What took longer than expected?

- Docker took longer than expected to install and run. I've never used it before and tried installing it from the WSL command line but it didn't have everything I needed to run the project. I went to the official Docker documentation and downloaded the desktop app. 
- Using WSL commands created some confusion as Claude installed using the windows command line. After I updated CLAUDE.md to note this things went much more smoothly. 

6. If You Had More Time
What would you improve, add, or change with another 16 hours?

