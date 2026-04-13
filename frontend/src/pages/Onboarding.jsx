import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, CheckCircle2,
  Loader2, Sparkles, School, Briefcase, GraduationCap,
  LayoutGrid, ArrowRight, AlertCircle,
  Users2, Layers, Check, LogOut
} from "lucide-react";
import { authApi, onboardingApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

const ORG_TYPES = [
  { value: "school",  label: "School",   icon: School,        color: "text-blue-400",   bg: "bg-blue-500/10",   desc: "K-12, primary or secondary education." },
  { value: "office",  label: "Office",   icon: Briefcase,     color: "text-violet-400", bg: "bg-violet-500/10", desc: "Corporate teams, sub-teams and shifts." },
  { value: "college", label: "College",  icon: GraduationCap, color: "text-cyan-400",   bg: "bg-cyan-500/10",   desc: "Universities, faculties and year batches." },
];

const DEFAULT_LABELS = {
  school:  { department: "Department", class: "Class",   section: "Section", subject: "Subject" },
  office:  { department: "Team",       class: "Project", section: "Sub-team", subject: "Task" },
  college: { department: "Faculty",    class: "Batch",   section: "Group",   subject: "Course" },
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { refreshUser, refreshOnboarding, logout } = useAuth();
  // step 0=Type, 1=Setup, 2=Finishing
  const [step, setStep] = useState(0);
  const [orgType, setOrgType] = useState("office");
  const [setupData, setSetupData] = useState({
    dept_name: "",
    dept_code: "",
    class_name: "",
    section_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const labels = DEFAULT_LABELS[orgType];

  const handleNext = () => { setError(""); setStep(s => s + 1); };
  const handleBack = () => { setError(""); setStep(s => s - 1); };

  const handleFinish = async () => {
    if (!setupData.dept_name.trim()) {
      setError(`Please provide at least a ${labels.department} name.`);
      return;
    }

    setLoading(true);
    setError("");
    try {
      // 1. Save org type + custom labels
      await authApi.updateOrgSettings({
        org_type: orgType,
        settings: {
          label_department: labels.department,
          label_class:      labels.class,
          label_section:    labels.section,
          label_subject:    labels.subject,
        },
      });

      // 2. Create org structure
      await onboardingApi.setup({
        org_type:        orgType,
        department_name: setupData.dept_name,
        department_code: setupData.dept_code || setupData.dept_name.substring(0, 3).toUpperCase(),
        class_name:      setupData.class_name || undefined,
        section_name:    setupData.section_name || undefined,
      });

      // 3. Force-complete onboarding (the admin is already a user)
      await onboardingApi.complete();

      // 4. Refresh both user + onboarding state so RequireAuth unblocks
      await Promise.all([refreshUser(), refreshOnboarding()]);

      setStep(2);
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong during setup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060B18] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-0 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-0 w-96 h-96 bg-cyan-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-xl w-full z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* STEP 0: Organization Type */}
            {step === 0 && (
              <div className="space-y-8">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto shadow-xl shadow-violet-500/20 mb-6">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">Welcome to Nexus!</h1>
                  <p className="text-white/40 max-w-sm mx-auto">Tell us what kind of organization you're setting up.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {ORG_TYPES.map(t => {
                    const Icon = t.icon;
                    const active = orgType === t.value;
                    return (
                      <div
                        key={t.value}
                        onClick={() => setOrgType(t.value)}
                        className={`flex flex-col items-center text-center p-6 rounded-2xl border transition-all duration-300 relative group cursor-pointer ${
                          active
                            ? "bg-white/[0.04] border-violet-500/50 ring-1 ring-violet-500/30 shadow-lg shadow-violet-500/10"
                            : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${t.bg} ${t.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <p className="font-semibold text-sm mb-1">{t.label}</p>
                        <p className="text-[10px] text-white/30 leading-relaxed">{t.desc}</p>
                        {active && (
                          <motion.div
                            layoutId="active-indicator"
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center shadow-lg"
                          >
                            <Check className="w-3.5 h-3.5 text-white" />
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3">
                  <Button variant="gradient" size="xl" className="w-full h-14 text-lg font-semibold group" onClick={handleNext}>
                    Continue <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-white/20 hover:text-white" onClick={logout}>
                    <LogOut className="w-4 h-4 mr-2" /> Use a different account
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 1: Initial Setup */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                    <LayoutGrid className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold">Create your first group</h2>
                  <p className="text-white/40 text-sm">Set up the first branch of your {orgType === "school" ? "school" : orgType === "college" ? "institution" : "organization"}.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="w-3 h-3 text-white/40" /> {labels.department} Name *
                    </Label>
                    <Input
                      placeholder={`e.g. ${orgType === "school" ? "Science" : orgType === "college" ? "Computer Science" : "Engineering"}`}
                      value={setupData.dept_name}
                      onChange={(e) => setSetupData(p => ({ ...p, dept_name: e.target.value }))}
                      className="h-12 bg-white/[0.03] border-white/[0.06]"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-white/60">
                        <Layers className="w-3 h-3" /> {labels.class} <span className="text-white/30">(optional)</span>
                      </Label>
                      <Input
                        placeholder={`e.g. ${orgType === "school" ? "Grade 10" : "Front-end"}`}
                        value={setupData.class_name}
                        onChange={(e) => setSetupData(p => ({ ...p, class_name: e.target.value }))}
                        className="bg-white/[0.03] border-white/[0.06]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-white/60">
                        <Users2 className="w-3 h-3" /> {labels.section} <span className="text-white/30">(optional)</span>
                      </Label>
                      <Input
                        placeholder="e.g. Section A"
                        value={setupData.section_name}
                        onChange={(e) => setSetupData(p => ({ ...p, section_name: e.target.value }))}
                        className="bg-white/[0.03] border-white/[0.06]"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-white/25 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-white/20 shrink-0" />
                    You can add more {labels.department.toLowerCase()}s and groups later from the Organization page.
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}

                <div className="flex gap-4">
                  <Button variant="outline" size="xl" className="flex-1 border-white/10" onClick={handleBack} disabled={loading}>
                    Back
                  </Button>
                  <Button variant="gradient" size="xl" className="flex-[2]" onClick={handleFinish} disabled={loading}>
                    {loading ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Setting up…</>
                    ) : (
                      <>Complete Setup <CheckCircle2 className="ml-2 w-5 h-5" /></>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Success */}
            {step === 2 && (
              <div className="text-center space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center mx-auto">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
                    >
                      <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                    </motion.div>
                  </div>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-emerald-500/50"
                    initial={{ scale: 0.8, opacity: 1 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 1, ease: "easeOut", repeat: 1 }}
                  />
                </div>

                <div className="space-y-2">
                  <h2 className="text-3xl font-bold">All set!</h2>
                  <p className="text-white/40 max-w-[280px] mx-auto">
                    Your workspace is ready. Taking you to the dashboard…
                  </p>
                </div>

                <div className="pt-4">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-500 mx-auto" />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      {step < 2 && (
        <div className="fixed bottom-10 flex gap-2">
          {[0, 1].map(i => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === step ? "w-8 bg-violet-500" : i < step ? "w-4 bg-emerald-500" : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
