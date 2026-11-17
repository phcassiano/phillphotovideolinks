// Promove um usuário a administrador. O usuário precisa existir (crie a conta pelo
// site ou pelo painel do Supabase). Uso: npm run admin:create -- pessoa@exemplo.com
import { adminClient } from './env.ts';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Uso: npm run admin:create -- email@exemplo.com');
  process.exit(1);
}
const supabase = adminClient();
let page = 1;
let userId: string | undefined;
while (!userId) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (data.users.length < 1000) break;
  page++;
}
if (!userId) {
  console.error(`Usuário ${email} não encontrado. Crie a conta primeiro.`);
  process.exit(1);
}
const { error } = await supabase.from('user_roles').upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' });
if (error) throw error;
console.log(`✓ ${email} agora é administrador.`);
