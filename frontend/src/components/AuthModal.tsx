import { FormEvent, useState } from "react";
import { Lock, Mail, User, X } from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile, token: string) => void;
  initialMode?: "login" | "register";
}

import { API_BASE } from "../config";

export function AuthModal({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = "login",
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? `${API_BASE}/auth/login/` : `${API_BASE}/auth/register/`;
      const body = mode === "login" ? { email, password } : { name, email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      onAuthSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{mode === "login" ? "Sign In to RouteLedger" : "Create Carrier Account"}</h3>
            <p className="modal-subtitle">
              {mode === "login"
                ? "Access your saved trips and driver logs."
                : "Sign up to persist trips on MongoDB Atlas."}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <label>
              <span>Driver / Carrier Name <b>*</b></span>
              <div className="input-with-icon">
                <User size={16} />
                <input
                  required
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </label>
          )}

          <label>
            <span>Email <b>*</b></span>
            <div className="input-with-icon">
              <Mail size={16} />
              <input
                required
                type="email"
                placeholder="driver@transport.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>

          <label>
            <span>Password <b>*</b></span>
            <div className="input-with-icon">
              <Lock size={16} />
              <input
                required
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="primary-button" type="submit" disabled={loading} style={{ width: "100%", marginTop: "8px" }}>
            {loading ? "Processing..." : mode === "login" ? "Sign In" : "Register"}
          </button>

          <div className="modal-switch-mode">
            {mode === "login" ? (
              <p>
                Don't have an account?{" "}
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
