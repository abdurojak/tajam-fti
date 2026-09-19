type Environment = Record<string, string | undefined>;
export function isHosted(env: Environment = process.env) {
  return (
    env.NETLIFY === "true" ||
    !!env.AWS_LAMBDA_FUNCTION_NAME ||
    env.VERCEL === "1"
  );
}
export function databaseMode(
  env: Environment = process.env,
): "postgres" | "sqlite" {
  if (env.DATABASE_URL?.trim()) return "postgres";
  if (isHosted(env))
    throw new Error("DATABASE_URL wajib diatur untuk deployment online.");
  return "sqlite";
}
