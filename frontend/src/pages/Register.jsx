import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, ArrowRight, Loader2, Zap,
  AlertCircle, Sparkles, CheckCircle2, Building2, User, Mail, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

const FEATURES = [
  { label: "Create your organization in seconds" },
  { label: "AI-powered attendance insights" },
  { label: "Real-time analytics dashboard" },
  { label: "MCP-ready REST API included" },
];

const STEPS = [
  { id: "account", title: "Your details", desc: "Tell us about you" },
  { id: "org",     title: "Organization", desc: "Set up your workspace" },
];

/* Password strength helper */
function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: "Too short",  color: "bg-red-500" },
    { label: "Weak",       color: "bg-red-400" },
    { label: "Fair",       color: "bg-amber-400" },
    { label: "Good",       color: "bg-emerald-400" },
    { label: "Strong",     color: "bg-emerald-500" },
    { label: "Very strong",color: "bg-emerald-500" },
  ];
  return { score, ...map[score] };
}

export default function Register() {
  const navigate  = useNavigate();
  const { register } = useAuth();

  const [step, setStep] = useState(0); // 0 = account, 1 = org
  const [form, setForm] = useState({
    name: "", email: "", password: "", organization_name: "",
  });
  const [errors,      setErrors]      = useState({});
  const [serverError, setServerError] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [showPass,    setShowPass]    = useState(false);

  const strength = passwordStrength(form.password);

  const set = (k) => (e) => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    setErrors(p => ({ ...p, [k]: "" }));
    setServerError("");
  };

  /* ── Step 0 validation ── */
  const validateStep0 = () => {
    const e = {};
    if (!form.name.trim())   e.name = "Full name is required";
    if (!form.email)         e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    if (!form.password)      e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Minimum 6 characters";
    return e;
  };

  /* ── Step 1 validation ── */
  const validateStep1 = () => {
    const e = {};
    if (!form.organization_name.trim()) e.organization_name = "Organization name is required";
    return e;
  };

  /* ── Next / Submit ── */
  const handleNext = (ev) => {
    ev.preventDefault();
    if (step === 0) {
      const errs = validateStep0();
      if (Object.keys(errs).length) { setErrors(errs); return; }
      setStep(1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const errs = validateStep1();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setServerError(
        typeof detail === "string" ? detail : "Registration failed. Please try again."
      );
      if (err.response?.status === 409) setStep(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060B18] flex overflow-hidden">

      {/* ── Left hero panel (desktop) ── */}
      <div className="hidden lg:flex flex-col w-[55%] relative bg-gradient-to-br from-[#0D0B22] to-[#060B18] p-12 overflow-hidden">
        {/* Ambient glows */}
        <motion.div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-600/20 blur-[100px]"
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-blue-600/10 blur-[100px]"
          animate={{ scale: [1.1, 1, 1.1] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        {/* Animated floating orb */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-violet-500/5 blur-[60px]"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

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
                Start for free — no credit card required
              </p>
              <h1 className="text-4xl font-bold text-white leading-tight mb-4">
                Launch your workspace.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
                  In under two minutes.
                </span>
              </h1>
              <p className="text-white/40 text-base leading-relaxed max-w-sm">
                Set up Nexus for your school or office and get AI-powered attendance tracking, analytics, and insights from day one.
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

          {/* Step progress indicator */}
          <div className="glass rounded-xl p-5">
            <p className="text-xs text-white/30 mb-3 uppercase tracking-widest">Setup progress</p>
            <div className="space-y-2">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${
                    i < step
                      ? "bg-emerald-500 text-white"
                      : i === step
                      ? "bg-violet-500 text-white"
                      : "bg-white/10 text-white/30"
                  }`}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <div>
                    <p className={`text-sm font-medium transition-colors ${i <= step ? "text-white" : "text-white/30"}`}>{s.title}</p>
                    <p className="text-xs text-white/20">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 h-1 rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"
                animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Right register form ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-[400px]"
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
            {/* Header */}
            <div className="mb-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-white">
                      {step === 0 ? "Create your account" : "Name your workspace"}
                    </h2>
                  </div>
                  <p className="text-sm text-white/40">
                    {step === 0
                      ? "Step 1 of 2 — your personal details"
                      : "Step 2 of 2 — almost there!"}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Mobile step bar */}
              <div className="mt-4 flex gap-1.5 lg:hidden">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      i <= step ? "bg-violet-500" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
            </div>

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

            {/* Form */}
            <form onSubmit={handleNext} noValidate>
              <AnimatePresence mode="wait">

                {/* ── Step 0: Account details ── */}
                {step === 0 && (
                  <motion.div
                    key="step0"
                    className="space-y-4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    {/* Full name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                        <Input
                          id="name"
                          type="text"
                          placeholder="Jane Smith"
                          value={form.name}
                          onChange={set("name")}
                          error={!!errors.name}
                          className="pl-9"
                        />
                      </div>
                      {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Work email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="jane@acme.com"
                          value={form.email}
                          onChange={set("email")}
                          error={!!errors.email}
                          className="pl-9"
                        />
                      </div>
                      {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                        <Input
                          id="password"
                          type={showPass ? "text" : "password"}
                          placeholder="Min. 6 characters"
                          value={form.password}
                          onChange={set("password")}
                          error={!!errors.password}
                          className="pl-9 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                        >
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}

                      {/* Strength meter */}
                      {form.password && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="space-y-1"
                        >
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(i => (
                              <div
                                key={i}
                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                  i <= strength.score ? strength.color : "bg-white/10"
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-white/30">{strength.label}</p>
                        </motion.div>
                      )}
                    </div>

                    <Button
                      type="submit"
                      variant="gradient"
                      size="xl"
                      className="w-full group mt-2"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </motion.div>
                )}

                {/* ── Step 1: Organization ── */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    className="space-y-4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    {/* Summary chip */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{form.name}</p>
                        <p className="text-xs text-white/40 truncate">{form.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(0)}
                        className="ml-auto text-xs text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0 cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>

                    {/* Organization name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="organization_name">Organization name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                        <Input
                          id="organization_name"
                          type="text"
                          placeholder="Acme Corp"
                          value={form.organization_name}
                          onChange={set("organization_name")}
                          error={!!errors.organization_name}
                          className="pl-9"
                          autoFocus
                        />
                      </div>
                      {errors.organization_name
                        ? <p className="text-xs text-red-400">{errors.organization_name}</p>
                        : <p className="text-xs text-white/30">This becomes your team's workspace name.</p>
                      }
                    </div>

                    {/* Plan badge */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <div>
                        <p className="text-sm font-medium text-white">Free plan</p>
                        <p className="text-xs text-white/30 mt-0.5">Up to 10 users • Core analytics</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Free
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="xl"
                        className="flex-1"
                        onClick={() => setStep(0)}
                        disabled={loading}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        variant="gradient"
                        size="xl"
                        className="flex-[2] group"
                        disabled={loading}
                      >
                        {loading
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</>
                          : <>Create workspace <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                        }
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            {/* Footer */}
            <p className="text-xs text-white/30 text-center mt-5">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-violet-400 hover:text-violet-300 transition-colors font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
