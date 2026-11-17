// Remove todos os estabelecimentos de demonstração (is_demo) e o usuário
// "dono demonstração". Uso: npm run demo:remove
import { adminClient } from './env.ts';

const supabase = adminClient();
const { data, error } = await supabase.rpc('remove_demo_data');
if (error) throw error;
console.log('✓ Dados de demonstração removidos:', data);
console.log('As imagens em public/demo podem ser apagadas do repositório se não forem mais usadas.');
