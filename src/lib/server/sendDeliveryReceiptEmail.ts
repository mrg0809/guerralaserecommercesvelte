import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';
import { getOrderNotificationRecipients } from '$lib/server/orderNotificationRecipients';

const resend = new Resend(RESEND_API_KEY);

export async function sendDeliveryReceiptEmail(opts: {
	customerEmail: string;
	customerName: string;
	deliveryNumber: string;
	pdfBase64: string;
}): Promise<void> {
	const { customerEmail, customerName, deliveryNumber, pdfBase64 } = opts;
	const bccList = await getOrderNotificationRecipients();

	const { error } = await resend.emails.send({
		from: 'Guerra Laser <contacto@guerralaser.com>',
		to: customerEmail,
		bcc: bccList.length > 0 ? bccList : undefined,
		subject: `Acta de entrega ${deliveryNumber} - Guerra Laser`,
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
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1 style="margin: 0;">Guerra Laser</h1>
						<p style="margin: 10px 0 0 0;">Acta de entrega ${deliveryNumber}</p>
					</div>
					<div class="content">
						<p>Hola <strong>${customerName}</strong>,</p>
						<p>Adjunto encontrarás el acta de entrega e instalación <strong>${deliveryNumber}</strong> de tu equipo Guerra Laser.</p>
						<p>Gracias por confiar en nosotros.</p>
						<p>Saludos cordiales,<br><strong>Guerra Laser</strong></p>
					</div>
					<div class="footer">
						<p>Av. Las Torres 5301, Col. Glorias del Colli, Zapopan, Jalisco CP 45010</p>
						<p>Tel: 33 2015 2372 | contacto@guerralaser.com</p>
					</div>
				</div>
			</body>
			</html>
		`,
		attachments: [
			{
				filename: `Acta_Entrega_${deliveryNumber}.pdf`,
				content: pdfBase64
			}
		]
	});

	if (error) {
		throw new Error(error.message);
	}
}
