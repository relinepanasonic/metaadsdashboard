import ContentKanban from "@/components/seo/ContentKanban";
import { contentPipeline } from "@/lib/seo/mock";

export default function ContentPage() {
  return <ContentKanban items={contentPipeline} />;
}
