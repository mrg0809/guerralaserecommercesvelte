# 📧 Configuración de Envío de Cotizaciones por Email

El botón "Enviar por Email" está implementado pero requiere configurar un servicio de email.

## 🎯 Opciones de Servicios de Email

### Opción 1: Resend (Recomendado - Más fácil)

**Ventajas:**
- API simple y moderna
- 100 emails gratis al día
- Excelente para desarrollo

**Pasos:**

1. **Crear cuenta en Resend:**
   - Ve a https://resend.com
   - Crea una cuenta gratuita
   - Verifica tu dominio (o usa el sandbox para pruebas)

2. **Obtener API Key:**
   - Dashboard → API Keys → Create API Key
   - Copia la key

3. **Configurar en tu proyecto:**
   ```bash
   npm install resend
   ```

4. **Crear archivo `.env` en la raíz:**
   ```env
   RESEND_API_KEY=re_tu_api_key_aqui
   ```

5. **Actualizar `src/routes/api/send-quotation/+server.ts`:**
   ```typescript
   import { json } from '@sveltejs/kit';
   import { Resend } from 'resend';
   import { RESEND_API_KEY } from '$env/static/private';
   
   const resend = new Resend(RESEND_API_KEY);
   
   export const POST = async ({ request }) => {
       const { customerEmail, customerName, pdfData, quotationNumber } = await request.json();
       
       const { data, error } = await resend.emails.send({
           from: 'Cotizaciones <onboarding@resend.dev>', // Cambiar cuando tengas dominio verificado
           to: customerEmail,
           subject: `Cotización ${quotationNumber} - Guerra Laser México`,
           html: `
               <h2>¡Gracias por tu interés!</h2>
               <p>Hola ${customerName},</p>
               <p>Adjunto encontrarás la cotización ${quotationNumber} que solicitaste.</p>
               <p>La cotización tiene una vigencia de 15 días.</p>
               <br>
               <p><strong>Datos de contacto:</strong></p>
               <p>Tel: 33 2015 2372<br>
               Cel: 33 3475 8653 | 33 1864 0008<br>
               Email: contacto@guerralaser.com</p>
               <br>
               <p>Saludos,<br>Guerra Laser México</p>
           `,
           attachments: [{
               filename: `Cotizacion_${quotationNumber}.pdf`,
               content: pdfData
           }]
       });
       
       if (error) {
           return json({ error: error.message }, { status: 500 });
       }
       
       return json({ success: true, id: data?.id });
   };
   ```

---

### Opción 2: Gmail/SMTP con Nodemailer

**Ventajas:**
- Gratis si usas tu propio email
- No requiere servicios externos

**Pasos:**

1. **Instalar dependencia:**
   ```bash
   npm install nodemailer
   ```

2. **Configurar Gmail:**
   - Ve a tu cuenta de Google → Seguridad
   - Habilita "Verificación en 2 pasos"
   - Genera una "Contraseña de aplicación"

3. **Crear `.env`:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=tu-email@gmail.com
   SMTP_PASS=tu-contraseña-de-aplicacion
   ```

4. **Actualizar `src/routes/api/send-quotation/+server.ts`:**
   ```typescript
   import { json } from '@sveltejs/kit';
   import nodemailer from 'nodemailer';
   import {
       SMTP_HOST,
       SMTP_PORT,
       SMTP_USER,
       SMTP_PASS
   } from '$env/static/private';
   
   export const POST = async ({ request }) => {
       const { customerEmail, customerName, pdfData, quotationNumber } = await request.json();
       
       const transporter = nodemailer.createTransport({
           host: SMTP_HOST,
           port: parseInt(SMTP_PORT),
           secure: false,
           auth: {
               user: SMTP_USER,
               pass: SMTP_PASS
           }
       });
       
       const pdfBuffer = Buffer.from(pdfData, 'base64');
       
       const info = await transporter.sendMail({
           from: `"Guerra Laser México" <${SMTP_USER}>`,
           to: customerEmail,
           subject: `Cotización ${quotationNumber} - Guerra Laser México`,
           html: `
               <h2>¡Gracias por tu interés!</h2>
               <p>Hola ${customerName},</p>
               <p>Adjunto encontrarás la cotización ${quotationNumber} que solicitaste.</p>
               <p>La cotización tiene una vigencia de 15 días.</p>
               <br>
               <p>Saludos,<br>Guerra Laser México</p>
           `,
           attachments: [{
               filename: `Cotizacion_${quotationNumber}.pdf`,
               content: pdfBuffer
           }]
       });
       
       return json({ success: true, messageId: info.messageId });
   };
   ```

---

### Opción 3: SendGrid

**Ventajas:**
- 100 emails gratis al día
- Muy confiable

**Pasos:**

1. **Instalar:**
   ```bash
   npm install @sendgrid/mail
   ```

2. **Configurar `.env`:**
   ```env
   SENDGRID_API_KEY=tu_api_key
   ```

3. **Actualizar endpoint:**
   ```typescript
   import { json } from '@sveltejs/kit';
   import sgMail from '@sendgrid/mail';
   import { SENDGRID_API_KEY } from '$env/static/private';
   
   sgMail.setApiKey(SENDGRID_API_KEY);
   
   export const POST = async ({ request }) => {
       const { customerEmail, customerName, pdfData, quotationNumber } = await request.json();
       
       const msg = {
           to: customerEmail,
           from: 'contacto@guerralaser.com', // Verificar en SendGrid
           subject: `Cotización ${quotationNumber} - Guerra Laser México`,
           html: `<p>Hola ${customerName},</p><p>Adjunto tu cotización.</p>`,
           attachments: [{
               content: pdfData,
               filename: `Cotizacion_${quotationNumber}.pdf`,
               type: 'application/pdf',
               disposition: 'attachment'
           }]
       };
       
       await sgMail.send(msg);
       return json({ success: true });
   };
   ```

---

## 🚀 Pruebas

Una vez configurado cualquier servicio:

1. Abre `/admin/cotizaciones`
2. Llena los datos del cliente (incluyendo email)
3. Agrega productos
4. Click en "📧 Enviar por Email"
5. El PDF se enviará automáticamente

## 🔐 Seguridad

- ✅ Las API keys están en variables de entorno (no en el código)
- ✅ El endpoint solo es accesible para usuarios autenticados
- ✅ Valida que el email sea válido antes de enviar

## 📝 Notas

- El botón se deshabilita si no hay email de cliente
- Puedes enviar sin guardar en BD (envía borrador)
- El PDF se genera en el servidor para mayor seguridad
- En desarrollo, Resend permite enviar sin verificar dominio

---

**Recomendación:** Usa Resend para empezar, es la opción más simple y moderna.
