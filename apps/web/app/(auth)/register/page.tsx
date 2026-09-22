'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { AppBrand } from "../../../components/app-brand";
import { Button } from "../../../components/ui/button";
import { ApiError, api } from "../../../lib/api-client";
import { setToken } from "../../../lib/auth";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterInput = z.infer<typeof registerSchema>;

export default function RegisterPage(): React.JSX.Element {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterInput>();

  const onSubmit = async (values: RegisterInput): Promise<void> => {
    setServerError(null);
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    try {
      const res = await api.register(parsed.data);
      setToken(res.accessToken);
      router.push("/orgs");
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : "Registration failed. Try again.",
      );
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-grid">
        <section className="auth-panel auth-form-panel">
          <AppBrand href="/" />
          <div className="auth-kicker mono">NEW WORKSPACE / 01</div>
          <h1>Make failures useful.</h1>
          <p className="auth-lede">Create a workspace for tracing, replaying, and permanently testing your agent’s hardest failures.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
        <label className="form-field">
          Name
          <input
            type="text"
            {...register("name")}
            className="app-input"
            autoComplete="name"
          />
        </label>
        <label className="form-field">
          Email
          <input
            type="email"
            {...register("email")}
            className="app-input"
            autoComplete="email"
          />
        </label>
        <label className="form-field">
          Password
          <input
            type="password"
            {...register("password")}
            className="app-input"
            autoComplete="new-password"
          />
        </label>
        {serverError !== null && (
          <p className="form-error" role="alert">{serverError}</p>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="form-submit"
        >
          {isSubmitting ? "Creating workspace…" : "Create workspace"} <ArrowRight />
        </Button>
      </form>
      <p className="auth-switch">Already have an account? <Link href="/login">Log in <ArrowRight /></Link></p>
        </section>
        <aside className="auth-panel auth-story-panel auth-story-green">
          <div className="auth-story-grid" aria-hidden="true" />
          <div className="auth-story-content">
            <div className="auth-story-icon"><Sparkles /></div>
            <p className="auth-kicker mono">THE CORE LOOP</p>
            <h2>Find it. Replay it. Lock it.</h2>
            <ul className="auth-benefits">
              <li><Check /> Inspect nested execution evidence</li>
              <li><Check /> Change exactly one variable</li>
              <li><Check /> Turn the fix into regression coverage</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
