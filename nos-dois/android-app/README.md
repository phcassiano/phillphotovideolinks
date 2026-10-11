# Nós Dois: APK Android

O APK é uma casca (Capacitor 6) que abre o site publicado no Vercel. Toda melhoria no site aparece no app sem gerar APK novo.

## Gerar o APK (sem instalar nada)
1. No GitHub: **Actions → "Nós Dois: gerar APK Android" → Run workflow**.
2. Em **site_url**, cole o endereço do site no Vercel (ex.: `https://nos-dois.vercel.app`) e confirme.
3. Em uns 5–10 minutos, abra a execução e baixe **nos-dois-apk** em **Artifacts**. Dentro do zip está `nos-dois.apk`.
4. No celular Android: abra o arquivo e permita "instalar apps desconhecidos" quando o Android pedir.

O APK gerado é de teste (assinado com chave de depuração). Para a Play Store é preciso um AAB assinado com chave própria.

## Alternativa: PWABuilder
Em https://www.pwabuilder.com cole o endereço do site → **Package for stores → Android**. Ele gera um pacote assinado pronto para a Play Store (TWA), usando o `manifest.webmanifest` e o `sw.js` do site.
