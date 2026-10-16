// Cria (ou promove) o primeiro administrador do sistema.
// Uso: npm run criar-admin -- email@empresa.com.br "SenhaForte123" "Nome Completo"
import { createClient } from "@supabase/supabase-js";

const [email, password, fullName = "Administrador"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}
if (!email) {
  console.error('Uso: npm run criar-admin -- email@empresa.com.br "SenhaForte123" "Nome Completo"');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

let { data: profile } = await admin.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
if (!profile) {
  if (!password || password.length < 8) {
    console.error("Informe uma senha com pelo menos 8 caracteres.");
    process.exit(1);
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) {
    console.error("Erro ao criar o usuário:", error.message);
    process.exit(1);
  }
  profile = { id: data.user.id };
}

const { error } = await admin.from("profiles").update({ role: "admin", active: true, full_name: fullName }).eq("id", profile.id);
if (error) {
  console.error("Erro ao promover:", error.message);
  process.exit(1);
}
const { data: emp } = await admin.from("employees").select("id").eq("profile_id", profile.id).maybeSingle();
if (!emp) await admin.from("employees").insert({ full_name: fullName, job_title: "Administrador", profile_id: profile.id });

console.log(`✔ ${email} é administrador. Acesse /login para entrar.`);
