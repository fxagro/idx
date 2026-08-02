import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import ssl

SMTP_HOST = os.environ.get("SMTP_HOST", "mail.mytriv.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "idx@mytriv.com")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "idx@mytriv.com")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://idx.mytriv.com")

def send_email(to_email: str, subject: str, html_body: str, text_body: str = ""):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # Create a custom SSL context that disables certificate verification
    # Equivalent to NodeJS rejectUnauthorized: false
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
            print(f"Email sent to {to_email} successfully.")
            return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
        return False

def send_verification_email(to_email: str, token: str):
    verify_url = f"{FRONTEND_URL}/api/auth/verify-email?token={token}"
    
    subject = "Verifikasi Akun AI Saham Platform (IDX)"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">AI Saham Platform</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Verifikasi Email Anda</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; text-align: center;">
            <h2 style="color: #333; margin-bottom: 20px;">Selamat datang di AI Saham Platform!</h2>
            <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
                Terima kasih telah mendaftar. Silakan klik tombol di bawah ini untuk mengaktifkan akun Anda.
            </p>
            <a href="{verify_url}" style="display: inline-block; background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                Verifikasi Email Sekarang
            </a>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
                Atau salin dan tempel tautan berikut di browser Anda:<br>
                <a href="{verify_url}" style="color: #2196f3; word-break: break-all;">{verify_url}</a>
            </p>
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px;">Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
            </div>
        </div>
    </div>
    """
    
    text_body = f"""
AI SAHAM PLATFORM (IDX) - VERIFIKASI AKUN

Selamat datang di AI Saham Platform!
Terima kasih telah mendaftar. Silakan buka tautan di bawah ini untuk mengaktifkan akun Anda:

{verify_url}

Terima kasih.
    """
    
    return send_email(to_email, subject, html_body, text_body)

def send_welcome_email(to_email: str):
    login_url = f"{FRONTEND_URL}/login"
    
    subject = "Pendaftaran Berhasil - Selamat Datang di AI Saham Platform"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">AI Saham Platform</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Pendaftaran Selesai</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; text-align: center;">
            <h2 style="color: #333; margin-bottom: 20px;">✅ Akun Anda Sudah Aktif!</h2>
            <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
                Selamat! Akun Anda telah berhasil diverifikasi. Sekarang Anda bisa login dan mulai menggunakan platform AI Saham.
            </p>
            <a href="{login_url}" style="display: inline-block; background-color: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                Mulai Login
            </a>
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #666; margin-bottom: 10px;">Terima kasih telah memilih AI Saham Platform!</p>
                <p style="color: #999; font-size: 12px;">Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
            </div>
        </div>
    </div>
    """
    
    text_body = f"""
AI SAHAM PLATFORM (IDX) - AKUN AKTIF

Akun Anda sudah aktif!
Selamat! Akun Anda telah berhasil diverifikasi. 
Silakan login melalui tautan berikut:
{login_url}

Terima kasih telah memilih AI Saham Platform!
    """
    
    return send_email(to_email, subject, html_body, text_body)
