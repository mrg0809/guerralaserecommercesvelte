-- Configuración del banner hero de la página de inicio
insert into public.admin_settings (setting_key, setting_value, description)
values (
	'hero_banner',
	'{"media_type":"video","desktop_url":"bannerpagina.mp4","mobile_media_type":"image","mobile_url":"","title":"ESPECIALISTAS EN VENTA DE MAQUINARIA","subtitle":"En corte de metales, corte laser co2, fibra óptica, plasma, router, etc.","show_overlay_text":true}',
	'Banner principal de la página de inicio (tipo, media desktop/móvil, textos)'
)
on conflict (setting_key) do nothing;
