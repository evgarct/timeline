# Android Device Connection & Debugging Runbook

Этот документ описывает полный процесс подключения к физическому смартфону (Google Pixel на Android 14+), сборки, установки, отладки Health Connect, инспекции UI и логирования.

---

## 1. Параметры окружения на Windows хосте

На хост-машине (Windows PowerShell) Java и Android SDK установлены через Scoop:
- **Java Home:** `$HOME\scoop\apps\openjdk21\current` (OpenJDK 21)
- **Android SDK:** `$HOME\scoop\apps\android-clt\current`
- **ADB / Platform-tools:** `$HOME\scoop\apps\android-clt\current\platform-tools`
- **Gradle Wrapper:** `c:\Projects\Form\android\gradlew.bat`

Перед вызовом `adb` или `gradlew` в сессии PowerShell необходимо инициализировать переменные:

```powershell
$env:JAVA_HOME = "$HOME\scoop\apps\openjdk21\current"
$env:ANDROID_HOME = "$HOME\scoop\apps\android-clt\current"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
```

---

## 2. Подключение к смартфону Google Pixel

Поддерживаются два режима: **Wi-Fi (Wireless Debugging)** и **USB**.

### Способ А: Беспроводная отладка (Wireless Debugging)

Смартфон и компьютер должны быть в одной локальной сети Wi-Fi (например, подсеть `192.168.0.x`).

1. **Включение на телефоне:**
   - *Настройки -> Для разработчиков -> Беспроводная отладка (Wireless debugging)* — включить переключатель.
2. **Первичное сопряжение (Pairing):**
   - На телефоне нажать *«Подключить устройство с помощью кода подключения»*.
   - Появится диалог с IP-адресом, **портом сопряжения** (например, `192.168.0.152:40293`) и 6-значным кодом (например, `143816`).
   - В терминале выполнить:
     ```powershell
     adb pair 192.168.0.152:<порт_сопряжения> <код>
     # Пример: adb pair 192.168.0.152:40293 143816
     ```
   - Должно появиться: `Successfully paired to 192.168.0.152:...`.
3. **Подключение (Connect):**
   - Вернуться на главный экран беспроводной отладки на телефоне.
   - Посмотреть порт в строке *«IP-адрес и порт»* (он отличается от порта сопряжения! Например, `192.168.0.152:40749`).
   - В терминале выполнить:
     ```powershell
     adb connect 192.168.0.152:<порт_подключения>
     # Пример: adb connect 192.168.0.152:40749
     ```
   - Должно появиться: `connected to 192.168.0.152:...`.
4. **Проверка подключения и mDNS:**
   - Выполнить `adb devices`.
   - В списке отобразится устройство либо по IP:
     `192.168.0.152:40749 device`
     либо через автообнаружение mDNS:
     `adb-66241FDDV001RS-fERMma._adb-tls-connect._tcp device`.

### Способ Б: Отладка по USB

1. Подключить Pixel кабелем USB-C к компьютеру.
2. В *«Настройки -> Для разработчиков»* включить *«Отладка по USB»*.
3. На экране смартфона подтвердить диалог доверия компьютеру (*«Разрешать всегда с этого компьютера»*).
4. Проверить `adb devices` — появится серийный номер Pixel со статусом `device`.

---

## 3. Сборка и установка приложения

Все команды сборки выполняются из каталога `c:\Projects\Form\android`:

```powershell
cd c:\Projects\Form\android

# 1. Запуск модульных тестов
.\gradlew.bat testDebugUnitTest

# 2. Сборка отладочного APK
.\gradlew.bat assembleDebug

# 3. Установка на конкретное устройство
adb -s <DEVICE_ID> install -r app\build\outputs\apk\debug\app-debug.apk
# Либо через задачу Gradle:
.\gradlew.bat installDebug
```

> **Где взять `<DEVICE_ID>`:** из вывода `adb devices`. Если подключено ровно одно устройство, ключ `-s <DEVICE_ID>` можно опускать.

---

## 4. Управление жизненным циклом приложения

- **Идентификатор пакета:** `com.evgarct.form`
- **Главная Activity:** `com.evgarct.form.MainActivity`

```powershell
# Запуск приложения
adb -s <DEVICE_ID> shell am start -n com.evgarct.form/.MainActivity

# Принудительная остановка (kill)
adb -s <DEVICE_ID> shell am force-stop com.evgarct.form

# Очистка локального кэша и состояния (полный сброс)
adb -s <DEVICE_ID> shell pm clear com.evgarct.form
```

---

## 5. Визуальный контроль, скриншоты и инспекция UI

Для верификации без ручного взаимодействия используются встроенные средства Android:

### Снятие скриншота экрана:
```powershell
adb -s <DEVICE_ID> shell screencap -p /data/local/tmp/screen.png
adb -s <DEVICE_ID> pull /data/local/tmp/screen.png .\screen.png
```

### Дамп иерархии UI (дерево элементов и координаты):
```powershell
adb -s <DEVICE_ID> shell uiautomator dump /data/local/tmp/window_dump.xml
adb -s <DEVICE_ID> pull /data/local/tmp/window_dump.xml .\ui_dump.xml
```
В файле `ui_dump.xml` содержатся точные границы элементов `bounds="[left,top][right,bottom]"` и атрибуты `content-desc`, `text`, `clickable`.

> **Не пересчитывать координаты для тапа со скриншота на глаз** (масштаб превью почти всегда отличается от реального разрешения экрана, и таб-бар/иконки легко промахнуть). Вместо этого сразу делать `uiautomator dump`, находить нужный `bounds` по `text`/`content-desc` и тапать в центр этого прямоугольника — так координаты точны с первого раза.

### Эмуляция нажатий и жестов:
```powershell
# Нажатие по координатам (X, Y)
adb -s <DEVICE_ID> shell input tap 540 1800

# Свайп / прокрутка снизу вверх (X1 Y1 X2 Y2 duration_ms)
adb -s <DEVICE_ID> shell input swipe 540 1800 540 600 300

# Нажатие системной кнопки Назад (Back)
adb -s <DEVICE_ID> shell input keyevent 4

# Нажатие кнопки Домой (Home)
adb -s <DEVICE_ID> shell input keyevent 3
```

---

## 6. Отладка Health Connect (шаги, активность, тренировки)

На Android 14+ Health Connect является системной службой ОС:

### Обязательные требования манифеста
Приложению требуются разрешения:
- `android.permission.health.READ_STEPS`
- `android.permission.health.READ_EXERCISE`

А также интент-фильтры в `AndroidManifest.xml` для activity/alias rationale:
```xml
<activity-alias
    android:name=".HealthPermissionsRationaleActivity"
    android:exported="true"
    android:targetActivity=".MainActivity"
    android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
    <intent-filter>
        <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
        <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
    </intent-filter>
    <intent-filter>
        <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
    </intent-filter>
</activity-alias>
```
*Без фильтра `android.intent.action.VIEW_PERMISSION_USAGE` система выдает `App should support rationale intent, finishing!` и отклоняет запрос прав.*

### Выдача разрешений через ADB напрямую (для автоматических тестов):
```powershell
adb -s <DEVICE_ID> shell pm grant com.evgarct.form android.permission.health.READ_STEPS
adb -s <DEVICE_ID> shell pm grant com.evgarct.form android.permission.health.READ_EXERCISE
```

### Открытие настроек Health Connect:
```powershell
adb -s <DEVICE_ID> shell am start -a androidx.health.ACTION_HEALTH_CONNECT_SETTINGS
```

---

## 7. Чтение логов (Logcat)

Для просмотра runtime-ошибок и логов приложения:

```powershell
# Фильтр по тегам приложения и крашам
adb -s <DEVICE_ID> logcat -v time -s FormApp:* ActivityDetail:* HealthConnect:* AndroidRuntime:E

# Очистка буфера логов перед тестом
adb -s <DEVICE_ID> logcat -c
```

---

## 8. Известные особенности и грабли

1. **Оверлей системного баннера отладки по Wi-Fi:**
   - На Pixel при активной отладке по Wi-Fi отображается всплывающее heads-up уведомление *«Wireless debugging connected • now»*.
   - Оно перекрывает верхнюю область экрана (`y = 0..230px`), из-за чего клики по верхним кнопкам тулбара (закрытие, шеринг) могут перехватываться баннером.
   - **Решение:** либо свайпнуть уведомление вверх (`input swipe 540 150 540 50 100`), либо нажимать кнопки ниже границы (`y ≈ 250..270px`).

2. **Динамические порты при каждом переподключении:**
   - При выключении/включении беспроводной отладки в Android порт меняется. Если `adb devices` показывает `offline` или потеря связи, нужно посмотреть актуальный порт в настройках разработчика и переподключиться `adb connect 192.168.0.152:<новый_порт>`.

3. **Расчет высоты первого экрана (Scaffold + BottomBar в Compose):**
   - Не использовать `LocalConfiguration.current.screenHeightDp.dp` для полноэкранного первого экрана, так как он не учитывает нижний бар и сдвигает нижнюю капсулу за пределы экрана.
   - Использовать `BoxWithConstraints` и `maxHeight` для точного позиционирования капсулы прямо над нижней панелью навигации.

4. **Посторонние push-уведомления перехватывают тап во время автотеста:**
   - Любое heads-up уведомление от другого приложения на телефоне (Telegram, Gmail и т.п.) может всплыть поверх Form ровно в момент `adb shell input tap` и перехватить нажатие — внешне это выглядит как переход в другое приложение или "приложение не отреагировало".
   - **Диагностика:** сразу после неожиданного результата выполнить `adb shell dumpsys activity activities | grep topResumedActivity` — если там всё ещё `com.evgarct.form/.MainActivity`, значит Form не падало и не переключалось, а тап просто попал в баннер поверх него.
   - **Решение:** сделать `adb shell input keyevent 4` (Back), чтобы закрыть баннер, и повторить тап; при повторяющихся помехах на реальном устройстве отключить уведомления тестового профиля на время сессии.

5. **`adb pull` с путём `/sdcard/...` из Git Bash на Windows:**
   - Git Bash подменяет ведущий `/sdcard/...` на путь вида `C:/Program Files/Git/sdcard/...`, из-за чего `adb pull /sdcard/file` не находит файл на устройстве.
   - **Решение:** писать `screencap`/`uiautomator dump` сразу в `/data/local/tmp/` (не путь Git Bash), либо для одноразовых случаев экранировать двойным слешем — `adb pull //sdcard/file.xml .`.
