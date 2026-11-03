-- 0031: concorrente com site bom — 02/11/2026.
--
-- Na busca do exterior, o Google já traz, no mesmo nicho e na mesma cidade,
-- negócios com site bom (nota alta). O melhor deles é guardado em cada lead
-- novo daquela página: o e-mail pode citar que o vizinho já está na frente
-- ("I noticed [concorrente] nearby has a modern website..."). Dado real da
-- busca, nada inventado.
--
-- concorrente: { nome, site, nota, avaliacoes }

alter table leads add column if not exists concorrente jsonb;
