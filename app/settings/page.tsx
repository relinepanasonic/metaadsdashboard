import { Settings } from "lucide-react";
import PagePlaceholder from "@/components/PagePlaceholder";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default function SettingsPage() {
  return (
    <PagePlaceholder icon={Settings} title="Settings" subtitle="Account & app configuration">
      <ChangePasswordForm />
    </PagePlaceholder>
  );
}
