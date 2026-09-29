import StaffOnly from "@/components/auth/StaffOnly";
import Scheduler from "@/components/social/Scheduler";

export default function SchedulePage() {
  return (
    <StaffOnly redirectTo="/social-media">
      <Scheduler />
    </StaffOnly>
  );
}
