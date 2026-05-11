// Composer — chat input with attach + model picker.
// Auto-grows up to ~6 lines; Enter sends, Shift+Enter newline.

function Composer({ value, onChange, onSubmit, model, onModelChange, placeholder = "Reply to Assistant..." }) {
  const taRef = React.useRef(null);
  const [showModels, setShowModels] = React.useState(false);

  const adjust = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };
  React.useEffect(adjust, [value]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSubmit();
    }
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={taRef}
          className="composer-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder={placeholder} />
        <div className="composer-actions">
          <div className="composer-actions-l">
            <button className="tool-btn" title="Attach file">
              <IconAttach /> Attach
            </button>
            <button className="tool-btn icon-only" title="Use a project">
              <IconProject />
            </button>
          </div>
          <div className="composer-actions-r" style={{ position: 'relative' }}>
            <button className="model-btn" onClick={() => setShowModels(s => !s)}>
              {model} <IconChevronDown />
            </button>
            {showModels && (
              <div style={{
                position: 'absolute', bottom: '36px', right: 0, minWidth: '220px',
                background: 'var(--slate-850)', border: '1px solid var(--product-stroke)',
                borderRadius: '10px', padding: '6px', zIndex: 10,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
              }}>
                {['Large', 'XL', 'Small'].map(m => (
                  <button key={m}
                    onClick={() => { onModelChange(m); setShowModels(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 10px', background: m === model ? 'rgba(204,120,92,0.12)' : 'transparent',
                      color: m === model ? 'var(--brand-coral)' : '#fff',
                      border: 'none', borderRadius: '6px', cursor: 'pointer',
                      fontFamily: 'var(--font-serif)', fontSize: '14px'
                    }}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            <button
              className="send-btn"
              disabled={!value.trim()}
              onClick={onSubmit}
              title="Send">
              <IconArrowUp />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Composer = Composer;
