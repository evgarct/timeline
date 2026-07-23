import { randomBytes } from "node:crypto";
import { storeMcpToken } from "@/data/repository";
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

function renderHtml({
  userId,
  error,
  state,
}: {
  userId: string | null;
  error?: string;
  state: string;
}) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Подключение к ChatGPT</title>
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
    input[type="text"] {
      width: 100%;
      padding: 12px;
      border: 1px solid #ccd2d8;
      border-radius: 10px;
      font-size: 14px;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input[type="text"]:focus {
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
    }
    .btn:active {
      transform: scale(0.99);
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
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">✦ Timeline</div>
    <div class="title">Подключение к ChatGPT</div>
    <p class="desc">Разрешить ChatGPT доступ к вашей персональной базе данных продуктов и питания через MCP.</p>
    
    ${error ? `<div class="error">${error}</div>` : ""}

    ${userId ? `
      <div class="user-badge">Вы вошли как: ${userId}</div>
      <form method="POST">
        <input type="hidden" name="action" value="auto_authorize">
        <button type="submit" class="btn btn-primary" style="margin-bottom: 8px;">Разрешить доступ автоматически</button>
      </form>
      <div class="divider">
        <span class="divider-text">Или введите токен вручную</span>
      </div>
    ` : ""}

    <form method="POST">
      <input type="hidden" name="action" value="manual_token">
      <div class="form-group">
        <label for="token">Персональный токен MCP</label>
        <input type="text" id="token" name="token" placeholder="ft_dev_..." required>
      </div>
      <button type="submit" class="btn ${userId ? 'btn-secondary' : 'btn-primary'}">Авторизовать по токену</button>
    </form>
    
    <div class="footer">
      Как получить токен? Откройте приложение Form, перейдите в <b>Settings → MCP</b> и нажмите <b>Create token</b>.
    </div>
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  const { clientId, redirectUri, responseType, state } = getParams(request);

  if (clientId !== "form-personal") {
    return new Response("Invalid client_id", { status: 400 });
  }
  if (!redirectUri) {
    return new Response("Missing redirect_uri", { status: 400 });
  }
  if (responseType !== "code") {
    return new Response("Unsupported response_type. Only 'code' is supported.", { status: 400 });
  }

  const userId = isNeonAuthConfigured ? await getAuthenticatedUserId() : "demo-user";

  return new Response(renderHtml({ userId, state }), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const { clientId, redirectUri, responseType, state, codeChallenge, codeChallengeMethod } = getParams(request);

  if (clientId !== "form-personal" || !redirectUri || responseType !== "code") {
    return new Response("Invalid OAuth request parameters", { status: 400 });
  }

  const userId = isNeonAuthConfigured ? await getAuthenticatedUserId() : "demo-user";
  const formData = await request.formData();
  const action = formData.get("action");

  let token = "";

  if (action === "auto_authorize") {
    if (!userId) {
      return new Response(
        renderHtml({ userId, error: "Сессия истекла. Пожалуйста, авторизуйтесь по токену вручную.", state }),
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
        renderHtml({ userId, error: "Неверный токен. Пожалуйста, скопируйте корректный токен из настроек.", state }),
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
