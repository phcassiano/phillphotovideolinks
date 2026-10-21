"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { loginSchema } from "@/lib/validation/auth";
import { signIn } from "@/app/actions/auth";

type LoginValues = z.input<typeof loginSchema>;

export function LoginForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const response = await signIn(values, next);
      if (response && !response.ok) setResult(response);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage state={result} />
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" className="mt-1.5" aria-invalid={!!errors.email} aria-describedby="email-erro" {...form.register("email")} />
        <FieldError id="email-erro" message={errors.email?.message} />
      </div>
      <div>
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" autoComplete="current-password" className="mt-1.5" aria-invalid={!!errors.password} aria-describedby="senha-erro" {...form.register("password")} />
        <FieldError id="senha-erro" message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        Entrar
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-info hover:underline">
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}
