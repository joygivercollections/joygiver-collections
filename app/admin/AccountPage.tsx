import { FormEvent, useState } from "react";
import { ApiRequestError, ownerApi } from "../api";

export function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) { setMessage("New passwords do not match."); return; }
    if (newPassword.length < 12) { setMessage("New password must be at least 12 characters."); return; }
    try {
      await ownerApi.changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmation(""); setMessage("Password updated successfully.");
    } catch (caught) { setMessage(caught instanceof ApiRequestError ? caught.message : "Password could not be updated."); }
  }

  return <main className="admin-content"><header className="admin-page-head"><div><p className="eyebrow">Security</p><h1>Account</h1><p>Keep access to the owner dashboard private and secure.</p></div></header><form className="account-form" onSubmit={submit}><h2>Change password</h2><label>Current password<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label><label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} required /><small>Use at least 12 characters.</small></label><label>Confirm new password<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required /></label>{message ? <p className="admin-notice" role="status">{message}</p> : null}<button className="button button--dark" type="submit">Update password</button></form></main>;
}
