// ChatThread — renders a list of {role, content} messages.
// content can be string OR an array of {type:'text'|'code', text}.

function MessageBlock({ block }) {
  if (block.type === 'code') {
    return (
      <pre><code>{block.text}</code></pre>
    );
  }
  // text — turn `inline` backticks into <code>
  const parts = block.text.split(/(`[^`]+`)/g);
  return (
    <p style={{ margin: '0 0 10px' }}>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`')
          ? <code key={i}>{p.slice(1, -1)}</code>
          : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </p>
  );
}

function AssistantMessage({ msg, isStreaming }) {
  const blocks = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
  return (
    <div className="msg-assistant">
      <div className="me">
        <span className="sparkle-dot"><Sparkle size={14} /></span>
        Assistant · Large
      </div>
      {blocks.map((b, i) => <MessageBlock key={i} block={b} />)}
      {isStreaming && (
        <div className="typing"><span /><span /><span /></div>
      )}
      {!isStreaming && (
        <div className="msg-actions">
          <button className="icon-btn" title="Copy"><IconCopy /></button>
          <button className="icon-btn" title="Regenerate"><IconRefresh /></button>
        </div>
      )}
    </div>
  );
}

function UserMessage({ msg }) {
  return <div className="msg-user">{msg.content}</div>;
}

function ChatThread({ messages, streaming }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages, streaming]);

  return (
    <div className="chat-thread" ref={ref}>
      <div className="thread-inner">
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          return m.role === 'user'
            ? <UserMessage key={i} msg={m} />
            : <AssistantMessage key={i} msg={m} isStreaming={streaming && isLast} />;
        })}
      </div>
    </div>
  );
}

window.ChatThread = ChatThread;
