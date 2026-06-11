import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { BackendEnv } from "../config/env";

interface ForgotPasswordBody {
  phone?: string;
}

interface GenerateLinkProperties {
  action_link: string | null;
}

interface GenerateLinkResponse {
  properties: GenerateLinkProperties | null;
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function extractTokensFromActionLink(actionLink: string): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  const parsed = new URL(actionLink);
  const query = parsed.searchParams;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));

  return {
    accessToken: query.get("access_token") || hash.get("access_token"),
    refreshToken: query.get("refresh_token") || hash.get("refresh_token"),
  };
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  env: BackendEnv,
): Promise<void> {
  app.post(
    "/api/auth/forgot-password",
    async (
      request: FastifyRequest<{ Body: ForgotPasswordBody }>,
      reply: FastifyReply,
    ) => {
      if (!env.supabaseServiceRoleKey || !app.supabase.admin) {
        return reply.status(500).send({
          error: "SUPABASE_SERVICE_ROLE_KEY is required for password reset",
        });
      }

      const phone = normalizePhone(request.body?.phone ?? "");
      if (!phone || phone.length < 8) {
        return reply.status(400).send({ error: "INVALID_PHONE" });
      }

      const { data, error } = await app.supabase.anon.rpc("find_user_by_phone", {
        phone_input: phone,
      });

      const email = data?.[0]?.email as string | undefined;
      if (error || !email) {
        return reply
          .status(404)
          .send({ error: "No account found for this phone number" });
      }

      const redirectTo = `${request.protocol}://${request.headers.host}/reset-password`;
      const { data: linkData, error: linkError } =
        await app.supabase.admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo,
          },
        });

      if (linkError) {
        app.log.error({ err: linkError });
        return reply
          .status(500)
          .send({ error: "Failed to generate password reset link" });
      }

      const generated = linkData as GenerateLinkResponse;
      const actionLink = generated?.properties?.action_link;
      if (!actionLink) {
        return reply
          .status(500)
          .send({ error: "Password reset link is missing in provider response" });
      }

      const { accessToken, refreshToken } = extractTokensFromActionLink(actionLink);
      if (!accessToken || !refreshToken) {
        return reply
          .status(500)
          .send({ error: "Password reset token is missing in generated link" });
      }

      return reply.send({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    },
  );
}

