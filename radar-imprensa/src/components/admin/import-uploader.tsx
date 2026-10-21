"use client";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FormMessage } from "@/components/ui/form-message";
import { autoMapColumns, IMPORT_FIELD_LABELS, IMPORT_FIELDS, MAX_IMPORT_BYTES, parseCsv, REQUIRED_FIELDS, type ColumnMapping } from "@/lib/csv/import";
import { createImportPreview } from "@/app/actions/admin/imports";

const noopSubscribe = () => () => {};

export function ImportUploader() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [visibility, setVisibility] = useState<"restrito" | "assinantes">("restrito");
  const [error, setError] = useState<string | null>(null);
  // O campo só é habilitado após a hidratação (antes disso o onChange não existe).
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const onFile = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (f.size > MAX_IMPORT_BYTES) {
      setError("Arquivo maior que 5 MB.");
      return;
    }
    const content = await f.text();
    const parsed = parseCsv(content);
    if (parsed.headers.length === 0) {
      setError("Não foi possível ler o cabeçalho do CSV.");
      return;
    }
    setFile({ name: f.name, content });
    setHeaders(parsed.headers);
    setRowCount(parsed.rows.length);
    setMapping(autoMapColumns(parsed.headers));
    if (parsed.errors.length) setError(parsed.errors.join(" "));
  };

  const missing = REQUIRED_FIELDS.filter((f) => !mapping[f]);

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="csv-file">Arquivo CSV (UTF-8, separado por vírgula ou ponto e vírgula)</Label>
        <Input id="csv-file" type="file" accept=".csv,text/csv" className="mt-1.5" disabled={!ready} onChange={(e) => onFile(e.target.files?.[0])} />
        <p className="mt-1 text-xs text-muted-foreground">
          Modelo: <a href="/exemplos/importacao-exemplo.csv" download className="text-info hover:underline">importacao-exemplo.csv</a> (dados fictícios).
        </p>
      </div>
      {error ? <FormMessage state={{ ok: false, error }} /> : null}
      {file ? (
        <>
          <p className="flex items-center gap-2 text-sm"><FileSpreadsheet className="size-4 text-accent" aria-hidden /> {file.name}: {rowCount} linha(s) e {headers.length} coluna(s).</p>
          <fieldset className="rounded-md border p-4">
            <legend className="px-1 text-sm font-medium">Mapeamento de colunas</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_FIELDS.map((field) => (
                <div key={field}>
                  <Label htmlFor={`map-${field}`}>
                    {IMPORT_FIELD_LABELS[field]}
                    {REQUIRED_FIELDS.includes(field) ? <span className="text-danger"> *</span> : null}
                  </Label>
                  <NativeSelect id={`map-${field}`} className="mt-1.5" value={mapping[field] ?? ""} onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || undefined })}>
                    <option value="">— não importar —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </NativeSelect>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="max-w-md">
            <Label htmlFor="import-visibility">Visibilidade dos contatos importados</Label>
            <NativeSelect id="import-visibility" className="mt-1.5" value={visibility} onChange={(e) => setVisibility(e.target.value as "restrito" | "assinantes")}>
              <option value="restrito">Restrito (recomendado até revisão)</option>
              <option value="assinantes">Visível a usuários (exige base legal documentada)</option>
            </NativeSelect>
          </div>
          <Button
            disabled={pending || missing.length > 0}
            onClick={() =>
              startTransition(async () => {
                const r = await createImportPreview({ fileName: file.name, content: file.content, mapping: mapping as Record<string, string>, contactVisibility: visibility });
                if (r.ok && r.data) router.push(`/admin/importacoes/${r.data.batchId}`);
                else if (!r.ok) setError(r.error);
              })
            }
          >
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            Gerar prévia
          </Button>
          {missing.length ? <p className="text-xs text-danger">Mapeie as colunas obrigatórias: Nome e Veículo.</p> : null}
        </>
      ) : null}
    </div>
  );
}
