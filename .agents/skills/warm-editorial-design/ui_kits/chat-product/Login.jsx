// Login screen — sign in with Google or email.

function Login({ onSignIn }) {
  const [email, setEmail] = React.useState('');
  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo">
          <Sparkle size={20} /> Assistant
        </div>
        <h1>Your ideas, amplified.</h1>
        <p>Privacy-first AI that helps you create in confidence.</p>

        <button className="btn-google" onClick={onSignIn}>
          <IconGoogle /> Continue with Google
        </button>

        <div className="login-divider">OR</div>

        <input
          type="email"
          placeholder="Enter your personal or work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)} />

        <button
          className="btn-email btn-email-primary"
          disabled={!email.trim()}
          onClick={onSignIn}>
          Continue with email
        </button>

        <div className="login-foot">
          By continuing, you agree to the <a href="#">Consumer Terms</a> and <a href="#">Usage Policy</a>, and acknowledge the <a href="#">Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}

window.Login = Login;
