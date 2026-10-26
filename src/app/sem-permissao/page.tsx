import Link from "next/link";

export default function NoPermission() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Acesso não permitido</h1>
        <p className="mt-2 text-sm text-stone-500">Seu perfil não tem permissão para acessar esta área. Fale com o proprietário do sistema.</p>
        <Link href="/" className="btn btn-primary mt-6">Voltar ao início</Link>
      </div>
    </div>
  );
}
