import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Loader2, Zap, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { devApi } from "@/lib/api";

const FEATURES = [
  { label: "Real-time attendance tracking" },
  { label: "AI-powered insights & alerts" },
  { label: "Department & role analytics" },
  { label: "MCP-ready API architecture" },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const set = (k) => (e) => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    setErrors(p => ({ ...p, [k]: "" }));
    setServerError("");
  };

  const validate = () => {
    const e = {};
    if (!form.email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    if (!form.password) e.password = "Password is required";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setServerError(err.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { data } = await devApi.seed();
      setForm({ email: data.credentials.admin.email, password: data.credentials.admin.password });
      setServerError("");
    } catch {
      setServerError("Seed failed — check backend connection");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060B18] flex overflow-hidden">
      {/* ── Left hero panel (desktop) ── */}
      <div className="hidden lg:flex flex-col w-[55%] relative bg-gradient-to-br from-[#0D0B22] to-[#060B18] p-12 overflow-hidden">
        {/* Ambient glows */}
        <motion.div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-600/20 blur-[100px]"
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 8, repeat: Infinity }} />
        <motion.div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-blue-600/10 blur-[100px]"
          animate={{ scale: [1.1, 1, 1.1] }}
          transition={{ duration: 10, repeat: Infinity }} />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />

        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">Nexus</span>
          </div>

          {/* Hero text */}
          <div className="py-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-violet-400 font-medium text-sm mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI-Powered Attendance Platform
              </p>
              <h1 className="text-4xl font-bold text-white leading-tight mb-4">
                Smarter attendance.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
                  AI-driven insights.
                </span>
              </h1>
              <p className="text-white/40 text-base leading-relaxed max-w-sm">
                Track attendance, analyze behavior, and surface AI insights to improve productivity — built for schools and offices.
              </p>
            </motion.div>

            <motion.ul
              className="mt-8 space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {FEATURES.map((f, i) => (
                <motion.li
                  key={f.label}
                  className="flex items-center gap-3 text-sm text-white/60"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.08 }}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  {f.label}
                </motion.li>
              ))}
            </motion.ul>
          </div>

          {/* Bottom stat strip */}
          <div className="grid grid-cols-3 gap-4">
            {[["99.9%", "Uptime"], ["10k+", "Users"], ["MCP", "Ready"]].map(([val, lab]) => (
              <div key={lab} className="glass rounded-xl p-4 text-center">
                <p className="text-lg font-bold text-white">{val}</p>
                <p className="text-xs text-white/30 mt-0.5">{lab}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right login form ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-[380px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">Nexus</span>
          </div>

          <div className="glass rounded-2xl p-7">
            <h2 className="text-xl font-bold text-white mb-1">Sign in</h2>
            <p className="text-sm text-white/40 mb-7">Welcome back to your dashboard</p>

            {/* Server error */}
            <AnimatePresence>
              {serverError && (
                <motion.div
                  className="flex items-start gap-2.5 p-3 mb-5 rounded-lg border border-red-500/20 bg-red-500/[0.08] text-sm text-red-400"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {serverError}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" placeholder="you@acme.com"
                  value={form.email} onChange={set("email")} error={!!errors.email} />
                {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPass ? "text" : "password"} placeholder="••••••••"
                    value={form.password} onChange={set("password")} error={!!errors.password} className="pr-10" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
              </div>

              <Button type="submit" variant="gradient" size="xl" className="w-full group" disabled={loading}>
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</>
                  : <>Sign in <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                }
              </Button>
            </form>

            {/* Demo seed */}
            <div className="mt-5 pt-5 border-t border-white/[0.06]">
              <p className="text-xs text-white/30 text-center mb-3">Or try with demo data</p>
              <Button variant="outline" size="default" className="w-full gap-2" onClick={handleSeed} disabled={seeding}>
                {seeding
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Seeding demo…</>
                  : <><Sparkles className="w-3.5 h-3.5" />Load Demo Data</>
                }
              </Button>
              <p className="text-[10px] text-white/20 text-center mt-2">
                Creates Acme Corp org with 10 users &amp; 60 days of data
              </p>
            </div>

            <p className="text-xs text-white/30 text-center mt-5">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-violet-400 hover:text-violet-300 transition-colors font-medium"
              >
                Sign up free
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
