import type { UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { PinPicker } from '~/components/map/pin-picker';
import { Field } from '~/components/ui/field';
import { Input, Select } from '~/components/ui/input';
import type { FormOptions } from '~/features/business/form-options.server';

type Form = UseFormReturn<FieldValues, unknown, FieldValues>;

/** Campos do estabelecimento comuns ao cadastro e ao painel. */
export function BusinessFields({
  form,
  err,
  options,
}: {
  form: Form;
  err: (name: string) => string | undefined;
  options: FormOptions;
}) {
  const { register, watch, setValue } = form;
  const reg = (name: string) => register(name as Path<FieldValues>);
  const cityId = watch('cityId') as string;
  const hoodId = watch('neighborhoodId') as string;
  const lat = watch('latitude') as string | number;
  const lng = watch('longitude') as string | number;
  const city = options.cities.find((c) => c.id === cityId) ?? options.cities[0];
  const hood = city?.neighborhoods.find((n) => n.id === hoodId);
  const fallbackCenter: [number, number] =
    hood?.latitude != null && hood.longitude != null
      ? [hood.latitude, hood.longitude]
      : [city?.latitude ?? -15.79, city?.longitude ?? -47.88];

  return (
    <>
      <Field id="name" label="Nome do negócio" error={err('name')}>
        <Input {...reg('name')} autoComplete="organization" />
      </Field>
      <Field id="categoryId" label="Categoria" error={err('categoryId')}>
        <Select {...reg('categoryId')}>
          <option value="">Escolha…</option>
          {options.categories.map((c) =>
            c.children.length ? (
              <optgroup key={c.id} label={c.name}>
                {c.children.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ) : (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ),
          )}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cityId" label="Cidade" error={err('cityId')}>
          <Select
            {...reg('cityId')}
            onChange={(e) => {
              setValue('cityId', e.target.value, { shouldValidate: true });
              setValue('neighborhoodId', '');
            }}
          >
            {options.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="neighborhoodId" label="Bairro" error={err('neighborhoodId')}>
          <Select {...reg('neighborhoodId')}>
            <option value="">Escolha…</option>
            {city?.neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id="addressLine" label="Endereço" hint="Quadra, rua, número ou loja." error={err('addressLine')}>
        <Input {...reg('addressLine')} autoComplete="street-address" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="addressComplement" label="Complemento" optional error={err('addressComplement')}>
          <Input {...reg('addressComplement')} />
        </Field>
        <Field id="postalCode" label="CEP" optional error={err('postalCode')}>
          <Input {...reg('postalCode')} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="whatsapp" label="WhatsApp do negócio" hint="Com DDD. É para onde os clientes vão mandar mensagem." error={err('whatsapp')}>
          <Input {...reg('whatsapp')} type="tel" inputMode="tel" placeholder="(61) 99999-0000" />
        </Field>
        <Field id="phone" label="Telefone fixo" optional error={err('phone')}>
          <Input {...reg('phone')} type="tel" inputMode="tel" placeholder="(61) 3333-0000" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">Posição no mapa</legend>
        <PinPicker
          lat={lat === '' || lat == null ? null : Number(lat)}
          lng={lng === '' || lng == null ? null : Number(lng)}
          fallbackCenter={fallbackCenter}
          onChange={(la, ln) => {
            setValue('latitude', la == null ? '' : String(la), { shouldDirty: true });
            setValue('longitude', ln == null ? '' : String(ln), { shouldDirty: true });
          }}
          error={err('latitude')}
        />
        <input type="hidden" {...reg('latitude')} />
        <input type="hidden" {...reg('longitude')} />
      </fieldset>
    </>
  );
}
