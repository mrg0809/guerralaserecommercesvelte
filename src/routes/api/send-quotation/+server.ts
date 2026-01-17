import { json } from '@sveltejs/kit';
import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const resend = new Resend(RESEND_API_KEY);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { customerEmail, customerName, pdfData, quotationNumber, validityDays } = await request.json();

		if (!customerEmail) {
			return json({ error: 'Email del cliente es requerido' }, { status: 400 });
		}

		const { data, error } = await resend.emails.send({
			from: 'Guerra Laser <contacto@guerralaser.com>',
			to: customerEmail,
			subject: `Cotización ${quotationNumber} - Guerra Laser`,
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<style>
						body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
						.container { max-width: 600px; margin: 0 auto; padding: 20px; }
						.header { background: linear-gradient(135deg, #DC2626 0%, #2563EB 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
						.content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
						.footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6b7280; }
						.highlight { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
						.contact-info { background: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
						.contact-info strong { color: #1e40af; }
					</style>
				</head>
				<body>
					<div class="container">
						<div class="header">
							<h1 style="margin: 0;">Guerra Laser</h1>
							<p style="margin: 10px 0 0 0;">Cotización ${quotationNumber}</p>
						</div>
						
						<div class="content">
							<h2>¡Gracias por tu interés!</h2>
							<p>Hola <strong>${customerName}</strong>,</p>
							
							<p>Adjunto encontrarás la cotización <strong>${quotationNumber}</strong> que solicitaste.</p>
							
							<div class="highlight">
								<strong>⏰ Vigencia:</strong> Esta cotización tiene una validez de <strong>${validityDays || 15} días</strong> a partir de la fecha de emisión.
							</div>
							
							<p>Por favor revisa los detalles en el PDF adjunto. Si tienes alguna duda o requieres modificaciones, no dudes en contactarnos.</p>
							
							<div class="contact-info">
								<strong>📞 Datos de contacto:</strong><br>
								Tel: <a href="tel:+523320152372">33 2015 2372</a><br>
								Cel: <a href="tel:+523334758653">33 3475 8653</a> | <a href="tel:+523318640008">33 1864 0008</a><br>
								Email: <a href="mailto:contacto@guerralaser.com">contacto@guerralaser.com</a><br>
								<br>
								<strong>📍 Dirección:</strong><br>
								Av. Las Torres 5301, Col. Glorias del Colli<br>
								Zapopan, Jalisco CP 45010
							</div>
							
							<p>Esperamos poder servirte pronto.</p>
							
							<p>Saludos cordiales,<br>
							<strong>Guerra Laser</strong></p>
						</div>
						
						<div class="footer">
							<p>Este es un correo automático, por favor no respondas a este mensaje.</p>
							<p>Para cualquier consulta, escríbenos a <a href="mailto:contacto@guerralaser.com">contacto@guerralaser.com</a></p>
						</div>
					</div>
				</body>
				</html>
			`,
			attachments: [{
				filename: `Cotizacion_${quotationNumber}.pdf`,
				content: pdfData
			}]
		});

		if (error) {
			console.error('Error enviando email con Resend:', error);
			return json({ error: error.message }, { status: 500 });
		}

		return json({ success: true, id: data?.id });
	} catch (error) {
		console.error('Error enviando email:', error);
		return json({ error: 'Error enviando email' }, { status: 500 });
	}
};
