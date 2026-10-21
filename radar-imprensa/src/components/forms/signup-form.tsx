"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { signUp } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export function SignupForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", accountType: "assessor", organizationName: "" },
  });
  const { errors } = form.formState;
  const accountType = useWatch({ control: form.control, name: "accountType" });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const response = await signUp(values);
      if (response) setResult(response);
      if (response?.ok) form.reset();
    }),
  );

  if (result?.ok) return <FormMessage state={result} />;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage state={result} />
      <fieldset>
        <legend className="text-sm font-medium">Tipo de conta</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["assessor", "Assessoria / comunicação", "Pesquisar jornalistas e montar mailings"],
              ["jornalista", "Sou jornalista", "Reivindicar e manter meu perfil"],
            ] as const
          ).map(([value, title, hint]) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-md border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                accountType === value ? "border-primary bg-primary-soft" : "bg-surface",
              )}
            >
              <input type="radio" value={value} className="sr-only" {...form.register("accountType")} />
              <span className="block font-medium">{title}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" autoComplete="name" className="mt-1.5" aria-invalid={!!errors.fullName} {...form.register("fullName")} />
        <FieldError message={errors.fullName?.message} />
      </div>
      <div>
        <Label htmlFor="email">E-mail {accountType === "jornalista" ? "(de preferência o corporativo do veículo)" : "profissional"}</Label>
        <Input id="email" type="email" autoComplete="email" className="mt-1.5" aria-invalid={!!errors.email} {...form.register("email")} />
        <FieldError message={errors.email?.message} />
      </div>
      {accountType === "assessor" ? (
        <div>
          <Label htmlFor="organizationName">Agência ou organização (opcional)</Label>
          <Input id="organizationName" autoComplete="organization" className="mt-1.5" {...form.register("organizationName")} />
          <p className="mt-1 text-xs text-muted-foreground">Mailings podem ser compartilhados entre membros da mesma organização.</p>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="new-password" className="mt-1.5" aria-invalid={!!errors.password} {...form.register("password")} />
          <FieldError message={errors.password?.message} />
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirme a senha</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" className="mt-1.5" aria-invalid={!!errors.confirmPassword} {...form.register("confirmPassword")} />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
      </div>
      <div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" {...form.register("acceptTerms")} />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" className="text-info hover:underline" target="_blank">termos de uso</Link> e a{" "}
            <Link href="/privacidade" className="text-info hover:underline" target="_blank">política de privacidade</Link>.
          </span>
        </label>
        <FieldError message={errors.acceptTerms?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        Criar conta
      </Button>
    </form>
  );
}
