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

DEB сжимается `gzip`, а не `xz`: пакет получается немного больше, но сборка
требует значительно меньше памяти Docker Desktop.

DEB указывает `gcc-arm-none-eabi` и `arduino-cli` как обязательные системные
зависимости. Перед запуском `lapki-compiler` клиент восстанавливает системный
PATH, поэтому эти команды доступны его процессу.

В Linux- и Windows-пакет включается соответствующий платформе Arduino AVR core
`arduino:avr@1.8.8`. При первом старте он копируется из ресурсов в
`<userData>/arduino-cli/arduino_avr_1.8.8`; клиент передаёт этот путь через
`ARDUINO_DIRECTORIES_DATA` процессу `lapki-compiler`. Для подготовки Linux core
на машине со системным `arduino-cli` используйте:

```bash
npm run prepare:arduino-core:linux
```

Проверка установки и компиляции AVR core в Ubuntu 20.04 x64:

```bash
docker compose -f compose.release.yml run --rm arduino-avr-smoke
```

Перед сборкой очищается внутренний Docker volume с `dist`: финальные артефакты
предыдущего запуска не могут попасть во входные файлы следующей упаковки.

По умолчанию используется Arduino CLI 1.5.1. Для полностью воспроизводимой
сборки перед запуском Compose укажите в `ARDUINO_CLI_URL`, `AVRDUDE_URL`,
`ARM_GCC_URL` и `IRPCB_URL` неизменяемые URL версионированных артефактов.

`dist/` — единственное место для DEB, AppImage и Snap. В обычной локальной
сборке `outputs/` содержит только Windows ZIP. Папка `outputs/seafile-upload`
создаётся только в workflow загрузки в Seafile, поскольку этому action нужен
один общий каталог для отправки файлов.

Linux-пакеты собираются из временной staging-копии проекта без
`resources/modules/win32`, `resources/modules/darwin` и ARM GCC. Это исключает
чужие платформенные модули из Linux-артефактов независимо от glob-правил
`electron-builder`.

В `resources/modules/linux` должны находиться исполняемые файлы
`lapki-compiler/lapki-compiler` и `sm-interpreter`. Скрипт подготовки назначает
им права на выполнение и проверяет наличие `sm-interpreter` в каждом
собранном Linux-пакете.
