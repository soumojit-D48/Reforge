'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { ArrowRight, LockKeyhole, ScanSearch } from "lucide-react";
import { AppBrand } from "../../../components/app-brand";
import { Button } from "../../../components/ui/button";
import { ApiError, api } from "../../../lib/api-client";
import { setToken } from "../../../lib/auth";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginInput = z.infer<typeof loginSchema>;

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginInput>();

  const onSubmit = async (values: LoginInput): Promise<void> => {
    setServerError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    try {
      const res = await api.login(parsed.data);
      setToken(res.accessToken);
      router.push("/orgs");
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : "Login failed. Try again.",
      );
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-grid">
        <section className="auth-panel auth-form-panel">
          <AppBrand href="/" />
          <div className="auth-kicker mono">SECURE ACCESS / 01</div>
          <h1>Return to the evidence.</h1>
          <p className="auth-lede">Open your investigation workspace and continue from the last failed run.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
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
            autoComplete="current-password"
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
          {isSubmitting ? "Checking credentials…" : "Log in"} <ArrowRight />
        </Button>
      </form>
      <p className="auth-switch">No account? <Link href="/register">Create one <ArrowRight /></Link></p>
        </section>
        <aside className="auth-panel auth-story-panel">
          <div className="auth-story-grid" aria-hidden="true" />
          <div className="auth-story-content">
            <div className="auth-story-icon"><ScanSearch /></div>
            <p className="auth-kicker mono">REFORGE / INVESTIGATION WORKSPACE</p>
            <h2>See the step that broke.</h2>
            <p>Trace every retrieval, model decision, and tool call. Then replay one controlled change instead of guessing.</p>
            <div className="auth-story-note mono"><LockKeyhole /> Your workspace is project-scoped by design.</div>
          </div>
        </aside>
      </div>
    </main>
  );
}
