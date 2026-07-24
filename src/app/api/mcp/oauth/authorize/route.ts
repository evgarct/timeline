import { randomBytes } from "node:crypto";
import { getMcpClient, storeMcpToken } from "@/data/repository";
import { getAuthenticatedUserId, getCurrentUserId } from "@/lib/current-user";
import { isNeonAuthConfigured } from "@/lib/auth/server";
import { authenticateMcpToken } from "@/mcp/server";
import { hashToken, signCode } from "@/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getParams(request: Request) {
  const url = new URL(request.url);
  return {
    clientId: url.searchParams.get("client_id"),
    redirectUri: url.searchParams.get("redirect_uri"),
    responseType: url.searchParams.get("response_type"),
    state: url.searchParams.get("state") ?? "",
    codeChallenge: url.searchParams.get("code_challenge") ?? undefined,
    codeChallengeMethod: url.searchParams.get("code_challenge_method") ?? undefined,
  };
}

function isValidClientId(clientId: string | null): boolean {
  if (!clientId) return false;
  if (clientId === "form-personal") return true;
  if (clientId.startsWith("mcp_client_")) return true;
  return clientId.startsWith("https://") || clientId.startsWith("http://");
}

async function fetchCimdRedirectUris(clientIdUrl: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(clientIdUrl, { signal: controller.signal });
    if (!response.ok) return [];
    const doc = (await response.json()) as { redirect_uris?: unknown };
    return Array.isArray(doc.redirect_uris) ? doc.redirect_uris.filter((uri): uri is string => typeof uri === "string") : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

async function getClientDisplayName(clientId: string): Promise<string | undefined> {
  if (clientId === "form-personal") return undefined;
  if (clientId.startsWith("mcp_client_")) {
    const client = await getMcpClient(clientId);
    return client?.clientName ?? (client?.redirectUris[0] ? hostnameOf(client.redirectUris[0]) : undefined);
  }
  if (clientId.startsWith("https://") || clientId.startsWith("http://")) {
    return hostnameOf(clientId);
  }
  return undefined;
}

async function isRedirectUriAllowed(clientId: string, redirectUri: string): Promise<boolean> {
  if (clientId === "form-personal") {
    try {
      return new URL(redirectUri).protocol === "https:";
    } catch {
      return false;
    }
  }
  if (clientId.startsWith("mcp_client_")) {
    const client = await getMcpClient(clientId);
    return !!client && client.redirectUris.includes(redirectUri);
  }
  if (clientId.startsWith("https://") || clientId.startsWith("http://")) {
    const redirectUris = await fetchCimdRedirectUris(clientId);
    return redirectUris.includes(redirectUri);
  }
  return false;
}

function renderHtml({
  userId,
  error,
  state,
  clientName,
}: {
  userId: string | null;
  error?: string;
  state: string;
  clientName?: string;
}) {
  const displayName = clientName ?? "ИИ-ассистента";
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Подключение к ${displayName}</title>
  <style>
    body {
      background-color: #f6f2ec;
      color: #2b2724;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e5dfd9;
      border-radius: 16px;
      padding: 32px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 12px 32px rgba(49, 39, 30, 0.08);
      text-align: center;
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 24px;
      color: #1a1614;
      letter-spacing: -0.5px;
    }
    .title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #1a1614;
    }
    .desc {
      font-size: 14px;
      color: #6e655f;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .error {
      background: #fdf2f2;
      border: 1px solid #fbd5d5;
      color: #9b1c1c;
      font-size: 14px;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      text-align: left;
      display: ${error ? "block" : "none"};
    }
    .divider {
      margin: 24px 0;
      border-top: 1px dashed #e5dfd9;
      position: relative;
    }
    .divider-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ffffff;
      padding: 0 8px;
      font-size: 12px;
      color: #a89e95;
    }
    .form-group {
      text-align: left;
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: #4a423d;
    }
    input[type="text"], input[type="email"] {
      width: 100%;
      padding: 12px;
      border: 1px solid #ccd2d8;
      border-radius: 10px;
      font-size: 14px;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input[type="text"]:focus, input[type="email"]:focus {
      border-color: #1a1614;
      box-shadow: 0 0 0 3px rgba(26, 22, 20, 0.08);
    }
    .btn {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      padding: 12px 24px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 10px;
      cursor: pointer;
      border: none;
      transition: opacity 0.2s, transform 0.1s;
      box-sizing: border-box;
    }
    .btn:active {
      transform: scale(0.99);
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-primary {
      background: #1a1614;
      color: #ffffff;
    }
    .btn-primary:hover {
      opacity: 0.9;
    }
    .btn-secondary {
      background: #f0eae4;
      color: #4a423d;
      border: 1px solid #ccd2d8;
    }
    .btn-secondary:hover {
      background: #e8e1da;
    }
    .user-badge {
      display: inline-flex;
      align-items: center;
      background: #f0eae4;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 16px;
      color: #4a423d;
    }
    .footer {
      font-size: 12px;
      color: #8c8178;
      margin-top: 24px;
    }
    .footer a {
      color: #1a1614;
      text-decoration: underline;
      cursor: pointer;
    }
    .btn-group {
      display: flex;
      gap: 8px;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">✦ Timeline</div>
    <div class="title">Подключение к ${displayName}</div>
    <p class="desc">Разрешить ${displayName} доступ к вашей персональной базе данных продуктов и питания через MCP.</p>
    
    <div id="error-div" class="error">${error || ""}</div>

    <!-- Active Session View -->
    <div id="session-view" style="display: ${userId ? "block" : "none"};">
      <div class="user-badge" id="user-badge-text">Вы вошли как: ${userId || ""}</div>
      <form method="POST">
        <input type="hidden" name="action" value="auto_authorize">
        <button type="submit" class="btn btn-primary">Подтвердить подключение</button>
      </form>
      <div class="footer">
        <a onclick="showManualView()">Использовать другой токен вручную</a>
      </div>
    </div>

    <!-- Login View -->
    <div id="login-view" style="display: ${!userId ? "block" : "none"};">
      <form id="login-form" onsubmit="handleLoginSubmit(event)">
        <div id="email-group" class="form-group">
          <label for="email-field">Электронная почта</label>
          <input type="email" id="email-field" placeholder="you@example.com" required>
        </div>
        <div id="otp-group" class="form-group" style="display: none;">
          <label for="otp-field">Код подтверждения из письма</label>
          <input type="text" id="otp-field" placeholder="123456" minlength="6" maxlength="8">
        </div>
        <div class="btn-group">
          <button type="button" id="back-btn" class="btn btn-secondary" style="display: none; flex: 1;" onclick="goToEmailStep()">Назад</button>
          <button type="submit" id="primary-btn" class="btn btn-primary" style="flex: 2;">Получить код</button>
        </div>
      </form>
      <div class="footer">
        Нужен ручной ввод? <a onclick="showManualView()">Войти по токену</a>
      </div>
    </div>

    <!-- Manual Token View -->
    <div id="manual-view" style="display: none;">
      <form method="POST">
        <input type="hidden" name="action" value="manual_token">
        <div class="form-group">
          <label for="token-field">Персональный токен MCP</label>
          <input type="text" id="token-field" name="token" placeholder="ft_dev_..." required>
        </div>
        <button type="submit" class="btn btn-primary">Авторизовать по токену</button>
      </form>
      <div class="footer">
        <a onclick="goBackFromManual()">Вернуться к быстрому входу</a>
      </div>
    </div>
  </div>

  <script>
    const isNeonAuthConfigured = ${isNeonAuthConfigured};
    let currentStep = "email";
    
    const emailField = document.getElementById("email-field");
    const otpField = document.getElementById("otp-field");
    const emailGroup = document.getElementById("email-group");
    const otpGroup = document.getElementById("otp-group");
    const primaryBtn = document.getElementById("primary-btn");
    const backBtn = document.getElementById("back-btn");
    const errorDiv = document.getElementById("error-div");
    
    const sessionView = document.getElementById("session-view");
    const loginView = document.getElementById("login-view");
    const manualView = document.getElementById("manual-view");

    function showError(msg) {
      errorDiv.textContent = msg;
      errorDiv.style.display = "block";
    }

    function clearError() {
      errorDiv.style.display = "none";
    }

    function showManualView() {
      clearError();
      sessionView.style.display = "none";
      loginView.style.display = "none";
      manualView.style.display = "block";
    }

    function goBackFromManual() {
      clearError();
      manualView.style.display = "none";
      const hasSession = ${userId ? "true" : "false"};
      if (hasSession) {
        sessionView.style.display = "block";
      } else {
        loginView.style.display = "block";
      }
    }

    function goToEmailStep() {
      clearError();
      currentStep = "email";
      emailGroup.style.display = "block";
      otpGroup.style.display = "none";
      backBtn.style.display = "none";
      primaryBtn.textContent = "Получить код";
      otpField.required = false;
    }

    async function handleLoginSubmit(e) {
      e.preventDefault();
      clearError();
      const email = emailField.value.trim();

      if (!isNeonAuthConfigured) {
        // Local/Demo Mode Bypass
        if (currentStep === "email") {
          currentStep = "otp";
          emailGroup.style.display = "none";
          otpGroup.style.display = "block";
          backBtn.style.display = "inline-flex";
          primaryBtn.textContent = "Войти и подключить (Демо)";
          otpField.required = true;
          otpField.value = "123456";
          otpField.focus();
        } else {
          submitAutoAuthorize();
        }
        return;
      }

      if (currentStep === "email") {
        if (!email) return;
        primaryBtn.disabled = true;
        primaryBtn.textContent = "Отправка...";
        try {
          const res = await fetch("/api/auth/email-otp/send-verification-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, type: "sign-in" })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message || "Ошибка при отправке кода.");
          
          currentStep = "otp";
          emailGroup.style.display = "none";
          otpGroup.style.display = "block";
          backBtn.style.display = "inline-flex";
          primaryBtn.textContent = "Войти и подключить";
          otpField.required = true;
          otpField.focus();
        } catch (err) {
          showError(err.message);
        } finally {
          primaryBtn.disabled = false;
        }
      } else if (currentStep === "otp") {
        const otp = otpField.value.trim();
        if (!otp) return;
        primaryBtn.disabled = true;
        primaryBtn.textContent = "Вход...";
        try {
          const res = await fetch("/api/auth/sign-in/email-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message || "Неверный код.");
          
          // Successful login - trigger auth code generation
          submitAutoAuthorize();
        } catch (err) {
          showError(err.message);
        } finally {
          primaryBtn.disabled = false;
        }
      }
    }

    function submitAutoAuthorize() {
      const submitForm = document.createElement("form");
      submitForm.method = "POST";
      const actionInput = document.createElement("input");
      actionInput.type = "hidden";
      actionInput.name = "action";
      actionInput.value = "auto_authorize";
      submitForm.appendChild(actionInput);
      document.body.appendChild(submitForm);
      submitForm.submit();
    }
  </script>
</body>
</html>`;
}

export async function GET(request: Request) {
  const { clientId, redirectUri, responseType, state } = getParams(request);

  if (!isValidClientId(clientId)) {
    return new Response("Invalid client_id", { status: 400 });
  }
  if (!redirectUri) {
    return new Response("Missing redirect_uri", { status: 400 });
  }
  if (responseType !== "code") {
    return new Response("Unsupported response_type. Only 'code' is supported.", { status: 400 });
  }
  if (!(await isRedirectUriAllowed(clientId as string, redirectUri))) {
    return new Response("Invalid redirect_uri for this client_id", { status: 400 });
  }

  const userId = isNeonAuthConfigured ? await getAuthenticatedUserId() : "demo-user";
  const clientName = await getClientDisplayName(clientId as string);

  return new Response(renderHtml({ userId, state, clientName }), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const { clientId, redirectUri, responseType, state, codeChallenge, codeChallengeMethod } = getParams(request);

  if (!isValidClientId(clientId) || !redirectUri || responseType !== "code") {
    return new Response("Invalid OAuth request parameters", { status: 400 });
  }
  if (!(await isRedirectUriAllowed(clientId as string, redirectUri))) {
    return new Response("Invalid redirect_uri for this client_id", { status: 400 });
  }

  const userId = isNeonAuthConfigured ? await getAuthenticatedUserId() : "demo-user";
  const clientName = await getClientDisplayName(clientId as string);
  const formData = await request.formData();
  const action = formData.get("action");

  let token = "";

  if (action === "auto_authorize") {
    if (!userId) {
      return new Response(
        renderHtml({ userId, error: "Сессия истекла. Пожалуйста, авторизуйтесь по токену вручную.", state, clientName }),
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    // Generate new personal token
    token = `ft_dev_${randomBytes(24).toString("base64url")}`;
    await storeMcpToken(userId, hashToken(token));
  } else if (action === "manual_token") {
    const inputToken = String(formData.get("token") ?? "").trim();
    const tokenUserId = await authenticateMcpToken(inputToken);
    if (!tokenUserId) {
      return new Response(
        renderHtml({ userId, error: "Неверный токен. Пожалуйста, скопируйте корректный токен из настроек.", state, clientName }),
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    token = inputToken;
  } else {
    return new Response("Invalid action", { status: 400 });
  }

  // Create signed code containing authorization details
  const expiresAt = Date.now() + 5 * 60 * 1000; // Code expires in 5 minutes
  const authCode = signCode({
    token,
    expiresAt,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", authCode);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  return Response.redirect(redirectUrl.toString(), 302);
}
