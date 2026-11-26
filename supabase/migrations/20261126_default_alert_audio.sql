-- O som oficial de troca de nível vale para todos os torneios.
alter table public.tournaments alter column alert_audio_path set default 'blind-alert-4bb4b357-141c-4962-8eff-15ad9a484c4a.ogg';
update public.tournaments set alert_audio_path = 'blind-alert-4bb4b357-141c-4962-8eff-15ad9a484c4a.ogg' where coalesce(alert_audio_path, '') = '';
