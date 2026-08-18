import { Users as UsersIcon } from "lucide-react";
import PagePlaceholder from "@/components/PagePlaceholder";
import UsersManager from "@/components/UsersManager";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") redirect("/");

  return (
    <PagePlaceholder icon={UsersIcon} title="Users & Access" subtitle="Invite staff and clients, manage roles">
      <UsersManager myRole={me.role} />
    </PagePlaceholder>
  );
}
