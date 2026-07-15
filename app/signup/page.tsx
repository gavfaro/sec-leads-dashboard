"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthFormState } from "@/app/actions/auth";

const inputClass =
  "border-2 border-black p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] bg-white text-black";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signUp,
    undefined,
  );

  return (
    <div className="max-w-sm mx-auto mt-24 px-4 w-full">
      <h1 className="text-xs font-black uppercase tracking-widest bg-black text-white px-2 py-1 mb-6">
        Create Account
      </h1>
      <form action={action} className="flex flex-col gap-4">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className={inputClass}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={6}
          className={inputClass}
        />
        {state?.error && (
          <p className="text-red-600 text-xs font-bold">{state.error}</p>
        )}
        <button
          disabled={pending}
          type="submit"
          className="bg-black text-white py-2 uppercase text-xs font-black tracking-widest disabled:opacity-50"
        >
          {pending ? "Creating Account..." : "Sign Up"}
        </button>
      </form>
      <p className="mt-4 text-xs text-white">
        Already have an account?{" "}
        <Link href="/login" className="underline font-bold">
          Sign in
        </Link>
      </p>
    </div>
  );
}
