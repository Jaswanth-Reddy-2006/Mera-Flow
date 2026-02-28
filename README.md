# Meraflow

Meraflow is a hyper-fast, seamless desktop dictation application and floating widget, designed to instantly capture and transcribe your voice using AI.

## Features
- **Always-on-top Widget**: A sleek, pure black pill widget that floats over all your applications, detached from the Windows taskbar.
- **Push-to-Talk**: Hold `Ctrl+Shift+Space` globally from anywhere on your PC to trigger recording.
- **Auto-Paste**: Once you release the Push-to-Talk shortcut, your transcription is instantly typed right where your cursor is.
- **Instant Recall**: Press `Shift+Alt+V` to immediately paste your most recent transcription again.
- **Meraflow Dashboard**: A centralized desktop application to view and copy your complete transcription history.
- **System Tray Persistence**: Closing the main dashboard merely minimizes the application to the system tray, allowing your widget to live flawlessly in the background forever until you explicitly quit.

## Architecture
Meraflow is built for maximum performance and cross-platform compatibility:
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Rust (via Tauri v2)
- **Speech-to-Text APIs**: Python (FastAPI + `faster-whisper`), containerized via Docker and deployed to the cloud.

## Development Setup

### Running the Desktop Application
1. Ensure Node.js and Rust are installed on your machine.
2. Inside `desktop-app`, run:
   ```bash
   npm install
   npm run tauri dev
   ```

### Building the Final Installer
To share this application as a `.exe` or `.msi` standalone Windows installer with your friends:
1. Inside `desktop-app`, run:
   ```bash
   npm run tauri build
   ```
2. Retrieve the `.exe` package from `desktop-app/src-tauri/target/release/bundle/nsis/`.

### Hosting the AI Core
The `stt-server` must be hosted on a cloud provider like Render, HuggingFace, or AWS to run the C++ optimized `faster-whisper` models. 
1. The included `Dockerfile` handles installing `libgomp1` and formatting the Linux environment.
2. Deploy the `stt-server` directory as a Docker service.
3. Update `VITE_API_URL` inside the desktop app's `.env` (or environment variables) to point to your new cloud endpoint.
