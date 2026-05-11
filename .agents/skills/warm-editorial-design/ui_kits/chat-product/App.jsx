// App — chat product click-thru recreation.
// View states: 'login' → 'home' (empty greeting + composer) → 'chat' (active thread)

const greetings = [
  "Good morning, Alex",
  "What's on your mind?",
  "Where shall we start?",
];

const RECENTS_INITIAL = [
  { id: 'r1', title: 'Design system tokens audit' },
  { id: 'r2', title: 'Drafting Q3 OKRs' },
  { id: 'r3', title: 'Python script for log parsing' },
  { id: 'r4', title: 'Rewriting onboarding email' },
];

const FAKE_REPLIES = {
  'design system': [
    { type: 'text', text: "Of course. A design-system audit usually has three layers — tokens, components, and patterns. Let's start with tokens, since drift there cascades everywhere else." },
    { type: 'text', text: "A useful first sweep: list every color literal in the codebase, then check whether each maps cleanly to a token. The ones that don't are your candidates for either consolidation or formal addition." },
    { type: 'code', text: "rg -o '#[0-9a-fA-F]{6}' src/ | sort -u" },
    { type: 'text', text: "Want me to walk through what to do with the leftovers, or move on to component-level checks?" },
  ],
  'default': [
    { type: 'text', text: "Happy to help with that. Could you tell me a little more about the context — who's the audience and what outcome you're after?" },
    { type: 'text', text: "If it's easier, share an example of something close to what you have in mind and I'll work from that." },
  ],
};

function pickReply(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes('design') || p.includes('system') || p.includes('token')) return FAKE_REPLIES['design system'];
  return FAKE_REPLIES['default'];
}

function HomeView({ greeting, onSubmit, value, setValue, model, setModel }) {
  return (
    <div className="home">
      <h1 className="home-greeting">
        <span className="sparkle"><Sparkle size={28} /></span>
        {greeting}
      </h1>
      <Composer
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
        model={model}
        onModelChange={setModel}
        placeholder="How can I help you today?" />
      <div className="suggestions">
        <button className="suggestion" onClick={() => setValue("Help me audit my design system tokens.")}>Audit my design tokens</button>
        <button className="suggestion" onClick={() => setValue("Draft an onboarding email for new users.")}>Draft an onboarding email</button>
        <button className="suggestion" onClick={() => setValue("Explain the difference between CSS Grid and Flexbox.")}>Explain Grid vs Flexbox</button>
        <button className="suggestion" onClick={() => setValue("Summarize the attached document.")}>Summarize a document</button>
      </div>
      <div className="character-grid">
        <CharacterCard icon={<IconCharacter />} name="The mentor" desc="Asks clarifying questions, then walks you through the answer step-by-step." />
        <CharacterCard icon={<IconStyles />} name="The editor" desc="Tightens prose, finds repetition, suggests stronger verbs." />
        <CharacterCard icon={<IconProject />} name="From a project" desc="Pick from your saved projects with shared context and files." />
      </div>
    </div>
  );
}

function ChatView({ messages, streaming, model, setModel, value, setValue, onSubmit }) {
  return (
    <div className="chat">
      <ChatThread messages={messages} streaming={streaming} />
      <div className="chat-composer-wrap">
        <Composer
          value={value}
          onChange={setValue}
          onSubmit={onSubmit}
          model={model}
          onModelChange={setModel} />
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = React.useState('login'); // 'login' | 'home' | 'chat'
  const [model, setModel] = React.useState('Large');
  const [recents, setRecents] = React.useState(RECENTS_INITIAL);
  const [activeId, setActiveId] = React.useState(null);
  const [composer, setComposer] = React.useState('');
  const [messages, setMessages] = React.useState([]);
  const [streaming, setStreaming] = React.useState(false);

  const greeting = React.useMemo(() => greetings[Math.floor(Math.random() * greetings.length)], []);

  const submit = () => {
    const text = composer.trim();
    if (!text) return;
    const userMsg = { role: 'user', content: text };

    if (view !== 'chat') {
      // start a new chat
      const id = 'r' + Date.now();
      setRecents(r => [{ id, title: text.slice(0, 40) }, ...r]);
      setActiveId(id);
      setView('chat');
      setMessages([userMsg]);
    } else {
      setMessages(m => [...m, userMsg]);
    }
    setComposer('');

    // fake streaming reply
    setStreaming(true);
    setTimeout(() => {
      setMessages(m => [...m, { role: 'assistant', content: pickReply(text) }]);
      setStreaming(false);
    }, 1100);
  };

  const newChat = () => {
    setView('home');
    setMessages([]);
    setActiveId(null);
    setComposer('');
  };

  const selectRecent = (id) => {
    setActiveId(id);
    setView('chat');
    // load a sample thread for any recent
    setMessages([
      { role: 'user', content: recents.find(r => r.id === id)?.title || '...' },
      { role: 'assistant', content: pickReply(recents.find(r => r.id === id)?.title || '') },
    ]);
  };

  if (view === 'login') {
    return <Login onSignIn={() => setView('home')} />;
  }

  return (
    <div className="app">
      <Sidebar
        activeId={activeId}
        onSelect={selectRecent}
        onNewChat={newChat}
        recents={recents}
        onSignOut={() => setView('login')} />
      <main className="main">
        <div className="topbar">
          <span className="topbar-title">
            {view === 'chat'
              ? recents.find(r => r.id === activeId)?.title || 'New chat'
              : 'Assistant'}
          </span>
        </div>
        {view === 'home'
          ? <HomeView
              greeting={greeting}
              value={composer}
              setValue={setComposer}
              onSubmit={submit}
              model={model}
              setModel={setModel} />
          : <ChatView
              messages={messages}
              streaming={streaming}
              value={composer}
              setValue={setComposer}
              onSubmit={submit}
              model={model}
              setModel={setModel} />
        }
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
