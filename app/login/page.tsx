"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/app/actions/auth";

const inputClass =
  "border-2 border-black p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#2596BE] bg-white text-black";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signIn,
    undefined,
  );

  return (
    <>
      <div className="max-w-sm mx-auto mt-24 px-4 w-full">
      <h1 className="text-xs font-black uppercase tracking-widest px-2 py-1 mb-6">
        Sign In
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
          {pending ? "Signing In..." : "Sign In"}
        </button>
      </form>
      <p className="mt-4 text-xs text-white">
        No account?{" "}
        <Link href="/signup" className="underline font-bold">
          Sign up
        </Link>
      </p>
      </div>
      <Image
        src="/Ellerra_Powerpoint_Pattern_Title.png"
        alt=""
        width={3999}
        height={2250}
        className="w-full h-80 mt-24 object-cover object-top pointer-events-none select-none"
      />
    </>
  );
}
