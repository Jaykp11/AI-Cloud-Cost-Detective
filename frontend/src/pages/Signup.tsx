import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
ArrowRight,
Check,
Cloud,
Eye,
EyeOff,
Fingerprint,
ShieldCheck,
Sparkles,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/api";

function Brand() {
return ( <Link to="/signup" className="inline-flex items-center gap-3"> <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#80B99A]/25 bg-[#80B99A]/10"> <Cloud className="h-5 w-5 text-[#A5D7B6]" /> </div>

  <div>
    <p className="font-display text-base font-bold tracking-tight text-[#F1F1E9]">
      Cloud Detective
    </p>

    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#91A096]">
      Cloud intelligence
    </p>
  </div>
</Link>

);
}

const benefits = [
{
title: "Understand cloud spending",
description:
"Explore your AWS cost data with a clearer view of your infrastructure.",
},
{
title: "Discover opportunities",
description:
"Use AI-assisted analysis to identify potential optimization areas.",
},
{
title: "Keep your work organized",
description:
"Access previous analyses and revisit findings from your workspace.",
},
];

export default function Signup() {
const { signup } = useAuth();
const navigate = useNavigate();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();
setError("");


const normalizedEmail = email.trim();

if (password.length < 8) {
  setError("Your password must contain at least 8 characters.");
  return;
}

if (password.length > 128) {
  setError("Your password must not exceed 128 characters.");
  return;
}

if (password !== confirmPassword) {
  setError("Your passwords do not match. Please try again.");
  return;
}

setLoading(true);

try {
  await signup(normalizedEmail, password);
  navigate("/login", { replace: true, state: { message: "Account created successfully. Please log in." } });
} catch (err) {
  setError(getApiErrorMessage(err));
} finally {
  setLoading(false);
}


}

return ( <main className="min-h-screen bg-background text-foreground"> <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
{/* Brand panel */}


    <section className="ambient-panel relative hidden flex-col border-r border-white/[0.08] px-10 py-9 lg:flex xl:px-16">
      <div className="ambient-grid pointer-events-none absolute inset-0" />

      <div className="relative z-10">
        <Brand />
      </div>

      <div className="auth-brand-content relative z-10 my-auto max-w-xl py-8 xl:py-12">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#A5D7B6]/20 bg-[#A5D7B6]/[0.06] px-3 py-1.5 text-xs font-medium text-[#B1D8BC]">
          <Sparkles className="h-3.5 w-3.5" />
          Make cloud costs easier to understand
        </div>

        <h1 className="font-display text-4xl font-semibold leading-[1.15] tracking-[-0.045em] text-[#F1F1E9] xl:text-5xl">
          Better visibility.
          <br />
          Smarter decisions.
          <br />

          <span className="text-[#A5D7B6]">
            Better cloud economics.
          </span>
        </h1>

        <p className="mt-6 max-w-md text-sm leading-7 text-[#C0CBC2]/80 xl:text-base">
          Create your workspace and bring cost visibility, AI-assisted
          analysis, and historical reports together in one place.
        </p>

        <div className="auth-benefits mt-8 space-y-4 xl:mt-10 xl:space-y-5">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="flex gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#80B99A]/20 bg-[#80B99A]/[0.08]">
                <Check className="h-4 w-4 text-[#A5D7B6]" />
              </div>

              <div>
                <p className="text-sm font-semibold text-[#E8EDE7]">
                  {benefit.title}
                </p>

                <p className="mt-1 max-w-sm text-xs leading-5 text-[#A0B0A4]">
                  {benefit.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-white/[0.09] bg-[#101713]/70 p-5 backdrop-blur-sm xl:mt-10">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#80B99A]/15 bg-[#80B99A]/10">
              <Fingerprint className="h-5 w-5 text-[#A5D7B6]" />
            </div>

            <div>
              <p className="text-sm font-semibold text-[#F1F1E9]">
                Your workspace, your insights
              </p>

              <p className="mt-1 text-xs leading-5 text-[#A0B0A4]">
                Access your own analysis history and keep your cloud
                intelligence workflow organized.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-white/[0.09] pt-5 text-[11px] text-[#8FA095]">
        <span>Cloud Detective</span>
        <span>Built for better cloud decisions</span>
      </div>
    </section>

    {/* Signup form */}

    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-10 lg:px-12">
      <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-[#398A60]/[0.05] blur-[110px] lg:hidden" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 lg:hidden">
          <Brand />
        </div>

        <div className="mb-7">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#80B99A]/20 bg-[#80B99A]/[0.08]">
            <Sparkles className="h-5 w-5 text-[#A5D7B6]" />
          </div>

          <p className="section-label">
            Start your workspace
          </p>

          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-[#F1F1E9] sm:text-4xl">
            Create your account
          </h2>

          <p className="mt-3 text-sm leading-6 text-secondary">
            Set up your account to start exploring cloud cost intelligence.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-danger/20 bg-danger/[0.07] px-4 py-3 text-sm leading-6 text-danger"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-[#C7D0C8]"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-[#C7D0C8]"
            >
              Password
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a strong password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input-field pr-12"
                minLength={8}
                maxLength={128}
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-[#A5D7B6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A5D7B6]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <p className="mt-2 text-xs text-muted">
              Use at least 8 characters.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium text-[#C7D0C8]"
            >
              Confirm password
            </label>

            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                className="input-field pr-12"
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword((visible) => !visible)
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide confirmation password"
                    : "Show confirmation password"
                }
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-[#A5D7B6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A5D7B6]"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="button-primary group mt-2 w-full"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-[#102018]" />
                Creating your account...
              </>
            ) : (
              <>
                Create account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <div className="my-7 flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />

          <span className="text-xs text-muted">
            Account security
          </span>

          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface/70 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#A5D7B6]" />

          <p className="text-xs leading-5 text-secondary">
            Your account is created through the application's
            authentication service. Use a unique password for this
            workspace.
          </p>
        </div>

        <p className="mt-8 text-center text-sm text-secondary">
          Already have an account?{" "}

          <Link
            to="/login"
            className="font-semibold text-[#A5D7B6] transition-colors hover:text-[#C3E7CC]"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-10 text-center text-[11px] text-muted">
          Cloud Detective · Cloud cost intelligence
        </p>
      </div>
    </section>
  </div>
</main>


);
}
