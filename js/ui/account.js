// Conta (opcional): criar conta, entrar (nome de utilizador ou e-mail, ou Google), recuperar a palavra-passe e sair.
// Sem conta a pessoa usa tudo na mesma (sessão anónima) — o botão "Continuar sem conta" está sempre visível.
// Com conta, o ambiente da pessoa (intérpretes, preferências, sinais gravados) volta em qualquer dispositivo.
import { cloud, register, login, resetPassword, signInGoogle, logout, authError, hasAccount, toEmail, USER_DOMAIN } from '../core/cloud.js';
import { esc } from '../core/store.js';

let tab = 'entrar';
const G = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style="stroke:none"><path fill="#4285F4" d="M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.5-9.4 6.5-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.3-3 .7-4.3V14H4.5C3 17 2 20.4 2 24s1 7 2.5 10l7.3-5.7z"/><path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>';

export function renderAccount(root, { toast, onChange, onGuest }) {
  const draw = () => renderAccount(root, { toast, onChange, onGuest });
  const guest = '<button class="btn" id="accGuest">Continuar sem conta</button>';
  const bindGuest = () => root.querySelector('#accGuest')?.addEventListener('click', onGuest);
  if (cloud.state === 'off' || cloud.state === 'error') { root.innerHTML = `<div class="acc"><p class="note">${esc(cloud.msg)}</p>${guest}</div>`; bindGuest(); return; }
  if (cloud.state === 'loading') { root.innerHTML = '<p class="empty">A ligar…</p>'; return; }

  if (hasAccount()) { // com sessão iniciada
    const u = cloud.user, byName = u.email?.endsWith(USER_DOMAIN), name = u.displayName || u.email;
    root.innerHTML = `<div class="acc">
      <div class="who-card"><span class="ava">${esc((name || '?')[0].toUpperCase())}</span><div><b>${esc(name)}</b><small>${esc(byName ? 'Utilizador: ' + u.email.split('@')[0] : u.email || '')}</small></div></div>
      <p class="note">✓ O seu ambiente está guardado na nuvem: intérpretes, preferências e sinais gravados. Noutro telemóvel, entre com esta conta e fica tudo como deixou.${cloud.reviewer ? '<br><b>Validador:</b> pode aprovar sinais da comunidade (menu → Validar sinais).' : ''}</p>
      ${u.emailVerified || !u.email || byName ? '' : '<p class="note">Enviámos um e-mail para confirmar o endereço.</p>'}
      <button class="btn" id="accOut">Sair da conta</button></div>`;
    root.querySelector('#accOut').onclick = () => logout().then(() => { toast('Saiu da conta.'); onChange(); draw(); });
    return;
  }

  root.innerHTML = `<div class="acc">
    <div class="tabs" role="tablist"><button role="tab" data-t="entrar" aria-selected="${tab === 'entrar'}">Entrar</button><button role="tab" data-t="criar" aria-selected="${tab === 'criar'}">Criar conta</button></div>
    <p class="note">A conta é opcional. Com conta, os seus intérpretes e sinais gravados ficam guardados: se mudar ou perder o telemóvel, entra noutro e encontra tudo como deixou.</p>
    <form id="accForm" class="acc">
      ${tab === 'criar' ? '<input id="accName" autocomplete="name" placeholder="O seu nome" aria-label="Nome">' : ''}
      <input id="accEmail" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Nome de utilizador ou e-mail" aria-label="Nome de utilizador ou e-mail" required>
      <input id="accPass" type="password" autocomplete="${tab === 'criar' ? 'new-password' : 'current-password'}" placeholder="Palavra-passe${tab === 'criar' ? ' (mínimo 6 caracteres)' : ''}" aria-label="Palavra-passe" required minlength="6">
      <p class="err" id="accErr" role="alert"></p>
      <button class="btn sun" type="submit">${tab === 'criar' ? 'Criar conta' : 'Entrar'}</button>
    </form>
    ${tab === 'entrar' ? '<button class="link" id="accForgot">Esqueci-me da palavra-passe</button>' : ''}
    <div class="or">ou</div>
    <button class="btn google" id="accGoogle">${G} Continuar com Google</button>
    ${guest}</div>`;
  bindGuest();
  root.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { tab = b.dataset.t; draw(); }));
  const err = (e) => (root.querySelector('#accErr').textContent = typeof e === 'string' ? e : authError(e));
  const val = (id) => root.querySelector(id)?.value.trim();
  root.querySelector('#accForm').onsubmit = async (e) => {
    e.preventDefault(); err('');
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const email = toEmail(val('#accEmail')); if (!email) throw 'O nome de utilizador precisa de pelo menos 3 letras ou números.';
      if (tab === 'criar') await register(val('#accName') || val('#accEmail'), email, root.querySelector('#accPass').value);
      else await login(email, root.querySelector('#accPass').value);
      toast(tab === 'criar' ? 'Conta criada.' : 'Bem-vindo(a) de volta!'); onChange(); draw();
    } catch (x) { err(x); btn.disabled = false; }
  };
  root.querySelector('#accForgot')?.addEventListener('click', async () => {
    const email = val('#accEmail'); if (!email) { err('Escreva o seu e-mail primeiro.'); return; }
    if (!email.includes('@')) { err('Uma conta com nome de utilizador não recebe e-mails. Se esqueceu a palavra-passe, crie uma conta nova (de preferência com e-mail).'); return; }
    try { await resetPassword(email); err(''); toast('Enviámos um e-mail para criar uma palavra-passe nova.'); } catch (x) { err(x); }
  });
  root.querySelector('#accGoogle').onclick = () => signInGoogle().then(() => { toast('Entrou com Google.'); onChange(); draw(); }).catch(err);
}
