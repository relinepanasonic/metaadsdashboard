import StaffOnly from "@/components/auth/StaffOnly";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StaffOnly redirectTo="/meta-ads">{children}</StaffOnly>;
}
