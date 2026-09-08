import ConnectSearchConsole from "@/components/seo/ConnectSearchConsole";

export default function ConnectSeoPage() {
  return <ConnectSearchConsole serviceAccountEmail={process.env.GOOGLE_SC_SERVICE_ACCOUNT_EMAIL ?? null} />;
}
