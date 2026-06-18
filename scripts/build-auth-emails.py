import os, json, urllib.request

TOKEN = os.environ["NF_TOKEN"]; REF = os.environ["NF_REF"]
LOGO = "https://nossasfinancas.com.br/apple-touch-icon.png"

def email(headline, body, cta_label=None, cta_var="{{ .ConfirmationURL }}", footer=""):
    cta = ""
    if cta_label:
        cta = ('<tr><td style="padding:26px 32px 6px;">'
               f'<a href="{cta_var}" style="display:inline-block;background:#3ecf8e;color:#07140d;'
               'font-weight:600;font-size:14px;text-decoration:none;padding:12px 24px;border-radius:10px;">'
               f'{cta_label}</a></td></tr>')
    return (
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
'style="background:#0a0b0d;margin:0;padding:32px 12px;'
'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">'
'<tr><td align="center">'
'<table role="presentation" width="480" cellpadding="0" cellspacing="0" '
'style="width:480px;max-width:100%;background:#131418;border:1px solid rgba(255,255,255,0.08);border-radius:16px;">'
'<tr><td style="padding:28px 32px 0;">'
'<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
f'<td><img src="{LOGO}" width="30" height="30" alt="" style="display:block;border-radius:9px;"></td>'
'<td style="padding-left:10px;color:#f3f4f6;font-weight:600;font-size:15.5px;letter-spacing:-0.02em;">Nossas Finanças</td>'
'</tr></table></td></tr>'
'<tr><td style="padding:22px 32px 0;">'
f'<h1 style="margin:0;color:#f3f4f6;font-size:21px;font-weight:600;letter-spacing:-0.02em;line-height:1.25;">{headline}</h1>'
'</td></tr>'
f'<tr><td style="padding:12px 32px 0;color:#9ca2ac;font-size:14px;line-height:1.65;">{body}</td></tr>'
f'{cta}'
f'<tr><td style="padding:18px 32px 28px;color:#5f646c;font-size:11.5px;line-height:1.6;">{footer}</td></tr>'
'</table>'
'<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;"><tr>'
'<td style="padding:16px 8px;color:#5f646c;font-size:11px;text-align:center;line-height:1.5;">'
'Nossas Finanças · privacidade por criptografia ponta a ponta</td></tr></table>'
'</td></tr></table>')

payload = {
    "mailer_autoconfirm": True,  # Task 2: desativa confirmação de e-mail

    "mailer_subjects_recovery": "Redefinir sua senha · Nossas Finanças",
    "mailer_templates_recovery_content": email(
        "Redefinir sua senha",
        "Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova — por segurança, o link expira em pouco tempo.",
        "Redefinir senha",
        footer="Se você não fez este pedido, pode ignorar este e-mail — sua senha continua a mesma."),

    "mailer_subjects_confirmation": "Confirme seu e-mail · Nossas Finanças",
    "mailer_templates_confirmation_content": email(
        "Confirme seu e-mail",
        "Bem-vindo(a)! Falta só confirmar este e-mail para ativar a sua conta.",
        "Confirmar e-mail",
        footer="Se você não criou esta conta, é só ignorar este e-mail."),

    "mailer_subjects_invite": "Seu convite · Nossas Finanças",
    "mailer_templates_invite_content": email(
        "Você foi convidado(a)",
        "Você recebeu um convite para criar a sua conta no Nossas Finanças — gestão de patrimônio multimoeda, privada por criptografia ponta a ponta.",
        "Criar minha conta",
        footer="Se você não esperava por isso, pode ignorar."),

    "mailer_subjects_email_change": "Confirme seu novo e-mail · Nossas Finanças",
    "mailer_templates_email_change_content": email(
        "Confirme seu novo e-mail",
        "Recebemos um pedido para alterar o e-mail da sua conta para <b style=\"color:#f3f4f6;\">{{ .NewEmail }}</b>. Confirme abaixo para concluir.",
        "Confirmar novo e-mail",
        footer="Se não foi você, ignore este e-mail — nada muda."),

    "mailer_subjects_magic_link": "Seu link de acesso · Nossas Finanças",
    "mailer_templates_magic_link_content": email(
        "Seu link de acesso",
        "Clique no botão abaixo para entrar na sua conta. O link expira em pouco tempo.",
        "Entrar",
        footer="Se você não pediu este link, é só ignorar."),

    "mailer_subjects_password_changed_notification": "Sua senha foi alterada · Nossas Finanças",
    "mailer_templates_password_changed_notification_content": email(
        "Sua senha foi alterada",
        "A senha da sua conta foi alterada agora há pouco. Se foi você, está tudo certo.",
        footer="Se <b style=\"color:#f3f4f6;\">não</b> foi você, redefina a sua senha imediatamente."),

    "mailer_subjects_email_changed_notification": "Seu e-mail foi alterado · Nossas Finanças",
    "mailer_templates_email_changed_notification_content": email(
        "Seu e-mail foi alterado",
        "O e-mail de acesso da sua conta foi alterado. Se foi você, está tudo certo.",
        footer="Se <b style=\"color:#f3f4f6;\">não</b> foi você, fale com a gente o quanto antes."),
}

json.dump(payload, open("/tmp/emails_payload.json", "w"))
print("payload escrito:", len(payload), "campos")
