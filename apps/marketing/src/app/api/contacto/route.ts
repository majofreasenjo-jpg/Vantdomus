import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Inicializar el SDK de Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    // 1. Capturar los datos enviados desde el formulario web
    const body = await request.json();
    const { nombre, email, empresa, telefono, mensaje, turnstileToken } = body;

    // Validación básica
    if (!nombre || !email || !mensaje || !turnstileToken) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios o Escudo Bot no validó.' },
        { status: 400 }
      );
    }

    // 1.5 Validación Zero-Trust Turnstile
    const SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
    const turnstileFormData = new URLSearchParams();
    turnstileFormData.append('secret', SECRET_KEY);
    turnstileFormData.append('response', turnstileToken);

    const turnstileResult = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      body: turnstileFormData,
      method: 'POST',
    });
    
    const turnstileOutcome = await turnstileResult.json();
    if (!turnstileOutcome.success) {
      console.warn('Turnstile Falló:', turnstileOutcome);
      return NextResponse.json(
        { error: 'Bloqueo Anti-Bot Activado. Tráfico rechazado.' },
        { status: 403 }
      );
    }

    // 2. Enviar el correo usando Resend B2B
    const { data, error } = await resend.emails.send({
      from: 'Contacto | Luxen <contacto@luxen.cl>', // Dominio verificado en Cloudflare
      to: 'comercial@luxen.cl', // Destino corporativo real
      replyTo: email, // Permite responder directo a tu cliente desde Gmail
      subject: `🔥 Nuevo Lead B2B de: ${empresa || nombre}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-w-2xl">
          <h2 style="color: #d97706;">Nuevo Contacto Estratégico (Luxen.cl)</h2>
          <p><strong>Nombre:</strong> ${nombre}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Empresa:</strong> ${empresa || 'No especificada'}</p>
          <p><strong>Teléfono:</strong> ${telefono || 'No especificado'}</p>
          <hr style="border: 1px solid #eee; margin-top: 20px; margin-bottom: 20px;" />
          <h3 style="color: #475569;">Requerimiento / Proyecto:</h3>
          <p style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; line-height: 1.6;">
            ${mensaje}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Error devuelto por la API de Resend:', error);
      return NextResponse.json(
        { error: 'Error del servidor de correos (Resend)' },
        { status: 500 }
      );
    }

    // 3. Respuesta exitosa al Frontend
    return NextResponse.json(
      { message: 'Mensaje enviado con éxito', id: data?.id },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error fatal al enviar el correo:', error);
    return NextResponse.json(
      { error: 'Hubo un error del sistema al procesar la solicitud' },
      { status: 500 }
    );
  }
}

