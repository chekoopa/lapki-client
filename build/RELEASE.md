# Сборка релиза через Docker

```bash
git submodule update --init --checkout --recursive
npm run release:docker
```

Команда создаёт содержимое `dist/` и `outputs/` так же, как Linux/Windows-часть
ручных release-workflow. Она не публикует артефакты и не собирает macOS-версию.

Docker Compose сохраняет скачанные архивы зависимостей в именованном volume
`release-download-cache`. При повторном запуске они не загружаются заново.
Также кешируются Electron и electron-builder, а `node_modules`, `out`, `dist` и
`outputs` создаются внутри Linux volume. По окончании успешной сборки готовые
`dist/` и `outputs/` копируются в рабочую папку Windows.
Удалить кеш можно командой:

```bash
docker volume ls --filter name=release-download-cache
docker volume rm <имя_тома_из_предыдущей_команды>
```

По умолчанию Linux-форматы собираются последовательно: AppImage, Snap и DEB.
Это снижает пиковое потребление памяти. Для локальной проверки только DEB:

```bash
$env:RELEASE_LINUX_TARGETS = 'deb' # PowerShell
npm run release:docker
```

По умолчанию используется Arduino CLI 1.5.1. Для полностью воспроизводимой
сборки перед запуском Compose укажите в `ARDUINO_CLI_URL`, `AVRDUDE_URL`,
`ARM_GCC_URL` и `IRPCB_URL` неизменяемые URL версионированных артефактов.
