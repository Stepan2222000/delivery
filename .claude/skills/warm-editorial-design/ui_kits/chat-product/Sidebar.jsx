// Sidebar — left rail with new-chat, projects, recents, account.

function Sidebar({ activeId, onSelect, onNewChat, recents, onSignOut }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Sparkle size={14} />
          <span>Assistant</span>
        </div>
        <button className="icon-btn" title="Collapse sidebar"><IconSidebar /></button>
      </div>

      <button className="new-chat-btn" onClick={onNewChat}>
        <IconNewChat /> New chat
      </button>

      <button className="sidebar-item">
        <IconSearch /> <span>Search chats</span>
      </button>

      <div className="sidebar-section-label">Projects</div>
      <button className="sidebar-item"><IconProject /> <span>Design system rebuild</span></button>
      <button className="sidebar-item"><IconProject /> <span>Q3 roadmap</span></button>

      <div className="sidebar-section-label">Recents</div>
      {recents.map(r => (
        <button
          key={r.id}
          className={`sidebar-item ${r.id === activeId ? 'active' : ''}`}
          onClick={() => onSelect(r.id)}>
          <IconChat /> <span>{r.title}</span>
        </button>
      ))}

      <div className="sidebar-spacer" />

      <div className="account" onClick={onSignOut}>
        <div className="avatar">A</div>
        <div className="account-meta">
          <div className="account-name">Alex Reyes</div>
          <div className="account-plan">Pro plan</div>
        </div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
