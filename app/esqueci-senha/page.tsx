// O site não envia e-mail: quem esqueceu a senha pede um código a um administrador.
export default function ForgotPasswordPage() {
  return <main className="display-bg grid min-h-screen place-items-center px-5 text-[#f0e1b5]"><div className="panel w-full max-w-sm rounded-[22px] border border-[#c9a45a]/25 p-7 text-center shadow-2xl">
    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#c9a45a]">Baraiada Poker Club</p>
    <h1 className="mt-2 font-heading text-2xl font-bold uppercase tracking-[.05em]">Esqueci a senha</h1>
    <p className="mt-5 text-sm text-[#c7ae7e]">Peça a um administrador do clube para gerar um <strong className="text-[#f7edcf]">código de redefinição</strong> para você. Ele manda o link pelo WhatsApp e você cria a nova senha na hora.</p>
    <p className="mt-3 text-xs text-[#a48e6a]">Já tem o código?</p>
    <a href="/redefinir-senha" className="mt-2 grid h-12 w-full place-items-center rounded-lg bg-[#c9a45a] font-bold uppercase tracking-[.08em] text-[#171008] hover:bg-[#e0c477]">Usar código</a>
    <a href="/login" className="mt-5 block text-xs text-[#a48e6a] hover:text-[#f0e1b5]">Voltar ao login</a>
  </div></main>;
}
