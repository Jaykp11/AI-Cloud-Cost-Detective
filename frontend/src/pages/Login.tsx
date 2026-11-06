import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
Activity,
ArrowRight,
ArrowUpRight,
Check,
Cloud,
Eye,
EyeOff,
Fingerprint,
LockKeyhole,
ShieldCheck,
Sparkles,
TrendingDown,
Zap,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/api";

function Brand() {
return ( <Link to="/login" className="inline-flex items-center gap-3"> <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#80B99A]/25 bg-[#80B99A]/10"> <Cloud className="h-5 w-5 text-[#A5D7B6]" /> </div>


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

function IntelligencePreview() {
const bars = [38, 56, 45, 72, 51, 86, 62, 94, 67, 79, 55, 70];

return ( <div className="auth-preview relative mt-10 w-full max-w-lg"> <div className="pointer-events-none absolute -inset-8 rounded-full bg-[#398A60]/10 blur-3xl" />


  <div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101713]/90 shadow-2xl shadow-black/25 backdrop-blur-xl">
    <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#80B99A]/15 bg-[#80B99A]/10">
          <Activity className="h-4 w-4 text-[#A5D7B6]" />
        </div>

        <div>
          <p className="text-sm font-semibold text-[#F1F1E9]">
            Cost intelligence
          </p>

          <p className="mt-1 text-xs text-[#91A096]">
            Infrastructure overview
          </p>
        </div>
      </div>

      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#80B99A]/20 bg-[#80B99A]/[0.07] px-2.5 py-1 text-[10px] font-medium text-[#A5D7B6]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#80B99A]" />
        AI insights
      </span>
    </div>

    <div className="p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#91A096]">
            Cloud spending
          </p>

          <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#F1F1E9] sm:text-3xl">
            Cost visibility
          </p>

          <p className="mt-1 text-xs text-[#91A096]">
            Your infrastructure, in focus
          </p>
        </div>

        <div className="mb-1 flex items-center gap-1.5 rounded-lg border border-[#80B99A]/15 bg-[#80B99A]/[0.06] px-2.5 py-1.5 text-xs font-medium text-[#A5D7B6]">
          <TrendingDown className="h-3.5 w-3.5" />
          Optimization
        </div>
      </div>

      <div className="mt-7 flex h-24 items-end gap-2 sm:h-28">
        {bars.map((height, index) => (
          <div
            key={index}
            className="group flex h-full flex-1 items-end"
          >
            <div
              className={`preview-bar w-full rounded-t-md ${
                index === 7
                  ? "bg-[#A5D7B6]"
                  : "bg-gradient-to-t from-[#245B40] to-[#80B99A]"
              }`}
              style={{
                height: `${height}%`,
                opacity: index === 7 ? 1 : 0.65,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-between border-t border-white/[0.07] pt-3 text-[10px] text-[#758279]">
        <span>Illustrative spending trends</span>
        <span>Preview</span>
      </div>
    </div>

    <div className="grid grid-cols-2 border-t border-white/[0.07]">
      <div className="border-r border-white/[0.07] p-4">
        <div className="flex items-center gap-2 text-xs text-[#91A096]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#A5D7B6]" />
          Cost visibility
        </div>

        <p className="mt-2 text-sm font-medium text-[#F1F1E9]">
          Understand usage
        </p>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 text-xs text-[#91A096]">
          <Zap className="h-3.5 w-3.5 text-[#C8B68B]" />
          AI assistance
        </div>

        <p className="mt-2 text-sm font-medium text-[#F1F1E9]">
          Discover opportunities
        </p>
      </div>
    </div>
  </div>

  <div className="absolute -right-3 top-24 hidden items-center gap-2 rounded-xl border border-white/[0.09] bg-[#18221B] px-3 py-2.5 shadow-xl sm:flex">
    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#80B99A]/15 bg-[#80B99A]/10">
      <Check className="h-4 w-4 text-[#A5D7B6]" />
    </div>

    <div>
      <p className="text-xs font-semibold text-[#F1F1E9]">
        Actionable insights
      </p>

      <p className="mt-1 text-[10px] text-[#91A096]">
        AI-assisted analysis
      </p>
    </div>
  </div>
</div>

);
}

export default function Login() {
const { login } = useAuth();
const navigate = useNavigate();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [showPassword, setShowPassword] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();
setError("");
setLoading(true);


try {
  await login(email.trim(), password);
  navigate("/dashboard", { replace: true });
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
          A clearer view of your cloud
        </div>

        <h1 className="max-w-xl font-display text-4xl font-semibold leading-[1.15] tracking-[-0.045em] text-[#F1F1E9] xl:text-5xl">
          Your cloud.
          <br />
          Your costs.
          <br />

          <span className="text-[#A5D7B6]">
            Understood.
          </span>
        </h1>

        <p className="mt-6 max-w-md text-sm leading-7 text-[#C0CBC2]/80 xl:text-base">
          Bring cloud spending into focus. Explore your AWS costs,
          uncover optimization opportunities, and turn complex
          infrastructure data into clearer decisions.
        </p>

        <IntelligencePreview />

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-[#A0B0A4] xl:mt-10">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#A5D7B6]" />
            Secure authentication
          </span>

          <span className="inline-flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-[#A5D7B6]" />
            Personal workspace
          </span>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-white/[0.09] pt-5 text-[11px] text-[#8FA095]">
        <span>Cloud Detective</span>
        <span>Built for better cloud decisions</span>
      </div>
    </section>

    {/* Login form */}

    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-10 lg:px-12">
      <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-[#398A60]/[0.05] blur-[110px] lg:hidden" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 lg:hidden">
          <Brand />
        </div>

        <div className="mb-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#80B99A]/20 bg-[#80B99A]/[0.08]">
            <LockKeyhole className="h-5 w-5 text-[#A5D7B6]" />
          </div>

          <p className="section-label">
            Your workspace awaits
          </p>

          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-[#F1F1E9] sm:text-4xl">
            Welcome back
          </h2>

          <p className="mt-3 text-sm leading-6 text-secondary">
            Sign in to continue to your cloud intelligence workspace.
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
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input-field pr-12"
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="button-primary group mt-2 w-full"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-[#102018]" />
                Signing you in...
              </>
            ) : (
              <>
                Sign in to workspace
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <div className="my-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted">
            Secure access
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface/70 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#A5D7B6]" />

          <p className="text-xs leading-5 text-secondary">
            Your workspace is protected by authenticated access.
            Sign in with the credentials associated with your account.
          </p>
        </div>

        <p className="mt-8 text-center text-sm text-secondary">
          New to Cloud Detective?{" "}

          <Link
            to="/signup"
            className="inline-flex items-center gap-1 font-semibold text-[#A5D7B6] transition-colors hover:text-[#C3E7CC]"
          >
            Create an account
            <ArrowUpRight className="h-3.5 w-3.5" />
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
