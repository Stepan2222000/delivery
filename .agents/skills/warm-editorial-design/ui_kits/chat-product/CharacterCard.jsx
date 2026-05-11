// CharacterCard — empty-state grid tile

function CharacterCard({ icon, name, desc, onClick }) {
  return (
    <button className="char-card" onClick={onClick}>
      <div className="ico">{icon}</div>
      <div className="name">{name}</div>
      <div className="desc">{desc}</div>
    </button>
  );
}

window.CharacterCard = CharacterCard;
