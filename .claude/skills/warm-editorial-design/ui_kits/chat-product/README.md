# Chat product — UI kit

A hi-fi recreation of a **dark-slate chat product** surface. This is the product-application companion to the cream marketing surface; for marketing pages use the cream tokens directly from `colors_and_type.css`.

## What's here
- `index.html` — interactive click-thru. Sidebar, chat thread, composer, model picker, character cards, project switcher.
- `App.jsx` — top-level layout + view switching
- `Sidebar.jsx` — left rail with new-chat, projects, recent chats, account menu
- `Composer.jsx` — chat input with attach + model picker
- `ChatThread.jsx` — user + assistant message bubbles, inline code blocks
- `Login.jsx` — sign-in with Google / email
- `CharacterCard.jsx` — character / project tiles for the empty-state grid

## Token usage
All components import `../../colors_and_type.css` and use CSS variables. No inline hex.

## Things faked / simplified
- Streaming response is a fixed delay + reveal, not a real LLM call
- File upload only validates the click — no actual upload
- The model picker has 3 fixed entries
- Conversation history is hard-coded
