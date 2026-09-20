import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiRequestError, ownerApi } from "../api";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await ownerApi.login(email, password);
      const destination = params.get("from");
      navigate(destination?.startsWith("/owner") ? destination : "/owner", { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.status === 429 ? "Too many attempts. Please try again in a few minutes." : "Email or password is incorrect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="owner-login">
      <section className="owner-login__brand">
        <Link to="/" className="owner-login__mark" aria-label="Return to Joygiver Collections"><span>J</span></Link>
        <div><p className="eyebrow">Joygiver Collections</p><h1>Your collection,<br /><em>beautifully managed.</em></h1><p>Update your catalogue, track availability, and keep every product detail in one calm place.</p></div>
      </section>
      <section className="owner-login__form-wrap">
        <form className="owner-login__form" onSubmit={submit}>
          <p className="eyebrow">Private access</p>
          <h2>Owner login</h2>
          <p>Sign in with your store email and password.</p>
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button button--dark" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <Link className="owner-login__back" to="/">← Back to the shop</Link>
        </form>
      </section>
    </main>
  );
}
