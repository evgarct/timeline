# Подключение Form MCP к ChatGPT

Form публикует удалённый Streamable HTTP MCP по адресу:

`https://form.safronov.dev/api/mcp`

Подключение использует OAuth `client_credentials`. Личный MCP-токен выступает как
client secret, привязан к владельцу базы и показывается только один раз.

## Получить доступ

1. Войти в веб-версию Form и открыть Settings.
2. В блоке MCP нажать Create token.
3. Скопировать токен `ft_dev_…` и сохранить его в менеджере секретов. Не вставлять
   его в URL, сообщения или скриншоты.

## Добавить в ChatGPT

1. В веб-версии ChatGPT включить Developer mode.
2. Открыть Settings → Plugins, нажать `+` и создать developer-mode app.
3. Указать имя `Form`, endpoint `https://form.safronov.dev/api/mcp` и транспорт
   Streaming HTTP.
4. Настроить аутентификацию:

   **Вариант А: Автоматическая регистрация (Dynamic Client Registration) — по умолчанию**
   - Сервер публикует `registration_endpoint` в
     `/.well-known/oauth-authorization-server`, поэтому ChatGPT сам
     регистрируется и получает `client_id` — вводить ничего не нужно, просто
     указать Authorization URL и Token URL (см. ниже) и нажать Connect.

   **Вариант Б: Ручной OAuth (Authorization Code + PKCE)**
   - Выбрать тип авторизации **OAuth**.
   - Указать параметры:
     - Client ID: `form-personal`
     - Client Secret: оставить пустым или ввести любой символ (при обмене кодами используется PKCE)
     - Authorization URL: `https://form.safronov.dev/api/mcp/oauth/authorize`
     - Token URL: `https://form.safronov.dev/api/mcp/oauth/token`
   - Во время привязки откроется окно авторизации Form. Если вы авторизованы в браузере, достаточно будет нажать одну кнопку; иначе потребуется ввести личный MCP-токен.

   **Вариант В: Статические учетные данные (Client Credentials)**
   - Выбрать OAuth со статическими credentials:
     - Client ID: `form-personal`
     - Client secret: личный токен `ft_dev_…`

5. Запустить Scan tools и создать app.
6. В новом чате выбрать Developer mode → Form.

## Добавить в Claude

1. В Claude.ai (или Claude Desktop) открыть Settings → Connectors → Add custom connector.
2. Указать endpoint `https://form.safronov.dev/api/mcp`.
3. Claude обнаружит `registration_endpoint` через discovery-документ и
   зарегистрируется автоматически (Dynamic Client Registration) — вводить
   Client ID/Secret не требуется. Далее откроется окно авторизации Form: как и
   с ChatGPT, при активной сессии в браузере достаточно нажать одну кнопку,
   иначе — ввести личный MCP-токен.
4. После подключения нажать Refresh/Reconnect, если инструменты не появились
   сразу.


## Проверка

Начать с read-only запроса:

> Используй только Form. Найди продукт «банан» в моей личной базе и покажи полный
> состав, включая клетчатку, сахар, витамины и минералы. Ничего не добавляй.

Затем проверить запись:

> Используй Form. Я съел один обычный банан сегодня на завтрак. Найди существующий
> продукт и запиши его. Если продукта нет — создай его без выдуманных нутриентов.

После обновления набора инструментов в Form нужно открыть настройки app и нажать
Refresh tools: ChatGPT не подхватывает изменённые tool definitions автоматически.

## Правила распознавания этикетки

- Передавать в Form все читаемые строки этикетки, не только калории и БЖУ.
- Не додумывать отсутствующие значения.
- Сохранять исходные единицы, qualifiers и несколько баз расчёта отдельно.
- Помечать значения как `stated`, `calculated` или `estimated`.
- Фото используется ChatGPT для распознавания, но в Form не сохраняется.

Актуальный интерфейс ChatGPT описан в официальной документации:
https://developers.openai.com/api/docs/guides/developer-mode
