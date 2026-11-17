import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImagePlus, Lock, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router';
import { usePanel } from './layout';
import { errorText } from '~/components/panel/image-field';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button, buttonVariants } from '~/components/ui/button';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { Field } from '~/components/ui/field';
import { Input, Select, Textarea } from '~/components/ui/input';
import { Skeleton, Spinner } from '~/components/ui/skeleton';
import { useToast } from '~/components/ui/toast';
import { panelKeys, usePlan } from '~/features/panel/queries';
import { removeImage, uploadImage } from '~/features/panel/upload';
import { IMAGE_RULES, mediaUrl } from '~/lib/images';
import { formatBRL } from '~/lib/money';
import { productCategorySchema, productSchema } from '~/lib/schemas/product';
import { usePublicEnv, useSupabase } from '~/lib/supabase/client';
import { useZodForm } from '~/lib/use-zod-form';
import type { Database } from '~/types/database';

type Product = Database['public']['Tables']['products']['Row'];
type PCategory = { id: string; name: string; sort_order: number };

function useCatalog(businessId: string) {
  const supabase = useSupabase();
  const products = useQuery({
    queryKey: panelKeys.products(businessId),
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('business_id', businessId).order('sort_order').order('created_at');
      if (error) throw error;
      return data;
    },
  });
  const categories = useQuery({
    queryKey: panelKeys.productCategories(businessId),
    queryFn: async () => {
      const { data, error } = await supabase.from('product_categories').select('id, name, sort_order').eq('business_id', businessId).order('sort_order');
      if (error) throw error;
      return data;
    },
  });
  return { products, categories };
}

function ProductDialog({
  businessId,
  product,
  categories,
  open,
  onOpenChange,
}: {
  businessId: string;
  product: Product | null;
  categories: PCategory[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const supabase = useSupabase();
  const env = usePublicEnv();
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const form = useZodForm(productSchema, {
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price_cents != null ? (product.price_cents / 100).toFixed(2).replace('.', ',') : '',
    productCategoryId: product?.product_category_id ?? '',
    isAvailable: product?.is_available ?? true,
    isFeatured: product?.is_featured ?? false,
  });

  React.useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const save = useMutation({
    mutationFn: async (v: ReturnType<typeof productSchema.parse>) => {
      let photo_path = product?.photo_path ?? null;
      let uploaded: string | null = null;
      if (file) {
        uploaded = await uploadImage(supabase, businessId, 'product', file);
        photo_path = uploaded;
      }
      const row = {
        name: v.name,
        description: v.description,
        price_cents: v.price,
        product_category_id: v.productCategoryId,
        is_available: v.isAvailable,
        is_featured: v.isFeatured,
        photo_path,
      };
      const { error: e } = product
        ? await supabase.from('products').update(row).eq('id', product.id)
        : await supabase.from('products').insert({ ...row, business_id: businessId, sort_order: Date.now() % 1_000_000_000 });
      if (e) {
        if (uploaded) await removeImage(supabase, uploaded);
        throw e;
      }
      if (uploaded && product?.photo_path) await removeImage(supabase, product.photo_path);
    },
    onSuccess: () => {
      toast({ tone: 'success', message: product ? 'Produto atualizado.' : 'Produto adicionado.' });
      qc.invalidateQueries({ queryKey: panelKeys.products(businessId) });
      onOpenChange(false);
    },
    onError: (e) => setError(errorText(e)),
  });

  const currentPhoto = preview ?? mediaUrl(env.SUPABASE_URL, product?.photo_path);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={product ? 'Editar produto' : 'Novo produto'} side="bottom">
        <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="flex flex-col gap-4">
          <Field id="p-name" label="Nome" error={form.err('name')}>
            <Input {...form.register('name')} />
          </Field>
          <Field id="p-price" label="Preço (R$)" optional hint="Deixe em branco para “Consulte”." error={form.err('price')}>
            <Input {...form.register('price')} inputMode="decimal" placeholder="0,00" />
          </Field>
          <Field id="p-desc" label="Descrição" optional error={form.err('description')}>
            <Textarea {...form.register('description')} rows={3} maxLength={600} />
          </Field>
          <Field id="p-cat" label="Seção" optional hint={categories.length ? undefined : 'Crie seções (ex.: Pizzas, Bebidas) na página de produtos.'}>
            <Select {...form.register('productCategoryId')}>
              <option value="">Sem seção</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Foto</span>
            <div className="flex items-center gap-3">
              <div className="grid size-20 place-items-center overflow-hidden rounded-2xl bg-cream-200">
                {currentPhoto ? <img src={currentPhoto} alt="" className="size-full object-cover" /> : <ImagePlus aria-hidden className="size-6 text-ink-muted" />}
              </div>
              <label className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'cursor-pointer' })}>
                <ImagePlus aria-hidden /> {currentPhoto ? 'Trocar foto' : 'Escolher foto'}
                <input type="file" accept={IMAGE_RULES.acceptedTypes.join(',')} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" {...form.register('isAvailable')} className="size-5 accent-[var(--color-brand-700)]" /> Disponível
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" {...form.register('isFeatured')} className="size-5 accent-[var(--color-brand-700)]" /> Destacar este produto
          </label>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button type="submit" size="lg" disabled={save.isPending}>
            {save.isPending ? <Spinner label="Salvando" /> : null} Salvar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Sections({ businessId, categories }: { businessId: string; categories: PCategory[] }) {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: panelKeys.productCategories(businessId) });
    qc.invalidateQueries({ queryKey: panelKeys.products(businessId) });
  };
  const add = useMutation({
    mutationFn: async () => {
      const parsed = productCategorySchema.safeParse({ name });
      if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);
      const { error } = await supabase
        .from('product_categories')
        .insert({ business_id: businessId, name: parsed.data.name, sort_order: (categories.at(-1)?.sort_order ?? 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setName('');
      setErr(null);
      invalidate();
    },
    onError: (e) => setErr(errorText(e)),
  });
  const move = useMutation({
    mutationFn: async ({ i, dir }: { i: number; dir: -1 | 1 }) => {
      const a = categories[i]!;
      const b = categories[i + dir]!;
      const r1 = await supabase.from('product_categories').update({ sort_order: b.sort_order }).eq('id', a.id);
      const r2 = await supabase.from('product_categories').update({ sort_order: a.sort_order === b.sort_order ? a.sort_order + dir : a.sort_order }).eq('id', b.id);
      if (r1.error || r2.error) throw r1.error ?? r2.error;
    },
    onSettled: invalidate,
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => toast({ tone: 'success', message: 'Seção removida. Os produtos ficaram “sem seção”.' }),
    onError: (e) => toast({ tone: 'error', message: errorText(e) }),
    onSettled: invalidate,
  });
  return (
    <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-lg font-bold">Seções</h2>
      <p className="text-sm text-ink-muted">Organize o cardápio ou catálogo em grupos, na ordem em que devem aparecer.</p>
      <ul className="mt-3 flex flex-col gap-1">
        {categories.map((c, i) => (
          <li key={c.id} className="flex min-h-11 items-center gap-1 rounded-xl px-2 hover:bg-cream">
            <span className="flex-1 font-semibold">{c.name}</span>
            <Button variant="ghost" size="icon" aria-label={`Subir ${c.name}`} disabled={i === 0 || move.isPending} onClick={() => move.mutate({ i, dir: -1 })}>
              <ArrowUp aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Descer ${c.name}`} disabled={i === categories.length - 1 || move.isPending} onClick={() => move.mutate({ i, dir: 1 })}>
              <ArrowDown aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Excluir seção ${c.name}`} onClick={() => del.mutate(c.id)}>
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <label htmlFor="new-section" className="sr-only">
          Nova seção
        </label>
        <Input id="new-section" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova seção (ex.: Bebidas)" maxLength={60} />
        <Button type="submit" variant="secondary" disabled={add.isPending}>
          <Plus aria-hidden /> Adicionar
        </Button>
      </form>
      {err ? <p role="alert" className="mt-2 text-sm text-danger">{err}</p> : null}
    </section>
  );
}

function Catalog({ businessId }: { businessId: string }) {
  const plan = usePlan(businessId);
  const { products, categories } = useCatalog(businessId);
  const supabase = useSupabase();
  const env = usePublicEnv();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [open, setOpen] = React.useState(false);
  const [dialogKey, setDialogKey] = React.useState(0);
  const invalidate = () => qc.invalidateQueries({ queryKey: panelKeys.products(businessId) });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<Product> }) => {
      const { error } = await supabase.from('products').update(values).eq('id', id);
      if (error) throw error;
    },
    onError: (e) => toast({ tone: 'error', message: errorText(e) }),
    onSettled: invalidate,
  });
  const del = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase.from('products').delete().eq('id', p.id);
      if (error) throw error;
      await removeImage(supabase, p.photo_path);
    },
    onSuccess: () => toast({ tone: 'success', message: 'Produto excluído.' }),
    onError: (e) => toast({ tone: 'error', message: errorText(e) }),
    onSettled: invalidate,
  });
  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: Product; b: Product }) => {
      const ao = a.sort_order === b.sort_order ? b.sort_order + 1 : b.sort_order;
      const r1 = await supabase.from('products').update({ sort_order: ao }).eq('id', a.id);
      const r2 = await supabase.from('products').update({ sort_order: a.sort_order }).eq('id', b.id);
      if (r1.error || r2.error) throw r1.error ?? r2.error;
    },
    onSettled: invalidate,
  });

  if (plan.isLoading || products.isLoading || categories.isLoading) return <Skeleton className="h-64" />;
  if (products.isError || categories.isError || plan.isError) return <Alert tone="error">Não foi possível carregar o catálogo.</Alert>;
  const p = plan.data!;
  const list = products.data ?? [];
  const cats = categories.data ?? [];

  if (!p.can_products) {
    return (
      <div className="flex flex-col gap-4">
        <Alert
          tone="info"
          title="Catálogo e cardápio fazem parte da Vitrine"
          action={<Link to="/painel/assinatura" className={buttonVariants()}>Conhecer a Vitrine</Link>}
        >
          Mostre produtos ou pratos com foto e preço, e receba pedidos de informação direto no WhatsApp com o nome do produto.
        </Alert>
        {list.length > 0 ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Lock aria-hidden className="size-4" /> Você tem {list.length} produtos guardados. Eles voltam a aparecer quando a Vitrine for reativada.
          </p>
        ) : null}
      </div>
    );
  }

  const openNew = () => {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setOpen(true);
  };
  const full = list.length >= p.max_products;
  const sections = [...cats.map((c) => ({ id: c.id as string | null, name: c.name })), { id: null, name: 'Sem seção' }];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {list.length} de {p.max_products} produtos
        </p>
        <Button onClick={openNew} disabled={full}>
          <Plus aria-hidden /> {full ? 'Limite atingido' : 'Novo produto'}
        </Button>
      </div>
      <Sections businessId={businessId} categories={cats} />
      {list.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-white p-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-semibold">Nenhum produto ainda.</p>
          <p className="mt-1 text-sm text-ink-muted">Comece pelos mais pedidos.</p>
          <Button className="mt-4" onClick={openNew}>
            <Plus aria-hidden /> Adicionar o primeiro
          </Button>
        </div>
      ) : (
        sections.map((s) => {
          const items = list.filter((x) => (s.id === null ? !cats.some((c) => c.id === x.product_category_id) : x.product_category_id === s.id));
          if (!items.length) return null;
          return (
            <section key={s.id ?? 'none'} className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
              <h2 className="mb-2 px-1 font-bold">{s.name}</h2>
              <ul className="divide-y divide-line">
                {items.map((x, i) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-cream-200">
                      {x.photo_path ? <img src={mediaUrl(env.SUPABASE_URL, x.photo_path) ?? ''} alt="" className="size-full object-cover" loading="lazy" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 font-semibold">
                        {x.name} {x.is_featured ? <Star aria-label="Destaque" className="size-4 fill-accent text-accent" /> : null}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {x.price_cents != null ? formatBRL(x.price_cents) : 'Consulte'}{' '}
                        {!x.is_available ? <Badge variant="danger">Indisponível</Badge> : null}
                      </p>
                    </div>
                    <div className="flex w-full items-center justify-end gap-0.5 sm:w-auto">
                      <label className="mr-auto flex min-h-11 items-center gap-2 text-sm sm:mr-1">
                        <input
                          type="checkbox"
                          checked={x.is_available}
                          onChange={(e) => patch.mutate({ id: x.id, values: { is_available: e.target.checked } })}
                          className="size-5 accent-[var(--color-brand-700)]"
                        />
                        <span>Disponível</span>
                        <span className="sr-only">: {x.name}</span>
                      </label>
                      <Button variant="ghost" size="icon" aria-label={`Subir ${x.name}`} disabled={i === 0} onClick={() => swap.mutate({ a: x, b: items[i - 1]! })}>
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Descer ${x.name}`} disabled={i === items.length - 1} onClick={() => swap.mutate({ a: x, b: items[i + 1]! })}>
                        <ArrowDown aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${x.name}`}
                        onClick={() => {
                          setEditing(x);
                          setDialogKey((k) => k + 1);
                          setOpen(true);
                        }}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${x.name}`}
                        onClick={() => {
                          if (window.confirm(`Excluir “${x.name}”?`)) del.mutate(x);
                        }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      <ProductDialog key={dialogKey} businessId={businessId} product={editing} categories={cats} open={open} onOpenChange={setOpen} />
    </div>
  );
}

export default function Produtos() {
  const { business } = usePanel();
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-black tracking-tight">Produtos e cardápio</h1>
      {business ? (
        <Catalog businessId={business.id} />
      ) : (
        <Alert tone="info" title="Cadastre seu negócio primeiro" action={<Link to="/painel/estabelecimento" className={buttonVariants()}>Cadastrar</Link>} />
      )}
    </div>
  );
}
