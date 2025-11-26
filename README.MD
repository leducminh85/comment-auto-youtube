# Auto Reply for YouTube Studio (Gemini AI)

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![AI Engine](https://img.shields.io/badge/AI-Google%20Gemini-orange)

A powerful Chrome Extension that automates comment replies in YouTube Studio using Google's Gemini AI. This tool integrates directly into the YouTube Studio Side Panel, allowing creators to manage their community efficiently with context-aware AI responses.

## ✨ Features

*   **Side Panel Integration**: Works seamlessly alongside your YouTube Studio comments tab.
*   **AI-Powered Replies**: Uses Google's `gemini-2.5-flash` model for fast and natural responses.
*   **Two Context Modes**:
    *   **Fixed Prompt**: Define a specific persona (e.g., "Friendly", "Professional") for consistent replies.
    *   **Chatbot AI (Contextual)**: The AI "remembers" conversation history per channel to provide context-aware responses (simulating a chatbot experience).
*   **Smart Workflow**:
    *   Automatically detects unreplied comments.
    *   **Preview Mode**: Review the AI's suggestion before sending.
    *   **Regenerate/Skip**: Don't like a reply? Generate a new one or skip the comment.
    *   **Manual Edit**: Tweak the AI response in the text box before applying.
*   **Auto-Scroll**: Automatically loads more comments when the current batch is finished.
*   **Chat History**: Saves interaction history locally to improve AI context over time.

## 🛠 Prerequisites

1.  **Google Chrome** (or a Chromium-based browser like Edge/Brave).
2.  **Google Gemini API Key**: You need a free or paid API key from [Google AI Studio](https://aistudio.google.com/).

## 📥 Installation

Since this extension is not yet on the Chrome Web Store, you must install it in **Developer Mode**:

1.  Download or Clone this repository to your computer.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Toggle **Developer mode** in the top-right corner.
4.  Click **Load unpacked**.
5.  Select the folder containing the `manifest.json` file.

## ⚙️ Configuration & Setup

1.  Go to **YouTube Studio** > **Comments**.
2.  Click the extension icon in the toolbar to open the **Side Panel**.
3.  **Set API Key**:
    *   Click "API Key (Gemini)".
    *   Paste your Google Gemini API Key.
    *   Click **Save Key**.

## 🚀 Usage Guide

### 1. Select Operation Mode
*   **Continuous**: The extension will process comments one by one. It generates a preview, waits for a few seconds (configurable in code), and automatically sends it unless you intervene.
*   **Manual**: (Logic implementation depends on specific code tweaks) Primarily designed to generate previews that require user click to send.

### 2. Select Context Source
*   **Fixed Prompt**:
    *   Uses a single instruction block (e.g., "Reply in Vietnamese, keep it short").
    *   You can customize this in the "Fixed Prompt" section.
*   **Chatbot AI**:
    *   Builds a history of `User (Comment)` vs `Model (Reply)` interactions.
    *   Passes previous interactions to Gemini so it understands the "vibe" of previous replies on that specific channel.

### 3. Start Processing
1.  Click the **Start** button.
2.  The extension will find the first unreplied comment.
3.  **Preview**: The AI reply will appear in the sidebar textarea.
    *   **Reply**: Sends the text immediately.
    *   **Regenerate**: Asks AI for a different version.
    *   **Skip**: Ignores the current comment and moves to the next.
4.  To stop, click **Stop**.

### 4. Chatbot Interaction (Bonus)
In the "Chatbot AI" section of the sidebar, you can manually chat with the AI using the stored channel history context. This is useful for testing how the AI perceives your channel's tone without replying to a specific comment.

## 📂 Project Structure

```text
├── manifest.json      # Extension configuration (Permissions, Side Panel)
├── background.js      # Handles extension lifecycle and side panel opening
├── content.js         # DOM manipulation (Finds comments, clicks Reply buttons)
├── sidebar.html       # The User Interface (UI)
├── sidebar.js         # Logic for the UI, Settings, and AI communication
└── icons/             # Icon files (16, 48, 128)
```

## 🔒 Privacy & Security

*   **Local Storage**: Your API Key and Chat History are stored locally in your browser (`chrome.storage.local`). They are **never** sent to any third-party server other than Google's Gemini API for generation.
*   **Permissions**:
    *   `storage`: To save settings.
    *   `sidePanel`: To display the UI.
    *   `scripting`/`activeTab`: To interact with the YouTube Studio page.
    *   `studio.youtube.com`: To read comments and post replies.

## ⚠️ Disclaimer

This tool automates actions on your YouTube account.
*   **Rate Limits**: Google Gemini API has rate limits (especially the free tier). The extension handles 429 errors with a retry mechanism, but excessive usage might hit limits.
*   **YouTube Policies**: Ensure your automated replies comply with YouTube's Community Guidelines. Avoid spamming generic text.
*   **Responsibility**: The author is not responsible for any actions taken on your channel or potential strikes/bans resulting from misuse of automation.

## 📄 License

This project is open-source. Feel free to modify and distribute.